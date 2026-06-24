# @skenion/studio-desktop

Release metadata for signed skenion studio desktop releases.

This private workspace package is used only by GitHub Actions from a canonical
`vx.y.z` Studio release tag. It does not rebuild runtime and does not
contain desktop binaries. The generated `studio-desktop-manifest.json` names
the Studio release tag, `@skenion/contracts` compatibility line/range, the
canonical `skenion-studio-<target>` desktop package archives, and the exact
Runtime release artifact manifests that desktop packaging consumes before
staging the Tauri external Runtime binary.

Do not publish this package to npm. skenion studio desktop is distributed as
signed desktop release artifacts.
