import { describe, expect, it } from "vitest";
import {
  createIsolatedRuntimeScope,
  createSharedRuntimeScope,
  createWindowRegistry,
  registerHelpWorkingCopyWindow,
  registerRuntimeWindow,
  runtimeSessionScopeKey,
  updateWindowLocalState,
  windowsForRuntimeSession
} from "./windowRegistry";

describe("windowRegistry", () => {
  it("maps multiple Studio windows to the same shared Runtime session", () => {
    const scope = createSharedRuntimeScope({
      profileId: "local-managed",
      runtimeUrl: "http://127.0.0.1:49152/",
      sessionId: "default"
    });
    const registry = registerRuntimeWindow(
      createWindowRegistry({
        now: "2026-06-22T00:00:00.000Z",
        scope,
        windowId: "main"
      }),
      {
        now: "2026-06-22T00:01:00.000Z",
        scope,
        windowId: "detail"
      }
    );

    expect(runtimeSessionScopeKey(scope)).toBe("shared:local-managed:http://127.0.0.1:49152:default");
    expect(windowsForRuntimeSession(registry, scope).map((window) => window.id)).toEqual(["main", "detail"]);
  });

  it("keeps window-local selection and viewport state independent", () => {
    const scope = createSharedRuntimeScope({
      profileId: "remote",
      runtimeUrl: "https://runtime.example.test",
      sessionId: "alpha"
    });
    const registry = registerRuntimeWindow(
      createWindowRegistry({ scope, windowId: "main" }),
      { scope, windowId: "detail" }
    );

    const updated = updateWindowLocalState(registry, "main", {
      selectedNodeIds: ["node-a"],
      viewport: { x: 10, y: 20, zoom: 0.75 }
    });

    expect(updated.windows.main?.localState.selectedNodeIds).toEqual(["node-a"]);
    expect(updated.windows.detail?.localState.selectedNodeIds).toEqual([]);
    expect(windowsForRuntimeSession(updated, scope)).toHaveLength(2);
  });

  it("treats isolated runtime windows as distinct even when session ids match", () => {
    const isolatedA = createIsolatedRuntimeScope({
      ownerWindowId: "window-a",
      profileId: "local-managed",
      runtimeUrl: "http://127.0.0.1:49152",
      sessionId: "default"
    });
    const isolatedB = createIsolatedRuntimeScope({
      ownerWindowId: "window-b",
      profileId: "local-managed",
      runtimeUrl: "http://127.0.0.1:49152",
      sessionId: "default"
    });
    const registry = registerRuntimeWindow(
      createWindowRegistry({ scope: isolatedA, windowId: "window-a" }),
      { scope: isolatedB, windowId: "window-b" }
    );

    expect(runtimeSessionScopeKey(isolatedA)).not.toBe(runtimeSessionScopeKey(isolatedB));
    expect(windowsForRuntimeSession(registry, isolatedA).map((window) => window.id)).toEqual(["window-a"]);
  });

  it("keeps volatile help working copies out of Runtime session groups", () => {
    const scope = createSharedRuntimeScope({
      profileId: "local-shared",
      runtimeUrl: "http://localhost:3761",
      sessionId: "default"
    });
    const registry = registerHelpWorkingCopyWindow(
      createWindowRegistry({ scope, windowId: "main" }),
      {
        sourcePatchId: "core.float",
        windowId: "help",
        workingCopyId: "core.float-help-working-copy-1"
      }
    );

    expect(runtimeSessionScopeKey(registry.windows.help!.scope)).toBeNull();
    expect(windowsForRuntimeSession(registry, scope).map((window) => window.id)).toEqual(["main"]);
  });
});
