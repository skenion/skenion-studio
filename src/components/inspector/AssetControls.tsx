import { Alert, FileButton, Stack, Text, TextInput } from "@mantine/core";
import { Upload } from "lucide-react";
import { readVideoAssetParams } from "../../graph/videoAsset";
import type { DisplayGraphNodeV01 } from "../../graph/patchLibrary";
import { Button } from "../core/Button/Button";

export interface AssetControlsProps {
  busy?: boolean;
  enabled: boolean;
  node: DisplayGraphNodeV01;
  onImportAsset?: (node: DisplayGraphNodeV01, file: File) => Promise<void>;
}

export function AssetControls({
  busy = false,
  enabled,
  node,
  onImportAsset
}: AssetControlsProps) {
  const asset = readVideoAssetParams(node);

  return (
    <Stack gap="xs">
      <Text c="dimmed" fw={700} size="xs" tt="uppercase">
        Asset
      </Text>
      <TextInput label="Asset ref" readOnly size="xs" value={asset.assetRef} />
      <TextInput label="Name" readOnly size="xs" value={asset.name} />
      <TextInput label="MIME type" readOnly size="xs" value={asset.mimeType} />
      <TextInput label="Display size" readOnly size="xs" value={`${asset.width} x ${asset.height}`} />
      <TextInput
        label="Source ratio"
        readOnly
        size="xs"
        value={asset.sourceWidth > 0 && asset.sourceHeight > 0 ? `${asset.sourceWidth}:${asset.sourceHeight}` : ""}
      />
      {!enabled ? (
        <Alert color="yellow" variant="light">
          Runtime connection is required to import local assets.
        </Alert>
      ) : null}
      {!asset.assetRef ? (
        <Alert color="yellow" variant="light">
          This asset node has no imported runtime asset reference.
        </Alert>
      ) : null}
      <FileButton
        accept="video/*"
        disabled={!enabled || busy || !onImportAsset}
        onChange={(file) => {
          if (file && onImportAsset) {
            void onImportAsset(node, file);
          }
        }}
      >
        {(props) => (
          <Button
            disabled={!enabled || busy || !onImportAsset}
            leftSection={<Upload size={15} />}
            loading={busy}
            size="compact-sm"
            variant="light"
            {...props}
          >
            Import video asset
          </Button>
        )}
      </FileButton>
      <Text c="dimmed" size="xs">
        Import stores a Runtime assetRef on this node.
      </Text>
    </Stack>
  );
}
