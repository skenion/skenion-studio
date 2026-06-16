import { Badge, Group, Stack, Text, Tooltip } from "@mantine/core";
import type { CSSProperties } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { PortV01 } from "@skenion/contracts";
import { flowColor, flowName, type SkenionNodeData } from "../graph/reactFlowAdapter";
import { portSemanticsForPort, semanticTypeColor } from "../graph/portSemantics";

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
        <PortColumn kind={data.kind} kindVersion={data.kindVersion} ports={inputPorts} side="input" />
        <PortColumn kind={data.kind} kindVersion={data.kindVersion} ports={outputPorts} side="output" />
      </div>
    </div>
  );
}

function PortColumn({
  kind,
  kindVersion,
  ports,
  side
}: {
  kind: string;
  kindVersion: string;
  ports: PortV01[];
  side: "input" | "output";
}) {
  return (
    <div className={`port-column port-column-${side}`}>
      <Text c="dimmed" className="port-column-title" size="10px" tt="uppercase">
        {side === "input" ? "Inlets" : "Outlets"}
      </Text>
      {ports.length === 0 ? (
        <Text c="dimmed" className="port-empty" size="10px" ta={side === "input" ? "left" : "right"}>
          {side === "input" ? "No inlets" : "No outlets"}
        </Text>
      ) : null}
      {ports.map((port) => {
        const semantics = portSemanticsForPort(
          { id: "preview", kind, kindVersion, params: {}, ports: [port] },
          port
        );
        const color = semanticTypeColor(semantics.type);

        return (
          <div className="port-row" key={port.id}>
            <Tooltip
              label={<PortTooltipContent semantics={semantics} />}
              multiline
              openDelay={250}
              position={side === "input" ? "left" : "right"}
              withArrow
            >
              <div>
                <Handle
                  className={`port-handle port-handle-${side}`}
                  id={port.id}
                  position={side === "input" ? Position.Left : Position.Right}
                  style={{
                    background: color,
                    borderColor: color
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
                <Text c="dimmed" className="port-type" size="10px" ta={side === "input" ? "left" : "right"}>
                  {semantics.type}
                </Text>
              </div>
            </Tooltip>
          </div>
        );
      })}
    </div>
  );
}

function PortTooltipContent({ semantics }: { semantics: ReturnType<typeof portSemanticsForPort> }) {
  const connectionLabel =
    semantics.direction === "input"
      ? `max ${semantics.maxConnections ?? "unbounded"} · merge ${semantics.mergePolicy}`
      : `fan-out ${semantics.fanOutPolicy}`;

  return (
    <Stack gap={2}>
      <Text fw={700} size="xs">
        {semantics.label}
      </Text>
      <Text size="xs">type {semantics.type}</Text>
      <Text size="xs">stored {semantics.storedType}</Text>
      <Text size="xs">rate {semantics.rate}</Text>
      <Text size="xs">{connectionLabel}</Text>
      <Text size="xs">trigger {semantics.triggerMode}</Text>
      {semantics.group ? <Text size="xs">group {semantics.group}</Text> : null}
    </Stack>
  );
}
