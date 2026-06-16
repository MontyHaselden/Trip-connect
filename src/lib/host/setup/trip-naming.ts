const PLACEHOLDER_NAMES = new Set(["new trip", "untitled trip", ""]);

export function tripNameNeedsAttention(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length < 2 || PLACEHOLDER_NAMES.has(trimmed.toLowerCase());
}

export function isDefaultNewTripName(name: string): boolean {
  return name.trim().toLowerCase() === "new trip";
}
