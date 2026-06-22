# Skenion Studio CI and Release Policy

Studio treats graph UX and runtime-compatibility gates as release-relevant behavior. A change that makes a gate stricter, changes canonical builtin consumption, or changes the graph editing contract should ship as a real patch or minor release through Release Please.

## CI Jobs

- Unit: lint and coverage.
- Build: TypeScript and Vite production build.
- Desktop Release: release-tag or conductor-dispatched Tauri packaging with
  same-train Runtime sidecars.

Visual Gate is intentionally not part of default GitHub CI. It is a local,
human-in-the-loop QA surface for graph editor changes where the Studio stays
open and screenshots can be reviewed with the implementation.

## Visual Gate Artifacts

The visual gate is expected to generate exactly fifteen PNG artifacts:

- `shader-uniform-sample.png`
- `shader-multi-uniform-sample.png`
- `port-demo-sample.png`
- `project-saved-layout.png`
- `object-visual-objects.png`
- `object-visual-pan-drag.png`
- `nodecard-float-value.png`
- `nodecard-fullscreen-shader.png`
- `nodecard-render-output.png`
- `shader-diagnostics-panel.png`
- `help-panel-value-f32.png`
- `help-graph-value-bang-set.png`
- `invalid-connection.png`
- `selected-edge.png`
- `many-port-node.png`

`pnpm run ci` is the automated local and GitHub CI gate: lint, coverage, and
app build. `pnpm run visual-gate` is the explicit visual QA command and should
be run when a graph editor change needs screenshot review.

## Release Hygiene

Do not bump `package.json` manually to describe compatibility. Use Conventional Commits and let Release Please produce the version bump.

- `fix(studio): ...` for behavior, compatibility, or quality-gate changes that should produce a patch release.
- `feat(studio): ...` for user-visible graph/runtime capabilities.
- `test(studio): ...` and `ci(studio): ...` only when no release note or version signal is needed.

The canonical builtin registry migration is compatibility-affecting. If the current published Studio version predates that migration, the next Studio release notes should explicitly mention that Studio consumes canonical builtin node definitions from `@skenion/contracts`.

## Desktop Packaging

Studio remains a React/Vite web client. Desktop packaging uses the Tauri shell
only; there is no Electron fallback in the v0 release path.

The desktop release workflow runs from `skenion-studio-vx.y.z` release tags or
from conductor dispatch inputs that name the same lockstep train version. The
workflow packages these targets:

- release-blocking: `aarch64-apple-darwin`, `x86_64-apple-darwin`,
  `x86_64-pc-windows-msvc`, `x86_64-unknown-linux-gnu`.
- preview: `aarch64-pc-windows-msvc`, `aarch64-unknown-linux-gnu`.

Before Tauri packaging, `scripts/stage-runtime-sidecar.mjs` downloads the
matching `skenion-runtime-vx.y.z-<target>.tar.gz` asset from the same-train
Runtime GitHub Release, verifies the SHA-256 checksum, extracts the Runtime
binary, and stages it for `bundle.externalBin`. Publish and verify modes fail
closed when the Runtime asset or checksum is missing or mismatched.
`scripts/package-runtime-sidecar.mjs` then repackages that staged binary as the
Studio release sidecar asset expected by the train manifest:
`skenion-runtime-sidecar-<target>.tar.gz` for macOS/Linux and
`skenion-runtime-sidecar-<target>.zip` for Windows, with a sibling `.sha256`
file. Publish mode uploads those sidecar assets to the Studio GitHub Release.

Desktop release packaging consumes `@skenion/contracts` from npm, not from a
sibling checkout. The release tag must declare `@skenion/contracts` as the exact
train version, the package must already exist on npm, and the installed package
version is verified before Tauri packaging starts.

Release Please remains responsible for versioning and GitHub release creation.
Desktop packaging uploads artifacts only from GitHub Actions publish mode.
Local commands may build or stage artifacts for verification, but they must not
publish Studio desktop packages or Runtime sidecars.

Web Studio release behavior remains remote-runtime compatible: Vite builds do
not require the sidecar, and browser deployments continue to use explicit
Runtime URLs.

Signing, notarization, and full desktop auto-updater rollout are not blockers
for this v0 packaging foundation. The workflow uses Tauri packaging without
project signing secrets; signed and notarized packages, updater signing keys,
and updater feed publication should be added when the release environment owns
those credentials. Missing full-app updater support must be reported with the
desktop assets, but it must not block v0 while same-train sidecar packages are
available and checksummed.
