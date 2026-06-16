import { NextResponse } from "next/server";
import { z } from "zod";

import { hostApiError } from "@/lib/host/api-errors";
import { createHostAccount } from "@/lib/host/auth";
import { setHostSessionCookie } from "@/lib/auth/host-session";

const BodySchema = z.discriminatedUnion("accountType", [
  z.object({
    accountType: z.literal("school"),
    email: z.string().trim().email().max(200),
    phoneNumber: z.string().trim().min(3).max(40).optional(),
    defaultCountryCallingCode: z.string().trim().min(2).max(2).default("NZ"),
    password: z.string().min(8).max(200),
    fullName: z.string().trim().min(2).max(120),
    schoolName: z.string().trim().min(2).max(200),
    jobTitle: z.string().trim().min(2).max(120),
    role: z.enum(["teacher", "helper", "host", "admin"]).default("teacher"),
    plan: z.enum(["school_starter", "school_pro", "school_pro_plus"]),
    homeCity: z.string().trim().min(2).max(200),
    defaultAirport: z.string().trim().min(2).max(200),
  }),
  z.object({
    accountType: z.literal("personal"),
    email: z.string().trim().email().max(200),
    password: z.string().min(8).max(200),
    fullName: z.string().trim().min(2).max(120),
    plan: z.enum(["personal_one_time", "personal", "personal_pro"]),
    homeCity: z.string().trim().min(2).max(200),
    defaultAirport: z.string().trim().min(2).max(200),
  }),
]);

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const data = parsed.data;
    const host =
      data.accountType === "school"
        ? await createHostAccount({
            accountType: "school",
            email: data.email,
            phoneNumber: data.phoneNumber,
            defaultCountryCallingCode: data.defaultCountryCallingCode,
            password: data.password,
            fullName: data.fullName,
            role: data.role,
            plan: data.plan,
            schoolName: data.schoolName,
            jobTitle: data.jobTitle,
            homeCity: data.homeCity,
            defaultAirport: data.defaultAirport,
          })
        : await createHostAccount({
            accountType: "personal",
            email: data.email,
            password: data.password,
            fullName: data.fullName,
            plan: data.plan,
            homeCity: data.homeCity,
            defaultAirport: data.defaultAirport,
          });

    await setHostSessionCookie({ hostId: host.id, activeTripId: null });

    return NextResponse.json({
      ok: true,
      hostId: host.id,
      accountType: host.accountType,
      plan: host.plan,
    });
  } catch (err) {
    return hostApiError(err);
  }
}
