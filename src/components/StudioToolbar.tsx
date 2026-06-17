import { ActionIcon, Badge, FileButton, Group, Text, Tooltip } from "@mantine/core";
import {
  Cable,
  Download,
  FileJson,
  FolderOpen,
  MonitorPlay,
  Palette,
  RefreshCcw,
  Save,
  SlidersHorizontal,
  Upload
} from "lucide-react";
import type { GraphDocumentV01, ValidationResult } from "@skenion/contracts";

interface StudioToolbarProps {
  graph: GraphDocumentV01;
  summary: string;
  validation: ValidationResult<GraphDocumentV01>;
  onExport: () => void;
  onImport: (file: File | null) => void;
  onOpenProject: (file: File | null) => void;
  onSaveProject: () => void;
  onLoadRenderSample: () => void;
  onLoadSendReceivePanelSample: () => void;
  onLoadShaderMultiUniformSample: () => void;
  onLoadShaderUniformSample: () => void;
  onLoadPortDemoSample: () => void;
  onReset: () => void;
}

export function StudioToolbar({
  graph,
  summary,
  validation,
  onExport,
  onImport,
  onOpenProject,
  onSaveProject,
  onLoadPortDemoSample,
  onLoadRenderSample,
  onLoadSendReceivePanelSample,
  onLoadShaderMultiUniformSample,
  onLoadShaderUniformSample,
  onReset
}: StudioToolbarProps) {
  return (
    <Group className="studio-toolbar" justify="space-between" wrap="nowrap">
      <Group gap="sm" wrap="nowrap">
        <div className="studio-mark">S</div>
        <div>
          <Group gap="xs" wrap="nowrap">
            <Text fw={800} size="sm">
              Skenion Studio
            </Text>
            <Badge color={validation.ok ? "green" : "red"} radius="sm" variant="light">
              {validation.ok ? "valid" : "invalid"}
            </Badge>
          </Group>
          <Text c="dimmed" size="xs">
            {graph.id} · {summary}
          </Text>
        </div>
      </Group>

      <Group gap="xs" wrap="nowrap">
        <Tooltip label="Open project (.skenion.json)">
          <FileButton accept=".skenion.json,application/json,.json" onChange={onOpenProject}>
            {(props) => (
              <ActionIcon aria-label="Open project" radius="sm" size="lg" variant="subtle" {...props}>
                <FolderOpen size={18} />
              </ActionIcon>
            )}
          </FileButton>
        </Tooltip>
        <Tooltip label="Save project (.skenion.json)">
          <ActionIcon aria-label="Save project" onClick={onSaveProject} radius="sm" size="lg" variant="subtle">
            <Save size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Import graph JSON">
          <FileButton accept="application/json,.json" onChange={onImport}>
            {(props) => (
              <ActionIcon aria-label="Import graph JSON" radius="sm" size="lg" variant="subtle" {...props}>
                <Upload size={18} />
              </ActionIcon>
            )}
          </FileButton>
        </Tooltip>
        <Tooltip label="Export graph JSON">
          <ActionIcon aria-label="Export graph JSON" onClick={onExport} radius="sm" size="lg" variant="subtle">
            <Download size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Restore sample graph">
          <ActionIcon aria-label="Restore sample graph" onClick={onReset} radius="sm" size="lg" variant="subtle">
            <RefreshCcw size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Load render sample">
          <ActionIcon
            aria-label="Load render sample"
            onClick={onLoadRenderSample}
            radius="sm"
            size="lg"
            variant="subtle"
          >
            <MonitorPlay size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Load shader uniform sample">
          <ActionIcon
            aria-label="Load shader uniform sample"
            onClick={onLoadShaderUniformSample}
            radius="sm"
            size="lg"
            variant="subtle"
          >
            <SlidersHorizontal size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Load multi-uniform shader sample">
          <ActionIcon
            aria-label="Load multi-uniform shader sample"
            onClick={onLoadShaderMultiUniformSample}
            radius="sm"
            size="lg"
            variant="subtle"
          >
            <Palette size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Load send/receive panel sample">
          <ActionIcon
            aria-label="Load send/receive panel sample"
            onClick={onLoadSendReceivePanelSample}
            radius="sm"
            size="lg"
            variant="subtle"
          >
            <Cable size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Load port demo sample">
          <ActionIcon
            aria-label="Load port demo sample"
            onClick={onLoadPortDemoSample}
            radius="sm"
            size="lg"
            variant="subtle"
          >
            <Cable size={18} />
          </ActionIcon>
        </Tooltip>
        <Badge leftSection={<FileJson size={13} />} radius="sm" variant="outline">
          graph v0.1
        </Badge>
      </Group>
    </Group>
  );
}
