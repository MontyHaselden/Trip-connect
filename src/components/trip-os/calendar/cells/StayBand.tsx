import {
  stayBandBorder,
  stayBandFill,
  stayBandText,
} from "@/lib/host/locations/accommodation-colors";

type StayBandStyle = {
  fill: string;
  border: string;
  text: string;
};

function StayBandSlice(props: {
  label: string;
  side: "left" | "right" | "full";
  displayShare: number;
  primary?: string;
  secondary?: string;
  colors?: StayBandStyle | null;
}) {
  const { label, side, displayShare, colors } = props;
  const primary = props.primary?.trim() ?? "";
  const secondary = props.secondary?.trim() ?? "";
  const secondaryOnly = Boolean(secondary && !primary && displayShare < 1);

  const widthStyle =
    side === "right"
      ? {
          left: `${displayShare * 100}%`,
          width: `${(1 - displayShare) * 100}%`,
        }
      : side === "left" && primary && displayShare < 1
        ? { left: 0, width: `${displayShare * 100}%` }
        : secondaryOnly
          ? { left: `${displayShare * 100}%`, width: `${(1 - displayShare) * 100}%` }
          : { left: 0, right: 0 };

  return (
    <div
      className={[
        "pointer-events-none absolute bottom-0 z-[10] flex h-1/4 items-center overflow-hidden border-t px-1 pb-0.5 pt-0.5",
        colors ? "" : "border-violet-300/70 bg-violet-100",
      ].join(" ")}
      style={{
        ...widthStyle,
        ...(colors
          ? {
              backgroundColor: colors.fill,
              borderTopColor: colors.border,
            }
          : {}),
      }}
      title={label}
    >
      <span
        className={[
          "block truncate text-[8px] font-semibold leading-tight",
          colors ? "" : "text-violet-950",
        ].join(" ")}
        style={colors ? { color: colors.text } : undefined}
      >
        {label}
      </span>
    </div>
  );
}

export function StayBand(props: {
  label?: string | null;
  leftLabel?: string | null;
  rightLabel?: string | null;
  leftOnly?: boolean;
  rightOnly?: boolean;
  displayShare?: number;
  primary?: string;
  secondary?: string;
  leftColors?: StayBandStyle | null;
  rightColors?: StayBandStyle | null;
  singleColors?: StayBandStyle | null;
}) {
  const share = props.displayShare ?? 1;
  const left = props.leftLabel?.trim() || (!props.rightOnly ? props.label?.trim() : "") || null;
  const right = props.rightLabel?.trim() || null;
  const implicitLeftOnly = Boolean(
    left &&
      !right &&
      !props.rightOnly &&
      props.primary?.trim() &&
      (props.displayShare ?? 1) < 1 &&
      !props.secondary?.trim(),
  );

  if (left && right && left !== right) {
    return (
      <>
        <StayBandSlice
          label={left}
          side="left"
          displayShare={share}
          primary={props.primary}
          secondary={props.secondary}
          colors={props.leftColors}
        />
        <StayBandSlice
          label={right}
          side="right"
          displayShare={share}
          primary={props.primary}
          secondary={props.secondary}
          colors={props.rightColors}
        />
      </>
    );
  }

  if (left && !right && (props.leftOnly || implicitLeftOnly)) {
    return (
      <StayBandSlice
        label={left}
        side="left"
        displayShare={share}
        primary={props.primary}
        secondary={props.secondary}
        colors={props.leftColors ?? props.singleColors}
      />
    );
  }

  if (!left && right && props.rightOnly) {
    return (
      <StayBandSlice
        label={right}
        side="right"
        displayShare={share}
        primary={props.primary}
        secondary={props.secondary}
        colors={props.rightColors ?? props.singleColors}
      />
    );
  }

  const single = left || right;
  if (!single) return null;

  return (
    <StayBandSlice
      label={single}
      side="full"
      displayShare={share}
      primary={props.primary}
      secondary={props.secondary}
      colors={props.singleColors ?? props.leftColors ?? props.rightColors}
    />
  );
}

export function stayBandStyleForLabel(stay: {
  id?: string;
  name: string | null;
  cityLabel: string;
}): StayBandStyle {
  return {
    fill: stayBandFill(stay),
    border: stayBandBorder(stay),
    text: stayBandText(stay),
  };
}
