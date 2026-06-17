import { Badge, Button, Group, Stack, Text } from "@mantine/core";
import { ExternalLink } from "lucide-react";
import type { BuiltinNodeHelpV01, GraphDocumentV01 } from "@skenion/contracts";
import { HelpGraphViewer } from "../help/HelpGraphViewer";

export function NodeHelp({
  help,
  helpGraph,
  onOpenAsNewGraph
}: {
  help: BuiltinNodeHelpV01;
  helpGraph?: GraphDocumentV01;
  onOpenAsNewGraph?: () => void;
}) {
  return (
    <Stack
      gap={6}
      p="xs"
      style={{
        border: "1px solid var(--mantine-color-default-border)",
        borderRadius: 6
      }}
    >
      <Text fw={800} size="sm">
        {help.summary}
      </Text>
      <Text c="dimmed" size="xs">
        {help.description}
      </Text>
      {help.tags.length > 0 ? (
        <Group gap={4}>
          {help.tags.map((tag) => (
            <Badge key={tag} radius="sm" size="xs" variant="light">
              {tag}
            </Badge>
          ))}
        </Group>
      ) : null}
      {help.runtimeBehavior ? (
        <Text c="dimmed" size="xs">
          Runtime: {help.runtimeBehavior}
        </Text>
      ) : null}
      {help.ports?.length ? (
        <Stack gap={3}>
          <Text fw={700} size="xs">
            Ports
          </Text>
          {help.ports.map((port) => (
            <Text c="dimmed" key={port.id} size="xs">
              {port.id}: {port.description}
            </Text>
          ))}
        </Stack>
      ) : null}
      {help.params?.length ? (
        <Stack gap={3}>
          <Text fw={700} size="xs">
            Params
          </Text>
          {help.params.map((param) => (
            <Text c="dimmed" key={param.id} size="xs">
              {param.id}: {param.description}
            </Text>
          ))}
        </Stack>
      ) : null}
      {help.relatedNodes?.length ? (
        <Stack gap={3}>
          <Text fw={700} size="xs">
            Related
          </Text>
          <Text c="dimmed" size="xs">
            {help.relatedNodes.join(", ")}
          </Text>
        </Stack>
      ) : null}
      {helpGraph ? (
        <Stack gap={6}>
          <Group justify="space-between">
            <Text fw={700} size="xs">
              Help Graph
            </Text>
            {onOpenAsNewGraph ? (
              <Button
                leftSection={<ExternalLink size={14} />}
                onClick={onOpenAsNewGraph}
                radius="sm"
                size="compact-xs"
                variant="light"
              >
                Open as New Graph
              </Button>
            ) : null}
          </Group>
          <HelpGraphViewer graph={helpGraph} />
        </Stack>
      ) : null}
    </Stack>
  );
}
