# @skenion/studio-desktop

Release metadata for signed skenion studio desktop releases.

This private workspace package is used only by GitHub Actions from a
`skenion-studio-vx.y.z` release tag. It does not rebuild runtime and does not
contain desktop binaries. The generated `studio-desktop-manifest.json` names
the same-train studio release, the exact `@skenion/contracts` version, the
canonical `skenion-studio-<target>` desktop package archives, and the runtime
sidecar release assets that the desktop GitHub Release is expected to consume.

Do not publish this package to npm. skenion studio desktop is distributed as
signed desktop release artifacts.
