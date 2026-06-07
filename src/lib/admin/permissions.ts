import { getAdminById } from "@/lib/admin/auth";
import type { AdminRole } from "@/lib/admin/auth";
import { requireAdminSession } from "@/lib/auth/admin-session";

const ROLE_RANK: Record<AdminRole, number> = {
  support: 1,
  admin: 2,
  super_admin: 3,
};

export async function requireAdminRole(minRole: AdminRole) {
  const session = await requireAdminSession();
  const admin = await getAdminById(session.adminId);
  if (!admin) throw new Error("Unauthorized");
  if (ROLE_RANK[admin.role] < ROLE_RANK[minRole]) {
    throw new Error("Forbidden");
  }
  return admin;
}

export function canEditBilling(role: AdminRole): boolean {
  return role !== "support";
}

export function canEditPlatformSettings(role: AdminRole): boolean {
  return role === "super_admin";
}

export function canDeleteTrips(role: AdminRole): boolean {
  return role === "super_admin";
}

export function canCreateAdmins(role: AdminRole): boolean {
  return role === "super_admin";
}
