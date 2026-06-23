import { normalizeRuntimeUrl } from "../runtime/client";
import type { RuntimeProfileId } from "./runtimeProfiles";

export type StudioWindowMode = "shared-session" | "isolated-runtime" | "volatile-help";

export interface StudioWindowLocalState {
  activeEditId: string | null;
  inspectorOpen: boolean;
  selectedEdgeIds: string[];
  selectedNodeIds: string[];
  viewport: { x: number; y: number; zoom: number } | null;
}

export interface SharedRuntimeWindowScope {
  kind: "shared-runtime";
  profileId: RuntimeProfileId;
  runtimeUrl: string;
  sessionId: string;
}

export interface IsolatedRuntimeWindowScope {
  kind: "isolated-runtime";
  ownerWindowId: string;
  profileId: RuntimeProfileId;
  runtimeUrl: string;
  sessionId: string;
}

export interface VolatileHelpWindowScope {
  kind: "volatile-help";
  sourcePatchId: string | null;
  workingCopyId: string;
}

export type StudioWindowScope =
  | SharedRuntimeWindowScope
  | IsolatedRuntimeWindowScope
  | VolatileHelpWindowScope;

export interface StudioWindowRecord {
  id: string;
  localState: StudioWindowLocalState;
  openedAt: string;
  scope: StudioWindowScope;
  title: string;
  updatedAt: string;
}

export interface StudioWindowRegistry {
  activeWindowId: string;
  windows: Record<string, StudioWindowRecord>;
}

export function createStudioWindowId(prefix = "studio-window"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createWindowRegistry(options: {
  now?: string;
  title?: string;
  windowId: string;
  scope: StudioWindowScope;
}): StudioWindowRegistry {
  const now = options.now ?? new Date().toISOString();
  const window = createWindowRecord({
    id: options.windowId,
    now,
    scope: options.scope,
    title: options.title ?? "skenion studio"
  });
  return {
    activeWindowId: options.windowId,
    windows: {
      [options.windowId]: window
    }
  };
}

export function registerRuntimeWindow(
  registry: StudioWindowRegistry,
  options: {
    now?: string;
    title?: string;
    windowId: string;
    scope: SharedRuntimeWindowScope | IsolatedRuntimeWindowScope;
  }
): StudioWindowRegistry {
  return registerWindow(registry, {
    id: options.windowId,
    now: options.now,
    scope: options.scope,
    title: options.title ?? "skenion studio"
  });
}

export function registerHelpWorkingCopyWindow(
  registry: StudioWindowRegistry,
  options: {
    now?: string;
    sourcePatchId?: string | null;
    windowId: string;
    workingCopyId: string;
  }
): StudioWindowRegistry {
  return registerWindow(registry, {
    id: options.windowId,
    now: options.now,
    scope: {
      kind: "volatile-help",
      sourcePatchId: options.sourcePatchId ?? null,
      workingCopyId: options.workingCopyId
    },
    title: options.sourcePatchId ? `Help: ${options.sourcePatchId}` : "Help working copy"
  });
}

export function updateWindowRuntimeScope(
  registry: StudioWindowRegistry,
  windowId: string,
  scope: SharedRuntimeWindowScope | IsolatedRuntimeWindowScope,
  now = new Date().toISOString()
): StudioWindowRegistry {
  const window = registry.windows[windowId];
  if (!window) {
    return registerRuntimeWindow(registry, { now, scope, windowId });
  }
  return {
    ...registry,
    windows: {
      ...registry.windows,
      [windowId]: {
        ...window,
        scope,
        updatedAt: now
      }
    }
  };
}

export function updateWindowLocalState(
  registry: StudioWindowRegistry,
  windowId: string,
  update: Partial<StudioWindowLocalState>,
  now = new Date().toISOString()
): StudioWindowRegistry {
  const window = registry.windows[windowId];
  if (!window) {
    return registry;
  }
  return {
    ...registry,
    windows: {
      ...registry.windows,
      [windowId]: {
        ...window,
        localState: {
          ...window.localState,
          ...update
        },
        updatedAt: now
      }
    }
  };
}

export function runtimeSessionScopeKey(
  scope: StudioWindowScope
): string | null {
  if (scope.kind === "volatile-help") {
    return null;
  }
  if (scope.kind === "isolated-runtime") {
    return `isolated:${scope.ownerWindowId}:${scope.profileId}:${normalizeRuntimeUrl(scope.runtimeUrl)}:${scope.sessionId}`;
  }
  return `shared:${scope.profileId}:${normalizeRuntimeUrl(scope.runtimeUrl)}:${scope.sessionId}`;
}

export function windowsForRuntimeSession(
  registry: StudioWindowRegistry,
  scope: SharedRuntimeWindowScope | IsolatedRuntimeWindowScope
): StudioWindowRecord[] {
  const key = runtimeSessionScopeKey(scope);
  return Object.values(registry.windows).filter((window) => runtimeSessionScopeKey(window.scope) === key);
}

export function createSharedRuntimeScope(options: {
  profileId: RuntimeProfileId;
  runtimeUrl: string;
  sessionId: string;
}): SharedRuntimeWindowScope {
  return {
    kind: "shared-runtime",
    profileId: options.profileId,
    runtimeUrl: normalizeRuntimeUrl(options.runtimeUrl),
    sessionId: options.sessionId
  };
}

export function createIsolatedRuntimeScope(options: {
  ownerWindowId: string;
  profileId: RuntimeProfileId;
  runtimeUrl: string;
  sessionId: string;
}): IsolatedRuntimeWindowScope {
  return {
    kind: "isolated-runtime",
    ownerWindowId: options.ownerWindowId,
    profileId: options.profileId,
    runtimeUrl: normalizeRuntimeUrl(options.runtimeUrl),
    sessionId: options.sessionId
  };
}

function registerWindow(
  registry: StudioWindowRegistry,
  options: {
    id: string;
    now?: string;
    scope: StudioWindowScope;
    title: string;
  }
): StudioWindowRegistry {
  const now = options.now ?? new Date().toISOString();
  return {
    ...registry,
    activeWindowId: options.id,
    windows: {
      ...registry.windows,
      [options.id]: createWindowRecord({
        id: options.id,
        now,
        scope: options.scope,
        title: options.title
      })
    }
  };
}

function createWindowRecord(options: {
  id: string;
  now: string;
  scope: StudioWindowScope;
  title: string;
}): StudioWindowRecord {
  return {
    id: options.id,
    localState: {
      activeEditId: null,
      inspectorOpen: true,
      selectedEdgeIds: [],
      selectedNodeIds: [],
      viewport: null
    },
    openedAt: options.now,
    scope: options.scope,
    title: options.title,
    updatedAt: options.now
  };
}
