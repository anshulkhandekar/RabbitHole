import React, { useState, useEffect } from "react";
import type { Session } from "../../../packages/contracts/src/index";
import type { Selection } from "./MapView";
import { deriveMemory } from "./practice-model";
import { Button, IconButton } from "./components";
import { Evidence } from "./Trail";
import { ideaDepths, mergeEdges } from "./map-layout";
export function IdeaDrawer({
  session,
  selected,
  onSelect,
  onPractice,
  onWalk,
}: {
  session: Session;
  selected: Selection;
  onSelect: (s: Selection) => void;
  onPractice: (ids: string[], edgeId?: string) => void;
  onWalk: (id: string) => void;
}) {
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [selected?.id]);
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
  const memory = deriveMemory(a, session.attempts);
  const item = (c ?? e)!,
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
      <div className="drawer-body">
        {c ? (
          <>
            <h2>{c.label}</h2>
            <p className={`memory-line ${memory[c.id]}`}>
              {memory[c.id] === "strong"
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
        <p>{item.explanation}</p>
        <h3>{c ? "Why it’s on your map" : "Where you read it"}</h3>
        {e && e.evidenceKind !== "supported" ? (
          <div className="inferred-box">
            <b>Not in your trail</b>
            <p>Go inferred this connection. Check it against your sources.</p>
          </div>
        ) : (
          <>
            <Evidence
              session={session}
              ids={more ? item.captureIds : item.captureIds.slice(0, 1)}
              excerpts={item.evidence}
            />
            {item.captureIds.length > 1 && !more && (
              <button className="text-button" onClick={() => setMore(true)}>
                Show {item.captureIds.length - 1} more source
                {item.captureIds.length > 2 ? "s" : ""}
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
