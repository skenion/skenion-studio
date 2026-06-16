import type { CSSProperties } from "react";
import type { NodePortSide } from "./nodeTypes";

export function NodePortHandle({
  color,
  side
}: {
  color: string;
  side: NodePortSide;
}) {
  return (
    <span
      aria-hidden="true"
      className={`node-port-dot node-port-dot-${side}`}
      style={{ "--port-color": color } as CSSProperties}
    />
  );
}
