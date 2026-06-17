import { ActionIcon, Badge, Button, Divider, Group, ScrollArea, Stack, Text, Tooltip } from "@mantine/core";
import { HelpCircle, Plus } from "lucide-react";
import type { NodeDefinitionManifestV01 } from "@skenion/contracts";
import { flowColor, flowName } from "../graph/reactFlowAdapter";

interface PalettePanelProps {
  registry: NodeDefinitionManifestV01[];
  onAddNode: (definitionId: string) => void;
  onShowHelp: (definitionId: string) => void;
}

export function PalettePanel({ registry, onAddNode, onShowHelp }: PalettePanelProps) {
  const categories = Array.from(new Set(registry.map((definition) => definition.category)));

  return (
    <Stack className="panel-shell" gap="md">
      <div>
        <Text fw={800} size="sm">
          Node Registry
        </Text>
        <Text c="dimmed" size="xs">
          {registry.length} definitions
        </Text>
      </div>

      <ScrollArea className="palette-scroll" offsetScrollbars>
        <Stack gap="md">
          {categories.map((category) => (
            <Stack gap="xs" key={category}>
              <Group justify="space-between">
                <Text c="dimmed" fw={700} size="xs" tt="uppercase">
                  {category}
                </Text>
                <Badge radius="sm" size="xs" variant="light">
                  {registry.filter((definition) => definition.category === category).length}
                </Badge>
              </Group>
              {registry
                .filter((definition) => definition.category === category)
                .map((definition) => {
                  const primaryPort = definition.ports.find((port) => port.direction === "output") ?? definition.ports[0];
                  const swatchColor = primaryPort ? flowColor(primaryPort.type.flow, primaryPort.type.dataKind) : "#868e96";

                  return (
                    <Group gap={6} key={definition.id} wrap="nowrap">
                      <Button
                        className="palette-node"
                        color="gray"
                        fullWidth
                        justify="space-between"
                        leftSection={<span className="flow-swatch" style={{ background: swatchColor }} />}
                        onClick={() => onAddNode(definition.id)}
                        radius="sm"
                        rightSection={<Plus size={15} />}
                        size="compact-md"
                        variant="subtle"
                      >
                        <span>
                          <Text component="span" fw={700} size="sm">
                            {definition.displayName}
                          </Text>
                          <Text c="dimmed" component="span" display="block" size="xs">
                            {primaryPort ? flowName(primaryPort.type.flow, primaryPort.type.dataKind) : definition.execution.model}
                          </Text>
                        </span>
                      </Button>
                      <Tooltip label={`Help: ${definition.displayName}`}>
                        <ActionIcon
                          aria-label={`Show help for ${definition.displayName}`}
                          onClick={() => onShowHelp(definition.id)}
                          radius="sm"
                          size={34}
                          variant="light"
                        >
                          <HelpCircle size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  );
                })}
              <Divider />
            </Stack>
          ))}
        </Stack>
      </ScrollArea>
    </Stack>
  );
}
