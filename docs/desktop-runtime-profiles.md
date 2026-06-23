# Desktop Runtime Profiles

skenion studio desktop uses Tauri as the shell. Runtime graph/session authority stays in
`skenion-runtime`; Tauri owns only windows and local child process lifecycle.

## Profiles

- `local-managed`: Tauri starts `skenion-runtime serve --host 127.0.0.1 --port 0 --startup-json`,
  reads the startup JSON, and connects studio to the bound endpoint. Tauri stops only the child
  process it started when switching away from the profile or when the owning window closes.
- `local-shared`: Studio connects to an already-running local Runtime endpoint and never stops it.
- `remote`: Studio connects to the configured Runtime URL and starts no local process.

## Diagnostics

For local-managed desktop runs, make the Runtime binary discoverable in one of these ways:

```sh
export SKENION_RUNTIME_BIN=/absolute/path/to/skenion-runtime
pnpm tauri:dev
```

If `SKENION_RUNTIME_BIN` is unset, the Tauri command looks for a sibling
bundled Tauri sidecar, then `../Skenion-runtime/target/debug/skenion-runtime` for local workspace
development, then falls back to `skenion-runtime` on `PATH`.

Release builds stage the bundled sidecar from the same-train Runtime GitHub Release. The staging
script verifies the Runtime asset checksum before Tauri packages the app.

The native command returns the Runtime `skenion.runtime.sidecar.startup` JSON on success. Startup
failures surface in the Runtime settings panel and client log. In CI or browser-only development,
use `local-shared` with an externally started Runtime:

```sh
skenion-runtime serve --host 127.0.0.1 --port 3761
pnpm dev
```

Multiple shared studio windows use the same Runtime URL and session id. Isolated demo windows launch
with their own local-managed profile key so they can own a separate Runtime child.
