import { Readability } from "@mozilla/readability";
const ignored =
  'input,textarea,select,[contenteditable],script,style,nav,footer,header,aside,form,iframe,[hidden],[aria-hidden="true"],[role="navigation"],[data-rabbithole-reading]';
export function cleanCapture<T extends Document | HTMLElement>(root: T) {
  const clone = root.cloneNode(true) as typeof root;
  const originals = root.querySelectorAll<HTMLElement>("*"),
    copies = clone.querySelectorAll<HTMLElement>("*"),
    view = (root.nodeType === 9 ? (root as Document) : root.ownerDocument)
      ?.defaultView;
  originals.forEach((el, i) => {
    const style = view?.getComputedStyle(el);
    if (
      style?.display === "none" ||
      style?.visibility === "hidden" ||
      style?.visibility === "collapse"
    )
      copies[i].remove();
  });
  clone
    .querySelectorAll(
      ignored +
        ',[id*="cookie-banner" i],[id*="consent-banner" i],[class*="cookie-banner" i],[class*="consent-banner" i],[aria-label*="cookie consent" i]',
    )
    .forEach((el) => el.remove());
  clone.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    if (el.style.display === "none" || el.style.visibility === "hidden")
      el.remove();
  });
  return clone;
}
function blockText(root: HTMLElement) {
  root
    .querySelectorAll(
      "p,div,section,article,h1,h2,h3,h4,h5,h6,li,blockquote,pre,tr,br",
    )
    .forEach((el) => {
      el.before("\n");
      el.after("\n");
    });
  return (root.textContent ?? "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
export function pageText(doc: Document) {
  const clone = cleanCapture(doc);
  try {
    const article = new Readability<HTMLElement>(clone, {
      charThreshold: 120,
      serializer: (node) => node as HTMLElement,
    }).parse();
    const title = article?.title?.replace(/\s+/g, " ").trim() ?? "";
    const content = article?.content;
    const heading = content?.querySelector("h1,h2");
    if (title && heading?.textContent?.replace(/\s+/g, " ").trim() === title)
      heading.remove();
    const body = content ? blockText(content) : "";
    const text =
      title &&
      body &&
      body !== title &&
      !body.startsWith(title + "\n") &&
      !body.startsWith(title + " ")
        ? `${title}\n${body}`
        : body;
    if (text && text.length >= 120) return text.slice(0, 12000);
  } catch {}
  // Documentation and dynamic applications often expose a main region that Reader View declines.
  for (const root of doc.querySelectorAll<HTMLElement>(
    'article,main,[role="main"],[itemprop="articleBody"]',
  )) {
    if (root.closest('[hidden],[aria-hidden="true"]')) continue;
    const style = doc.defaultView?.getComputedStyle(root);
    if (style?.display === "none" || style?.visibility === "hidden") continue;
    const clean = cleanCapture(root),
      text = blockText(clean);
    if (text.length >= 120) return text.slice(0, 12000);
  }
  return null;
}
export const articleChanged = (previous: string, next: string) =>
  !previous || next.length > previous.length * 1.25 + 200;
