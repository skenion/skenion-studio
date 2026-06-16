import {
  applyGraphPatch,
  type GraphDocumentV01,
  type GraphPatchOperationV01,
  type GraphPatchV01
} from "@skenion/contracts";
import type { GraphPatch as StudioGraphPatch } from "./skenionGraph";

export interface CreateGraphPatchOptions {
  id?: string;
  clientId?: string;
  createdAt?: string;
  description?: string;
}

export interface PendingGraphPatchQueue {
  baseRevision: string | null;
  conflict: string | null;
  ops: GraphPatchOperationV01[];
}

export function emptyGraphPatchQueue(): PendingGraphPatchQueue {
  return {
    baseRevision: null,
    conflict: null,
    ops: []
  };
}

export function createGraphPatch(
  baseRevision: string,
  ops: GraphPatchOperationV01[],
  options: CreateGraphPatchOptions = {}
): GraphPatchV01 {
  const patch: GraphPatchV01 = {
    schema: "skenion.graph.patch",
    schemaVersion: "0.1.0",
    id: options.id ?? `patch_${baseRevision}_${ops.length}`,
    baseRevision,
    ops: clone(ops)
  };
  if (options.clientId) {
    patch.clientId = options.clientId;
  }
  if (options.createdAt) {
    patch.createdAt = options.createdAt;
  }
  if (options.description) {
    patch.description = options.description;
  }

  return patch;
}

export function graphPatchFromStudioAction(
  patch: StudioGraphPatch
): GraphPatchOperationV01 {
  switch (patch.type) {
    case "addNode":
      return {
        op: "addNode",
        node: clone(patch.node)
      };
    case "removeNode":
      return {
        op: "removeNode",
        nodeId: patch.nodeId
      };
    case "addEdge":
      return {
        op: "addEdge",
        edge: clone(patch.edge)
      };
    case "removeEdge":
      return {
        op: "removeEdge",
        edge: clone(patch.edge)
      };
  }
}

export function applyGraphPatchToLocalGraph(
  graph: GraphDocumentV01,
  patch: GraphPatchV01,
  nextRevision: string
): GraphDocumentV01 {
  const result = applyGraphPatch(graph, patch, { nextRevision });
  if (!result.ok) {
    throw new Error(result.errors.join("; "));
  }

  return result.graph;
}

export function enqueueGraphPatchOperation(
  queue: PendingGraphPatchQueue,
  operation: GraphPatchOperationV01,
  runtimeGraphRevision: string | null
): PendingGraphPatchQueue {
  const baseRevision = queue.baseRevision ?? runtimeGraphRevision;
  if (!baseRevision) {
    return queue;
  }

  return {
    baseRevision,
    conflict: null,
    ops: [...queue.ops, clone(operation)]
  };
}

export function clearGraphPatchQueue(): PendingGraphPatchQueue {
  return emptyGraphPatchQueue();
}

export function markGraphPatchConflict(
  queue: PendingGraphPatchQueue,
  message: string
): PendingGraphPatchQueue {
  return {
    ...queue,
    conflict: message
  };
}

export function acceptGraphPatchQueue(): PendingGraphPatchQueue {
  return emptyGraphPatchQueue();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
