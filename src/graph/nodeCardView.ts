import type { PortV01 } from "@skenion/contracts";
import type { NodeCardView, NodePortView } from "../components/node/nodeTypes";
import type { DisplayGraphNodeV01 } from "./patchLibrary";
import { portSemanticsForPort, semanticTypeColor } from "./portSemantics";

export function toNodeCardView(node: DisplayGraphNodeV01, selected = false): NodeCardView {
  const inputs = node.ports
    .filter((port) => port.direction === "input")
    .map((port) => toPortView(node, port));
  const outputs = node.ports
    .filter((port) => port.direction === "output")
    .map((port) => toPortView(node, port));
  const primaryPortView = outputs[0] ?? inputs[0];

  return {
    id: node.id,
    label: String(node.params.label ?? node.id),
    kind: node.kind,
    kindVersion: node.kindVersion,
    selected,
    accentColor: primaryPortView?.color ?? "#868e96",
    typeBadgeLabel: primaryPortView?.typeLabel,
    inputs,
    outputs
  };
}

export function toPortView(node: DisplayGraphNodeV01, port: PortV01): NodePortView {
  const semantics = portSemanticsForPort(node, port);

  return {
    id: port.id,
    label: semantics.label,
    description: semantics.description ?? undefined,
    direction: semantics.direction,
    typeLabel: semantics.type,
    storedTypeLabel: semantics.storedType,
    color: semanticTypeColor(semantics.type),
    metadata: {
      rate: semantics.rate,
      maxConnections: semantics.maxConnections,
      mergePolicy: semantics.mergePolicy,
      fanOutPolicy: semantics.fanOutPolicy,
      triggerMode: semantics.triggerMode,
      required: semantics.required
    }
  };
}
