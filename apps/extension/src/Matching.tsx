import React, { useState, useRef, useLayoutEffect, useEffect } from "react";
import type { StudyItem } from "./practice-model";
export function Matching({
  item,
  onComplete,
  onProgress,
}: {
  item: StudyItem;
  onComplete: (slips: number, missedConcepts: string[]) => void;
  onProgress?: (dirty: boolean) => void;
}) {
  const pairs = item.pairs!,
    [left, setLeft] = useState<number | null>(null),
    [right, setRight] = useState<number | null>(null),
    [locked, setLocked] = useState<number[]>([]),
    [bad, setBad] = useState<[number, number] | null>(null),
    [paths, setPaths] = useState<{ d: string; bad: boolean }[]>([]);
  const slips = useRef(0),
    missed = useRef(new Set<string>()),
    board = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!bad) return;
    const timer = setTimeout(() => setBad(null), 600);
    return () => clearTimeout(timer);
  }, [bad]);
  useLayoutEffect(() => {
    const draw = () => {
      const el = board.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const point = (side: string, i: number) => {
        const r = el
          .querySelector(`[data-${side}="${i}"] .socket`)!
          .getBoundingClientRect();
        return [
          r.left + r.width / 2 - rect.left,
          r.top + r.height / 2 - rect.top,
        ];
      };
      const curve = (l: number, r: number) => {
        const [x, y] = point("left", l),
          [xx, yy] = point("right", r);
        return `M${x},${y} C${x + 40},${y} ${xx - 40},${yy} ${xx},${yy}`;
      };
      setPaths([
        ...locked.map((i) => ({ d: curve(i, i), bad: false })),
        ...(bad ? [{ d: curve(bad[0], bad[1]), bad: true }] : []),
      ]);
    };
    draw();
    const observer = new ResizeObserver(draw);
    if (board.current) observer.observe(board.current);
    return () => observer.disconnect();
  }, [locked, bad]);
  function pick(side: "left" | "right", i: number) {
    if (locked.includes(i)) return;
    onProgress?.(true);
    const l = side === "left" ? i : left,
      r = side === "right" ? i : right;
    setLeft(l);
    setRight(r);
    if (l === null || r === null) return;
    if (l === r) {
      const next = [...locked, l];
      setLocked(next);
      requestAnimationFrame(() =>
        board.current
          ?.querySelector<HTMLButtonElement>("[data-left]:not(:disabled)")
          ?.focus(),
      );
      if (next.length === pairs.length)
        onComplete(slips.current, [...missed.current]);
    } else {
      slips.current++;
      for (const n of [l, r]) {
        const id = pairs[n].concept;
        if (id) missed.current.add(id);
      }
      setBad([l, r]);
    }
    setLeft(null);
    setRight(null);
  }
  return (
    <>
      <h2 className="run-prompt">{item.prompt}</h2>
      <p className="q-sub">Pick one on each side. Correct pairs lock in.</p>
      <div className="match-v2" ref={board}>
        <svg aria-hidden="true">
          {paths.map((p, i) => (
            <path key={i + p.d} d={p.d} className={p.bad ? "bad" : "ok"} />
          ))}
        </svg>
        <div>
          <h3>Idea</h3>
          {pairs.map((p, i) => (
            <button
              key={i}
              data-left={i}
              className={`match-tile-v2 ${locked.includes(i) ? "locked" : ""} ${left === i ? "armed" : ""} ${bad?.[0] === i ? "miss" : ""}`}
              disabled={locked.includes(i)}
              aria-pressed={left === i}
              onClick={() => pick("left", i)}
            >
              <span>{p.left}</span>
              <i className="socket" />
            </button>
          ))}
        </div>
        <div>
          <h3>What it means</h3>
          {pairs
            .map((_, i) => pairs.length - 1 - i)
            .map((i) => (
              <button
                key={i}
                data-right={i}
                className={`match-tile-v2 ${locked.includes(i) ? "locked" : ""} ${right === i ? "armed" : ""} ${bad?.[1] === i ? "miss" : ""}`}
                disabled={locked.includes(i)}
                aria-pressed={right === i}
                onClick={() => pick("right", i)}
              >
                <i className="socket" />
                <span>{pairs[i].right}</span>
              </button>
            ))}
        </div>
      </div>
      <span className="sr-only" role="status">
        {locked.length} pairs locked. {slips.current} slips.
      </span>
    </>
  );
}
