import { TripEyebrow } from "./TripEyebrow";

export function TripSectionShell(props: {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
  fill?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={[
        props.fill ? "flex h-full min-h-0 flex-col gap-6" : "space-y-6",
        props.className ?? "",
      ].join(" ")}
    >
      <div className={props.fill ? "shrink-0" : undefined}>
        {props.eyebrow ? <TripEyebrow>{props.eyebrow}</TripEyebrow> : null}
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-900">{props.title}</h2>
        {props.description ? (
          <p className="mt-1.5 text-sm text-zinc-500">{props.description}</p>
        ) : null}
      </div>
      <div className={props.fill ? "flex min-h-0 flex-1 flex-col" : undefined}>{props.children}</div>
    </div>
  );
}

export function TripSoftPanel(props: {
  title?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const fillLayout = props.className?.includes("flex");
  return (
    <div className={["rounded-2xl bg-zinc-50/80 p-5", props.className ?? ""].join(" ")}>
      {props.title ? (
        <div className="flex shrink-0 items-start justify-between gap-3">
          <h3 className="text-sm font-semibold text-zinc-900">{props.title}</h3>
          {props.headerAction ? <div className="shrink-0">{props.headerAction}</div> : null}
        </div>
      ) : null}
      <div
        className={[
          props.title ? "mt-3" : undefined,
          fillLayout ? "flex min-h-0 flex-1 flex-col" : "min-h-0",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {props.children}
      </div>
    </div>
  );
}

export function TripListRow(props: { children: React.ReactNode }) {
  return (
    <li className="rounded-xl bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm">{props.children}</li>
  );
}
