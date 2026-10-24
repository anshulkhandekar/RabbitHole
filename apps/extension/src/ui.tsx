import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  Position,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./ui.css";
import type {
  Session,
  AnalysisData,
} from "../../../packages/contracts/src/index";
const request = (type: string, extra: any = {}) =>
  chrome.runtime.sendMessage({ type, ...extra });
const time = (s: string) =>
  new Date(s).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
function App() {
  const [state, setState] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [view, setView] = useState(innerWidth < 760 ? "sources" : "explore"),
    [settings, setSettings] = useState(
      new URLSearchParams(location.search).has("settings"),
    ),
    [selected, setSelected] = useState<{ kind: string; id: string } | null>(
      null,
    ),
    [list, setList] = useState(false),
    [prompt, setPrompt] = useState(""),
    [config, setConfig] = useState<any>(null),
    [rename, setRename] = useState("");
  const action = async (type: string, extra: any = {}) => {
    setBusy(true);
    setError("");
    try {
      const value = await request(type, extra);
      if (value?.error && !value.sessions) throw new Error(value.error);
      setState(value);
      return value;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete action");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void action("state");
    const fn = (changes: any) => {
      if (changes.state) setState(changes.state.newValue);
    };
    chrome.storage.onChanged.addListener(fn);
    return () => chrome.storage.onChanged.removeListener(fn);
  }, []);
  useEffect(() => {
    if (state && !config) setConfig(state.config);
  }, [state]);
  const session: Session | undefined = state?.sessions[state.active];
  const analysis = session?.analysis;
  const patch = (value: any) =>
    action("patch", { id: session!.id, patch: value });
  async function grant() {
    return chrome.permissions.request({
      origins: ["http://*/*", "https://*/*"],
    });
  }
  async function start() {
    if (await grant()) await action("start");
    else
      setError("Browsing access is required for an enabled research session.");
  }
  function handoff(text?: string) {
    if (!session) return;
    const textPrompt =
      text ??
      `Process RabbitHole session ${session.id}. Retrieve the pending captures and existing analysis using RabbitHole tools, merge evidence-linked concepts and selected activities, and save the complete analysis. Report the saved version and remaining pending captures.`;
    setPrompt(textPrompt);
    void navigator.clipboard.writeText(textPrompt).catch(() => {});
    void chrome.tabs.create({ url: state.config.agentUrl });
  }
  const exported = () => {
    const blob = new Blob([JSON.stringify(session, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `rabbithole-${session!.id}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const pending = session
    ? session.captures.filter((c) => !session.processed.includes(c.id)).length
    : 0;
  const nodes: Node[] =
    analysis?.concepts.map((c, i) => ({
      id: c.id,
      position: { x: (i % 3) * 290, y: Math.floor(i / 3) * 160 },
      data: { label: c.label },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      type: "default",
      selected: selected?.id === c.id,
      style: { width: 230 },
    })) ?? [];
  const edges: Edge[] =
    analysis?.edges.map((e) => ({
      ...e,
      type: "smoothstep",
      label: e.label,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: {
        stroke: e.evidenceKind === "supported" ? "#8071b9" : "#ad9d85",
        strokeDasharray: e.evidenceKind === "supported" ? undefined : "5 5",
      },
    })) ?? [];
  const concept = analysis?.concepts.find(
      (c) => selected?.kind === "concept" && c.id === selected.id,
    ),
    edge = analysis?.edges.find(
      (e) => selected?.kind === "edge" && e.id === selected.id,
    );
  if (!state || !config)
    return <main className="loading">Opening your trail…</main>;
  return (
    <div className="app">
      <header>
        <a className="brand" href="#" onClick={() => setSettings(false)}>
          <span className="mark" aria-hidden="true">
            <svg viewBox="0 0 36 40" width="28" height="32" fill="none">
              <path
                d="M12 23C3 4 12-2 16 19M20 20C19 0 30 2 25 23"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M8 28c0-9 20-9 20 0 0 6-5 8-10 8S8 34 8 28Z"
                stroke="currentColor"
                strokeWidth="2.5"
              />
              <circle cx="13.5" cy="27" r="1" fill="currentColor" />
              <circle cx="22.5" cy="27" r="1" fill="currentColor" />
              <path
                d="m16 31 2 1 2-1"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </span>{" "}
          RabbitHole<span className="wordmark-note">make connections</span>
        </a>
        <div className="header-actions">
          <button
            onClick={() =>
              chrome.tabs.create({ url: chrome.runtime.getURL("index.html") })
            }
            title="Open full workspace"
          >
            ↗ <span>Expand</span>
          </button>
          <button onClick={() => setSettings(!settings)} aria-label="Settings">
            ⚙
          </button>
        </div>
      </header>
      <div className="layout">
        <aside className="sessions">
          <div className="eyebrow">YOUR RESEARCH</div>
          <button className="primary new" onClick={start} disabled={busy}>
            ＋ New rabbit hole
          </button>
          <nav aria-label="Saved sessions">
            {Object.values(state.sessions as Record<string, Session>)
              .reverse()
              .map((s) => (
                <button
                  key={s.id}
                  className={
                    "session-link " + (s.id === session?.id ? "chosen" : "")
                  }
                  onClick={() => {
                    setSelected(null);
                    setPrompt("");
                    void action("select", { id: s.id });
                  }}
                >
                  <span>{s.title}</span>
                  <small>
                    {s.captures.length} sources · {s.status}
                  </small>
                </button>
              ))}
          </nav>
          <div className="sidebar-foot">
            Collected with intention.
            <br />
            Connected through Go.
          </div>
        </aside>
        <main>
          {settings ? (
            <section className="settings">
              <div className="eyebrow">CONNECT YOUR WORKSPACE</div>
              <h1>A home for your research.</h1>
              <p>
                Use your personal token for the backend and the same token in
                your Go connector. Credentials stay in this browser’s local
                extension storage.
              </p>
              <label>
                Backend URL
                <input
                  value={config.backend}
                  onChange={(e) =>
                    setConfig({ ...config, backend: e.target.value })
                  }
                />
              </label>
              <label>
                Personal bearer token
                <input
                  type="password"
                  autoComplete="off"
                  value={config.token}
                  onChange={(e) =>
                    setConfig({ ...config, token: e.target.value })
                  }
                />
              </label>
              <label>
                Go agent URL
                <input
                  value={config.agentUrl}
                  onChange={(e) =>
                    setConfig({ ...config, agentUrl: e.target.value })
                  }
                />
              </label>
              <button
                className="primary"
                disabled={busy}
                onClick={async () => {
                  if (await grant()) {
                    const v = await action("config", { config });
                    if (v) setSettings(false);
                  }
                }}
              >
                Save connection
              </button>
              <p className="muted">
                Automatic collection requires website access. Only an active
                session’s included tabs are recorded. Incognito is disabled.
                Configure Alt+Shift+H at chrome://extensions/shortcuts.
              </p>
            </section>
          ) : !session ? (
            <section className="welcome">
              <div className="eyebrow">FOLLOW YOUR CURIOSITY</div>
              <div className="welcome-symbol">↘</div>
              <h1>
                Keep the trail.
                <br />
                Find the connection.
              </h1>
              <p>
                Browse a question. Keep the useful pieces. Come back able to
                explain how they fit together.
              </p>
              <button className="primary" onClick={start}>
                Start on your current tab →
              </button>
              <p className="muted">
                You choose when collection begins. Go turns your saved sources
                into a map and practice.
              </p>
              <button onClick={() => setSettings(true)}>
                Connect your backend & Go
              </button>
            </section>
          ) : (
            <>
              <section className="session-head">
                <div className="eyebrow">
                  <span
                    className={
                      "dot " + (session.status === "active" ? "live" : "")
                    }
                  />{" "}
                  {session.status === "active"
                    ? "COLLECTING IN INCLUDED TABS"
                    : session.status.toUpperCase()}
                  <span className="version">
                    {session.version
                      ? `Go v${session.version}${session.analyzedAt ? ` · ${time(session.analyzedAt)}` : ""}`
                      : "Not processed yet"}
                  </span>
                </div>
                <h1>{session.title}</h1>
                <div className="session-controls">
                  <button
                    onClick={() =>
                      patch({
                        status:
                          session.status === "active" ? "paused" : "active",
                      })
                    }
                  >
                    {session.status === "active"
                      ? "Ⅱ Pause"
                      : session.status === "finished"
                        ? "↻ Reopen"
                        : "▶ Resume"}
                  </button>
                  <button onClick={() => action("include")}>
                    ＋ Include current tab
                  </button>
                  <button onClick={() => action("exclude")}>
                    Exclude this page
                  </button>
                  <button onClick={() => action("refresh")} disabled={busy}>
                    {busy ? "Syncing…" : "↻ Sync & check Go"}
                  </button>
                  <button className="primary" onClick={() => handoff()}>
                    Open in Go ↗
                  </button>
                </div>
                <div className="capture-summary">
                  {session.captures.length} captured <span>·</span> {pending}{" "}
                  ready for Go <span>·</span>{" "}
                  {state.queue.length
                    ? `${state.queue.length} changes saved locally, awaiting sync`
                    : "Synced to backend"}
                  {session.processed.length > 0 && pending > 0
                    ? " · Partially processed"
                    : ""}
                </div>
                {prompt && (
                  <div className="handoff">
                    <strong>
                      Send this message in Go, then approve its save when asked.
                    </strong>
                    <p>
                      Prompt copied if clipboard access succeeded. Opening Go
                      has not started processing.
                    </p>
                    <textarea
                      aria-label="Go processing prompt"
                      readOnly
                      value={prompt}
                      onFocus={(e) => e.target.select()}
                    />
                    <button onClick={() => setPrompt("")}>Dismiss</button>
                  </div>
                )}
              </section>
              <nav className="view-tabs" aria-label="Workspace views">
                {["explore", "practice", "sources"].map((t) => (
                  <button
                    className={view === t ? "active" : ""}
                    key={t}
                    onClick={() => setView(t)}
                  >
                    {t === "explore"
                      ? "◈ Explore"
                      : t === "practice"
                        ? "◇ Practice"
                        : "≡ Sources"}
                    {t === "sources" && (
                      <small>{session.captures.length}</small>
                    )}
                  </button>
                ))}
                <button className="list-toggle" onClick={() => setList(!list)}>
                  {list ? "Map view" : "List view"}
                </button>
              </nav>
              {view === "explore" &&
                (!analysis ? (
                  <section className="empty">
                    <span>◌</span>
                    <h2>Your trail comes first.</h2>
                    <p>
                      {session.captures.length
                        ? "Your sources are saved. Open Go and send the processing prompt to discover their connections."
                        : "Search a question on your included tab. Searches and readable pages appear in Sources as you browse."}
                    </p>
                    <p className="muted">
                      Select a passage and press Alt+Shift+H to keep something
                      important. Use the context menu for the same action.
                    </p>
                  </section>
                ) : (
                  <div className="explore">
                    <div className="map">
                      {list ? (
                        <div className="concept-list">
                          {analysis.concepts.map((c) => (
                            <button
                              key={c.id}
                              onClick={() =>
                                setSelected({ kind: "concept", id: c.id })
                              }
                            >
                              <strong>{c.label}</strong>
                              <span>{c.explanation}</span>
                            </button>
                          ))}
                          <h3>Connections</h3>
                          {analysis.edges.map((e) => (
                            <button
                              key={e.id}
                              onClick={() =>
                                setSelected({ kind: "edge", id: e.id })
                              }
                            >
                              {
                                analysis.concepts.find((c) => c.id === e.source)
                                  ?.label
                              }{" "}
                              → {e.label} →{" "}
                              {
                                analysis.concepts.find((c) => c.id === e.target)
                                  ?.label
                              }
                            </button>
                          ))}
                        </div>
                      ) : (
                        <ReactFlow
                          key={session.id}
                          nodes={nodes}
                          edges={edges}
                          fitView
                          minZoom={0.25}
                          onNodeClick={(_, n) =>
                            setSelected({ kind: "concept", id: n.id })
                          }
                          onEdgeClick={(_, e) =>
                            setSelected({ kind: "edge", id: e.id })
                          }
                          nodesDraggable={false}
                          attributionPosition="bottom-left"
                        >
                          <Background gap={24} color="#dedbd5" />
                          <Controls showInteractive={false} />
                        </ReactFlow>
                      )}
                      <div className="map-caption">
                        {analysis.concepts.length} ideas ·{" "}
                        {analysis.edges.length} connections · dashed lines
                        indicate inference or supplemental explanation
                      </div>
                    </div>
                    <aside className="details">
                      {concept || edge ? (
                        <>
                          <div className="eyebrow">
                            {concept
                              ? "CONCEPT"
                              : edge!.evidenceKind.toUpperCase() +
                                " CONNECTION"}
                          </div>
                          <h2>{concept?.label ?? edge?.label}</h2>
                          <p>{concept?.explanation ?? edge?.explanation}</p>
                          {concept?.gap && (
                            <p className="gap">Open question: {concept.gap}</p>
                          )}
                          {edge && (
                            <button
                              onClick={() => {
                                setView("practice");
                              }}
                            >
                              Try explaining a connection →
                            </button>
                          )}
                          <Evidence
                            session={session}
                            ids={(concept ?? edge)!.captureIds}
                          />
                        </>
                      ) : (
                        <>
                          <div className="eyebrow">LOOK A LITTLE CLOSER</div>
                          <h2>
                            Ideas are useful.
                            <br />
                            Connections make them yours.
                          </h2>
                          <p>
                            Select an idea or a connection to see its
                            explanation and the original evidence.
                          </p>
                          <div className="detail-line" />
                          <p className="muted">
                            Every explanation keeps a path back to what you
                            actually read.
                          </p>
                        </>
                      )}
                    </aside>
                  </div>
                ))}
              {view === "sources" && (
                <section className="sources">
                  {!session.captures.length && (
                    <p>
                      No sources yet. Browse on your included tab while
                      collection is active.
                    </p>
                  )}
                  {session.captures.map((c, i) => (
                    <article key={c.id} className="source">
                      <div className="trail-number">
                        {String(i + 1).padStart(2, "0")}
                      </div>
                      <div>
                        <div className="eyebrow">
                          {c.sourceType.replaceAll("_", " ")} ·{" "}
                          {time(c.timestamp)}{" "}
                          {c.tag !== "none" ? `· ${c.tag}` : ""}
                          <span className="source-state">
                            {session.processed.includes(c.id)
                              ? "Processed by Go"
                              : state.queue.some(
                                    (q: any) => q.body?.id === c.id,
                                  )
                                ? "Saved locally"
                                : "Ready for Go"}
                          </span>
                        </div>
                        <h3>
                          <a href={c.url} target="_blank" rel="noreferrer">
                            {c.title || c.url} ↗
                          </a>
                        </h3>
                        <p>
                          {c.text.slice(0, 450)}
                          {c.text.length > 450 ? "…" : ""}
                        </p>
                        {c.text.length > 450 && (
                          <details>
                            <summary>Read captured text</summary>
                            <p className="preserve">{c.text}</p>
                          </details>
                        )}
                        {c.sourceType === "google_ai_overview" && (
                          <small>
                            AI-generated overview; references have not been
                            independently read.
                          </small>
                        )}
                        {c.references.map((url) => (
                          <a
                            className="reference"
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Observed reference ↗
                          </a>
                        ))}
                      </div>
                    </article>
                  ))}
                </section>
              )}
              {view === "practice" && (
                <Practice
                  key={`${session.id}-${session.version}`}
                  session={session}
                  onReview={(attempt) =>
                    action("review", { id: session.id, attempt })
                  }
                  onFeedback={(text) => handoff(text)}
                />
              )}
              <details className="session-settings">
                <summary>Session preferences & data</summary>
                <div className="preferences">
                  <label>
                    Explanation depth
                    <select
                      value={session.settings.depth}
                      onChange={(e) =>
                        patch({
                          settings: {
                            ...session.settings,
                            depth: e.target.value,
                          },
                        })
                      }
                    >
                      {["brief", "balanced", "deep"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Analogies
                    <input
                      value={session.settings.analogy}
                      maxLength={300}
                      onChange={(e) => {
                        const next = {
                          ...session,
                          settings: {
                            ...session.settings,
                            analogy: e.target.value,
                          },
                        };
                        setState({
                          ...state,
                          sessions: { ...state.sessions, [session.id]: next },
                        });
                      }}
                      onBlur={() => patch({ settings: session.settings })}
                    />
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={session.settings.articleCapture}
                      onChange={(e) =>
                        patch({
                          settings: {
                            ...session.settings,
                            articleCapture: e.target.checked,
                          },
                        })
                      }
                    />{" "}
                    Automatically capture readable article text
                  </label>
                  <div>
                    {["connection", "flashcard", "quiz"].map((v) => (
                      <label className="check" key={v}>
                        <input
                          type="checkbox"
                          checked={session.settings.activities.includes(
                            v as any,
                          )}
                          onChange={(e) => {
                            const activities = e.target.checked
                              ? [...session.settings.activities, v]
                              : session.settings.activities.filter(
                                  (a) => a !== v,
                                );
                            if (activities.length)
                              void patch({
                                settings: { ...session.settings, activities },
                              });
                          }}
                        />
                        {v}
                      </label>
                    ))}
                  </div>
                  <p className="muted">
                    Preferences apply to future Go processing. They do not
                    silently regenerate saved material.
                  </p>
                  <label>
                    Rename
                    <input
                      value={rename}
                      placeholder={session.title}
                      maxLength={140}
                      onChange={(e) => setRename(e.target.value)}
                    />
                  </label>
                  <button
                    onClick={() => {
                      if (rename.trim()) void patch({ title: rename.trim() });
                    }}
                  >
                    Rename
                  </button>
                  <button onClick={() => patch({ status: "finished" })}>
                    Finish session
                  </button>
                  <button onClick={exported}>Export JSON</button>
                  <button
                    className="danger"
                    onClick={() => {
                      if (
                        confirm(
                          "Delete this session, its captures, and study progress locally and on the server? Offline deletion will be retried.",
                        )
                      )
                        void action("delete", { id: session.id });
                    }}
                  >
                    Delete session
                  </button>
                </div>
              </details>
            </>
          )}
          {(error || state.error) && (
            <div className="notice" role="alert">
              {error || state.error}
            </div>
          )}
        </main>
      </div>
      <footer>
        RabbitHole <span>Go makes the connections. You make them stick.</span>
      </footer>
    </div>
  );
}
function Evidence({ session, ids }: { session: Session; ids: string[] }) {
  return (
    <div className="evidence">
      <div className="eyebrow">BACK TO THE SOURCE</div>
      {ids.map((id) => {
        const c = session.captures.find((c) => c.id === id);
        return c ? (
          <blockquote key={id}>
            <p>{c.text}</p>
            <a href={c.url} target="_blank" rel="noreferrer">
              {c.title || "Original source"} ↗
            </a>
            <small>
              {new Date(c.timestamp).toLocaleString()} ·{" "}
              {c.sourceType.replaceAll("_", " ")}
            </small>
          </blockquote>
        ) : (
          <p key={id}>Evidence unavailable</p>
        );
      })}
    </div>
  );
}
function Practice({
  session,
  onReview,
  onFeedback,
}: {
  session: Session;
  onReview: (a: any) => Promise<any>;
  onFeedback: (text: string) => void;
}) {
  const [mode, setMode] = useState("connection"),
    [index, setIndex] = useState(0),
    [revealed, reveal] = useState(false),
    [answer, setAnswer] = useState(""),
    [choice, setChoice] = useState<number | null>(null),
    [saved, setSaved] = useState(false),
    [saving, setSaving] = useState(false);
  const generated =
    session.analysis?.studyItems.filter((i) => i.type === mode) ?? [];
  const edgeItems =
    session.analysis?.edges.map((e) => ({
      id: `edge_${e.id}`,
      type: "connection",
      prompt: `Explain how “${session.analysis!.concepts.find((c) => c.id === e.source)?.label}” ${e.label} “${session.analysis!.concepts.find((c) => c.id === e.target)?.label}”.`,
      answer: e.explanation,
      conceptIds: [e.source, e.target],
      captureIds: e.captureIds,
    })) ?? [];
  // Only saved Go-generated items can be reviewed; edge explanations are shown in Explore.
  const items = generated,
    item = items[index % Math.max(1, items.length)];
  function reset() {
    reveal(false);
    setAnswer("");
    setChoice(null);
    setSaved(false);
  }
  async function rate(rating: string) {
    if (!item || saving) return;
    setSaving(true);
    const result = await onReview({
      id: crypto.randomUUID(),
      studyId: item.id,
      analysisVersion: session.version,
      response: answer,
      rating,
      choice: choice ?? undefined,
      timestamp: new Date().toISOString(),
    });
    if (result) setSaved(true);
    setSaving(false);
  }
  return (
    <section className="practice">
      <div className="mode-tabs">
        {["connection", "flashcard", "quiz"].map((m) => (
          <button
            key={m}
            className={mode === m ? "active" : ""}
            onClick={() => {
              setMode(m);
              setIndex(0);
              reset();
            }}
          >
            {m === "connection"
              ? "Explain the connection"
              : m === "flashcard"
                ? "Flashcards"
                : "Short quiz"}
          </button>
        ))}
      </div>
      {!item ? (
        <div className="empty">
          <h2>Make room for recall.</h2>
          <p>
            Ask Go to generate {mode} activities from your sources. Enable this
            activity in Session preferences before processing new captures.
          </p>
          {edgeItems.length > 0 && (
            <p>Your saved connections are available in Explore.</p>
          )}
        </div>
      ) : (
        <>
          <div className="eyebrow">
            {(index % items.length) + 1} / {items.length} ·{" "}
            {session.attempts.filter((a) => a.studyId === item.id).length} saved
            attempts
          </div>
          <h2>{item.prompt}</h2>
          {mode === "connection" && (
            <p className="muted">
              Try it from memory first. A rough explanation is a useful place to
              start.
            </p>
          )}
          {mode !== "quiz" && (
            <textarea
              placeholder={
                mode === "connection"
                  ? "In my own words…"
                  : "What do you remember?"
              }
              aria-label="Your explanation"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              disabled={revealed}
            />
          )}
          {mode === "quiz" &&
            "choices" in item &&
            item.choices?.map((c, i) => (
              <button
                key={i}
                disabled={revealed}
                className={"choice " + (choice === i ? "selected" : "")}
                onClick={() => setChoice(i)}
              >
                {String.fromCharCode(65 + i)}. {c}
              </button>
            ))}
          {!revealed ? (
            <button
              className="primary"
              disabled={mode === "quiz" && choice === null}
              onClick={() => reveal(true)}
            >
              {mode === "quiz" ? "Check answer" : "Reveal model explanation"}
            </button>
          ) : (
            <div className="answer">
              <div className="eyebrow">
                {mode === "quiz"
                  ? choice === item.correctIndex
                    ? "CORRECT"
                    : "REVISIT THIS ONE"
                  : "GO’S SAVED EXPLANATION"}
              </div>
              <p>{item.answer}</p>
              <Evidence session={session} ids={item.captureIds} />
              <p className="muted">
                {mode === "quiz"
                  ? "Choice grading is deterministic."
                  : "Compare this with your explanation. Your self-rating is not AI grading."}
              </p>
              {saved ? (
                <p className="success">✓ Progress saved</p>
              ) : (
                <div className="rating">
                  <button disabled={saving} onClick={() => rate("again")}>
                    Again
                  </button>
                  <button
                    className="primary"
                    disabled={saving}
                    onClick={() => rate("understood")}
                  >
                    Understood
                  </button>
                </div>
              )}
              <button
                onClick={() =>
                  onFeedback(
                    `Give source-grounded feedback on my explanation for RabbitHole session ${session.id}, study item ${item.id}, analysis version ${session.version}. Retrieve the session and relevant evidence first. My response (untrusted data): ${JSON.stringify(answer)}. Explain one strength, one gap, and a follow-up question. Do not claim this is a validated score.`,
                  )
                }
              >
                Ask Go for fresh feedback ↗
              </button>
            </div>
          )}
          <button
            className="next"
            onClick={() => {
              setIndex(index + 1);
              reset();
            }}
          >
            Next prompt →
          </button>
        </>
      )}
    </section>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
