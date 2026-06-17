import { Alert, Badge, Code, Group, Stack, Text } from "@mantine/core";
import type {
  RuntimeActionResponse,
  RuntimeActionResult
} from "../../runtime/types";

export function RuntimeResultSummary({ result }: { result: RuntimeActionResult }) {
  const diagnostics = result.response.diagnostics;
  const plan = responsePlan(result.response);
  const report = responseReport(result.response);
  const emitted = "emitted" in result.response ? result.response.emitted : null;

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text fw={800} size="sm">
          {result.kind}
        </Text>
        <Badge color={result.response.ok ? "green" : "red"} radius="sm" variant="light">
          {result.response.ok ? "ok" : "diagnostics"}
        </Badge>
      </Group>

      {diagnostics.length > 0 ? (
        <Stack gap={4}>
          {diagnostics.slice(0, 5).map((diagnostic) => (
            <Alert
              color={diagnostic.severity === "error" ? "red" : "yellow"}
              key={diagnostic.message}
              radius="sm"
              variant="light"
            >
              {diagnostic.message}
            </Alert>
          ))}
        </Stack>
      ) : (
        <Text c="dimmed" size="xs">
          Runtime diagnostics clear
        </Text>
      )}

      {plan ? (
        <Code block className="runtime-json">
          {JSON.stringify(
            {
              graphId: plan.graphId,
              nodes: plan.nodes.length,
              edges: plan.edges.length,
              groups: plan.groups.map((group) => ({
                executionModel: group.executionModel,
                nodeIds: group.nodeIds
              }))
            },
            null,
            2
          )}
        </Code>
      ) : null}

      {report ? (
        <Code block className="runtime-json">
          {JSON.stringify(
            {
              graphId: report.graphId,
              frameCount: report.frameCount,
              firstFrame: report.frames[0]?.executedNodes.map((node) => ({
                nodeId: node.nodeId,
                order: node.order,
                status: node.status
              }))
            },
            null,
            2
          )}
        </Code>
      ) : null}

      {emitted ? (
        <Code block className="runtime-json">
          {JSON.stringify({ emitted }, null, 2)}
        </Code>
      ) : null}
    </Stack>
  );
}

function responsePlan(response: RuntimeActionResponse) {
  if ("plan" in response) {
    return response.plan;
  }
  if ("session" in response) {
    return response.session.plan;
  }
  return null;
}

function responseReport(response: RuntimeActionResponse) {
  if ("report" in response) {
    return response.report;
  }
  if ("session" in response) {
    return response.session.report;
  }
  return null;
}
