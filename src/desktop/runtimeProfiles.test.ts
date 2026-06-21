import { describe, expect, it } from "vitest";
import {
  applyRuntimeSidecarStarted,
  applyRuntimeSidecarStopped,
  createRuntimeProfileState,
  endpointMetadataForRuntimeUrl,
  planRuntimeConnect,
  runtimeConnectionProfileForStudioProfile,
  switchRuntimeProfile,
  updateRuntimeProfileUrl
} from "./runtimeProfiles";
import type { RuntimeSidecarStartupResponse } from "./sidecarTypes";

describe("runtimeProfiles", () => {
  it("defaults to local-managed with explicit local-shared and remote profiles", () => {
    const state = createRuntimeProfileState({ defaultRuntimeUrl: " http://localhost:3761/ " });

    expect(state.activeProfileId).toBe("local-managed");
    expect(state.profiles["local-managed"].ownership).toBe("owned-child");
    expect(state.profiles["local-shared"].ownership).toBe("external");
    expect(state.profiles.remote.ownership).toBe("remote");
    expect(state.profiles["local-managed"].url).toBe("http://localhost:3761");
  });

  it("plans local-managed startup before connecting", () => {
    const state = createRuntimeProfileState();
    const transition = planRuntimeConnect(state, {
      isolated: true,
      ownerWindowId: "window-1"
    });

    expect(transition.connectUrl).toBeNull();
    expect(transition.effects).toEqual([
      {
        isolated: true,
        ownerWindowId: "window-1",
        profileId: "local-managed",
        type: "startManagedSidecar"
      }
    ]);
    expect(transition.state.managedSidecar.status).toBe("starting");
  });

  it("uses a started managed sidecar endpoint for local-managed reconnects", () => {
    const start = planRuntimeConnect(createRuntimeProfileState(), {
      ownerWindowId: "window-1"
    });
    const started = applyRuntimeSidecarStarted(
      start.state,
      start.effects[0] as Extract<(typeof start.effects)[number], { type: "startManagedSidecar" }>,
      startup("http://127.0.0.1:49321")
    );
    const reconnect = planRuntimeConnect(started, {
      ownerWindowId: "window-1"
    });

    expect(started.managedSidecar.status).toBe("running");
    expect(started.profiles["local-managed"].url).toBe("http://127.0.0.1:49321");
    expect(reconnect.connectUrl).toBe("http://127.0.0.1:49321");
    expect(reconnect.effects).toEqual([]);
  });

  it("stops only owned local-managed sidecars when switching profiles", () => {
    const start = planRuntimeConnect(createRuntimeProfileState(), {
      ownerWindowId: "window-1"
    });
    const running = applyRuntimeSidecarStarted(
      start.state,
      start.effects[0] as Extract<(typeof start.effects)[number], { type: "startManagedSidecar" }>,
      startup("http://127.0.0.1:49321")
    );

    const switched = switchRuntimeProfile(running, "remote");

    expect(switched.state.activeProfileId).toBe("remote");
    expect(switched.state.managedSidecar.status).toBe("stopping");
    expect(switched.effects).toEqual([
      {
        profileId: "local-managed",
        reason: "profile-switch",
        type: "stopManagedSidecar"
      }
    ]);
    expect(applyRuntimeSidecarStopped(switched.state).managedSidecar.status).toBe("stopped");
  });

  it("connects remote and local-shared profiles without sidecar lifecycle effects", () => {
    const state = updateRuntimeProfileUrl(
      createRuntimeProfileState({ activeProfileId: "remote" }),
      "remote",
      "https://runtime.example.test/"
    );

    expect(planRuntimeConnect(state, { ownerWindowId: "window-1" })).toMatchObject({
      connectUrl: "https://runtime.example.test",
      effects: []
    });

    const localShared = switchRuntimeProfile(state, "local-shared").state;
    expect(planRuntimeConnect(localShared, { ownerWindowId: "window-1" })).toMatchObject({
      connectUrl: "http://localhost:3761",
      effects: []
    });
  });

  it("builds contract-shaped connection profiles from Studio profiles", () => {
    const state = createRuntimeProfileState({ activeProfileId: "remote" });
    const profile = runtimeConnectionProfileForStudioProfile(
      updateRuntimeProfileUrl(state, "remote", "https://runtime.example.test:8443").profiles.remote
    );

    expect(profile).toMatchObject({
      endpoint: {
        host: "runtime.example.test",
        port: 8443,
        protocol: "https",
        tls: true,
        url: "https://runtime.example.test:8443"
      },
      mode: "remote",
      ownership: "remote"
    });
    expect(endpointMetadataForRuntimeUrl("http://127.0.0.1:49152/").port).toBe(49152);
  });
});

function startup(url: string): RuntimeSidecarStartupResponse {
  return {
    defaultSessionId: "default",
    defaultSessionUrl: `${url}/v0/sessions/default`,
    diagnostics: [],
    endpoint: {
      canonicalUrl: url,
      host: "127.0.0.1",
      port: Number(new URL(url).port),
      protocol: "http",
      tls: false,
      url
    },
    health: {
      ok: true,
      url: `${url}/v0/sidecar/health`
    },
    ok: true,
    profile: {
      endpoint: {
        canonicalUrl: url,
        host: "127.0.0.1",
        port: Number(new URL(url).port),
        protocol: "http",
        tls: false,
        url
      },
      mode: "local-managed",
      ownership: "owned-child",
      process: null
    },
    runtime: {
      apiVersion: "0.1.0",
      name: "skenion-runtime",
      version: "0.31.0"
    },
    schema: "skenion.runtime.sidecar.startup",
    schemaVersion: "0.1.0",
    shutdown: {
      method: "POST",
      scope: "owned-child-only",
      supported: true,
      url: `${url}/v0/sidecar/shutdown`
    },
    token: {
      header: "Authorization",
      required: false
    }
  };
}
