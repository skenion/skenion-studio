import { Text } from "@mantine/core";
import { NodePortRow } from "./NodePortRow";
import type { NodePortHandleRenderer, NodePortSide, NodePortView } from "./nodeTypes";

export function NodePortColumn({
  ports,
  renderHandle,
  side
}: {
  ports: NodePortView[];
  renderHandle?: NodePortHandleRenderer;
  side: NodePortSide;
}) {
  return (
    <div className={`port-column port-column-${side}`}>
      <Text c="dimmed" className="port-column-title" size="10px" tt="uppercase">
        {side === "input" ? "IN" : "OUT"}
      </Text>
      {ports.length === 0 ? (
        <Text c="dimmed" className="port-empty" size="10px" ta={side === "input" ? "left" : "right"}>
          {side === "input" ? "No inlets" : "No outlets"}
        </Text>
      ) : null}
      {ports.map((port) => (
        <NodePortRow
          handle={renderHandle?.(port, side)}
          key={port.id}
          port={port}
          side={side}
        />
      ))}
    </div>
  );
}
