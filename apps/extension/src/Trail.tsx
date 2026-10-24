import React, { useEffect, useRef } from "react";
import type { Session } from "../../../packages/contracts/src/index";
import {
  chronological,
  domain,
  sourceKind,
  sourceVerb,
  time,
} from "./ui-model";
import { Icon } from "./Icon";
import { Chip, Button } from "./components";
export function SourceQuote({ session, id }: { session: Session; id: string }) {
  const capture = session.captures.find((c) => c.id === id);
  if (!capture) return <p>Evidence unavailable for this capture.</p>;
  return (
    <blockquote
      className={`source-quote ${capture.sourceType === "highlight" ? "quoted-highlight" : ""}`}
    >
      <div className="quoted-text">
        {capture.text.slice(0, 500)}
        {capture.text.length > 500 ? "…" : ""}
      </div>
      {capture.text.length > 500 && (
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
}: {
  session: Session;
  ids: string[];
}) {
  return (
    <div className="evidence">
      {ids.map((id) => (
        <SourceQuote key={id} session={session} id={id} />
      ))}
    </div>
  );
}
export function Trail({
  session,
  queue = [],
  wide = false,
}: {
  session: Session;
  queue?: { body?: any }[];
  wide?: boolean;
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
    <ol className="trail" aria-label="Your trail, oldest first">
      {captures.map((c) => {
        const pending = !session.processed.includes(c.id),
          local = queue.some((q) => q.body?.id === c.id);
        return (
          <li
            key={c.id}
            className={`stop kind-${sourceKind(c)} ${c.sourceType !== "search" ? "is-child" : ""} ${pending ? "is-pending" : ""} ${c.sourceType === "highlight" ? "is-highlight" : ""} ${fresh.current.has(c.id) ? "is-new" : ""}`}
          >
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
                {pending ? (
                  <Chip kind="new">{wide ? "Not on the map yet" : "New"}</Chip>
                ) : wide ? (
                  <Chip kind="done">On the map</Chip>
                ) : null}
                {local && <span>Saved on this device</span>}
              </div>
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
            {domain(url)}
            <small>{url}</small>
          </span>
          <Button onClick={() => onInclude(url)}>Include again</Button>
        </div>
      ))}
    </section>
  ) : null;
}
