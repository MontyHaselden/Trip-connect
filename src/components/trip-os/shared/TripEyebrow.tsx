export function TripEyebrow(props: {
  children: React.ReactNode;
  className?: string;
  accent?: boolean;
}) {
  return (
    <p
      className={[
        "text-[11px] font-semibold uppercase tracking-[0.2em]",
        props.accent ? "text-violet-600" : "text-zinc-400",
        props.className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {props.children}
    </p>
  );
}
