import React, { useEffect, useRef, useState } from "react";
import type { Session, Prefs } from "../../../packages/contracts/src/index";
import { Button, IconButton, Segmented } from "./components";
import { Icon } from "./Icon";
import { goConversation } from "./go-chat-model";
import { exclusionLabel } from "./exclusion";
import {
  practicePreferences,
  sessionDefaults,
  sectionAt,
  type GoCompletion,
  type PracticePreferences,
} from "./settings-model";
const sections = [
  "Appearance",
  "Collection",
  "Practice",
  "Connection",
  "Session",
];
type Connection = { backend: string; agentUrl: string; token?: string };
export function Settings(p: {
  panel: boolean;
  session?: Session;
  connected: boolean;
  connectionError: boolean;
  backend: string;
  agentUrl: string;
  synced?: string | null;
  theme: string;
  mapList: boolean;
  state: {
    newSessionDefaults?: Prefs;
    shareSessionPreferences?: boolean;
    practicePreferences?: PracticePreferences;
    goCompletion?: GoCompletion;
    askOnSearch?: boolean;
    excluded?: Record<string, string[]>;
  };
  initialSection?: string;
  scroll: React.RefObject<number>;
  onClose: () => void;
  onTheme: (v: string) => void;
  onMapList: (v: boolean) => void;
  onPreference: (v: object) => Promise<unknown>;
  onSession: (v: object) => Promise<unknown>;
  onConnection: (v: Connection) => Promise<boolean>;
  onExport: (v: string) => void;
  onRebuild: () => void;
  onDelete: () => void;
  onUnexclude: (url: string) => void;
  onSearchOffer: (v: boolean) => void;
  goChat?: string;
  onGoChat?: (url: string) => Promise<unknown>;
}) {
  const [section, setSection] = useState(
      p.initialSection ??
        (!p.connected || p.connectionError ? "Connection" : "Appearance"),
    ),
    [editor, setEditor] = useState(!p.connected || p.connectionError),
    [replace, setReplace] = useState(!p.connected),
    [token, setToken] = useState(""),
    [backend, setBackend] = useState(p.backend),
    [agentUrl, setAgentUrl] = useState(p.agentUrl),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [manage, setManage] = useState(false),
    [chat, setChat] = useState(p.goChat ?? ""),
    [chatError, setChatError] = useState(""),
    [rename, setRename] = useState(p.session?.title ?? ""),
    [systemDark, setSystemDark] = useState(
      () => matchMedia("(prefers-color-scheme: dark)").matches,
    );
  const body = useRef<HTMLDivElement>(null),
    dialog = useRef<HTMLElement>(null),
    prevFocus = useRef<HTMLElement | null>(null);
  const prefs = practicePreferences(p.state.practicePreferences),
    settings =
      p.session?.settings ?? sessionDefaults(p.state.newSessionDefaults);
  function jump(id: string) {
    const el = body.current?.querySelector<HTMLElement>(
      `[data-section="${id}"]`,
    );
    if (el && body.current) {
      body.current.scrollTo({ top: el.offsetTop });
      setSection(id);
    }
  }
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)"),
      change = () => setSystemDark(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    prevFocus.current = document.activeElement as HTMLElement;
    dialog.current
      ?.querySelector<HTMLElement>('[aria-label="Close settings"]')
      ?.focus();
    if (p.initialSection) jump(p.initialSection);
    else if (!p.connected || p.connectionError) jump("Connection");
    else if (body.current) body.current.scrollTop = p.scroll.current;
    return () => queueMicrotask(() => prevFocus.current?.focus());
  }, []);
  useEffect(() => {
    if (p.connectionError) setEditor(true);
  }, [p.connectionError]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") p.onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const saveSettings = (value: Partial<Prefs>) =>
    p.session && !p.state.shareSessionPreferences
      ? p.onSession({ settings: { ...settings, ...value } })
      : p.onPreference({ newSessionDefaults: { ...settings, ...value } });
  const switchControl = (
    label: string,
    checked: boolean,
    onChange: (value: boolean) => void,
  ) => (
    <label className="settings-switch">
      <span>{label}</span>
      <input
        role="switch"
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
  let host = p.backend;
  try {
    host = new URL(p.backend).host;
  } catch {}
  const excludes = p.state.excluded?.[p.session?.id ?? ""] ?? [];
  return (
    <div
      className={p.panel ? "settings-panel" : "modal-backdrop"}
      onClick={(e) => {
        if (e.target === e.currentTarget && !p.panel) p.onClose();
      }}
    >
      <section
        ref={dialog}
        className="settings-dialog"
        role="dialog"
        aria-modal={!p.panel || undefined}
        aria-label="Settings"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            p.onClose();
          }
          if (e.key === "Tab") {
            const controls = [
              ...e.currentTarget.querySelectorAll<HTMLElement>(
                "button:not(:disabled),input:not(:disabled),select,textarea,[href]",
              ),
            ].filter((el) => el.tabIndex >= 0);
            const i = controls.indexOf(document.activeElement as HTMLElement);
            if (e.shiftKey && i <= 0) {
              e.preventDefault();
              controls.at(-1)?.focus();
            } else if (!e.shiftKey && i === controls.length - 1) {
              e.preventDefault();
              controls[0]?.focus();
            }
          }
        }}
      >
        <header className="settings-header">
          <div>
            <h1>Settings</h1>
            <p>
              Changes save as you make them.{" "}
              {p.state.shareSessionPreferences
                ? "Session preferences are shared across all rabbit holes."
                : "Session holds settings for this rabbit hole only."}
            </p>
          </div>
          <IconButton name="x" label="Close settings" onClick={p.onClose} />
        </header>
        <div className="settings-layout">
          <nav aria-label="Settings sections">
            {sections.map((id) => (
              <button
                key={id}
                aria-current={section === id ? "true" : undefined}
                onClick={() => jump(id)}
              >
                {id}
                {id === "Connection" && (
                  <i
                    className={`connection-dot ${p.connected && !p.connectionError ? "connected" : "attention"}`}
                  />
                )}
              </button>
            ))}
          </nav>
          <div
            className="settings-page"
            ref={body}
            onScroll={(e) => {
              p.scroll.current = e.currentTarget.scrollTop;
              setSection(
                sectionAt(
                  [
                    ...e.currentTarget.querySelectorAll<HTMLElement>(
                      "[data-section]",
                    ),
                  ].map((el) => ({
                    id: el.dataset.section!,
                    top: el.offsetTop,
                  })),
                  e.currentTarget.scrollTop,
                ),
              );
            }}
          >
            <section data-section="Appearance">
              <h2>Appearance</h2>
              <fieldset className="theme-tiles">
                <legend>Theme</legend>
                {[
                  ["light", "Light"],
                  ["dark", "Dark"],
                  ["system", "Follow system"],
                ].map(([value, label]) => (
                  <label key={value} className={`theme-tile ${value}`}>
                    <input
                      type="radio"
                      name="theme"
                      value={value}
                      checked={p.theme === value}
                      onChange={() => p.onTheme(value)}
                    />
                    <span className="theme-preview">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span>{label}</span>
                  </label>
                ))}
              </fieldset>
              <p className="muted">
                {p.theme === "system"
                  ? `Following your system. It's ${systemDark ? "dark" : "light"} right now.`
                  : `${p.theme === "dark" ? "Dark" : "Light"} theme.`}
              </p>
              <label>Open the map as</label>
              <Segmented
                label="Open the map as"
                value={p.mapList ? "list" : "map"}
                options={[
                  { value: "map", label: "Map" },
                  { value: "list", label: "List" },
                ]}
                onChange={(v) => p.onMapList(v === "list")}
              />
            </section>
            <section data-section="Collection">
              <h2>Collection</h2>
              {switchControl(
                "Offer to start a rabbit hole when I search Google",
                p.state.askOnSearch !== false,
                p.onSearchOffer,
              )}
              <div className="setting-row">
                <span>
                  Sites never saved <b>{excludes.length}</b>
                </span>
                <Button
                  quiet
                  onClick={() => setManage(!manage)}
                  aria-expanded={manage}
                >
                  Manage list
                </Button>
              </div>
              {manage && (
                <ul className="settings-exclusions">
                  {excludes.map((url) => (
                    <li key={url}>
                      <span>{exclusionLabel(url)}</span>
                      <Button quiet onClick={() => p.onUnexclude(url)}>
                        Remove
                      </Button>
                    </li>
                  ))}
                  {!excludes.length && <li>No sites excluded.</li>}
                </ul>
              )}
              <fieldset>
                <legend>When Go finishes your map</legend>
                {[
                  ["notify", "Tell me, with an Open map button"],
                  ["open", "Open the map automatically"],
                  ["quiet", "Stay quiet"],
                ].map(([value, label]) => (
                  <label className="settings-radio" key={value}>
                    <input
                      type="radio"
                      name="completion"
                      checked={(p.state.goCompletion ?? "notify") === value}
                      onChange={() =>
                        void p.onPreference({ goCompletion: value })
                      }
                    />
                    <span>
                      {label}
                      {value === "open" && (
                        <small>
                          Only while the workspace is already open and active.
                          Never takes focus from another tab.
                        </small>
                      )}
                      {value === "quiet" && (
                        <small>
                          The map updates and the Map tab gets a dot. Failures
                          are still shown.
                        </small>
                      )}
                    </span>
                  </label>
                ))}
              </fieldset>
              <p className="muted">
                Alt+Shift+R: side panel · Alt+Shift+M: workspace · Alt+Shift+H:
                save selection.{" "}
                <a
                  href="chrome://extensions/shortcuts"
                  onClick={(e) => {
                    e.preventDefault();
                    void chrome.tabs.create({
                      url: "chrome://extensions/shortcuts",
                    });
                  }}
                >
                  Change keyboard shortcuts
                </a>
              </p>
            </section>
            <section data-section="Practice">
              <h2>Practice</h2>
              <label>Questions per round</label>
              <Segmented
                label="Questions per round"
                value={String(prefs.roundSize)}
                options={[5, 8, 12].map((v) => ({
                  value: String(v),
                  label: String(v),
                }))}
                onChange={(v) =>
                  void p.onPreference({
                    practicePreferences: { ...prefs, roundSize: Number(v) },
                  })
                }
              />
              {switchControl(
                "Ask how sure I am before answering",
                prefs.confidence,
                (v) =>
                  void p.onPreference({
                    practicePreferences: { ...prefs, confidence: v },
                  }),
              )}
              {switchControl(
                "Offer harder questions when I'm ready",
                prefs.harderOffers,
                (v) =>
                  void p.onPreference({
                    practicePreferences: { ...prefs, harderOffers: v },
                  }),
              )}
            </section>
            <section data-section="Connection">
              <h2>Connection</h2>
              {!editor ? (
                <>
                  <div className="connection-card">
                    <Icon name="check" />
                    <div>
                      <h3>Connected to your workspace</h3>
                      <p>
                        {host} · Go agent linked · synced{" "}
                        {p.synced
                          ? Math.max(
                              0,
                              Math.floor(
                                (Date.now() - Date.parse(p.synced)) / 60000,
                              ),
                            )
                          : 0}{" "}
                        minutes ago
                      </p>
                      <Button
                        onClick={() => {
                          setEditor(true);
                          setReplace(false);
                          setToken("");
                        }}
                      >
                        Change connection…
                      </Button>
                    </div>
                  </div>
                  <p className="muted">
                    Your token is kept in this browser and is never shown here.
                  </p>
                </>
              ) : (
                <div className="connection-editor">
                  <label>
                    Backend URL
                    <input
                      value={backend}
                      onChange={(e) => setBackend(e.target.value)}
                    />
                  </label>
                  <label>
                    Go agent URL
                    <input
                      value={agentUrl}
                      onChange={(e) => setAgentUrl(e.target.value)}
                    />
                  </label>
                  {replace ? (
                    <label>
                      Personal bearer token
                      <input
                        autoFocus
                        type="password"
                        autoComplete="new-password"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                      />
                    </label>
                  ) : (
                    <div className="setting-row">
                      <span>Saved in this browser</span>
                      <Button quiet onClick={() => setReplace(true)}>
                        Replace
                      </Button>
                    </div>
                  )}
                  <p className="muted">
                    Your token is kept in this browser and is never shown here.
                  </p>
                  <Button
                    primary
                    disabled={saving || (replace && !token.trim())}
                    onClick={async () => {
                      setSaving(true);
                      setError("");
                      try {
                        if (
                          await p.onConnection({
                            backend,
                            agentUrl,
                            ...(replace ? { token } : {}),
                          })
                        ) {
                          setEditor(false);
                          setToken("");
                          setReplace(false);
                        } else
                          setError(
                            "Couldn’t save the connection. Check the URLs and browser permission.",
                          );
                      } catch {
                        setError("Couldn’t save the connection. Try again.");
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    Save connection
                  </Button>
                  <Button
                    quiet
                    onClick={() => {
                      setEditor(false);
                      setToken("");
                      setReplace(false);
                      setBackend(p.backend);
                      setAgentUrl(p.agentUrl);
                    }}
                  >
                    Cancel
                  </Button>
                  {error && (
                    <p role="alert" className="error">
                      {error}
                    </p>
                  )}
                </div>
              )}
            </section>
            <section data-section="Session">
              <h2>Session</h2>
              {switchControl(
                "Use these preferences for all rabbit holes",
                p.state.shareSessionPreferences ?? false,
                (shared) =>
                  void p.onPreference({
                    shareSessionPreferences: shared,
                    ...(shared ? { newSessionDefaults: settings } : {}),
                  }),
              )}
              <p className="muted">
                When enabled, depth, analogies, activities and capture
                preferences apply to existing and future rabbit holes.
              </p>
              {!p.session && (
                <aside className="defaults-banner">
                  Defaults for new rabbit holes. Nothing is open yet. These
                  apply to the next one you start.
                </aside>
              )}
              <label>
                Explanation depth
                <select
                  value={settings.depth}
                  onChange={(e) =>
                    void saveSettings({
                      depth: e.target.value as Prefs["depth"],
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
                  value={settings.analogy}
                  maxLength={300}
                  onChange={(e) =>
                    void saveSettings({ analogy: e.target.value })
                  }
                />
              </label>
              {switchControl(
                "Automatically capture readable article text",
                settings.articleCapture,
                (v) => void saveSettings({ articleCapture: v }),
              )}
              {switchControl(
                "Save text selections automatically",
                settings.autoHighlights,
                (v) => void saveSettings({ autoHighlights: v }),
              )}
              <fieldset>
                <legend>Study activities</legend>
                {(
                  [
                    ["quiz", "Quiz"],
                    ["matching", "Matching"],
                    ["connection", "Explain the connection"],
                    ["flashcard", "Flashcards"],
                  ] as const
                ).map(([value, label]) => (
                  <label className="check" key={value}>
                    <input
                      type="checkbox"
                      checked={settings.activities.includes(value)}
                      onChange={(e) => {
                        const activities = e.target.checked
                          ? [...settings.activities, value]
                          : settings.activities.filter((a) => a !== value);
                        if (activities.length)
                          void saveSettings({ activities });
                      }}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              {p.session && (
                <>
                  <label>
                    Go conversation for this rabbit hole
                    <input
                      type="url"
                      value={chat}
                      placeholder="https://go.superhuman.com/tasks/…"
                      onChange={(e) => {
                        setChat(e.target.value);
                        setChatError("");
                      }}
                      onBlur={() => {
                        const value = chat.trim();
                        if (value && !goConversation(value, p.agentUrl)) {
                          setChatError(
                            "Use a conversation URL from your configured Go host (/tasks/<chat-id>).",
                          );
                          return;
                        }
                        if (value !== (p.goChat ?? ""))
                          void p.onGoChat?.(value);
                      }}
                    />
                  </label>
                  <p className="muted">
                    Requests reuse this conversation. RabbitHole remembers it
                    automatically when a chat starts; paste an existing
                    conversation here to link it.
                  </p>
                  {chatError && (
                    <p className="error" role="alert">
                      {chatError}
                    </p>
                  )}
                  <label>
                    Rename session
                    <input
                      value={rename}
                      maxLength={140}
                      onChange={(e) => setRename(e.target.value)}
                    />
                  </label>
                  <div className="settings-actions">
                    <Button
                      disabled={!rename.trim()}
                      onClick={() => void p.onSession({ title: rename.trim() })}
                    >
                      Rename
                    </Button>
                    <Button
                      onClick={() => void p.onSession({ status: "finished" })}
                    >
                      Finish session
                    </Button>
                    <Button onClick={p.onRebuild}>Rebuild map with Go</Button>
                  </div>
                  <h3>Exports</h3>
                  <div className="settings-actions">
                    {[
                      ["json", "JSON"],
                      ["anki", "Anki"],
                      ["quizlet", "Quizlet"],
                      ["markdown", "Markdown"],
                    ].map(([value, label]) => (
                      <Button key={value} onClick={() => p.onExport(value)}>
                        {label}
                      </Button>
                    ))}
                    <Button className="danger" onClick={p.onDelete}>
                      Delete session
                    </Button>
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      </section>
    </div>
  );
}
