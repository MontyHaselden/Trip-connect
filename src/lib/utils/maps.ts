export function buildMapsSearchUrl(query: string): string {
  const q = query.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

