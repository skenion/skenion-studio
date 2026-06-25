# @skenion/studio-desktop

Release metadata for signed skenion studio desktop releases.

This private workspace package is used only by GitHub Actions from a canonical
`vx.y.z` Studio release tag. It does not rebuild runtime and does not
contain desktop binaries. The generated `studio-desktop-manifest.json` names
the Studio release tag, `@skenion/contracts` compatibility line/range, the
real Tauri installer artifacts that publish to DSUB S3, and the exact Runtime
raw-binary release evidence that desktop packaging consumes before staging the
Tauri external Runtime binary. Public desktop package IDs use product-facing
names such as `macos-apple-silicon`, `windows-x64`, `linux-x64-deb`, and
`linux-x64-rpm`; Rust target triples remain internal workflow inputs only.
Public installer filenames include the Studio version, for example
`skenion-studio-vx.y.z-macos-apple-silicon.dmg`,
`skenion-studio-vx.y.z-windows-x64-setup.exe`, and
`skenion-studio-vx.y.z-linux-x64.deb`.

Do not publish this package to npm. skenion studio desktop is distributed as
desktop installer artifacts from DSUB S3. The GitHub Release body records the
DSUB download and checksum links instead of using GitHub Release assets as
artifact evidence.
