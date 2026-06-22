import { describe, expect, it } from "vitest";
import type { DisplayGraphNodeV01 as GraphNodeV01 } from "./patchLibrary";
import {
  DEFAULT_VIDEO_ASSET_HEIGHT,
  DEFAULT_VIDEO_ASSET_WIDTH,
  VIDEO_ASSET_NODE_KIND,
  defaultVideoAssetParams,
  fitVideoAssetSizeToAspectRatio,
  isVideoAssetNode,
  readVideoAssetParams,
  videoAssetSizeForSource
} from "./videoAsset";

describe("video asset graph helpers", () => {
  it("identifies video asset nodes and creates default params", () => {
    const node = videoAssetNode({
      assetRef: "skenion-runtime://assets/asset_1",
      name: "clip.mov",
      mimeType: "video/quicktime"
    });

    expect(isVideoAssetNode(node)).toBe(true);
    expect(isVideoAssetNode({ ...node, kind: "core.comment" })).toBe(false);
    expect(isVideoAssetNode(null)).toBe(false);
    expect(defaultVideoAssetParams()).toEqual({
      assetRef: "",
      aspectRatio: DEFAULT_VIDEO_ASSET_WIDTH / DEFAULT_VIDEO_ASSET_HEIGHT,
      height: DEFAULT_VIDEO_ASSET_HEIGHT,
      name: "",
      mimeType: "",
      sourceHeight: 0,
      sourceWidth: 0,
      thumbnailDataUrl: "",
      width: DEFAULT_VIDEO_ASSET_WIDTH
    });
  });

  it("reads asset params with sanitized display metadata", () => {
    expect(
      readVideoAssetParams(
        videoAssetNode({
          assetRef: "skenion-runtime://assets/asset_1",
          aspectRatio: 16 / 9,
          height: 180,
          name: "clip.mp4",
          mimeType: "video/mp4",
          sourceHeight: 1080,
          sourceWidth: 1920,
          thumbnailDataUrl: "data:image/jpeg;base64,abc",
          width: 320
        })
      )
    ).toEqual({
      assetRef: "skenion-runtime://assets/asset_1",
      aspectRatio: 16 / 9,
      height: 180,
      name: "clip.mp4",
      mimeType: "video/mp4",
      sourceHeight: 1080,
      sourceWidth: 1920,
      thumbnailDataUrl: "data:image/jpeg;base64,abc",
      width: 320
    });

    expect(readVideoAssetParams(videoAssetNode({ assetRef: false, name: 42, mimeType: null }))).toEqual({
      assetRef: "",
      aspectRatio: DEFAULT_VIDEO_ASSET_WIDTH / DEFAULT_VIDEO_ASSET_HEIGHT,
      height: DEFAULT_VIDEO_ASSET_HEIGHT,
      name: "",
      mimeType: "",
      sourceHeight: 0,
      sourceWidth: 0,
      thumbnailDataUrl: "",
      width: DEFAULT_VIDEO_ASSET_WIDTH
    });
    expect(readVideoAssetParams(videoAssetNode({ height: 0, width: 0 })).aspectRatio).toBe(
      DEFAULT_VIDEO_ASSET_WIDTH / DEFAULT_VIDEO_ASSET_HEIGHT
    );
  });

  it("fits loaded video dimensions inside the default asset box", () => {
    expect(videoAssetSizeForSource(1920, 1080)).toEqual({
      aspectRatio: 16 / 9,
      height: 180,
      width: 320
    });
    expect(videoAssetSizeForSource(1080, 1920)).toEqual({
      aspectRatio: 1080 / 1920,
      height: 240,
      width: 135
    });
    expect(fitVideoAssetSizeToAspectRatio(1)).toEqual({
      height: 240,
      width: 240
    });
    expect(fitVideoAssetSizeToAspectRatio(0)).toEqual({
      height: DEFAULT_VIDEO_ASSET_HEIGHT,
      width: DEFAULT_VIDEO_ASSET_WIDTH
    });
    expect(videoAssetSizeForSource(0, 1080)).toEqual({
      aspectRatio: DEFAULT_VIDEO_ASSET_WIDTH / DEFAULT_VIDEO_ASSET_HEIGHT,
      height: DEFAULT_VIDEO_ASSET_HEIGHT,
      width: DEFAULT_VIDEO_ASSET_WIDTH
    });
  });
});

function videoAssetNode(params: Record<string, unknown>): GraphNodeV01 {
  return {
    id: "asset_1",
    kind: VIDEO_ASSET_NODE_KIND,
    kindVersion: "0.1.0",
    params,
    ports: []
  };
}
