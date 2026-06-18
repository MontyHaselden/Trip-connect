/** Overlay positioning for full-screen student app vs embedded phone preview. */
export function studentOverlayRootClass(
  contained: boolean,
  opts?: { zClass?: string; align?: "bottom" | "center" | "full" },
): string {
  const position = contained ? "absolute" : "fixed";
  const z = opts?.zClass ?? "z-[70]";
  const align = opts?.align ?? "bottom";

  if (align === "full") {
    return `${position} inset-0 ${z} flex flex-col`;
  }
  if (align === "center") {
    return `${position} inset-0 ${z} flex items-center justify-center`;
  }
  if (contained) {
    return `${position} inset-0 ${z} flex items-end justify-center`;
  }
  return `${position} inset-0 ${z} flex items-end justify-center sm:items-center`;
}
