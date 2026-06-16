import type { CSSProperties } from "react";
import { NodeHeader } from "./NodeHeader";
import { NodePortColumn } from "./NodePortColumn";
import type { NodeCardView, NodePortHandleRenderer } from "./nodeTypes";

export interface NodeCardProps extends NodeCardView {
  renderInputHandle?: NodePortHandleRenderer;
  renderOutputHandle?: NodePortHandleRenderer;
}

export function NodeCard({
  accentColor = "#868e96",
  inputs,
  kind,
  label,
  outputs,
  renderInputHandle,
  renderOutputHandle,
  selected,
  typeBadgeLabel
}: NodeCardProps) {
  const style = { "--node-accent": accentColor } as CSSProperties;

  return (
    <div className={`canvas-node ${selected ? "is-selected" : ""}`} style={style}>
      <div className="canvas-node-body">
        <NodeHeader kind={kind} label={label} typeBadgeLabel={typeBadgeLabel} />
        <div className="canvas-node-ports">
          <NodePortColumn ports={inputs} renderHandle={renderInputHandle} side="input" />
          <NodePortColumn ports={outputs} renderHandle={renderOutputHandle} side="output" />
        </div>
      </div>
    </div>
  );
}
