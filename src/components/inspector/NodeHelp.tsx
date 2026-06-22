import { Badge, Group, Stack, Text } from "@mantine/core";
import { ExternalLink } from "lucide-react";
import type { BuiltinNodeHelpV01, GraphFragmentV01 } from "@skenion/contracts";
import {
  isPatchDefinition,
  patchDescription,
  patchDefinitionBoundaryPorts,
  patchDisplayName,
  patchTags,
  type PatchDefinitionV01
} from "../../graph/patchLibrary";
import { HelpGraphViewer, type HelpGraphViewerDocument } from "../help/HelpGraphViewer";
import { Button } from "../core/Button/Button";
import type { GraphFragmentBuildResult } from "../../graph/fragmentClipboard";

export type NodeHelpDocument = BuiltinNodeHelpV01 | PatchDefinitionV01;

export function NodeHelp({
  help,
  helpGraph,
  onClipboardWriteError,
  onCopyFragment,
  onCopyFragmentError,
  onOpenAsEditableCopy
}: {
  help: NodeHelpDocument;
  helpGraph?: HelpGraphViewerDocument;
  onClipboardWriteError?: (message: string) => void;
  onCopyFragment?: (fragment: GraphFragmentV01, result: GraphFragmentBuildResult) => void;
  onCopyFragmentError?: (message: string) => void;
  onOpenAsEditableCopy?: () => void;
}) {
  const view = nodeHelpView(help);
  const graph = helpGraph ?? (isPatchDefinition(help) ? help : undefined);
  const graphTitle = isPatchDefinition(graph) ? "Patch Graph" : "Help Graph";

  return (
    <Stack
      gap={6}
      p="xs"
      style={{
        border: "1px solid var(--mantine-color-default-border)"
      }}
    >
      <Text fw={800} size="sm">
        {view.summary}
      </Text>
      {view.description ? (
        <Text c="dimmed" size="xs">
          {view.description}
        </Text>
      ) : null}
      {view.tags.length > 0 ? (
        <Group gap={4}>
          {view.tags.map((tag) => (
            <Badge key={tag} size="xs" variant="light">
              {tag}
            </Badge>
          ))}
        </Group>
      ) : null}
      {view.runtimeBehavior ? (
        <Text c="dimmed" size="xs">
          Runtime: {view.runtimeBehavior}
        </Text>
      ) : null}
      {view.ports.length ? (
        <Stack gap={3}>
          <Text fw={700} size="xs">
            Ports
          </Text>
          {view.ports.map((port) => (
            <Text c="dimmed" key={port.id} size="xs">
              {port.id}: {port.description}
            </Text>
          ))}
        </Stack>
      ) : null}
      {view.params.length ? (
        <Stack gap={3}>
          <Text fw={700} size="xs">
            Params
          </Text>
          {view.params.map((param) => (
            <Text c="dimmed" key={param.id} size="xs">
              {param.id}: {param.description}
            </Text>
          ))}
        </Stack>
      ) : null}
      {view.relatedNodes.length ? (
        <Stack gap={3}>
          <Text fw={700} size="xs">
            Related
          </Text>
          <Text c="dimmed" size="xs">
            {view.relatedNodes.join(", ")}
          </Text>
        </Stack>
      ) : null}
      {graph ? (
        <Stack gap={6}>
          <Group justify="space-between">
            <Text fw={700} size="xs">
              {graphTitle}
            </Text>
            {onOpenAsEditableCopy ? (
              <Button
                leftSection={<ExternalLink size={14} />}
                onClick={onOpenAsEditableCopy}
                size="compact-xs"
                variant="light"
              >
                Open as editable copy
              </Button>
            ) : null}
          </Group>
          <HelpGraphViewer
            graph={graph}
            onClipboardWriteError={onClipboardWriteError}
            onCopyFragment={onCopyFragment}
            onCopyFragmentError={onCopyFragmentError}
          />
        </Stack>
      ) : null}
    </Stack>
  );
}

interface NodeHelpView {
  summary: string;
  description: string;
  tags: string[];
  runtimeBehavior?: string;
  ports: Array<{ id: string; description: string }>;
  params: Array<{ id: string; description: string }>;
  relatedNodes: string[];
}

function nodeHelpView(help: NodeHelpDocument): NodeHelpView {
  if (!isPatchDefinition(help)) {
    return {
      summary: help.summary,
      description: help.description,
      tags: help.tags,
      runtimeBehavior: help.runtimeBehavior,
      ports: help.ports ?? [],
      params: help.params ?? [],
      relatedNodes: help.relatedNodes ?? []
    };
  }

  return {
    summary: patchDisplayName(help),
    description: patchDescription(help),
    tags: patchTags(help),
    ports: patchDefinitionBoundaryPorts(help).map((port) => ({
      id: port.id,
      description: port.description ?? port.label ?? port.type
    })),
    params: [],
    relatedNodes: []
  };
}
