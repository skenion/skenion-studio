import { describe, expect, it, vi } from "vitest";
import {
  createTauriDesktopBridge,
  isTauriDesktopAvailable,
  type TauriInvoke
} from "./tauriBridge";

describe("tauriBridge", () => {
  it("detects Tauri desktop availability from the global marker", () => {
    expect(isTauriDesktopAvailable({ __TAURI_INTERNALS__: {} })).toBe(true);
    expect(isTauriDesktopAvailable({})).toBe(false);
    expect(isTauriDesktopAvailable(null)).toBe(false);
  });

  it("exposes the current Tauri window label for sidecar ownership", () => {
    const bridge = createTauriDesktopBridge({
      available: true,
      currentWindowLabel: "main",
      invokeImpl: vi.fn() as unknown as TauriInvoke
    });

    expect(bridge.currentWindowLabel).toBe("main");
  });

  it("invokes desktop sidecar and window commands with typed payloads", async () => {
    const invoke = vi.fn(async (command: string) => {
      if (command === "start_runtime_sidecar") {
        return {
          defaultSessionId: "default",
          diagnostics: [],
          endpoint: { url: "http://127.0.0.1:49152" },
          ok: true,
          schema: "skenion.runtime.sidecar.startup",
          schemaVersion: "0.1.0"
        };
      }
      if (command === "stop_runtime_sidecar") {
        return { diagnostics: [], ok: true, stopped: true };
      }
      return { ok: true, windowId: "window-2" };
    });
    const bridge = createTauriDesktopBridge({
      available: true,
      invokeImpl: invoke as unknown as TauriInvoke
    });

    await bridge.startManagedSidecar({
      ownerWindowId: "window-1",
      profileId: "local-managed"
    });
    await bridge.stopManagedSidecar({
      profileId: "local-managed",
      reason: "profile-switch"
    });
    await bridge.openStudioWindow({
      profileId: "remote",
      runtimeUrl: "https://runtime.example.test",
      sessionId: "alpha",
      windowId: "window-2",
      windowMode: "shared-session"
    });

    expect(invoke.mock.calls).toEqual([
      [
        "start_runtime_sidecar",
        {
          request: {
            ownerWindowId: "window-1",
            profileId: "local-managed"
          }
        }
      ],
      [
        "stop_runtime_sidecar",
        {
          request: {
            profileId: "local-managed",
            reason: "profile-switch"
          }
        }
      ],
      [
        "open_studio_window",
        {
          request: {
            profileId: "remote",
            runtimeUrl: "https://runtime.example.test",
            sessionId: "alpha",
            windowId: "window-2",
            windowMode: "shared-session"
          }
        }
      ]
    ]);
  });
});
