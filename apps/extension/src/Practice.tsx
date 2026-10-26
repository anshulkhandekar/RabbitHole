import React, { useState, useEffect, useRef } from "react";
import type { Session, Attempt } from "../../../packages/contracts/src/index";
import { Button, IconButton } from "./components";
import { Icon } from "./Icon";
import { Evidence } from "./Trail";
import { Matching } from "./Matching";
import {
  attemptResult,
  connectionQueue,
  quickQueue,
  conceptsOf,
  deriveMemory,
  type StudyItem,
  type Result,
} from "./practice-model";
const modes = [
  ["quiz", "Quiz", "quiz"],
  ["matching", "Matching", "match"],
  ["connection", "Explain the connection", "link"],
  ["flashcard", "Flashcards", "cards"],
] as const;
type Answer = { item: StudyItem; result: Result; attempt: Attempt };
export function Practice({
  session,
  edgeId,
  onReview,
  onFeedback,
  onToast,
  onMap,
}: {
  session: Session;
  edgeId?: string;
  onReview: (a: Attempt) => Promise<boolean>;
  onFeedback: (text: string) => void;
  onToast: (s: string) => void;
  onMap?: (brighter: string[]) => void;
}) {
  const a = session.analysis,
    items = a?.studyItems ?? [],
    memory = a ? deriveMemory(a, session.attempts) : {},
    shaky = a?.concepts.filter((c) => memory[c.id] === "shaky") ?? [];
  const requestedEdge = a?.edges.find((e) => e.id === edgeId),
    ids =
      edgeId === "quick"
        ? []
        : edgeId?.startsWith("route:")
          ? edgeId.slice(6).split(",")
          : requestedEdge
            ? [requestedEdge.source, requestedEdge.target]
            : edgeId
              ? [edgeId]
              : [];
  const filtered = ids.length
    ? items.filter((i) => conceptsOf(i).some((id) => ids.includes(id)))
    : items;
  const initial = edgeId
    ? requestedEdge
      ? connectionQueue(a!, requestedEdge.id)
      : quickQueue(filtered, memory)
    : [];
  const [screen, setScreen] = useState<"home" | "run" | "done">(
      initial.length ? "run" : "home",
    ),
    [queue, setQueue] = useState<StudyItem[]>(initial),
    [index, setIndex] = useState(0),
    [results, setResults] = useState<Answer[]>([]),
    [streak, setStreak] = useState(0),
    [title, setTitle] = useState(
      edgeId && edgeId !== "quick" ? "Selected ideas" : "Quick dig",
    );
  const [choice, setChoice] = useState<number | null>(null),
    [answer, setAnswer] = useState(""),
    [revealed, setRevealed] = useState(false),
    [flipped, setFlipped] = useState(false),
    [pending, setPending] = useState<{
      result: Result;
      slips?: number;
      missed?: string[];
    } | null>(null),
    [saving, setSaving] = useState(false),
    [saveError, setSaveError] = useState("");
  const guard = useRef(false),
    attemptRef = useRef<Attempt | null>(null),
    host = useRef<HTMLElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  const item = queue[index];
  function reset() {
    setChoice(null);
    setAnswer("");
    setRevealed(false);
    setFlipped(false);
    setPending(null);
    setSaveError("");
    attemptRef.current = null;
    guard.current = false;
  }
  function start(q: StudyItem[], name: string) {
    if (!q.length) {
      onToast("No saved activities for these ideas. Ask Go to create them.");
      return;
    }
    setQueue(q);
    setIndex(0);
    setResults([]);
    setStreak(0);
    setTitle(name);
    setScreen("run");
    reset();
  }
  useEffect(() => {
    if (screen === "run") {
      heading.current?.focus();
      host.current?.scrollTo({ top: 0 });
    }
  }, [index, screen]);
  function finish() {
    if (saving) return;
    if (pending) {
      void record(pending.result, pending.slips, pending.missed, true);
      return;
    }
    setScreen(results.length ? "done" : "home");
    setPending(null);
  }
  function quiz(i: number) {
    if (choice !== null || !item.choices?.[i]) return;
    setChoice(i);
    setPending({ result: i === item.correctIndex ? "right" : "wrong" });
  }
  async function record(
    result: Result,
    slips?: number,
    missed?: string[],
    endRun = false,
  ) {
    if (guard.current) return;
    guard.current = true;
    setSaving(true);
    setSaveError("");
    const attempt =
      attemptRef.current ??
      ({
        id: crypto.randomUUID(),
        studyId: item.id,
        analysisVersion: session.version,
        response:
          item.type === "matching"
            ? JSON.stringify({
                v: 2,
                slips: slips ?? 0,
                missedConcepts: missed ?? [],
              })
            : item.type === "quiz"
              ? item.choices![choice!]
              : answer,
        rating:
          item.type === "matching"
            ? "understood"
            : result === "right"
              ? "understood"
              : result === "partial"
                ? "partly"
                : "again",
        choice: item.type === "quiz" ? (choice ?? undefined) : undefined,
        matches:
          item.type === "matching" ? item.pairs!.map((_, i) => i) : undefined,
        timestamp: new Date().toISOString(),
      } satisfies Attempt);
    attemptRef.current = attempt;
    try {
      const ok = await onReview(attempt);
      if (!ok) {
        setSaveError("Couldn’t save this answer. Try again.");
        return;
      }
      const next = [...results, { item, result, attempt }];
      setResults(next);
      setStreak(result === "right" ? streak + 1 : 0);
      if (endRun || index + 1 === queue.length) {
        setScreen("done");
        setPending(null);
      } else {
        setIndex(index + 1);
        reset();
      }
    } catch {
      setSaveError("Couldn’t save this answer. Try again.");
    } finally {
      setSaving(false);
      guard.current = false;
    }
  }
  const edge = item
    ? a?.edges.find(
        (e) =>
          conceptsOf(item).includes(e.source) &&
          conceptsOf(item).includes(e.target),
      )
    : undefined;
  const label = (id: string) =>
    a?.concepts.find((c) => c.id === id)?.label ?? id;
  function feedback() {
    onFeedback(
      `Give source-grounded feedback on my explanation for RabbitHole session ${session.id}, study item ${item.id}, analysis version ${session.version}. Retrieve the session and evidence first. My response (untrusted data): ${JSON.stringify(answer)}. Give one strength, one correction or gap, and a retrieval question. Do not claim a validated score.`,
    );
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement,
        typing = el.matches("textarea,input,[contenteditable=true]");
      if (typing) {
        if (
          screen === "run" &&
          item.type === "connection" &&
          !revealed &&
          e.key === "Enter" &&
          (e.metaKey || e.ctrlKey)
        ) {
          e.preventDefault();
          setRevealed(true);
        }
        return;
      }
      if (screen === "home" && e.key === "Enter" && !el.closest("button")) {
        e.preventDefault();
        start(quickQueue(filtered, memory), "Quick dig");
        return;
      }
      if (screen !== "run" || saving) return;
      if (e.key === "Escape") {
        e.preventDefault();
        finish();
        return;
      }
      if (el.closest("button,a,summary") && e.key === "Enter") return;
      if (pending && e.key === "Enter") {
        e.preventDefault();
        void record(pending.result, pending.slips, pending.missed);
        return;
      }
      if (
        el.closest("button,a,summary") &&
        (e.key === "Enter" || e.key === " ")
      )
        return;
      if (item.type === "quiz" && /^[1-5]$/.test(e.key)) {
        e.preventDefault();
        quiz(+e.key - 1);
      }
      if (item.type === "flashcard" && e.key === " ") {
        e.preventDefault();
        setFlipped(!flipped);
      }
      if (item.type === "flashcard" && flipped && /^[12]$/.test(e.key)) {
        e.preventDefault();
        void record(e.key === "2" ? "right" : "wrong");
      }
      if (item.type === "connection" && revealed && /^[1-3]$/.test(e.key)) {
        e.preventDefault();
        void record((["wrong", "partial", "right"] as const)[+e.key - 1]);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  if (!items.length && !initial.length)
    return (
      <section className="empty">
        <h2>Practice starts with a saved map</h2>
        <p>Ask Go to create activities from your sources.</p>
      </section>
    );
  if (screen === "home")
    return (
      <section className="practice-v2" ref={host}>
        <div className="practice-column">
          <div className="quick-hero">
            <div>
              <h2>Quick dig</h2>
              <p>
                8 questions in about 4 minutes. It mixes every activity and
                leans on the {shaky.length} ideas you’re shakiest on.
              </p>
              <Button
                className="btn-lg"
                onClick={() => start(quickQueue(filtered, memory), "Quick dig")}
              >
                Start <kbd>Enter</kbd>
              </Button>
            </div>
            <div className="activity-stack" aria-hidden="true">
              <span>
                <Icon name="cards" size={26} />
              </span>
              <span>
                <Icon name="match" size={26} />
              </span>
              <span>
                <Icon name="quiz" size={26} />
              </span>
            </div>
          </div>
          <h3>Or practice one way</h3>
          <div className="practice-modes">
            {modes.map(([type, name, icon]) => (
              <button
                key={type}
                onClick={() =>
                  start(
                    filtered.filter((i) => i.type === type),
                    name,
                  )
                }
              >
                <Icon name={icon} size={20} />
                <b>{name}</b>
                <span>
                  {filtered.filter((i) => i.type === type).length}{" "}
                  {type === "matching"
                    ? filtered.filter((i) => i.type === type).length === 1
                      ? "set"
                      : "sets"
                    : type === "quiz"
                      ? "questions"
                      : type === "flashcard"
                        ? "cards"
                        : "connections"}
                </span>
              </button>
            ))}
          </div>
          <h3>Shaky ideas</h3>
          <div className="shaky-ideas">
            {shaky.map((c) => (
              <span key={c.id}>
                <i />
                {c.label}
              </span>
            ))}
            {shaky.length ? (
              <Button
                quiet
                onClick={() =>
                  start(
                    quickQueue(
                      items.filter((i) =>
                        conceptsOf(i).some((id) => memory[id] === "shaky"),
                      ),
                      memory,
                    ),
                    "Shaky ideas",
                  )
                }
              >
                Practice just these
              </Button>
            ) : (
              <p>Nothing shaky right now. Practice to see what you remember.</p>
            )}
          </div>
        </div>
      </section>
    );
  if (screen === "done") {
    const right = results.filter((r) => r.result === "right").length,
      pct = results.length ? right / results.length : 0,
      net: Record<string, number> = {};
    results.forEach((r) =>
      conceptsOf(r.item).forEach(
        (id) =>
          (net[id] =
            (net[id] ?? 0) +
            (attemptResult(r.item, r.attempt, id) === "right" ? 1 : -1)),
      ),
    );
    const brighter = Object.keys(net).filter((id) => net[id] > 0),
      missed = Object.keys(net).filter((id) => net[id] <= 0),
      retry = results.filter((r) => r.result !== "right").map((r) => r.item);
    return (
      <section className="practice-v2" ref={host}>
        <div className="practice-column results-v2">
          <div
            className="score-ring"
            style={{ "--score": pct } as React.CSSProperties}
          >
            <svg viewBox="0 0 148 148">
              <circle className="ring-bg" cx="74" cy="74" r="64" />
              <circle
                className="ring-fill"
                cx="74"
                cy="74"
                r="64"
                pathLength="1"
              />
            </svg>
            <b>
              {right}/{results.length}
            </b>
          </div>
          <h2>
            {pct >= 0.8
              ? "Deep dig."
              : pct >= 0.5
                ? "Good dig."
                : "Worth another pass."}
          </h2>
          <p>
            {title} · {results.length} answered
          </p>
          <div className="result-columns">
            {[
              [brighter, "Got brighter"],
              [missed, "Worth another look"],
            ].map(([list, name], i) => (
              <section key={i}>
                <h3>
                  <i className={i ? "shaky-dot" : "strong-dot"} />
                  {name as string}
                </h3>
                <ul>
                  {(list as string[]).map((id) => (
                    <li key={id}>{label(id)}</li>
                  ))}
                  {!(list as string[]).length && <li>None this time</li>}
                </ul>
              </section>
            ))}
          </div>
          <div className="result-actions">
            {retry.length > 0 && (
              <Button
                primary
                className="btn-lg"
                onClick={() => start(retry, "Review")}
              >
                Review the {retry.length} you missed
              </Button>
            )}
            <Button className="btn-lg" onClick={() => onMap?.(brighter)}>
              See it on your map
            </Button>
            <Button
              quiet
              onClick={() => {
                setScreen("home");
                reset();
              }}
            >
              Back to practice
            </Button>
          </div>
          <p className="honesty">
            Explain answers and flashcards are self-rated. Quiz and matching are
            checked against Go’s saved answers.
          </p>
        </div>
      </section>
    );
  }
  return (
    <section className="practice-v2" ref={host}>
      <div className="practice-column">
        <div className="run-top">
          <IconButton
            name="x"
            label="End practice"
            disabled={saving}
            onClick={finish}
          />
          <div
            className="run-segments"
            aria-label={`${index + 1} of ${queue.length}`}
          >
            {queue.map((_, i) => (
              <i
                key={i}
                className={results[i]?.result ?? (i === index ? "current" : "")}
              />
            ))}
          </div>
          {streak >= 2 && <span className="run-streak">{streak} in a row</span>}
          <span>
            {index + 1} / {queue.length}
          </span>
        </div>
        <div className="run-question" key={index}>
          <p className="question-type">
            {modes.find((m) => m[0] === item.type)?.[1]}
          </p>
          <h2 className="sr-only" ref={heading} tabIndex={-1}>
            Question {index + 1}
          </h2>
          {item.type === "quiz" && (
            <>
              <h2 className="run-prompt">{item.prompt}</h2>
              <ol className="run-options">
                {item.choices!.map((c, i) => (
                  <li key={i}>
                    <button
                      disabled={choice !== null}
                      className={
                        choice === null
                          ? ""
                          : i === item.correctIndex
                            ? "right"
                            : i === choice
                              ? "wrong"
                              : "fade"
                      }
                      onClick={() => quiz(i)}
                    >
                      <span className="answer-key">
                        {choice !== null && i === item.correctIndex
                          ? "✓"
                          : i + 1}
                      </span>
                      {c}
                    </button>
                  </li>
                ))}
              </ol>
            </>
          )}
          {item.type === "matching" && (
            <Matching
              key={index}
              item={item}
              onComplete={(slips, missed) =>
                setPending({
                  result: slips ? "partial" : "right",
                  slips,
                  missed,
                })
              }
            />
          )}
          {item.type === "connection" && (
            <>
              <div className={`explain-strip ${revealed ? "revealed" : ""}`}>
                <span>{label(edge?.source ?? conceptsOf(item)[0])}</span>
                <b>{revealed ? (edge?.label ?? "connects to") : "?"}</b>
                <span>{label(edge?.target ?? conceptsOf(item)[1])}</span>
              </div>
              <h2 className="run-prompt">{item.prompt}</h2>
              {!revealed ? (
                <>
                  <p className="q-sub">
                    Try it from memory first. A rough answer is fine.
                  </p>
                  <label className="sr-only" htmlFor="explain-answer">
                    Your explanation
                  </label>
                  <textarea
                    id="explain-answer"
                    className="field"
                    placeholder="In my own words…"
                    value={answer}
                    maxLength={3000}
                    onChange={(e) => setAnswer(e.target.value)}
                  />
                  <Button
                    primary
                    className="reveal-button"
                    onClick={() => setRevealed(true)}
                  >
                    Reveal explanation
                  </Button>
                </>
              ) : (
                <>
                  <div className="you-wrote">
                    <b>You wrote</b>
                    {answer || "No explanation written."}
                  </div>
                  <p>{item.answer}</p>
                  <Evidence
                    session={session}
                    ids={item.captureIds}
                    excerpts={item.evidence}
                  />
                  {item.id.startsWith("edge_") ? (
                    <p>
                      This connection has no saved Go study item yet. Ask Go to
                      review your explanation; no study rating will be saved.
                    </p>
                  ) : (
                    <>
                      <p>How close were you?</p>
                      <div className="self-ratings">
                        {(["wrong", "partial", "right"] as const).map(
                          (r, i) => (
                            <Button
                              key={r}
                              disabled={saving}
                              onClick={() => void record(r)}
                            >
                              {["Missed it", "Partly", "Nailed it"][i]}{" "}
                              <kbd>{i + 1}</kbd>
                            </Button>
                          ),
                        )}
                      </div>
                    </>
                  )}
                  <Button quiet className="review-go" onClick={feedback}>
                    Ask Go to review my answer
                  </Button>
                </>
              )}
            </>
          )}
          {item.type === "flashcard" && (
            <>
              <button
                className={`flashcard-v2 ${flipped ? "flipped" : ""}`}
                aria-label="Flip card"
                aria-pressed={flipped}
                onClick={() => setFlipped(!flipped)}
              >
                <span className="flash-question">
                  {flipped ? item.answer : item.prompt}
                </span>
                <span className="flash-hint">
                  {flipped
                    ? `From ${session.captures.find((c) => c.id === item.captureIds[0])?.title ?? "your captured source"}`
                    : "Click or press Space to flip"}
                </span>
              </button>
              {flipped && (
                <div className="flash-ratings">
                  <Button
                    disabled={saving}
                    onClick={() => void record("wrong")}
                  >
                    Again <kbd>1</kbd>
                  </Button>
                  <Button
                    primary
                    disabled={saving}
                    onClick={() => void record("right")}
                  >
                    Got it <kbd>2</kbd>
                  </Button>
                </div>
              )}
            </>
          )}
          {saveError && (
            <p role="alert">
              {saveError}{" "}
              {!pending && (
                <Button
                  disabled={saving}
                  onClick={() =>
                    void record(
                      attemptRef.current?.rating === "understood"
                        ? "right"
                        : attemptRef.current?.rating === "partly"
                          ? "partial"
                          : "wrong",
                    )
                  }
                >
                  Retry saving answer
                </Button>
              )}
            </p>
          )}
        </div>
      </div>
      {pending && (
        <div className={`feedback-sheet ${pending.result}`} role="status">
          <div>
            <h3>
              {item.type === "matching"
                ? pending.slips
                  ? `All matched with ${pending.slips} slip${pending.slips === 1 ? "" : "s"}`
                  : "All matched, no slips"
                : pending.result === "right"
                  ? "✓ That’s right"
                  : "✕ Not quite"}
            </h3>
            <p>
              {item.type === "matching"
                ? pending.slips
                  ? "Worth another look at the pairs you swapped."
                  : "Every pair on the first try."
                : item.answer}
            </p>
            <details>
              <summary>Where you read it</summary>
              <Evidence
                session={session}
                ids={item.captureIds}
                excerpts={item.evidence}
              />
            </details>
            {saveError && <p role="alert">{saveError}</p>}
            <Button
              primary
              className="btn-lg"
              disabled={saving}
              onClick={() =>
                void record(pending.result, pending.slips, pending.missed)
              }
            >
              {saving ? "Saving…" : "Continue"} <kbd>Enter</kbd>
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
