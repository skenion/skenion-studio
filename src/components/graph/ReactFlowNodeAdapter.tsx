import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { NodeCard } from "../node/NodeCard";
import type { NodePortSide, NodePortView } from "../node/nodeTypes";
import type { SkenionNodeData } from "../../graph/reactFlowAdapter";

type ReactFlowNodeAdapterProps = NodeProps<Node<SkenionNodeData>>;

export function ReactFlowNodeAdapter({ data, selected }: ReactFlowNodeAdapterProps) {
  return (
    <NodeCard
      {...data.card}
      selected={selected}
      renderInputHandle={(port, side) => <ReactFlowPortHandle port={port} side={side} />}
      renderOutputHandle={(port, side) => <ReactFlowPortHandle port={port} side={side} />}
    />
  );
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
      className={`port-handle port-handle-${side}`}
      id={port.id}
      position={side === "input" ? Position.Left : Position.Right}
      style={{
        background: port.color,
        borderColor: port.color
      }}
      type={side === "input" ? "target" : "source"}
    />
  );
}
