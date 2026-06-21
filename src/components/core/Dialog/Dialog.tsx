import type { ReactNode } from "react";
import { Group, Modal, ScrollArea, Text, type ModalProps } from "@mantine/core";
import { X } from "lucide-react";
import { IconButton } from "../IconButton/IconButton";

export interface DialogProps extends Omit<ModalProps, "children" | "closeButtonProps" | "title" | "withCloseButton"> {
  children: ReactNode;
  closeLabel?: string;
  title: ReactNode;
}

export function Dialog({
  children,
  closeLabel = "Close dialog",
  onClose,
  title,
  ...props
}: DialogProps) {
  return (
    <Modal
      onClose={onClose}
      title={
        <Group justify="space-between" wrap="nowrap">
          <Text fw={800} size="lg">
            {title}
          </Text>
          <IconButton icon={<X size={16} />} label={closeLabel} onClick={onClose} size="sm" />
        </Group>
      }
      withCloseButton={false}
      {...props}
    >
      <ScrollArea.Autosize mah="78vh" offsetScrollbars>
        {children}
      </ScrollArea.Autosize>
    </Modal>
  );
}
