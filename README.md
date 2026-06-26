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

Default installs, CI, builds, tests, and release workflows consume the committed
registry dependency for `@skenion/contracts`. A local Contracts checkout is only
used when you run the explicit integration command below; simply cloning into
`.deps` does not change Studio's dependency resolution.

```sh
pnpm install --frozen-lockfile
pnpm run ci
pnpm run dev
```

For pre-release cross-repo integration, build the Contracts TypeScript package
first, then run Studio validation through the local package without committing
`file:`, `link:`, `workspace:`, or GitHub dependency overrides:

```sh
mkdir -p .deps
gh repo clone skenion/skenion-contracts .deps/skenion-contracts
pnpm --dir .deps/skenion-contracts/packages/ts install --frozen-lockfile
pnpm --dir .deps/skenion-contracts/packages/ts run build
pnpm run check-local-contracts-integration
```

The integration command defaults to `.deps/skenion-contracts/packages/ts` and
the sibling `../Skenion-contracts/packages/ts` checkout. To use a different
checkout, pass `--contracts-package <path>` or set
`SKENION_CONTRACTS_TS_PACKAGE`. The command verifies the local package metadata,
`dist/index.js`, Studio's declared version ranges, git branch/commit evidence
where available, and then temporarily redirects `node_modules/@skenion/contracts`
only for the validation run.

Desktop sidecar diagnostics and profile behavior are documented in
[`docs/desktop-runtime-profiles.md`](docs/desktop-runtime-profiles.md).

## License And Credit

This repository is licensed under the Apache License, Version 2.0.

Redistributions must preserve copyright, license, and NOTICE information as required by Apache-2.0. If skenion helps your artwork, research, publication, installation, or tool, please credit skenion.
