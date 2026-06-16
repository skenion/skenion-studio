import { Group, Stack, Text, Tooltip } from "@mantine/core";
import type { ReactNode } from "react";
import { NodePortHandle } from "./NodePortHandle";
import type { NodePortSide, NodePortView } from "./nodeTypes";

export interface NodePortRowProps {
  port: NodePortView;
  side: NodePortSide;
  selected?: boolean;
  compatible?: boolean;
  incompatible?: boolean;
  handle?: ReactNode;
}

export function NodePortRow({
  compatible,
  handle,
  incompatible,
  port,
  selected,
  side
}: NodePortRowProps) {
  const className = [
    "port-row",
    selected ? "is-selected" : "",
    compatible ? "is-compatible" : "",
    incompatible ? "is-incompatible" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      {handle ?? <NodePortHandle color={port.color} side={side} />}
      <Tooltip
        label={<PortTooltipContent port={port} />}
        multiline
        openDelay={250}
        position={side === "input" ? "left" : "right"}
        withArrow
      >
        <div>
          <Group
            className="port-label"
            gap={5}
            justify={side === "input" ? "flex-start" : "flex-end"}
            wrap="nowrap"
          >
            {side === "input" ? <span className="flow-swatch" style={{ background: port.color }} /> : null}
            <Text size="xs" truncate>
              {port.label}
            </Text>
            {side === "output" ? <span className="flow-swatch" style={{ background: port.color }} /> : null}
          </Group>
          <Text c="dimmed" className="port-type" size="10px" ta={side === "input" ? "left" : "right"}>
            {port.typeLabel}
          </Text>
        </div>
      </Tooltip>
    </div>
  );
}

function PortTooltipContent({ port }: { port: NodePortView }) {
  const metadata = port.metadata ?? {};
  const connectionLabel =
    port.direction === "input"
      ? `max ${metadata.maxConnections ?? "unbounded"} · merge ${metadata.mergePolicy ?? "forbid"}`
      : `fan-out ${metadata.fanOutPolicy ?? "allow"}`;

  return (
    <Stack gap={2}>
      <Text fw={700} size="xs">
        {port.label}
      </Text>
      <Text size="xs">type {port.typeLabel}</Text>
      {port.storedTypeLabel && port.storedTypeLabel !== port.typeLabel ? (
        <Text size="xs">stored {port.storedTypeLabel}</Text>
      ) : null}
      <Text size="xs">rate {metadata.rate ?? "control"}</Text>
      <Text size="xs">{connectionLabel}</Text>
      <Text size="xs">trigger {metadata.triggerMode ?? "passive"}</Text>
      {metadata.required ? <Text size="xs">required</Text> : null}
    </Stack>
  );
}
