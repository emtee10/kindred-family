import { useEffect, useLayoutEffect, useMemo, useState, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  type Viewport,
  MarkerType,
} from "@xyflow/react";
import {
  Genealogy,
  displayName,
  lifespan,
  edgeLabel,
} from "../domain/genealogy";
import { isParent, confidence, type Person } from "../domain/types";
import { layoutFamily } from "../domain/family-layout";
import { planFamilyConnections } from "../domain/family-connections";
import { familyEdgeTypes } from "./FamilyEdges";
import { Avatar, ConfidenceBadge } from "./PersonUI";
import "@xyflow/react/dist/style.css";

export type View = "family" | "extended" | "ancestors" | "descendants" | "path";
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
      {!data.horizontal && <>
        <Handle id="partner-left-source" type="source" position={Position.Left} className="partner-handle" />
        <Handle id="partner-right-source" type="source" position={Position.Right} className="partner-handle" />
        <Handle id="partner-left-target" type="target" position={Position.Left} className="partner-handle" />
        <Handle id="partner-right-target" type="target" position={Position.Right} className="partner-handle" />
      </>}
    </>
  );
}
const nodeTypes = { person: PersonNode };

export function FamilyGraph({
  family,
  root,
  selected,
  view,
  generations,
  target,
  onSelect,
}: {
  family: Genealogy;
  root: string;
  selected: string;
  view: View;
  generations: number;
  target: string;
  onSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<FamilyNode[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true),
    [viewport, setViewport] = useState<Viewport>({
      x: 0,
      y: 0,
      zoom: 0.95,
    });
  const centeredRoot = useRef<string | undefined>(undefined);
  const path = useMemo(
    () => (view === "path" ? family.path(root, target) : null),
    [family, view, root, target],
  );
  const familyRows = useMemo(
    () =>
      view === "family" || view === "extended"
        ? family.familyMembers(root, view === "extended")
        : new Map<string, number>(),
    [family, root, view],
  );
  const ids = useMemo(
    () =>
      view === "family" || view === "extended"
        ? new Set(familyRows.keys())
        : view === "path"
          ? new Set(path?.people ?? [])
          : new Set(family.traverse(root, view, generations).keys()),
    [family, root, view, generations, path, familyRows],
  );
  const familyPlan = useMemo(() =>
    view === "family" || view === "extended"
      ? planFamilyConnections(family, familyRows, layoutFamily(family, root, familyRows))
      : null,
  [family, familyRows, root, view]);
  const edges: Edge[] = useMemo(() => {
    const relations =
      view === "path"
        ? (path?.edges ?? [])
        : family.data.relationships.filter(
            (r) =>
              ids.has(r.from) &&
              ids.has(r.to) &&
              (view === "family" || view === "extended" || isParent(r)),
          );
    const individualEdges = relations.map((r, i) => {
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
    if (!familyPlan) return individualEdges;
    const byRelation = new Map(individualEdges.map((edge) => [edge.id, edge]));
    const describe = (relationshipId: string) => byRelation.get(relationshipId)!.ariaLabel!;
    return [
      ...familyPlan.direct.map((r) => ({
        ...byRelation.get(r.id)!, id: `relation:${JSON.stringify(r.id)}`,
      })),
      ...familyPlan.groups.map((group) => {
        const relationship = group.relationships[0];
        const edge = byRelation.get(relationship.id)!;
        return {
          ...edge,
          id: group.id,
          source: group.parents[0], target: group.children[0],
          type: "familyConnector", markerEnd: undefined,
          label: relationship.type === "biological_parent" && confidence(relationship.confidence) === "confirmed"
            ? undefined : edge.label,
          ariaLabel: group.relationships.map((r) => describe(r.id)).join(". "),
          data: { group, description: group.relationships.map((r) => describe(r.id)).join(". ") },
        };
      }),
      ...familyPlan.partners.map(({ relationship, bridge, lane }) => {
        const fromLeft = familyPlan.positions.get(relationship.from)!.x < familyPlan.positions.get(relationship.to)!.x;
        return {
          ...byRelation.get(relationship.id)!,
          id: `relation:${JSON.stringify(relationship.id)}`,
          type: "familyPartner",
          sourceHandle: fromLeft ? "partner-right-source" : "partner-left-source",
          targetHandle: fromLeft ? "partner-left-target" : "partner-right-target",
          data: { bridge, lane, description: describe(relationship.id),
            showLabel: confidence(relationship.confidence) !== "confirmed" },
        };
      }),
    ];
  }, [family, ids, view, path, familyPlan]);
  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError("");
    const people = [...ids];
    const captions = new Map<string, string>();
    if (view === "family" || view === "extended") {
      if (view === "extended") {
        const labels: Record<number, string> = {
          [-2]: "Grandparent",
          [-1]: "Aunt / uncle",
          1: "Niece / nephew",
          2: "Grandchild",
        };
        familyRows.forEach((row, id) => {
          if (labels[row]) captions.set(id, labels[row]);
        });
      }
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
      if (view === "family" || view === "extended") {
        const positions = familyPlan!.positions;
        return base.map((node) => ({ ...node, position: positions.get(node.id)! }));
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
  }, [family, root, view, ids, edges, onSelect, familyRows, familyPlan]);
  useLayoutEffect(() => {
    const canvas = container.current;
    const node = nodes.find(({ id }) => id === selected) ??
      nodes.find(({ id }) => id === root);
    if (busy || !canvas || !node) return;

    const rootChanged = centeredRoot.current !== root;
    centeredRoot.current = root;
    setViewport((current) => {
      const zoom = rootChanged ? 0.95 : current.zoom;
      const nodeWidth = node.measured?.width ?? node.width ?? 190;
      const nodeHeight = node.measured?.height ?? node.height ?? 95;
      return {
        x: canvas.clientWidth / 2 - (node.position.x + nodeWidth / 2) * zoom,
        y: canvas.clientHeight / 2 - (node.position.y + nodeHeight / 2) * zoom,
        zoom,
      };
    });
  }, [busy, nodes, root, selected]);
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
          edgeTypes={familyEdgeTypes}
          minZoom={0.15}
          maxZoom={1.8}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          viewport={viewport}
          onViewportChange={setViewport}
          onNodeClick={(_, node) => onSelect(node.id)}
          proOptions={{ hideAttribution: true }}
        >
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
