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

## Required Story Checklist

Node and port stories should cover:

- zero-port nodes
- single-input nodes
- single-output nodes
- nodes with both input and output ports
- nodes with many ports
- selected node state
- long labels and long port names
- current 0.1 contract metadata such as rate, max connections, merge policy, fan-out policy, and trigger mode
- feedback-looking ports or previous-frame feedback surfaces
- value number, event bang, render frame, and GPU texture/resource port rows
- required input ports
- fan-in allowed and fan-in rejected states
- compatible and incompatible connection states

Runtime stories should cover:

- disconnected runtime
- connected runtime
- loaded session
- pending patch
- patch conflict
- preview running
- preview stale
- telemetry render error

Inspector stories should cover:

- valid graph diagnostics
- invalid graph diagnostics
- edge inspector metadata
- clear color controls
- fullscreen shader controls
- feedback policy dialog

New Studio UI work should either add the relevant story state in the same PR or explicitly explain why the state is not representable yet.

## Commands

```bash
pnpm run storybook
pnpm run build-storybook
pnpm run ci
pnpm run visual-gate
```

`pnpm run ci` includes lint, coverage, and the app build. `pnpm run visual-gate`
is the explicit Storybook screenshot review pass for graph editor changes.
