import { Group, Text, Tooltip } from "@mantine/core";
import { CircleAlert, Lock, ScrollText, TriangleAlert, Unlock } from "lucide-react";
import type { ValidationResult } from "@skenion/contracts";
import type { DisplayGraphDocumentV01 } from "../graph/patchLibrary";
import type { GraphSemanticDiagnostic } from "../graph/portSemantics";
import { IconButton } from "./core/IconButton/IconButton";
import styles from "./DiagnosticsFooter.module.css";

export interface DiagnosticCounts {
  errors: number;
  warnings: number;
}

export function diagnosticCounts(
  validation: ValidationResult<DisplayGraphDocumentV01>,
  semanticDiagnostics: GraphSemanticDiagnostic[]
): DiagnosticCounts {
  const semanticErrors = semanticDiagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const warnings = semanticDiagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;
  return {
    errors: validation.ok ? semanticErrors : semanticErrors + validation.errors.length,
    warnings
  };
}

export function DiagnosticsFooter({
  graphLockDisabled,
  graphLocked,
  semanticDiagnostics,
  validation,
  onToggleGraphLock,
  onOpenLogs
}: {
  graphLockDisabled: boolean;
  graphLocked: boolean;
  semanticDiagnostics: GraphSemanticDiagnostic[];
  validation: ValidationResult<DisplayGraphDocumentV01>;
  onToggleGraphLock: () => void;
  onOpenLogs: () => void;
}) {
  const counts = diagnosticCounts(validation, semanticDiagnostics);

  return (
    <Group className={styles.footer} justify="space-between" wrap="nowrap">
      <Tooltip label={graphLocked ? "Locked: click to unlock" : "Unlocked: click to lock"}>
        <IconButton
          className={styles.lock}
          disabled={graphLockDisabled}
          icon={graphLocked ? <Lock size={13} /> : <Unlock size={13} />}
          label={graphLocked ? "Locked" : "Unlocked"}
          onClick={onToggleGraphLock}
          size={24}
        />
      </Tooltip>

      <Group gap="xs" wrap="nowrap">
        <Tooltip label={`${counts.warnings} warnings`}>
          <Group
            aria-label={`${counts.warnings} warnings`}
            className={styles.count}
            data-active={counts.warnings > 0 || undefined}
            data-kind="warning"
            gap={4}
            wrap="nowrap"
          >
            <TriangleAlert size={13} />
            <Text component="span" fw={800} size="xs">
              {counts.warnings}
            </Text>
          </Group>
        </Tooltip>
        <Tooltip label={`${counts.errors} errors`}>
          <Group
            aria-label={`${counts.errors} errors`}
            className={styles.count}
            data-active={counts.errors > 0 || undefined}
            data-kind="error"
            gap={4}
            wrap="nowrap"
          >
            <CircleAlert size={13} />
            <Text component="span" fw={800} size="xs">
              {counts.errors}
            </Text>
          </Group>
        </Tooltip>
        <Tooltip label="Logs">
          <IconButton
            className={styles.logs}
            icon={<ScrollText size={13} />}
            label="Logs"
            onClick={onOpenLogs}
            size={24}
          />
        </Tooltip>
      </Group>
    </Group>
  );
}
