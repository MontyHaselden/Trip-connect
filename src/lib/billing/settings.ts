import { eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { platformSettings } from "@/lib/db/schema";
import type { GstSettings } from "@/lib/billing/gst";

type SettingValue = string | number | boolean | null;

let cache: Map<string, SettingValue> | null = null;
let cacheAt = 0;
const CACHE_TTL_MS = 30_000;

function parseValue(raw: unknown): SettingValue {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
    return raw;
  }
  return String(raw);
}

export async function getPlatformSetting(key: string): Promise<SettingValue> {
  const now = Date.now();
  if (!cache || now - cacheAt > CACHE_TTL_MS) {
    try {
      const rows = await db.select().from(platformSettings);
      cache = new Map(rows.map((r) => [r.key, parseValue(r.value)]));
    } catch {
      cache = new Map();
    }
    cacheAt = now;
  }
  return cache.get(key) ?? null;
}

export async function getGstSettings(): Promise<GstSettings> {
  const [enabled, rate, displayMode, label, currency] = await Promise.all([
    getPlatformSetting("gst_enabled"),
    getPlatformSetting("gst_rate"),
    getPlatformSetting("gst_display_mode"),
    getPlatformSetting("gst_label"),
    getPlatformSetting("currency"),
  ]);

  return {
    gstEnabled: enabled !== false && enabled !== "false",
    gstRate: typeof rate === "number" ? rate : 0.15,
    gstDisplayMode:
      displayMode === "inc_gst" ? "inc_gst" : "plus_gst",
    gstLabel: typeof label === "string" ? label : "GST",
    currency: typeof currency === "string" ? currency : "NZD",
  };
}

export async function getEnforcementMode(): Promise<"soft" | "hard"> {
  const mode = await getPlatformSetting("enforcement_mode");
  return mode === "hard" ? "hard" : "soft";
}

export async function getAllPlatformSettings(): Promise<Record<string, SettingValue>> {
  const rows = await db.select().from(platformSettings);
  return Object.fromEntries(rows.map((r) => [r.key, parseValue(r.value)]));
}

export async function setPlatformSetting(params: {
  key: string;
  value: SettingValue;
  adminId?: string;
}) {
  const jsonValue = params.value;
  await db
    .insert(platformSettings)
    .values({
      key: params.key,
      value: jsonValue,
      updatedByAdminId: params.adminId ?? null,
    })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: {
        value: jsonValue,
        updatedAt: new Date(),
        updatedByAdminId: params.adminId ?? null,
      },
    });
  cache = null;
}

export async function getFoundingSchoolMaxSlots(): Promise<number> {
  const val = await getPlatformSetting("founding_school_max_slots");
  return typeof val === "number" ? val : 15;
}
