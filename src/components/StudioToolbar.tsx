import { ActionIcon, Badge, FileButton, Group, Text, Tooltip } from "@mantine/core";
import {
  Cable,
  Download,
  FolderOpen,
  Lock,
  MonitorPlay,
  Palette,
  PanelRightClose,
  PanelRightOpen,
  RefreshCcw,
  Save,
  SlidersHorizontal,
  Unlock,
  Upload
} from "lucide-react";
import type { GraphDocumentV01, ValidationResult } from "@skenion/contracts";

interface StudioToolbarProps {
  graph: GraphDocumentV01;
  runtimeGraphAvailable: boolean;
  graphLocked: boolean;
  summary: string;
  validation: ValidationResult<GraphDocumentV01>;
  onExport: () => void;
  onImport: (file: File | null) => void;
  onOpenProject: (file: File | null) => void;
  onSaveProject: () => void;
  onLoadRenderSample: () => void;
  onLoadObjectRoutingPanelSample: () => void;
  onLoadShaderMultiUniformSample: () => void;
  onLoadShaderUniformSample: () => void;
  onLoadPortDemoSample: () => void;
  onReset: () => void;
  onToggleGraphLock: () => void;
  onToggleInspector: () => void;
  inspectorOpen: boolean;
}

export function StudioToolbar({
  graph,
  runtimeGraphAvailable,
  graphLocked,
  summary,
  validation,
  onExport,
  onImport,
  onOpenProject,
  onSaveProject,
  onLoadPortDemoSample,
  onLoadRenderSample,
  onLoadObjectRoutingPanelSample,
  onLoadShaderMultiUniformSample,
  onLoadShaderUniformSample,
  onReset,
  onToggleGraphLock,
  onToggleInspector,
  inspectorOpen
}: StudioToolbarProps) {
  const graphActionDisabled = !runtimeGraphAvailable;

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
            {runtimeGraphAvailable ? `${graph.id} · ${summary} · graph v0.1` : "No Runtime session"}
          </Text>
        </div>
      </Group>

      <Group gap="xs" wrap="nowrap">
        <Tooltip label="Open project (.skenion.json)">
          <FileButton accept=".skenion.json,application/json,.json" onChange={onOpenProject}>
            {(props) => (
              <ActionIcon aria-label="Open project" disabled={graphActionDisabled} radius="sm" size="lg" variant="subtle" {...props}>
                <FolderOpen size={18} />
              </ActionIcon>
            )}
          </FileButton>
        </Tooltip>
        <Tooltip label="Save project (.skenion.json)">
          <ActionIcon aria-label="Save project" disabled={graphActionDisabled} onClick={onSaveProject} radius="sm" size="lg" variant="subtle">
            <Save size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Import graph JSON">
          <FileButton accept="application/json,.json" onChange={onImport}>
            {(props) => (
              <ActionIcon aria-label="Import graph JSON" disabled={graphActionDisabled} radius="sm" size="lg" variant="subtle" {...props}>
                <Upload size={18} />
              </ActionIcon>
            )}
          </FileButton>
        </Tooltip>
        <Tooltip label="Export graph JSON">
          <ActionIcon aria-label="Export graph JSON" disabled={graphActionDisabled} onClick={onExport} radius="sm" size="lg" variant="subtle">
            <Download size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Restore sample graph">
          <ActionIcon aria-label="Restore sample graph" disabled={graphActionDisabled} onClick={onReset} radius="sm" size="lg" variant="subtle">
            <RefreshCcw size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={graphLocked ? "Unlock graph layout editing" : "Lock graph layout editing"}>
          <ActionIcon
            aria-label={graphLocked ? "Unlock graph" : "Lock graph"}
            disabled={graphActionDisabled}
            onClick={onToggleGraphLock}
            radius="sm"
            size="lg"
            variant="subtle"
          >
            {graphLocked ? <Lock size={18} /> : <Unlock size={18} />}
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Load render sample">
          <ActionIcon
            aria-label="Load render sample"
            disabled={graphActionDisabled}
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
            disabled={graphActionDisabled}
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
            disabled={graphActionDisabled}
            onClick={onLoadShaderMultiUniformSample}
            radius="sm"
            size="lg"
            variant="subtle"
          >
            <Palette size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Load object routing panel sample">
          <ActionIcon
            aria-label="Load object routing panel sample"
            disabled={graphActionDisabled}
            onClick={onLoadObjectRoutingPanelSample}
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
            disabled={graphActionDisabled}
            onClick={onLoadPortDemoSample}
            radius="sm"
            size="lg"
            variant="subtle"
          >
            <Cable size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={inspectorOpen ? "Hide side panel" : "Show side panel"}>
          <ActionIcon
            aria-label={inspectorOpen ? "Hide side panel" : "Show side panel"}
            onClick={onToggleInspector}
            radius="sm"
            size="lg"
            variant={inspectorOpen ? "light" : "subtle"}
          >
            {inspectorOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
          </ActionIcon>
        </Tooltip>
      </Group>
    </Group>
  );
}
