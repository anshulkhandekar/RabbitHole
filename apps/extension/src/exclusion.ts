// Exclusions are exact page URLs, or "site:<hostname>" for a whole site.
export const siteKey = (url: string) => {
  try {
    return "site:" + new URL(url).hostname;
  } catch {
    return "";
  }
};
export const isExcluded = (list: string[] | undefined, url: string) =>
  !!list?.length && (list.includes(url) || list.includes(siteKey(url)));
export const exclusionLabel = (entry: string) =>
  entry.startsWith("site:") ? `All of ${entry.slice(5)}` : entry;
// Words that say nothing about a topic, so they don't count as overlap.
const filler = new Set(
  "the a an and or of to in on for is are was how why what when where which who does do did can with vs versus best about from into your my at by be it this that".split(
    " ",
  ),
);
const words = (text: string) =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 2 && !filler.has(w))
    .map((w) => w.replace(/(ing|es|s)$/, ""));
// A query that shares no topic word with the session so far looks like a new topic.
export function looksUnrelated(query: string, seen: string[]) {
  const q = words(query),
    known = new Set(seen.flatMap(words));
  return q.length > 0 && known.size > 0 && !q.some((w) => known.has(w));
}
