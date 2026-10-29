// Suggestions are source data, never automatic replacements or instructions.
// Keep exact text (including punctuation) so copying a candidate can pass preflight.
export function quoteCandidates(source: string, submitted: string) {
  const words = (s: string) =>
    new Set(s.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);
  const wanted = words(submitted);
  const passages = source.match(/[^.!?\n]+(?:[.!?]+|$)/g) ?? [source];
  const candidates = [
    ...new Set(
      passages
        .flatMap((p) => p.match(/[\s\S]{1,500}/g) ?? [])
        .map((p) => p.trim())
        .filter(Boolean),
    ),
  ];
  return candidates
    .map((quote) => ({
      quote,
      score: [...words(quote)].filter((word) => wanted.has(word)).length,
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || a.quote.length - b.quote.length)
    .slice(0, 3)
    .map((c) => c.quote);
}
