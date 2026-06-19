import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { CSSProperties } from "react";
import { ObjectNodeRenderer } from "./ObjectNodeRenderer";
import type { NodePortSide, NodePortView } from "../node/nodeTypes";
import type { SkenionNodeData } from "../../graph/reactFlowAdapter";
import socketStyles from "../node/PortSocket.module.css";

type ReactFlowNodeAdapterProps = NodeProps<Node<SkenionNodeData>>;

export function ReactFlowNodeAdapter({ data, selected }: ReactFlowNodeAdapterProps) {
  const objectNode = ObjectNodeRenderer({
    card: data.card,
    node: data.node,
    layoutEditable: data.layoutEditable,
    onObjectControl: data.onObjectControl,
    onObjectLiveControl: data.onObjectLiveControl,
    onObjectParamChange: data.onObjectParamChange,
    runtimeControlEnabled: data.runtimeControlEnabled,
    runtimeControlPulseKey: data.runtimeControlPulseKey,
    runtimeControlValue: data.runtimeControlValue,
    selected,
    renderInputHandle: (port, side) => <ReactFlowPortHandle port={port} side={side} />,
    renderOutputHandle: (port, side) => <ReactFlowPortHandle port={port} side={side} />
  });
  return objectNode;
}

function ReactFlowPortHandle({
  port,
  side
}: {
  port: NodePortView;
  side: NodePortSide;
}) {
  return (
    <Handle
      aria-label={`${side === "input" ? "Input" : "Output"} port ${port.label}`}
      className={`port-handle ${socketStyles.portHandle} port-handle-${port.typeLabel
        .replace(/[^a-z0-9]+/gi, "-")
        .toLowerCase()}`}
      id={port.id}
      position={side === "input" ? Position.Top : Position.Bottom}
      style={{
        "--port-color": port.color
      } as CSSProperties}
      type={side === "input" ? "target" : "source"}
    />
  );
}
