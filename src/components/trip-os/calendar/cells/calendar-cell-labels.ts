export function shortCity(name: string, maxLen = 11): string {
  const trimmed = name.trim();
  const cityOnly = trimmed.split(",")[0]?.trim() || trimmed;
  if (cityOnly.length <= maxLen) return cityOnly;
  return `${cityOnly.slice(0, maxLen - 1)}…`;
}

const CORRIDOR_LABEL_LEN = 4;

export function corridorAbbrev(name: string): string {
  const trimmed = name.trim();
  const core = trimmed.split(",")[0]?.trim() || trimmed;
  if (!core) return "";
  return core.slice(0, CORRIDOR_LABEL_LEN);
}
