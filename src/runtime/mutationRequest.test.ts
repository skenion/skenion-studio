import { describe, expect, it } from "vitest";
import type { RuntimeViewPatchOperation } from "@skenion/contracts";
import { createRuntimeViewMutationRequest } from "./mutationRequest";

describe("runtime mutation requests", () => {
  it("builds view mutation requests without a hardcoded client identity", () => {
    const ops: RuntimeViewPatchOperation[] = [
      {
        op: "setNodeView",
        nodeId: "message_1",
        view: {
          x: 20,
          y: 40
        }
      }
    ];

    const request = createRuntimeViewMutationRequest({
      baseViewRevision: 7,
      description: "move object",
      ops
    });

    expect(request).toEqual({
      description: "move object",
      viewPatch: {
        baseViewRevision: 7,
        ops
      }
    });
    expect("clientId" in request).toBe(false);
  });

  it("does not build retired v0.1 graph mutation requests", () => {
    const request = createRuntimeViewMutationRequest({
      baseViewRevision: 1,
      description: "move object",
      ops: []
    });

    expect("graphPatch" in request).toBe(false);
    expect("operation" in request).toBe(false);
  });
});
