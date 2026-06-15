import { ActionIcon, Badge, FileButton, Group, Text, Tooltip } from "@mantine/core";
import { Download, FileJson, RefreshCcw, Upload } from "lucide-react";
import type { GraphDocumentV01, ValidationResult } from "@skenion/contracts";

interface StudioToolbarProps {
  graph: GraphDocumentV01;
  summary: string;
  validation: ValidationResult<GraphDocumentV01>;
  onExport: () => void;
  onImport: (file: File | null) => void;
  onReset: () => void;
}

export function StudioToolbar({
  graph,
  summary,
  validation,
  onExport,
  onImport,
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
        <Badge leftSection={<FileJson size={13} />} radius="sm" variant="outline">
          graph v0.1
        </Badge>
      </Group>
    </Group>
  );
}
