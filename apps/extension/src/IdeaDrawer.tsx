import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import type { Session } from "../../../packages/contracts/src/index";
import type { Selection } from "./MapView";
import { deriveFlags, deriveMemory } from "./practice-model";
import { googleSearchUrl, visibleEvidence } from "./ui-model";
import { Icon } from "./Icon";
import { Button, IconButton } from "./components";
import { Evidence } from "./Trail";
import { ideaDepths, mergeEdges } from "./map-layout";
export function IdeaDrawer({
  session,
  selected,
  onSelect,
  onPractice,
  onWalk,
  onExplain,
}: {
  session: Session;
  selected: Selection;
  onSelect: (s: Selection) => void;
  onPractice: (ids: string[], edgeId?: string) => void;
  onWalk: (id: string) => void;
  onExplain?: (id: string, style: string) => void;
}) {
  const [more, setMore] = useState(false),
    [explain, setExplain] = useState(false);
  useEffect(() => {
    setMore(false);
    setExplain(false);
  }, [selected?.id]);
  const scroll = useRef<HTMLDivElement>(null),
    positions = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const key = `${session.id}:${selected?.kind}:${selected?.id}`,
      el = scroll.current;
    if (el) el.scrollTop = positions.current.get(key) ?? 0;
    return () => {
      if (el) positions.current.set(key, el.scrollTop);
    };
  }, [session.id, selected?.kind, selected?.id]);
  const a = session.analysis!;
  const c =
      selected?.kind === "concept"
        ? a.concepts.find((c) => c.id === selected.id)
        : undefined,
    e =
      selected?.kind === "edge"
        ? mergeEdges(a.edges).find((e) => e.ids.includes(selected.id))
        : undefined;
  if (!c && !e) return null;
  const memory = deriveMemory(a, session.attempts),
    flags = deriveFlags(a, session.attempts);
  const item = (c ?? e)!,
    shown = visibleEvidence(session, item.captureIds),
    label = (id: string) => a.concepts.find((c) => c.id === id)?.label ?? id;
  return (
    <aside className="idea-drawer" aria-label="Idea and connection details">
      <header>
        <span>
          {c
            ? `Idea · found at depth ${ideaDepths(a, session.captures).get(c.id) ?? "unknown"}`
            : "Connection"}
        </span>
        <IconButton
          name="x"
          label="Close details"
          onClick={() => onSelect(null)}
        />
      </header>
      <div className="drawer-body" ref={scroll}>
        {c ? (
          <>
            <h2>{c.label}</h2>
            <p className={`memory-line ${memory[c.id]}`}>
              {flags[c.id] === "misconception"
                ? "● Confident miss: you were sure, and it was wrong. Fix this first."
                : flags[c.id] === "fragile"
                  ? "● Fragile: right, but you guessed or needed a hint"
                  : memory[c.id] === "strong"
                    ? "● Strong: net right in your recent practice"
                    : memory[c.id] === "shaky"
                      ? "● Shaky: worth another pass"
                      : "○ Untested: try practicing this idea"}
            </p>
          </>
        ) : (
          <h2 className="connection-sentence">
            <button
              onClick={() => onSelect({ kind: "concept", id: e!.source })}
            >
              {label(e!.source)}
            </button>{" "}
            {e!.label}{" "}
            <button
              onClick={() => onSelect({ kind: "concept", id: e!.target })}
            >
              {label(e!.target)}
            </button>
          </h2>
        )}
        {c?.claim && <p className="idea-claim">{c.claim}</p>}
        {c?.why && (
          <div className="idea-why">
            <b>Why this exists</b>
            <p>{c.why}</p>
          </div>
        )}
        <p>{item.explanation}</p>
        {c?.steps && (
          <ol className="idea-steps" aria-label="How it works, step by step">
            {c.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        )}
        {item.example && (
          <div className="idea-example">
            <b>Example</b>
            <p>{item.example}</p>
          </div>
        )}
        {c?.boundary && (
          <div className="idea-boundary">
            <b>Where it stops applying</b>
            <p>{c.boundary}</p>
          </div>
        )}
        {c?.takeaways?.length ? (
          <>
            <h3>Remember</h3>
            <ul className="idea-takeaways">
              {c.takeaways.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </>
        ) : null}
        {c?.buildsOn?.length ? (
          <p className="idea-builds">
            Builds on{" "}
            {c.buildsOn.map((id, i) => (
              <React.Fragment key={id}>
                {i > 0 && ", "}
                <button onClick={() => onSelect({ kind: "concept", id })}>
                  {label(id)}
                </button>
              </React.Fragment>
            ))}
          </p>
        ) : null}
        <h3>{c ? "Why it’s on your map" : "Where you read it"}</h3>
        {!shown.length ? (
          <div className="inferred-box">
            <b>Sources removed</b>
            <p>
              You hid or deleted the sources for this. Rebuild with Go to update
              the map.
            </p>
          </div>
        ) : e && e.evidenceKind !== "supported" ? (
          <div className="inferred-box">
            <b>Not in your trail</b>
            <p>Go inferred this connection. Check it against your sources.</p>
          </div>
        ) : (
          <>
            <Evidence
              session={session}
              ids={more ? shown : shown.slice(0, 1)}
              excerpts={item.evidence}
            />
            {shown.length > 1 && !more && (
              <button className="text-button" onClick={() => setMore(true)}>
                Show {shown.length - 1} more source
                {shown.length > 2 ? "s" : ""}
              </button>
            )}
          </>
        )}
        {c && (
          <>
            <h3>Connected to</h3>
            <div className="drawer-links">
              {a.edges
                .filter((e) => e.source === c.id || e.target === c.id)
                .map((e) => (
                  <button
                    key={e.id}
                    onClick={() =>
                      onSelect({
                        kind: "concept",
                        id: e.source === c.id ? e.target : e.source,
                      })
                    }
                  >
                    {e.source === c.id ? (
                      <>
                        {e.label} / <b>{label(e.target)}</b>
                      </>
                    ) : (
                      <>
                        <b>{label(e.source)}</b> / {e.label}
                      </>
                    )}
                    {e.evidenceKind !== "supported" && (
                      <small>Go inferred</small>
                    )}
                  </button>
                ))}
            </div>
            {c.gap && (
              <div className="gapbox">
                <b>A gap in your trail</b>
                <p>{c.gap}</p>
                {c.nextSearch && (
                  <a
                    className="search-chip"
                    href={googleSearchUrl(c.nextSearch)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Icon name="search" size={14} />
                    Search: {c.nextSearch}
                  </a>
                )}
              </div>
            )}
            {onExplain && (
              <div className="explain-again">
                <button
                  className="text-button"
                  aria-expanded={explain}
                  onClick={() => setExplain(!explain)}
                >
                  Still unclear? Ask Go to explain it differently
                </button>
                {explain && (
                  <div className="explain-styles">
                    {[
                      ["simpler", "Simpler"],
                      ["steps", "Step by step"],
                      ["analogy", "With an analogy"],
                      ["example", "With a worked example"],
                    ].map(([style, name]) => (
                      <Button
                        key={style}
                        onClick={() => onExplain(c.id, style)}
                      >
                        {name}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <footer>
        {c ? (
          <>
            <Button primary onClick={() => onPractice([c.id])}>
              Practice this
            </Button>
            <Button onClick={() => onWalk(c.id)}>Walk from here</Button>
          </>
        ) : (
          <Button
            primary
            onClick={() => onPractice([e!.source, e!.target], e!.id)}
          >
            Explain it yourself
          </Button>
        )}
      </footer>
    </aside>
  );
}
