import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceHandoff } from "../apps/extension/src/handoff-model";
import type { Handoff } from "../apps/extension/src/handoff";
import { Capture, type Session } from "../packages/contracts/src/index";
import { analysis, capture } from "./support";
const hand: Handoff = {
  sessionId: "s1",
  prompt: "process",
  copied: true,
  opened: true,
  version: 0,
  captureIds: ["c1"],
  startedAt: "2026-10-27T10:00:00Z",
  status: "waiting",
};
const session = {
  id: "s1",
  version: 1,
  processed: ["c1"],
  captures: [{ id: "c1" }],
  analysis: analysis(),
} as Session;
test("a new saved version resolves a handoff even with submitted finds pending", () => {
  assert.equal(
    advanceHandoff(
      hand,
      { ...session, processed: [] },
      undefined,
      Date.parse(hand.startedAt),
    ).status,
    "saved",
  );
  const result = advanceHandoff(hand, session, { ...session, analysis: null });
  assert.equal(result.status, "saved");
  assert.equal(result.ideas, 2);
  assert.equal(result.questions, 3);
  assert.equal(result.finds, 1);
});
test("known deleted submitted finds fail while an unobservable failure only stalls", () => {
  const failed = advanceHandoff(hand, {
    ...session,
    version: 0,
    processed: [],
    removed: ["c1"],
  });
  assert.equal(failed.status, "failed");
  assert.match(failed.reason!, /deleted/);
  const stalled = advanceHandoff(
    hand,
    { ...session, version: 0, processed: [] },
    undefined,
    Date.parse(hand.startedAt) + 600001,
  );
  assert.equal(stalled.status, "stalled");
  assert.equal(stalled.reason, undefined);
  assert.equal(advanceHandoff(failed, session).status, "failed");
});

test("a partial Go save records submitted finds still pending", () => {
  const result = advanceHandoff({ ...hand, captureIds: ["c1", "c2"] }, session);
  assert.equal(result.status, "saved");
  assert.equal(result.pendingFinds, 1);
  assert.equal(result.finds, 2);
});

test("a partial-save receipt names the version and pending count", async () => {
  const { savedReceipt } = await import("../apps/extension/src/handoff-model");
  assert.equal(
    savedReceipt({
      ...hand,
      status: "saved",
      savedVersion: 3,
      pendingFinds: 1,
    }),
    "Saved v3 · 1 find still waiting",
  );
});

test("ready note counts processed finds and uses singular nouns", async () => {
  const React = (await import("react")).default;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { ReadyNote } = await import("../apps/extension/src/ReadyNote");
  const html = renderToStaticMarkup(
    React.createElement(ReadyNote, {
      handoff: {
        ...hand,
        status: "saved",
        savedVersion: 3,
        finds: 2,
        pendingFinds: 1,
        ideas: 1,
        questions: 1,
      },
      onOpen() {},
      onDismiss() {},
    }),
  );
  assert.match(html, /Go added 1 idea and 1 question from 1 new find/);
  assert.match(html, /Saved v3 · 1 find still waiting/);
});

const find = (id: string) => Capture.parse(capture(id));
for (const hidden of [false, true])
  test(`deleted-find failure counts only remaining submitted finds (hidden=${hidden})`, async () => {
    const { failedHandoffNote } =
      await import("../apps/extension/src/handoff-model");
    const current = {
      ...session,
      captures: [find("c2"), find("other")],
      processed: [],
      removed: ["c1"],
      hidden: hidden ? ["c2"] : [],
    } as Session;
    assert.equal(
      failedHandoffNote(
        { ...hand, status: "failed", captureIds: ["c1", "c2"] },
        current,
      ),
      "Your map hasn't changed. 1 find is still waiting.",
    );
  });

test("deleted-find failure says none remain without counting other pending, removed or processed finds", async () => {
  const { failedHandoffNote } =
    await import("../apps/extension/src/handoff-model");
  const current = {
    ...session,
    captures: [find("other")],
    processed: [],
    removed: ["c1"],
  } as Session;
  const note = failedHandoffNote({ ...hand, status: "failed" }, current);
  assert.equal(
    note,
    "Your map hasn't changed. None of the sent finds are waiting now.",
  );
  assert.doesNotMatch(note, /still waiting/);
  assert.equal(
    failedHandoffNote({ ...hand, status: "failed", captureIds: ["c1", "c2"] }, {
      ...current,
      captures: [find("c1"), find("c2"), find("other")],
      processed: ["c2"],
      removed: ["c1"],
    } as Session),
    "Your map hasn't changed. None of the sent finds are waiting now.",
  );
});

test("deleted-find failure pluralizes multiple remaining finds", async () => {
  const { failedHandoffNote } =
    await import("../apps/extension/src/handoff-model");
  assert.equal(
    failedHandoffNote(
      { ...hand, status: "failed", captureIds: ["c1", "c2", "c3"] },
      {
        ...session,
        captures: [find("c2"), find("c3")],
        processed: [],
        removed: ["c1"],
      } as Session,
    ),
    "Your map hasn't changed. 2 finds are still waiting.",
  );
});
