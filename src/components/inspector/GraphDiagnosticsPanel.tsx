import { Alert, Badge, Code, Group, Stack, Text } from "@mantine/core";
import type { GraphDocumentV01, ValidationResult } from "@skenion/contracts";
import type { GraphSemanticDiagnostic } from "../../graph/portSemantics";

export function GraphDiagnosticsPanel({
  semanticDiagnostics,
  validation
}: {
  semanticDiagnostics: GraphSemanticDiagnostic[];
  validation: ValidationResult<GraphDocumentV01>;
}) {
  const errorCount = semanticDiagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const warningCount = semanticDiagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;
  const color = validation.ok && errorCount === 0 ? (warningCount > 0 ? "yellow" : "green") : "red";

  return (
    <Alert color={color} radius="sm" variant="light">
      <Group justify="space-between" wrap="nowrap">
        <Text fw={700} size="sm">
          {validation.ok && errorCount === 0 ? "Graph validation clear" : "Graph validation failed"}
        </Text>
        <Group gap={6} wrap="nowrap">
          <Badge color={errorCount > 0 || !validation.ok ? "red" : "gray"} radius="sm" size="xs">
            {validation.ok ? errorCount : errorCount + validation.errors.length} errors
          </Badge>
          <Badge color={warningCount > 0 ? "yellow" : "gray"} radius="sm" size="xs">
            {warningCount} warnings
          </Badge>
        </Group>
      </Group>

      {!validation.ok ? (
        <Stack gap={4} mt="xs">
          {validation.errors.slice(0, 4).map((error) => (
            <Code block key={error}>
              {error}
            </Code>
          ))}
        </Stack>
      ) : null}

      {semanticDiagnostics.length > 0 ? (
        <Stack gap={4} mt="xs">
          {semanticDiagnostics.slice(0, 5).map((diagnostic) => (
            <Code block key={`${diagnostic.code}:${diagnostic.message}`}>
              {diagnostic.severity}: {diagnostic.code} · {diagnostic.message}
            </Code>
          ))}
        </Stack>
      ) : null}
    </Alert>
  );
}
