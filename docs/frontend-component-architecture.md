# Skenion Studio Frontend Component Architecture

Skenion Studio keeps graph semantics separate from the visual canvas integration. Components that render node, port, inspector, runtime, or telemetry state should be reusable without a running Runtime server and without React Flow context.

## Component Boundaries

- `src/components/node/*` contains pure node UI.
- `NodeCard` renders the node shell, header, and input/output port columns.
- `NodePortRow` renders port label, type, tooltip metadata, compatibility states, and a handle slot.
- `NodePortHandle` is only a visual placeholder for pure component rendering and Storybook.
- React Flow `Handle` usage belongs only in `src/components/graph/ReactFlowNodeAdapter.tsx`.
- `src/graph/nodeCardView.ts` converts Skenion graph nodes into pure `NodeCardView` data.
- `GraphCanvas` owns React Flow state wiring and calls the adapter-generated view model.

## Inspector Panels

`InspectorPanel` composes smaller pure panels:

- `InspectorShell`
- `GraphDiagnosticsPanel`
- `ConnectionDiagnosticsPanel`
- `NodeInspector`
- `PortTable`
- `ClearColorControls`
- `FullscreenShaderControls`
- `EdgeInspector`
- `FeedbackPolicyDialog`

Inspector controls should receive graph/node/edge data and callbacks as props. They should not read React Flow state directly.

## Runtime Panels

`RuntimePanel` composes smaller pure panels:

- `RuntimeConnectionPanel`
- `RuntimeSessionPanel`
- `RuntimePreviewPanel`
- `RuntimeTelemetryPanel`
- `RuntimePatchPanel`
- `RuntimeHistoryPanel`
- `RuntimeStatelessToolsPanel`
- `RuntimeResultSummary`

Runtime subpanels do not create runtime clients. Network orchestration stays in the app state layer, and panels receive status, payload summaries, diagnostics, and callbacks as props.

## Storybook Policy

Storybook is the visual QA surface for component states that are hard to inspect reliably inside the full app.

- Prefer pure component stories first.
- Keep React Flow integration stories separate under `Graph/ReactFlowCanvas`.
- Cover zero-port, single-port, multi-port, selected, compatible, incompatible, feedback, conflict, stale preview, and telemetry states.
- Do not persist node positions, viewport zoom, selections, or panel layout as graph contract state.
- Do not use Storybook stories to hide missing runtime validation. Stories should show the current prop state only.

## Commands

```bash
pnpm run storybook
pnpm run build-storybook
pnpm run ci
```

`pnpm run ci` includes lint, coverage, app build, and Storybook build.
