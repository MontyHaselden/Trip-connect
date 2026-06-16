"use client";

function ShieldIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      className="h-6 w-6 shrink-0 text-red-700"
      aria-hidden
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export function EmergencyCardBanner(props: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onOpen}
      className="student-emergency-banner flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left"
    >
      <ShieldIcon />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-red-950">Emergency card</span>
        <span className="mt-0.5 block text-xs text-red-800/80">
          Show this if you need help
        </span>
      </span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="h-4 w-4 shrink-0 text-red-700/70"
        aria-hidden
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>
  );
}
