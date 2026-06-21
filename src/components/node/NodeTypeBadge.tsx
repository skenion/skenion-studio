import { Badge } from "@mantine/core";

export function NodeTypeBadge({ label }: { label: string }) {
  return (
    <Badge size="xs" variant="light">
      {label}
    </Badge>
  );
}
