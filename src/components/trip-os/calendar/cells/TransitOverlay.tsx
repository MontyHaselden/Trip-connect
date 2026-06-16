import type { TransitOverlay as TransitOverlayType } from "@/lib/host/wizard/transport-day-placement";

export function TransitOverlay(props: { overlays: TransitOverlayType[] }) {
  if (!props.overlays.length) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-5 z-[12] flex flex-col gap-0.5 px-1">
      {props.overlays.map((overlay, i) => (
        <span
          key={`transit-${i}`}
          className="truncate rounded bg-indigo-100/90 px-1 py-0.5 text-center text-[8px] font-semibold text-indigo-900"
          title={overlay.label}
        >
          {overlay.label}
        </span>
      ))}
    </div>
  );
}
