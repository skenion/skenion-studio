import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { RuntimeProfileId } from "./runtimeProfiles";
import type {
  RuntimeSidecarStartupResponse,
  RuntimeSidecarStopResponse
} from "./sidecarTypes";
import type { StudioWindowMode } from "./windowRegistry";

export interface StartRuntimeSidecarRequest {
  isolated?: boolean;
  ownerWindowId: string;
  profileId: RuntimeProfileId;
  runtimeExecutable?: string;
}

export interface StopRuntimeSidecarRequest {
  ownerWindowId?: string;
  profileId: RuntimeProfileId;
  reason?: string;
}

export interface OpenStudioWindowRequest {
  profileId: RuntimeProfileId;
  runtimeUrl: string;
  sessionId: string;
  windowId: string;
  windowMode: StudioWindowMode;
}

export interface OpenStudioWindowResponse {
  ok: boolean;
  windowId: string;
}

export interface TauriDesktopBridge {
  available: boolean;
  currentWindowLabel: string | null;
  openStudioWindow: (request: OpenStudioWindowRequest) => Promise<OpenStudioWindowResponse>;
  startManagedSidecar: (request: StartRuntimeSidecarRequest) => Promise<RuntimeSidecarStartupResponse>;
  stopManagedSidecar: (request: StopRuntimeSidecarRequest) => Promise<RuntimeSidecarStopResponse>;
}

export type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

export function isTauriDesktopAvailable(globalValue: unknown = globalThis): boolean {
  return Boolean(
    globalValue &&
      typeof globalValue === "object" &&
      "__TAURI_INTERNALS__" in globalValue
  );
}

export function createTauriDesktopBridge(
  options: {
    available?: boolean;
    currentWindowLabel?: string | null;
    invokeImpl?: TauriInvoke;
  } = {}
): TauriDesktopBridge {
  const available = options.available ?? isTauriDesktopAvailable();
  const currentWindowLabel = options.currentWindowLabel ?? readCurrentWindowLabel(available);
  const invokeImpl = options.invokeImpl ?? tauriInvoke;
  return {
    available,
    currentWindowLabel,
    openStudioWindow: (request) =>
      invokeImpl<OpenStudioWindowResponse>("open_studio_window", { request }),
    startManagedSidecar: (request) =>
      invokeImpl<RuntimeSidecarStartupResponse>("start_runtime_sidecar", { request }),
    stopManagedSidecar: (request) =>
      invokeImpl<RuntimeSidecarStopResponse>("stop_runtime_sidecar", { request })
  };
}

function readCurrentWindowLabel(available: boolean): string | null {
  if (!available) {
    return null;
  }
  try {
    return getCurrentWindow().label || null;
  } catch {
    return null;
  }
}
