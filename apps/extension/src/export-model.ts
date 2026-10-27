import type { Session } from "../../../packages/contracts/src/index";
import {
  visibleAnalysis,
  visibleCaptureIds,
} from "../../../packages/contracts/src/sources";
type Analysis = NonNullable<Session["analysis"]>;
type Item = Analysis["studyItems"][number];
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const csv = (s: string) => `"${s.replace(/"/g, '""')}"`;
const tag = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40) || "rabbithole";
// Cards carry their receipt: the source quote and link they came from.
function source(
  session: Session,
  item: {
    captureIds: string[];
    evidence?: { captureId: string; quote: string }[];
  },
) {
  const id = item.evidence?.[0]?.captureId ?? item.captureIds[0],
    capture = session.captures.find((c) => c.id === id);
  if (!capture) return { quote: "", title: "", url: "" };
  return {
    quote: clean(item.evidence?.find((e) => e.captureId === id)?.quote ?? ""),
    title: clean(capture.title || capture.url),
    url: capture.url,
  };
}
function card(item: Item) {
  if (item.type === "quiz" && item.choices) {
    const right = item.choices[item.correctIndex ?? 0];
    return {
      front: `${clean(item.prompt)}\n${item.choices.map((c, i) => `${String.fromCharCode(65 + i)}. ${clean(c)}`).join("\n")}`,
      back: `${String.fromCharCode(65 + (item.correctIndex ?? 0))}. ${clean(right)}\n${clean(item.choiceExplanations?.[item.correctIndex ?? 0] ?? item.answer)}`,
    };
  }
  return { front: clean(item.prompt), back: clean(item.answer) };
}
const exportable = (a: Analysis) =>
  a.studyItems.filter((i) => i.type !== "matching" && !i.variantOf);
export function toAnkiCsv(session: Session) {
  const a = visibleAnalysis(session);
  if (!a) return "";
  const rows: string[][] = [];
  for (const item of exportable(a)) {
    const { front, back } = card(item),
      s = source(session, item);
    rows.push([
      front,
      back,
      [s.quote && `“${s.quote}”`, s.title, s.url].filter(Boolean).join("\n"),
      `rabbithole ${tag(session.title)} ${item.type}`,
    ]);
  }
  // Matching sets become one card per pair; each pair is a term and its meaning.
  for (const item of a.studyItems.filter((i) => i.type === "matching")) {
    const s = source(session, item);
    for (const p of item.pairs ?? [])
      rows.push([
        clean(p.left),
        clean(p.right),
        [s.title, s.url].filter(Boolean).join("\n"),
        `rabbithole ${tag(session.title)} matching`,
      ]);
  }
  return [
    "#separator:Comma",
    "#html:false",
    "#columns:Front,Back,Source,Tags",
    "#tags column:4",
    ...rows.map((r) => r.map(csv).join(",")),
  ].join("\n");
}
// Quizlet's import takes "term<TAB>definition" lines; newlines inside a card break it.
export function toQuizlet(session: Session) {
  const a = visibleAnalysis(session);
  if (!a) return "";
  const line = (t: string, d: string) =>
    `${clean(t).replace(/\t/g, " ")}\t${clean(d).replace(/\t/g, " ")}`;
  return [
    ...a.concepts.map((c) => line(c.label, c.claim ?? c.explanation)),
    ...a.studyItems
      .filter((i) => i.type === "matching")
      .flatMap((i) => (i.pairs ?? []).map((p) => line(p.left, p.right))),
    ...exportable(a)
      .filter((i) => i.type !== "quiz")
      .map((i) => line(i.prompt, i.answer)),
  ].join("\n");
}
const link = (label: string) => {
  const heading = label.replace(/[[\]|#^]/g, "");
  return `[[#${heading}|${heading}]]`;
};
export function toMarkdown(session: Session) {
  const a = visibleAnalysis(session);
  if (!a) return "";
  const label = (id: string) =>
    a.concepts.find((c) => c.id === id)?.label ?? id;
  const quote = (q: { captureId: string; quote: string }) => {
    const c = session.captures.find((x) => x.id === q.captureId);
    return `> ${clean(q.quote)}\n> — [${clean(c?.title || c?.url || "source")}](${c?.url ?? ""})`;
  };
  const out = [
    "---",
    `title: ${JSON.stringify(session.title)}`,
    `created: ${session.createdAt.slice(0, 10)}`,
    "source: RabbitHole",
    "tags: [rabbithole]",
    "---",
    "",
    `# ${session.title}`,
    "",
  ];
  if (session.goal) out.push(`**Question:** ${session.goal}`, "");
  const summary = a.summary ?? a.overview?.summary;
  if (summary) out.push(summary, "");
  const takeaways =
    a.takeaways?.map((t) => t.text) ?? a.overview?.takeaways ?? [];
  if (takeaways.length)
    out.push("## Takeaways", "", ...takeaways.map((t) => `- ${t}`), "");
  out.push("## Ideas", "");
  for (const c of a.concepts) {
    out.push(`### ${c.label}`, "");
    if (c.claim) out.push(`**${c.claim}**`, "");
    if (c.why) out.push(`*Why it exists:* ${c.why}`, "");
    out.push(c.explanation, "");
    if (c.steps) out.push(...c.steps.map((s, i) => `${i + 1}. ${s}`), "");
    if (c.example) out.push(`*Example:* ${c.example}`, "");
    if (c.boundary) out.push(`*Where it stops applying:* ${c.boundary}`, "");
    const links = a.edges.filter((e) => e.source === c.id);
    if (links.length)
      out.push(
        ...links.map(
          (e) =>
            `- ${e.label} ${link(label(e.target))}${e.evidenceKind !== "supported" ? " *(Go inferred)*" : ""}`,
        ),
        "",
      );
    for (const q of c.evidence ?? []) out.push(quote(q), "");
    if (c.gap) out.push(`*Gap:* ${c.gap}`, "");
  }
  const questions = exportable(a).filter((i) => i.type === "quiz");
  if (questions.length) {
    out.push("## Check yourself", "");
    for (const q of questions)
      out.push(
        `- ${q.prompt}`,
        ...(q.choices ?? []).map(
          (c, i) => `  ${String.fromCharCode(65 + i)}. ${c}`,
        ),
        `  - Answer: ${String.fromCharCode(65 + (q.correctIndex ?? 0))}. ${q.answer}`,
      );
    out.push("");
  }
  out.push("## Sources", "");
  for (const c of session.captures.filter(
    (c) =>
      c.sourceType !== "search" && visibleCaptureIds(session, [c.id]).length,
  ))
    out.push(`- [${clean(c.title || c.url)}](${c.url})`);
  return out.join("\n") + "\n";
}
