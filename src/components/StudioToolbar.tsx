import {
  Badge,
  FileButton,
  Group,
  Menu,
  Text,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme
} from "@mantine/core";
import {
  Cable,
  Download,
  FolderOpen,
  Library,
  MonitorPlay,
  Moon,
  Palette,
  PanelRightClose,
  PanelRightOpen,
  RefreshCcw,
  Save,
  Settings,
  SlidersHorizontal,
  Sun,
  Upload
} from "lucide-react";
import type { ValidationResult } from "@skenion/contracts";
import type { DisplayGraphDocumentV01 } from "../graph/patchLibrary";
import { IconButton } from "./core/IconButton/IconButton";

interface StudioToolbarProps {
  graph: DisplayGraphDocumentV01;
  runtimeGraphAvailable: boolean;
  summary: string;
  validation: ValidationResult<DisplayGraphDocumentV01>;
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
  onOpenSettings: () => void;
  onToggleInspector: () => void;
  inspectorOpen: boolean;
}

export function StudioToolbar({
  graph,
  runtimeGraphAvailable,
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
  onOpenSettings,
  onToggleInspector,
  inspectorOpen
}: StudioToolbarProps) {
  const graphActionDisabled = !runtimeGraphAvailable;
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("light", { getInitialValueInEffect: false });
  const nextColorScheme = computedColorScheme === "dark" ? "light" : "dark";
  const colorSchemeLabel = nextColorScheme === "dark" ? "Dark Mode" : "Light Mode";

  return (
    <Group className="studio-toolbar" justify="space-between" wrap="nowrap">
      <Group gap="sm" wrap="nowrap">
        <div className="studio-mark">S</div>
        <div>
          <Group gap="xs" wrap="nowrap">
            <Text fw={800} size="sm">
              skenion studio
            </Text>
            <Badge color={validation.ok ? "green" : "red"} variant="light">
              {validation.ok ? "valid" : "invalid"}
            </Badge>
          </Group>
          <Text c="dimmed" size="xs">
            {runtimeGraphAvailable ? `${graph.id} · ${summary} · graph 0.1` : "No Runtime session"}
          </Text>
        </div>
      </Group>

      <Group gap="xs" wrap="nowrap">
        <Tooltip label="Open project (.skenion.json)">
          <FileButton accept=".skenion.json,application/json,.json" onChange={onOpenProject}>
            {(props) => (
              <IconButton
                disabled={graphActionDisabled}
                icon={<FolderOpen size={18} />}
                label="Open project"
                {...props}
              />
            )}
          </FileButton>
        </Tooltip>
        <Tooltip label="Save project (.skenion.json)">
          <IconButton
            disabled={graphActionDisabled}
            icon={<Save size={18} />}
            label="Save project"
            onClick={onSaveProject}
          />
        </Tooltip>
        <Tooltip label="Import graph JSON">
          <FileButton accept="application/json,.json" onChange={onImport}>
            {(props) => (
              <IconButton
                disabled={graphActionDisabled}
                icon={<Upload size={18} />}
                label="Import graph JSON"
                {...props}
              />
            )}
          </FileButton>
        </Tooltip>
        <Tooltip label="Export graph JSON">
          <IconButton
            disabled={graphActionDisabled}
            icon={<Download size={18} />}
            label="Export graph JSON"
            onClick={onExport}
          />
        </Tooltip>
        <Tooltip label="Restore sample graph">
          <IconButton
            disabled={graphActionDisabled}
            icon={<RefreshCcw size={18} />}
            label="Restore sample graph"
            onClick={onReset}
          />
        </Tooltip>
        <Menu position="bottom-end" shadow="md" width={220} withinPortal>
          <Menu.Target>
            <IconButton
              disabled={graphActionDisabled}
              icon={<Library size={18} />}
              label="Load sample graph"
              title="Load sample graph"
            />
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Samples</Menu.Label>
            <Menu.Item leftSection={<MonitorPlay size={14} />} onClick={onLoadRenderSample}>
              Render
            </Menu.Item>
            <Menu.Item leftSection={<SlidersHorizontal size={14} />} onClick={onLoadShaderUniformSample}>
              Shader Uniform
            </Menu.Item>
            <Menu.Item leftSection={<Palette size={14} />} onClick={onLoadShaderMultiUniformSample}>
              Multi-Uniform Shader
            </Menu.Item>
            <Menu.Item leftSection={<Cable size={14} />} onClick={onLoadObjectRoutingPanelSample}>
              Object Routing Panel
            </Menu.Item>
            <Menu.Item leftSection={<Cable size={14} />} onClick={onLoadPortDemoSample}>
              Port Demo
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
        <Tooltip label="Open Settings">
          <IconButton
            color="blue"
            icon={<Settings size={18} />}
            label="Open Settings"
            onClick={onOpenSettings}
          />
        </Tooltip>
        <Tooltip label={colorSchemeLabel}>
          <IconButton
            color="blue"
            icon={nextColorScheme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
            label={colorSchemeLabel}
            onClick={() => setColorScheme(nextColorScheme)}
          />
        </Tooltip>
        <Tooltip label={inspectorOpen ? "Hide inspector" : "Show inspector"}>
          <IconButton
            color="blue"
            icon={inspectorOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
            label={inspectorOpen ? "Hide inspector" : "Show inspector"}
            onClick={onToggleInspector}
            selected={inspectorOpen}
          />
        </Tooltip>
      </Group>
    </Group>
  );
}
