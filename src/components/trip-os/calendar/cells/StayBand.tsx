function StayBandSlice(props: {
  label: string;
  side: "left" | "right" | "full";
  displayShare: number;
  primary?: string;
  secondary?: string;
}) {
  const { label, side, displayShare } = props;
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
      className="pointer-events-none absolute bottom-0 z-[10] flex h-1/4 items-center overflow-hidden border-t border-violet-300/70 bg-violet-100 px-1 pb-0.5 pt-0.5"
      style={widthStyle}
      title={label}
    >
      <span className="block truncate text-[8px] font-semibold leading-tight text-violet-950">
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
        />
        <StayBandSlice
          label={right}
          side="right"
          displayShare={share}
          primary={props.primary}
          secondary={props.secondary}
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
    />
  );
}
