import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
  BaseEdge,
  EdgeLabelRenderer,
  useViewport,
  useReactFlow,
  ViewportPortal,
  MarkerType,
  type Node,
  type Edge,
} from "@xyflow/react";
import type { Session } from "../../../packages/contracts/src/index";
import {
  depthLayout,
  tunnelPath,
  sourceVerb,
  domain,
  type ChamberPosition,
} from "./ui-model";
import { Icon } from "./Icon";
import { Button, IconButton, Chip } from "./components";
import { Evidence } from "./Trail";
export type Selection = { kind: "concept" | "edge"; id: string } | null;
function Chamber({ data }: any) {
  return (
    <div
      className={`chamber ${data.selected ? "selected" : ""} ${data.neighbor ? "neighbor" : ""} ${data.dim ? "dim" : ""}`}
      style={{ "--row": data.row } as React.CSSProperties}
    >
      <Handle type="target" position={Position.Top} />
      <span>{data.label}</span>
      {data.gap && <span className="gapdot" title="A gap in your trail" />}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
function Tunnel({ id, data, markerEnd }: any) {
  const route = tunnelPath(data.a, data.b, data.adjacent, data.lane);
  return (
    <g
      className={`edge ${data.lit ? "lit" : ""} ${data.dim ? "dim" : ""}`}
      style={
        { "--row": Math.max(data.a.row, data.b.row) } as React.CSSProperties
      }
    >
      <defs>
        <mask
          id={`reveal-${id}`}
          maskUnits="userSpaceOnUse"
          x={Math.min(data.a.x, data.b.x) - 80}
          y={
            Math.min(data.a.y, data.b.y) -
            100 -
            Math.abs(data.a.x - data.b.x) * 0.12
          }
          width={
            Math.abs(data.a.x - data.b.x) +
            Math.max(data.a.width, data.b.width) +
            160
          }
          height={
            Math.abs(data.a.y - data.b.y) +
            260 +
            Math.abs(data.a.x - data.b.x) * 0.12
          }
          style={{ maskType: "alpha" }}
        >
          <path
            className="tunnel-reveal"
            d={route.path}
            pathLength={1}
            fill="none"
            stroke="var(--chamber-ink)"
            strokeWidth={8}
          />
        </mask>
      </defs>
      <g mask={`url(#reveal-${id})`}>
        <BaseEdge
          id={id}
          path={route.path}
          markerEnd={markerEnd}
          interactionWidth={20}
          className={`tunnel ${data.inferred ? "inferred" : ""}`}
        />
      </g>
      <EdgeLabelRenderer>
        <div
          className={`edge-label nodrag nopan ${data.lit ? "visible" : ""}`}
          style={{
            transform: `translate(-50%, -50%) translate(${route.labelX}px,${route.labelY}px)`,
          }}
        >
          {data.label}
        </div>
      </EdgeLabelRenderer>
    </g>
  );
}
const nodeTypes = { chamber: Chamber },
  edgeTypes = { tunnel: Tunnel };
function Ruler({ rows }: { rows: ReturnType<typeof depthLayout>["rows"] }) {
  const viewport = useViewport();
  return (
    <>
      <ViewportPortal>
        <svg className="depth-guides">
          {rows.map((r, i) => (
            <line key={i} x1={-5000} x2={5000} y1={r.y + 23} y2={r.y + 23} />
          ))}
        </svg>
      </ViewportPortal>
      <div className="ruler" aria-label="Depth in your research trail">
        {rows.map((r, i) => (
          <div key={i} style={{ top: viewport.y + (r.y + 23) * viewport.zoom }}>
            <b>{r.depth ? `Depth ${r.depth}` : "Evidence missing"}</b>
            {r.capture &&
              (r.capture.sourceType === "search"
                ? `Searched “${r.capture.text}”`
                : r.capture.sourceType === "highlight"
                  ? "Highlighted a passage"
                  : `${sourceVerb(r.capture)} ${domain(r.capture.url)}`)}
          </div>
        ))}
      </div>
    </>
  );
}
function MapTools({ layout }: { layout: ReturnType<typeof depthLayout> }) {
  const flow = useReactFlow();
  const fit = () => {
    const bounds = flow.getNodesBounds(flow.getNodes());
    const el = document.querySelector<HTMLElement>(".burrow");
    if (!el || !layout.nodes.length) return;
    const left = el.clientWidth > 500 ? 150 : 112,
      right = 24;
    const zoom = Math.max(
      0.12,
      Math.min(
        (el.clientWidth - left - right) / Math.max(bounds.width, 1),
        (el.clientHeight - 150) / Math.max(bounds.height + 80, 1),
        1.25,
      ),
    );
    void flow.setViewport({
      x:
        left +
        (el.clientWidth - left - right - bounds.width * zoom) / 2 -
        bounds.x * zoom,
      y: el.clientHeight / 2 - (bounds.y + bounds.height / 2) * zoom + 20,
      zoom,
    });
  };
  const fitRef = useRef(fit);
  fitRef.current = fit;
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(".burrow");
    if (!el) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => fitRef.current());
    });
    observer.observe(el);
    frame = requestAnimationFrame(() => fitRef.current());
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [layout.nodes.map((n) => `${n.id}:${n.y}`).join(",")]);
  return (
    <div className="map-tools">
      <IconButton name="plus" label="Zoom in" onClick={() => flow.zoomIn()} />
      <IconButton
        name="minus"
        label="Zoom out"
        onClick={() => flow.zoomOut()}
      />
      <IconButton name="fit" label="Fit to view" onClick={fit} />
    </div>
  );
}
function Canvas({
  session,
  selected,
  onSelect,
}: {
  session: Session;
  selected: Selection;
  onSelect: (s: Selection) => void;
}) {
  const analysis = session.analysis!,
    [hover, setHover] = useState<string | null>(null),
    layout = useMemo(
      () => depthLayout(analysis.concepts, session.captures),
      [analysis.concepts, session.captures],
    );
  const focus = hover ?? (selected?.kind === "concept" ? selected.id : null),
    focusedEdge =
      selected?.kind === "edge"
        ? analysis.edges.find((e) => e.id === selected.id)
        : undefined;
  const litEdges = new Set(
    analysis.edges
      .filter((e) =>
        focus
          ? e.source === focus || e.target === focus
          : e.id === focusedEdge?.id,
      )
      .map((e) => e.id),
  );
  const neighbors = new Set(
    analysis.edges
      .filter((e) => litEdges.has(e.id))
      .flatMap((e) => [e.source, e.target]),
  );
  const active = !!(focus || focusedEdge);
  const nodes: Node[] = layout.nodes.map((p) => {
    const c = analysis.concepts.find((c) => c.id === p.id)!;
    return {
      id: c.id,
      type: "chamber",
      position: { x: p.x, y: p.y },
      width: p.width,
      height: 46,
      style: { width: p.width, height: 46 },
      data: {
        label: c.label,
        gap: c.gap,
        row: p.row,
        selected: selected?.id === c.id,
        neighbor: neighbors.has(c.id),
        dim: active && !neighbors.has(c.id) && c.id !== focus,
      },
      ariaLabel: c.label,
      focusable: true,
      selected: selected?.id === c.id,
    };
  });
  const edges: Edge[] = analysis.edges.map((e) => {
    const a = layout.nodes.find((n) => n.id === e.source)!,
      b = layout.nodes.find((n) => n.id === e.target)!,
      row = layout.nodes.filter((n) => n.row === a.row),
      adjacent =
        Math.abs(
          row.findIndex((n) => n.id === a.id) -
            row.findIndex((n) => n.id === b.id),
        ) === 1;
    const parallel = analysis.edges.filter(
      (other) =>
        (other.source === e.source && other.target === e.target) ||
        (other.source === e.target && other.target === e.source),
    );
    const lane =
      (parallel.findIndex((other) => other.id === e.id) -
        (parallel.length - 1) / 2) *
      30;
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      type: "tunnel",
      ariaLabel: `${analysis.concepts.find((c) => c.id === e.source)?.label} ${e.label} ${analysis.concepts.find((c) => c.id === e.target)?.label}`,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: litEdges.has(e.id) ? "var(--tunnel-lit)" : "var(--tunnel)",
      },
      data: {
        a,
        b,
        lane,
        adjacent,
        label: e.label,
        inferred: e.evidenceKind !== "supported",
        lit: litEdges.has(e.id),
        dim: active && !litEdges.has(e.id),
      },
    };
  });
  return (
    <div
      className="burrow dig"
      key={`${session.id}:${session.version}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") onSelect(null);
        if (e.key === "Enter" || e.key === " ") {
          const node = (e.target as HTMLElement).closest<HTMLElement>(
            ".react-flow__node",
          );
          if (node?.dataset.id) {
            e.preventDefault();
            onSelect({ kind: "concept", id: node.dataset.id });
          }
        }
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        minZoom={0.12}
        maxZoom={2.5}
        onNodeClick={(_, n) => onSelect({ kind: "concept", id: n.id })}
        onNodeMouseEnter={(_, n) => setHover(n.id)}
        onNodeMouseLeave={() => setHover(null)}
        onEdgeClick={(_, e) => onSelect({ kind: "edge", id: e.id })}
        onPaneClick={() => onSelect(null)}
      >
        <Ruler rows={layout.rows} />
        <MapTools layout={layout} />
        <div className="map-hint">
          Lower on the map means deeper in your trail
        </div>
        <div className="legend">
          <span>
            <i />
            From your trail
          </span>
          <span>
            <i className="inferred" />
            Go inferred
          </span>
        </div>
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
}: {
  session: Session;
  list: boolean;
  selected: Selection;
  onSelect: (s: Selection) => void;
  onPractice: (edgeId: string) => void;
}) {
  const analysis = session.analysis;
  if (!analysis)
    return (
      <section className="empty map-empty">
        <Icon name="map" size={36} />
        <h2>Your trail comes first</h2>
        <p>
          {session.captures.length
            ? "Send your finds to Go to discover their connections. Your saved sources are ready in the trail."
            : "Browse a question on an included tab. Searches and readable pages appear in your trail."}
        </p>
        <p>
          Select a passage and press Alt+Shift+H to keep something important.
        </p>
      </section>
    );
  const layout = depthLayout(analysis.concepts, session.captures),
    concept =
      selected?.kind === "concept"
        ? analysis.concepts.find((c) => c.id === selected.id)
        : undefined,
    edge =
      selected?.kind === "edge"
        ? analysis.edges.find((e) => e.id === selected.id)
        : undefined;
  const label = (id: string) =>
    analysis.concepts.find((c) => c.id === id)?.label ?? id;
  if (list)
    return (
      <section className="clist">
        <div className="clist-inner">
          {analysis.concepts.map((c) => (
            <article className="clist-row" key={c.id}>
              <button
                className="concept-list-title"
                onClick={() => onSelect({ kind: "concept", id: c.id })}
              >
                {c.label}
              </button>
              <p>{c.explanation}</p>
              <ul>
                {analysis.edges
                  .filter((e) => e.source === c.id)
                  .map((e) => (
                    <li key={e.id}>
                      <Button
                        quiet
                        onClick={() => onSelect({ kind: "edge", id: e.id })}
                      >
                        {e.label} {label(e.target)}
                        <Chip>
                          {e.evidenceKind === "supported"
                            ? "From your trail"
                            : e.evidenceKind === "supplemental"
                              ? "Go added context"
                              : "Go inferred"}
                        </Chip>
                      </Button>
                    </li>
                  ))}
              </ul>
              {selected?.id === c.id && (
                <Evidence session={session} ids={c.captureIds} />
              )}
            </article>
          ))}
          {edge && <Inspector />}
        </div>
      </section>
    );
  function Inspector() {
    return (
      <aside className="inspector" aria-label="Idea and connection details">
        {concept || edge ? (
          <div className="insp">
            <IconButton
              name="x"
              label="Clear selection"
              onClick={() => onSelect(null)}
            />
            <div className="insp-kicker">
              <Chip kind="violet">{concept ? "Idea" : "Connection"}</Chip>
              {concept ? (
                <Chip>
                  Found at{" "}
                  {layout.nodes.find((n) => n.id === concept.id)?.depth
                    ? `depth ${layout.nodes.find((n) => n.id === concept.id)?.depth}`
                    : "an unknown depth"}
                </Chip>
              ) : (
                <Chip kind={edge!.evidenceKind === "supported" ? "done" : ""}>
                  {edge!.evidenceKind === "supported"
                    ? "From your trail"
                    : edge!.evidenceKind === "supplemental"
                      ? "Go added context"
                      : "Go inferred"}
                </Chip>
              )}
            </div>
            {concept ? (
              <h2>{concept.label}</h2>
            ) : (
              <div className="pair">
                <button
                  className="pill"
                  onClick={() =>
                    onSelect({ kind: "concept", id: edge!.source })
                  }
                >
                  {label(edge!.source)}
                </button>
                <span className="via">{edge!.label}</span>
                <button
                  className="pill"
                  onClick={() =>
                    onSelect({ kind: "concept", id: edge!.target })
                  }
                >
                  {label(edge!.target)}
                </button>
              </div>
            )}
            <p>{concept?.explanation ?? edge?.explanation}</p>
            <h3>Where you read it</h3>
            <Evidence session={session} ids={(concept ?? edge)!.captureIds} />
            {concept && (
              <>
                <h3>Connections</h3>
                <ul className="links">
                  {analysis!.edges
                    .filter(
                      (e) => e.source === concept.id || e.target === concept.id,
                    )
                    .map((e) => (
                      <li key={e.id}>
                        <button
                          onClick={() => onSelect({ kind: "edge", id: e.id })}
                        >
                          <span>
                            <b>{label(e.source)}</b> {e.label}{" "}
                            <b>{label(e.target)}</b>
                          </span>
                          <Icon name="chevronRight" size={14} />
                        </button>
                      </li>
                    ))}
                </ul>
                {concept.gap && (
                  <div className="gap">
                    <strong>A gap in your trail</strong>
                    {concept.gap}
                  </div>
                )}
              </>
            )}
            {edge && (
              <div className="insp-actions">
                <Button
                  primary
                  icon="practice"
                  onClick={() => onPractice(edge.id)}
                >
                  Explain it yourself
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="insp-empty">
            <h2>Pick an idea or a tunnel to see why it’s there</h2>
            <p>
              Every idea links back to what you read. Dashed tunnels are
              connections your trail doesn’t show directly.
            </p>
            <div className="insp-stats">
              <span>
                <b>{analysis!.concepts.length}</b>ideas
              </span>
              <span>
                <b>{analysis!.edges.length}</b>connections
              </span>
              <span>
                <b>{analysis!.concepts.filter((c) => c.gap).length}</b>gaps to
                fill
              </span>
            </div>
          </div>
        )}
      </aside>
    );
  }
  return (
    <div className="mapview">
      <ReactFlowProvider>
        <Canvas session={session} selected={selected} onSelect={onSelect} />
      </ReactFlowProvider>
      <Inspector />
    </div>
  );
}
