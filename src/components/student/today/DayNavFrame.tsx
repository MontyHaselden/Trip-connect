"use client";

export function DayNavFrame(props: {
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  children: React.ReactNode;
}) {
  const { canGoPrev, canGoNext, onPrev, onNext, children } = props;

  return (
    <div className="relative">
      {canGoPrev ? (
        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous day"
          className="absolute -left-3 top-24 z-10 flex h-12 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-xl font-medium text-zinc-800 shadow-sm"
        >
          ‹
        </button>
      ) : null}
      {canGoNext ? (
        <button
          type="button"
          onClick={onNext}
          aria-label="Next day"
          className="absolute -right-3 top-24 z-10 flex h-12 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-xl font-medium text-zinc-800 shadow-sm"
        >
          ›
        </button>
      ) : null}
      <div className={canGoPrev || canGoNext ? "px-1" : undefined}>{children}</div>
    </div>
  );
}
