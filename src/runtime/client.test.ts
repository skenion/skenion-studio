import { describe, expect, it, vi } from "vitest";
import type {
  GraphPatchEventV01,
  GraphPatchHistoryV01,
  GraphPatchV01
} from "@skenion/contracts";
import { createRuntimeClient, normalizeRuntimeUrl, RuntimeClientError } from "./client";
import type {
  RuntimeAsset,
  RuntimeAssetGetResponse,
  RuntimeAssetImportResponse,
  RuntimeAssetListResponse,
  RuntimeControlEventResponse,
  RuntimeControlReadResponse,
  RuntimeControlStateResponse,
  RuntimeGeneratedShaderResponse,
  RuntimePatchResponse,
  RuntimePreviewStatus,
  RuntimeProjectPayload,
  RuntimeSessionProjectResponse,
  RuntimeSessionResponse,
  RuntimeTelemetrySnapshot
} from "./types";

const project = {
  graph: {
    schema: "skenion.graph",
    schemaVersion: "0.1.0",
    id: "test",
    revision: "1",
    nodes: [],
    edges: []
  },
  nodes: []
} as RuntimeProjectPayload;

const patch: GraphPatchV01 = {
  schema: "skenion.graph.patch",
  schemaVersion: "0.1.0",
  id: "patch_1",
  baseRevision: "1",
  ops: [
    {
      op: "setNodeParam",
      nodeId: "value_1",
      key: "value",
      value: 0.75
    }
  ]
};

describe("runtime client", () => {
  it("normalizes runtime URLs", () => {
    expect(normalizeRuntimeUrl(" http://localhost:3761/ ")).toBe("http://localhost:3761");
    expect(() => normalizeRuntimeUrl(" ")).toThrow(RuntimeClientError);
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
      String(_input).endsWith("/v0/session/history")
        ? jsonResponse(historyResponse())
        : String(_input).endsWith("/v0/session/project")
        ? jsonResponse(sessionProjectResponse())
        : String(_input).endsWith("/v0/session/patch") ||
            String(_input).endsWith("/v0/session/undo") ||
            String(_input).endsWith("/v0/session/redo")
        ? jsonResponse(patchResponse())
        : jsonResponse(sessionResponse())
    );
    const client = createRuntimeClient({ baseUrl: "http://runtime.local", fetchImpl: fetchMock as typeof fetch });

    await client.getSession();
    await client.getSessionProject();
    await client.loadSession(project);
    await client.validateSession();
    await client.planSession();
    await client.runSession(2);
    await client.applySessionPatch(patch);
    await client.getSessionHistory();
    await client.undoSessionPatch();
    await client.redoSessionPatch();
    await client.clearSession();

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(fetchMock).toHaveBeenCalledTimes(11);
    expect(calls[0]).toEqual(["http://runtime.local/v0/session", { method: "GET" }]);
    expect(calls[1]).toEqual(["http://runtime.local/v0/session/project", { method: "GET" }]);
    expect(calls[2][0]).toBe("http://runtime.local/v0/session/load");
    expect(JSON.parse(String(calls[2][1].body))).toEqual(project);
    expect(calls[3]).toEqual(["http://runtime.local/v0/session/validate", { method: "POST" }]);
    expect(calls[4]).toEqual(["http://runtime.local/v0/session/plan", { method: "POST" }]);
    expect(calls[5][0]).toBe("http://runtime.local/v0/session/run");
    expect(JSON.parse(String(calls[5][1].body))).toEqual({ frames: 2 });
    expect(calls[6][0]).toBe("http://runtime.local/v0/session/patch");
    expect(JSON.parse(String(calls[6][1].body))).toEqual(patch);
    expect(calls[7]).toEqual(["http://runtime.local/v0/session/history", { method: "GET" }]);
    expect(calls[8]).toEqual(["http://runtime.local/v0/session/undo", { method: "POST" }]);
    expect(calls[9]).toEqual(["http://runtime.local/v0/session/redo", { method: "POST" }]);
    expect(calls[10]).toEqual(["http://runtime.local/v0/session", { method: "DELETE" }]);
  });

  it("calls runtime control endpoints", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) =>
      String(_input).endsWith("/v0/session/control/state")
        ? jsonResponse(controlStateResponse())
        : String(_input).endsWith("/v0/session/control/read")
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
    expect(calls[0][0]).toBe("http://runtime.local/v0/session/control/event");
    expect(JSON.parse(String(calls[0][1].body))).toEqual({
      nodeId: "value_1",
      portId: "in",
      message: { selector: "float", atoms: [{ type: "float", representation: "f32", value: 1.25 }] }
    });
    expect(calls[1]).toEqual(["http://runtime.local/v0/session/control/state", { method: "GET" }]);
    expect(calls[2][0]).toBe("http://runtime.local/v0/session/control/read");
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
        String(_input).endsWith("/v0/session/control/state")
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
    expect(calls[0]).toEqual(["http://runtime.local/v0/session/preview", { method: "GET" }]);
    expect(calls[1][0]).toBe("http://runtime.local/v0/session/preview/start");
    expect(JSON.parse(String(calls[1][1].body))).toEqual({ restart: false });
    expect(calls[2][0]).toBe("http://runtime.local/v0/session/preview/start");
    expect(JSON.parse(String(calls[2][1].body))).toEqual({ restart: true });
    expect(calls[3]).toEqual(["http://runtime.local/v0/session/preview/stop", { method: "POST" }]);
    expect(calls[4]).toEqual(["http://runtime.local/v0/session/preview/restart", { method: "POST" }]);
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
    expect((calls[0][1].body as FormData).get("kind")).toBe("video");
    expect((calls[1][1].body as FormData).get("kind")).toBeNull();
    expect(calls[2]).toEqual(["http://runtime.local/v0/assets", { method: "GET" }]);
    expect(calls[3]).toEqual(["http://runtime.local/v0/assets/asset%2Fwith%20space", { method: "GET" }]);
  });

  it("calls runtime telemetry endpoint", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(telemetryResponse()));
    const client = createRuntimeClient({ baseUrl: "http://runtime.local", fetchImpl: fetchMock as typeof fetch });

    await client.getTelemetry();

    expect(fetchMock).toHaveBeenCalledWith("http://runtime.local/v0/session/telemetry", { method: "GET" });
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
    expect(fetchMock).toHaveBeenCalledWith("http://runtime.local/v0/session/render/generated-shader", { method: "GET" });

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

    await expect(client.applySessionPatch(patch)).resolves.toMatchObject({
      ok: true,
      applied: true,
      conflict: false,
      graph: {
        revision: "2"
      },
      session: {
        graphRevision: "2"
      },
      event: {
        kind: "apply"
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
        String(_input).endsWith("/v0/session/history")
          ? jsonResponse(historyResponse({ canUndo: false, undoDepth: 0, events: [] }))
          : jsonResponse(patchResponse({ event: null }))
      ) as typeof fetch
    });

    await expect(client.applySessionPatch(patch)).resolves.toMatchObject({
      event: null
    });
    await expect(client.getSessionHistory()).resolves.toMatchObject({
      canUndo: false,
      undoDepth: 0,
      events: []
    });
  });

  it("accepts empty runtime session responses", async () => {
    const client = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          sessionResponse({
            loaded: false,
            graphId: null,
            graphRevision: null,
            sessionRevision: 0,
            controlRevision: 0
          })
        )
      ) as typeof fetch
    });

    await expect(client.getSession()).resolves.toMatchObject({
      loaded: false,
      graphId: null,
      graphRevision: null
    });
  });

  it("accepts runtime session responses with plan and report objects", async () => {
    const client = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          sessionResponse({
            plan: { graphId: "test" },
            report: { graphId: "test", frameCount: 2 }
          } as Partial<RuntimeSessionResponse>)
        )
      ) as typeof fetch
    });

    await expect(client.runSession(2)).resolves.toMatchObject({
      plan: { graphId: "test" },
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

  it("rejects unsupported runtime session project response shapes", async () => {
    const invalidProjectClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          sessionProjectResponse({
            project: {
              ...project,
              nodes: [{} as RuntimeProjectPayload["nodes"][number]]
            }
          })
        )
      ) as typeof fetch
    });

    await expect(invalidProjectClient.getSessionProject()).rejects.toThrow("unsupported response shape");
  });

  it("rejects unsupported runtime patch response shapes", async () => {
    const invalidGraphClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          patchResponse({
            graph: {
              schema: "skenion.graph",
              schemaVersion: "0.1.0",
              id: "test",
              revision: "2",
              nodes: []
            } as unknown as RuntimePatchResponse["graph"]
          })
        )
      ) as typeof fetch
    });

    await expect(invalidGraphClient.applySessionPatch(patch)).rejects.toThrow("unsupported response shape");

    const invalidEventClient = createRuntimeClient({
      baseUrl: "http://runtime.local",
      fetchImpl: vi.fn(async () =>
        jsonResponse(
          patchResponse({
            event: {
              ...patchEvent(),
              kind: "reverse"
            } as unknown as RuntimePatchResponse["event"]
          })
        )
      ) as typeof fetch
    });
    await expect(invalidEventClient.applySessionPatch(patch)).rejects.toThrow("unsupported response shape");

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
    await expect(invalidHistoryClient.applySessionPatch(patch)).rejects.toThrow("unsupported response shape");
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

function sessionResponse(overrides: Partial<RuntimeSessionResponse> = {}): RuntimeSessionResponse {
  return {
    ok: true,
    loaded: true,
    graphId: "test",
    graphRevision: "1",
    sessionRevision: 1,
    controlRevision: 0,
    diagnostics: [],
    plan: null,
    report: null,
    ...overrides
  };
}

function sessionProjectResponse(
  overrides: Partial<RuntimeSessionProjectResponse> = {}
): RuntimeSessionProjectResponse {
  return {
    ok: true,
    loaded: true,
    project,
    session: sessionResponse(),
    diagnostics: [],
    ...overrides
  };
}

function patchResponse(overrides: Partial<RuntimePatchResponse> = {}): RuntimePatchResponse {
  return {
    ok: true,
    applied: true,
    conflict: false,
    graph: {
      schema: "skenion.graph",
      schemaVersion: "0.1.0",
      id: "test",
      revision: "2",
      nodes: [],
      edges: []
    },
    session: sessionResponse({
      graphRevision: "2",
      sessionRevision: 2
    }),
    event: patchEvent(),
    history: historyResponse(),
    diagnostics: [],
    ...overrides
  };
}

function historyResponse(overrides: Partial<GraphPatchHistoryV01> = {}): GraphPatchHistoryV01 {
  return {
    schema: "skenion.graph.patch.history",
    schemaVersion: "0.1.0",
    events: [patchEvent()],
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

function patchEvent(overrides: Partial<GraphPatchEventV01> = {}): GraphPatchEventV01 {
  return {
    schema: "skenion.graph.patch.event",
    schemaVersion: "0.1.0",
    id: "event_000001",
    sequence: 1,
    kind: "apply",
    patch,
    inversePatch: {
      ...patch,
      id: "inverse_patch_1",
      baseRevision: "2"
    },
    revisionBefore: "1",
    revisionAfter: "2",
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
