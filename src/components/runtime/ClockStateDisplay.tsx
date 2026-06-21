import { Badge, Code, Group, Table, Text } from "@mantine/core";
import type {
  ClockAuthorityV01,
  ClockFieldV01,
  ClockStateV01,
  ClockTimeSignatureV01
} from "@skenion/contracts";

interface ClockStateDisplayProps {
  state: ClockStateV01 | null;
}

type FieldRow = {
  key: string;
  label: string;
  field?: ClockFieldV01<unknown>;
};

export function ClockStateDisplay({ state }: ClockStateDisplayProps) {
  if (!state) {
    return (
      <Text c="dimmed" size="xs">
        No clock snapshot available.
      </Text>
    );
  }

  const rows: FieldRow[] = [
    { key: "running", label: "RUNNING", field: state.running },
    { key: "tempoBpm", label: "TEMPO", field: state.tempoBpm },
    { key: "phase01", label: "PHASE", field: state.phase01 },
    { key: "tickIndex", label: "TICK", field: state.tickIndex },
    { key: "ppqPosition", label: "PPQ", field: state.ppqPosition },
    { key: "songPositionSixteenth", label: "SONG POS", field: state.songPositionSixteenth },
    { key: "bar", label: "BAR", field: state.bar },
    { key: "beat", label: "BEAT", field: state.beat },
    { key: "division", label: "DIVISION", field: state.division },
    { key: "timeSignature", label: "METER", field: state.timeSignature },
    { key: "timecode", label: "TIMECODE", field: state.timecode }
  ];

  return (
    <>
      <Group justify="space-between" wrap="nowrap">
        <div>
          <Text fw={800} size="sm">
            {state.sourceId}
          </Text>
          <Text c="dimmed" size="xs">
            {state.sourceKind}
          </Text>
        </div>
        <Badge color="gray" variant="light">
          {state.capabilities.length} capabilities
        </Badge>
      </Group>

      <Table className="clock-state-table" withRowBorders={false}>
        <Table.Tbody>
          {rows.map((row) => (
            <Table.Tr key={row.key}>
              <Table.Td>
                <Text c="dimmed" fw={700} size="xs">
                  {row.label}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text fw={700} size="xs">
                  {formatClockFieldValue(row.field)}
                </Text>
              </Table.Td>
              <Table.Td>
                <AuthorityBadge authority={row.field?.authority ?? "unavailable"} />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Code block className="runtime-json">
        {JSON.stringify(
          {
            sourceId: state.sourceId,
            lastUpdateHostTimeNs: state.lastUpdateHostTimeNs ?? null,
            capabilities: state.capabilities
          },
          null,
          2
        )}
      </Code>
    </>
  );
}

export function AuthorityBadge({ authority }: { authority: ClockAuthorityV01 }) {
  return (
    <Badge color={authorityColor(authority)} size="xs" variant="light">
      {authority}
    </Badge>
  );
}

function authorityColor(authority: ClockAuthorityV01): string {
  switch (authority) {
    case "authoritative":
      return "green";
    case "derived":
      return "blue";
    case "estimated":
      return "yellow";
    case "unavailable":
      return "gray";
  }
}

function formatClockFieldValue(field: ClockFieldV01<unknown> | undefined): string {
  if (!field || field.value === null) {
    return "unavailable";
  }

  if (isClockTimeSignature(field.value)) {
    return `${field.value.numerator}/${field.value.denominator}`;
  }

  if (typeof field.value === "number") {
    return Number.isInteger(field.value) ? String(field.value) : field.value.toFixed(3);
  }

  return String(field.value);
}

function isClockTimeSignature(value: unknown): value is ClockTimeSignatureV01 {
  return (
    typeof value === "object" &&
    value !== null &&
    "numerator" in value &&
    "denominator" in value &&
    typeof value.numerator === "number" &&
    typeof value.denominator === "number"
  );
}
