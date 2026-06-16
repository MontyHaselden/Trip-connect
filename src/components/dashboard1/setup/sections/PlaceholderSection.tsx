"use client";

export function PlaceholderSection(props: { title: string; message: string; href?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 p-8">
      <h2 className="text-lg font-semibold">{props.title}</h2>
      <p className="mt-2 text-sm text-zinc-600">{props.message}</p>
      {props.href ? (
        <a href={props.href} className="mt-4 inline-block text-sm font-medium text-zinc-900 underline">
          Open in classic dashboard →
        </a>
      ) : null}
    </div>
  );
}
