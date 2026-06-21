import { forwardRef, type ReactNode } from "react";
import { ActionIcon, createPolymorphicComponent, type ActionIconProps } from "@mantine/core";
import styles from "./IconButton.module.css";

export type IconButtonAccessibleName =
  | { label: string; "aria-label"?: never; "aria-labelledby"?: never }
  | { label?: never; "aria-label": string; "aria-labelledby"?: never }
  | { label?: never; "aria-label"?: never; "aria-labelledby": string };

export type IconButtonProps = Omit<ActionIconProps, "aria-label" | "aria-labelledby" | "children" | "radius"> &
  IconButtonAccessibleName & {
    icon: ReactNode;
    selected?: boolean;
  };

function IconButtonInner(
  {
    className,
    color,
    icon,
    label,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    selected = false,
    size = "lg",
    variant = "subtle",
    ...props
  }: IconButtonProps,
  ref: React.ForwardedRef<HTMLButtonElement>
) {
  return (
    <ActionIcon
      aria-label={ariaLabel ?? label}
      aria-labelledby={ariaLabelledBy}
      className={[styles.iconButton, className].filter(Boolean).join(" ")}
      color={color ?? "gray"}
      data-skenion-core-button="icon"
      data-selected={selected || undefined}
      ref={ref}
      size={size}
      variant={variant}
      {...props}
    >
      {icon}
    </ActionIcon>
  );
}

const IconButtonBase = forwardRef<HTMLButtonElement, IconButtonProps>(IconButtonInner);

IconButtonBase.displayName = "IconButton";

export const IconButton = createPolymorphicComponent<"button", IconButtonProps>(IconButtonBase);
