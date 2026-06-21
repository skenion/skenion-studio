import { Alert, Badge, Code, Group, Stack, Text, Textarea } from "@mantine/core";
import { FileCode, RotateCcw, ScanSearch, Waypoints } from "lucide-react";
import { useState } from "react";
import type { ShaderInterfaceAnalysisV01 } from "@skenion/contracts";
import type { RuntimeGeneratedShaderResponse } from "../../runtime/types";
import type { ShaderDiagnosticV01 } from "@skenion/contracts";
import { Button } from "../core/Button/Button";

export interface FullscreenShaderControlsProps {
  analysis: ShaderInterfaceAnalysisV01;
  generatedShader?: RuntimeGeneratedShaderResponse | null;
  generatedShaderBusy?: boolean;
  initialGeneratedVisible?: boolean;
  interfaceSynced: boolean;
  language: string;
  runtimeDiagnostics?: ShaderDiagnosticV01[];
  source: string;
  onAnalyze: () => void;
  onLoadGeneratedShader?: () => void;
  onSourceChange: (source: string) => void;
  onResetSource: () => void;
  onSyncInputs: () => void;
}

export function FullscreenShaderControls({
  analysis,
  generatedShader = null,
  generatedShaderBusy = false,
  initialGeneratedVisible = false,
  interfaceSynced,
  language,
  onAnalyze,
  onLoadGeneratedShader,
  onResetSource,
  onSourceChange,
  onSyncInputs,
  runtimeDiagnostics = [],
  source
}: FullscreenShaderControlsProps) {
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const [generatedVisible, setGeneratedVisible] = useState(initialGeneratedVisible);
  const uniforms = analysis.shaderInterface.uniforms;
  const hasErrors = analysis.diagnostics.some((diagnostic) => diagnostic.severity === "error");
  const runtimeErrors = runtimeDiagnostics.some((diagnostic) => diagnostic.severity === "error");

  return (
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
            <Badge variant="light">
              {language}
            </Badge>
            <Badge color={hasErrors ? "red" : "green"} variant="light">
              {hasErrors ? "analysis error" : "analysis ok"}
            </Badge>
            <Badge color={interfaceSynced ? "green" : "yellow"} variant="light">
              {interfaceSynced ? "inputs synced" : "sync needed"}
            </Badge>
            {runtimeDiagnostics.length > 0 ? (
              <Badge color={runtimeErrors ? "red" : "yellow"} variant="light">
                runtime diagnostics
              </Badge>
            ) : null}
          </Group>
          <Text c="dimmed" mt={4} size="xs">
            Uniforms: {uniforms.length > 0 ? uniforms.map((uniform) => uniform.id).join(", ") : "none"}
          </Text>
        </div>
        <Group gap={6} wrap="nowrap">
          <Button
            leftSection={<ScanSearch size={14} />}
            onClick={() => {
              setAnalysisVisible(true);
              onAnalyze();
            }}
            size="compact-sm"
            variant="light"
          >
            Analyze
          </Button>
          <Button
            disabled={hasErrors || interfaceSynced}
            leftSection={<Waypoints size={14} />}
            onClick={onSyncInputs}
            size="compact-sm"
            variant="filled"
          >
            Sync Inputs
          </Button>
          <Button
            leftSection={<RotateCcw size={14} />}
            onClick={onResetSource}
            size="compact-sm"
            variant="light"
          >
            Reset
          </Button>
          <Button
            disabled={!onLoadGeneratedShader}
            leftSection={<FileCode size={14} />}
            loading={generatedShaderBusy}
            onClick={() => {
              setGeneratedVisible(true);
              onLoadGeneratedShader?.();
            }}
            size="compact-sm"
            variant="light"
          >
            Generated WGSL
          </Button>
        </Group>
      </Group>

      {analysisVisible || hasErrors || !interfaceSynced ? (
        <Alert color={hasErrors ? "red" : interfaceSynced ? "gray" : "yellow"} variant="light">
          <Stack gap={6}>
            <Text fw={700} size="xs">
              Local Interface Analysis
            </Text>
            {uniforms.length > 0 ? (
              <Stack gap={3}>
                {uniforms.map((uniform) => (
                  <Text key={uniform.id} size="xs">
                    <Code>{uniform.id}</Code> {uniform.type.dataKind}
                  </Text>
                ))}
              </Stack>
            ) : (
              <Text size="xs">No dynamic input uniforms were found. The node will only expose render output.</Text>
            )}
            <DiagnosticList diagnostics={analysis.diagnostics} />
          </Stack>
        </Alert>
      ) : null}

      {runtimeDiagnostics.length > 0 ? (
        <Alert color={runtimeErrors ? "red" : "yellow"} variant="light">
          <Stack gap={6}>
            <Text fw={700} size="xs">
              Runtime Shader Diagnostics
            </Text>
            <DiagnosticList diagnostics={runtimeDiagnostics} />
          </Stack>
        </Alert>
      ) : null}

      {generatedVisible ? (
        <Alert color={generatedShader?.ok ? "gray" : "yellow"} variant="light">
          <Stack gap={6}>
            <Group justify="space-between" wrap="nowrap">
              <Text fw={700} size="xs">
                Generated WGSL
              </Text>
              {generatedShader?.sourceMap ? (
                <Badge variant="light">
                  user starts line {generatedShader.sourceMap.userSourceStartLine}
                </Badge>
              ) : null}
            </Group>
            {generatedShader?.source ? (
              <Code block className="runtime-json">
                {generatedShader.source}
              </Code>
            ) : (
              <Text c="dimmed" size="xs">
                Generated WGSL is unavailable until the Runtime has a loaded fullscreen shader session.
              </Text>
            )}
            {generatedShader?.diagnostics.length ? <DiagnosticList diagnostics={generatedShader.diagnostics} /> : null}
          </Stack>
        </Alert>
      ) : null}

      <Textarea
        autosize
        label="WGSL Source"
        maxRows={22}
        minRows={12}
        onChange={(event) => onSourceChange(event.currentTarget.value)}
        size="xs"
        spellCheck={false}
        styles={{
          input: {
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
          }
        }}
        value={source}
      />
    </Stack>
  );
}

function DiagnosticList({ diagnostics }: { diagnostics: ShaderDiagnosticV01[] }) {
  if (diagnostics.length === 0) {
    return (
      <Text c="dimmed" size="xs">
        No diagnostics.
      </Text>
    );
  }

  return (
    <Stack gap={4}>
      {diagnostics.map((diagnostic, index) => (
        <Text key={`${diagnostic.phase}:${diagnostic.code}:${diagnostic.line ?? "global"}:${index}`} size="xs">
          <Code>{diagnostic.phase}</Code> {diagnostic.severity} {diagnostic.code}
          {formatDiagnosticLocation(diagnostic)}: {diagnostic.message}
        </Text>
      ))}
    </Stack>
  );
}

function formatDiagnosticLocation(diagnostic: ShaderDiagnosticV01): string {
  if (!diagnostic.line) {
    return "";
  }
  return diagnostic.column ? ` line ${diagnostic.line}:${diagnostic.column}` : ` line ${diagnostic.line}`;
}
