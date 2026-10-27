import React, { useEffect, useRef, useState } from "react";
import type { Session } from "../../../packages/contracts/src/index";
import {
  chronological,
  domain,
  sourceKind,
  sourceVerb,
  time,
  visibleEvidence,
} from "./ui-model";
import { Icon } from "./Icon";
import { Chip, Button, IconButton } from "./components";
import { exclusionLabel } from "./exclusion";
export type CaptureAction =
  | "hide"
  | "unhide"
  | "important"
  | "confusing"
  | "untag"
  | "exclude"
  | "exclude-site"
  | "delete";
type Capture = Session["captures"][number];
function CaptureMenu({
  capture,
  hidden,
  onAction,
}: {
  capture: Capture;
  hidden: boolean;
  onAction: (action: CaptureAction, capture: Capture) => void;
}) {
  const [open, setOpen] = useState(false),
    anchor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (!anchor.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("focusin", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("focusin", close);
    };
  }, [open]);
  const items: [CaptureAction, string][] = [
    hidden ? ["unhide", "Show on map again"] : ["hide", "Hide from map"],
    ...(capture.tag !== "important"
      ? ([["important", "Mark important"]] as [CaptureAction, string][])
      : []),
    ...(capture.tag !== "confusing"
      ? ([["confusing", "Mark confusing"]] as [CaptureAction, string][])
      : []),
    ...(capture.tag !== "none"
      ? ([["untag", "Clear mark"]] as [CaptureAction, string][])
      : []),
    ...(capture.sourceType !== "search" && capture.sourceType !== "highlight"
      ? ([
          ["exclude", "Never save this page"],
          ["exclude-site", `Never save ${domain(capture.url)}`],
        ] as [CaptureAction, string][])
      : []),
    ["delete", "Delete find"],
  ];
  return (
    <div
      className="stop-menu"
      ref={anchor}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          setOpen(false);
          anchor.current?.querySelector<HTMLButtonElement>("button")?.focus();
        }
      }}
    >
      <IconButton
        name="more"
        label="Find actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      />
      {open && (
        <div className="stop-menu-list" role="menu">
          {items.map(([action, name]) => (
            <button
              key={action}
              role="menuitem"
              className={action === "delete" ? "danger" : ""}
              onClick={() => {
                setOpen(false);
                onAction(action, capture);
              }}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
export function SourceQuote({
  session,
  id,
  quote,
}: {
  session: Session;
  id: string;
  quote?: string;
}) {
  const capture = session.captures.find((c) => c.id === id);
  if (!capture || !visibleEvidence(session, [id]).length)
    return (
      <p>
        This source is hidden or removed. Rebuild with Go to update the guide.
      </p>
    );
  const excerpt = quote ?? capture.text.slice(0, 180);
  return (
    <blockquote
      className={`source-quote ${capture.sourceType === "highlight" ? "quoted-highlight" : ""}`}
    >
      <div className="quoted-text">
        {excerpt}
        {!quote && capture.text.length > excerpt.length ? "…" : ""}
      </div>
      {capture.text !== excerpt && (
        <details>
          <summary>Read captured text</summary>
          <div className="quoted-text">{capture.text}</div>
        </details>
      )}
      <footer>
        <a href={capture.url} target="_blank" rel="noreferrer">
          {capture.title || domain(capture.url)}
        </a>
        <time dateTime={capture.timestamp}>{time(capture.timestamp)}</time>
      </footer>
      {capture.sourceType === "google_ai_overview" && (
        <small className="quote-note">
          AI-generated overview. Its references have not been independently
          read.
        </small>
      )}
    </blockquote>
  );
}
export function Evidence({
  session,
  ids,
  excerpts,
}: {
  session: Session;
  ids: string[];
  excerpts?: { captureId: string; quote: string }[];
}) {
  return (
    <div className="evidence">
      {ids.map((id) => (
        <SourceQuote
          key={id}
          session={session}
          id={id}
          quote={excerpts?.find((e) => e.captureId === id)?.quote}
        />
      ))}
    </div>
  );
}
export function Trail({
  session,
  queue = [],
  wide = false,
  onAction,
  selected,
  onSelect,
}: {
  session: Session;
  queue?: { body?: any }[];
  wide?: boolean;
  onAction?: (action: CaptureAction, capture: Capture) => void;
  selected?: Set<string>;
  onSelect?: (id: string, on: boolean) => void;
}) {
  const captures = chronological(session.captures),
    previous = useRef(new Set(captures.map((c) => c.id))),
    fresh = useRef(new Set<string>());
  captures.forEach((c) => {
    if (!previous.current.has(c.id)) fresh.current.add(c.id);
  });
  useEffect(() => {
    previous.current = new Set(captures.map((c) => c.id));
    const timer = setTimeout(() => fresh.current.clear(), 1700);
    return () => clearTimeout(timer);
  }, [captures.length]);
  return (
    <ol
      className={`trail ${onSelect ? "selectable" : ""} ${onAction ? "actionable" : ""}`}
      aria-label="Your trail, oldest first"
    >
      {captures.map((c) => {
        const hidden = !!session.hidden?.includes(c.id),
          pending = !hidden && !session.processed.includes(c.id),
          local = queue.some((q) => q.body?.id === c.id);
        return (
          <li
            key={c.id}
            className={`stop kind-${sourceKind(c)} ${c.sourceType !== "search" ? "is-child" : ""} ${pending ? "is-pending" : ""} ${c.sourceType === "highlight" ? "is-highlight" : ""} ${fresh.current.has(c.id) ? "is-new" : ""} ${hidden ? "is-hidden" : ""}`}
          >
            {onSelect && (
              <input
                type="checkbox"
                className="stop-select"
                aria-label={`Select ${c.title || c.text.slice(0, 40)}`}
                checked={!!selected?.has(c.id)}
                onChange={(e) => onSelect(c.id, e.target.checked)}
              />
            )}
            <span className="stop-node" aria-hidden="true">
              <Icon name={sourceKind(c)} size={16} />
            </span>
            <div className="stop-body">
              {c.sourceType === "highlight" ? (
                <blockquote className="stop-quote" title={c.text}>
                  <span>{c.text}</span>
                </blockquote>
              ) : (
                <a
                  className="stop-title"
                  href={c.url}
                  title={c.title || c.text}
                  target="_blank"
                  rel="noreferrer"
                >
                  {c.sourceType === "search"
                    ? c.text
                    : c.title || domain(c.url)}
                </a>
              )}
              <div className="stop-meta">
                <span>{sourceVerb(c)}</span>
                <span title={c.url}>
                  {c.sourceType === "search"
                    ? time(c.timestamp)
                    : domain(c.url)}
                </span>
                {c.tag === "confusing" && (
                  <Chip>
                    <Icon name="flag" size={12} />
                    Confusing
                  </Chip>
                )}
                {c.tag === "important" && c.sourceType !== "highlight" && (
                  <Chip>Important</Chip>
                )}
                {hidden ? (
                  <Chip>Hidden from map</Chip>
                ) : pending ? (
                  <Chip kind="new">{wide ? "Not on the map yet" : "New"}</Chip>
                ) : wide ? (
                  <Chip kind="done">On the map</Chip>
                ) : null}
                {local && <span>Saved on this device</span>}
              </div>
              {onAction && (
                <CaptureMenu capture={c} hidden={hidden} onAction={onAction} />
              )}
              {wide && c.sourceType !== "highlight" && (
                <details className="capture-details">
                  <summary>Read captured text</summary>
                  <blockquote className="source-quote quoted-text">
                    {c.text}
                  </blockquote>
                </details>
              )}
              {c.sourceType === "google_ai_overview" && (
                <small className="quote-note">
                  AI-generated overview; referenced pages have not been
                  independently read.
                </small>
              )}
              {wide &&
                c.references.map((url) => (
                  <a
                    className="observed-reference"
                    href={url}
                    key={url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Observed reference: {domain(url)}
                  </a>
                ))}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
export function Excluded({
  urls,
  onInclude,
}: {
  urls: string[];
  onInclude: (url: string) => void;
}) {
  return urls.length ? (
    <section className="excluded-section">
      <h2>Excluded</h2>
      {urls.map((url) => (
        <div className="excl" key={url}>
          <Icon name="excluded" size={16} />
          <span className="grow" title={url}>
            {url.startsWith("site:") ? exclusionLabel(url) : domain(url)}
            {!url.startsWith("site:") && <small>{url}</small>}
          </span>
          <Button onClick={() => onInclude(url)}>Include again</Button>
        </div>
      ))}
    </section>
  ) : null;
}
