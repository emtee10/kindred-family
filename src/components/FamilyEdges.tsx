import {
  BaseEdge,
  EdgeText,
  getSmoothStepPath,
  useNodes,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import {
  familyConnectorGeometry,
  PERSON_HEIGHT,
  PERSON_WIDTH,
  type FamilyConnection,
  type PersonRect,
} from "../domain/family-connections";

type ConnectorEdge = Edge<{ group: FamilyConnection; description: string }, "familyConnector">;
type PartnerEdge = Edge<{ bridge: boolean; lane: number; description: string; showLabel: boolean }, "familyPartner">;

function FamilyConnector({ data, style, label, labelStyle, labelBgStyle }: EdgeProps<ConnectorEdge>) {
  const nodes = useNodes();
  const rects = new Map<string, PersonRect>(nodes.map((node) => [node.id, {
    ...node.position,
    width: node.measured?.width ?? PERSON_WIDTH,
    height: node.measured?.height ?? PERSON_HEIGHT,
  }]));
  if (!data) return null;
  const geometry = familyConnectorGeometry(data.group, rects);
  if (!geometry) return null;
  return (
    <g className="family-connector">
      <title>{data.description}</title>
      {geometry.paths.map((path, index) => (
        <BaseEdge key={index} path={path} style={style} interactionWidth={12} />
      ))}
      {geometry.junctions.map((point, index) => (
        <circle key={index} cx={point.x} cy={point.y} r={2.5} fill={style?.stroke ?? "#9ba9a2"} />
      ))}
      {label && <EdgeText
        x={geometry.label.x} y={geometry.label.y} label={label}
        labelStyle={labelStyle} labelBgStyle={labelBgStyle} labelBgPadding={[5, 3]}
      />}
    </g>
  );
}

function FamilyPartner({
  data, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  style, label, labelStyle, labelBgStyle,
}: EdgeProps<PartnerEdge>) {
  const nodes = useNodes();
  if (!data) return null;
  let [path, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 6,
  });
  if (data.bridge) {
    const from = nodes.find((node) => node.id === source);
    const to = nodes.find((node) => node.id === target);
    if (!from || !to) return null;
    const rowY = Math.min(from.position.y, to.position.y);
    const bridgeY = rowY - 18 - data.lane * 16;
    const direction = sourceX < targetX ? 1 : -1;
    const fromX = sourceX + direction * 12;
    const toX = targetX - direction * 12;
    path = `M ${sourceX} ${sourceY} L ${fromX} ${sourceY} L ${fromX} ${bridgeY} L ${toX} ${bridgeY} L ${toX} ${targetY} L ${targetX} ${targetY}`;
    labelX = (fromX + toX) / 2;
    labelY = bridgeY;
  }
  return (
    <g className="family-partner">
      <title>{data.description}</title>
      <BaseEdge path={path} style={style} interactionWidth={12} />
      <g className={data.showLabel ? undefined : "family-edge-details"}>
        <EdgeText x={labelX} y={labelY} label={label} labelStyle={labelStyle}
          labelBgStyle={labelBgStyle} labelBgPadding={[5, 3]} />
      </g>
    </g>
  );
}

export const familyEdgeTypes = { familyConnector: FamilyConnector, familyPartner: FamilyPartner };
