import type { EdgeV01, GraphDocumentV01, GraphNodeV01, PortV01 } from "@skenion/contracts";

// React Flow still consumes the legacy graph-shaped canvas model. The active
// Studio document remains ProjectDocumentV02; these aliases name the temporary
// display adapter boundary so new authoring/collab code does not treat it as
// the persisted graph contract.
export type GraphDisplayDocument = GraphDocumentV01;
export type GraphDisplayNode = GraphNodeV01;
export type GraphDisplayEdge = EdgeV01;
export type GraphDisplayPort = PortV01;
