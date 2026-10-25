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
  radialLayout,
  radialTunnelPath,
  radialVisibleIds,
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
      className={`chamber ${data.isRoot ? "is-root" : data.row === 1 ? "major-idea" : "detail-idea"} ${data.selected ? "selected" : ""} ${data.neighbor ? "neighbor" : ""} ${data.dim ? "dim" : ""}`}
      style={{ "--row": data.row } as React.CSSProperties}
    >
      <Handle type="target" position={Position.Top} />
      <strong>{data.label}</strong>
      {data.isRoot && (
        <small className="root-label">
          {data.authored ? "Main idea" : "Layout hub"}
        </small>
      )}
      {data.isRoot && data.takeaways?.length > 0 && (
        <ul>
          {data.takeaways.slice(0, 2).map((point: string) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      )}
      {!data.isRoot && data.detailCount > 0 && (
        <small className="branch-count">{data.detailCount} details</small>
      )}
      {data.gap && <span className="gapdot" title="A gap in your trail" />}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
function Tunnel({ id, data, markerEnd }: any) {
  const { zoom } = useViewport();
  const route = data.radial
    ? radialTunnelPath(data.a, data.b, data.lane)
    : tunnelPath(data.a, data.b, data.adjacent, data.lane);
  const labelRoute = data.radial
    ? radialTunnelPath(data.a, data.b, data.lane / Math.min(1, zoom))
    : tunnelPath(data.a, data.b, data.adjacent, data.lane / Math.min(1, zoom));
  return (
    <g
      className={`edge ${data.lit ? "lit" : ""} ${data.dim ? "dim" : ""}`}
      style={
        { "--row": Math.max(data.a.row, data.b.row) } as React.CSSProperties
      }
    >
      <BaseEdge
        id={id}
        path={route.path}
        markerEnd={markerEnd}
        interactionWidth={20}
        className={`tunnel ${data.inferred ? "inferred" : ""}`}
      />
      <EdgeLabelRenderer>
        <div
          className={`edge-label nodrag nopan ${data.lit ? "visible" : ""}`}
          style={{
            transform: `translate(${labelRoute.labelX}px,${labelRoute.labelY}px) scale(${1 / zoom}) translate(-50%, -50%)`,
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
    const left = el.classList.contains("radial")
        ? 36
        : el.clientWidth > 500
          ? 150
          : 112,
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
  mode,
  session,
  selected,
  onSelect,
}: {
  mode?: "radial" | "trail";
  session: Session;
  selected: Selection;
  onSelect: (s: Selection) => void;
}) {
  const analysis = session.analysis!,
    [hover, setHover] = useState<string | null>(null),
    [all, setAll] = useState(false),
    fullLayout = useMemo(
      () =>
        mode === "trail"
          ? depthLayout(analysis.concepts, session.captures)
          : radialLayout(analysis, session.captures),
      [analysis, session.captures, mode],
    );
  const rootId =
    "rootId" in fullLayout && typeof fullLayout.rootId === "string"
      ? fullLayout.rootId
      : undefined;
  const edgeSelection =
    selected?.kind === "edge"
      ? analysis.edges.find((e) => e.id === selected.id)
      : undefined;
  const visible = rootId
    ? radialVisibleIds(
        fullLayout.nodes,
        rootId,
        selected?.kind === "concept"
          ? selected.id
          : (edgeSelection?.source ?? null),
        all,
      )
    : fullLayout.nodes.map((n) => n.id);
  // A selected cross-branch relationship must retain both endpoints.
  if (edgeSelection)
    for (const id of [edgeSelection.source, edgeSelection.target])
      if (!visible.includes(id)) visible.push(id);
  const layout = {
    ...fullLayout,
    nodes: fullLayout.nodes.filter((n) => visible.includes(n.id)),
  };
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
    const height = "height" in p ? (p.height as number) : 46,
      isRoot = "isRoot" in p && p.isRoot;
    return {
      id: c.id,
      type: "chamber",
      position: { x: p.x, y: p.y },
      width: p.width,
      height,
      style: { width: p.width, height },
      data: {
        label: c.label,
        isRoot,
        authored: !!analysis.overview,
        takeaways: isRoot ? analysis.overview?.takeaways : undefined,
        detailCount:
          "parentId" in p
            ? fullLayout.nodes.filter(
                (n) => "parentId" in n && n.parentId === p.id,
              ).length
            : 0,
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
  const edges: Edge[] = analysis.edges
    .filter((e) => visible.includes(e.source) && visible.includes(e.target))
    .map((e) => {
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
          radial: mode !== "trail",
          label: e.label,
          inferred: e.evidenceKind !== "supported",
          lit: litEdges.has(e.id),
          dim: active && !litEdges.has(e.id),
        },
      };
    });
  return (
    <div
      className={`burrow ${mode !== "trail" ? "radial" : "trail-layout"}`}
      key={`${session.id}:${session.version}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          onSelect(null);
          setHover(null);
        }
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
        {mode === "trail" && <Ruler rows={layout.rows} />}
        <MapTools layout={layout} />
        {mode !== "trail" && (
          <div className="map-scope">
            <Button
              onClick={() => {
                setAll(false);
                onSelect(null);
              }}
              aria-label="Return to map overview"
            >
              Overview
            </Button>
            <Button aria-pressed={all} onClick={() => setAll((v) => !v)}>
              {all ? "Focus on branches" : "Show all ideas"}
            </Button>
            <span>
              {layout.nodes.length} of {fullLayout.nodes.length} ideas
            </span>
          </div>
        )}
        <div className="map-hint">
          {mode === "trail"
            ? "Lower on the map means deeper in your trail"
            : analysis.overview
              ? "Start at the main idea. Follow a branch to explore the details."
              : "Grouped from saved connections. Select an idea to retrace its evidence."}
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
  onRebuild,
}: {
  session: Session;
  list: boolean;
  selected: Selection;
  onSelect: (s: Selection) => void;
  onPractice: (edgeId: string) => void;
  onRebuild: () => void;
}) {
  const [mode, setMode] = useState<"radial" | "trail">("radial");
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
          {edge && (
            <Inspector
              session={session}
              selected={selected}
              onSelect={onSelect}
              onPractice={onPractice}
              onRebuild={onRebuild}
            />
          )}
        </div>
      </section>
    );

  return (
    <div className="mapview">
      <div className="map-layout-control" role="group" aria-label="Map layout">
        <Button
          aria-pressed={mode === "radial"}
          onClick={() => setMode("radial")}
        >
          Radial map
        </Button>
        <Button
          aria-pressed={mode === "trail"}
          onClick={() => setMode("trail")}
        >
          Trail depth
        </Button>
      </div>
      <ReactFlowProvider>
        <Canvas
          mode={mode}
          session={session}
          selected={selected}
          onSelect={onSelect}
        />
      </ReactFlowProvider>
      <Inspector
        session={session}
        selected={selected}
        onSelect={onSelect}
        onPractice={onPractice}
        onRebuild={onRebuild}
      />
    </div>
  );
}

function Inspector({
  session,
  selected,
  onSelect,
  onPractice,
  onRebuild,
}: {
  session: Session;
  selected: Selection;
  onSelect: (s: Selection) => void;
  onPractice: (id: string) => void;
  onRebuild: () => void;
}) {
  const analysis = session.analysis!,
    layout = depthLayout(analysis.concepts, session.captures),
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
                onClick={() => onSelect({ kind: "concept", id: edge!.source })}
              >
                {label(edge!.source)}
              </button>
              <span className="via">{edge!.label}</span>
              <button
                className="pill"
                onClick={() => onSelect({ kind: "concept", id: edge!.target })}
              >
                {label(edge!.target)}
              </button>
            </div>
          )}
          <div className="idea-explanation">
            {(concept?.explanation ?? edge?.explanation)
              ?.split("\n")
              .filter(Boolean)
              .map((p, i) => (
                <p key={i}>{p}</p>
              ))}
          </div>
          {concept?.takeaways?.length ? (
            <>
              <h3>What matters</h3>
              <ul className="takeaways">
                {concept.takeaways.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </>
          ) : null}
          {(concept?.example || edge?.example) && (
            <section className="idea-example">
              <h3>A concrete example</h3>
              <p>{concept?.example ?? edge?.example}</p>
              <small>
                Go’s illustration; check the cited evidence for source claims.
              </small>
            </section>
          )}
          {concept?.boundary && (
            <>
              <h3>Where this stops applying</h3>
              <p>{concept.boundary}</p>
            </>
          )}
          {!concept?.takeaways && !edge?.example && (
            <p className="legacy-note">
              This saved map has brief explanations.{" "}
              <button className="text-button" onClick={onRebuild}>
                Rebuild with Go
              </button>{" "}
              for a fuller guide from these sources.
            </p>
          )}
          <h3>Where you read it</h3>
          <Evidence
            session={session}
            ids={(concept ?? edge)!.captureIds}
            excerpts={(concept ?? edge)!.evidence}
          />
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
                Quiz this connection
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="insp-empty reading-guide">
          {analysis.overview ? (
            <>
              <Chip kind="violet">Start here</Chip>
              <h2>{label(analysis.overview.rootConceptId)}</h2>
              <p>{analysis.overview.summary}</p>
              <h3>The main takeaways</h3>
              <ul className="takeaways">
                {analysis.overview.takeaways.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <h3>A route through your research</h3>
              <ol className="reading-route">
                {analysis.overview.route.map((id) => (
                  <li key={id}>
                    <button onClick={() => onSelect({ kind: "concept", id })}>
                      {label(id)}
                      <Icon name="chevronRight" size={14} />
                    </button>
                  </li>
                ))}
              </ol>
              <Button icon="practice" onClick={() => onPractice("")}>
                Test your understanding
              </Button>
            </>
          ) : (
            <>
              <h2>
                Start with{" "}
                {label(radialLayout(analysis, session.captures).rootId)}
              </h2>
              <p>
                This older map was grouped from its saved connections. Rebuild
                it to add a main idea, examples and a reading route.
              </p>
              <Button onClick={onRebuild} icon="handoff">
                Rebuild map with Go
              </Button>
            </>
          )}
          <details className="map-help">
            <summary>How to explore this map</summary>
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
          </details>
        </div>
      )}
    </aside>
  );
}
