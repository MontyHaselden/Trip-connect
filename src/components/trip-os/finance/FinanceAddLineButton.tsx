"use client";

export function FinanceAddLineButton(props: { onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        props.onClick();
      }}
      title={props.title}
      className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-violet-600 text-white hover:bg-violet-700"
    >
      <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden>
        <path
          d="M8 3.5v9M3.5 8h9"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
