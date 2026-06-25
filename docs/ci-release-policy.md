# skenion studio CI and Release Policy

Studio treats graph UX and runtime-compatibility gates as release-relevant behavior. A change that makes a gate stricter, changes canonical builtin consumption, or changes the graph editing contract should ship as a real patch or minor release through Release Please.

## CI Jobs

- Unit: lint and coverage.
- Build: TypeScript and Vite production build.
- Desktop Release: release-tag or conductor-dispatched Tauri packaging with
  exact Runtime release artifact manifest evidence.

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

Studio preserves pnpm's minimum-release-age policy for third-party
dependencies. The only workspace-level age-policy exclusion is the first-party
`@skenion/contracts` package, so PR CI can validate against freshly published
Contracts patches while still building the sibling Contracts checkout used for
integration checks.

## Release Hygiene

Do not bump `package.json` manually to describe compatibility. Use Conventional Commits and let Release Please produce the version bump.

- `fix(studio): ...` for behavior, compatibility, or quality-gate changes that should produce a patch release.
- `feat(studio): ...` for user-visible graph/runtime capabilities.
- `test(studio): ...` and `ci(studio): ...` only when no release note or version signal is needed.

The canonical builtin registry migration is compatibility-affecting. If the current published Studio version predates that migration, the next Studio release notes should explicitly mention that Studio consumes canonical builtin node definitions from `@skenion/contracts`.

## Release Status States

Release Please remains responsible for versioning, changelog updates, tag
creation, and initial GitHub Release creation. That initial GitHub Release is
metadata, not distribution. The Release Please config creates newly created
Studio GitHub Releases as prerelease by default, so if status annotation fails
or is interrupted, an empty release remains prerelease/unpromoted and is not
release-complete. The Release Please workflow then prepends a status block that
says the release has no product artifacts yet. A Release Please metadata
release must not be described as release-complete, even when the changelog
contains CI or packaging fixes.

The Studio release artifact workflows then replace that status block as product
evidence appears:

- Studio Release Artifacts publish mode uploads the canonical web bundle,
  checksum, desktop manifest metadata, desktop manifest checksum, and combined
  checksum manifest to DSUB release storage. The GitHub Release body records
  DSUB download and checksum links instead of carrying artifact evidence. This
  is web artifact evidence, not full Studio distribution completion, because
  release-blocking desktop installers can still be missing.
- Desktop Release publish mode uploads real Tauri installer artifacts and
  checksums for each successful package to DSUB release storage. Runtime
  binaries remain sourced from Runtime release artifact manifests. A final
  status step rewrites the GitHub Release body from deterministic DSUB public
  URLs for the release-blocking installer set.

A Studio GitHub Release is release-complete only when the release has the
canonical web artifact links, release-blocking desktop installer links, and
Runtime release manifest evidence. Signing mode is recorded in the release
body, but `unsigned-preview` is permitted for internal/pre-alpha distribution
evidence and does not by itself make the release incomplete. If the release has
only a partial artifact set, the release notes must keep an explicit
non-distribution marker instead of implying product availability.

Product release promotion is a separate product-level ledger step. Do not
report a promoted Studio product line until the `skenion/skenion` Project
records the intended Contracts line, Runtime evidence, Studio artifacts, and
Examples/Manual evidence.

## Desktop Packaging

Studio remains a React/Vite web client. Desktop packaging uses the Tauri shell
only; there is no Electron fallback in the v0 release path.

The desktop release workflow is manually dispatched with a Studio release tag,
an exact Runtime release tag, and a desktop signing mode. It checks out the
Studio tag and packages these targets:

- release-blocking macOS Apple Silicon DMG.
- release-blocking macOS Intel DMG.
- release-blocking Windows x64 setup executable, with MSI when emitted.
- release-blocking Linux x64 deb/rpm installers.
- preview Windows arm64 and Linux arm64 installers.

The workflow consumes Runtime release evidence and produces Studio desktop
artifacts:

- skenion studio desktop packages are the real Tauri installer artifacts:
  macOS `.dmg`, Windows setup `.exe` with MSI included only when Tauri emits
  it, and Linux `.deb`/`.rpm`. Each installer has a sibling `.sha256` file.
  They are published under product-facing DSUB paths such as
  `skenion-studio/<release-tag>/desktop/macos-apple-silicon/...`,
  `desktop/windows-x64/...`, `desktop/linux-x64-deb/...`, and
  `desktop/linux-x64-rpm/...`. Public artifact names and paths must not expose
  Rust target triples.
- Each successful installer also produces a compact DSUB-hosted index JSON
  file. That index records Studio version, release tag, source commit, package
  ID, target tier, Contracts metadata, Runtime release tag/binary source,
  signing mode, and the DSUB URL/S3 key/size and SHA-256 evidence for the
  installer and checksum. Index JSON files remain in DSUB storage; they are not
  uploaded to the Studio GitHub Release.
- Runtime release artifact manifests are Runtime-owned evidence consumed by
  skenion studio desktop packaging and compatibility verification. Studio uses
  the Runtime release evidence to find the raw Runtime binary published by
  Runtime to DSUB S3, then verifies its size and SHA-256 before staging the
  Tauri external binary. Studio must not rebuild, repackage, or upload Runtime
  binary assets to the Studio GitHub Release.

Tauri action builds are used only to produce the platform bundle outputs. The
desktop release workflow then runs `scripts/package-studio-desktop.mjs` in
publish mode to collect Tauri installer files directly and write one checksum
per installer. `scripts/publish-studio-desktop-asset-s3.sh` publishes those
files to DSUB S3 with no-clobber behavior, verifies S3 metadata and optional
public URL content, and generates DSUB-hosted per-installer index JSON. The
GitHub Release body records DSUB download and checksum links; no Studio
desktop artifact or index is uploaded as a GitHub Release asset. Verify mode
builds the Tauri packages but does not upload release assets. Linux desktop
release assets are deb/rpm installers; the v0 workflow does not claim or
manifest AppImage assets. Windows desktop release assets are installer files
that Tauri actually produced; the release flow does not claim a standalone
`.msi` asset unless MSI output is present.

Before Tauri packaging, `scripts/stage-runtime-sidecar.mjs` loads Runtime
release evidence selected by the exact Runtime release tag, or an explicitly
supplied Runtime manifest URL. The script validates the manifest schema,
component, Runtime version, release tag, Rust target, platform slug, raw-binary
format, executable name, artifact/checksum/manifest filenames, public URLs, S3
keys, artifact size, and SHA-256. It then downloads the raw Runtime binary from
`manifest.artifact.publicUrl` and stages it for `bundle.externalBin`. Publish
and verify modes fail closed when the Runtime manifest, artifact, size, or
checksum is missing or mismatched. Local checks may pass a generated manifest fixture with
`--manifest ... --check-manifest-only`; that path is for validation and tests,
not for release publication.

Windows studio distribution is installer-based. The primary v0 user-facing
Windows artifact family is the Tauri NSIS setup executable ending in
`-setup.exe`; MSI output may be published as an additional installer when it is
stable. Runtime manifest evidence is not a Windows studio installer and is not
uploaded as a Studio-owned Windows release asset.

Desktop release packaging consumes `@skenion/contracts` from npm, not from a
sibling checkout. Studio currently targets Contracts line `0.45`, expressed as
`>=0.45.0 <0.46.0`; app builds may pin a concrete released patch such as
`0.45.0`, and release metadata records the compatibility range. The selected
package must already exist on npm, and the installed package line is verified
before Tauri packaging starts.

Release Please remains responsible for versioning and GitHub release creation.
Desktop packaging uploads artifacts only from GitHub Actions publish mode.
Local commands may build or stage artifacts for verification, but they must not
publish Studio desktop packages or Runtime artifacts. DSUB desktop publishing
requires `workflow_dispatch` and DSUB S3 secrets. The organization `GH_TOKEN`
secret is used only to rewrite the GitHub Release body with DSUB links; dry-run
publisher validation does not require DSUB secrets.

skenion studio web release behavior remains remote-runtime compatible: Vite
builds do not require the sidecar, and browser deployments continue to use
explicit Runtime URLs. The web build is distributed from DSUB release storage
as `skenion-studio-web-bundle-vx.y.z.tar.gz`, with a sibling
`skenion-studio-web-bundle-vx.y.z.tar.gz.sha256` checksum, not as an npm
package. The GitHub Release body records the web artifact set's DSUB download
and checksum links instead of carrying the compact index as a release asset.

skenion studio desktop packages are distributed from DSUB S3 release storage.
The Studio GitHub Release body records DSUB download and checksum links. The
private `packages/studio-desktop` workspace package exists only to stage
release metadata and dry-run pack checks; it must not be published to npm.

macOS desktop distribution is release-complete only when the release-blocking
macOS Apple Silicon and macOS Intel publish jobs produce Tauri DMG artifacts.
Signing mode is recorded, and
`unsigned-preview` must be passed explicitly in the dispatch input for
internal/pre-alpha evidence. Signed publish mode fails closed before Tauri
packaging if `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, and
`APPLE_SIGNING_IDENTITY` are absent, or if notarization credentials are absent.
Notarization currently uses the Apple ID credential path and requires
`APPLE_ID`, `APPLE_PASSWORD`, and `APPLE_TEAM_ID` so the Tauri publish step can
submit App/DMG artifacts to Apple from the macOS packaging jobs.

Windows desktop publish mode uses the validated `desktop-signing-mode` dispatch
input. Empty or unknown signing modes are rejected. The only currently
permitted non-signing value is an explicitly dispatched `unsigned-preview`,
which may publish installer artifacts as explicit preview evidence.
`signed-required` and `azure-trusted-signing` are reserved for real
signed-installer release paths and must not pass until Tauri Windows signing is
wired with the matching certificate, signing service, timestamp, or custom
signing command configuration. Verify mode does not require signed artifacts
because it is a packaging smoke test, not release evidence.

Full application auto-updater rollout remains out of v0 scope. Missing updater
feed publication or updater signing keys must be reported with the desktop
assets, but they must not block v0 while Studio desktop packages are available
and Runtime release manifest evidence is checksummed and otherwise satisfies
the compatibility gates.
