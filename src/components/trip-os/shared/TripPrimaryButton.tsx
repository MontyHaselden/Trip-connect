import type { ButtonHTMLAttributes } from "react";

export function TripPrimaryButton(
  props: ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "dark" | "violet" | "ghost";
    size?: "sm" | "md";
  },
) {
  const { variant = "dark", size = "md", className, children, ...rest } = props;
  const sizes = size === "sm" ? "h-9 px-4 text-sm" : "h-10 px-5 text-sm";
  const variants =
    variant === "violet"
      ? "bg-violet-600 text-white hover:bg-violet-700"
      : variant === "ghost"
        ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
        : "bg-zinc-900 text-white hover:bg-zinc-800";

  return (
    <button
      type="button"
      className={[
        "inline-flex items-center justify-center rounded-full font-medium transition",
        sizes,
        variants,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}
