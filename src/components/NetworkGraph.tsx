import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow, Background, Handle, Position, BaseEdge, MarkerType,
  ViewportPortal, type Node, type NodeProps, type Edge, type EdgeProps, type Viewport,
  getViewportForBounds,
} from "@xyflow/react";
import { displayName, edgeLabel, lifespan, type Genealogy } from "../domain/genealogy";
import { confidence, isParent } from "../domain/types";
import { GraphControls } from "./GraphControls";
import {
  layoutNetwork, networkEdgePath, networkLegend, networkStyles, NETWORK_WIDTH, NETWORK_HEIGHT,
} from "../domain/network-layout";
import "@xyflow/react/dist/style.css";

type NetworkNode = Node<{
  name: string; shortName: string; zoom: number; dates?: string; root: boolean; onSelect: (id: string) => void;
}, "networkPerson">;
function NetworkPerson({ id, data }: NodeProps<NetworkNode>) {
  const compact = data.zoom < 0.7;
  return <>
    <Handle type="source" position={Position.Right} />
    <Handle type="target" position={Position.Left} />
    <button className={`network-person nodrag nopan ${data.root ? "root" : ""} ${compact ? "compact" : ""}`}
      aria-label={`Explore ${data.name}${data.root ? ", network centre" : ""}`}
      title={`${data.name}${data.dates ? ` · ${data.dates}` : ""}`}
      onClick={(event) => { event.stopPropagation(); data.onSelect(id); }}>
      <strong style={compact ? { fontSize: Math.min(12 / data.zoom, 32), lineHeight: 1 } : undefined}>
        {compact ? data.shortName : data.name}
      </strong>
      {!compact && data.dates && <small>{data.dates}</small>}
    </button>
  </>;
}

type NetworkEdge = Edge<{ path: string; description: string }, "networkRelation">;
function NetworkRelation({ data, style, markerEnd }: EdgeProps<NetworkEdge>) {
  if (!data) return null;
  return <g><title>{data.description}</title><BaseEdge
    path={data.path}
    style={style} markerEnd={markerEnd} interactionWidth={12} /></g>;
}
const nodeTypes = { networkPerson: NetworkPerson };
const edgeTypes = { networkRelation: NetworkRelation };

export function NetworkGraph({ family, root, maxEdges, onSelect }: {
  family: Genealogy; root: string; maxEdges: number; onSelect: (id: string) => void;
}) {
  const canvas = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const layout = useMemo(() => layoutNetwork(family, root, maxEdges), [family, root, maxEdges]);
  const nodes: NetworkNode[] = useMemo(() => [...layout.positions].map(([id, point]) => {
    const person = family.people.get(id)!;
    return { id, type: "networkPerson", width: NETWORK_WIDTH, height: NETWORK_HEIGHT,
      position: { x: point.x - NETWORK_WIDTH / 2, y: point.y - NETWORK_HEIGHT / 2 },
      data: { name: displayName(person), shortName: (person.names.find((name) => name.type === "current") ?? person.names[0]).given,
        zoom: viewport.zoom, dates: person.birth?.date || person.death ? lifespan(person) : undefined,
        root: id === root, onSelect } };
  }), [layout, family, root, onSelect, viewport.zoom]);
  const edges: NetworkEdge[] = useMemo(() => {
    return layout.relationships.map((r) => {
      const style = networkStyles[r.type];
      const description = `${displayName(family.people.get(r.from)!)} ${edgeLabel(r)} ${displayName(family.people.get(r.to)!)}; ${confidence(r.confidence)}`;
      return { id: r.id, type: "networkRelation", source: r.from, target: r.to,
        ariaLabel: description,
        markerEnd: isParent(r) ? { type: MarkerType.ArrowClosed, color: style.color, width: 14, height: 14 } : undefined,
        style: { stroke: style.color, strokeWidth: 1.6, strokeDasharray: style.dash },
        data: { path: networkEdgePath(layout, r)!, description } };
    });
  }, [layout, family]);
  const legend = useMemo(() => networkLegend(layout.relationships.map((r) => r.type)), [layout]);

  useLayoutEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const points = [...layout.positions.values()];
    const minX = Math.min(0, ...points.map((point) => point.x)) - NETWORK_WIDTH / 2;
    const minY = Math.min(0, ...points.map((point) => point.y)) - NETWORK_HEIGHT / 2;
    const maxX = Math.max(0, ...points.map((point) => point.x)) + NETWORK_WIDTH / 2;
    const maxY = Math.max(0, ...points.map((point) => point.y)) + NETWORK_HEIGHT / 2;
    const centre = () => setViewport(getViewportForBounds(
      { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
      element.clientWidth, element.clientHeight, 0.05, 1, 0.12,
    ));
    centre();
    const observer = new ResizeObserver(centre);
    observer.observe(element);
    return () => observer.disconnect();
  }, [layout]);

  return <div className="network-view">
    <div ref={canvas} className="graph-canvas network-canvas" aria-label="network graph">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
        viewport={viewport} onViewportChange={setViewport} minZoom={0.05} maxZoom={2}
        nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}
        onNodeClick={(_, node) => onSelect(node.id)} proOptions={{ hideAttribution: true }}>
        <Background color="#dce2d8" gap={22} size={1} />
        <ViewportPortal>
          <svg className="network-rings" width="1" height="1" aria-hidden="true">
            {[...layout.rings.keys()].filter(Boolean).map((distance) => <g key={distance}>
              <circle cx="0" cy="0" r={distance * layout.step} />
            </g>)}
          </svg>
        </ViewportPortal>
        <GraphControls />
      </ReactFlow>
    </div>
    <div className="network-legend" aria-label="Network relationship legend">
      <div>{legend.map((entry) => <span key={entry.text}>
        <svg width="34" height="12" viewBox="0 0 34 12" aria-hidden="true">
          <path d="M2 6H32" stroke={entry.color} strokeWidth="1.6" strokeDasharray={entry.dash} />
          {entry.direction !== "none" && <path d={entry.direction === "out" ? "M27 2L32 6L27 10" : "M7 2L2 6L7 10"}
            fill="none" stroke={entry.color} strokeWidth="1.6" />}
        </svg>{entry.text}
      </span>)}</div>
      {!!layout.beyondDepth.length && <p role="status">{layout.beyondDepth.length} more {layout.beyondDepth.length === 1 ? "person is" : "people are"} beyond the selected edge limit.</p>}
      {!!layout.disconnected.length && <p role="status">{layout.disconnected.length} {layout.disconnected.length === 1 ? "person has" : "people have"} no recorded path to this person and {layout.disconnected.length === 1 ? "is" : "are"} outside this network.</p>}
    </div>
  </div>;
}
