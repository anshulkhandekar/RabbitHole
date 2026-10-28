import { Readability } from "@mozilla/readability";
const ignored =
  'input,textarea,select,[contenteditable],script,style,nav,footer,header,aside,form,iframe,[hidden],[aria-hidden="true"],[role="navigation"],[data-rabbithole-reading]';
export function cleanCapture<T extends Document | HTMLElement>(root: T) {
  const clone = root.cloneNode(true) as typeof root;
  clone.querySelectorAll(ignored).forEach((el) => el.remove());
  clone.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    if (el.style.display === "none" || el.style.visibility === "hidden")
      el.remove();
  });
  return clone;
}
export function pageText(doc: Document) {
  const clone = cleanCapture(doc);
  try {
    const article = new Readability(clone, { charThreshold: 120 }).parse();
    const text = article?.textContent?.trim();
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
      text = (clean.innerText || clean.textContent || "")
        .replace(/\s+/g, " ")
        .trim();
    if (text.length >= 120) return text.slice(0, 12000);
  }
  return null;
}
export const articleChanged = (previous: string, next: string) =>
  !previous || next.length > previous.length * 1.25 + 200;
