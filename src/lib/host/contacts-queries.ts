import { and, asc, eq, max, ne } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { contacts } from "@/lib/db/schema";

export async function loadContacts(tripId: string) {
  const rows = await db
    .select()
    .from(contacts)
    .where(eq(contacts.tripId, tripId))
    .orderBy(asc(contacts.sortOrder));

  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    role: c.role,
    phoneNumber: c.phoneNumber,
    visibility: c.visibility,
    sortOrder: c.sortOrder,
    isEmergencyLead: c.isEmergencyLead,
  }));
}

export async function getContactForTrip(tripId: string, contactId: string) {
  const row = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.tripId, tripId)))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  return row;
}

export async function nextContactSortOrder(tripId: string) {
  const row = await db
    .select({ v: max(contacts.sortOrder) })
    .from(contacts)
    .where(eq(contacts.tripId, tripId))
    .then((rows) => rows[0]);
  return (row?.v ?? 0) + 1;
}

export async function clearEmergencyLeadExcept(tripId: string, exceptId?: string) {
  const condition = exceptId
    ? and(eq(contacts.tripId, tripId), ne(contacts.id, exceptId))
    : eq(contacts.tripId, tripId);

  await db
    .update(contacts)
    .set({ isEmergencyLead: false })
    .where(condition);
}

export async function setEmergencyLead(tripId: string, contactId: string) {
  await clearEmergencyLeadExcept(tripId, contactId);
  await db
    .update(contacts)
    .set({ isEmergencyLead: true })
    .where(and(eq(contacts.id, contactId), eq(contacts.tripId, tripId)));
}
