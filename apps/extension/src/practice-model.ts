import type {
  AnalysisData,
  Attempt,
} from "../../../packages/contracts/src/index";
export type StudyItem = AnalysisData["studyItems"][number];
export type Memory = "strong" | "shaky" | "untested";
export type Result = "right" | "wrong" | "partial";
// Confidence changes what an outcome means: a lucky guess isn't knowledge, and a
// confident miss is a misconception worth fixing first.
export type Flag = "misconception" | "fragile";
const lucky = (a: Attempt) =>
  a.confidence === "guess" || (a.hintsUsed ?? 0) > 0;
export function conceptsOf(item: StudyItem) {
  return [
    ...new Set([
      ...(item.concept ? [item.concept] : item.conceptIds),
      ...(item.pairs ?? []).flatMap((p) => (p.concept ? [p.concept] : [])),
    ]),
  ];
}
export function attemptResult(
  item: StudyItem,
  a: Attempt,
  id?: string,
): Result {
  if (item.type === "matching") {
    try {
      const metadata = JSON.parse(a.response);
      if (
        metadata.v === 2 &&
        metadata.slips > 0 &&
        (!id ||
          !metadata.missedConcepts?.length ||
          metadata.missedConcepts.includes(id))
      )
        return "partial";
    } catch {}
  }
  return a.rating === "understood"
    ? "right"
    : a.rating === "partly"
      ? "partial"
      : "wrong";
}
export function deriveMemory(
  analysis: AnalysisData,
  attempts: Attempt[],
  now = Date.now(),
): Record<string, Memory> {
  const result: Record<string, Memory> = {};
  for (const c of analysis.concepts) {
    const relevant = attempts
      .map((a) => ({
        a,
        item: analysis.studyItems.find((i) => i.id === a.studyId),
      }))
      .filter(
        (v): v is { a: Attempt; item: StudyItem } =>
          !!v.item && conceptsOf(v.item).includes(c.id),
      )
      .sort((x, y) => x.a.timestamp.localeCompare(y.a.timestamp));
    if (!relevant.length) {
      result[c.id] = "untested";
      continue;
    }
    const last = relevant.at(-1)!,
      recent = relevant.filter(
        (v) => now - Date.parse(v.a.timestamp) <= 30 * 86400000,
      ),
      net = recent.reduce(
        (n, v) =>
          n +
          (attemptResult(v.item, v.a, c.id) === "right"
            ? lucky(v.a)
              ? 0
              : 1
            : -1),
        0,
      );
    result[c.id] =
      attemptResult(last.item, last.a, c.id) === "right" &&
      !lucky(last.a) &&
      net > 0
        ? "strong"
        : "shaky";
  }
  return result;
}
export function deriveFlags(
  analysis: AnalysisData,
  attempts: Attempt[],
): Record<string, Flag> {
  const flags: Record<string, Flag> = {};
  const sorted = [...attempts].sort((x, y) =>
    x.timestamp.localeCompare(y.timestamp),
  );
  for (const a of sorted) {
    const item = analysis.studyItems.find((i) => i.id === a.studyId);
    if (!item) continue;
    for (const id of conceptsOf(item)) {
      const result = attemptResult(item, a, id);
      if (result === "wrong" && a.confidence === "sure")
        flags[id] = "misconception";
      else if (result === "right" && lucky(a)) flags[id] = "fragile";
      else if (result === "right" || result === "wrong") delete flags[id];
    }
  }
  return flags;
}
// Variants are retry material in a fresh wording; the first run uses originals.
export const originals = (items: StudyItem[]) =>
  items.filter((i) => !i.variantOf);
export function retryItems(items: StudyItem[], missed: StudyItem[]) {
  const used = new Set(missed.map((m) => m.id));
  return missed.map((m) => {
    const family = m.variantOf ?? m.id;
    const sibling = items.find(
      (i) =>
        !used.has(i.id) &&
        i.type === m.type &&
        (i.variantOf === family || (i.id === family && m.variantOf)),
    );
    if (sibling) used.add(sibling.id);
    return sibling ?? m;
  });
}
export function quickQueue(
  items: StudyItem[],
  memory: Record<string, Memory>,
  flags?: Record<string, Flag>,
): StudyItem[] {
  const pattern: StudyItem["type"][] = [
    "quiz",
    "matching",
    "connection",
    "flashcard",
    "quiz",
    "flashcard",
    "quiz",
    "connection",
  ];
  const rank = (i: StudyItem) =>
    conceptsOf(i).reduce(
      (n, id) =>
        n +
        (flags?.[id] === "misconception" ? 3 : memory[id] === "shaky" ? 1 : 0),
      0,
    );
  items = originals(items).length ? originals(items) : items;
  const ranked = [...items].sort(
      (a, b) => rank(b) - rank(a) || a.id.localeCompare(b.id),
    ),
    used = new Map<string, number>();
  if (!items.length) return [];
  return pattern.map((type) => {
    const choices = ranked.filter((i) => i.type === type),
      pool = choices.length ? choices : ranked;
    const chosen = [...pool].sort(
      (a, b) =>
        (used.get(a.id) ?? 0) - (used.get(b.id) ?? 0) || rank(b) - rank(a),
    )[0];
    used.set(chosen.id, (used.get(chosen.id) ?? 0) + 1);
    return chosen;
  });
}
export function connectionQueue(
  analysis: AnalysisData,
  edgeId: string,
): StudyItem[] {
  const edge = analysis.edges.find((e) => e.id === edgeId);
  if (!edge) return [];
  const saved = analysis.studyItems.filter(
    (i) =>
      i.type === "connection" &&
      conceptsOf(i).includes(edge.source) &&
      conceptsOf(i).includes(edge.target),
  );
  if (saved.length) return saved;
  const label = (id: string) =>
    analysis.concepts.find((c) => c.id === id)?.label ?? id;
  return [
    {
      id: "edge_" + edge.id,
      type: "connection",
      prompt: `How does ${label(edge.source)} ${edge.label} ${label(edge.target)}?`,
      answer: edge.explanation,
      conceptIds: [edge.source, edge.target],
      captureIds: edge.captureIds,
      evidence: edge.evidence,
    },
  ];
}

export type Lane = "new" | "review" | "harder";
export type Activity = StudyItem["type"] | "mixed";
export type PracticeTopic = {
  id: string;
  name: string;
  items: StudyItem[];
  total: number;
  untested: number;
  strong: number;
  shaky: number;
  confidentMisses: number;
  counts: Record<StudyItem["type"], number>;
  basicTotal: number;
  basicTried: number;
  rightWithoutHints: number;
  lanes: Record<Lane, StudyItem[]>;
  exhausted: Record<Lane, boolean>;
};
export const isBasic = (item: StudyItem) =>
  !item.level || item.level === "understand";
export function harderReady(topic: PracticeTopic) {
  const reason = {
    basicTotal: topic.basicTotal,
    basicTried: topic.basicTried,
    remaining: topic.basicTotal - topic.basicTried,
    rightWithoutHints: topic.rightWithoutHints,
    requiredRight: Math.ceil(topic.basicTotal * 0.75),
    confidentMisses: topic.confidentMisses,
  };
  const basicsReady =
    reason.basicTotal > 0 &&
    reason.remaining === 0 &&
    reason.rightWithoutHints >= reason.requiredRight &&
    reason.confidentMisses === 0;
  return {
    basicsReady,
    ready: basicsReady && topic.lanes.harder.length > 0,
    reason,
  };
}
export function harderLockReason(topic: PracticeTopic) {
  const { ready, basicsReady, reason: r } = harderReady(topic);
  if (ready) return "";
  if (basicsReady) return "Basics solid — ask Go for harder questions.";
  if (!r.basicTotal) return "Ask Go for basic questions first.";
  if (r.remaining)
    return `Try all basics first: ${r.remaining} still untested.`;
  if (r.confidentMisses)
    return `Review ${r.confidentMisses} outstanding confident ${r.confidentMisses === 1 ? "miss" : "misses"} first.`;
  return `Get at least ${r.requiredRight} of ${r.basicTotal} basics right without hints (${r.rightWithoutHints} so far).`;
}
export function practiceHub(
  analysis: AnalysisData,
  attempts: Attempt[],
  now = Date.now(),
) {
  const byId = new Map(analysis.concepts.map((c) => [c.id, c]));
  function topicOf(id: string): string | undefined {
    const visited = new Set<string>();
    while (!visited.has(id)) {
      const concept = byId.get(id);
      if (!concept) return;
      if (concept.main || !concept.parentId || !byId.has(concept.parentId))
        return id;
      visited.add(id);
      id = concept.parentId;
    }
    // Defensive support for legacy malformed trees.
    return [...visited].sort()[0];
  }
  const rootIds = new Set(analysis.concepts.map((c) => topicOf(c.id)));
  const roots = analysis.concepts.filter((c) => rootIds.has(c.id));
  const owner = (item: StudyItem) =>
    [
      ...new Set([
        ...(item.concept ? [item.concept] : []),
        ...item.conceptIds,
        ...conceptsOf(item),
      ]),
    ]
      .map(topicOf)
      .find((id) => id !== undefined) ?? roots[0]?.id;
  const latest = new Map<string, Attempt>();
  for (const a of [...attempts].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  ))
    latest.set(a.studyId, a);
  function summarize(
    id: string,
    name: string,
    items: StudyItem[],
  ): PracticeTopic {
    const counts = { quiz: 0, matching: 0, connection: 0, flashcard: 0 };
    let untested = 0,
      strong = 0,
      shaky = 0,
      confidentMisses = 0,
      basicTried = 0,
      rightWithoutHints = 0;
    const missed: StudyItem[] = [];
    const confident = new Set<string>();
    for (const item of items) {
      counts[item.type]++;
      const a = latest.get(item.id);
      if (!a) {
        untested++;
        continue;
      }
      const family = item.variantOf ?? item.id,
        familyIds = new Set(
          items
            .filter((i) => (i.variantOf ?? i.id) === family)
            .map((i) => i.id),
        ),
        relevant = attempts.filter((a) => familyIds.has(a.studyId)),
        memory = deriveMemory(analysis, relevant, now),
        flags = deriveFlags(analysis, relevant),
        ids = conceptsOf(item),
        result = attemptResult(item, a);
      if (isBasic(item) && !item.variantOf) {
        basicTried++;
        if (result === "right" && !lucky(a)) rightWithoutHints++;
      }
      const familyLast = [...relevant]
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
        .at(-1);
      const familyItem = items.find((i) => i.id === familyLast?.studyId);
      if (
        familyLast &&
        familyItem &&
        attemptResult(familyItem, familyLast) !== "right" &&
        !missed.some((i) => (i.variantOf ?? i.id) === family)
      )
        missed.push(familyItem);
      if (ids.some((id) => flags[id] === "misconception")) {
        confidentMisses++;
        confident.add(item.id);
      } else if (ids.length && ids.every((id) => memory[id] === "strong"))
        strong++;
      else shaky++;
    }
    missed.sort(
      (a, b) => Number(confident.has(b.id)) - Number(confident.has(a.id)),
    );
    const lanes = {
      new: items
        .filter((i) => !i.variantOf && !latest.has(i.id))
        .sort(
          (a, b) =>
            Number(isBasic(b)) - Number(isBasic(a)) ||
            Number(!!a.variantOf) - Number(!!b.variantOf),
        ),
      review: [
        ...new Map(retryItems(items, missed).map((i) => [i.id, i])).values(),
      ],
      harder: items.filter(
        (i) => !i.variantOf && !isBasic(i) && !latest.has(i.id),
      ),
    };
    return {
      id,
      name,
      items,
      total: items.length,
      counts,
      untested,
      strong,
      shaky,
      confidentMisses,
      basicTotal: items.filter((i) => isBasic(i) && !i.variantOf).length,
      basicTried,
      rightWithoutHints,
      lanes,
      exhausted: {
        new: !lanes.new.length,
        review: !lanes.review.length,
        harder: !lanes.harder.length,
      },
    };
  }
  const topics = roots.map((c) =>
    summarize(
      c.id,
      c.label,
      analysis.studyItems.filter((i) => owner(i) === c.id),
    ),
  );
  return {
    all: summarize("all", "All topics", analysis.studyItems),
    topics,
    coverage: {
      emptyTopics: topics.filter((t) => !t.total),
      missingLanes: topics.flatMap((t) =>
        (["new", "review", "harder"] as Lane[])
          .filter(
            (l) =>
              !t.items.some((i) =>
                l === "harder"
                  ? !i.variantOf && !isBasic(i)
                  : l === "new"
                    ? !i.variantOf && isBasic(i)
                    : !!i.variantOf,
              ),
          )
          .map((lane) => ({ topicId: t.id, topicName: t.name, lane })),
      ),
    },
  };
}
export function roundQueue(
  topic: PracticeTopic,
  lane: Lane,
  activity: Activity,
  size: number,
  readyTopics?: PracticeTopic[],
) {
  const allowed =
    lane === "harder" && readyTopics
      ? new Set(
          readyTopics
            .filter((t) => harderReady(t).ready)
            .flatMap((t) => t.lanes.harder.map((i) => i.id)),
        )
      : undefined;
  const pool = topic.lanes[lane].filter(
    (i) =>
      (activity === "mixed" || i.type === activity) &&
      (!allowed || allowed.has(i.id)),
  );
  if (activity !== "mixed" || lane === "review") return pool.slice(0, size);
  const pattern: StudyItem["type"][] = [
      "quiz",
      "matching",
      "connection",
      "flashcard",
    ],
    result: StudyItem[] = [];
  let cursor = 0;
  while (pool.length && result.length < size) {
    const basic = lane === "new" && pool.some(isBasic),
      eligible = pool.filter((i) => !basic || isBasic(i));
    let chosen: StudyItem | undefined;
    for (let n = 0; n < pattern.length; n++) {
      const type = pattern[cursor++ % pattern.length];
      chosen = eligible.find((i) => i.type === type);
      if (chosen) break;
    }
    if (!chosen) break;
    result.push(chosen);
    pool.splice(pool.indexOf(chosen), 1);
  }
  return result;
}

export function localOnlyNotice(attempts: Attempt[]) {
  const count = attempts.filter((a) => a.localOnly).length;
  return count
    ? `${count} ${count === 1 ? "answer was" : "answers were"} checked against an older version and kept on this device.`
    : "";
}
