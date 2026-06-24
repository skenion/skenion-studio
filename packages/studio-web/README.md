# @skenion/studio-web

Release metadata for the skenion studio web bundle.

This private workspace package is used only by GitHub Actions from a canonical
`vx.y.z` Studio release tag. It stages the Vite static build under
`dist/` and a generated `studio-web-manifest.json` that records the Studio
release tag, `@skenion/contracts` compatibility line/range, web-bundle
tarball name, DSUB release storage path/URL, and web-bundle checksum asset used
for the build.

Do not publish this package to npm. skenion studio web is distributed as a
deployable DSUB web bundle product artifact; the GitHub Release keeps only the
compact DSUB artifact index.
