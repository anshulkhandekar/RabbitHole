import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceHandoff } from "../apps/extension/src/handoff-model";
import type { Handoff } from "../apps/extension/src/handoff";
import type { Session } from "../packages/contracts/src/index";
import { analysis } from "./support";
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
test("a handoff resolves only after all submitted finds are processed and reports real deltas", () => {
  assert.equal(
    advanceHandoff(
      hand,
      { ...session, processed: [] },
      undefined,
      Date.parse(hand.startedAt),
    ).status,
    "waiting",
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
