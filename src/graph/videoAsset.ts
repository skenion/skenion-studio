import type { DisplayGraphNodeV01 } from "./patchLibrary";

export const VIDEO_ASSET_NODE_KIND = "core.video-asset";
export const DEFAULT_VIDEO_ASSET_WIDTH = 320;
export const DEFAULT_VIDEO_ASSET_HEIGHT = 240;
export const MIN_VIDEO_ASSET_WIDTH = 96;
export const MIN_VIDEO_ASSET_HEIGHT = 72;
export const MAX_VIDEO_ASSET_WIDTH = 960;
export const MAX_VIDEO_ASSET_HEIGHT = 720;

export interface VideoAssetParams {
  assetRef: string;
  name: string;
  mimeType: string;
  width: number;
  height: number;
  aspectRatio: number;
  sourceWidth: number;
  sourceHeight: number;
  thumbnailDataUrl: string;
}

export function isVideoAssetNode(node: DisplayGraphNodeV01 | null): node is DisplayGraphNodeV01 {
  return node?.kind === VIDEO_ASSET_NODE_KIND;
}

export function defaultVideoAssetParams(): Record<string, unknown> {
  return {
    assetRef: "",
    aspectRatio: DEFAULT_VIDEO_ASSET_WIDTH / DEFAULT_VIDEO_ASSET_HEIGHT,
    height: DEFAULT_VIDEO_ASSET_HEIGHT,
    name: "",
    mimeType: "",
    sourceHeight: 0,
    sourceWidth: 0,
    thumbnailDataUrl: "",
    width: DEFAULT_VIDEO_ASSET_WIDTH
  };
}

export function readVideoAssetParams(node: DisplayGraphNodeV01): VideoAssetParams {
  const width = finiteNumberParam(node.params.width, DEFAULT_VIDEO_ASSET_WIDTH);
  const height = finiteNumberParam(node.params.height, DEFAULT_VIDEO_ASSET_HEIGHT);
  const aspectRatio = finiteNumberParam(
    node.params.aspectRatio,
    width > 0 && height > 0 ? width / height : DEFAULT_VIDEO_ASSET_WIDTH / DEFAULT_VIDEO_ASSET_HEIGHT
  );

  return {
    assetRef: typeof node.params.assetRef === "string" ? node.params.assetRef : "",
    aspectRatio,
    height: clampDimension(height, MIN_VIDEO_ASSET_HEIGHT, MAX_VIDEO_ASSET_HEIGHT),
    name: typeof node.params.name === "string" ? node.params.name : "",
    mimeType: typeof node.params.mimeType === "string" ? node.params.mimeType : "",
    sourceHeight: finiteNumberParam(node.params.sourceHeight, 0),
    sourceWidth: finiteNumberParam(node.params.sourceWidth, 0),
    thumbnailDataUrl: typeof node.params.thumbnailDataUrl === "string" ? node.params.thumbnailDataUrl : "",
    width: clampDimension(width, MIN_VIDEO_ASSET_WIDTH, MAX_VIDEO_ASSET_WIDTH)
  };
}

export function fitVideoAssetSizeToAspectRatio(
  aspectRatio: number,
  maxWidth = DEFAULT_VIDEO_ASSET_WIDTH,
  maxHeight = DEFAULT_VIDEO_ASSET_HEIGHT
): { width: number; height: number } {
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) {
    return {
      width: maxWidth,
      height: maxHeight
    };
  }

  const maxRatio = maxWidth / maxHeight;
  if (aspectRatio >= maxRatio) {
    return {
      width: maxWidth,
      height: Math.round(maxWidth / aspectRatio)
    };
  }

  return {
    width: Math.round(maxHeight * aspectRatio),
    height: maxHeight
  };
}

export function videoAssetSizeForSource(sourceWidth: number, sourceHeight: number): {
  aspectRatio: number;
  height: number;
  width: number;
} {
  const aspectRatio =
    Number.isFinite(sourceWidth) && sourceWidth > 0 && Number.isFinite(sourceHeight) && sourceHeight > 0
      ? sourceWidth / sourceHeight
      : DEFAULT_VIDEO_ASSET_WIDTH / DEFAULT_VIDEO_ASSET_HEIGHT;
  return {
    aspectRatio,
    ...fitVideoAssetSizeToAspectRatio(aspectRatio)
  };
}

function finiteNumberParam(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampDimension(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}
