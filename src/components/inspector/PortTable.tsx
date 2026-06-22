import { Badge, Group, Table, Text } from "@mantine/core";
import type { DisplayGraphNodeV01 } from "../../graph/patchLibrary";
import { portSemanticsForPort, semanticTypeColor } from "../../graph/portSemantics";
import { typeLabel } from "../../graph/skenionGraph";

export function PortTable({ node }: { node: DisplayGraphNodeV01 }) {
  return (
    <Table className="ports-table" highlightOnHover withColumnBorders={false} withRowBorders={false}>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Port</Table.Th>
          <Table.Th>Type</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {node.ports.map((port) => {
          const semantics = portSemanticsForPort(node, port);
          const connectionPolicy =
            semantics.direction === "input"
              ? `max ${semantics.maxConnections ?? "unbounded"} · ${semantics.mergePolicy}`
              : semantics.fanOutPolicy;

          return (
            <Table.Tr key={port.id}>
              <Table.Td>
                <Group gap={6} wrap="nowrap">
                  <span
                    className="flow-swatch"
                    style={{ background: semanticTypeColor(semantics.type) }}
                  />
                  <Text size="sm">{semantics.label}</Text>
                </Group>
                <Text c="dimmed" size="xs">
                  {semantics.direction} · {semantics.rate} · {connectionPolicy}
                </Text>
                {semantics.description ? (
                  <Text c="dimmed" size="xs">
                    {semantics.description}
                  </Text>
                ) : null}
              </Table.Td>
              <Table.Td>
                <Badge variant="light">
                  {semantics.type}
                </Badge>
                {semantics.storedType !== semantics.type ? (
                  <Text c="dimmed" mt={4} size="10px">
                    stored {typeLabel(port.type)}
                  </Text>
                ) : null}
              </Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}
