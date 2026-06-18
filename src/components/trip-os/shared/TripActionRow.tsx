"use client";

import type { ReactNode } from "react";

const ACCENT: Record<string, string> = {
  violet: "bg-violet-500 shadow-violet-500/30",
  sky: "bg-sky-500 shadow-sky-500/30",
  indigo: "bg-indigo-500 shadow-indigo-500/30",
  zinc: "bg-zinc-400 shadow-zinc-400/20",
};

function ActionIcon({ kind }: { kind: "pin" | "stay" | "import" | "plane" }) {
  const paths: Record<string, ReactNode> = {
    pin: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z M12 21s6-4.5 6-9a6 6 0 1 0-12 0c0 4.5 6 9 6 9Z"
      />
    ),
    stay: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 21V8l9-4 9 4v13M9 21V12h6v9"
      />
    ),
    import: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z"
      />
    ),
    plane: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
      />
    ),
  };

  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      {paths[kind]}
    </svg>
  );
}

export function TripActionRow(props: {
  label: string;
  hint: string;
  accent?: keyof typeof ACCENT;
  icon?: "pin" | "stay" | "import" | "plane";
  onClick?: () => void;
}) {
  const accent = props.accent ?? "violet";
  const body = (
    <>
      {props.icon ? (
        <span
          className={[
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg",
            ACCENT[accent],
          ].join(" ")}
        >
          <ActionIcon kind={props.icon} />
        </span>
      ) : (
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-zinc-900">{props.label}</span>
        <span className="mt-0.5 block text-sm leading-snug text-zinc-500">{props.hint}</span>
      </span>
      {props.onClick ? (
        <span className="shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-violet-400">
          →
        </span>
      ) : null}
    </>
  );

  if (props.onClick) {
    return (
      <button
        type="button"
        onClick={props.onClick}
        className="group flex w-full items-center gap-4 rounded-2xl px-2 py-3 text-left transition hover:bg-zinc-50/80"
      >
        {body}
      </button>
    );
  }

  return <div className="flex items-center gap-4 px-2 py-3">{body}</div>;
}
