import { forwardRef, type InputHTMLAttributes } from "react";

type TripInputVariant = "pill" | "ghost" | "hero";

/** Shared class for date inputs, pickers, and textareas in Trip OS panels */
export const tripFieldClass =
  "w-full rounded-full border-0 bg-zinc-100 px-4 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-violet-500/30";

export const TripInput = forwardRef(function TripInput(
  props: InputHTMLAttributes<HTMLInputElement> & {
    variant?: TripInputVariant;
    label?: string;
  },
  ref: React.Ref<HTMLInputElement>,
) {
  const { variant = "pill", label, className, ...rest } = props;
  const base =
    variant === "hero"
      ? "w-full border-0 bg-transparent text-[2rem] font-semibold leading-tight tracking-tight text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-0"
      : variant === "ghost"
        ? "w-full border-0 bg-transparent text-3xl font-semibold tracking-tight text-zinc-900 focus:outline-none focus:ring-0"
        : "w-full rounded-full border-0 bg-zinc-100 px-4 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30";

  return (
    <label className="block">
      {label ? <span className="mb-1 block text-sm font-medium text-zinc-700">{label}</span> : null}
      <input ref={ref} className={[base, className].filter(Boolean).join(" ")} {...rest} />
    </label>
  );
});
