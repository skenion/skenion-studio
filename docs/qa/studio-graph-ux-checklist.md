# Studio Graph UX Visual Gate

This checklist blocks new graph features until the node editor is visually and mechanically reviewable.

## Artifact Generation

Run:

```bash
pnpm run visual-gate
```

Expected output:

- `artifacts/studio-visual-gate/shader-uniform-sample.png`
- `artifacts/studio-visual-gate/shader-multi-uniform-sample.png`
- `artifacts/studio-visual-gate/port-demo-sample.png`
- `artifacts/studio-visual-gate/project-saved-layout.png`
- `artifacts/studio-visual-gate/object-visual-objects.png`
- `artifacts/studio-visual-gate/object-visual-pan-drag.png`
- `artifacts/studio-visual-gate/nodecard-float-value.png`
- `artifacts/studio-visual-gate/nodecard-fullscreen-shader.png`
- `artifacts/studio-visual-gate/nodecard-render-output.png`
- `artifacts/studio-visual-gate/shader-diagnostics-panel.png`
- `artifacts/studio-visual-gate/help-panel-value-f32.png`
- `artifacts/studio-visual-gate/help-graph-value-bang-set.png`
- `artifacts/studio-visual-gate/invalid-connection.png`
- `artifacts/studio-visual-gate/selected-edge.png`
- `artifacts/studio-visual-gate/many-port-node.png`

Visual gate screenshots are reviewed locally with the Studio/Storybook context
open. They are intentionally not uploaded by default GitHub CI.

## Manual Review

Review the generated screenshots and, when a behavior check is needed, run:

```bash
pnpm run storybook
```

Required checks:

- IN and OUT columns are visible on every connectable node.
- Port dots are not clipped by node borders.
- Port dots stay aligned with their port rows.
- Edges start at OUT dots and end at IN dots.
- Compatible drags can connect from outlet to inlet.
- Incompatible drags are rejected before commit.
- Invalid connection diagnostics identify the source, target, and mismatch.
- Selected edges are visually distinct from normal edges.
- Delete and Backspace remove the selected edge.
- Zoom and pan keep port labels, dots, and edge labels readable.
- The shader uniform sample clearly shows `Float Value.value -> Fullscreen Shader.speed -> Render Output.in`.
- The shader multi-uniform sample clearly shows `speed`, `phase`, and `tint` inputs wired into `Fullscreen Shader`.
- The port demo sample clearly distinguishes value, event, and render-frame cables.
- The project saved layout sample keeps its saved node positions and viewport rather than auto-layouting.
- The many-port node keeps rows stable without text overlap.

## Merge Rule

Do not merge a new graph feature PR if:

- `pnpm run visual-gate` has not been run for a graph editor visual change.
- Any required screenshot shows clipped handles, unclear IN/OUT orientation, or ambiguous edge attachment.
- A manual Storybook check finds an invalid connection committed to the graph.
