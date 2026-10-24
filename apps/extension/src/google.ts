export function googleQuery(url: string) {
  const u = new URL(url);
  return new Set([
    "google.com",
    "www.google.com",
    "www.google.co.uk",
    "www.google.co.in",
    "www.google.ca",
    "www.google.com.au",
    "www.google.de",
    "www.google.fr",
    "www.google.co.jp",
  ]).has(u.hostname) && u.pathname === "/search"
    ? u.searchParams.get("q")
    : null;
}
export function overview(doc: Document) {
  // Conservative adapter: require an explicitly labeled, visible AI Overview region.
  const region = doc.querySelector<HTMLElement>('[aria-label="AI Overview"]');
  if (
    !region ||
    region.hidden ||
    region.getAttribute("aria-hidden") === "true" ||
    region.getClientRects().length === 0
  )
    return null;
  const text = region.innerText?.trim();
  if (!text || text.length < 40) return null;
  const references = [
    ...new Set(
      [...region.querySelectorAll<HTMLAnchorElement>("a[href]")]
        .map((a) => a.href)
        .filter(
          (h) =>
            /^https?:/.test(h) && !new URL(h).hostname.endsWith("google.com"),
        ),
    ),
  ].slice(0, 20);
  return { text: text.slice(0, 12000), references };
}
