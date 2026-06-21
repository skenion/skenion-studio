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
    </Dialog>
  );
}
