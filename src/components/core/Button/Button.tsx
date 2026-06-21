import { forwardRef } from "react";
import {
  Button as MantineButton,
  createPolymorphicComponent,
  type ButtonProps as MantineButtonProps
} from "@mantine/core";
import styles from "./Button.module.css";

export type ButtonIntent = "neutral" | "primary" | "danger";

export interface ButtonProps extends Omit<MantineButtonProps, "radius"> {
  intent?: ButtonIntent;
  selected?: boolean;
}

function intentColor(intent: ButtonIntent) {
  switch (intent) {
    case "danger":
      return "red";
    case "primary":
      return "blue";
    case "neutral":
    default:
      return "gray";
  }
}

function ButtonInner(
  {
    className,
    color,
    intent = "neutral",
    selected = false,
    variant = "subtle",
    ...props
  }: ButtonProps,
  ref: React.ForwardedRef<HTMLButtonElement>
) {
  return (
    <MantineButton
      color={color ?? intentColor(intent)}
      className={[styles.button, className].filter(Boolean).join(" ")}
      data-selected={selected || undefined}
      data-skenion-core-button="button"
      ref={ref}
      variant={variant}
      {...props}
    />
  );
}

const ButtonBase = forwardRef<HTMLButtonElement, ButtonProps>(ButtonInner);

ButtonBase.displayName = "Button";

export const Button = createPolymorphicComponent<"button", ButtonProps>(ButtonBase);
