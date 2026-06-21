import { useEffect, useState, type KeyboardEvent } from "react";
import { NumberInput, type NumberInputProps } from "@mantine/core";

type NumberDraft = number | string;

export interface DeferredNumberInputProps
  extends Omit<NumberInputProps, "onBlur" | "onChange" | "onKeyDown" | "value"> {
  normalize?: (value: number) => number;
  onCommit: (value: number) => void;
  value: number;
}

export function DeferredNumberInput({
  normalize = (value) => value,
  onCommit,
  value,
  ...props
}: DeferredNumberInputProps) {
  const [draft, setDraft] = useState<NumberDraft>(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commitDraft = () => {
    const parsedValue = finiteNumberFromDraft(draft);
    if (parsedValue === null) {
      setDraft(value);
      return;
    }

    const nextValue = normalize(parsedValue);
    if (!Number.isFinite(nextValue)) {
      setDraft(value);
      return;
    }

    setDraft(nextValue);
    if (!Object.is(nextValue, value)) {
      onCommit(nextValue);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitDraft();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setDraft(value);
    }
  };

  return (
    <NumberInput
      {...props}
      onBlur={commitDraft}
      onChange={setDraft}
      onKeyDown={handleKeyDown}
      value={draft}
    />
  );
}

export function finiteNumberFromDraft(value: NumberDraft): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (value.trim() === "") {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}
