import { Badge, Group, Text } from "@mantine/core";
import type { CSSProperties } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { PortV01 } from "@skenion/contracts";
import { flowColor, flowName, type SkenionNodeData } from "../graph/reactFlowAdapter";
import { typeLabel } from "../graph/skenionGraph";

type CanvasNodeProps = NodeProps<Node<SkenionNodeData>>;

export function CanvasNode({ data, selected }: CanvasNodeProps) {
  const inputPorts = data.ports.filter((port) => port.direction === "input");
  const outputPorts = data.ports.filter((port) => port.direction === "output");
  const primaryPort = outputPorts[0] ?? inputPorts[0];
  const color = primaryPort ? flowColor(primaryPort.type.flow, primaryPort.type.dataKind) : "#868e96";
  const style = { "--node-accent": color } as CSSProperties;

  return (
    <div className={`canvas-node ${selected ? "is-selected" : ""}`} style={style}>
      <div className="canvas-node-header">
        <div>
          <Text fw={800} size="sm">
            {data.label}
          </Text>
          <Text c="dimmed" size="xs">
            {data.kind}
          </Text>
        </div>
        {primaryPort ? (
          <Badge radius="sm" size="xs" variant="light">
            {flowName(primaryPort.type.flow, primaryPort.type.dataKind)}
          </Badge>
        ) : null}
      </div>

      <div className="canvas-node-ports">
        <PortColumn ports={inputPorts} side="input" />
        <PortColumn ports={outputPorts} side="output" />
      </div>
    </div>
  );
}

function PortColumn({ ports, side }: { ports: PortV01[]; side: "input" | "output" }) {
  return (
    <div className={`port-column port-column-${side}`}>
      {ports.map((port, index) => {
        const color = flowColor(port.type.flow, port.type.dataKind);
        const top = 74 + index * 30;

        return (
          <div className="port-row" key={port.id}>
            <Handle
              id={port.id}
              position={side === "input" ? Position.Left : Position.Right}
              style={{
                background: color,
                borderColor: color,
                top
              }}
              type={side === "input" ? "target" : "source"}
            />
            <Group className="port-label" gap={5} justify={side === "input" ? "flex-start" : "flex-end"} wrap="nowrap">
              {side === "input" ? <span className="flow-swatch" style={{ background: color }} /> : null}
              <Text size="xs" truncate>
                {port.label ?? port.id}
              </Text>
              {side === "output" ? <span className="flow-swatch" style={{ background: color }} /> : null}
            </Group>
            <Text c="dimmed" className="port-type" size="10px" ta={side === "input" ? "left" : "right"} truncate>
              {typeLabel(port.type)}
            </Text>
          </div>
        );
      })}
    </div>
  );
}
