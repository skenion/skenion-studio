import { Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";

export function InspectorShell({
  children,
  edgeCount,
  nodeCount
}: {
  children: ReactNode;
  edgeCount: number;
  nodeCount: number;
}) {
  return (
    <Stack className="panel-shell" gap="md">
      <div>
        <Text fw={800} size="sm">
          Inspector
        </Text>
        <Text c="dimmed" size="xs">
          {nodeCount} nodes · {edgeCount} edges
        </Text>
      </div>
      {children}
    </Stack>
  );
}
