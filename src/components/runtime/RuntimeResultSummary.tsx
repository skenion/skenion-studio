import { Alert, Badge, Code, Group, Stack, Text } from "@mantine/core";
import type {
  RuntimeActionResponse,
  RuntimeActionResult,
  RuntimeDummyExecutionReport,
  RuntimePlan
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
        <Badge color={result.response.ok ? "green" : "red"} variant="light">
          {result.response.ok ? "ok" : "diagnostics"}
        </Badge>
      </Group>

      {diagnostics.length > 0 ? (
        <Stack gap={4}>
          {diagnostics.slice(0, 5).map((diagnostic: { severity: string; message: string }) => (
            <Alert
              color={diagnostic.severity === "error" ? "red" : "yellow"}
              key={diagnostic.message}
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

function responsePlan(response: RuntimeActionResponse): RuntimePlan | null {
  if ("plan" in response) {
    return response.plan;
  }
  if ("snapshot" in response) {
    return isRuntimePlan(response.snapshot.plan) ? response.snapshot.plan : null;
  }
  return null;
}

function responseReport(response: RuntimeActionResponse): RuntimeDummyExecutionReport | null {
  if ("report" in response) {
    return response.report;
  }
  return null;
}

function isRuntimePlan(value: unknown): value is RuntimePlan {
  return (
    value !== null &&
    typeof value === "object" &&
    "graphId" in value &&
    "nodes" in value &&
    "edges" in value &&
    "groups" in value
  );
}
