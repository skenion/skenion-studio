# @skenion/studio-web

Release metadata for the skenion studio web bundle.

This private workspace package is used only by GitHub Actions from a
`skenion-studio-vx.y.z` release tag. It stages the Vite static build under
`dist/` and a generated `studio-web-manifest.json` that records the lockstep
studio train, exact `@skenion/contracts` version, web bundle tarball name, and
web bundle checksum asset used for the build.

Do not publish this package to npm. skenion studio web is distributed as a
deployable web bundle product artifact.
