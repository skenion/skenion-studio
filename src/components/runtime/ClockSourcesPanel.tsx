import { useState } from "react";
import { Alert, Badge, Button, Checkbox, Divider, Group, NumberInput, Stack, Table, Text, TextInput } from "@mantine/core";
import { List, Play, RefreshCw, Square } from "lucide-react";
import type {
  ClockSourceListResponse,
  ClockSourceSnapshot,
  ClockSourceSnapshotResponse,
  MidiClockSourceStartRequest,
  MidiClockSourceStartResponse,
  MidiClockSourceStopRequest,
  MidiClockSourceStopResponse,
  MidiInputDescriptor,
  MidiInputListResponse,
  RuntimeClockDiagnostic
} from "../../runtime/types";
import { ClockStateDisplay } from "./ClockStateDisplay";

interface ClockSourcesPanelProps {
  connected: boolean;
  initialDiagnostics?: RuntimeClockDiagnostic[];
  initialInputs?: MidiInputDescriptor[];
  initialSources?: ClockSourceSnapshot[];
  onGetClockSource: (sourceId: string) => Promise<ClockSourceSnapshotResponse>;
  onListClockSources: () => Promise<ClockSourceListResponse>;
  onListMidiInputs: () => Promise<MidiInputListResponse>;
  onStartMidiClockSource: (request: MidiClockSourceStartRequest) => Promise<MidiClockSourceStartResponse>;
  onStopMidiClockSource: (request: MidiClockSourceStopRequest) => Promise<MidiClockSourceStopResponse>;
}

type ClockSourcePanelAction = "sources" | "source" | "inputs" | "start" | "stop" | null;

export function ClockSourcesPanel({
  connected,
  initialDiagnostics = [],
  initialInputs = [],
  initialSources = [],
  onGetClockSource,
  onListClockSources,
  onListMidiInputs,
  onStartMidiClockSource,
  onStopMidiClockSource
}: ClockSourcesPanelProps) {
  const [action, setAction] = useState<ClockSourcePanelAction>(null);
  const [diagnostics, setDiagnostics] = useState(initialDiagnostics);
  const [inputs, setInputs] = useState(initialInputs);
  const [sources, setSources] = useState(initialSources);
  const [selectedSourceId, setSelectedSourceId] = useState(initialSources[0]?.sourceId ?? "");
  const [sourceId, setSourceId] = useState(initialSources[0]?.sourceId ?? "midi-clock");
  const [inputPortIndex, setInputPortIndex] = useState(0);
  const [useTimeSignature, setUseTimeSignature] = useState(true);
  const [meterNumerator, setMeterNumerator] = useState(4);
  const [meterDenominator, setMeterDenominator] = useState(4);
  const selectedSource = sources.find((source) => source.sourceId === selectedSourceId) ?? sources[0] ?? null;
  const busy = action !== null;

  async function refreshSources() {
    await runPanelAction(setAction, setDiagnostics, "sources", async () => {
      const response = await onListClockSources();
      setSources(response.sources);
      setDiagnostics(response.diagnostics);
      if (response.sources[0] && !selectedSourceId) {
        setSelectedSourceId(response.sources[0].sourceId);
        setSourceId(response.sources[0].sourceId);
      }
    });
  }

  async function refreshSelectedSource(id = selectedSourceId || sourceId) {
    const trimmed = id.trim();
    if (!trimmed) {
      setDiagnostics([localDiagnostic("invalid-clock-source-id", "Clock source id is required.")]);
      return;
    }

    await runPanelAction(setAction, setDiagnostics, "source", async () => {
      const response = await onGetClockSource(trimmed);
      setDiagnostics(response.diagnostics);
      if (response.source) {
        const nextSource = response.source;
        setSources((current) => upsertSource(current, nextSource));
        setSelectedSourceId(nextSource.sourceId);
        setSourceId(nextSource.sourceId);
      }
    });
  }

  async function refreshInputs() {
    await runPanelAction(setAction, setDiagnostics, "inputs", async () => {
      const response = await onListMidiInputs();
      setInputs(response.inputs);
      setDiagnostics(response.diagnostics);
    });
  }

  async function startSource() {
    const trimmedSourceId = sourceId.trim();
    if (!trimmedSourceId) {
      setDiagnostics([localDiagnostic("invalid-clock-source-id", "Clock source id is required.")]);
      return;
    }
    if (!Number.isInteger(inputPortIndex) || inputPortIndex < 0) {
      setDiagnostics([localDiagnostic("invalid-midi-input-port", "MIDI input port index must be a non-negative integer.")]);
      return;
    }

    await runPanelAction(setAction, setDiagnostics, "start", async () => {
      const request: MidiClockSourceStartRequest = {
        sourceId: trimmedSourceId,
        inputPortIndex,
        timeSignature: useTimeSignature
          ? {
              numerator: meterNumerator,
              denominator: meterDenominator
            }
          : null
      };
      const response = await onStartMidiClockSource(request);
      setDiagnostics(response.diagnostics);
      if (response.source) {
        const nextSource = response.source;
        setSources((current) => upsertSource(current, nextSource));
        setSelectedSourceId(nextSource.sourceId);
      }
    });
  }

  async function stopSource() {
    const trimmedSourceId = sourceId.trim() || selectedSourceId.trim();
    if (!trimmedSourceId) {
      setDiagnostics([localDiagnostic("clock-source-not-found", "Clock source id is required before stop.")]);
      return;
    }

    await runPanelAction(setAction, setDiagnostics, "stop", async () => {
      const response = await onStopMidiClockSource({ sourceId: trimmedSourceId });
      setDiagnostics(response.diagnostics);
      if (response.source) {
        const nextSource = response.source;
        setSources((current) => upsertSource(current, nextSource));
        setSelectedSourceId(nextSource.sourceId);
      }
    });
  }

  return (
    <Stack gap="xs">
      <Group justify="space-between" wrap="nowrap">
        <div>
          <Text fw={800} size="sm">
            Runtime Clock Sources
          </Text>
          <Text c="dimmed" size="xs">
            Runtime snapshots and explicit MIDI lifecycle
          </Text>
        </div>
        <Badge color={sources.some((source) => source.status === "running") ? "green" : "gray"} radius="sm" variant="light">
          {sources.filter((source) => source.status === "running").length} running
        </Badge>
      </Group>

      <Group gap="xs" grow>
        <Button disabled={!connected || busy} leftSection={<List size={15} />} loading={action === "sources"} onClick={refreshSources} radius="sm" size="xs" variant="light">
          Refresh Sources
        </Button>
        <Button disabled={!connected || busy} leftSection={<RefreshCw size={15} />} loading={action === "source"} onClick={() => refreshSelectedSource()} radius="sm" size="xs" variant="light">
          Read Source
        </Button>
      </Group>

      <SourceTable
        onSelect={(id) => {
          setSelectedSourceId(id);
          setSourceId(id);
        }}
        selectedSourceId={selectedSource?.sourceId ?? ""}
        sources={sources}
      />

      <ClockStateDisplay state={selectedSource?.latestSnapshot ?? null} />

      <Divider />

      <Group justify="space-between" wrap="nowrap">
        <div>
          <Text fw={800} size="sm">
            MIDI Inputs
          </Text>
          <Text c="dimmed" size="xs">
            Runtime enumeration index · not stable identity
          </Text>
        </div>
        <Button disabled={!connected || busy} leftSection={<RefreshCw size={15} />} loading={action === "inputs"} onClick={refreshInputs} radius="sm" size="xs" variant="light">
          Refresh
        </Button>
      </Group>

      <Text c="dimmed" size="xs">
        inputPortIndex is the current Runtime enumeration index, not a stable device identity.
      </Text>

      <MidiInputTable inputs={inputs} />

      <TextInput
        aria-label="Clock source id"
        disabled={!connected || busy}
        label="Source ID"
        onChange={(event) => setSourceId(event.currentTarget.value)}
        radius="sm"
        size="xs"
        value={sourceId}
      />

      <NumberInput
        aria-label="MIDI input port index"
        clampBehavior="strict"
        disabled={!connected || busy}
        label="Input Port Index"
        min={0}
        onChange={(value) => setInputPortIndex(typeof value === "number" ? value : 0)}
        radius="sm"
        size="xs"
        value={inputPortIndex}
      />

      <Checkbox
        checked={useTimeSignature}
        disabled={!connected || busy}
        label="Meter for derived bar/beat"
        onChange={(event) => setUseTimeSignature(event.currentTarget.checked)}
        size="xs"
      />

      <Group gap="xs" grow>
        <NumberInput
          aria-label="Time signature numerator"
          clampBehavior="strict"
          disabled={!connected || busy || !useTimeSignature}
          label="Numerator"
          min={1}
          onChange={(value) => setMeterNumerator(typeof value === "number" ? value : 4)}
          radius="sm"
          size="xs"
          value={meterNumerator}
        />
        <NumberInput
          aria-label="Time signature denominator"
          clampBehavior="strict"
          disabled={!connected || busy || !useTimeSignature}
          label="Denominator"
          min={1}
          onChange={(value) => setMeterDenominator(typeof value === "number" ? value : 4)}
          radius="sm"
          size="xs"
          value={meterDenominator}
        />
      </Group>

      <Group gap="xs" grow>
        <Button disabled={!connected || busy} leftSection={<Play size={15} />} loading={action === "start"} onClick={startSource} radius="sm" size="xs" variant="filled">
          Start MIDI
        </Button>
        <Button disabled={!connected || busy} leftSection={<Square size={15} />} loading={action === "stop"} onClick={stopSource} radius="sm" size="xs" variant="light">
          Stop MIDI
        </Button>
      </Group>

      <DiagnosticList diagnostics={diagnostics.concat(selectedSource?.diagnostics ?? [])} />
    </Stack>
  );
}

function SourceTable({
  onSelect,
  selectedSourceId,
  sources
}: {
  onSelect: (sourceId: string) => void;
  selectedSourceId: string;
  sources: ClockSourceSnapshot[];
}) {
  if (sources.length === 0) {
    return (
      <Text c="dimmed" size="xs">
        No clock sources registered.
      </Text>
    );
  }

  return (
    <Table className="clock-source-table" withRowBorders={false}>
      <Table.Tbody>
        {sources.map((source) => (
          <Table.Tr key={source.sourceId}>
            <Table.Td>
              <Button onClick={() => onSelect(source.sourceId)} radius="sm" size="compact-xs" variant={source.sourceId === selectedSourceId ? "light" : "subtle"}>
                {source.sourceId}
              </Button>
            </Table.Td>
            <Table.Td>
              <Text size="xs">{source.sourceKind}</Text>
            </Table.Td>
            <Table.Td>
              <Badge color={sourceStatusColor(source.status)} radius="sm" size="xs" variant="light">
                {source.status}
              </Badge>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function MidiInputTable({ inputs }: { inputs: MidiInputDescriptor[] }) {
  if (inputs.length === 0) {
    return (
      <Text c="dimmed" size="xs">
        No MIDI input ports found.
      </Text>
    );
  }

  return (
    <Table className="clock-source-table" withRowBorders={false}>
      <Table.Tbody>
        {inputs.map((input) => (
          <Table.Tr key={`${input.backend}-${input.index}-${input.name}`}>
            <Table.Td>
              <Badge color="gray" radius="sm" size="xs" variant="light">
                index {input.index}
              </Badge>
            </Table.Td>
            <Table.Td>
              <Text size="xs">{input.name}</Text>
            </Table.Td>
            <Table.Td>
              <Badge color="yellow" radius="sm" size="xs" variant="light">
                unstable
              </Badge>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function DiagnosticList({ diagnostics }: { diagnostics: RuntimeClockDiagnostic[] }) {
  if (diagnostics.length === 0) {
    return (
      <Text c="dimmed" size="xs">
        Clock diagnostics clear.
      </Text>
    );
  }

  return (
    <Stack gap={4}>
      {diagnostics.slice(0, 5).map((diagnostic, index) => (
        <Alert color={diagnostic.severity === "error" ? "red" : "yellow"} key={`${diagnostic.code}-${index}`} radius="sm" variant="light">
          <Group gap={6} wrap="nowrap">
            <Badge color={diagnostic.severity === "error" ? "red" : "yellow"} radius="sm" size="xs" variant="filled">
              {diagnostic.code}
            </Badge>
            <Text size="xs">{diagnostic.message}</Text>
          </Group>
        </Alert>
      ))}
    </Stack>
  );
}

function sourceStatusColor(status: ClockSourceSnapshot["status"]): string {
  switch (status) {
    case "running":
      return "green";
    case "stopped":
      return "gray";
    case "error":
      return "red";
  }
}

function upsertSource(sources: ClockSourceSnapshot[], nextSource: ClockSourceSnapshot): ClockSourceSnapshot[] {
  const index = sources.findIndex((source) => source.sourceId === nextSource.sourceId);
  if (index < 0) {
    return [nextSource, ...sources];
  }
  return sources.map((source, sourceIndex) => (sourceIndex === index ? nextSource : source));
}

function localDiagnostic(code: string, message: string): RuntimeClockDiagnostic {
  return {
    code,
    message,
    severity: "error"
  };
}

async function runPanelAction(
  setAction: (action: ClockSourcePanelAction) => void,
  setDiagnostics: (diagnostics: RuntimeClockDiagnostic[]) => void,
  action: Exclude<ClockSourcePanelAction, null>,
  callback: () => Promise<void>
) {
  setAction(action);
  setDiagnostics([]);
  try {
    await callback();
  } catch (error) {
    setDiagnostics([
      localDiagnostic(
        "runtime-request-failed",
        error instanceof Error ? error.message : "Runtime clock source request failed."
      )
    ]);
  } finally {
    setAction(null);
  }
}
