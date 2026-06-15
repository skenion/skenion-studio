import { describe, expect, it, vi } from "vitest";
import { createRuntimeClient, normalizeRuntimeUrl, RuntimeClientError } from "./client";
import type { RuntimeProjectPayload } from "./types";

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

describe("runtime client", () => {
  it("normalizes runtime URLs", () => {
    expect(normalizeRuntimeUrl(" http://127.0.0.1:3761/ ")).toBe("http://127.0.0.1:3761");
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
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:3761/health", { method: "GET" });
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
});

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    headers: {
      "content-type": "application/json"
    },
    status
  });
}
