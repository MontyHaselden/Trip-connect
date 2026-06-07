import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateAdmin } from "@/lib/admin/auth";
import { setAdminSessionCookie } from "@/lib/auth/admin-session";
import { hostApiError } from "@/lib/host/api-errors";
import { authenticateHostAccount } from "@/lib/host/auth";
import { setHostSessionCookie } from "@/lib/auth/host-session";

const BodySchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    try {
      const admin = await authenticateAdmin(parsed.data);
      await setAdminSessionCookie({ adminId: admin.id, role: admin.role });
      return NextResponse.json({
        ok: true,
        redirect: "/admin",
        isAdmin: true,
        adminId: admin.id,
      });
    } catch {
      // Not an admin — continue with host login
    }

    const host = await authenticateHostAccount(parsed.data);
    await setHostSessionCookie({ hostId: host.id, activeTripId: null });

    return NextResponse.json({ ok: true, redirect: "/dashboard", hostId: host.id });
  } catch (err) {
    return hostApiError(err);
  }
}

