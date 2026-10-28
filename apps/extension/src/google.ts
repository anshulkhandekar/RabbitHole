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
  const visible = (el: HTMLElement) => {
    for (
      let current: HTMLElement | null = el;
      current;
      current = current.parentElement
    ) {
      if (current.hidden || current.getAttribute("aria-hidden") === "true")
        return false;
      const style = doc.defaultView?.getComputedStyle(current);
      if (style?.display === "none" || style?.visibility === "hidden")
        return false;
    }
    return el.getClientRects().length > 0;
  };
  const textOf = (el: HTMLElement) =>
    (el.innerText || el.textContent || "").trim();
  const candidates = [
    ...doc.querySelectorAll<HTMLElement>(
      '[aria-label="AI Overview"],[aria-label="AI Overviews"],[data-attrid="SGEAnswer"],[data-attrid="AIOverview"]',
    ),
  ];
  for (const heading of doc.querySelectorAll<HTMLElement>(
    'h1,h2,h3,[role="heading"]',
  )) {
    if (!/^AI Overviews?$/i.test(textOf(heading)) || !visible(heading))
      continue;
    const labelled = heading.id
      ? [...doc.querySelectorAll<HTMLElement>("[aria-labelledby]")].find((el) =>
          el.getAttribute("aria-labelledby")?.split(/\s+/).includes(heading.id),
        )
      : undefined;
    if (labelled) candidates.push(labelled);
    let parent = heading.parentElement;
    for (
      let depth = 0;
      parent && depth < 4;
      depth++, parent = parent.parentElement
    ) {
      if (parent.matches("body,main,#search,#rso")) break;
      if (textOf(parent).length > textOf(heading).length + 40) {
        candidates.push(parent);
        break;
      }
    }
  }
  const region = candidates.find(
    (el) => visible(el) && textOf(el).length >= 40,
  );
  if (!region) return null;
  const references = [
    ...new Set(
      [...region.querySelectorAll<HTMLAnchorElement>("a[href]")].flatMap(
        (a) => {
          try {
            let url = new URL(a.href, doc.baseURI);
            const google =
              url.hostname === "google.com" ||
              url.hostname.endsWith(".google.com");
            if (google && url.pathname === "/url") {
              const target =
                url.searchParams.get("q") || url.searchParams.get("url");
              if (target) url = new URL(target);
            }
            return /^https?:$/.test(url.protocol) &&
              !(
                url.hostname === "google.com" ||
                url.hostname.endsWith(".google.com")
              )
              ? [url.href]
              : [];
          } catch {
            return [];
          }
        },
      ),
    ),
  ].slice(0, 20);
  return { text: textOf(region).slice(0, 12000), references };
}
