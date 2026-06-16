import { useState } from "react";
import { Alert, Badge, Button, Code, Divider, Group, Modal, NumberInput, Stack, Table, Text, Textarea } from "@mantine/core";
import { GitBranch, RotateCcw, Trash2 } from "lucide-react";
import type { GraphDocumentV01, GraphNodeV01, ValidationResult } from "@skenion/contracts";
import {
  isClearColorNode,
  readClearColorParam,
  replaceClearColorComponent
} from "../graph/clearColor";
import {
  DEFAULT_FULLSCREEN_SHADER_SOURCE,
  isFullscreenShaderNode,
  readShaderLanguageParam,
  readShaderSourceParam
} from "../graph/fullscreenShader";
import { typeLabel, type ConnectionCheck } from "../graph/skenionGraph";
import {
  portSemanticsForPort,
  semanticTypeColor,
  type EdgeInspectorModel,
  type GraphSemanticDiagnostic
} from "../graph/portSemantics";

interface InspectorPanelProps {
  connectionCheck: ConnectionCheck | null;
  edge: EdgeInspectorModel | null;
  graph: GraphDocumentV01;
  node: GraphNodeV01 | null;
  semanticDiagnostics: GraphSemanticDiagnostic[];
  validation: ValidationResult<GraphDocumentV01>;
  onRemoveNode: (node: GraphNodeV01) => void;
  onSetNodeParam: (nodeId: string, key: string, value: unknown) => void;
}

export function InspectorPanel({
  connectionCheck,
  edge,
  graph,
  node,
  semanticDiagnostics,
  validation,
  onRemoveNode,
  onSetNodeParam
}: InspectorPanelProps) {
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const clearColor = isClearColorNode(node) ? readClearColorParam(node) : null;
  const shaderSource = isFullscreenShaderNode(node) ? readShaderSourceParam(node) : null;
  const shaderLanguage = isFullscreenShaderNode(node) ? readShaderLanguageParam(node) : null;
  const selectedEdgeDiagnostics = edge
    ? semanticDiagnostics.filter((diagnostic) => diagnostic.edgeId === edge.id)
    : [];

  return (
    <Stack className="panel-shell" gap="md">
      <Modal
        onClose={() => setFeedbackDialogOpen(false)}
        opened={feedbackDialogOpen}
        radius="sm"
        title="Feedback Policy"
      >
        <Stack gap="sm">
          <Text size="sm">
            v0.14 only records feedback as explicit v0.2 edge metadata. Runtime validation can classify the cycle, but it does not execute feedback paths yet.
          </Text>
          {edge ? (
            <Code block>
              {JSON.stringify(
                {
                  edge: edge.id,
                  feedback: edge.feedback ?? {
                    boundary: "render-frame",
                    bufferMode: "previous-frame"
                  }
                },
                null,
                2
              )}
            </Code>
          ) : null}
        </Stack>
      </Modal>

      <div>
        <Text fw={800} size="sm">
          Inspector
        </Text>
        <Text c="dimmed" size="xs">
          {graph.nodes.length} nodes · {graph.edges.length} edges
        </Text>
      </div>

      <Stack gap="md">
        <ValidationPanel semanticDiagnostics={semanticDiagnostics} validation={validation} />

        {connectionCheck ? (
          <Alert color={connectionCheck.ok ? "green" : "red"} radius="sm" variant="light">
            {connectionCheck.message}
          </Alert>
        ) : null}

        <Divider />

        {edge ? (
          <EdgeInspector
            diagnostics={selectedEdgeDiagnostics}
            edge={edge}
            onOpenFeedbackDialog={() => setFeedbackDialogOpen(true)}
          />
        ) : node ? (
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
                        </Table.Td>
                        <Table.Td>
                          <Badge radius="sm" variant="light">
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

              {clearColor ? (
                <>
                  <Divider />
                  <Stack gap="xs">
                    <Text c="dimmed" fw={700} size="xs" tt="uppercase">
                      Clear Color
                    </Text>
                    <Group grow>
                      {(["R", "G", "B", "A"] as const).map((label, index) => (
                        <NumberInput
                          decimalScale={3}
                          key={label}
                          label={label}
                          max={1}
                          min={0}
                          onChange={(value) => {
                            if (typeof value !== "number" || !Number.isFinite(value)) {
                              return;
                            }
                            const nextColor = replaceClearColorComponent(clearColor, index, value);
                            onSetNodeParam(node.id, "color", nextColor);
                          }}
                          size="xs"
                          step={0.01}
                          value={clearColor[index]}
                        />
                      ))}
                    </Group>
                  </Stack>
                </>
              ) : null}

              {shaderSource !== null ? (
                <>
                  <Divider />
                  <Stack gap="xs">
                    <Group justify="space-between" wrap="nowrap">
                      <div>
                        <Text c="dimmed" fw={700} size="xs" tt="uppercase">
                          Fullscreen Shader
                        </Text>
                        <Group gap={6} mt={4}>
                          <Text c="dimmed" size="xs">
                            Language
                          </Text>
                          <Badge radius="sm" variant="light">
                            {shaderLanguage}
                          </Badge>
                        </Group>
                      </div>
                      <Button
                        leftSection={<RotateCcw size={14} />}
                        onClick={() => onSetNodeParam(node.id, "source", DEFAULT_FULLSCREEN_SHADER_SOURCE)}
                        radius="sm"
                        size="compact-sm"
                        variant="light"
                      >
                        Reset
                      </Button>
                    </Group>
                    <Textarea
                      autosize
                      label="WGSL Source"
                      maxRows={22}
                      minRows={12}
                      onChange={(event) => onSetNodeParam(node.id, "source", event.currentTarget.value)}
                      size="xs"
                      spellCheck={false}
                      styles={{
                        input: {
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                        }
                      }}
                      value={shaderSource}
                    />
                  </Stack>
                </>
              ) : null}
          </Stack>
        ) : (
          <Text c="dimmed" size="sm">
            Select a node or edge on the canvas.
          </Text>
        )}
      </Stack>
    </Stack>
  );
}

function ValidationPanel({
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

function EdgeInspector({
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
          <Table.Tr>
            <Table.Td>Source</Table.Td>
            <Table.Td>
              <Code>{edge.source}</Code>
            </Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>Target</Table.Td>
            <Table.Td>
              <Code>{edge.target}</Code>
            </Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>Resolved</Table.Td>
            <Table.Td>
              <Badge radius="sm" variant="light">
                {edge.resolvedType}
              </Badge>
            </Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>Order</Table.Td>
            <Table.Td>{edge.order ?? "default"}</Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>Enabled</Table.Td>
            <Table.Td>{edge.enabled ? "true" : "false"}</Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>Adapter</Table.Td>
            <Table.Td>{edge.adapter ?? "none"}</Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>Feedback</Table.Td>
            <Table.Td>{edge.feedback ? edge.feedback.boundary : "none"}</Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>Style</Table.Td>
            <Table.Td>{edge.styleOverride ?? "default"}</Table.Td>
          </Table.Tr>
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
