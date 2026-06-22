import { useMemo, useState, type FormEvent } from "react";
import { Badge, Divider, Group, ScrollArea, Stack, Text, TextInput, Tooltip } from "@mantine/core";
import { HelpCircle, Plus } from "lucide-react";
import { type NodeDefinitionManifestV01 } from "@skenion/contracts";
import { paletteDirectDefinitions } from "../data/palette";
import { dataTypeFromPortSpec } from "../graph/patchLibrary";
import { flowColor, flowName } from "../graph/reactFlowAdapter";
import { createGraphNodeFromObjectText, isUnresolvedObjectNode } from "../graph/objectTextNode";
import { Button } from "./core/Button/Button";
import { IconButton } from "./core/IconButton/IconButton";

interface PalettePanelProps {
  addDisabled?: boolean;
  registry: NodeDefinitionManifestV01[];
  onAddNode: (definitionId: string) => void;
  onAddObjectText: (objectText: string) => void;
  onShowHelp: (definitionId: string) => void;
}

export function PalettePanel({
  addDisabled = false,
  registry,
  onAddNode,
  onAddObjectText,
  onShowHelp
}: PalettePanelProps) {
  const [objectText, setObjectText] = useState("");
  const directDefinitions = useMemo(() => paletteDirectDefinitions(registry), [registry]);
  const categories = Array.from(new Set(directDefinitions.map((definition) => definition.category)));
  const objectTextInput = objectText.trim();
  const objectTextAnalysis = useMemo(
    () => (objectTextInput ? createGraphNodeFromObjectText(objectTextInput, [], registry) : null),
    [objectTextInput, registry]
  );
  const objectTextDiagnostic = objectTextAnalysis?.diagnostics.find((diagnostic) => diagnostic.severity === "error") ??
    objectTextAnalysis?.diagnostics[0] ??
    null;
  const objectTextCanCreate = objectTextInput.length > 0 && !addDisabled;
  const objectTextBadge = objectTextAnalysis?.node
    ? isUnresolvedObjectNode(objectTextAnalysis.node)
      ? "unresolved"
      : objectTextAnalysis.node.kind
    : null;

  function submitObjectText(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!objectTextCanCreate) {
      return;
    }
    onAddObjectText(objectTextInput);
    setObjectText("");
  }

  return (
    <Stack className="panel-shell" gap="md">
      <div>
        <Text fw={800} size="sm">
          Objects
        </Text>
        <Text c="dimmed" size="xs">
          {directDefinitions.length} direct · {registry.length - directDefinitions.length} text-only
        </Text>
      </div>

      <form onSubmit={submitObjectText}>
        <Stack gap={6}>
          <Group justify="space-between">
            <Text c="dimmed" fw={700} size="xs" tt="uppercase">
              Object Box
            </Text>
            {objectTextBadge ? (
              <Badge size="xs" variant="light">
                {objectTextBadge}
              </Badge>
            ) : null}
          </Group>
          <TextInput
            aria-label="Object box text"
            disabled={addDisabled}
            error={objectTextDiagnostic?.severity === "error" ? objectTextDiagnostic.message : undefined}
            onChange={(event) => setObjectText(event.currentTarget.value)}
            placeholder="+ 1, +~, osc~ 440"
            size="xs"
            value={objectText}
          />
          {objectTextDiagnostic && objectTextDiagnostic.severity !== "error" ? (
            <Text c="dimmed" size="xs">
              {objectTextDiagnostic.message}
            </Text>
          ) : null}
          <Button disabled={!objectTextCanCreate} fullWidth size="compact-sm" type="submit">
            Create Object
          </Button>
        </Stack>
      </form>

      <Divider />

      <ScrollArea className="palette-scroll" offsetScrollbars>
        <Stack gap="md">
          {categories.map((category) => (
            <Stack gap="xs" key={category}>
              <Group justify="space-between">
                <Text c="dimmed" fw={700} size="xs" tt="uppercase">
                  {category}
                </Text>
                <Badge size="xs" variant="light">
                  {directDefinitions.filter((definition) => definition.category === category).length}
                </Badge>
              </Group>
              {directDefinitions
                .filter((definition) => definition.category === category)
                .map((definition) => {
                  const primaryPort = definition.ports.find((port) => port.direction === "output") ?? definition.ports[0];
                  const primaryType = primaryPort ? dataTypeFromPortSpec(primaryPort) : null;
                  const swatchColor = primaryType ? flowColor(primaryType.flow, primaryType.dataKind) : "#868e96";

                  return (
                    <Group gap={6} key={definition.id} wrap="nowrap">
                      <Button
                        className="palette-node"
                        color="gray"
                        disabled={addDisabled}
                        fullWidth
                        justify="space-between"
                        leftSection={<span className="flow-swatch" style={{ background: swatchColor }} />}
                        onClick={() => onAddNode(definition.id)}
                        rightSection={<Plus size={15} />}
                        size="compact-md"
                      >
                        <span>
                          <Text component="span" fw={700} size="sm">
                            {definition.displayName}
                          </Text>
                          <Text c="dimmed" component="span" display="block" size="xs">
                            {primaryType ? flowName(primaryType.flow, primaryType.dataKind) : definition.execution.model}
                          </Text>
                        </span>
                      </Button>
                      <Tooltip label={`Help: ${definition.displayName}`}>
                        <IconButton
                          icon={<HelpCircle size={16} />}
                          label={`Show help for ${definition.displayName}`}
                          onClick={() => onShowHelp(definition.id)}
                          size={34}
                        />
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
