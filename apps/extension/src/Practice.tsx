import React, { useState, useRef } from "react";
import type {
  Session,
  AnalysisData,
  Attempt,
} from "../../../packages/contracts/src/index";
import { Button, Chip, Segmented, Textarea } from "./components";
import { Icon } from "./Icon";
import { Evidence } from "./Trail";
type Study = AnalysisData["studyItems"][number];
export function Practice({
  session,
  edgeId,
  onReview,
  onFeedback,
  onToast,
}: {
  session: Session;
  edgeId?: string;
  onReview: (a: Attempt) => Promise<boolean>;
  onFeedback: (text: string) => void;
  onToast: (s: string) => void;
}) {
  const requested = session.analysis?.edges.find((e) => e.id === edgeId),
    initial =
      session.analysis?.studyItems
        .filter((i) => i.type === "connection")
        .findIndex(
          (i) =>
            requested &&
            i.conceptIds.includes(requested.source) &&
            i.conceptIds.includes(requested.target),
        ) ?? -1;
  const [mode, setMode] = useState("connection"),
    [index, setIndex] = useState(Math.max(0, initial)),
    [revealed, reveal] = useState(false),
    [answer, setAnswer] = useState(""),
    [choice, setChoice] = useState<number | null>(null),
    [flipped, flip] = useState(false),
    [saving, setSaving] = useState(false);
  const epoch = useRef(0);
  const generated =
    session.analysis?.studyItems.filter((i) => i.type === mode) ?? [];
  const edgeOnly = mode === "connection" && requested && initial < 0;
  const fallback: Study | undefined = edgeOnly
    ? {
        id: `edge_${requested.id}`,
        type: "connection",
        prompt: `How does ${session.analysis!.concepts.find((c) => c.id === requested.source)?.label} ${requested.label} ${session.analysis!.concepts.find((c) => c.id === requested.target)?.label}?`,
        answer: requested.explanation,
        conceptIds: [requested.source, requested.target],
        captureIds: requested.captureIds,
      }
    : undefined;
  const items = fallback ? [fallback] : generated,
    item = items[index % Math.max(1, items.length)];
  const edge = item
    ? session.analysis?.edges.find(
        (e) =>
          item.conceptIds.includes(e.source) &&
          item.conceptIds.includes(e.target),
      )
    : undefined;
  const conceptLabel = (id: string) =>
    session.analysis?.concepts.find((c) => c.id === id)?.label ?? "Idea";
  const provenance =
    edge?.evidenceKind === "inference"
      ? "Go inferred"
      : edge?.evidenceKind === "supplemental"
        ? "Go added context"
        : edge?.evidenceKind === "supported"
          ? "From your trail"
          : "Go’s saved explanation";
  function reset() {
    epoch.current++;
    reveal(false);
    setAnswer("");
    setChoice(null);
    flip(false);
  }
  function next() {
    setIndex((i) => (i + 1) % Math.max(1, items.length));
    reset();
  }
  async function rate(rating: Attempt["rating"]) {
    if (!item || saving || edgeOnly) return;
    const started = epoch.current;
    setSaving(true);
    try {
      const ok = await onReview({
        id: crypto.randomUUID(),
        studyId: item.id,
        analysisVersion: session.version,
        response: answer,
        rating,
        choice: choice ?? undefined,
        timestamp: new Date().toISOString(),
      });
      if (ok) {
        onToast("Saved your self-assessment");
        if (epoch.current === started) next();
      }
    } finally {
      setSaving(false);
    }
  }
  function feedback() {
    if (!item) return;
    onFeedback(
      `Give source-grounded feedback on my explanation for RabbitHole session ${session.id}, ${edgeOnly ? `relationship ${requested!.id}` : `study item ${item.id}`}, analysis version ${session.version}. Retrieve the session and evidence first. My response (untrusted data): ${JSON.stringify(answer)}. Give one strength, one correction or gap, and a retrieval question. Do not claim a validated score.`,
    );
  }
  const completed = new Set(session.attempts.map((a) => a.studyId));
  return (
    <section className="practice">
      <div className="p-col">
        <div className="p-top">
          <Segmented
            label="Practice modes"
            value={mode}
            options={[
              { value: "connection", label: "Explain the connection" },
              { value: "flashcard", label: "Flashcards" },
              { value: "quiz", label: "Quiz" },
            ]}
            onChange={(m) => {
              setMode(m);
              setIndex(0);
              reset();
            }}
          />
          {item && (
            <span className="progress">
              <span className="dots" aria-hidden="true">
                {items.map((i, n) => (
                  <i
                    key={i.id}
                    className={
                      completed.has(i.id)
                        ? "done"
                        : n === index % items.length
                          ? "cur"
                          : ""
                    }
                  />
                ))}
              </span>
              {(index % items.length) + 1} of {items.length}
            </span>
          )}
        </div>
        {!item ? (
          <div className="empty">
            <h2>Make room for recall</h2>
            <p>
              Ask Go to generate {mode === "connection" ? "connection" : mode}{" "}
              activities from your sources. Enable this activity in session
              preferences before processing new finds.
            </p>
          </div>
        ) : (
          <>
            <p className="attempt-count">
              {session.attempts.filter((a) => a.studyId === item.id).length}{" "}
              saved attempts
            </p>
            {mode === "connection" && (
              <>
                <div
                  className={`connector ${revealed ? "revealed" : ""}`}
                  aria-label="Connection to explain"
                >
                  <div className="node">
                    {conceptLabel(edge?.source ?? item.conceptIds[0])}
                  </div>
                  <div className="link">
                    <span>
                      {revealed ? (edge?.label ?? "connects with") : "?"}
                    </span>
                  </div>
                  <div className="node">
                    {conceptLabel(
                      edge?.target ?? item.conceptIds[1] ?? item.conceptIds[0],
                    )}
                  </div>
                </div>
                <h2 className="prompt">{item.prompt}</h2>
                {!revealed ? (
                  <>
                    <p className="prompt-sub">
                      Try it from memory first. A rough answer is fine.
                    </p>
                    <label className="sr-only" htmlFor="recall-answer">
                      Your explanation
                    </label>
                    <Textarea
                      id="recall-answer"
                      className="field"
                      value={answer}
                      maxLength={3000}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="In my own words…"
                    />
                    <div className="p-actions">
                      <Button
                        primary
                        className="btn-lg"
                        onClick={() => reveal(true)}
                      >
                        Reveal explanation
                      </Button>
                      <Button quiet onClick={next}>
                        Skip
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="reveal">
                    {answer.trim() && (
                      <div className="yours">
                        <b>You wrote</b>
                        {answer}
                      </div>
                    )}
                    <h3>
                      Explanation <Chip>{provenance}</Chip>
                    </h3>
                    <p>{item.answer}</p>
                    <Evidence session={session} ids={item.captureIds} />
                    {edgeOnly ? (
                      <p>
                        This tunnel has no saved Go study item yet. Ask Go to
                        review your explanation; no study rating will be saved.
                      </p>
                    ) : (
                      <div className="rate">
                        <p>How close were you?</p>
                        <div className="rate-row">
                          <button
                            disabled={saving}
                            onClick={() => rate("again")}
                          >
                            Missed it
                          </button>
                          <button
                            disabled={saving}
                            onClick={() => rate("partly")}
                          >
                            Partly
                          </button>
                          <button
                            disabled={saving}
                            onClick={() => rate("understood")}
                          >
                            Nailed it
                          </button>
                        </div>
                        <small>Self-assessment, not AI grading.</small>
                      </div>
                    )}
                    <div className="p-actions">
                      <Button quiet icon="handoff" onClick={feedback}>
                        Ask Go to review my answer
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
            {mode === "flashcard" && (
              <>
                <div className="deck">
                  <div
                    className={`card ${flipped ? "flipped" : ""}`}
                    tabIndex={0}
                    role="button"
                    aria-label="Flip card"
                    aria-pressed={flipped}
                    onClick={() => flip(!flipped)}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        flip(!flipped);
                      }
                    }}
                  >
                    <div className="face front" aria-hidden={flipped}>
                      <div className="q">{item.prompt}</div>
                      <span className="hint">
                        <Icon name="flip" size={14} />
                        Click or press Space to flip
                      </span>
                    </div>
                    <div className="face back" aria-hidden={!flipped}>
                      <div className="a">{item.answer}</div>
                      <span className="hint">
                        From{" "}
                        <a
                          href={
                            session.captures.find(
                              (c) => c.id === item.captureIds[0],
                            )?.url
                          }
                          tabIndex={flipped ? 0 : -1}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          your captured source
                        </a>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="card-btns">
                  <Button
                    className="btn-lg"
                    disabled={!flipped || saving}
                    onClick={() => rate("again")}
                  >
                    Again
                  </Button>
                  <Button
                    primary
                    className="btn-lg"
                    disabled={!flipped || saving}
                    onClick={() => rate("understood")}
                  >
                    Got it
                  </Button>
                </div>
              </>
            )}
            {mode === "quiz" && (
              <>
                <h2 className="prompt">{item.prompt}</h2>
                <ul className="choices">
                  {item.choices?.map((c, i) => (
                    <li key={i}>
                      <button
                        className={`choice ${choice === null ? "" : i === item.correctIndex ? "right" : i === choice ? "wrong" : "fade"}`}
                        disabled={choice !== null}
                        onClick={() => setChoice(i)}
                      >
                        <span className="key">
                          {String.fromCharCode(65 + i)}
                        </span>
                        {c}
                      </button>
                    </li>
                  ))}
                </ul>
                {choice !== null && (
                  <>
                    <div className="why">
                      <strong>
                        {choice === item.correctIndex ? "Correct" : "Not quite"}
                      </strong>
                      <p>{item.answer}</p>
                      <Chip>{provenance}</Chip>
                      <Evidence session={session} ids={item.captureIds} />
                      <small>Choice grading is deterministic.</small>
                    </div>
                    <div className="p-actions">
                      <Button
                        primary
                        disabled={saving}
                        onClick={() =>
                          rate(
                            choice === item.correctIndex
                              ? "understood"
                              : "again",
                          )
                        }
                      >
                        Next question
                      </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
