import React, {
  useState,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
} from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  BaseEdge,
  useViewport,
  useReactFlow,
  ViewportPortal,
  MarkerType,
  useNodesInitialized,
  useNodesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import type { Session } from "../../../packages/contracts/src/index";
import {
  edgeCrossings,
  mergeEdges,
  layoutIdeas,
  cachedLayoutIdeas,
  connectionGeometry,
  placeLabels,
  type IdeaPosition,
} from "./map-layout";
import { connectionStrength } from "./connection-model";
import { deriveMemory } from "./practice-model";
import { routeIds } from "./summary-model";
import { IdeaDrawer } from "./IdeaDrawer";
import { sourceVerb, domain } from "./ui-model";
import { Button, IconButton } from "./components";
export type Selection = { kind: "concept" | "edge"; id: string } | null;
const duration = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 480;
function IdeaNode({ data }: any) {
  return (
    <div
      className={`idea-card ${data.main ? "main" : ""} ${data.selected ? "selected" : ""} ${data.dim ? "dim" : ""} ${data.neighbor ? "neighbor" : ""} ${data.match ? "match" : ""} ${data.visited ? "visited" : ""} ${data.memory ? "memory-" + data.memory : ""} ${data.ready ? "ready" : ""} ${data.bump ? "bump" : ""}`}
      style={{ "--row": data.row } as React.CSSProperties}
    >
      {data.memory && <i className="memory-dot" />}
      <Handle type="target" position={Position.Top} />
      {data.main && <small>Main idea</small>}
      <span>{data.label}</span>
      {data.gap && <i className="gapdot" />}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
function Connection({ id, data, markerEnd, markerStart }: any) {
  const group = useRef<SVGGElement>(null);
  const coordinates = (String(data.path).match(/-?\d+(?:\.\d+)?/g) ?? []).map(
      Number,
    ),
    xs = coordinates.filter((_, i) => i % 2 === 0),
    ys = coordinates.filter((_, i) => i % 2 === 1);
  const bounds = {
    x: Math.min(...xs) - 16,
    y: Math.min(...ys) - 16,
    width: Math.max(...xs) - Math.min(...xs) + 32,
    height: Math.max(...ys) - Math.min(...ys) + 32,
  };
  useLayoutEffect(() => {
    const path = group.current?.querySelector<SVGPathElement>(
      ".react-flow__edge-path",
    );
    if (path)
      group.current?.style.setProperty(
        "--edge-length",
        String(path.getTotalLength()),
      );
  }, [data.path]);
  return (
    <g
      ref={group}
      className={`map-connection ${data.inferred ? "is-inferred" : ""} ${data.lit ? "lit" : ""} ${data.dim ? "dim" : ""}`}
    >
      {data.gaps?.length > 0 && (
        <defs>
          <mask id={`map-gap-${id}`} maskUnits="userSpaceOnUse" {...bounds}>
            <rect {...bounds} fill="white" />
            {data.gaps.map((p: { x: number; y: number }, i: number) => (
              <circle key={i} cx={p.x} cy={p.y} r={6} fill="black" />
            ))}
          </mask>
        </defs>
      )}
      <title>
        {data.label} · {data.strength?.label}
        {data.inferred ? " · Go inferred" : ""}
      </title>
      <BaseEdge
        mask={data.gaps?.length ? `url(#map-gap-${id})` : undefined}
        id={id}
        path={data.path}
        markerEnd={markerEnd}
        markerStart={markerStart}
        interactionWidth={18}
        style={{
          stroke: data.lit ? "var(--edge-lit)" : "var(--edge)",
          strokeWidth:
            1.4 + (data.strength?.weight ?? 0) * 0.5 + (data.lit ? 0.4 : 0),
          strokeDasharray: data.inferred ? "5 5" : undefined,
        }}
      />
      <path data-label-path={id} d={data.path} fill="none" stroke="none" />
    </g>
  );
}
const nodeTypes = { idea: IdeaNode },
  edgeTypes = { connection: Connection };
function Labels({ edges, nodes }: { edges: Edge[]; nodes: IdeaPosition[] }) {
  const host = useRef<HTMLDivElement>(null),
    [positions, setPositions] = useState<ReturnType<typeof placeLabels>>([]);
  const visible = edges.filter((e) => e.data?.lit);
  const signature = visible.map((e) => e.id + e.data?.path).join("|");
  useLayoutEffect(() => {
    const labels = visible
      .map((e) => {
        const path = [
            ...document.querySelectorAll<SVGPathElement>("[data-label-path]"),
          ].find((p) => p.dataset.labelPath === e.id),
          el = host.current?.querySelector<HTMLElement>(
            `[data-label="${e.id}"]`,
          );
        if (!path || !el) return null;
        const p = path.getPointAtLength(path.getTotalLength() / 2);
        return {
          id: e.id,
          x: p.x,
          y: p.y + (e.data?.under ? 26 : 0),
          width: el.offsetWidth,
          height: el.offsetHeight,
        };
      })
      .filter((v): v is NonNullable<typeof v> => !!v);
    setPositions(placeLabels(labels, nodes));
  }, [signature, nodes]);
  return (
    <ViewportPortal>
      <div ref={host} className="world-labels">
        {visible.map((e) => {
          const p = positions.find((x) => x.id === e.id);
          return (
            <div
              key={e.id}
              data-label={e.id}
              className="world-label"
              style={{
                left: p?.x ?? 0,
                top: p?.y ?? 0,
                visibility: p ? "visible" : "hidden",
              }}
            >
              {String(e.data?.label)} ·{" "}
              {String((e.data?.strength as any)?.label)}
            </div>
          );
        })}
      </div>
    </ViewportPortal>
  );
}
function Ruler({
  rows,
}: {
  rows: Awaited<ReturnType<typeof layoutIdeas>>["rows"];
}) {
  const v = useViewport();
  return (
    <div className="depth-ruler">
      {rows
        .filter((r) => r.label !== "")
        .map((r, i) => (
          <div key={i} style={{ top: v.y + r.y * v.zoom }}>
            <b>
              {r.label ?? (r.depth ? `Depth ${r.depth}` : "Evidence missing")}
            </b>
            <span>
              {r.label !== undefined
                ? "No relationships recorded"
                : r.capture
                  ? `${sourceVerb(r.capture)} ${domain(r.capture.url)}`
                  : "Go inferred"}
            </span>
          </div>
        ))}
    </div>
  );
}
function Canvas({
  session,
  selected,
  onSelect,
  memory,
  setMemory,
  walk,
  setWalk,
  onPractice,
  brighten,
}: {
  brighten?: string[];
  session: Session;
  selected: Selection;
  onSelect: (s: Selection) => void;
  memory: boolean;
  setMemory: (v: boolean) => void;
  walk: number | null;
  setWalk: (v: number | null) => void;
  onPractice: (id: string) => void;
}) {
  const analysis = session.analysis!,
    memories = deriveMemory(analysis, session.attempts),
    flow = useReactFlow(),
    initialized = useNodesInitialized();
  const [measuredNodes, , onNodesChange] = useNodesState<Node>(
    analysis.concepts.map((c) => ({
      id: c.id,
      type: "idea",
      position: { x: 0, y: 0 },
      data: {},
    })),
  );
  const measurementKey = measuredNodes
    .map((n) => `${n.id}:${n.measured?.width}:${n.measured?.height}`)
    .join("|");
  const merged = useMemo(() => mergeEdges(analysis.edges), [analysis]);
  const [query, setQuery] = useState(""),
    [supported, setSupported] = useState(true),
    [inferred, setInferred] = useState(true);
  const search = useRef<HTMLInputElement>(null),
    route = routeIds(analysis);
  const [layout, setLayout] = useState<Awaited<
      ReturnType<typeof layoutIdeas>
    > | null>(null),
    [error, setError] = useState(""),
    [hover, setHover] = useState<Selection>(null);
  const box = useRef<HTMLDivElement>(null),
    layoutKey = `${session.id}:${session.version}`;
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      setCanvasSize({ width: el.clientWidth, height: el.clientHeight }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const fit = useCallback(() => {
    if (!box.current) return;
    const bounds = flow.getNodesBounds(flow.getNodes()),
      w = box.current.clientWidth,
      h = box.current.clientHeight;
    const zoom = Math.max(
      0.9,
      Math.min(
        1.25,
        (w - 174) / Math.max(1, bounds.width),
        (h - 140) / Math.max(1, bounds.height),
      ),
    );
    // One viewport update per resize. fitView also schedules an update and can
    // overwrite this position after the next click has focused an idea.
    void flow.setViewport(
      {
        x:
          150 -
          bounds.x * zoom +
          Math.max(0, (w - 174 - bounds.width * zoom) / 2),
        y: 64 - bounds.y * zoom,
        zoom,
      },
      { duration: duration() },
    );
  }, [flow]);
  useEffect(() => {
    setLayout(null);
    setError("");
  }, [layoutKey]);
  useEffect(() => {
    if (!initialized || layout) return;
    let alive = true;
    document.fonts.ready.then(async () => {
      const measured = flow.getNodes();
      if (measured.some((n) => !n.measured?.width || !n.measured?.height))
        return;
      try {
        const result = await cachedLayoutIdeas(
          layoutKey,
          analysis,
          session.captures,
          new Map(
            measured.map((n) => [
              n.id,
              { width: n.measured!.width!, height: n.measured!.height! },
            ]),
          ),
        );
        if (alive) setLayout(result);
      } catch (e) {
        if (alive) setError(String(e));
      }
    });
    return () => {
      alive = false;
    };
  }, [initialized, layoutKey, !!layout, measurementKey]);
  useEffect(() => {
    if (layout && !selected && walk === null) {
      const id = requestAnimationFrame(fit);
      return () => cancelAnimationFrame(id);
    }
  }, [layout, fit, canvasSize]);
  useEffect(() => {
    if (!layout) return;
    const id =
        walk !== null
          ? route[walk]
          : selected?.kind === "concept"
            ? selected.id
            : undefined,
      p = layout.nodes.find((n) => n.id === id);
    if (p && box.current) {
      const zoom = Math.max(1, flow.getZoom()),
        w = box.current.clientWidth,
        h = box.current.clientHeight;
      const centerX = selected ? (w < 900 ? w / 2 : (w - 372) / 2) : w / 2;
      const centerY =
        selected && w < 900 ? h * 0.22 : walk !== null ? h * 0.3 : h / 2;
      void flow.setViewport(
        {
          x: centerX - (p.x + p.width / 2) * zoom,
          y: centerY - (p.y + p.height / 2) * zoom,
          zoom,
        },
        { duration: duration() },
      );
    }
  }, [selected?.id, walk, layout, canvasSize]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).matches(
        "input,textarea,[contenteditable=true]",
      );
      if (typing) return;
      if (e.key === "/") {
        e.preventDefault();
        search.current?.focus();
      }
      if (e.key === "Escape") {
        setWalk(null);
        onSelect(null);
      }
      if (walk !== null && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        if (e.key === "ArrowRight" && walk === route.length - 1) {
          onPractice("route:" + route.join(","));
          return;
        }
        setWalk(
          Math.max(
            0,
            Math.min(
              route.length - 1,
              walk + (e.key === "ArrowRight" ? 1 : -1),
            ),
          ),
        );
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [walk, route.join(",")]);
  const focused = hover ?? selected,
    focusId = focused?.kind === "concept" ? focused.id : null;
  const lit = new Set(
    merged
      .filter((e) =>
        focusId
          ? e.source === focusId || e.target === focusId
          : focused?.kind === "edge" && e.ids.includes(focused.id),
      )
      .map((e) => e.id),
  );
  const neighbors = new Set(
    merged.filter((e) => lit.has(e.id)).flatMap((e) => [e.source, e.target]),
  );
  const nodes: Node[] = analysis.concepts.map((c) => {
    const p = layout?.nodes.find((n) => n.id === c.id);
    return {
      ...measuredNodes.find((n) => n.id === c.id),
      id: c.id,
      type: "idea",
      position: { x: p?.x ?? 0, y: p?.y ?? 0 },
      style: { opacity: layout ? 1 : 0 },
      data: {
        ready: !!layout,
        bump: !!layout && brighten?.includes(c.id),
        memory: memory ? memories[c.id] : null,
        label: c.label,
        main: c.main ?? c.id === analysis.overview?.rootConceptId,
        gap: c.gap,
        row: p?.row ?? 0,
        selected: selected?.id === c.id || route[walk ?? -1] === c.id,
        visited:
          walk !== null &&
          route.indexOf(c.id) >= 0 &&
          route.indexOf(c.id) < walk,
        neighbor: neighbors.has(c.id),
        dim: query
          ? !c.label.toLowerCase().includes(query.toLowerCase())
          : !!focused && !neighbors.has(c.id) && c.id !== focusId,
        match: !!query && c.label.toLowerCase().includes(query.toLowerCase()),
      },
      ariaLabel: c.label,
      ariaRole: "button",
      focusable: true,
    };
  });
  const edges: Edge[] = layout
    ? merged
        .filter((e) => (e.evidenceKind === "supported" ? supported : inferred))
        .filter(
          (e) =>
            layout.nodes.some((n) => n.id === e.source) &&
            layout.nodes.some((n) => n.id === e.target),
        )
        .map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          type: "connection",
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 12,
            height: 12,
            color: lit.has(e.id) ? "var(--edge-lit)" : "var(--edge)",
          },
          markerStart: e.twoWay
            ? {
                type: MarkerType.ArrowClosed,
                width: 12,
                height: 12,
                color: "var(--edge)",
              }
            : undefined,
          data: {
            ...connectionGeometry(e, layout.nodes, merged),
            label: e.label,
            strength: connectionStrength(session, e),
            lit: lit.has(e.id),
            dim: !!focused && !lit.has(e.id),
            inferred: e.evidenceKind !== "supported",
          },
        }))
    : [];
  const routeSignature = edges.map((e) => e.id + e.data?.path).join("|");
  const crossings = useMemo(
    () =>
      edgeCrossings(
        edges.map((e) => ({ id: e.id, path: String(e.data?.path) })),
      ),
    [routeSignature],
  );
  for (const e of edges) if (e.data) e.data.gaps = crossings.get(e.id);
  return (
    <div
      className="map-canvas"
      ref={box}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const node = (e.target as HTMLElement).closest<HTMLElement>(
          ".react-flow__node[data-id]",
        );
        if (node) {
          e.preventDefault();
          onSelect({ kind: "concept", id: node.dataset.id! });
        }
      }}
    >
      <ReactFlow
        onNodesChange={onNodesChange}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        minZoom={0.7}
        maxZoom={2.5}
        panOnScroll
        zoomOnPinch
        zoomOnScroll={false}
        attributionPosition="top-left"
        onNodeClick={(_, n) => {
          if (walk !== null && route.includes(n.id))
            setWalk(route.indexOf(n.id));
          else onSelect({ kind: "concept", id: n.id });
        }}
        onNodeMouseEnter={(_, n) => setHover({ kind: "concept", id: n.id })}
        onNodeMouseLeave={() => setHover(null)}
        onEdgeMouseEnter={(_, e) => setHover({ kind: "edge", id: e.id })}
        onEdgeMouseLeave={() => setHover(null)}
        onEdgeClick={(_, e) => onSelect({ kind: "edge", id: e.id })}
        onPaneClick={() => onSelect(null)}
      >
        <div className="map-search">
          <input
            ref={search}
            aria-label="Find an idea"
            placeholder="Find an idea"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setQuery("");
                e.currentTarget.blur();
              }
              if (e.key === "Enter") {
                const c = analysis.concepts.find((c) =>
                  c.label.toLowerCase().includes(query.toLowerCase()),
                );
                if (c) onSelect({ kind: "concept", id: c.id });
              }
            }}
          />
          <kbd>/</kbd>
        </div>
        <div
          className={`map-layers ${selected ? "shifted" : ""}`}
          aria-label="Map layers"
        >
          <button
            aria-pressed={supported}
            onClick={() => setSupported(!supported)}
          >
            — From your trail
          </button>
          <button
            aria-pressed={inferred}
            onClick={() => setInferred(!inferred)}
          >
            ┄ Go inferred
          </button>
          <button aria-pressed={memory} onClick={() => setMemory(!memory)}>
            ◐ What I remember
          </button>
        </div>
        {walk === null ? (
          <Button
            className={`map-walk ${selected ? "shifted" : ""}`}
            onClick={() => {
              onSelect(null);
              setWalk(0);
            }}
            disabled={!route.length}
          >
            Walk the route
          </Button>
        ) : (
          <section className="route-tour">
            <div className="tour-top">
              <div className="tour-steps">
                {route.map((id, i) => (
                  <i
                    key={id}
                    className={i === walk ? "current" : i < walk ? "done" : ""}
                  />
                ))}
              </div>
              <span>
                {walk + 1} of {route.length}
              </span>
              <IconButton
                name="x"
                label="End walk"
                onClick={() => setWalk(null)}
              />
            </div>
            <h3>
              {analysis.concepts.find((c) => c.id === route[walk])?.label}
            </h3>
            {walk > 0 &&
              (() => {
                const e = analysis.edges.find(
                  (e) =>
                    (e.source === route[walk - 1] &&
                      e.target === route[walk]) ||
                    (e.target === route[walk - 1] && e.source === route[walk]),
                );
                return e ? (
                  <p className="tour-via">
                    {analysis.concepts.find((c) => c.id === e.source)?.label}{" "}
                    <b>{e.label}</b>{" "}
                    {analysis.concepts.find((c) => c.id === e.target)?.label}
                  </p>
                ) : null;
              })()}
            {(() => {
              const c = analysis.concepts.find((c) => c.id === route[walk]);
              return (
                <>
                  {c?.claim && <p className="tour-claim">{c.claim}</p>}
                  <p>{c?.explanation}</p>
                  {c?.steps && (
                    <ol className="idea-steps">
                      {c.steps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  )}
                </>
              );
            })()}
            <div className="tour-actions">
              <Button disabled={walk === 0} onClick={() => setWalk(walk - 1)}>
                Back
              </Button>
              <Button
                primary
                onClick={() =>
                  walk === route.length - 1
                    ? onPractice("route:" + route.join(","))
                    : setWalk(walk + 1)
                }
              >
                {walk === route.length - 1
                  ? "Practice these ideas"
                  : "Next idea"}
              </Button>
            </div>
          </section>
        )}
        {layout && (
          <>
            <Ruler rows={layout.rows} />
            <Labels nodes={layout.nodes} edges={edges} />
          </>
        )}
        <div className="map-zoom">
          <IconButton
            name="plus"
            label="Zoom in"
            onClick={() => flow.zoomIn()}
          />
          <IconButton
            name="minus"
            label="Zoom out"
            onClick={() => flow.zoomOut()}
          />
          <IconButton name="fit" label="Fit to view" onClick={fit} />
        </div>
        <span className="map-count">
          {nodes.length} ideas · {merged.length} connections
        </span>
        {error && <div role="alert">Map layout failed: {error}</div>}
      </ReactFlow>
    </div>
  );
}
export function MapView({
  session,
  list,
  selected,
  onSelect,
  onPractice,
  onRebuild,
  onExplain,
  mapRequest,
}: {
  session: Session;
  list: boolean;
  selected: Selection;
  onSelect: (s: Selection) => void;
  onPractice: (id: string) => void;
  onRebuild: () => void;
  onExplain?: (id: string, style: string) => void;
  mapRequest?: { memory?: boolean; walk?: boolean; brighten?: string[] };
}) {
  const [memory, setMemory] = useState(mapRequest?.memory ?? false),
    [walk, setWalk] = useState<number | null>(mapRequest?.walk ? 0 : null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSelect(null);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onSelect]);
  if (!session.analysis)
    return (
      <section className="empty">
        <h2>Your map starts with your trail</h2>
        <p>Send your saved finds to Go to build an evidence-linked map.</p>
        <Button onClick={onRebuild}>Build with Go</Button>
      </section>
    );
  return (
    <div
      className={`map-v2 ${!session.analysis.edges.length ? "no-connections" : ""}`}
    >
      {list ? (
        <section className="idea-list">
          {session.analysis.concepts.map((c) => (
            <article key={c.id}>
              <button
                onClick={() => {
                  onSelect({ kind: "concept", id: c.id });
                }}
              >
                {c.label}
              </button>
              <p>{c.explanation}</p>
            </article>
          ))}
        </section>
      ) : (
        <ReactFlowProvider>
          <Canvas
            key={`${session.id}:${session.version}`}
            session={session}
            selected={selected}
            onSelect={onSelect}
            memory={memory}
            setMemory={setMemory}
            walk={walk}
            setWalk={setWalk}
            onPractice={onPractice}
            brighten={mapRequest?.brighten}
          />
        </ReactFlowProvider>
      )}
      {!list && !selected && !session.analysis.edges.length && (
        <aside className="map-empty-connections" role="status">
          <strong>No connections saved yet</strong>
          <p>
            These ideas are grouped here without implying relationships. Go can
            review the saved evidence for connections.
          </p>
          <Button quiet onClick={onRebuild}>
            Review connections with Go
          </Button>
        </aside>
      )}
      <IdeaDrawer
        session={session}
        selected={selected}
        onSelect={onSelect}
        onPractice={(ids, edge) => onPractice(edge ?? ids[0])}
        onExplain={onExplain}
        onWalk={(id) => {
          onSelect(null);
          const route = routeIds(session.analysis!);
          setWalk(Math.max(0, route.indexOf(id)));
        }}
      />
    </div>
  );
}
