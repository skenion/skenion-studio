import { Badge, Button, Group, Stack, Text, Textarea } from "@mantine/core";
import { RotateCcw } from "lucide-react";

export interface FullscreenShaderControlsProps {
  language: string;
  source: string;
  onSourceChange: (source: string) => void;
  onResetSource: () => void;
}

export function FullscreenShaderControls({
  language,
  onResetSource,
  onSourceChange,
  source
}: FullscreenShaderControlsProps) {
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
            <Badge radius="sm" variant="light">
              {language}
            </Badge>
          </Group>
        </div>
        <Button
          leftSection={<RotateCcw size={14} />}
          onClick={onResetSource}
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
