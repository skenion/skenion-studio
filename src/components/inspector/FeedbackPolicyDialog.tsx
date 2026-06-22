import { Code, Stack, Text } from "@mantine/core";
import type { EdgeInspectorModel } from "../../graph/portSemantics";
import { Dialog } from "../core/Dialog/Dialog";

export function FeedbackPolicyDialog({
  edge,
  onClose,
  opened
}: {
  edge: EdgeInspectorModel | null;
  onClose: () => void;
  opened: boolean;
}) {
  return (
    <Dialog onClose={onClose} opened={opened} title="Feedback Policy">
      <Stack gap="sm">
        <Text size="sm">
          Current 0.1 graphs record feedback as explicit edge metadata. Runtime validation can classify the cycle, but it does not execute feedback paths yet.
        </Text>
        {edge ? (
          <Code block>
            {JSON.stringify(
              {
                edge: edge.id,
                feedback: edge.feedback ?? {
                  enabled: true,
                  boundary: "render-frame",
                  bufferMode: "latest"
                }
              },
              null,
              2
            )}
          </Code>
        ) : null}
      </Stack>
    </Dialog>
  );
}
