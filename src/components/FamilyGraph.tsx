import { useEffect, useMemo, useState, useRef, type RefObject } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  MarkerType,
  useReactFlow,
  useNodesInitialized,
} from "@xyflow/react";
import {
  Genealogy,
  displayName,
  lifespan,
  edgeLabel,
} from "../domain/genealogy";
import { isParent, confidence, type Person } from "../domain/types";
import { Avatar, ConfidenceBadge } from "./PersonUI";
import "@xyflow/react/dist/style.css";

export type View = "family" | "ancestors" | "descendants" | "path";
type PersonNodeData = {
  person: Person;
  root: boolean;
  caption?: string;
  horizontal: boolean;
  onSelect: (id: string) => void;
};
type FamilyNode = Node<PersonNodeData, "person">;
function PersonNode({ data }: NodeProps<FamilyNode>) {
  return (
    <>
      <Handle
        type="target"
        position={data.horizontal ? Position.Left : Position.Top}
      />
      <button
        className={`graph-person nodrag nopan ${data.root ? "root" : ""}`}
        onClick={(event) => {
          event.stopPropagation();
          data.onSelect(data.person.id);
        }}
        aria-label={`Explore ${displayName(data.person)}`}
      >
        <Avatar person={data.person} />
        <span>
          <strong>{displayName(data.person)}</strong>
          <small>{lifespan(data.person)}</small>
          {data.caption && <em>{data.caption}</em>}
        </span>
      </button>
      <Handle
        type="source"
        position={data.horizontal ? Position.Right : Position.Bottom}
      />
    </>
  );
}
const nodeTypes = { person: PersonNode };

function InitialViewport({
  root,
  container,
}: {
  root: string;
  container: RefObject<HTMLDivElement | null>;
}) {
  const initialized = useNodesInitialized();
  const { getNode, setCenter, fitView } = useReactFlow();
  useEffect(() => {
    if (!initialized) return;
    let cancelled = false;
    void fitView({ padding: 0.15, minZoom: 0.65, maxZoom: 1 }).then(() => {
      if (
        cancelled ||
        !container.current ||
        container.current.clientWidth >= 600
      )
        return;
      const node = getNode(root);
      if (node)
        void setCenter(node.position.x + 95, node.position.y + 47.5, {
          zoom: 0.95,
        });
    });
    return () => {
      cancelled = true;
    };
  }, [initialized, root, container, getNode, setCenter, fitView]);
  return null;
}

export function FamilyGraph({
  family,
  root,
  view,
  generations,
  target,
  onSelect,
}: {
  family: Genealogy;
  root: string;
  view: View;
  generations: number;
  target: string;
  onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<FamilyNode[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true);
  const path = useMemo(
    () => (view === "path" ? family.path(root, target) : null),
    [family, view, root, target],
  );
  const ids = useMemo(
    () =>
      view === "family"
        ? family.immediate(root)
        : view === "path"
          ? new Set(path?.people ?? [])
          : new Set(family.traverse(root, view, generations).keys()),
    [family, root, view, generations, path],
  );
  const edges: Edge[] = useMemo(() => {
    const relations =
      view === "path"
        ? (path?.edges ?? [])
        : family.data.relationships.filter(
            (r) =>
              ids.has(r.from) &&
              ids.has(r.to) &&
              (view === "family" || isParent(r)),
          );
    return relations.map((r, i) => {
      const reversed = view === "path" && path!.people[i] !== r.from;
      const level = confidence(r.confidence);
      return {
        id: r.id,
        source: reversed ? r.to : r.from,
        target: reversed ? r.from : r.to,
        type: "smoothstep",
        label: `${edgeLabel(r, reversed ? r.to : r.from)}${level !== "confirmed" ? ` · ${level}` : ""}`,
        markerEnd: isParent(r)
          ? {
              type: MarkerType.ArrowClosed,
              color: "#9ba9a2",
              width: 13,
              height: 13,
            }
          : undefined,
        style: {
          stroke: level === "confirmed" ? "#9ba9a2" : "#ab8759",
          strokeWidth: 1.5,
          strokeDasharray:
            level === "confirmed"
              ? undefined
              : level === "probable"
                ? "7 3"
                : "3 4",
        },
        labelStyle: { fill: "#55625b", fontSize: 10 },
        labelBgStyle: { fill: "#f7f8f4", fillOpacity: 0.95 },
        labelBgPadding: [5, 3] as [number, number],
        ariaLabel: `${displayName(family.people.get(r.from)!)} ${edgeLabel(r)} ${displayName(family.people.get(r.to)!)}; ${level}`,
      };
    });
  }, [family, ids, view, path]);
  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError("");
    const people = [...ids];
    const captions = new Map<string, string>();
    if (view === "family") {
      family
        .siblings(root)
        .forEach((s) =>
          captions.set(
            s.id,
            s.half
              ? "Half-sibling"
              : s.kind === "family"
                ? "Family sibling"
                : "Sibling",
          ),
        );
      family
        .parents(root)
        .forEach((id) => captions.set(id, "Parent / guardian"));
      family
        .partners(root)
        .forEach((id) => captions.set(id, "Spouse / partner"));
      family.children(root).forEach((id) => captions.set(id, "Child"));
    }
    const base = people.map((id) => ({
      id,
      type: "person" as const,
      position: { x: 0, y: 0 },
      data: {
        person: family.people.get(id)!,
        root: id === root,
        horizontal: view === "path",
        caption: id === root ? "Selected person" : captions.get(id),
        onSelect,
      },
    }));
    const layout = async () => {
      if (view === "family") {
        const parents = new Set(family.parents(root)),
          children = new Set(family.children(root));
        const rows = [
          people.filter((id) => parents.has(id) && id !== root),
          people.filter(
            (id) => id === root || (!parents.has(id) && !children.has(id)),
          ),
          people.filter(
            (id) => children.has(id) && !parents.has(id) && id !== root,
          ),
        ];
        const middle = rows[1].filter((id) => id !== root),
          center = Math.floor(middle.length / 2);
        middle.splice(center, 0, root);
        rows[1] = middle;
        return base.map((node) => {
          const row = rows.findIndex((r) => r.includes(node.id));
          return {
            ...node,
            position: {
              x:
                (rows[row].indexOf(node.id) - (rows[row].length - 1) / 2) * 235,
              y: row * 210,
            },
          };
        });
      }
      const { default: ELK } = await import("elkjs/lib/elk.bundled.js");
      const graph = await new ELK().layout({
        id: "family",
        layoutOptions: {
          "elk.algorithm": "layered",
          "elk.direction": view === "path" ? "RIGHT" : "DOWN",
          "elk.spacing.nodeNode": "50",
          "elk.layered.spacing.nodeNodeBetweenLayers": "115",
          "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
        },
        children: people.map((id) => ({ id, width: 190, height: 95 })),
        edges: edges.map((edge) => ({
          id: edge.id,
          sources: [edge.source],
          targets: [edge.target],
        })),
      });
      return base.map((node) => {
        const position = graph.children!.find((n) => n.id === node.id)!;
        return {
          ...node,
          position: { x: position.x ?? 0, y: position.y ?? 0 },
        };
      });
    };
    layout()
      .then((result) => {
        if (!cancelled) {
          setNodes(result);
          setBusy(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(`Unable to lay out this family: ${String(err)}`);
          setBusy(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [family, root, view, ids, edges, onSelect]);
  if (error)
    return (
      <div className="graph-message" role="alert">
        {error}
      </div>
    );
  if (view === "path" && !path)
    return (
      <div className="graph-message">
        <h3>No recorded connection</h3>
        <p>These people are not connected in the current records.</p>
      </div>
    );
  return (
    <div ref={container} className="graph-canvas" aria-label={`${view} graph`}>
      {busy ? (
        <div className="graph-message" role="status">
          Arranging the family…
        </div>
      ) : (
        <ReactFlow
          key={`${root}-${view}-${generations}-${target}`}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          minZoom={0.15}
          maxZoom={1.8}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          onNodeClick={(_, node) => onSelect(node.id)}
          proOptions={{ hideAttribution: true }}
        >
          <InitialViewport root={root} container={container} />
          <Background color="#dce2d8" gap={22} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      )}
      <div className="graph-legend">
        <span>
          <i />
          Confirmed
        </span>
        <span>
          <i className="dashed" />
          Uncertain <ConfidenceBadge value="possible" />
        </span>
      </div>
    </div>
  );
}
