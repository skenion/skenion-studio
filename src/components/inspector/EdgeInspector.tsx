import { Alert, Badge, Button, Code, Group, Stack, Table, Text } from "@mantine/core";
import { GitBranch } from "lucide-react";
import type { ReactNode } from "react";
import type { EdgeInspectorModel, GraphSemanticDiagnostic } from "../../graph/portSemantics";

export function EdgeInspector({
  diagnostics,
  edge,
  onOpenFeedbackDialog
}: {
  diagnostics: GraphSemanticDiagnostic[];
  edge: EdgeInspectorModel;
  onOpenFeedbackDialog: () => void;
}) {
  return (
    <Stack gap="sm">
      <Group justify="space-between" wrap="nowrap">
        <div>
          <Text fw={800}>Edge</Text>
          <Text c="dimmed" size="xs">
            {edge.id}
          </Text>
        </div>
        <Button
          leftSection={<GitBranch size={14} />}
          onClick={onOpenFeedbackDialog}
          radius="sm"
          size="compact-sm"
          variant="light"
        >
          Feedback
        </Button>
      </Group>

      <Table className="ports-table" withColumnBorders={false} withRowBorders={false}>
        <Table.Tbody>
          <MetadataRow label="Source">
            <Code>{edge.source}</Code>
          </MetadataRow>
          <MetadataRow label="Target">
            <Code>{edge.target}</Code>
          </MetadataRow>
          <MetadataRow label="Resolved">
            <Badge radius="sm" variant="light">
              {edge.resolvedType}
            </Badge>
          </MetadataRow>
          <MetadataRow label="Order">{edge.order ?? "default"}</MetadataRow>
          <MetadataRow label="Enabled">{edge.enabled ? "true" : "false"}</MetadataRow>
          <MetadataRow label="Adapter">{edge.adapter ?? "none"}</MetadataRow>
          <MetadataRow label="Feedback">{edge.feedback ? edge.feedback.boundary : "none"}</MetadataRow>
          <MetadataRow label="Style">{edge.styleOverride ?? "default"}</MetadataRow>
          <MetadataRow label="Conversion">
            {edge.conversion ? (
              <Stack gap={3}>
                <Text size="xs">{edge.conversion.source} → {edge.conversion.target}</Text>
                <Text c={edge.conversion.lossy ? "yellow" : "dimmed"} size="xs">
                  {edge.conversion.policies.join("; ")}
                </Text>
                {edge.conversion.diagnostics.map((diagnostic) => (
                  <Text c="dimmed" key={diagnostic} size="xs">{diagnostic}</Text>
                ))}
              </Stack>
            ) : "identity"}
          </MetadataRow>
        </Table.Tbody>
      </Table>

      {diagnostics.length > 0 ? (
        <Alert color="red" radius="sm" variant="light">
          <Stack gap={4}>
            {diagnostics.map((diagnostic) => (
              <Text key={`${diagnostic.code}:${diagnostic.message}`} size="xs">
                {diagnostic.code}: {diagnostic.message}
              </Text>
            ))}
          </Stack>
        </Alert>
      ) : null}
    </Stack>
  );
}

function MetadataRow({
  children,
  label
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <Table.Tr>
      <Table.Td>{label}</Table.Td>
      <Table.Td>{children}</Table.Td>
    </Table.Tr>
  );
}
