export function formatParticipantRole(role: string): string {
  if (!role) return "";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function formatGroupsSummary(
  groups?: Array<{ name: string }>,
): string | null {
  const groupNames = (groups ?? [])
    .map((g) => g.name.trim())
    .filter(Boolean);
  if (groupNames.length === 0) return null;
  if (groupNames.length === 1) return groupNames[0]!;
  return groupNames.join(" · ");
}

export function formatContactsSubtitle(
  contacts: Array<{ name: string; isEmergencyLead?: boolean }>,
): string {
  if (!contacts.length) return "No contacts yet";
  const lead = contacts.find((c) => c.isEmergencyLead) ?? contacts[0];
  if (contacts.length === 1) return lead?.name ?? "1 contact";
  return `${contacts.length} contacts · ${lead?.name ?? ""}`.trim();
}
