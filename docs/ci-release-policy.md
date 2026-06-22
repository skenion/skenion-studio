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

- release-blocking macOS arm64 / Apple Silicon: `aarch64-apple-darwin`.
- release-blocking macOS x64 / Intel: `x86_64-apple-darwin`.
- release-blocking Windows x64: `x86_64-pc-windows-msvc`.
- release-blocking Linux x64: `x86_64-unknown-linux-gnu`.
- preview: `aarch64-pc-windows-msvc`, `aarch64-unknown-linux-gnu`.

The workflow produces two different artifact classes:

- Studio desktop packages are the user-facing Tauri app distribution artifacts
  for each OS, such as signed/notarized macOS App/DMG output, Windows MSI or
  NSIS `-setup.exe` installers, and Linux package output.
- Runtime sidecar archives are same-train Runtime transport assets consumed by
  Studio desktop packaging and release-train verification. They are not desktop
  installers, standalone app downloads, or Windows installer substitutes, and
  must be named as sidecar archives or sidecar assets in release manifests,
  package manifests, and release evidence.

Before Tauri packaging, `scripts/stage-runtime-sidecar.mjs` downloads the
matching `skenion-runtime-vx.y.z-<target>.tar.gz` asset from the same-train
Runtime GitHub Release, verifies the SHA-256 checksum, extracts the Runtime
binary, and stages it for `bundle.externalBin`. Publish and verify modes fail
closed when the Runtime asset or checksum is missing or mismatched.
`scripts/package-runtime-sidecar.mjs` then repackages that staged binary as the
Studio release sidecar asset expected by the train manifest:
`skenion-runtime-sidecar-<target>.tar.gz` for macOS/Linux and
`skenion-runtime-sidecar-<target>.zip` for Windows, with a sibling `.sha256`
file. Windows sidecars use ZIP because the transported payload is a `.exe` and
Windows tooling handles ZIP natively; that ZIP is internal release-train
transport only, not the Studio Windows installer. macOS and Linux sidecars use
`tar.gz` so Unix executable mode and path semantics survive archive creation,
upload, and extraction. Publish mode uploads those sidecar assets to the Studio
GitHub Release.

Windows Studio distribution is installer-based. The primary v0 user-facing
Windows artifact family is the Tauri NSIS setup executable ending in
`-setup.exe`; MSI output may be published as an additional installer when it is
stable. A `skenion-runtime-sidecar-*-windows-*.zip` asset is never evidence of a
Windows Studio installer, even though it transports a Windows `.exe` sidecar.
The desktop release workflow records this split in the Windows package summary
and fails the classification check if the sidecar asset stops being named as an
internal Runtime sidecar ZIP.

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

macOS desktop distribution is release-complete only when the release-blocking
macOS arm64 (`aarch64-apple-darwin`) and macOS x64 (`x86_64-apple-darwin`)
publish jobs produce signed and notarized Tauri App/DMG artifacts. Unsigned
macOS artifacts are useful build or preview evidence, but they do not satisfy
the desktop release-completion gate. Publish mode fails closed before Tauri
packaging if `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, and
`APPLE_SIGNING_IDENTITY` are absent, or if notarization credentials are absent.
Notarization currently uses the Apple ID credential path and requires
`APPLE_ID`, `APPLE_PASSWORD`, and `APPLE_TEAM_ID` so the Tauri publish step can
submit App/DMG artifacts to Apple from the macOS packaging jobs.

Windows desktop publish mode also fails closed unless the repository variable
`WINDOWS_INSTALLER_SIGNING_MODE` is explicitly set. The only currently
permitted non-signing value is `unsigned-preview`, which may publish installer
artifacts as explicit preview evidence but does not satisfy Windows desktop
release completion. `signed-required` and `azure-trusted-signing` are reserved
for real signed-installer release paths and must not pass until Tauri Windows
signing is wired with the matching certificate, signing service, timestamp, or
custom signing command configuration. Verify mode does not require this
variable because it is a packaging smoke test, not release evidence.

Full application auto-updater rollout remains out of v0 scope. Missing updater
feed publication or updater signing keys must be reported with the desktop
assets, but they must not block v0 while same-train Studio desktop packages and
Runtime sidecar archives are available, checksummed, and otherwise satisfy the
release train gates.
