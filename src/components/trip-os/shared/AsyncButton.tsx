"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

function Spinner() {
  return (
    <span
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
      aria-hidden
    />
  );
}

export function AsyncButton(
  props: ButtonHTMLAttributes<HTMLButtonElement> & {
    loading?: boolean;
    loadingLabel?: string;
    children: ReactNode;
  },
) {
  const { loading, loadingLabel = "Saving…", children, className = "", disabled, ...rest } = props;

  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      className={[
        "inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      ].join(" ")}
    >
      {loading ? (
        <>
          <Spinner />
          <span>{loadingLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
