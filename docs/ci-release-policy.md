# Skenion Studio CI and Release Policy

Studio treats graph UX and runtime-compatibility gates as release-relevant behavior. A change that makes a gate stricter, changes canonical builtin consumption, or changes the graph editing contract should ship as a real patch or minor release through Release Please.

## CI Jobs

- Unit: lint and coverage.
- Build: TypeScript and Vite production build.
- Visual Gate: Storybook static build and Playwright screenshot capture.

The Visual Gate job must upload `artifacts/studio-visual-gate` and must fail if expected PNG artifacts are missing or empty. Missing visual artifacts are not warnings, because downstream graph UX approval depends on those screenshots.

## Visual Gate Artifacts

The visual gate is expected to generate exactly nine PNG artifacts:

- `shader-uniform-sample.png`
- `shader-multi-uniform-sample.png`
- `port-demo-sample.png`
- `nodecard-float-value.png`
- `nodecard-fullscreen-shader.png`
- `nodecard-render-output.png`
- `invalid-connection.png`
- `selected-edge.png`
- `many-port-node.png`

`pnpm run ci` remains the local full gate and includes lint, coverage, build, Storybook build, and visual capture.

## Release Hygiene

Do not bump `package.json` manually to describe compatibility. Use Conventional Commits and let Release Please produce the version bump.

- `fix(studio): ...` for behavior, compatibility, or quality-gate changes that should produce a patch release.
- `feat(studio): ...` for user-visible graph/runtime capabilities.
- `test(studio): ...` and `ci(studio): ...` only when no release note or version signal is needed.

The canonical builtin registry migration is compatibility-affecting. If the current published Studio version predates that migration, the next Studio release notes should explicitly mention that Studio consumes canonical builtin node definitions from `@skenion/contracts`.
