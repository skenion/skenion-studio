import { DEFAULT_RUNTIME_URL, normalizeRuntimeUrl } from "../runtime/client";
import {
  DEFAULT_RUNTIME_SESSION_ID,
  type RuntimeProfileId
} from "./runtimeProfiles";
import {
  createStudioWindowId,
  type StudioWindowMode
} from "./windowRegistry";

export interface DesktopLaunchContext {
  profileId: RuntimeProfileId;
  runtimeUrl: string;
  sessionId: string;
  windowId: string | null;
  windowMode: StudioWindowMode;
}

export function readDesktopLaunchContext(search = globalThis.location?.search ?? ""): DesktopLaunchContext {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return {
    profileId: parseProfileId(params.get("runtimeProfile")),
    runtimeUrl: parseRuntimeUrl(params.get("runtimeUrl")),
    sessionId: parseSessionId(params.get("sessionId")),
    windowId: parseOptionalToken(params.get("windowId")),
    windowMode: parseWindowMode(params.get("windowMode"))
  };
}

export function resolveStudioWindowId(options: {
  createWindowId?: () => string;
  launchWindowId: string | null;
  tauriWindowLabel?: string | null;
}): string {
  return (
    options.launchWindowId ??
    parseOptionalToken(options.tauriWindowLabel ?? null) ??
    (options.createWindowId ?? createStudioWindowId)()
  );
}

function parseRuntimeUrl(value: string | null): string {
  if (!value) {
    return DEFAULT_RUNTIME_URL;
  }
  try {
    return normalizeRuntimeUrl(value);
  } catch {
    return DEFAULT_RUNTIME_URL;
  }
}

function parseProfileId(value: string | null): RuntimeProfileId {
  return value === "local-shared" || value === "remote" ? value : "local-managed";
}

function parseSessionId(value: string | null): string {
  return parseOptionalToken(value) ?? DEFAULT_RUNTIME_SESSION_ID;
}

function parseWindowMode(value: string | null): StudioWindowMode {
  return value === "isolated-runtime" || value === "volatile-help" ? value : "shared-session";
}

function parseOptionalToken(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}
