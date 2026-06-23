# skenion studio

Mantine-based browser editor, controller, and viewer for skenion runtimes.

Mantine is the primary component system for application UI.

## Status

Early graph editor shell for the skenion project. Implementation follows the public architecture and release rules defined in [skenion/skenion](https://github.com/skenion/skenion).

The first scaffold includes:

- Vite, React, TypeScript, Mantine, and `@xyflow/react`
- Tauri desktop shell scaffolding with Runtime connection profiles
- skenion graph v0.1 import/export
- a node registry palette backed by v0.1 node definitions
- explicit React Flow view-model conversion
- connection validation through `@skenion/contracts`
- inspector diagnostics for graph and port compatibility

React Flow is only the visual interaction layer. `skenion graph v0.1` remains the saved document format.

## Development

This repository currently consumes `@skenion/contracts` from a local checkout under `.deps`, matching CI.

```sh
mkdir -p .deps
gh repo clone skenion/skenion-contracts .deps/skenion-contracts
pnpm install --frozen-lockfile
pnpm run ci
pnpm run dev
```

If `.deps/skenion-contracts` already exists, update it before installing dependencies.

Desktop sidecar diagnostics and profile behavior are documented in
[`docs/desktop-runtime-profiles.md`](docs/desktop-runtime-profiles.md).

## License And Credit

This repository is licensed under the Apache License, Version 2.0.

Redistributions must preserve copyright, license, and NOTICE information as required by Apache-2.0. If skenion helps your artwork, research, publication, installation, or tool, please credit skenion.
