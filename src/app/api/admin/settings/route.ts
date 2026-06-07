import { NextResponse } from "next/server";
import { z } from "zod";

import { logAdminAction } from "@/lib/admin/audit";
import { adminApiError } from "@/lib/admin/api-errors";
import { canEditPlatformSettings, requireAdminRole } from "@/lib/admin/permissions";
import {
  getAllPlatformSettings,
  setPlatformSetting,
} from "@/lib/billing/settings";

const PatchSchema = z.object({
  settings: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
});

export async function GET() {
  try {
    await requireAdminRole("support");
    const settings = await getAllPlatformSettings();
    return NextResponse.json({ settings });
  } catch (err) {
    return adminApiError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = await requireAdminRole("super_admin");
    if (!canEditPlatformSettings(admin.role)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const json = await req.json().catch(() => null);
    const parsed = PatchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const before = await getAllPlatformSettings();

    for (const [key, value] of Object.entries(parsed.data.settings)) {
      await setPlatformSetting({ key, value, adminId: admin.id });
    }

    const after = await getAllPlatformSettings();

    await logAdminAction({
      adminId: admin.id,
      action: "settings.update",
      entityType: "platform_settings",
      before,
      after,
      req,
    });

    return NextResponse.json({ ok: true, settings: after });
  } catch (err) {
    return adminApiError(err);
  }
}
