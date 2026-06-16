import { Text } from "@mantine/core";
import { NodeTypeBadge } from "./NodeTypeBadge";

export function NodeHeader({
  kind,
  label,
  typeBadgeLabel
}: {
  kind: string;
  label: string;
  typeBadgeLabel?: string;
}) {
  return (
    <div className="canvas-node-header">
      <div>
        <Text fw={800} size="sm">
          {label}
        </Text>
        <Text c="dimmed" size="xs">
          {kind}
        </Text>
      </div>
      {typeBadgeLabel ? <NodeTypeBadge label={typeBadgeLabel} /> : null}
    </div>
  );
}
