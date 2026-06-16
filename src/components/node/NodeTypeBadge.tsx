import { Badge } from "@mantine/core";

export function NodeTypeBadge({ label }: { label: string }) {
  return (
    <Badge radius="sm" size="xs" variant="light">
      {label}
    </Badge>
  );
}
