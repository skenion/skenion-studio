import type {
  RuntimeConnectionProfile,
  RuntimeConnectionProfileMode,
  RuntimeEndpointMetadata,
  RuntimeOwnershipMode
} from "@skenion/contracts";
import { DEFAULT_RUNTIME_URL, normalizeRuntimeUrl } from "../runtime/client";
import type { RuntimeSidecarStartupResponse } from "./sidecarTypes";

export const DEFAULT_RUNTIME_SESSION_ID = "default";

export type RuntimeProfileId = RuntimeConnectionProfileMode;
export type ManagedSidecarStatus = "stopped" | "starting" | "running" | "stopping" | "error";

export interface StudioRuntimeProfile {
  id: RuntimeProfileId;
  label: string;
  mode: RuntimeConnectionProfileMode;
  ownership: RuntimeOwnershipMode;
  url: string;
}

export interface ManagedSidecarState {
  diagnostics: string[];
  ownerWindowId: string | null;
  profileId: RuntimeProfileId | null;
  runtimeUrl: string | null;
  startup: RuntimeSidecarStartupResponse | null;
  status: ManagedSidecarStatus;
}

export interface RuntimeProfileState {
  activeProfileId: RuntimeProfileId;
  managedSidecar: ManagedSidecarState;
  profiles: Record<RuntimeProfileId, StudioRuntimeProfile>;
}

export type RuntimeProfileEffect =
  | {
      isolated: boolean;
      ownerWindowId: string;
      profileId: RuntimeProfileId;
      type: "startManagedSidecar";
    }
  | {
      profileId: RuntimeProfileId;
      reason: "profile-switch" | "window-close" | "manual";
      type: "stopManagedSidecar";
    };

export interface RuntimeProfileTransition {
  connectUrl: string | null;
  effects: RuntimeProfileEffect[];
  state: RuntimeProfileState;
}

export function createRuntimeProfileState(
  options: {
    activeProfileId?: RuntimeProfileId;
    defaultRuntimeUrl?: string;
    remoteRuntimeUrl?: string;
  } = {}
): RuntimeProfileState {
  const defaultRuntimeUrl = normalizeRuntimeUrl(options.defaultRuntimeUrl ?? DEFAULT_RUNTIME_URL);
  const remoteRuntimeUrl = normalizeRuntimeUrl(options.remoteRuntimeUrl ?? defaultRuntimeUrl);
  const activeProfileId = options.activeProfileId ?? "local-managed";
  return {
    activeProfileId,
    managedSidecar: {
      diagnostics: [],
      ownerWindowId: null,
      profileId: null,
      runtimeUrl: null,
      startup: null,
      status: "stopped"
    },
    profiles: {
      "local-managed": {
        id: "local-managed",
        label: "Managed",
        mode: "local-managed",
        ownership: "owned-child",
        url: defaultRuntimeUrl
      },
      "local-shared": {
        id: "local-shared",
        label: "Shared",
        mode: "local-shared",
        ownership: "external",
        url: defaultRuntimeUrl
      },
      remote: {
        id: "remote",
        label: "Remote",
        mode: "remote",
        ownership: "remote",
        url: remoteRuntimeUrl
      }
    }
  };
}

export function activeRuntimeProfile(state: RuntimeProfileState): StudioRuntimeProfile {
  return state.profiles[state.activeProfileId];
}

export function updateRuntimeProfileUrl(
  state: RuntimeProfileState,
  profileId: RuntimeProfileId,
  url: string
): RuntimeProfileState {
  const profile = state.profiles[profileId];
  return {
    ...state,
    profiles: {
      ...state.profiles,
      [profileId]: {
        ...profile,
        url
      }
    }
  };
}

export function switchRuntimeProfile(
  state: RuntimeProfileState,
  profileId: RuntimeProfileId,
  options: { stopManagedSidecar?: boolean } = {}
): RuntimeProfileTransition {
  if (!state.profiles[profileId]) {
    throw new Error(`Unknown runtime profile ${profileId}.`);
  }

  const effects: RuntimeProfileEffect[] = [];
  const shouldStopManagedSidecar =
    options.stopManagedSidecar ?? state.managedSidecar.status === "running";
  if (
    shouldStopManagedSidecar &&
    state.activeProfileId === "local-managed" &&
    profileId !== "local-managed" &&
    state.managedSidecar.status === "running" &&
    state.managedSidecar.profileId === "local-managed"
  ) {
    effects.push({
      profileId: "local-managed",
      reason: "profile-switch",
      type: "stopManagedSidecar"
    });
  }

  const nextState: RuntimeProfileState = {
    ...state,
    activeProfileId: profileId,
    managedSidecar:
      effects.length > 0
        ? {
            ...state.managedSidecar,
            status: "stopping"
          }
        : state.managedSidecar
  };

  return {
    connectUrl: null,
    effects,
    state: nextState
  };
}

export function planRuntimeConnect(
  state: RuntimeProfileState,
  options: { isolated?: boolean; ownerWindowId: string }
): RuntimeProfileTransition {
  const profile = activeRuntimeProfile(state);
  if (profile.mode !== "local-managed") {
    return {
      connectUrl: normalizeRuntimeUrl(profile.url),
      effects: [],
      state
    };
  }

  if (
    state.managedSidecar.status === "running" &&
    state.managedSidecar.profileId === profile.id &&
    state.managedSidecar.runtimeUrl
  ) {
    return {
      connectUrl: normalizeRuntimeUrl(state.managedSidecar.runtimeUrl),
      effects: [],
      state
    };
  }

  return {
    connectUrl: null,
    effects: [
      {
        isolated: options.isolated ?? false,
        ownerWindowId: options.ownerWindowId,
        profileId: profile.id,
        type: "startManagedSidecar"
      }
    ],
    state: {
      ...state,
      managedSidecar: {
        ...state.managedSidecar,
        diagnostics: [],
        ownerWindowId: options.ownerWindowId,
        profileId: profile.id,
        runtimeUrl: null,
        startup: null,
        status: "starting"
      }
    }
  };
}

export function applyRuntimeSidecarStarted(
  state: RuntimeProfileState,
  effect: Extract<RuntimeProfileEffect, { type: "startManagedSidecar" }>,
  startup: RuntimeSidecarStartupResponse
): RuntimeProfileState {
  if (!startup.ok) {
    return applyRuntimeSidecarError(
      state,
      startup.diagnostics.map((diagnostic) => diagnostic.message)
    );
  }

  const runtimeUrl = normalizeRuntimeUrl(startup.endpoint.url);
  return {
    ...state,
    profiles: {
      ...state.profiles,
      [effect.profileId]: {
        ...state.profiles[effect.profileId],
        url: runtimeUrl
      }
    },
    managedSidecar: {
      diagnostics: startup.diagnostics.map((diagnostic) => diagnostic.message),
      ownerWindowId: effect.ownerWindowId,
      profileId: effect.profileId,
      runtimeUrl,
      startup,
      status: "running"
    }
  };
}

export function applyRuntimeSidecarStopped(state: RuntimeProfileState): RuntimeProfileState {
  return {
    ...state,
    managedSidecar: {
      diagnostics: [],
      ownerWindowId: null,
      profileId: null,
      runtimeUrl: null,
      startup: null,
      status: "stopped"
    }
  };
}

export function applyRuntimeSidecarError(
  state: RuntimeProfileState,
  diagnostics: string[]
): RuntimeProfileState {
  return {
    ...state,
    managedSidecar: {
      ...state.managedSidecar,
      diagnostics,
      runtimeUrl: null,
      startup: null,
      status: "error"
    }
  };
}

export function runtimeConnectionProfileForStudioProfile(
  profile: StudioRuntimeProfile
): RuntimeConnectionProfile {
  const endpoint = endpointMetadataForRuntimeUrl(profile.url);
  switch (profile.mode) {
    case "local-managed":
      return {
        displayName: "skenion runtime local-managed sidecar",
        endpoint,
        mode: "local-managed",
        ownership: "owned-child",
        process: null
      };
    case "local-shared":
      return {
        displayName: "skenion runtime local-shared",
        endpoint,
        mode: "local-shared",
        ownership: "external",
        process: null
      };
    case "remote":
      return {
        displayName: "skenion runtime remote",
        endpoint,
        mode: "remote",
        ownership: "remote",
        process: null
      };
  }
}

export function endpointMetadataForRuntimeUrl(url: string): RuntimeEndpointMetadata {
  const normalized = normalizeRuntimeUrl(url);
  const parsed = new URL(normalized);
  const tls = parsed.protocol === "https:";
  return {
    canonicalUrl: normalized,
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : undefined,
    protocol: tls ? "https" : "http",
    tls,
    url: normalized
  };
}
