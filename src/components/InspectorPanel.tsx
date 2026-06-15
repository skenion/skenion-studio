import { Alert, Badge, Button, Code, Divider, Group, ScrollArea, Stack, Table, Text } from "@mantine/core";
import { Trash2 } from "lucide-react";
import type { GraphDocumentV01, GraphNodeV01, ValidationResult } from "@skenion/contracts";
import { typeLabel, type ConnectionCheck } from "../graph/skenionGraph";
import { flowColor } from "../graph/reactFlowAdapter";

interface InspectorPanelProps {
  connectionCheck: ConnectionCheck | null;
  graph: GraphDocumentV01;
  node: GraphNodeV01 | null;
  validation: ValidationResult<GraphDocumentV01>;
  onRemoveNode: (node: GraphNodeV01) => void;
}

export function InspectorPanel({
  connectionCheck,
  graph,
  node,
  validation,
  onRemoveNode
}: InspectorPanelProps) {
  return (
    <Stack className="panel-shell" gap="md">
      <div>
        <Text fw={800} size="sm">
          Inspector
        </Text>
        <Text c="dimmed" size="xs">
          {graph.nodes.length} nodes · {graph.edges.length} edges
        </Text>
      </div>

      <ScrollArea className="inspector-scroll" offsetScrollbars>
        <Stack gap="md">
          <Alert color={validation.ok ? "green" : "red"} radius="sm" variant="light">
            <Text fw={700} size="sm">
              {validation.ok ? "Graph contract valid" : "Graph contract invalid"}
            </Text>
            {!validation.ok ? (
              <Stack gap={4} mt="xs">
                {validation.errors.slice(0, 4).map((error) => (
                  <Code block key={error}>
                    {error}
                  </Code>
                ))}
              </Stack>
            ) : null}
          </Alert>

          {connectionCheck ? (
            <Alert color={connectionCheck.ok ? "green" : "red"} radius="sm" variant="light">
              {connectionCheck.message}
            </Alert>
          ) : null}

          <Divider />

          {node ? (
            <Stack gap="sm">
              <Group justify="space-between" wrap="nowrap">
                <div>
                  <Text fw={800}>{String(node.params.label ?? node.id)}</Text>
                  <Text c="dimmed" size="xs">
                    {node.kind}@{node.kindVersion}
                  </Text>
                </div>
                <Button
                  color="red"
                  leftSection={<Trash2 size={15} />}
                  onClick={() => onRemoveNode(node)}
                  radius="sm"
                  size="compact-sm"
                  variant="light"
                >
                  Delete
                </Button>
              </Group>

              <Table className="ports-table" highlightOnHover withColumnBorders={false} withRowBorders={false}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Port</Table.Th>
                    <Table.Th>Type</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {node.ports.map((port) => (
                    <Table.Tr key={port.id}>
                      <Table.Td>
                        <Group gap={6} wrap="nowrap">
                          <span
                            className="flow-swatch"
                            style={{ background: flowColor(port.type.flow, port.type.dataKind) }}
                          />
                          <Text size="sm">{port.label ?? port.id}</Text>
                        </Group>
                        <Text c="dimmed" size="xs">
                          {port.direction}
                          {port.activation ? ` · ${port.activation}` : ""}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge radius="sm" variant="light">
                          {typeLabel(port.type)}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Stack>
          ) : (
            <Text c="dimmed" size="sm">
              Select a node or edge on the canvas.
            </Text>
          )}
        </Stack>
      </ScrollArea>
    </Stack>
  );
}
