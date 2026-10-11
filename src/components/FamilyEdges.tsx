import {
  BaseEdge,
  EdgeText,
  useNodes,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import {
  familyConnectorGeometry,
  partnerConnectorGeometry,
  supplementalConnectorGeometry,
  PERSON_HEIGHT,
  PERSON_WIDTH,
  type FamilyConnection,
  type PersonRect,
  type PartnerConnection,
  type SupplementalConnection,
} from "../domain/family-connections";

type ConnectorEdge = Edge<{
  group: FamilyConnection;
  description: string;
  childDetails?: Record<string, { style: Edge["style"]; label?: string }>;
}, "familyConnector">;
type PartnerEdge = Edge<{ partner: PartnerConnection; description: string; showLabel: boolean }, "familyPartner">;
type SupplementalEdge = Edge<{ connection: SupplementalConnection; description: string }, "familySupplemental">;

function usePersonRects() {
  const nodes = useNodes();
  return new Map<string, PersonRect>(nodes.map((node) => [node.id, {
    ...node.position,
    width: node.measured?.width ?? PERSON_WIDTH,
    height: node.measured?.height ?? PERSON_HEIGHT,
  }]));
}

function FamilyConnector({ data, style, label, labelStyle, labelBgStyle }: EdgeProps<ConnectorEdge>) {
  const rects = usePersonRects();
  if (!data) return null;
  const geometry = familyConnectorGeometry(data.group, rects);
  if (!geometry) return null;
  return (
    <g className="family-connector">
      <title>{data.description}</title>
      {geometry.sharedPaths.map((path, index) => (
        <BaseEdge key={index} path={path} style={style} interactionWidth={12} />
      ))}
      {geometry.childBranches.map((branch) => {
        const detail = data.childDetails?.[branch.child];
        return <g key={branch.child}>
          <BaseEdge path={branch.path} style={detail?.style ?? style} interactionWidth={12} />
          {detail?.label && <EdgeText x={branch.label.x} y={branch.label.y} label={detail.label}
            labelStyle={labelStyle} labelBgStyle={labelBgStyle} labelBgPadding={[5, 3]} />}
        </g>;
      })}
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
  data, style, label, labelStyle, labelBgStyle,
}: EdgeProps<PartnerEdge>) {
  const rects = usePersonRects();
  if (!data) return null;
  const geometry = partnerConnectorGeometry(data.partner, rects);
  if (!geometry) return null;
  return (
    <g className="family-partner">
      <title>{data.description}</title>
      <BaseEdge path={geometry.path} style={style} interactionWidth={12} />
      <g className={data.showLabel ? undefined : "family-edge-details"}>
        <EdgeText x={geometry.midpoint.x} y={geometry.midpoint.y} label={label} labelStyle={labelStyle}
          labelBgStyle={labelBgStyle} labelBgPadding={[5, 3]} />
      </g>
    </g>
  );
}

function FamilySupplemental({ data, style, label, labelStyle, labelBgStyle }: EdgeProps<SupplementalEdge>) {
  const rects = usePersonRects();
  if (!data) return null;
  const geometry = supplementalConnectorGeometry(data.connection, rects);
  if (!geometry) return null;
  return <g className="family-supplemental">
    <title>{data.description}</title>
    <BaseEdge path={geometry.path} style={style} interactionWidth={12} />
    {label && <EdgeText x={geometry.label.x} y={geometry.label.y} label={label}
      labelStyle={labelStyle} labelBgStyle={labelBgStyle} labelBgPadding={[5, 3]} />}
  </g>;
}

export const familyEdgeTypes = {
  familyConnector: FamilyConnector, familyPartner: FamilyPartner, familySupplemental: FamilySupplemental,
};
