import React from "react";
import type { Session } from "../../../packages/contracts/src/index";
import { deriveFlags, deriveMemory } from "./practice-model";
import { googleSearchUrl } from "./ui-model";
import { mergeEdges } from "./map-layout";
import { Icon } from "./Icon";
import { Button } from "./components";
import { routeIds, takeaways } from "./summary-model";
export function Summary({
  session,
  onMap,
  onPractice,
  onWalk,
  onExport,
}: {
  session: Session;
  onMap: (id?: string, memory?: boolean) => void;
  onPractice: () => void;
  onWalk: () => void;
  onExport?: (format: string) => void;
}) {
  const a = session.analysis;
  if (!a)
    return (
      <section className="empty">
        <h2>Your summary starts with your trail</h2>
        <p>Send your saved finds to Go to build a summary.</p>
      </section>
    );
  const memory = deriveMemory(a, session.attempts),
    flags = deriveFlags(a, session.attempts),
    shaky = a.concepts.filter((c) => memory[c.id] === "shaky"),
    confident = a.concepts.filter((c) => flags[c.id] === "misconception");
  const route = routeIds(a),
    gaps = a.concepts.filter((c) => c.gap);
  return (
    <div className="summary-scroll">
      <section className="summary-v2">
        <p className="eyebrow">
          {session.captures.length} sources · updated{" "}
          {new Date(session.analyzedAt ?? session.updatedAt).toLocaleString()}
        </p>
        <h1>{session.title}</h1>
        {session.goal && session.goal !== session.title && (
          <p className="summary-goal">
            <b>Your question</b> {session.goal}
          </p>
        )}
        <p className="summary-lede">
          {a.summary ??
            a.overview?.summary ??
            "Go has not saved a summary for this map yet."}
        </p>
        <div className="summary-stats">
          {[
            [a.concepts.length, "ideas", () => onMap()],
            [mergeEdges(a.edges).length, "connections", () => onMap()],
            [shaky.length, "shaky ideas", () => onMap(undefined, true)],
            [gaps.length, "gaps", () => onMap(gaps[0]?.id)],
          ].map(([n, label, fn]) => (
            <button key={String(label)} onClick={fn as () => void}>
              <b>{String(n)}</b>
              <span>{String(label)}</span>
            </button>
          ))}
        </div>
        <h2>The main takeaways</h2>
        <ol className="summary-takes">
          {takeaways(a).map((t, i) => (
            <li key={i}>
              <span className="number">{i + 1}</span>
              <p>{t.text}</p>
              <Button onClick={() => onMap(t.concept)}>On the map</Button>
            </li>
          ))}
        </ol>
        <h2>A route through your research</h2>
        <div className="summary-route">
          {route.map((id, i) => (
            <button key={id} onClick={() => onMap(id)}>
              <b>{i + 1}</b>
              {a.concepts.find((c) => c.id === id)?.label ?? id}
            </button>
          ))}
        </div>
        <Button onClick={onWalk} disabled={!route.length}>
          Walk it on the map
        </Button>
        {gaps.length > 0 && (
          <>
            <h2 className="summary-gaps-heading">
              What your sources didn’t answer
            </h2>
            <ul className="summary-gaps">
              {gaps.map((c) => (
                <li key={c.id}>
                  <button className="text-button" onClick={() => onMap(c.id)}>
                    {c.label}
                  </button>
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
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="summary-next">
          <div>
            <b>
              {confident.length
                ? `${confident.length} confident ${confident.length === 1 ? "miss" : "misses"} to fix first`
                : shaky.length
                  ? `${shaky.length} ideas are getting shaky`
                  : "Keep these ideas bright"}
            </b>
            <span>A quick dig takes about 4 minutes</span>
          </div>
          <Button onClick={onPractice}>Start a quick dig</Button>
        </div>
        {onExport && (
          <div className="summary-export">
            <span>Take it with you</span>
            <Button quiet onClick={() => onExport("anki")}>
              Anki
            </Button>
            <Button quiet onClick={() => onExport("quizlet")}>
              Quizlet
            </Button>
            <Button quiet onClick={() => onExport("markdown")}>
              Markdown
            </Button>
          </div>
        )}
        {/invest|tax|dividend|portfolio/i.test(session.title) && (
          <p className="disclaimer">
            Not personalized investment or tax advice.
          </p>
        )}
      </section>
    </div>
  );
}
