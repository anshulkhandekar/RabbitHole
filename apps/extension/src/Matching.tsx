import React, { useState, useEffect, useRef } from "react";
import type {
  AnalysisData,
  Attempt,
  Session,
} from "../../../packages/contracts/src/index";
import { Button, Chip } from "./components";
import { Evidence } from "./Trail";
type Item = AnalysisData["studyItems"][number];
export function Matching({
  item,
  session,
  onReview,
  onToast,
}: {
  item: Item;
  session: Session;
  onReview: (a: Attempt) => Promise<boolean>;
  onToast: (s: string) => void;
}) {
  const pairs = item.pairs!,
    order = pairs.map((_, i) => i).reverse();
  const [active, setActive] = useState<number | null>(null),
    [matches, setMatches] = useState<(number | null)[]>(pairs.map(() => null)),
    [checked, setChecked] = useState(false),
    [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const correct = matches.filter((m, i) => m === i).length,
    complete = matches.every((m) => m !== null);
  async function check() {
    if (!complete || saving) return;
    setChecked(true);
    setSaving(true);
    try {
      const ok = await onReview({
        id: crypto.randomUUID(),
        studyId: item.id,
        analysisVersion: session.version,
        response: "Matched ideas to meanings",
        matches: matches as number[],
        rating: correct === pairs.length ? "understood" : "again",
        timestamp: new Date().toISOString(),
      });
      if (ok && alive.current) {
        setSaved(true);
        onToast("Matching result recorded");
      }
    } finally {
      if (alive.current) setSaving(false);
    }
  }
  return (
    <section className="matching">
      <h2 className="prompt">{item.prompt}</h2>
      <p className="prompt-sub">
        Choose an idea, then its meaning. You can change pairs before checking.
      </p>
      <div className="match-board">
        <div>
          <h3>Ideas</h3>
          {pairs.map((pair, i) => (
            <button
              key={i}
              className={`match-tile ${active === i ? "selected" : ""} ${checked ? (matches[i] === i ? "right" : "wrong") : ""}`}
              aria-label={`Idea: ${pair.left}`}
              aria-pressed={active === i}
              disabled={checked}
              onClick={() => {
                setActive(i);
                setMatches((m) => m.map((v, j) => (j === i ? null : v)));
              }}
            >
              <span>{pair.left}</span>
              {matches[i] !== null && <small>{pairs[matches[i]!].right}</small>}
            </button>
          ))}
        </div>
        <div>
          <h3>Meanings</h3>
          {order.map((i) => (
            <button
              key={i}
              className="match-tile"
              aria-label={`Meaning: ${pairs[i].right}`}
              disabled={checked || active === null || matches.includes(i)}
              onClick={() => {
                if (active === null) return;
                setMatches((m) => m.map((v, j) => (j === active ? i : v)));
                setActive(null);
              }}
            >
              {pairs[i].right}
            </button>
          ))}
        </div>
      </div>
      {!checked ? (
        <Button primary disabled={!complete} onClick={() => void check()}>
          Check matches
        </Button>
      ) : (
        <div className="why" role="status">
          <strong>
            {correct} of {pairs.length} matched correctly
          </strong>
          <p>{item.answer}</p>
          <dl className="match-solutions">
            {pairs.map((pair) => (
              <div key={pair.left}>
                <dt>{pair.left}</dt>
                <dd>{pair.right}</dd>
              </div>
            ))}
          </dl>
          <Chip>Checked against Go’s saved pairs</Chip>
          <Evidence
            session={session}
            ids={item.captureIds}
            excerpts={item.evidence}
          />
          {saved ? (
            <p>Matching result recorded</p>
          ) : (
            <Button disabled={saving} onClick={() => void check()}>
              {saving ? "Saving result…" : "Retry saving result"}
            </Button>
          )}
          <Button
            onClick={() => {
              setMatches(pairs.map(() => null));
              setChecked(false);
              setSaved(false);
              setActive(null);
            }}
            disabled={saving}
          >
            Try these pairs again
          </Button>
        </div>
      )}
    </section>
  );
}
