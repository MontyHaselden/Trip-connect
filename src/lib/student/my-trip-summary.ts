export function formatParticipantRole(role: string): string {
  if (!role) return "";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function formatRoomGroupSummary(props: {
  roomName?: string | null;
  groups?: Array<{ name: string }>;
}): string | null {
  const parts: string[] = [];
  if (props.roomName?.trim()) parts.push(props.roomName.trim());
  const groupNames = (props.groups ?? [])
    .map((g) => g.name.trim())
    .filter(Boolean);
  if (groupNames.length === 1) {
    parts.push(groupNames[0]!);
  } else if (groupNames.length > 1) {
    parts.push(groupNames.join(" · "));
  }
  return parts.length ? parts.join(" · ") : null;
}

export function formatContactsSubtitle(
  contacts: Array<{ name: string; isEmergencyLead?: boolean }>,
): string {
  if (!contacts.length) return "No contacts yet";
  const lead = contacts.find((c) => c.isEmergencyLead) ?? contacts[0];
  if (contacts.length === 1) return lead?.name ?? "1 contact";
  return `${contacts.length} contacts · ${lead?.name ?? ""}`.trim();
}
