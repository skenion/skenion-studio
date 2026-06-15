# Skenion Studio

Mantine-based browser editor, controller, and viewer for Skenion runtimes.

Mantine is the primary component system for application UI.

## Status

Early graph editor shell for the Skenion project. Implementation follows the public architecture and release rules defined in [EchoVisionLab/skenion](https://github.com/echovisionlab/skenion).

The first scaffold includes:

- Vite, React, TypeScript, Mantine, and `@xyflow/react`
- Skenion Graph v0.1 import/export
- a node registry palette backed by v0.1 node definitions
- explicit React Flow view-model conversion
- connection validation through `@skenion/contracts`
- inspector diagnostics for graph and port compatibility

React Flow is only the visual interaction layer. `Skenion Graph v0.1` remains the saved document format.

## Development

This repository currently consumes `@skenion/contracts` from a local checkout under `.deps`, matching CI.

```sh
mkdir -p .deps
gh repo clone echovisionlab/skenion-contracts .deps/skenion-contracts
pnpm install --frozen-lockfile
pnpm run ci
pnpm run dev
```

If `.deps/skenion-contracts` already exists, update it before installing dependencies.

## License And Credit

This repository is licensed under the Apache License, Version 2.0.

Redistributions must preserve copyright, license, and NOTICE information as required by Apache-2.0. If Skenion helps your artwork, research, publication, installation, or tool, please credit Skenion and EchoVisionLab.
