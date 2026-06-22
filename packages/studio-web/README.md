# @skenion/studio-web

Versioned npm artifact for the Skenion Studio web build.

The package is published only by GitHub Actions from a `skenion-studio-vx.y.z`
release tag. It contains the Vite static build under `dist/` and a generated
`studio-web-manifest.json` that records the lockstep Studio train and exact
`@skenion/contracts` version used for the build.

Do not publish this package from a local machine.
