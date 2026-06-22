import type { ProjectDocumentV01 } from "@skenion/contracts";
import type { RuntimeProjectPayload } from "./types";

export function createRuntimeProjectPayload(project: ProjectDocumentV01): RuntimeProjectPayload {
  return clone(project);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
