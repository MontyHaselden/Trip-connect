import type { TransitOverlay as TransitOverlayType } from "@/lib/host/wizard/transport-day-placement";

export const TRANSIT_BAR_HEIGHT = "1.375rem";

function primaryOverlayLabel(overlays: TransitOverlayType[]): string {
  const departure = overlays.find((overlay) => overlay.label.startsWith("Depart for "));
  if (departure) return departure.label;
  const arrival = overlays.find((overlay) => overlay.label.startsWith("Arrive in "));
  if (arrival) return arrival.label;
  return overlays[0]!.label;
}

/** Full-width grey transport strip at the top of a travel day cell. */
export function TransitOverlay(props: {
  overlays: TransitOverlayType[];
  onTransitClick?: () => void;
}) {
  if (!props.overlays.length) return null;

  const label = primaryOverlayLabel(props.overlays);

  return (
    <button
      type="button"
      className="absolute inset-x-0 top-0 z-[12] flex items-center justify-center overflow-hidden border-b-2 border-indigo-400/55 bg-zinc-300/90 px-1 hover:bg-zinc-400/90"
      style={{ height: TRANSIT_BAR_HEIGHT }}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        props.onTransitClick?.();
      }}
    >
      <span className="truncate text-[8px] font-semibold leading-tight text-zinc-700">
        {label}
      </span>
    </button>
  );
}
