# @skenion/studio-desktop

Versioned npm metadata artifact for Skenion Studio desktop releases.

The package is published only by GitHub Actions from a `skenion-studio-vx.y.z`
release tag. It does not rebuild Runtime and does not contain desktop binaries.
The generated `studio-desktop-manifest.json` names the same-train Studio release,
the exact `@skenion/contracts` version, and the Runtime sidecar release assets
that the desktop GitHub Release is expected to consume.

Do not publish this package from a local machine.
