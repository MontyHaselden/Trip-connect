"use client";

import type { InputHTMLAttributes } from "react";

export function TripDateInput(
  props: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
    value: string;
    onChange: (value: string) => void;
    tripStart?: string;
    tripEnd?: string;
    /** Opens the picker on this month when the field is still empty. */
    anchorDate?: string;
    /** When false, any date is selectable — used when the field sets trip bounds (e.g. flights). */
    restrictToTripBounds?: boolean;
  },
) {
  const {
    value,
    onChange,
    tripStart,
    tripEnd,
    anchorDate,
    restrictToTripBounds = true,
    className,
    onFocus,
    ...rest
  } = props;

  function handleFocus(event: React.FocusEvent<HTMLInputElement>) {
    if (!value.trim() && anchorDate?.trim()) {
      onChange(anchorDate);
    }
    onFocus?.(event);
  }

  return (
    <input
      type="date"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      min={restrictToTripBounds ? tripStart : undefined}
      max={restrictToTripBounds ? tripEnd : undefined}
      onFocus={handleFocus}
      className={className}
      {...rest}
    />
  );
}
