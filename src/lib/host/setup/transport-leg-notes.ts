const SURFACE_ONLY_MARKER = "[[tc:surface-only]]";

export function stripSurfaceOnlyMarker(notes: string | null | undefined): string | null {
  if (!notes?.trim()) return null;
  if (!notes.startsWith(SURFACE_ONLY_MARKER)) return notes;
  const rest = notes.slice(SURFACE_ONLY_MARKER.length).replace(/^\n/, "").trim();
  return rest || null;
}

export function decodeTransportLegNotes(notes: string | null | undefined): {
  notes: string | null;
  surfaceOnly: boolean;
} {
  if (!notes?.trim()) return { notes: null, surfaceOnly: false };
  if (!notes.startsWith(SURFACE_ONLY_MARKER)) return { notes, surfaceOnly: false };
  return { notes: stripSurfaceOnlyMarker(notes), surfaceOnly: true };
}

export function encodeTransportLegNotes(leg: {
  notes: string | null;
  surfaceOnly?: boolean;
}): string | null {
  const userNotes = stripSurfaceOnlyMarker(leg.notes);
  if (leg.surfaceOnly) {
    return userNotes ? `${SURFACE_ONLY_MARKER}\n${userNotes}` : SURFACE_ONLY_MARKER;
  }
  return userNotes;
}
