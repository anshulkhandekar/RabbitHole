import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import "@xyflow/react/dist/style.css";
import "./styles/tokens.css";
import "./styles/fonts.css";
import "./styles/components.css";
import "./ui.css";
import type {
  Session,
  AnalysisData,
  Attempt,
} from "../../../packages/contracts/src/index";
import { Icon } from "./Icon";
import {
  Brand,
  Button,
  IconButton,
  LiveStatus,
  Chip,
  Segmented,
  Toast,
} from "./components";
import { Trail, Excluded } from "./Trail";
import { MapView, type Selection } from "./MapView";
import { Practice } from "./Practice";
import { analysisDelta, domain, time } from "./ui-model";
const request = (type: string, extra: any = {}) =>
  chrome.runtime.sendMessage({ type, ...extra });
type TabContext = {
  tabId?: number;
  url: string;
  title: string;
  regular: boolean;
  included: boolean;
  count: number;
  excluded: boolean;
};
type Handoff = {
  sessionId: string;
  prompt: string;
  copied: boolean;
  opened: boolean;
};
type Update = {
  sessionId: string;
  version: number;
  at: string;
  ideas: number;
  connections: number;
};
function App() {
  const [state, setState] = useState<any>(null),
    [config, setConfig] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [context, setContext] = useState<TabContext | null>(null),
    [online, setOnline] = useState(navigator.onLine),
    [narrow, setNarrow] = useState(innerWidth < 600),
    [view, setView] = useState("map"),
    [selected, setSelected] = useState<Selection>(null),
    [list, setList] = useState(false),
    [railOpen, setRailOpen] = useState(false),
    [menu, setMenu] = useState(false),
    [creating, setCreating] = useState(false),
    [curiosity, setCuriosity] = useState(""),
    [settings, setSettings] = useState(
      new URLSearchParams(location.search).has("settings"),
    ),
    [preferences, setPreferences] = useState(false),
    [handoff, setHandoff] = useState<Handoff | null>(null),
    [updated, setUpdated] = useState<Update | null>(null),
    [synced, setSynced] = useState<string | null>(null),
    [toast, setToast] = useState(""),
    [practiceEdge, setPracticeEdge] = useState<string | undefined>(),
    [rename, setRename] = useState(""),
    [analogyDraft, setAnalogyDraft] = useState(""),
    [theme, setTheme] = useState("system");
  const panel =
    new URLSearchParams(location.search).has("panel") ||
    (!new URLSearchParams(location.search).has("workspace") && narrow);
  const previous = useRef<Record<string, Session>>({}),
    syncing = useRef(false),
    mounted = useRef(true),
    trailScroll = useRef<HTMLDivElement>(null),
    firstTrail = useRef(true);
  const showToast = useCallback((text: string) => setToast(text), []);
  const apply = useCallback((value: any) => {
    if (!value?.sessions) return;
    for (const next of Object.values(value.sessions) as Session[]) {
      const before = previous.current[next.id];
      if (before && next.version > before.version && next.analysis) {
        setUpdated({
          sessionId: next.id,
          version: next.version,
          at: next.analyzedAt ?? new Date().toISOString(),
          ...analysisDelta(before.analysis, next.analysis),
        });
        setHandoff((h) => (h?.sessionId === next.id ? null : h));
      }
    }
    previous.current = value.sessions;
    setState(value);
  }, []);
  const updateContext = useCallback(async () => {
    try {
      const next = await request("ui-context");
      if (mounted.current) setContext(next);
    } catch {}
  }, []);
  const action = useCallback(
    async (type: string, extra: any = {}) => {
      setBusy(true);
      setError("");
      try {
        const value = await request(type, extra);
        if (value?.error && !value.sessions) throw Error(value.error);
        if (mounted.current) apply(value);
        return value;
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Couldn’t complete that action. Try again.",
        );
        return undefined;
      } finally {
        setBusy(false);
        void updateContext();
      }
    },
    [apply, updateContext],
  );
  const sync = useCallback(async () => {
    if (syncing.current || !navigator.onLine) return;
    syncing.current = true;
    try {
      const value = await request("refresh");
      if (mounted.current) {
        apply(value);
        if (!value.error && !value.queue?.length)
          setSynced(new Date().toISOString());
      }
    } catch {
    } finally {
      syncing.current = false;
    }
  }, [apply]);
  useEffect(() => {
    mounted.current = true;
    void action("state");
    void updateContext();
    void chrome.storage.local
      .get("uiTheme")
      .then((v) =>
        setTheme(typeof v.uiTheme === "string" ? v.uiTheme : "system"),
      );
    const change = (changes: any) => {
      if (changes.state) apply(changes.state.newValue);
    };
    const tab = () => void updateContext();
    const network = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void sync();
    };
    const resize = () => setNarrow(innerWidth < 600);
    chrome.storage.onChanged.addListener(change);
    chrome.tabs.onActivated.addListener(tab);
    chrome.tabs.onUpdated.addListener(tab);
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    window.addEventListener("resize", resize);
    return () => {
      mounted.current = false;
      chrome.storage.onChanged.removeListener(change);
      chrome.tabs.onActivated.removeListener(tab);
      chrome.tabs.onUpdated.removeListener(tab);
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
      window.removeEventListener("resize", resize);
    };
  }, []);
  useEffect(() => {
    if (state && !config) setConfig(state.config);
  }, [state, config]);
  useEffect(() => {
    if (theme === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    if (!state?.config.token) return;
    void sync();
    const timer = setInterval(() => void sync(), handoff ? 4000 : 30000);
    return () => clearInterval(timer);
  }, [state?.config.token, handoff?.sessionId, sync]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(timer);
  }, [toast]);
  const session: Session | undefined = state?.sessions[state.active],
    sessions = Object.values(state?.sessions ?? {}) as Session[];
  const pending =
    session?.captures.filter((c) => !session.processed.includes(c.id)).length ??
    0;
  const excluded: string[] = state?.excluded[session?.id ?? ""] ?? [];
  const queued = state?.queue?.length ?? 0,
    unsyncedFinds =
      state?.queue?.filter((q: any) => q.path.endsWith("/captures")).length ??
      0;
  useEffect(() => {
    if (!panel || !trailScroll.current) return;
    trailScroll.current.scrollTo({
      top: trailScroll.current.scrollHeight,
      behavior:
        firstTrail.current ||
        matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
    });
    firstTrail.current = false;
  }, [session?.id, session?.captures.length, panel]);
  useEffect(() => {
    setSelected(null);
    setPracticeEdge(undefined);
    setRename("");
    firstTrail.current = true;
  }, [session?.id]);
  useEffect(() => {
    if (preferences && session) setAnalogyDraft(session.settings.analogy);
  }, [preferences, session?.id]);
  const patch = (patch: any) => action("patch", { id: session!.id, patch });
  async function grant() {
    return chrome.permissions.request({
      origins: ["http://*/*", "https://*/*"],
    });
  }
  async function start() {
    if (!context?.regular) {
      setError("Open a web page to start saving.");
      return;
    }
    if (await grant()) {
      const value = await action("start");
      if (value?.active) {
        if (curiosity.trim())
          await action("patch", {
            id: value.active,
            patch: { title: curiosity.trim() },
          });
        setCreating(false);
        setCuriosity("");
        setHandoff(null);
        setUpdated(null);
      }
    } else
      setError(
        "Website access is needed to collect an enabled research trail.",
      );
  }
  function selectSession(id: string) {
    setMenu(false);
    setCreating(false);
    setHandoff(null);
    setUpdated(null);
    void action("select", { id });
  }
  function newSession() {
    setMenu(false);
    setCreating(true);
    setSettings(false);
    setError("");
  }
  function openWorkspace(next = "map") {
    if (panel)
      void chrome.tabs.create({
        url: chrome.runtime.getURL(`index.html?workspace=1#${next}`),
      });
    else {
      setView(next);
      setUpdated(null);
    }
  }
  useEffect(() => {
    const initial = location.hash.slice(1);
    if (["map", "practice", "sources"].includes(initial)) setView(initial);
  }, []);
  async function copyPrompt(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Prompt copied");
      return true;
    } catch {
      showToast("Copy the prompt from the box below");
      return false;
    }
  }
  async function sendToGo(custom?: string) {
    if (!session) return;
    if (!online) {
      setError("You’re offline. Reconnect before handing this to Go.");
      return;
    }
    if (queued) {
      await sync();
      const current = await request("state");
      apply(current);
      if (current.queue.length || current.error) {
        setError(
          "Couldn’t sync. Your finds are saved on this device. Try again before sending to Go.",
        );
        return;
      }
    }
    const prompt =
      custom ??
      `Process RabbitHole session ${session.id}. Retrieve the pending captures and existing analysis using RabbitHole tools, merge evidence-linked concepts and selected activities, and save the complete analysis. Report the saved version and remaining pending captures.`;
    setUpdated(null);
    const receipt: Handoff = {
      sessionId: session.id,
      prompt,
      copied: false,
      opened: false,
    };
    setHandoff(receipt);
    receipt.copied = await copyPrompt(prompt);
    try {
      await chrome.tabs.create({ url: state.config.agentUrl });
      receipt.opened = true;
    } catch {
      setError(
        "Couldn’t open Go. Open your configured agent and use the prompt below.",
      );
    }
    setHandoff({ ...receipt });
  }
  function rebuild() {
    if (session)
      void sendToGo(
        `Rebuild the learning guide for RabbitHole session ${session.id} from its existing captured sources. This is an explicit rebuild request, not a request to mark new captures processed. Retrieve GetSession and the relevant existing evidence texts using captureIds (up to 24 sources this run); preserve unreviewed material and stable IDs. Save the complete analysis using intent "rebuild", expectedVersion from the read and processedCaptureIds [] if no new captures were inspected. Add a source-grounded overview, rootConceptId and reading route, parentId hierarchy, useful takeaways, concrete examples, limitations and exact evidence excerpts. Generate a challenging four-option quiz with misconception distractors and a reason for each choice, plus matching if selected. Clearly state which sources you reviewed.`,
      );
  }
  function exported() {
    if (!session) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(session, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `rabbithole-${session.id}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function CaptureRow() {
    if (!session) return null;
    const active = session.status === "active";
    return (
      <>
        <div className="capture">
          <LiveStatus active={active} />
          <div className="capture-text">
            <strong>
              {active
                ? "Collecting"
                : session.status === "finished"
                  ? "Finished"
                  : "Paused"}
            </strong>
            <span>
              {active
                ? `${context?.count ?? 0} included ${context?.count === 1 ? "tab" : "tabs"}`
                : "Nothing new is being saved"}
            </span>
          </div>
          <Button
            icon={active ? "pause" : "play"}
            disabled={busy}
            onClick={() => patch({ status: active ? "paused" : "active" })}
          >
            {active
              ? "Pause"
              : session.status === "finished"
                ? "Reopen"
                : "Resume"}
          </Button>
        </div>
        {TabContextLine()}
      </>
    );
  }
  function TabContextLine() {
    if (!session) return null;
    if (!online)
      return (
        <div className="tabctx offline">
          <Icon name="offline" size={16} />
          <span>
            You’re offline. New finds are saved on this device and will sync
            later.
          </span>
        </div>
      );
    const warning =
      error ||
      (state.error &&
        (state.config.token
          ? "Couldn’t sync. Your finds are saved on this device. Try again or check Settings."
          : state.error));
    if (warning)
      return (
        <div className="tabctx error" role="alert">
          <span className="grow">{warning}</span>
          <Button
            quiet
            onClick={() => {
              setError("");
              void sync();
            }}
          >
            Try again
          </Button>
        </div>
      );
    if (session.status !== "active") return null;
    if (!context?.regular)
      return <div className="tabctx">Open a web page to start saving.</div>;
    if (!context.included)
      return (
        <div className="tabctx out">
          <span className="grow">
            <b>{domain(context.url)}</b> isn’t part of this rabbit hole.
          </span>
          <Button
            onClick={async () => {
              const value = await action("include");
              if (value) showToast("Tab included");
            }}
          >
            Include tab
          </Button>
        </div>
      );
    if (context.excluded)
      return (
        <div className="tabctx">
          <span className="grow">This page is excluded.</span>
          <Button
            quiet
            onClick={() => action("unexclude", { url: context.url })}
          >
            Include again
          </Button>
        </div>
      );
    return (
      <div className="tabctx">
        <span className="grow">
          {session.settings.articleCapture
            ? "Saving this page as you read."
            : "Searches and highlights are saved. Article capture is off."}
        </span>
        <Button
          quiet
          icon="excluded"
          onClick={async () => {
            const value = await action("exclude");
            if (value) showToast("Page excluded. It won’t be saved.");
          }}
        >
          Exclude page
        </Button>
      </div>
    );
  }
  function SessionSwitcher() {
    return (
      <div className="switcher">
        <button
          className="switcher-btn"
          title={session?.title}
          aria-label="Switch rabbit hole"
          aria-haspopup="menu"
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setMenu(false);
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setMenu(true);
              requestAnimationFrame(() =>
                document.querySelector<HTMLElement>(".menu-item")?.focus(),
              );
            }
          }}
        >
          <span className="switcher-title">
            {session?.title ?? "Your rabbit holes"}
          </span>
          <Icon name="chevronDown" size={16} />
        </button>
        {menu && (
          <div
            className="menu open"
            role="menu"
            onKeyDown={(e) => {
              const items = [
                  ...e.currentTarget.querySelectorAll<HTMLElement>(
                    "[role=menuitem]",
                  ),
                ],
                i = items.indexOf(document.activeElement as HTMLElement);
              if (e.key === "Escape") {
                setMenu(false);
                document
                  .querySelector<HTMLElement>(
                    panel ? ".switcher-btn" : ".tb-title h1 button",
                  )
                  ?.focus();
              }
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                items[
                  (i + (e.key === "ArrowDown" ? 1 : items.length - 1)) %
                    items.length
                ]?.focus();
              }
            }}
          >
            {[...sessions].reverse().map((s) => (
              <button
                className="menu-item"
                role="menuitem"
                key={s.id}
                aria-current={s.id === session?.id ? "true" : undefined}
                onClick={() => selectSession(s.id)}
              >
                <span className="t" title={s.title}>
                  {s.title}
                </span>
                <span className="d">{s.captures.length} deep</span>
              </button>
            ))}
            <hr />
            <button className="menu-item" role="menuitem" onClick={newSession}>
              <Icon name="plus" size={16} />
              <span>Start a new rabbit hole</span>
            </button>
          </div>
        )}
      </div>
    );
  }
  function SyncLine() {
    return (
      <div className="sync">
        <Icon name={!online ? "offline" : "sync"} size={14} />
        <span>
          {!online
            ? `${unsyncedFinds} finds waiting to sync`
            : queued
              ? `${queued} changes waiting to sync`
              : synced
                ? `Synced ${time(synced)}`
                : "Checking sync status"}
        </span>
        {(queued || state.error) && (
          <button className="text-button" onClick={() => sync()}>
            Try again
          </button>
        )}
      </div>
    );
  }
  function HandoffPanel() {
    if (!handoff || handoff.sessionId !== session?.id) return null;
    return (
      <div className="handoff-panel">
        <ol className="steps">
          <li>
            <span>
              {handoff.copied ? (
                <>
                  <Icon name="check" size={14} />
                  Prompt copied
                </>
              ) : (
                "Copy the prompt below"
              )}
              <small>
                {handoff.opened
                  ? "Go opened in a new tab"
                  : "Open your Go agent"}
              </small>
            </span>
          </li>
          <li>Paste it into Go and send</li>
          <li>Approve the save if Go asks</li>
        </ol>
        <div className="prompt-box">
          <textarea
            aria-label="Go processing prompt"
            readOnly
            value={handoff.prompt}
            onFocus={(e) => e.target.select()}
          />
          <IconButton
            name="copy"
            label="Copy prompt"
            onClick={() =>
              void copyPrompt(handoff.prompt).then((copied) =>
                setHandoff((h) => (h ? { ...h, copied } : h)),
              )
            }
          />
        </div>
        <div className="waiting">
          <span>
            This panel checks for Go’s saved updates. Opening Go hasn’t started
            processing.
          </span>
          <Button quiet onClick={() => setHandoff(null)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }
  function GoFooter() {
    const update = updated?.sessionId === session?.id ? updated : null,
      hand = handoff?.sessionId === session?.id;
    return (
      <footer className="p-foot">
        {hand ? (
          HandoffPanel()
        ) : update ? (
          <>
            <div className="updated">
              <span className="badge">
                <Icon name="check" />
              </span>
              <div>
                <strong>Map updated at {time(update.at)}</strong>
                <span>
                  {update.ideas} new ideas and {update.connections} new
                  connections
                </span>
              </div>
            </div>
            <div className="foot-row">
              <Button primary icon="map" onClick={() => openWorkspace("map")}>
                Open map
              </Button>
              <Button
                icon="practice"
                onClick={() => {
                  if (panel) openWorkspace("practice");
                  else setView("practice");
                  setUpdated(null);
                }}
              >
                Practice
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="handoff-line">
              {pending > 0 ? (
                <>
                  <span className="new-find-dot" />
                  <span>
                    <b>
                      {pending} new {pending === 1 ? "find" : "finds"}
                    </b>{" "}
                    since Go last looked
                  </span>
                </>
              ) : session!.captures.length ? (
                "Everything here is already on your map."
              ) : (
                "No finds yet. Your trail will appear as you browse."
              )}
              {pending > 0 && session!.processed.length > 0 && (
                <Chip>Partially processed</Chip>
              )}
            </p>
            <div className="foot-row">
              <Button
                primary
                icon="handoff"
                disabled={
                  pending === 0 || !online || !state.config.token || busy
                }
                onClick={() => void sendToGo()}
              >
                Send to Go
              </Button>
              <Button icon="map" onClick={() => openWorkspace()}>
                Map
              </Button>
            </div>
            {SyncLine()}
          </>
        )}
      </footer>
    );
  }
  function SessionRail() {
    return (
      <aside className="rail" aria-label="Rabbit holes">
        <h2>Rabbit holes</h2>
        <nav aria-label="Saved sessions">
          {[...sessions].reverse().map((s) => (
            <button
              className="rail-item"
              key={s.id}
              aria-current={s.id === session?.id ? "page" : undefined}
              onClick={() => selectSession(s.id)}
            >
              <span className="t" title={s.title}>
                {s.title}
              </span>
              {s.status === "active" && <LiveStatus active />}
              <span className="d">
                {new Date(s.updatedAt).toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                })}
                , {time(s.updatedAt)}
              </span>
              <span
                className="depthbar"
                aria-label={`${s.captures.length} deep`}
              >
                {Array.from(
                  { length: Math.min(12, s.captures.length) },
                  (_, i) => (
                    <i key={i} />
                  ),
                )}
              </span>
            </button>
          ))}
        </nav>
        <Button quiet icon="plus" onClick={newSession}>
          Start a new rabbit hole
        </Button>
        <Button quiet icon="settings" onClick={() => setPreferences(true)}>
          Session preferences
        </Button>
      </aside>
    );
  }
  function Welcome() {
    return (
      <section className="empty welcome">
        <span className="hole">
          <img src="rabbithole-mark.svg" width={56} height={56} alt="" />
        </span>
        <h2>Start a rabbit hole</h2>
        <p>
          Follow a question. Keep the useful finds and come back able to explain
          how they connect.
        </p>
        <label htmlFor="curiosity">What are you curious about?</label>
        <input
          id="curiosity"
          value={curiosity}
          maxLength={140}
          onChange={(e) => setCuriosity(e.target.value)}
          placeholder="Optional research question"
        />
        <Button
          primary
          className="btn-lg"
          disabled={busy || !context?.regular}
          onClick={start}
        >
          Start collecting
        </Button>
        <p className="fine">Nothing is saved until you start.</p>
        {!context?.regular && (
          <p className="contextual-note">
            Open a web page to start saving. Use RabbitHole’s side panel on that
            page.
          </p>
        )}
        {(error || state.error) && (
          <p className="error" role="alert">
            {error || state.error}
          </p>
        )}
        <Button quiet onClick={() => setSettings(true)}>
          Connect your backend & Go
        </Button>
        {creating && session && (
          <Button quiet onClick={() => setCreating(false)}>
            Back to saved session
          </Button>
        )}
      </section>
    );
  }
  if (!state || !config)
    return (
      <main className="loading" role="status">
        Opening your trail…
      </main>
    );
  return (
    <div className={panel ? "panel" : `ws ${railOpen ? "" : "rail-collapsed"}`}>
      <div className="app-surface" inert={settings || preferences}>
        <header className={panel ? "p-head" : "topbar"}>
          <Brand
            onClick={() => {
              setSettings(false);
              setCreating(false);
            }}
          />
          {!panel && session && !creating && (
            <div className="tb-title">
              <h1 aria-label={session.title}>
                <button
                  title={session.title}
                  onClick={() => setMenu(!menu)}
                  aria-label="Switch rabbit hole"
                >
                  {session.title}
                  <Icon name="chevronDown" size={14} />
                </button>
              </h1>
              {menu && (
                <div className="workspace-switcher">{SessionSwitcher()}</div>
              )}
              <span className="tb-live">
                <LiveStatus active={session.status === "active"} />
                {session.status === "active"
                  ? "Collecting"
                  : session.status === "paused"
                    ? "Paused"
                    : "Finished"}
              </span>
            </div>
          )}
          <div className="tb-actions">
            {!panel && (
              <IconButton
                name="list"
                className="rail-toggle icon-btn"
                label={railOpen ? "Hide rabbit holes" : "Show rabbit holes"}
                onClick={() => setRailOpen((v) => !v)}
              />
            )}
            {panel && session && (
              <IconButton
                name="minus"
                label="Read without sidebar"
                onClick={async () => {
                  await action("reading-mode");
                  showToast(
                    "Reading mode on. Close the panel with Chrome’s close button if it remains open.",
                  );
                }}
              />
            )}
            {!panel && session && !creating && (
              <Button
                primary
                icon="handoff"
                aria-label={`Send to Go, ${pending} new finds`}
                disabled={
                  !online || pending === 0 || busy || !state.config.token
                }
                onClick={() => void sendToGo()}
              >
                <span className="label">Send to Go</span>
                {pending > 0 && <Chip>{pending} new</Chip>}
              </Button>
            )}
            <IconButton
              name={panel ? "workspace" : "panel"}
              label={panel ? "Open full workspace" : "Back to side panel"}
              onClick={() =>
                panel ? openWorkspace() : void action("open-panel")
              }
            />
            <IconButton
              name="settings"
              label="Settings"
              onClick={() => setSettings(true)}
            />
          </div>
        </header>
        {panel ? (
          !session || creating ? (
            Welcome()
          ) : (
            <>
              {SessionSwitcher()}
              {CaptureRow()}
              <div className="p-scroll" ref={trailScroll}>
                <div className="trail-head">
                  <h2>Your trail</h2>
                  <span className="depth">
                    <b>{session.captures.length}</b> deep
                  </span>
                </div>
                <p className="surface">Started {time(session.createdAt)}</p>
                <Trail session={session} queue={state.queue} />
                {!session.captures.length && (
                  <p className="muted">
                    Search a question or read a page on your included tab. Your
                    finds will appear here.
                  </p>
                )}
                {excluded.length > 0 && (
                  <div className="excluded-note">
                    <Icon name="excluded" size={14} />
                    {excluded.length} {excluded.length === 1 ? "page" : "pages"}{" "}
                    excluded{" "}
                    <button
                      onClick={() => {
                        setView("sources");
                        openWorkspace("sources");
                      }}
                    >
                      Review
                    </button>
                  </div>
                )}
                <Button
                  quiet
                  icon="settings"
                  onClick={() => setPreferences(true)}
                >
                  Session preferences
                </Button>
              </div>
              {GoFooter()}
            </>
          )
        ) : (
          <>
            {SessionRail()}
            <main className="main">
              {!session || creating ? (
                Welcome()
              ) : (
                <>
                  <div className="viewbar">
                    <Segmented
                      label="Views"
                      value={view}
                      options={[
                        { value: "map", label: "Map", icon: "map" },
                        {
                          value: "practice",
                          label: "Practice",
                          icon: "practice",
                        },
                        {
                          value: "sources",
                          label: "Sources",
                          icon: "sources",
                          count: session.captures.length,
                        },
                      ]}
                      onChange={setView}
                    />
                    {view === "map" && (
                      <Button
                        quiet
                        icon={list ? "map" : "list"}
                        aria-pressed={list}
                        onClick={() => setList(!list)}
                      >
                        {list ? "Map view" : "List view"}
                      </Button>
                    )}
                    {view === "map" && session.analysis && (
                      <Button
                        quiet
                        icon="handoff"
                        disabled={busy || !online}
                        onClick={rebuild}
                      >
                        Rebuild with Go
                      </Button>
                    )}
                    <Button
                      quiet
                      icon={session.status === "active" ? "pause" : "play"}
                      className="workspace-pause"
                      onClick={() =>
                        patch({
                          status:
                            session.status === "active" ? "paused" : "active",
                        })
                      }
                    >
                      {session.status === "active" ? "Pause" : "Resume"}
                    </Button>
                  </div>
                  {(error || state.error) && (
                    <div className="workspace-error" role="alert">
                      {error || state.error}
                      <Button quiet onClick={() => sync()}>
                        Try again
                      </Button>
                    </div>
                  )}
                  {handoff?.sessionId === session.id && (
                    <div className="workspace-handoff">{HandoffPanel()}</div>
                  )}
                  {updated?.sessionId === session.id && (
                    <div className="workspace-update" role="status">
                      <Icon name="check" size={16} />
                      Map updated at {time(updated.at)}
                      <Button quiet onClick={() => setUpdated(null)}>
                        Dismiss
                      </Button>
                    </div>
                  )}
                  <div className="view">
                    {view === "map" ? (
                      <MapView
                        key={session.id}
                        session={session}
                        list={list}
                        selected={selected}
                        onSelect={setSelected}
                        onRebuild={rebuild}
                        onPractice={(id) => {
                          setPracticeEdge(id || undefined);
                          setView("practice");
                        }}
                      />
                    ) : view === "practice" ? (
                      <Practice
                        key={`${session.id}:${session.version}:${practiceEdge ?? ""}`}
                        session={session}
                        edgeId={practiceEdge}
                        onReview={async (a: Attempt) =>
                          !!(await action("review", {
                            id: session.id,
                            attempt: a,
                          }))
                        }
                        onFeedback={(text) => void sendToGo(text)}
                        onToast={showToast}
                      />
                    ) : (
                      <section className="sources">
                        <div className="s-col">
                          <div className="sources-heading">
                            <h2>Your trail</h2>
                            <span>{session.captures.length} deep</span>
                          </div>
                          {CaptureRow()}
                          <Trail session={session} queue={state.queue} wide />
                          <Excluded
                            urls={excluded}
                            onInclude={(url) =>
                              void action("unexclude", { url })
                            }
                          />
                          {SyncLine()}
                        </div>
                      </section>
                    )}
                  </div>
                </>
              )}
            </main>
          </>
        )}
      </div>
      {(settings || preferences) && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSettings(false);
              setPreferences(false);
            }
          }}
        >
          <section
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-label={settings ? "Workspace settings" : "Session preferences"}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSettings(false);
                setPreferences(false);
              }
              if (e.key === "Tab") {
                const els = [
                  ...e.currentTarget.querySelectorAll<HTMLElement>(
                    "button,input,select,textarea,[href]",
                  ),
                ].filter((el) => !el.hasAttribute("disabled"));
                const i = els.indexOf(document.activeElement as HTMLElement);
                if (e.shiftKey && i === 0) {
                  e.preventDefault();
                  els.at(-1)?.focus();
                }
                if (!e.shiftKey && i === els.length - 1) {
                  e.preventDefault();
                  els[0]?.focus();
                }
              }
            }}
          >
            <IconButton
              name="x"
              label="Close settings"
              autoFocus
              onClick={() => {
                setSettings(false);
                setPreferences(false);
              }}
            />
            {settings ? (
              <>
                <h1>Connect your workspace</h1>
                <p>
                  Your personal token connects this extension and Go to the same
                  saved research. It stays in local extension storage.
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
                <label>
                  Appearance
                  <select
                    aria-label="Appearance"
                    value={theme}
                    onChange={(e) => {
                      setTheme(e.target.value);
                      void chrome.storage.local.set({
                        uiTheme: e.target.value,
                      });
                    }}
                  >
                    <option value="system">Follow system</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </label>
                <Button
                  primary
                  disabled={busy}
                  onClick={async () => {
                    if (await grant()) {
                      const value = await action("config", { config });
                      if (value) {
                        setSettings(false);
                        showToast("Connection saved");
                        void sync();
                      }
                    }
                  }}
                >
                  Save connection
                </Button>
                <p className="muted">
                  Automatic collection requires website access. Only an active
                  session’s included tabs are recorded. Incognito is disabled.
                  Configure Alt+Shift+H at chrome://extensions/shortcuts.
                </p>
                {session && (
                  <Button
                    quiet
                    onClick={() => {
                      setSettings(false);
                      setPreferences(true);
                    }}
                  >
                    Session preferences & data
                  </Button>
                )}
              </>
            ) : (
              session && (
                <>
                  <h1>Session preferences</h1>
                  <label>
                    Explanation depth
                    <select
                      aria-label="Explanation depth"
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
                      value={analogyDraft}
                      maxLength={300}
                      onChange={(e) => setAnalogyDraft(e.target.value)}
                      onBlur={() =>
                        patch({
                          settings: {
                            ...session.settings,
                            analogy: analogyDraft,
                          },
                        })
                      }
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
                    />
                    Automatically capture readable article text
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={session.settings.autoHighlights ?? false}
                      onChange={(e) =>
                        patch({
                          settings: {
                            ...session.settings,
                            autoHighlights: e.target.checked,
                          },
                        })
                      }
                    />
                    Save text selections automatically
                  </label>
                  <p className="muted">
                    Opt in for this rabbit hole. Selecting page text saves a
                    highlight after a short pause, without a shortcut. Editable
                    fields are excluded. Turn this off if you select only to
                    focus your eyes.
                  </p>
                  <Button
                    icon="minus"
                    onClick={async () => {
                      setPreferences(false);
                      await action("reading-mode");
                    }}
                  >
                    Read without sidebar
                  </Button>
                  <fieldset>
                    <legend>Study activities</legend>
                    {["quiz", "matching", "connection", "flashcard"].map(
                      (v) => (
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
                          {v === "connection"
                            ? "Explain the connection"
                            : v === "flashcard"
                              ? "Flashcards"
                              : v === "matching"
                                ? "Matching"
                                : "Quiz"}
                        </label>
                      ),
                    )}
                  </fieldset>
                  <p className="muted">
                    Capture settings apply now. Explanation depth and study
                    preferences apply the next time you process or rebuild with
                    Go. Saved material won’t silently regenerate.
                  </p>
                  <label>
                    Rename session
                    <input
                      value={rename}
                      placeholder={session.title}
                      maxLength={140}
                      onChange={(e) => setRename(e.target.value)}
                    />
                  </label>
                  <div className="settings-actions">
                    <Button
                      disabled={!rename.trim()}
                      onClick={() => patch({ title: rename.trim() })}
                    >
                      Rename
                    </Button>
                    <Button onClick={() => patch({ status: "finished" })}>
                      Finish session
                    </Button>
                    <Button onClick={exported}>Export JSON</Button>
                    <Button
                      className="danger"
                      onClick={() => {
                        if (
                          confirm(
                            "Delete this session, its captures, and study progress locally and on the server? Offline deletion will be retried.",
                          )
                        ) {
                          void action("delete", { id: session.id });
                          setPreferences(false);
                        }
                      }}
                    >
                      Delete session
                    </Button>
                  </div>
                </>
              )
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </section>
        </div>
      )}
      <Toast message={toast} />
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
