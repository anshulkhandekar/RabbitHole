// Both ends and the entire selected range must stay outside editable/private fields.
export function readSelection(document: Document, minimum = 1) {
  const selected = document.getSelection();
  if (!selected || selected.isCollapsed || selected.rangeCount !== 1)
    return undefined;
  const editable =
    'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[data-rabbithole-reading]';
  if (document.activeElement?.closest(editable)) return undefined;
  const range = selected.getRangeAt(0);
  if (
    [range.startContainer, range.endContainer].some((n) =>
      (n.nodeType === 1 ? (n as Element) : n.parentElement)?.closest(editable),
    )
  )
    return undefined;
  for (const el of document.querySelectorAll(editable))
    if (range.intersectsNode(el)) return undefined;
  const text = selected.toString().trim();
  return text.length >= minimum ? text.slice(0, 12000) : undefined;
}
