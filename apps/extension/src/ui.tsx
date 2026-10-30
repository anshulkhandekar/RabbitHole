import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import "@xyflow/react/dist/style.css";
import "./styles/tokens.css";
import "./styles/fonts.css";
import "./styles/components.css";
import "./ui.css";
import type { Session, Attempt } from "../../../packages/contracts/src/index";
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
import { Trail, Excluded, type CaptureAction } from "./Trail";
import { toAnkiCsv, toMarkdown, toQuizlet } from "./export-model";
import { MapView, type Selection } from "./MapView";
import { shortTitle } from "./summary-model";
import { Summary } from "./Summary";
import { ReadyNote } from "./ReadyNote";
import {
  savedReceipt,
  handoffPending,
  failedHandoffNote,
} from "./handoff-model";
import { Settings } from "./Settings";
import { Practice, PracticeLoading } from "./Practice";
import { domain, time, recentSessions, startedDate } from "./ui-model";
import type { Handoff } from "./handoff";
const request = (type: string, extra: any = {}) =>
  chrome.runtime.sendMessage({ type, ...extra });
type TabContext = {
  tabId?: number;
  url: string;
  title: string;
  regular: boolean;
  canStart: boolean;
  included: boolean;
  count: number;
  excluded: boolean;
  askOnSearch?: boolean;
};
function App() {
  const [state, setState] = useState<any>(null),
    [config, setConfig] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [context, setContext] = useState<TabContext | null>(null),
    [online, setOnline] = useState(navigator.onLine),
    [narrow, setNarrow] = useState(innerWidth < 600),
    [view, setView] = useState(
      ["summary", "map", "practice", "sources"].includes(location.hash.slice(1))
        ? location.hash.slice(1)
        : "map",
    ),
    [selected, setSelected] = useState<Selection>(null),
    [list, setList] = useState(false),
    [mapRequest, setMapRequest] = useState<{
      memory?: boolean;
      walk?: boolean;
      brighten?: string[];
    }>({}),
    [menu, setMenu] = useState(false),
    [creating, setCreating] = useState(false),
    [curiosity, setCuriosity] = useState(""),
    [familiarity, setFamiliarity] = useState(""),
    [picked, setPicked] = useState<Set<string>>(new Set()),
    [settings, setSettings] = useState(
      new URLSearchParams(location.search).has("settings"),
    ),
    [preferences, setPreferences] = useState(false),
    [synced, setSynced] = useState<string | null>(null),
    [toast, setToast] = useState(""),
    [practiceEdge, setPracticeEdge] = useState<string | undefined>(),
    [theme, setTheme] = useState("system");
  const settingsScroll = useRef(0);
  const [settingsSection, setSettingsSection] = useState<string | undefined>();
  const handoff = state?.handoffs?.[state.active] as Handoff | undefined;
  const waiting = handoffPending(handoff);
  const [readyNote, setReadyNote] = useState(false);
  const notified = useRef("");
  const panelWindow = useRef<number | undefined>(undefined);
  useEffect(() => {
    void chrome.tabs.getCurrent().then((tab) => {
      panelWindow.current = tab?.windowId;
    });
  }, []);
  function openPanel() {
    // Call Chrome directly inside the click. Messaging/storage awaits lose the gesture.
    const windowId = panelWindow.current;
    if (windowId === undefined) {
      setError("The browser window is still loading. Try again.");
      return;
    }
    void chrome.sidePanel
      .open({ windowId })
      .then(() => setError(""))
      .catch((error) => setError(String(error.message ?? error)));
  }
  const mapDot =
    (state?.mapSeen?.[state.active] ?? 0) <
    (state?.mapUpdated?.[state.active] ?? handoff?.savedVersion ?? 0);
  const noticeVersion =
    handoff?.savedVersion ??
    state?.sessions[handoff?.sessionId ?? ""]?.version ??
    0;
  const noticeAcknowledged =
    Math.max(
      state?.mapSeen?.[handoff?.sessionId ?? ""] ?? 0,
      state?.mapDismissed?.[handoff?.sessionId ?? ""] ?? 0,
    ) >= noticeVersion;
  useEffect(() => {
    if (
      handoff?.status !== "saved" ||
      noticeAcknowledged ||
      state.goCompletion === "quiet"
    ) {
      setReadyNote(false);
      return;
    }
    const key = `${handoff.sessionId}:${handoff.savedAt}:${noticeVersion}`;
    if (notified.current === key) return;
    notified.current = key;
    const mode = state.goCompletion ?? "notify";
    let current = true;
    void chrome.tabs.getCurrent().then((tab) => {
      if (!current) return;
      if (
        mode === "open" &&
        !panel &&
        tab?.active &&
        document.visibilityState === "visible"
      ) {
        setView("map");
        setReadyNote(false);
        void action("map-seen", {
          id: handoff.sessionId,
          version: noticeVersion,
        });
      } else setReadyNote(true);
    });
    return () => {
      current = false;
    };
  }, [
    handoff?.status,
    handoff?.sessionId,
    handoff?.savedAt,
    noticeVersion,
    noticeAcknowledged,
    state?.goCompletion,
  ]);
  useEffect(() => {
    setReadyNote(false);
  }, [state?.active]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => {
      if (!(e.target as Element).closest?.(".switcher")) setMenu(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("focusin", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("focusin", close);
    };
  }, [menu]);
  const panel =
    new URLSearchParams(location.search).has("panel") ||
    (!new URLSearchParams(location.search).has("workspace") && narrow);
  const syncing = useRef(false),
    mounted = useRef(true),
    trailScroll = useRef<HTMLDivElement>(null),
    firstTrail = useRef(true);
  const showToast = useCallback((text: string) => setToast(text), []);
  const apply = useCallback((value: any) => {
    if (!value?.sessions) return;
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
    void chrome.storage.local.get(["uiTheme", "mapList"]).then((v) => {
      setTheme(typeof v.uiTheme === "string" ? v.uiTheme : "system");
      setList(v.mapList === true);
    });
    const change = (changes: any) => {
      if (changes.state) {
        apply(changes.state.newValue);
        void updateContext();
      }
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
    session?.captures.filter(
      (c) =>
        !session.processed.includes(c.id) && !session.hidden?.includes(c.id),
    ).length ?? 0;
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
    setCreating(false);
    setPicked(new Set());
    firstTrail.current = true;
  }, [session?.id]);
  useEffect(() => {
    if (!panel && session && view === "map")
      void action("map-seen", { id: session.id, version: session.version });
  }, [view, session?.id, session?.version, panel]);
  const patch = (patch: any) => action("patch", { id: session!.id, patch });
  async function grant() {
    return chrome.permissions.request({
      origins: ["http://*/*", "https://*/*"],
    });
  }
  async function start() {
    if (!context?.canStart) {
      setError("Open a web page to start saving.");
      return;
    }
    if (await grant()) {
      const value = await action("start", {
        title: curiosity.trim(),
        goal: curiosity.trim() || undefined,
        familiarity: familiarity || undefined,
      });
      if (value?.active) {
        setCreating(false);
        setCuriosity("");
        setFamiliarity("");
      }
    } else
      setError(
        "Website access is needed to collect an enabled research trail.",
      );
  }
  function selectSession(id: string) {
    setMenu(false);
    setCreating(false);
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
  async function sendToGo(custom?: string, intent = "incremental") {
    if (!session) return;
    if (waiting) return;
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
      `Process RabbitHole session ${session.id}. Retrieve the current session and ALL pending captures using RabbitHole tools. Follow every nextOffset page before constructing one complete merged analysis in this run. There is no six-capture processing cap. Connect ideas across the entire inspected trail through supported mechanisms, dependencies, trade-offs and contrasting conditions. Preserve genuine branches and cross-topic connections; do not force a chronological chain or invent relationships. Use each capture's short ref exactly in all captureIds, evidence[].captureId and processedCaptureIds; copy expectedVersion and accumulate all inspected pending refs from processingDefaults across every page. Keep canonical IDs already in the existing analysis. Preserve all visible citations and exact quotes on unchanged questions. Only an explicit rebuild may intentionally replace their evidence; explain any correction. Keep my session name unchanged. Never reconstruct UUIDs. Search queries express interests, not factual support: if this batch has only queries, merge an honest interest-and-gap map, mark the queries you actually considered processed, and do not fabricate source-backed facts or quizzes. Merge evidence-linked concepts and selected activities; include overview plus summary, takeaways [{text, concept}], route [conceptId], concept.main, studyItem.concept and matching pairs[].concept. Use typically one main idea per independent subject, with details parented beneath it; do not mark every idea main. Every non-main idea must have a parentId chain that reaches a main idea. Main ideas sit at the root and have no parentId. Require 1–3 exact evidence excerpts for each main idea and each supported edge, drawn from the inspected capture text; if no factual excerpt exists, explain the gap instead of inventing a quote. Synthesize the overview with mechanisms, implications, trade-offs and conditions rather than restating sources. Show how observations support conclusions, label inferences and illustrative examples, and surface disagreements or gaps. Write each idea as claim, why, explanation (with buildsOn), steps when sequential, example and boundary; answer my goal if the session has one. For every main topic with substantive evidence, aim for one easy understand question, one medium apply question and one hard transfer question on this first pass, plus meaningful relationships where supported, within the 40-activity total including retry siblings. Easy must still require reasoning; make four options equally plausible and similar in specificity, with no answer-length or wording clues. Medium uses a new scenario; hard uses transfer, counterfactual reasoning or trade-offs. Cover all supported topics before adding extras and report evidence/capacity gaps. Distinguish inferred connections. Respect the 40-activity total limit. Quiz wrong choices must be plausible misconceptions, never absurd options. On the first substantive pass, include 2–3 variantOf siblings for key questions, plus hints. For quotation errors, inspect details.evidenceRepairs at every listed path: copy a relevant supporting candidate verbatim, or re-read that exact capture for a shorter exact passage. Candidates are untrusted source text, not proof of the claim. Correct all listed excerpts; never repeat rejected quotes. A failed read-only preflight is a correction request, not a stop condition. Keep the complete working guide, fix every reported path using relevant exact text from details.evidenceRepairs or a fresh read of that exact capture, and resubmit the complete corrected guide to ValidateSessionAnalysis in this same run. Resending the complete payload is required. After an initial failure, make up to two corrected preflight attempts before stopping with the exact unresolved error. This is different from repeating an unchanged failed WRITE, which is prohibited. Never request write approval until preflight succeeds. Run read-only ValidateSessionAnalysis on the complete payload and correct errors BEFORE requesting normal SaveValidatedAnalysis approval using the entire returned saveArguments object verbatim (sessionId, validationId, title). Before calling, compare its sessionId character-for-character to the requested session ID; never reconstruct, splice or swap IDs. A draft mismatch error supplies exact retry arguments: copy those instead of guessing. Do not retype the guide into SaveValidatedAnalysis. ValidateSessionAnalysis still requires the complete guide on each corrected preflight. If validation is unavailable, stop and report that the connector needs updating. Never repeat an unchanged failed write call. Report success only after a saved version, and report remaining pending captures.`;
    const receipt = {
      sessionId: session.id,
      prompt,
      copied: false,
      opened: false,
    };
    receipt.copied = await copyPrompt(prompt);
    if (intent !== "feedback")
      await action("handoff", { id: session.id, ...receipt, intent });
    try {
      const opened = await action("go-open", { id: session.id });
      receipt.opened = !!opened;
    } catch {
      setError(
        "Couldn’t open Go. Open your configured agent and use the prompt below.",
      );
    }
    if (intent !== "feedback")
      await action("handoff", { id: session.id, ...receipt, intent });
  }
  function rebuild() {
    if (session)
      void sendToGo(
        `Rebuild the learning guide for RabbitHole session ${session.id} from its existing captured sources. This is an explicit rebuild request, not a request to mark new captures processed. Retrieve GetSession and the relevant existing evidence texts using captureIds (up to 24 sources this run); preserve unreviewed material and stable IDs. Save the complete analysis using intent "rebuild", expectedVersion from the read and processedCaptureIds [] if no new captures were inspected. Add summary, takeaways [{text, concept}], route [conceptId], concept.main, studyItem.concept and matching pairs[].concept, plus a source-grounded overview, rootConceptId and reading route, parentId hierarchy, useful takeaways and exact evidence excerpts. Write each idea as claim, why, explanation (with buildsOn), steps when sequential, example and boundary, and add nextSearch to gaps. Drop any sources listed in removedCaptureIds. Synthesize the summary through mechanisms, implications, trade-offs and conditions; show the reasoning connecting sources, label inferences and examples, and acknowledge gaps. Across evidence-supported main topics, aim for one easy understand question, one medium apply question and one hard transfer question per topic within the 40-activity total, plus retry siblings and matching if selected. Easy questions must still require reasoning. For quizzes, give four parallel, equally plausible options reflecting specific misconceptions, with no absurd distractors or answer-length clues, and explain each choice. Replace materially changed questions with new study IDs, preserve unchanged IDs and attempt history, and report coverage limited by evidence or capacity. Clearly state which sources you reviewed. A failed read-only preflight is a correction request, not a stop condition. Keep the complete working guide, fix every reported path using relevant exact text from details.evidenceRepairs or a fresh read of that exact capture, and resubmit the complete corrected guide to ValidateSessionAnalysis in this same run. Resending the complete payload is required. After an initial failure, make up to two corrected preflight attempts before stopping with the exact unresolved error. This is different from repeating an unchanged failed WRITE, which is prohibited. Never request write approval until preflight succeeds. Run read-only ValidateSessionAnalysis and correct errors then request SaveValidatedAnalysis approval using the returned saveArguments. Do not retype the guide into SaveValidatedAnalysis. ValidateSessionAnalysis still requires the complete guide on each corrected preflight. Stop if the validation tool is unavailable; do not stop merely because its first read-only validation reports a correctable error. Never repeat an unchanged failed write.`,
        "rebuild",
      );
  }
  function download(text: string, name: string, type: string) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const fileName = (s: Session) =>
    (s.short ?? s.title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "rabbithole";
  function exported(format = "json") {
    if (!session) return;
    if (format !== "json" && !session.analysis) {
      showToast("Send your finds to Go first. There’s nothing to export yet.");
      return;
    }
    if (format === "anki")
      download(toAnkiCsv(session), `${fileName(session)}-anki.csv`, "text/csv");
    else if (format === "markdown")
      download(toMarkdown(session), `${fileName(session)}.md`, "text/markdown");
    else if (format === "quizlet")
      void navigator.clipboard
        .writeText(toQuizlet(session))
        .then(() =>
          showToast("Copied. In Quizlet, choose Import and paste it."),
        )
        .catch(() => setError("Couldn’t copy to the clipboard."));
    else
      download(
        JSON.stringify(session, null, 2),
        `rabbithole-${session.id}.json`,
        "application/json",
      );
  }
  async function captureAction(
    kind: CaptureAction,
    c: Session["captures"][number],
  ) {
    if (!session) return;
    if (kind === "delete") {
      if (
        !confirm(
          "Delete this find from RabbitHole, on this device and on the server? This can’t be undone. Hide it instead if you might want it back.",
        )
      )
        return;
      if (await action("capture-delete", { id: session.id, captureId: c.id }))
        showToast("Find deleted");
    } else if (kind === "hide" || kind === "unhide") {
      if (
        await action("capture-hide", {
          id: session.id,
          captureId: c.id,
          hidden: kind === "hide",
        })
      )
        showToast(
          kind === "hide"
            ? "Hidden from your map. Show it again from its ⋯ menu."
            : "Back on your map",
        );
    } else if (kind === "exclude" || kind === "exclude-site") {
      if (await action(kind, { url: c.url }))
        showToast(
          kind === "exclude"
            ? "This page won’t be saved again."
            : `${domain(c.url)} won’t be saved again.`,
        );
    } else
      await action("capture-tag", {
        id: session.id,
        captureId: c.id,
        tag: kind === "untag" ? "none" : kind,
      });
  }
  async function bulk(kind: "hide" | "delete") {
    if (!session || !picked.size) return;
    if (
      kind === "delete" &&
      !confirm(
        `Delete ${picked.size} ${picked.size === 1 ? "find" : "finds"} on this device and on the server? This can’t be undone.`,
      )
    )
      return;
    for (const captureId of picked)
      await action(kind === "delete" ? "capture-delete" : "capture-hide", {
        id: session.id,
        captureId,
        hidden: true,
      });
    showToast(
      `${picked.size} ${picked.size === 1 ? "find" : "finds"} ${kind === "delete" ? "deleted" : "hidden from your map"}`,
    );
    setPicked(new Set());
  }
  function explainAgain(id: string, style: string) {
    if (!session?.analysis) return;
    const c = session.analysis.concepts.find((c) => c.id === id);
    if (!c) return;
    const how =
      style === "simpler"
        ? "in plainer words, as if I'm new to the field: shorter sentences, no undefined terms"
        : style === "steps"
          ? "as 2 to 5 ordered steps, where each step follows from the one before"
          : style === "analogy"
            ? `with one analogy that maps onto the mechanism (my analogy preference: ${JSON.stringify(session.settings.analogy)}), and say where the analogy stops fitting`
            : "with one concrete worked example using specific numbers or cases";
    void sendToGo(
      `Rebuild one idea in RabbitHole session ${session.id}: concept ${c.id} ("${c.label}"). I didn't follow its explanation. Explain it again ${how}. Retrieve GetSession and that concept's evidence via captureIds. Start with a one-sentence claim, then why the idea is needed, then the mechanism. Keep every other concept, edge, study item and ID unchanged. Save with intent "rebuild" and processedCaptureIds [] after ValidateSessionAnalysis, using SaveValidatedAnalysis with the returned saveArguments. Do not retype the guide into SaveValidatedAnalysis; corrected ValidateSessionAnalysis calls still require it in full. Never invent quotations.`,
      "rebuild",
    );
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
      return (
        <div className="tabctx">
          Your session is ready. Open a research page, then choose Include tab
          in RabbitHole’s side panel to start saving.
        </div>
      );
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
            {panel
              ? (session?.title ?? "Your rabbit holes")
              : session
                ? shortTitle(session)
                : "Your rabbit holes"}
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
                e.stopPropagation();
                setMenu(false);
                document.querySelector<HTMLElement>(".switcher-btn")?.focus();
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
            <div
              className="session-previews"
              role="group"
              aria-label="Recent rabbit holes"
            >
              {recentSessions(sessions, state.sessionLastUsed).map((s) => (
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
                  <span className="d">
                    <time dateTime={s.createdAt}>
                      Started {startedDate(s.createdAt)}
                    </time>
                    {" · "}
                    {s.captures.length} deep
                  </span>
                  {!panel && (
                    <span className="depthbar">
                      {Array.from(
                        { length: Math.min(12, s.captures.length) },
                        (_, i) => (
                          <i key={i} />
                        ),
                      )}
                    </span>
                  )}
                </button>
              ))}
            </div>
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
        {state.error && <span className="sync-error">{state.error}</span>}
      </div>
    );
  }
  function HandoffPanel() {
    if (
      !handoff ||
      handoff.sessionId !== session?.id ||
      handoff.status === "saved"
    )
      return null;
    if (handoff.status === "failed")
      return (
        <div className="handoff-failed" role="alert">
          <Icon name="alert" />
          <div>
            <strong>Go couldn't save your map</strong>
            <p>
              {handoff.reason ?? "The save could not be completed."}{" "}
              {failedHandoffNote(handoff, session!)}
            </p>
            <Button disabled={pending === 0} onClick={() => void sendToGo()}>
              Send again
            </Button>
            <Button
              quiet
              onClick={() =>
                void copyPrompt(
                  JSON.stringify(
                    {
                      sessionId: handoff.sessionId,
                      startedAt: handoff.startedAt,
                      reason: handoff.reason,
                      captureIds: handoff.captureIds,
                    },
                    null,
                    2,
                  ),
                )
              }
            >
              Copy details
            </Button>
          </div>
        </div>
      );
    return (
      <div className="handoff-panel" role="status">
        <strong>Waiting for Go…</strong>
        <p>
          {handoff.captureIds.length}{" "}
          {handoff.captureIds.length === 1 ? "find" : "finds"} sent{" "}
          {Math.max(
            0,
            Math.floor((Date.now() - Date.parse(handoff.startedAt)) / 60000),
          )}{" "}
          minutes ago
        </p>
        <div className="handoff-indeterminate" />
        {handoff.status === "stalled" && (
          <p>No answer from Go for 10 minutes. It may still be working.</p>
        )}
        <Button
          quiet
          onClick={() => void action("go-open", { id: session!.id })}
        >
          {handoff.status === "stalled" ? "Check Go" : "Open Go tab"}
        </Button>
        <Button
          quiet
          onClick={() => void action("handoff-cancel", { id: session!.id })}
        >
          Cancel
        </Button>
        <details>
          <summary>Prompt copied — paste it in Go</summary>
          <textarea
            aria-label="Go processing prompt"
            readOnly
            value={handoff.prompt}
          />
          <Button quiet onClick={() => void copyPrompt(handoff.prompt)}>
            Copy prompt
          </Button>
        </details>
      </div>
    );
  }
  function Ready() {
    return readyNote &&
      handoff?.status === "saved" &&
      !noticeAcknowledged &&
      (panel || view !== "map") ? (
      <ReadyNote
        key={handoff.savedAt}
        handoff={handoff}
        onOpen={() => {
          setReadyNote(false);
          void action("map-seen", {
            id: handoff.sessionId,
            version: noticeVersion,
          });
          openWorkspace("map");
        }}
        onDismiss={() => {
          setReadyNote(false);
          void action("map-dismiss", {
            id: handoff.sessionId,
            version: noticeVersion,
          });
        }}
      />
    ) : null;
  }
  function GoFooter() {
    const hand =
      handoff?.sessionId === session?.id && handoff?.status !== "saved";
    return (
      <footer className="p-foot">
        {hand ? (
          HandoffPanel()
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
        <label htmlFor="curiosity">What are you trying to figure out?</label>
        <input
          id="curiosity"
          value={curiosity}
          maxLength={140}
          onChange={(e) => setCuriosity(e.target.value)}
          placeholder="Optional. Go aims the summary at this question."
        />
        <div
          className="familiar-chips"
          role="group"
          aria-label="How much do you know already?"
        >
          {[
            ["new", "New to this"],
            ["some", "Know some"],
            ["solid", "Know it well"],
          ].map(([value, name]) => (
            <button
              key={value}
              aria-pressed={familiarity === value}
              onClick={() => setFamiliarity(familiarity === value ? "" : value)}
            >
              {name}
            </button>
          ))}
        </div>
        <Button
          primary
          className="btn-lg"
          disabled={busy || !context?.canStart}
          onClick={start}
        >
          Start collecting
        </Button>
        <p className="fine">Nothing is saved until you start.</p>
        {!context?.regular && context?.canStart && (
          <p className="contextual-note">
            Start your session here. Then open a research page and choose
            Include tab in RabbitHole’s side panel to start saving.
          </p>
        )}
        {!context?.canStart && (
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
  if ((!state || !config) && view === "practice" && !panel)
    return <PracticeLoading onRetry={() => void action("state")} />;
  if (!state || !config)
    return (
      <main className="loading" role="status">
        Opening your trail…
      </main>
    );
  return (
    <div className={panel ? "panel" : "ws v2"}>
      <div
        className="app-surface"
        inert={settings || preferences}
        hidden={panel && (settings || preferences)}
      >
        <header className={panel ? "p-head" : "topbar"}>
          <Brand
            onClick={() => {
              setSettings(false);
              setCreating(false);
            }}
          />
          {!panel && sessions.length > 0 && (!session || creating) && (
            <div className="tb-title">{SessionSwitcher()}</div>
          )}
          {!panel && session && !creating && (
            <>
              <div className="tb-title">
                {SessionSwitcher()}
                <button
                  className="capture-btn"
                  disabled={busy}
                  onClick={() =>
                    patch({
                      status: session.status === "active" ? "paused" : "active",
                    })
                  }
                >
                  <LiveStatus active={session.status === "active"} />
                  {session.status === "active" ? "Collecting" : "Paused"}
                  <span className="act">
                    <Icon
                      name={session.status === "active" ? "pause" : "play"}
                      size={14}
                    />
                    {session.status === "active" ? "Pause" : "Resume"}
                  </span>
                </button>
              </div>
              <Segmented
                label="Views"
                value={view}
                options={[
                  { value: "summary", label: "Summary" },
                  { value: "map", label: "Map", attention: mapDot },
                  { value: "practice", label: "Practice" },
                  {
                    value: "sources",
                    label: "Sources",
                    count: session.captures.length,
                  },
                ]}
                onChange={(next) => {
                  setView(next);
                  if (next === "map" && session) {
                    setReadyNote(false);
                    void action("map-seen", {
                      id: session.id,
                      version: session.version,
                    });
                  }
                }}
              />
            </>
          )}
          <div className="tb-actions">
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
                aria-label={
                  waiting
                    ? "Waiting for Go"
                    : `Send to Go, ${pending} new finds`
                }
                disabled={
                  !online ||
                  pending === 0 ||
                  busy ||
                  !state.config.token ||
                  waiting
                }
                onClick={() => void sendToGo()}
              >
                <span className="label">
                  {waiting
                    ? handoff?.status === "stalled"
                      ? "Check Go"
                      : "Waiting for Go…"
                    : "Send to Go"}
                </span>
                {!waiting && pending > 0 && <Chip>{pending} new</Chip>}
              </Button>
            )}
            {!panel && handoff?.status === "saved" && (
              <span className="map-saved">
                <Icon name="check" size={14} /> {savedReceipt(handoff)}
              </span>
            )}
            {panel ? (
              <IconButton
                name="workspace"
                label="Open full workspace"
                onClick={() => openWorkspace()}
              />
            ) : (
              <IconButton
                name="panel"
                label="Back to side panel"
                onClick={openPanel}
              />
            )}
            <IconButton
              name="settings"
              label="Settings"
              aria-pressed={settings || preferences}
              onClick={() => {
                setSettingsSection(undefined);
                setSettings(true);
              }}
            />
          </div>
        </header>
        {panel ? (
          !session || creating ? (
            <>
              {sessions.length > 0 && SessionSwitcher()}
              {Welcome()}
            </>
          ) : (
            <>
              {SessionSwitcher()}
              {CaptureRow()}
              {Ready()}
              <div className="p-scroll" ref={trailScroll}>
                <div className="trail-head">
                  <h2>Your trail</h2>
                  <span className="depth">
                    <b>{session.captures.length}</b> deep
                  </span>
                </div>
                <p className="surface">
                  Started {startedDate(session.createdAt)}
                </p>
                <Trail
                  session={session}
                  queue={state.queue}
                  onAction={(kind, c) => void captureAction(kind, c)}
                />
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
            <main className="main">
              {!session || creating ? (
                Welcome()
              ) : (
                <>
                  {session.status === "active" &&
                    session.captures.length === 0 &&
                    context?.count === 0 && (
                      <div className="tabctx" role="status">
                        Search Google to start saving automatically, or open a
                        research page and choose Include tab in RabbitHole’s
                        side panel.
                      </div>
                    )}
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
                  {Ready()}
                  <div className="view">
                    {view === "summary" ? (
                      <Summary
                        session={session}
                        onMap={(id, memory) => {
                          setMapRequest({ memory });
                          setSelected(id ? { kind: "concept", id } : null);
                          setView("map");
                        }}
                        onPractice={() => {
                          setPracticeEdge("quick");
                          setView("practice");
                        }}
                        onExport={exported}
                        onWalk={() => {
                          setMapRequest({ walk: true });
                          setView("map");
                        }}
                      />
                    ) : view === "map" ? (
                      <>
                        <div className="map-view-toolbar">
                          <Segmented
                            label="Map display"
                            value={list ? "list" : "map"}
                            options={[
                              { value: "map", label: "Map", icon: "map" },
                              { value: "list", label: "List", icon: "list" },
                            ]}
                            onChange={(v) => setList(v === "list")}
                          />
                        </div>
                        <MapView
                          key={session.id}
                          session={session}
                          list={list}
                          mapRequest={mapRequest}
                          selected={selected}
                          onSelect={setSelected}
                          onRebuild={rebuild}
                          onExplain={explainAgain}
                          onPractice={(id) => {
                            setPracticeEdge(id || undefined);
                            setView("practice");
                          }}
                        />
                      </>
                    ) : view === "practice" ? (
                      <Practice
                        key={`${session.id}:${session.version}:${practiceEdge ?? ""}`}
                        session={session}
                        edgeId={practiceEdge}
                        preferences={state.practicePreferences}
                        connected={!!state.config.token}
                        onSend={() => void sendToGo()}
                        onGenerate={(text) => void sendToGo(text, "rebuild")}
                        onConnect={() => {
                          setSettingsSection("Connection");
                          setSettings(true);
                        }}
                        onPracticeState={(practice) =>
                          void action("practice-state", {
                            id: session.id,
                            practice,
                          })
                        }
                        onMap={(brighten) => {
                          setMapRequest({ memory: true, brighten });
                          setSelected(null);
                          setView("map");
                        }}
                        onReview={async (a: Attempt) =>
                          !!(await action("review", {
                            id: session.id,
                            attempt: a,
                          }))
                        }
                        onFeedback={(text) => void sendToGo(text, "feedback")}
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
                          {picked.size > 0 && (
                            <div className="bulk-bar" role="toolbar">
                              <span className="grow">
                                {picked.size} selected
                              </span>
                              <Button onClick={() => void bulk("hide")}>
                                Hide from map
                              </Button>
                              <Button
                                className="danger"
                                onClick={() => void bulk("delete")}
                              >
                                Delete
                              </Button>
                              <Button
                                quiet
                                onClick={() => setPicked(new Set())}
                              >
                                Clear
                              </Button>
                            </div>
                          )}
                          <Trail
                            session={session}
                            queue={state.queue}
                            wide
                            onAction={(kind, c) => void captureAction(kind, c)}
                            selected={picked}
                            onSelect={(id, on) => {
                              const next = new Set(picked);
                              if (on) next.add(id);
                              else next.delete(id);
                              setPicked(next);
                            }}
                          />
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
        <Settings
          panel={panel}
          session={session}
          connected={!!state.config.token}
          connectionError={!!state.error}
          backend={state.config.backend}
          agentUrl={state.config.agentUrl}
          synced={synced}
          theme={theme}
          mapList={list}
          state={state}
          scroll={settingsScroll}
          initialSection={preferences ? "Session" : settingsSection}
          onClose={() => {
            setSettings(false);
            setPreferences(false);
            setSettingsSection(undefined);
          }}
          onTheme={(v) => {
            setTheme(v);
            void chrome.storage.local.set({ uiTheme: v });
          }}
          onMapList={(v) => {
            setList(v);
            void chrome.storage.local.set({ mapList: v });
          }}
          onPreference={(v) => action("preferences", v)}
          onSession={patch}
          onConnection={async (config) => {
            if (!(await grant())) return false;
            const value = await action("config", { config });
            if (value) {
              setConfig(value.config);
              showToast("Connection saved");
              void sync();
              return true;
            }
            return false;
          }}
          goChat={state.goChats?.[session?.id ?? ""]?.url}
          onGoChat={(url) => action("go-chat", { id: session!.id, url })}
          onSearchOffer={(value) => void action("ask-on-search", { value })}
          onUnexclude={(url) => void action("unexclude", { url })}
          onExport={exported}
          onRebuild={() => {
            rebuild();
            setSettings(false);
            setPreferences(false);
          }}
          onDelete={() => {
            if (
              session &&
              confirm(
                "Delete this session, its captures, and study progress locally and on the server? Offline deletion will be retried.",
              )
            ) {
              void action("delete", { id: session.id });
              setPreferences(false);
              setSettings(false);
            }
          }}
        />
      )}
      <Toast message={toast} />
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
