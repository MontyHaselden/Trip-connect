import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateAdmin } from "@/lib/admin/auth";
import { adminApiError } from "@/lib/admin/api-errors";
import { setAdminSessionCookie } from "@/lib/auth/admin-session";

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

    const admin = await authenticateAdmin(parsed.data);
    await setAdminSessionCookie({ adminId: admin.id, role: admin.role });

    return NextResponse.json({
      ok: true,
      redirect: "/admin",
      admin: { id: admin.id, email: admin.email, role: admin.role },
    });
  } catch (err) {
    return adminApiError(err);
  }
}
