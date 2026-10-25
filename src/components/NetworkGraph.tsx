import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow, Background, Controls, Handle, Position, BaseEdge, MarkerType,
  ViewportPortal, type Node, type NodeProps, type Edge, type EdgeProps, type Viewport,
} from "@xyflow/react";
import { displayName, edgeLabel, lifespan, type Genealogy } from "../domain/genealogy";
import { confidence, isParent } from "../domain/types";
import {
  layoutNetwork, networkLegend, networkStyles, NETWORK_WIDTH, NETWORK_HEIGHT,
} from "../domain/network-layout";
import "@xyflow/react/dist/style.css";

type NetworkNode = Node<{
  name: string; dates?: string; root: boolean; onSelect: (id: string) => void;
}, "networkPerson">;
function NetworkPerson({ id, data }: NodeProps<NetworkNode>) {
  return <>
    <Handle type="source" position={Position.Right} />
    <Handle type="target" position={Position.Left} />
    <button className={`network-person nodrag nopan ${data.root ? "root" : ""}`}
      aria-label={`Explore ${data.name}${data.root ? ", network centre" : ""}`}
      title={`${data.name}${data.dates ? ` · ${data.dates}` : ""}`}
      onClick={(event) => { event.stopPropagation(); data.onSelect(id); }}>
      <strong>{data.name}</strong>
      {data.dates && <small>{data.dates}</small>}
    </button>
  </>;
}

type Point = { x: number; y: number };
type NetworkEdge = Edge<{ from: Point; to: Point; bend: number; description: string }, "networkRelation">;
function NetworkRelation({ data, style, markerEnd }: EdgeProps<NetworkEdge>) {
  if (!data) return null;
  const { from, to, bend } = data;
  const dx = to.x - from.x, dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const control = { x: (from.x + to.x) / 2 - dy / length * bend,
    y: (from.y + to.y) / 2 + dx / length * bend };
  const boundary = (centre: Point, toward: Point) => {
    const x = toward.x - centre.x, y = toward.y - centre.y;
    const scale = 1 / Math.max(Math.abs(x) / (NETWORK_WIDTH / 2 + 3), Math.abs(y) / (NETWORK_HEIGHT / 2 + 3), 0.001);
    return { x: centre.x + x * scale, y: centre.y + y * scale };
  };
  const start = boundary(from, control), end = boundary(to, control);
  return <g><title>{data.description}</title><BaseEdge
    path={`M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`}
    style={style} markerEnd={markerEnd} interactionWidth={12} /></g>;
}
const nodeTypes = { networkPerson: NetworkPerson };
const edgeTypes = { networkRelation: NetworkRelation };

export function NetworkGraph({ family, root, onSelect }: {
  family: Genealogy; root: string; onSelect: (id: string) => void;
}) {
  const canvas = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const layout = useMemo(() => layoutNetwork(family, root), [family, root]);
  const nodes: NetworkNode[] = useMemo(() => [...layout.positions].map(([id, point]) => {
    const person = family.people.get(id)!;
    return { id, type: "networkPerson", width: NETWORK_WIDTH, height: NETWORK_HEIGHT,
      position: { x: point.x - NETWORK_WIDTH / 2, y: point.y - NETWORK_HEIGHT / 2 },
      data: { name: displayName(person), dates: person.birth?.date || person.death ? lifespan(person) : undefined,
        root: id === root, onSelect } };
  }), [layout, family, root, onSelect]);
  const edges: NetworkEdge[] = useMemo(() => {
    const pairs = new Map<string, typeof layout.relationships>();
    for (const r of layout.relationships) {
      const key = JSON.stringify([r.from, r.to].sort());
      pairs.set(key, [...(pairs.get(key) ?? []), r]);
    }
    return layout.relationships.map((r) => {
      const style = networkStyles[r.type];
      const siblings = pairs.get(JSON.stringify([r.from, r.to].sort()))!;
      const description = `${displayName(family.people.get(r.from)!)} ${edgeLabel(r)} ${displayName(family.people.get(r.to)!)}; ${confidence(r.confidence)}`;
      return { id: r.id, type: "networkRelation", source: r.from, target: r.to,
        ariaLabel: description,
        markerEnd: isParent(r) ? { type: MarkerType.ArrowClosed, color: style.color, width: 14, height: 14 } : undefined,
        style: { stroke: style.color, strokeWidth: 1.6, strokeDasharray: style.dash },
        data: { from: layout.positions.get(r.from)!, to: layout.positions.get(r.to)!,
          bend: (siblings.indexOf(r) - (siblings.length - 1) / 2) * 32 * (r.from < r.to ? 1 : -1), description } };
    });
  }, [layout, family]);
  const legend = useMemo(() => networkLegend(layout.relationships.map((r) => r.type)), [layout]);

  useLayoutEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const centre = () => setViewport((current) => ({ ...current,
      x: element.clientWidth / 2, y: element.clientHeight / 2 }));
    centre();
    const observer = new ResizeObserver(centre);
    observer.observe(element);
    return () => observer.disconnect();
  }, [root]);

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
              <text x="8" y={-distance * layout.step - 7}>{distance} {distance === 1 ? "edge" : "edges"}</text>
            </g>)}
          </svg>
        </ViewportPortal>
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
    <div className="network-legend" aria-label="Network relationship legend">
      <p>Rings count relationship edges. Select a person to re-centre and see their profile.</p>
      {!!legend.length && <p>Arrows point toward the child. Read samples from the centre outward (left to right).</p>}
      <div>{legend.map((entry) => <span key={entry.text}>
        <svg width="34" height="12" viewBox="0 0 34 12" aria-hidden="true">
          <path d="M2 6H32" stroke={entry.color} strokeWidth="1.6" strokeDasharray={entry.dash} />
          {entry.direction !== "none" && <path d={entry.direction === "out" ? "M27 2L32 6L27 10" : "M7 2L2 6L7 10"}
            fill="none" stroke={entry.color} strokeWidth="1.6" />}
        </svg>{entry.text}
      </span>)}</div>
      {!!layout.disconnected.length && <p role="status">{layout.disconnected.length} {layout.disconnected.length === 1 ? "person has" : "people have"} no recorded path to this person and {layout.disconnected.length === 1 ? "is" : "are"} outside this network.</p>}
    </div>
  </div>;
}
