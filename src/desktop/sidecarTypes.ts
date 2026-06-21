import type {
  RuntimeConnectionProfile,
  RuntimeEndpointMetadata
} from "@skenion/contracts";

export interface RuntimeSidecarDiagnostic {
  severity: "error" | "warning" | "info" | string;
  message: string;
  code?: string;
  details?: unknown;
}

export interface RuntimeSidecarStartupResponse {
  schema: "skenion.runtime.sidecar.startup";
  schemaVersion: "0.1.0";
  ok: boolean;
  runtime: {
    name: string;
    version: string;
    apiVersion: string;
  };
  endpoint: RuntimeEndpointMetadata;
  profile: RuntimeConnectionProfile;
  defaultSessionId: string;
  defaultSessionUrl: string;
  health: {
    ok: boolean;
    url: string;
  };
  token: {
    required: boolean;
    header: string;
    token?: string;
  };
  shutdown: {
    supported: boolean;
    method: string;
    url: string;
    scope: string;
  };
  diagnostics: RuntimeSidecarDiagnostic[];
}

export interface RuntimeSidecarStopResponse {
  ok: boolean;
  stopped: boolean;
  profileId?: string;
  runtimeUrl?: string;
  diagnostics: RuntimeSidecarDiagnostic[];
}
