import { NextResponse } from "next/server";

import { getAdminById } from "@/lib/admin/auth";
import { adminApiError } from "@/lib/admin/api-errors";
import { requireAdminSession } from "@/lib/auth/admin-session";

export async function GET() {
  try {
    const session = await requireAdminSession();
    const admin = await getAdminById(session.adminId);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.json({ admin });
  } catch (err) {
    return adminApiError(err);
  }
}
