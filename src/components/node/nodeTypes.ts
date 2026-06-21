import type { ReactNode } from "react";

export type NodePortSide = "input" | "output";

export interface NodePortView {
  id: string;
  label: string;
  description?: string;
  direction: NodePortSide;
  typeLabel: string;
  storedTypeLabel?: string;
  color: string;
  metadata?: {
    rate?: string;
    maxConnections?: number | null;
    mergePolicy?: string;
    fanOutPolicy?: string;
    triggerMode?: string;
    required?: boolean;
  };
}

export interface NodeCardView {
  id: string;
  label: string;
  kind: string;
  kindVersion: string;
  selected?: boolean;
  accentColor?: string;
  typeBadgeLabel?: string;
  inputs: NodePortView[];
  outputs: NodePortView[];
}

export type NodePortHandleRenderer = (port: NodePortView, side: NodePortSide) => ReactNode;
