import { describe, expect, it, vi } from "vitest";
import {
  createRuntimeClient,
  isRuntimeSessionEvent,
  normalizeRuntimeSessionId,
  normalizeRuntimeUrl,
  RuntimeClientError,
  runtimeLogStreamUrl,
  runtimeSessionPath,
  runtimeSessionEventsStreamUrl
} from "./client";
import type {
  RuntimeOperationEnvelope,
  RuntimeAsset,
  RuntimeAssetGetResponse,
  RuntimeAssetImportResponse,
  RuntimeAssetListResponse,
  RuntimeControlEventResponse,
  RuntimeControlReadResponse,
  RuntimeControlStateResponse,
  RuntimeExtensionListResponse,
  RuntimeGeneratedShaderResponse,
  RuntimeHistory,
  RuntimeHistoryEntry,
  RuntimeIoDeviceListResponse,
  RuntimeLogSnapshotResponse,
  RuntimeMutationRequest,
  RuntimePatchResponse,
  RuntimePreviewStatus,
  RuntimeProjectPayload,
  RuntimeSessionInfoResponse,
  RuntimeSessionResponse,
  RuntimeSessionEvent,
  RuntimeSessionEventKind,
  RuntimeTelemetrySnapshot,
  RuntimeViewPatchOperation
} from "./types";

const project = {
  schema: "skenion.project",
  schemaVersion: "0.1.0",
  id: "test",
  revision: "1",
  graph: {
    schema: "skenion.graph",
    schemaVersion: "0.1.0",
    id: "test",
    revision: "1",
    nodes: [],
    edges: []
  },
  viewState: {
    schema: "skenion.view-state",
    schemaVersion: "0.1.0",
    canvas: {
      nodes: {},
      viewport: { x: 0, y: 0, zoom: 1 }
    }
  },
  patchLibrary: []
} as RuntimeProjectPayload;

const mutation: RuntimeMutationRequest = {
  description: "move object",
  viewPatch: {
    baseViewRevision: 1,
    ops: []
  }
};

describe("runtime client", () => {
  it("normalizes runtime URLs", () => {
    expect(normalizeRuntimeUrl(" http://localhost:3761/ ")).toBe("http://localhost:3761");
    expect(() => normalizeRuntimeUrl(" ")).toThrow(RuntimeClientError);
    expect(normalizeRuntimeSessionId(" alpha ")).toBe("alpha");
    expect(normalizeRuntimeSessionId(" ")).toBeNull();
    expect(runtimeSessionPath(null)).toBe("/v0/sessions/default");
    expect(runtimeSessionPath("alpha/beta", "/events/stream")).toBe("/v0/sessions/alpha%2Fbeta/events/stream");
    expect(runtimeSessionEventsStreamUrl("http://localhost:3761/")).toBe(
      "http://localhost:3761/v0/sessions/default/events/stream"
    );
    expect(runtimeSessionEventsStreamUrl("http://localhost:3761/", "alpha")).toBe(
      "http://localhost:3761/v0/sessions/alpha/events/stream"
    );
  });

  it("parses runtime info responses", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        name: "skenion-runtime",
        version: "0.5.0",
        apiVersion: "0.1.0",
        capabilities: ["project.validate"]
      })
    );
    const client = createRuntimeClient({ baseUrl: "http://runtime.local/", fetchImpl: fetchMock as typeof fetch });

    await expect(client.getRuntimeInfo()).resolves.toMatchObject({
      name: "skenion-runtime",
      version: "0.5.0"
    });
    expect(fetchMock).toHaveBeenCalledWith("http://runtime.local/v0/runtime/info", { method: "GET" });
  });

  it("validates runtime session stream events without accepting legacy duplicate fields", () => {
    for (const kind of ["snapshot", "load", "clear", "mutate", "undo", "redo"] satisfies RuntimeSessionEventKind[]) {
      expect(isRuntimeSessionEvent(runtimeSessionEvent({ kind }))).toBe(true);
    }

    expect(isRuntimeSessionEvent(null)).toBe(false);
    expect(isRuntimeSessionEvent({ ...runtimeSessionEvent(), schema: "wrong" })).toBe(false);
    expect(isRuntimeSessionEvent({ ...runtimeSessionEvent(), schemaVersion: 1 })).toBe(false);
    expect(isRuntimeSessionEvent({ ...runtimeSessionEvent(), id: 1 })).toBe(false);
    expect(isRuntimeSessionEvent({ ...runtimeSessionEvent(), sequence: "1" })).toBe(false);
    expect(isRuntimeSessionEvent(runtimeSessionEvent({ kind: "unknown" as RuntimeSessionEventKind }))).toBe(false);
    expect(isRuntimeSessionEvent({ ...runtimeSessionEvent(), session: {} })).toBe(false);
    expect(isRuntimeSessionEvent({ ...runtimeSessionEvent(), graph: {} })).toBe(false);
    expect(isRuntimeSessionEvent({ ...runtimeSessionEvent(), viewState: {} })).toBe(false);
    expect(isRuntimeSessionEvent({ ...runtimeSessionEvent(), graphEvent: {} })).toBe(false);
    expect(isRuntimeSessionEvent({ ...runtimeSessionEvent(), history: null })).toBe(false);
    expect(isRuntimeSessionEvent({ ...runtimeSessionEvent(), mutation: null })).toBe(false);
    expect(isRuntimeSessionEvent({ ...runtimeSessionEvent(), diagnostics: [{ severity: "debug", message: "hidden" }] })).toBe(false);
    expect(isRuntimeSessionEvent({ ...runtimeSessionEvent(), createdAt: 1 })).toBe(false);
    expect(
      isRuntimeSessionEvent(
        runtimeSessionEvent({
          mutation: historyEntry({
            subjectEventId: "session_event_000001",
            clientId: "studio",
            description: "move"
          })
        })
      )
    ).toBe(true);
    expect(
      isRuntimeSessionEvent(
        runtimeSessionEvent({
          snapshot: {
            ...sessionResponse().snapshot,
            project: {
              ...sessionResponse().snapshot.project!,
              patchLibrary: [{ id: 1 }] as unknown as NonNullable<RuntimeSessionResponse["snapshot"]["project"]>["patchLibrary"]
            }
          }
        })
      )
    ).toBe(false);
  });

  it("uses the default runtime URL and global fetch when options are omitted", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ok: true,
        service: "skenion-runtime",
        version: "0.5.0"
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = createRuntimeClient();

    await expect(client.getHealth()).resolves.toMatchObject({
      service: "skenion-runtime"
    });
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3761/health", { method: "GET" });
    vi.unstubAllGlobals();
  });

  it("posts project payloads to validate, plan, and run endpoints", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ok: true,
        diagnostics: [],
        plan: null,
        report: null
      })
    );
    const client = createRuntimeClient({ baseUrl: "http://runtime.local", fetchImpl: fetchMock as typeof fetch });

    await client.validateProject(project);
    await client.buildPlan(project);
    await client.runProject(project, 2);

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(calls[0][0]).toBe("http://runtime.local/v0/validate");
    expect(calls[1][0]).toBe("http://runtime.local/v0/plan");
    expect(JSON.parse(String(calls[2][1].body))).toMatchObject({ frames: 2 });
  });

  it("calls runtime session endpoints", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) =>
      String(_input).endsWith("/v0/sessions/default/history")
        ? jsonResponse(historyResponse())
        : String(_input).endsWith("/v0/sessions/default/mutate") ||
            String(_input).endsWith("/v0/sessions/default/undo") ||
            String(_input).endsWith("/v0/sessions/default/redo")
        ? jsonResponse(patchResponse())
        : jsonResponse(sessionResponse())
    );
    const client = createRuntimeClient({ baseUrl: "http://runtime.local", fetchImpl: fetchMock as typeof fetch });

    await client.getSession();
    await client.loadSession(project);
    await client.validateSession();
    await client.planSession();
    await client.runSession(2);
    await client.mutateSession(mutation);
    await client.mutateSession({
      viewPatch: {
        baseViewRevision: 1,
        ops: [{ op: "setNodeView", nodeId: "value_1", view: viewStateResponse().canvas.nodes.value_1 ?? { x: 0, y: 0 } }]
      }
    });
    await client.getSessionHistory();
    await client.undoSessionPatch();
    await client.redoSessionPatch();
    await client.clearSession();

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(fetchMock).toHaveBeenCalledTimes(11);
    expect(calls[0]).toEqual(["http://runtime.local/v0/sessions/default", { method: "GET" }]);
    expect(calls[1][0]).toBe("http://runtime.local/v0/sessions/default/load");
    expect(JSON.parse(String(calls[1][1].body))).toEqual(project);
    expect(calls[2]).toEqual(["http://runtime.local/v0/sessions/default/validate", { method: "POST" }]);
    expect(calls[3]).toEqual(["http://runtime.local/v0/sessions/default/plan", { method: "POST" }]);
    expect(calls[4][0]).toBe("http://runtime.local/v0/sessions/default/run");
    expect(JSON.parse(String(calls[4][1].body))).toEqual({ frames: 2 });
    expect(calls[5][0]).toBe("http://runtime.local/v0/sessions/default/mutate");
    expect(JSON.parse(String(calls[5][1].body))).toEqual(mutation);
    expect(calls[6][0]).toBe("http://runtime.local/v0/sessions/default/mutate");
    expect(JSON.parse(String(calls[6][1].body))).toMatchObject({ viewPatch: { baseViewRevision: 1 } });
    expect(calls[7]).toEqual(["http://runtime.local/v0/sessions/default/history", { method: "GET" }]);
    expect(calls[8]).toEqual(["http://runtime.local/v0/sessions/default/undo", { method: "POST" }]);
    expect(calls[9]).toEqual(["http://runtime.local/v0/sessions/default/redo", { method: "POST" }]);
    expect(calls[10]).toEqual(["http://runtime.local/v0/sessions/default", { method: "DELETE" }]);
  });

  it("targets explicit runtime session endpoints when a session id is provided", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => {
      const input = String(_input);
      if (input.endsWith("/info")) {
        return jsonResponse(sessionInfoResponse({ sessionId: "alpha" }));
      }
      if (input.endsWith("/history")) {
        return jsonResponse(historyResponse());
      }
      if (input.endsWith("/preview")) {
        return jsonResponse(previewResponse());
      }
      if (input.endsWith("/render/generated-shader")) {
        return jsonResponse(generatedShaderResponse());
      }
      return jsonResponse(sessionResponse());
    });
    const client = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: fetchMock as typeof fetch,
      sessionId: "alpha"
    });

    await client.getSessionInfo();
    await client.getSession();
    await client.loadSession(project);
    await client.getSessionHistory();
    await client.getPreviewStatus();
    await client.getGeneratedShader();
    await client.clearSession();

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(calls.map((call) => call[0])).toEqual([
      "http://runtime.local/v0/sessions/alpha/info",
      "http://runtime.local/v0/sessions/alpha",
      "http://runtime.local/v0/sessions/alpha/load",
      "http://runtime.local/v0/sessions/alpha/history",
      "http://runtime.local/v0/sessions/alpha/preview",
      "http://runtime.local/v0/sessions/alpha/render/generated-shader",
      "http://runtime.local/v0/sessions/alpha"
    ]);
    expect(calls[6]?.[1]).toEqual({ method: "DELETE" });
  });

  it("posts paste operations to the runtime session.operation endpoint", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(pasteOperationResponse()));
    const client = createRuntimeClient({ baseUrl: "http://runtime.local", fetchImpl: fetchMock as typeof fetch });
    const operation = pasteOperation();

    await expect(client.runSessionOperation(operation)).resolves.toMatchObject({
      ok: true,
      applied: true,
      revisionAfter: "2"
    });

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(calls[0][0]).toBe("http://runtime.local/v0/sessions/default/operation");
    expect(JSON.parse(String(calls[0][1].body))).toEqual(operation);
  });

  it("calls runtime control endpoints", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) =>
      String(_input).endsWith("/v0/sessions/default/control/state")
        ? jsonResponse(controlStateResponse())
        : String(_input).endsWith("/v0/sessions/default/control/read")
        ? jsonResponse(controlReadResponse())
        : jsonResponse(controlEventResponse())
    );
    const client = createRuntimeClient({ baseUrl: "http://runtime.local", fetchImpl: fetchMock as typeof fetch });

    await client.sendControlEvent({
      nodeId: "value_1",
      portId: "in",
      message: { selector: "float", atoms: [{ type: "float", representation: "f32", value: 1.25 }] }
    });
    await client.getControlState();
    await client.readControl({ nodeId: "value_1", target: "state", id: "value" });

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(calls[0][0]).toBe("http://runtime.local/v0/sessions/default/control/event");
    expect(JSON.parse(String(calls[0][1].body))).toEqual({
      nodeId: "value_1",
      portId: "in",
      message: { selector: "float", atoms: [{ type: "float", representation: "f32", value: 1.25 }] }
    });
    expect(calls[1]).toEqual(["http://runtime.local/v0/sessions/default/control/state", { method: "GET" }]);
    expect(calls[2][0]).toBe("http://runtime.local/v0/sessions/default/control/read");
    expect(JSON.parse(String(calls[2][1].body))).toEqual({
      nodeId: "value_1",
      target: "state",
      id: "value"
    });
  });

  it("accepts runtime control event and state responses", async () => {
    const client = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async (_input: RequestInfo | URL) =>
        String(_input).endsWith("/v0/sessions/default/control/state")
          ? jsonResponse(
              controlStateResponse({
                values: {
                  value_1: { type: "float", representation: "f32", value: 1.25 },
                  value_2: { type: "int", representation: "i32", value: 32 },
                  value_3: { type: "bool", value: true },
                  color_1: { type: "color", representation: "rgba32f", colorSpace: "linear", value: [0.1, 0.2, 0.3, 1] },
                  string_1: { type: "string", value: "ready" }
                }
              })
            )
          : jsonResponse(controlEventResponse({ emitted: [{ nodeId: "value_1", portId: "value", message: { selector: "bang", atoms: [] } }] }))
      ) as typeof fetch
    });

    await expect(
      client.sendControlEvent({
        nodeId: "value_1",
        portId: "in",
        message: { selector: "bang", atoms: [] }
      })
    ).resolves.toMatchObject({
      emitted: [{ message: { selector: "bang", atoms: [] } }]
    });
    await expect(client.getControlState()).resolves.toMatchObject({
      values: {
        value_2: { type: "int", representation: "i32", value: 32 },
        value_3: { type: "bool", value: true },
        string_1: { type: "string", value: "ready" }
      }
    });

    const nullRevisionClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse(controlEventResponse({ changed: false, controlRevision: null, emitted: [] }))
      ) as typeof fetch
    });

    await expect(
      nullRevisionClient.sendControlEvent({
        nodeId: "value_1",
        portId: "in",
        message: { selector: "float", atoms: [{ type: "float", representation: "f32", value: 1.25 }] }
      })
    ).resolves.toMatchObject({
      changed: false,
      controlRevision: null,
      emitted: []
    });
  });

  it("accepts runtime control read responses", async () => {
    const client = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () => jsonResponse(controlReadResponse())) as typeof fetch
    });

    await expect(client.readControl({ nodeId: "value_1", target: "state", id: "value" })).resolves.toMatchObject({
      value: { type: "float", representation: "f32", value: 1.25 }
    });

    const jsonClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          controlReadResponse({
            value: { type: "json", value: { id: "value", direction: "output" } }
          })
        )
      ) as typeof fetch
    });

    await expect(jsonClient.readControl({ nodeId: "value_1", target: "port", id: "value" })).resolves.toMatchObject({
      value: { type: "json", value: { id: "value", direction: "output" } }
    });
  });

  it("calls runtime preview endpoints", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(previewResponse()));
    const client = createRuntimeClient({ baseUrl: "http://runtime.local", fetchImpl: fetchMock as typeof fetch });

    await client.getPreviewStatus();
    await client.startPreview();
    await client.startPreview({ restart: true });
    await client.stopPreview();
    await client.restartPreview();

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(calls[0]).toEqual(["http://runtime.local/v0/sessions/default/preview", { method: "GET" }]);
    expect(calls[1][0]).toBe("http://runtime.local/v0/sessions/default/preview/start");
    expect(JSON.parse(String(calls[1][1].body))).toEqual({ restart: false });
    expect(calls[2][0]).toBe("http://runtime.local/v0/sessions/default/preview/start");
    expect(JSON.parse(String(calls[2][1].body))).toEqual({ restart: true });
    expect(calls[3]).toEqual(["http://runtime.local/v0/sessions/default/preview/stop", { method: "POST" }]);
    expect(calls[4]).toEqual(["http://runtime.local/v0/sessions/default/preview/restart", { method: "POST" }]);
  });

  it("calls runtime asset endpoints", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) =>
      String(_input).endsWith("/v0/assets/import")
        ? jsonResponse(assetImportResponse())
        : String(_input).endsWith("/v0/assets")
        ? jsonResponse(assetListResponse())
        : jsonResponse(assetGetResponse({ asset: null }))
    );
    const client = createRuntimeClient({ baseUrl: "http://runtime.local", fetchImpl: fetchMock as typeof fetch });
    const file = new File(["movie"], "clip.mp4", { type: "video/mp4" });

    await expect(client.importAsset(file, "video")).resolves.toMatchObject({
      asset: {
        runtimeUri: "skenion-runtime://assets/asset_1"
      }
    });
    await expect(client.importAsset(file)).resolves.toMatchObject({
      ok: true
    });
    await expect(client.listAssets()).resolves.toMatchObject({
      assets: [{ id: "asset_1" }]
    });
    await expect(client.getAsset("asset/with space")).resolves.toMatchObject({
      asset: null
    });

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(calls[0][0]).toBe("http://runtime.local/v0/assets/import");
    expect((calls[0][1].body as FormData).get("file")).toBe(file);
    expect((calls[0][1].body as FormData).get("kind")).toBeNull();
    expect((calls[1][1].body as FormData).get("kind")).toBeNull();
    expect(calls[2]).toEqual(["http://runtime.local/v0/assets", { method: "GET" }]);
    expect(calls[3]).toEqual(["http://runtime.local/v0/assets/asset%2Fwith%20space", { method: "GET" }]);
  });

  it("calls runtime telemetry endpoint", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(telemetryResponse()));
    const client = createRuntimeClient({ baseUrl: "http://runtime.local", fetchImpl: fetchMock as typeof fetch });

    await client.getTelemetry();

    expect(fetchMock).toHaveBeenCalledWith("http://runtime.local/v0/sessions/default/telemetry", { method: "GET" });
  });

  it("calls runtime log snapshot endpoint and builds stream URLs", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(runtimeLogSnapshotResponse()));
    const client = createRuntimeClient({ baseUrl: "http://runtime.local/", fetchImpl: fetchMock as typeof fetch });

    await expect(client.getRuntimeLogs()).resolves.toMatchObject({
      events: [
        {
          code: "io-device-enumeration-failed",
          level: "error",
          source: "runtime"
        }
      ],
      schema: "skenion.runtime.logs"
    });

    expect(fetchMock).toHaveBeenCalledWith("http://runtime.local/v0/runtime/logs", { method: "GET" });
    expect(runtimeLogStreamUrl("http://runtime.local/")).toBe("http://runtime.local/v0/runtime/logs/stream");
  });

  it("calls runtime IO discovery endpoint", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(runtimeIoDeviceListResponse()));
    const client = createRuntimeClient({ baseUrl: "http://runtime.local", fetchImpl: fetchMock as typeof fetch });

    await client.listIoDevices();

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(calls[0]).toEqual(["http://runtime.local/v0/io/devices", { method: "GET" }]);
  });

  it("calls runtime extension package endpoint", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(runtimeExtensionListResponse()));
    const client = createRuntimeClient({ baseUrl: "http://runtime.local", fetchImpl: fetchMock as typeof fetch });

    await expect(client.listExtensions()).resolves.toMatchObject({
      ok: true,
      extensions: [{ id: "skenion/core", status: "loaded", providedHelp: ["core.value"] }]
    });

    expect(fetchMock).toHaveBeenCalledWith("http://runtime.local/v0/extensions", { method: "GET" });
  });

  it("accepts runtime IO device responses", async () => {
    const client = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          runtimeIoDeviceListResponse({
            devices: [
              {
                backend: "webhid",
                directions: ["input", "output"],
                id: "hid:device:1",
                name: "HID Controller",
                stable: true,
                transportKind: "hid"
              },
              {
                backend: "webserial",
                directions: ["input"],
                id: "serial:/dev/tty.usbmodem101",
                name: "Arduino",
                stable: false,
                transportKind: "serial"
              },
              {
                backend: "fixture",
                directions: ["output"],
                id: "inline:fixture",
                name: "Inline Fixture",
                stable: true,
                transportKind: "inline"
              }
            ],
            diagnostics: [{ severity: "warning", code: "io-device-name-unavailable", message: "name unavailable" }]
          })
        )
      ) as typeof fetch
    });

    await expect(client.listIoDevices()).resolves.toMatchObject({
      ok: true,
      devices: [{ transportKind: "hid" }, { transportKind: "serial" }, { transportKind: "inline" }],
      diagnostics: [{ severity: "warning" }]
    });
  });

  it("accepts runtime preview status responses", async () => {
    const client = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () => jsonResponse(previewResponse({ stale: true }))) as typeof fetch
    });

    await expect(client.getPreviewStatus()).resolves.toMatchObject({
      ok: true,
      state: "running",
      graphRevision: "1",
      stale: true
    });
  });

  it("accepts stopped runtime preview status responses with null metadata", async () => {
    const client = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          previewResponse({
            state: "stopped",
            pid: null,
            graphId: null,
            graphRevision: null,
            sessionRevision: null,
            previewSessionRevision: null,
            controlRevision: null,
            previewControlRevision: null,
            controlLive: false,
            lastControlUpdateAt: null,
            stale: false,
            startedAt: null,
            exitedAt: null,
            exitCode: null,
            message: null
          })
        )
      ) as typeof fetch
    });

    await expect(client.getPreviewStatus()).resolves.toMatchObject({
      state: "stopped",
      graphRevision: null,
      sessionRevision: null
    });
  });

  it("accepts runtime telemetry snapshots", async () => {
    const client = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () => jsonResponse(telemetryResponse())) as typeof fetch
    });

    await expect(client.getTelemetry()).resolves.toMatchObject({
      schema: "skenion.runtime.telemetry",
      preview: {
        state: "running",
        stale: false
      },
      render: {
        active: true,
        backend: "wgpu"
      }
    });
  });

  it("accepts runtime telemetry snapshots with null optional metadata", async () => {
    const client = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          telemetryResponse({
            session: {
              loaded: false,
              graphId: null,
              graphRevision: null,
              sessionRevision: 0,
              controlRevision: 0
            },
            preview: {
              state: "stopped",
              pid: null,
              stale: false,
              graphId: null,
              graphRevision: null,
              sessionRevision: null,
              previewSessionRevision: null,
              controlRevision: null,
              previewControlRevision: null,
              controlLive: false,
              lastControlUpdateAt: null
            },
            render: {
              active: false,
              backend: null,
              renderer: null,
              framesRendered: 0,
              approxFps: null,
              lastFrameMs: null,
              lastError: null,
              sourceNodeId: null,
              diagnostics: [],
              generatedSourceAvailable: false,
              controlRevision: null,
              previewControlRevision: null,
              controlLive: false,
              lastControlUpdateAt: null
            }
          })
        )
      ) as typeof fetch
    });

    await expect(client.getTelemetry()).resolves.toMatchObject({
      session: {
        loaded: false,
        graphId: null
      },
      preview: {
        state: "stopped",
        pid: null
      },
      render: {
        active: false,
        backend: null
      }
    });
  });

  it("fetches generated shader source responses", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(generatedShaderResponse()));
    const client = createRuntimeClient({ baseUrl: "http://runtime.local", fetchImpl: fetchMock as typeof fetch });

    await expect(client.getGeneratedShader()).resolves.toMatchObject({
      ok: true,
      nodeId: "shader_1",
      sourceMap: {
        userSourceStartLine: 32
      }
    });
    expect(fetchMock).toHaveBeenCalledWith("http://runtime.local/v0/sessions/default/render/generated-shader", { method: "GET" });

    const diagnosticsClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse(generatedShaderResponse({
          ok: false,
          source: null,
          sourceMap: null,
          diagnostics: [
            {
              severity: "error",
              phase: "interface-analysis",
              code: "unsupported-uniform-type",
              message: "unsupported uniform type: vec3",
              source: "user"
            },
            {
              severity: "warning",
              phase: "wgsl-compile",
              code: "wgsl-validation",
              message: "generated line maps to user source",
              line: 12,
              column: 4,
              endLine: 12,
              endColumn: 18,
              uniformId: "speed",
              source: "generated"
            }
          ]
        }))
      ) as typeof fetch
    });
    await expect(diagnosticsClient.getGeneratedShader()).resolves.toMatchObject({
      ok: false,
      diagnostics: [
        { code: "unsupported-uniform-type" },
        { line: 12, uniformId: "speed" }
      ]
    });

    const emptyClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          generatedShaderResponse({
            ok: false,
            nodeId: null,
            language: null,
            source: null,
            sourceMap: null
          })
        )
      ) as typeof fetch
    });
    await expect(emptyClient.getGeneratedShader()).resolves.toMatchObject({
      ok: false,
      nodeId: null,
      language: null,
      source: null,
      sourceMap: null
    });
  });

  it("accepts runtime patch responses", async () => {
    const client = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () => jsonResponse(patchResponse())) as typeof fetch
    });

    await expect(client.mutateSession(mutation)).resolves.toMatchObject({
      ok: true,
      applied: true,
      conflict: false,
      snapshot: {
        project: {
          graph: {
            revision: "2"
          }
        },
        sessionRevision: 2
      },
      history: {
        undoDepth: 1
      }
    });
  });

  it("accepts empty patch events and runtime history responses", async () => {
    const client = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async (_input: RequestInfo | URL) =>
        String(_input).endsWith("/v0/sessions/default/history")
          ? jsonResponse(historyResponse({ canUndo: false, undoDepth: 0, entries: [] }))
          : jsonResponse(patchResponse())
      ) as typeof fetch
    });

    await expect(client.mutateSession(mutation)).resolves.toMatchObject({ applied: true });
    await expect(client.getSessionHistory()).resolves.toMatchObject({
      canUndo: false,
      undoDepth: 0,
      entries: []
    });
  });

  it("accepts move node view runtime mutations in history responses", async () => {
    const moveMutation: RuntimeMutationRequest = {
      viewPatch: {
        baseViewRevision: 1,
        ops: [
          {
            op: "moveNodeView",
            nodeId: "value_1",
            from: { x: 0, y: 0 },
            to: { x: 10, y: 20, width: 120, height: 72, collapsed: false }
          }
        ]
      },
      clientId: "studio",
      description: "move value_1"
    };
    const inverseMoveMutation: RuntimeMutationRequest = {
      viewPatch: {
        baseViewRevision: 2,
        ops: [
          {
            op: "moveNodeView",
            nodeId: "value_1",
            from: { x: 10, y: 20, width: 120, height: 72, collapsed: false },
            to: { x: 0, y: 0 }
          }
        ]
      },
      clientId: "studio",
      description: "Inverse of move value_1"
    };
    const fetchMock = vi.fn(async () =>
      jsonResponse(
        patchResponse({
          history: historyResponse({
            entries: [
              historyEntry({
                mutation: moveMutation,
                inverseMutation: inverseMoveMutation
              })
            ]
          })
        })
      )
    );
    const client = createRuntimeClient({ baseUrl: "http://runtime.local", fetchImpl: fetchMock as typeof fetch });

    await expect(client.mutateSession(moveMutation)).resolves.toMatchObject({
      history: {
        entries: [{ mutation: moveMutation }]
      }
    });

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(JSON.parse(String(calls[0][1].body))).toEqual(moveMutation);
  });

  it("accepts set node view runtime mutations in history responses", async () => {
    const setViewMutation: RuntimeMutationRequest = {
      viewPatch: {
        baseViewRevision: 1,
        ops: [
          {
            op: "setNodeView",
            nodeId: "value_1",
            view: { x: 10, y: 20, width: 120, height: 72, collapsed: false }
          }
        ]
      }
    };
    const client = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          patchResponse({
            history: historyResponse({
              entries: [
                historyEntry({
                  mutation: setViewMutation,
                  inverseMutation: setViewMutation
                })
              ]
            })
          })
        )
      ) as typeof fetch
    });

    await expect(client.mutateSession(setViewMutation)).resolves.toMatchObject({
      history: { entries: [{ mutation: setViewMutation }] }
    });
  });

  it("accepts empty runtime session responses", async () => {
    const client = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          sessionResponse({
            snapshot: {
              sessionRevision: 0,
              viewRevision: 0,
              controlRevision: 0,
              project: null,
              diagnostics: [],
              plan: null
            }
          })
        )
      ) as typeof fetch
    });

    await expect(client.getSession()).resolves.toMatchObject({
      snapshot: {
        project: null,
        sessionRevision: 0
      }
    });
  });

  it("accepts runtime session responses with plan and report objects", async () => {
    const client = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          sessionResponse({
            snapshot: {
              ...sessionResponse().snapshot,
              plan: { graphId: "test", graphRevision: "1", nodes: [], edges: [], groups: [] }
            },
            report: { graphId: "test", graphRevision: "1", frameCount: 2, frames: [] }
          })
        )
      ) as typeof fetch
    });

    await expect(client.runSession(2)).resolves.toMatchObject({
      snapshot: { plan: { graphId: "test" } },
      report: { frameCount: 2 }
    });
  });

  it("accepts runtime responses with plan and report objects", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        ok: true,
        diagnostics: [],
        plan: { graphId: "test" },
        report: { graphId: "test", frameCount: 1 }
      })
    );
    const client = createRuntimeClient({ baseUrl: "http://runtime.local", fetchImpl: fetchMock as typeof fetch });

    await expect(client.runProject(project, 1)).resolves.toMatchObject({
      plan: { graphId: "test" },
      report: { frameCount: 1 }
    });
  });

  it("converts connection failures into runtime client errors", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("connection refused");
    });
    const client = createRuntimeClient({ baseUrl: "http://runtime.local", fetchImpl: fetchMock as typeof fetch });

    await expect(client.getHealth()).rejects.toThrow("connection refused");
  });

  it("converts non-error connection failures into runtime client errors", async () => {
    const fetchMock = vi.fn(async () => {
      throw "offline";
    });
    const client = createRuntimeClient({ baseUrl: "http://runtime.local", fetchImpl: fetchMock as typeof fetch });

    await expect(client.getHealth()).rejects.toThrow("Runtime request failed.");
  });

  it("rejects non-JSON and non-ok runtime responses", async () => {
    const nonJsonClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () => new Response("not json")) as typeof fetch
    });
    await expect(nonJsonClient.getHealth()).rejects.toThrow("non-JSON");

    const httpErrorClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          {
            ok: false,
            diagnostics: [],
            plan: null,
            report: null
          },
          500
        )
      ) as typeof fetch
    });
    await expect(httpErrorClient.validateProject(project)).rejects.toThrow("Runtime HTTP 500.");
  });

  it("rejects unsupported runtime response shapes", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    const client = createRuntimeClient({ baseUrl: "http://runtime.local", fetchImpl: fetchMock as typeof fetch });

    await expect(client.validateProject(project)).rejects.toThrow("unsupported response shape");
  });

  it("rejects unsupported health and diagnostic response shapes", async () => {
    const invalidHealthClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse({
          ok: true,
          service: "skenion-runtime"
        })
      ) as typeof fetch
    });
    await expect(invalidHealthClient.getHealth()).rejects.toThrow("unsupported response shape");

    const invalidDiagnosticClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse({
          ok: false,
          diagnostics: [{ severity: "debug", message: "hidden" }],
          plan: null,
          report: null
        })
      ) as typeof fetch
    });
    await expect(invalidDiagnosticClient.validateProject(project)).rejects.toThrow("unsupported response shape");
  });

  it("rejects unsupported runtime session response shapes", async () => {
    const client = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse({
          ok: true,
          diagnostics: [],
          plan: null,
          report: null
        })
      ) as typeof fetch
    });

    await expect(client.getSession()).rejects.toThrow("unsupported response shape");
  });

  it("rejects legacy runtime session response duplicate shapes", async () => {
    const legacySessionClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          {
            ...sessionResponse(),
            graphId: "test"
          }
        )
      ) as typeof fetch
    });

    await expect(legacySessionClient.getSession()).rejects.toThrow("unsupported response shape");
  });

  it("rejects unsupported runtime patch response shapes", async () => {
    const invalidGraphClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          patchResponse({
            snapshot: {
              ...patchResponse().snapshot,
              project: {
                ...patchResponse().snapshot.project!,
                graph: {
                  schema: "skenion.graph",
                  schemaVersion: "0.1.0",
                  id: "test",
                  revision: "2",
                  nodes: []
                } as unknown as NonNullable<RuntimePatchResponse["snapshot"]["project"]>["graph"]
              }
            }
          })
        )
      ) as typeof fetch
    });

    await expect(invalidGraphClient.mutateSession(mutation)).rejects.toThrow("unsupported response shape");

    const invalidHistoryClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          patchResponse({
            history: {
              ...historyResponse(),
              undoDepth: "1"
            } as unknown as RuntimePatchResponse["history"]
          })
        )
      ) as typeof fetch
    });
    await expect(invalidHistoryClient.mutateSession(mutation)).rejects.toThrow("unsupported response shape");
  });

  it("rejects unsupported runtime control response shapes", async () => {
    const invalidEventNullClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () => jsonResponse(null)) as typeof fetch
    });
    await expect(
      invalidEventNullClient.sendControlEvent({
        nodeId: "value_1",
        portId: "in",
        message: { selector: "float", atoms: [{ type: "float", representation: "f32", value: 1 }] }
      })
    ).rejects.toThrow("unsupported response shape");

    const invalidEventClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          controlEventResponse({
            emitted: [{ nodeId: "value_1", portId: "other", message: { selector: "float", atoms: [{ type: "float", representation: "f32", value: 1 }] } }]
          } as unknown as Partial<RuntimeControlEventResponse>)
        )
      ) as typeof fetch
    });
    await expect(
      invalidEventClient.sendControlEvent({
        nodeId: "value_1",
        portId: "in",
        message: { selector: "float", atoms: [{ type: "float", representation: "f32", value: 1 }] }
      })
    ).rejects.toThrow("unsupported response shape");

    const invalidStateClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          controlStateResponse({
            values: {
              value_1: { type: "int", representation: "i32", value: 1.2 }
            }
          } as unknown as Partial<RuntimeControlStateResponse>)
        )
      ) as typeof fetch
    });
    await expect(invalidStateClient.getControlState()).rejects.toThrow("unsupported response shape");

    const invalidBangClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          controlStateResponse({
            values: {
              value_1: { type: "bang", value: true }
            }
          } as unknown as Partial<RuntimeControlStateResponse>)
        )
      ) as typeof fetch
    });
    await expect(invalidBangClient.getControlState()).rejects.toThrow("unsupported response shape");

    const invalidNullClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          controlStateResponse({
            values: {
              value_1: null
            }
          } as unknown as Partial<RuntimeControlStateResponse>)
        )
      ) as typeof fetch
    });
    await expect(invalidNullClient.getControlState()).rejects.toThrow("unsupported response shape");

    const invalidStringClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          controlStateResponse({
            values: {
              value_1: { type: "string", value: 42 }
            }
          } as unknown as Partial<RuntimeControlStateResponse>)
        )
      ) as typeof fetch
    });
    await expect(invalidStringClient.getControlState()).rejects.toThrow("unsupported response shape");

    const invalidReadClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          controlReadResponse({
            address: { nodeId: "value_1", target: "unknown", id: "value" },
            value: { type: "float", representation: "f32", value: 1.25 }
          } as unknown as Partial<RuntimeControlReadResponse>)
        )
      ) as typeof fetch
    });
    await expect(
      invalidReadClient.readControl({ nodeId: "value_1", target: "state", id: "value" })
    ).rejects.toThrow("unsupported response shape");

    const invalidReadValueClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          controlReadResponse({
            value: { type: "unknown", value: true }
          } as unknown as Partial<RuntimeControlReadResponse>)
        )
      ) as typeof fetch
    });
    await expect(
      invalidReadValueClient.readControl({ nodeId: "value_1", target: "state", id: "value" })
    ).rejects.toThrow("unsupported response shape");
  });

  it("rejects unsupported runtime history response shapes", async () => {
    const client = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse({
          schema: "skenion.graph.patch.history",
          schemaVersion: "0.1.0",
          events: [],
          canUndo: "no",
          canRedo: false,
          undoDepth: 0,
          redoDepth: 0
        })
      ) as typeof fetch
    });

    await expect(client.getSessionHistory()).rejects.toThrow("unsupported response shape");
  });

  it("rejects unsupported runtime preview status shapes", async () => {
    const nonObjectClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () => jsonResponse(null)) as typeof fetch
    });
    await expect(nonObjectClient.getPreviewStatus()).rejects.toThrow("unsupported response shape");

    const invalidStateClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse({
          ...previewResponse(),
          state: "paused"
        })
      ) as typeof fetch
    });
    await expect(invalidStateClient.getPreviewStatus()).rejects.toThrow("unsupported response shape");

    const invalidDiagnosticClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse({
          ...previewResponse(),
          diagnostics: [{ severity: "trace", message: "hidden" }]
        })
      ) as typeof fetch
    });
    await expect(invalidDiagnosticClient.getPreviewStatus()).rejects.toThrow("unsupported response shape");
  });

  it("rejects unsupported runtime asset response shapes", async () => {
    const file = new File(["movie"], "clip.mp4", { type: "video/mp4" });
    const invalidAssetShapes: unknown[] = [
      null,
      { ...runtimeAsset(), id: 1 },
      { ...runtimeAsset(), name: 1 },
      { ...runtimeAsset(), mimeType: 1 },
      { ...runtimeAsset(), kind: 1 },
      { ...runtimeAsset(), sizeBytes: "10" },
      { ...runtimeAsset(), runtimeUri: 1 }
    ];

    for (const asset of invalidAssetShapes) {
      const client = createRuntimeClient({
        baseUrl: "http://runtime.local",
        fetchImpl: vi.fn(async () => jsonResponse(assetListResponse({ assets: [asset as RuntimeAsset] }))) as typeof fetch
      });
      await expect(client.listAssets()).rejects.toThrow("unsupported response shape");
    }

    const nonFiniteSizeClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        rawJsonResponse(
          '{"ok":true,"assets":[{"id":"asset_1","name":"clip.mp4","mimeType":"video/mp4","kind":"video","sizeBytes":1e999,"runtimeUri":"skenion-runtime://assets/asset_1"}],"diagnostics":[]}'
        )
      ) as typeof fetch
    });
    await expect(nonFiniteSizeClient.listAssets()).rejects.toThrow("unsupported response shape");

    const invalidImportClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse(assetImportResponse({ asset: { ...runtimeAsset(), runtimeUri: 1 } as unknown as RuntimeAsset }))
      ) as typeof fetch
    });
    await expect(invalidImportClient.importAsset(file)).rejects.toThrow("unsupported response shape");

    const invalidGetClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          assetGetResponse({
            diagnostics: [{ severity: "debug", message: "hidden" }] as unknown as RuntimeAssetGetResponse["diagnostics"]
          })
        )
      ) as typeof fetch
    });
    await expect(invalidGetClient.getAsset("asset_1")).rejects.toThrow("unsupported response shape");
  });

  it("rejects unsupported runtime IO device response shapes", async () => {
    const invalidIoDeviceClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          runtimeIoDeviceListResponse({
            devices: [
              {
                backend: "midir",
                directions: ["sideways"],
                id: "device-1",
                name: "USB MIDI",
                stable: true,
                transportKind: "midi"
              }
            ] as unknown as RuntimeIoDeviceListResponse["devices"]
          })
        )
      ) as typeof fetch
    });
    await expect(invalidIoDeviceClient.listIoDevices()).rejects.toThrow("unsupported response shape");

    const invalidIoDiagnosticClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          runtimeIoDeviceListResponse({
            diagnostics: [{ severity: "debug", code: "io", message: "hidden" }] as unknown as RuntimeIoDeviceListResponse["diagnostics"]
          })
        )
      ) as typeof fetch
    });
    await expect(invalidIoDiagnosticClient.listIoDevices()).rejects.toThrow("unsupported response shape");

    const invalidIoDeviceObjectClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          runtimeIoDeviceListResponse({
            devices: [null] as unknown as RuntimeIoDeviceListResponse["devices"]
          })
        )
      ) as typeof fetch
    });
    await expect(invalidIoDeviceObjectClient.listIoDevices()).rejects.toThrow("unsupported response shape");
  });

  it("rejects unsupported runtime history mutation view patch shapes", async () => {
    const invalidMutations: RuntimeMutationRequest[] = [
      {
        viewPatch: {
          baseViewRevision: 1,
          ops: [{ op: "moveNodeView", nodeId: 1, to: { x: 0, y: 0 } } as unknown as RuntimeViewPatchOperation]
        }
      },
      {
        viewPatch: {
          baseViewRevision: 1,
          ops: [{ op: "setNodeView", nodeId: "value_1", view: { x: Number.NaN, y: 0 } }]
        }
      },
      {
        viewPatch: {
          baseViewRevision: 1,
          ops: [{ op: "unknown", nodeId: "value_1", view: { x: 0, y: 0 } } as unknown as RuntimeViewPatchOperation]
        }
      }
    ];

    for (const mutation of invalidMutations) {
      const client = createRuntimeClient({
        baseUrl: "http://runtime.local",
        fetchImpl: vi.fn(async () =>
          jsonResponse(
            patchResponse({
              history: historyResponse({
                entries: [
                  historyEntry({
                    mutation,
                    inverseMutation: mutation
                  })
                ]
              })
            })
          )
        ) as typeof fetch
      });

      await expect(client.mutateSession(mutation)).rejects.toThrow("unsupported response shape");
    }
  });

  it("rejects unsupported runtime history entry and mutation shapes", async () => {
    const invalidEntries: unknown[] = [
      null,
      { ...historyEntry(), id: 1 },
      { ...historyEntry(), sequence: "1" },
      { ...historyEntry(), kind: "branch" },
      { ...historyEntry(), mutation: null },
      { ...historyEntry(), inverseMutation: null },
      { ...historyEntry(), subjectEventId: 1 },
      { ...historyEntry(), clientId: 1 },
      { ...historyEntry(), description: 1 },
      { ...historyEntry(), mutation: { graphPatch: { schema: "wrong" } } },
      { ...historyEntry(), mutation: { clientId: 1 } },
      { ...historyEntry(), mutation: { description: 1 } }
    ];

    for (const entry of invalidEntries) {
      const client = createRuntimeClient({
        baseUrl: "http://runtime.local",
        fetchImpl: vi.fn(async () =>
          jsonResponse(
            patchResponse({
              history: historyResponse({
                entries: [entry as RuntimeHistoryEntry]
              })
            })
          )
        ) as typeof fetch
      });

      await expect(client.mutateSession(mutation)).rejects.toThrow("unsupported response shape");
    }
  });

  it("rejects unsupported runtime telemetry shapes", async () => {
    const invalidSchemaClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () => jsonResponse({ ...telemetryResponse(), schema: "wrong" })) as typeof fetch
    });
    await expect(invalidSchemaClient.getTelemetry()).rejects.toThrow("unsupported response shape");

    const invalidSessionClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse({
          ...telemetryResponse(),
          session: { loaded: true }
        })
      ) as typeof fetch
    });
    await expect(invalidSessionClient.getTelemetry()).rejects.toThrow("unsupported response shape");

    const invalidPreviewClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse({
          ...telemetryResponse(),
          preview: { state: "unknown" }
        })
      ) as typeof fetch
    });
    await expect(invalidPreviewClient.getTelemetry()).rejects.toThrow("unsupported response shape");

    const invalidRenderClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse({
          ...telemetryResponse(),
          render: { active: true }
        })
      ) as typeof fetch
    });
    await expect(invalidRenderClient.getTelemetry()).rejects.toThrow("unsupported response shape");

    const invalidProcessClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse({
          ...telemetryResponse(),
          process: { runtimeVersion: "0.11.0" }
        })
      ) as typeof fetch
    });
    await expect(invalidProcessClient.getTelemetry()).rejects.toThrow("unsupported response shape");

    const invalidDiagnosticsClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse({
          ...telemetryResponse(),
          diagnostics: [{ severity: "debug", message: "hidden" }]
        })
      ) as typeof fetch
    });
    await expect(invalidDiagnosticsClient.getTelemetry()).rejects.toThrow("unsupported response shape");
  });

  it("rejects unsupported generated shader response shapes", async () => {
    const nonObjectClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () => jsonResponse(null)) as typeof fetch
    });
    await expect(nonObjectClient.getGeneratedShader()).rejects.toThrow("unsupported response shape");

    const invalidFieldsClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse({
          ...generatedShaderResponse(),
          ok: "yes",
          nodeId: 1,
          language: "glsl",
          source: 1,
          diagnostics: "none"
        })
      ) as typeof fetch
    });
    await expect(invalidFieldsClient.getGeneratedShader()).rejects.toThrow("unsupported response shape");

    const invalidDiagnosticClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse({
          ...generatedShaderResponse(),
          diagnostics: [{ severity: "error", phase: "unknown", code: "x", message: "bad", source: "generated" }]
        })
      ) as typeof fetch
    });
    await expect(invalidDiagnosticClient.getGeneratedShader()).rejects.toThrow("unsupported response shape");

    const invalidSourceMapClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse({
          ...generatedShaderResponse(),
          sourceMap: { userSourceStartLine: 0, generatedLineOffset: 31 }
        })
      ) as typeof fetch
    });
    await expect(invalidSourceMapClient.getGeneratedShader()).rejects.toThrow("unsupported response shape");

    const invalidLocationClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse({
          ...generatedShaderResponse(),
          diagnostics: [
            {
              severity: "error",
              phase: "wgsl-compile",
              code: "wgsl-validation",
              message: "bad location",
              line: 0,
              source: "generated"
            }
          ]
        })
      ) as typeof fetch
    });
    await expect(invalidLocationClient.getGeneratedShader()).rejects.toThrow("unsupported response shape");
  });

  it("rejects non-object runtime session responses", async () => {
    const client = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () => jsonResponse(null)) as typeof fetch
    });

    await expect(client.getSession()).rejects.toThrow("unsupported response shape");
  });
});

function sessionInfoResponse(overrides: Partial<RuntimeSessionInfoResponse> = {}): RuntimeSessionInfoResponse {
  return {
    schema: "skenion.runtime.session.info",
    schemaVersion: "0.1.0",
    ok: true,
    sessionId: "default",
    lifecycle: "ready",
    snapshot: sessionResponse().snapshot,
    profile: {
      displayName: "skenion runtime local-managed sidecar",
      endpoint: {
        canonicalUrl: "http://127.0.0.1:49152",
        host: "127.0.0.1",
        port: 49152,
        protocol: "http",
        tls: false,
        url: "http://127.0.0.1:49152"
      },
      mode: "local-managed",
      ownership: "owned-child",
      process: null
    },
    capabilities: {
      sessionAddressing: true,
      eventReplay: true,
      multiWindow: true,
      profiles: ["local-managed", "local-shared", "remote"],
      authPolicy: "deferred"
    },
    eventReplay: {
      cursorKind: "sequence",
      currentCursor: "1",
      earliestSequence: 1,
      latestSequence: 1,
      replayLimit: 256,
      overflow: false
    },
    diagnostics: [],
    ...overrides
  };
}

function sessionResponse(overrides: Partial<RuntimeSessionResponse> = {}): RuntimeSessionResponse {
  return {
    ok: true,
    snapshot: {
      sessionRevision: 1,
      viewRevision: 1,
      controlRevision: 0,
      project: {
        schema: "skenion.project",
        schemaVersion: "0.1.0",
        id: "test",
        revision: "1",
        graph: {
          schema: "skenion.graph",
          schemaVersion: "0.1.0",
          id: "test",
          revision: "1",
          nodes: [
            {
              id: "value_1",
              kind: "core.float",
              kindVersion: "0.1.0",
              params: { label: "Float" },
              ports: [
                {
                  id: "value",
                  direction: "output",
                  type: "number.float",
                  rate: "control"
                }
              ]
            }
          ],
          edges: []
        },
        viewState: viewStateResponse(),
        patchLibrary: []
      },
      diagnostics: [],
      plan: null
    },
    diagnostics: [],
    report: null,
    ...overrides
  };
}

function runtimeSessionEvent(overrides: Partial<RuntimeSessionEvent> = {}): RuntimeSessionEvent {
  return {
    schema: "skenion.runtime.session.event",
    schemaVersion: "0.1.0",
    id: "session_event_000001",
    sessionId: "session_1",
    sequence: 1,
    sessionRevision: 1,
    kind: "snapshot",
    snapshot: sessionResponse().snapshot,
    history: historyResponse(),
    replay: {
      cursor: "1",
      previousCursor: null,
      replayed: false,
      gap: null,
      overflow: false
    },
    diagnostics: [],
    createdAt: "unix-ms:0",
    ...overrides
  };
}

function patchResponse(overrides: Partial<RuntimePatchResponse> = {}): RuntimePatchResponse {
  return {
    ok: true,
    applied: true,
    conflict: false,
    snapshot: {
      ...sessionResponse().snapshot,
      sessionRevision: 2,
      project: {
        ...sessionResponse().snapshot.project!,
        revision: "2",
        graph: {
          ...sessionResponse().snapshot.project!.graph,
          revision: "2"
        }
      }
    },
    history: historyResponse(),
    diagnostics: [],
    ...overrides
  };
}

function pasteOperation(): RuntimeOperationEnvelope {
  return {
    schema: "skenion.runtime.operation",
    schemaVersion: "0.1.0",
    id: "operation_1",
    kind: "pasteGraphFragment",
    request: {
      target: {
        path: { kind: "root" },
        baseRevision: "1"
      },
      fragment: {
        schema: "skenion.graph.fragment",
        schemaVersion: "0.1.0",
        nodes: [
          {
            id: "value_1",
            kind: "core.float",
            kindVersion: "0.1.0",
            params: { label: "Float" },
            ports: [
              {
                id: "out",
                direction: "output",
                type: "number.float",
                rate: "control"
              }
            ]
          }
        ],
        edges: []
      },
      options: {
        idConflictPolicy: "remap",
        outsideEndpointPolicy: "omit",
        preserveRelativePositions: true
      }
    }
  };
}

function pasteOperationResponse() {
  return {
    schema: "skenion.runtime.paste-graph-fragment.response",
    schemaVersion: "0.1.0",
    ok: true,
    applied: true,
    conflict: false,
    target: {
      path: { kind: "root" },
      baseRevision: "1"
    },
    revisionBefore: "1",
    revisionAfter: "2",
    historyEntryId: "history_1",
    idRemap: {
      nodeIdMap: { value_1: "value_2" },
      edgeIdMap: {},
      omittedEdgeIds: []
    },
    diagnostics: []
  };
}

function viewStateResponse() {
  return {
    schema: "skenion.view-state",
    schemaVersion: "0.1.0",
    canvas: {
      nodes: {
        value_1: { x: 0, y: 0 }
      },
      viewport: {
        x: 0,
        y: 0,
        zoom: 1
      }
    }
  } as const;
}

function historyResponse(overrides: Partial<RuntimeHistory> = {}): RuntimeHistory {
  return {
    schema: "skenion.runtime.history",
    schemaVersion: "0.1.0",
    entries: [historyEntry()],
    canUndo: true,
    canRedo: false,
    undoDepth: 1,
    redoDepth: 0,
    ...overrides
  };
}

function controlEventResponse(overrides: Partial<RuntimeControlEventResponse> = {}): RuntimeControlEventResponse {
  return {
    ok: true,
    changed: true,
    controlRevision: 1,
    emitted: [{ nodeId: "value_1", portId: "value", message: { selector: "float", atoms: [{ type: "float", representation: "f32", value: 1.25 }] } }],
    diagnostics: [],
    ...overrides
  };
}

function controlStateResponse(overrides: Partial<RuntimeControlStateResponse> = {}): RuntimeControlStateResponse {
  return {
    ok: true,
    controlRevision: 1,
    values: {
      value_1: { type: "float", representation: "f32", value: 1.25 }
    },
    channels: {},
    diagnostics: [],
    ...overrides
  };
}

function controlReadResponse(overrides: Partial<RuntimeControlReadResponse> = {}): RuntimeControlReadResponse {
  return {
    ok: true,
    address: { nodeId: "value_1", target: "state", id: "value" },
    value: { type: "float", representation: "f32", value: 1.25 },
    diagnostics: [],
    ...overrides
  };
}

function runtimeAsset(overrides: Partial<RuntimeAsset> = {}): RuntimeAsset {
  return {
    id: "asset_1",
    name: "clip.mp4",
    mimeType: "video/mp4",
    kind: "video",
    sizeBytes: 5,
    runtimeUri: "skenion-runtime://assets/asset_1",
    ...overrides
  };
}

function assetImportResponse(overrides: Partial<RuntimeAssetImportResponse> = {}): RuntimeAssetImportResponse {
  return {
    ok: true,
    asset: runtimeAsset(),
    diagnostics: [],
    ...overrides
  };
}

function assetListResponse(overrides: Partial<RuntimeAssetListResponse> = {}): RuntimeAssetListResponse {
  return {
    ok: true,
    assets: [runtimeAsset()],
    diagnostics: [],
    ...overrides
  };
}

function assetGetResponse(overrides: Partial<RuntimeAssetGetResponse> = {}): RuntimeAssetGetResponse {
  return {
    ok: true,
    asset: runtimeAsset(),
    diagnostics: [],
    ...overrides
  };
}

function previewResponse(overrides: Partial<RuntimePreviewStatus> = {}): RuntimePreviewStatus {
  return {
    ok: true,
    state: "running",
    pid: 42,
    graphId: "test",
    graphRevision: "1",
    sessionRevision: 1,
    previewSessionRevision: 1,
    controlRevision: 1,
    previewControlRevision: 1,
    controlLive: true,
    lastControlUpdateAt: "unix-ms:1",
    stale: false,
    startedAt: "unix-ms:1",
    exitedAt: null,
    exitCode: null,
    message: null,
    diagnostics: [],
    ...overrides
  };
}

function runtimeLogSnapshotResponse(
  overrides: Partial<RuntimeLogSnapshotResponse> = {}
): RuntimeLogSnapshotResponse {
  return {
    schema: "skenion.runtime.logs",
    schemaVersion: "0.1.0",
    ok: true,
    events: [
      {
        id: 1,
        timestamp: "unix-ms:1",
        source: "runtime",
        level: "error",
        code: "io-device-enumeration-failed",
        message: "failed to enumerate IO devices"
      }
    ],
    retention: {
      replayLimit: 200,
      replayLevels: ["warning", "error"]
    },
    diagnostics: [],
    ...overrides
  };
}

function telemetryResponse(overrides: Partial<RuntimeTelemetrySnapshot> = {}): RuntimeTelemetrySnapshot {
  return {
    schema: "skenion.runtime.telemetry",
    schemaVersion: "0.1.0",
    ok: true,
    timestamp: "unix-ms:1",
    session: {
      loaded: true,
      graphId: "test",
      graphRevision: "1",
      sessionRevision: 1,
      controlRevision: 1
    },
    preview: {
      state: "running",
      pid: 42,
      stale: false,
      graphId: "test",
      graphRevision: "1",
      sessionRevision: 1,
      previewSessionRevision: 1,
      controlRevision: 1,
      previewControlRevision: 1,
      controlLive: true,
      lastControlUpdateAt: "unix-ms:1"
    },
    render: {
      active: true,
      backend: "wgpu",
      renderer: "clear-color",
      framesRendered: 12,
      approxFps: 59.8,
      lastFrameMs: 16.7,
      lastError: null,
      sourceNodeId: "clear_1",
      diagnostics: [],
      generatedSourceAvailable: false,
      controlRevision: 1,
      previewControlRevision: 1,
      controlLive: true,
      lastControlUpdateAt: "unix-ms:1"
    },
    process: {
      runtimeVersion: "0.11.0",
      uptimeMs: 1000
    },
    diagnostics: [],
    ...overrides
  };
}

function generatedShaderResponse(
  overrides: Partial<RuntimeGeneratedShaderResponse> = {}
): RuntimeGeneratedShaderResponse {
  return {
    ok: true,
    nodeId: "shader_1",
    language: "wgsl",
    source: "struct SkenionFrame {}\nfn fs_main() -> @location(0) vec4<f32> { return vec4<f32>(1.0); }",
    sourceMap: {
      userSourceStartLine: 32,
      generatedLineOffset: 31
    },
    diagnostics: [],
    ...overrides
  };
}

function runtimeIoDeviceListResponse(overrides: Partial<RuntimeIoDeviceListResponse> = {}): RuntimeIoDeviceListResponse {
  return {
    diagnostics: [],
    devices: [
      {
        backend: "midir",
        directions: ["input"],
        id: "midir:input:0",
        index: 0,
        name: "USB MIDI",
        transportKind: "midi",
        stable: false
      }
    ],
    ok: true,
    ...overrides
  };
}

function runtimeExtensionListResponse(
  overrides: Partial<RuntimeExtensionListResponse> = {}
): RuntimeExtensionListResponse {
  return {
    ok: true,
    extensions: [
      {
        id: "skenion/core",
        version: "0.1.0",
        kind: "core-package",
        runtimeAbiVersion: "0.1.0",
        manifestPath: "/tmp/skenion/core/skenion.extension.json",
        status: "loaded",
        capabilities: ["value.number.v0.1"],
        providedNodes: ["core.value"],
        providedCodecs: [],
        providedTransports: [],
        providedHelp: ["core.value"],
        testIds: ["value-baseline"],
        diagnostics: []
      }
    ],
    diagnostics: [],
    ...overrides
  };
}

function historyEntry(overrides: Partial<RuntimeHistoryEntry> = {}): RuntimeHistoryEntry {
  return {
    id: "history_000001",
    sequence: 1,
    kind: "apply",
    mutation,
    inverseMutation: mutation,
    createdAt: "unix-ms:0",
    ...overrides
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    headers: {
      "content-type": "application/json"
    },
    status
  });
}

function rawJsonResponse(value: string, status = 200): Response {
  return new Response(value, {
    headers: {
      "content-type": "application/json"
    },
    status
  });
}
