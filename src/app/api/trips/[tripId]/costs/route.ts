import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

import { requireHostSessionHostId } from "@/lib/auth/host-session";
import { db } from "@/lib/db/client";
import {
  costAllocationOverrides,
  costLineItems,
  participantPayments,
  tripCostSettings,
  tripFunds,
} from "@/lib/db/schema";
import { hostApiError } from "@/lib/host/api-errors";
import { getTripByIdForHost } from "@/lib/host/get-trip-by-id";
import { loadTripGraph } from "@/lib/trip-engine";
import { loadCostLedgerProjection } from "@/lib/trip-engine/cost-ledger/index";
import { syncCostLedgerFromGraph } from "@/lib/trip-engine/cost-ledger/sync-cost-ledger-from-graph";

const AllocationRuleSchema = z.enum([
  "equal_cost_participants",
  "equal_group",
  "assign_one",
  "manual",
]);

const CategorySchema = z.enum([
  "flights",
  "transport",
  "insurance",
  "accommodation",
  "meals",
  "activities",
  "other",
]);

const SettingsSchema = z.object({
  baseCurrency: z.string().trim().min(3).max(3).optional(),
  foreignCurrency: z.string().trim().min(3).max(3).nullable().optional(),
  exchangeRate: z.number().positive().nullable().optional(),
  exchangeRateDate: z.string().nullable().optional(),
  exchangeRateManual: z.boolean().optional(),
});

const LineItemSchema = z.object({
  category: CategorySchema,
  description: z.string().trim().min(1).max(500),
  notes: z.string().trim().max(2000).nullable().optional(),
  totalAmountCents: z.number().int().min(0),
  currency: z.string().trim().min(3).max(3).default("NZD"),
  quantity: z.number().nullable().optional(),
  allocationRuleType: AllocationRuleSchema.default("equal_cost_participants"),
  allocationRulePayload: z
    .object({
      groupId: z.string().uuid().optional(),
      participantId: z.string().uuid().optional(),
    })
    .default({}),
  linkedStayId: z.string().uuid().nullable().optional(),
  linkedTransportLegId: z.string().uuid().nullable().optional(),
  linkedActivityId: z.string().uuid().nullable().optional(),
  supplierPaymentStatus: z.enum(["estimated", "invoiced", "paid"]).nullable().optional(),
  overrides: z
    .array(
      z.object({
        participantId: z.string().uuid(),
        amountCents: z.number().int(),
      }),
    )
    .optional(),
});

const FundSchema = z.object({
  name: z.string().trim().min(1).max(200),
  amountCents: z.number().int().min(0),
  currency: z.string().trim().min(3).max(3).default("NZD"),
  allocationRuleType: AllocationRuleSchema.default("equal_cost_participants"),
  allocationRulePayload: z
    .object({
      groupId: z.string().uuid().optional(),
      participantId: z.string().uuid().optional(),
    })
    .default({}),
  notes: z.string().trim().max(2000).nullable().optional(),
});

const PaymentSchema = z.object({
  participantId: z.string().uuid(),
  amountCents: z.number().int().min(0),
  currency: z.string().trim().min(3).max(3).default("NZD"),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  label: z.string().trim().min(1).max(120).default("deposit"),
  notes: z.string().trim().max(2000).nullable().optional(),
});

async function requireTrip(tripId: string) {
  const hostId = await requireHostSessionHostId();
  const trip = await getTripByIdForHost(hostId, tripId);
  if (!trip) return null;
  return trip;
}

function settingsForDb(settings: z.infer<typeof SettingsSchema>) {
  return {
    ...settings,
    exchangeRate:
      settings.exchangeRate != null ? String(settings.exchangeRate) : settings.exchangeRate,
  };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  try {
    const trip = await requireTrip(tripId);
    if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const graph = await loadTripGraph(tripId);
    const projection = await loadCostLedgerProjection(tripId, graph);
    return NextResponse.json({ costLedger: projection });
  } catch (err) {
    return hostApiError(err);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  try {
    const trip = await requireTrip(tripId);
    if (!trip) return NextResponse.json({ error: "Trip not found." }, { status: 404 });

    const json = await req.json().catch(() => null);
    const action = json?.action as string | undefined;

    if (action === "updateSettings") {
      const parsed = SettingsSchema.safeParse(json.settings);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid settings." }, { status: 400 });
      }
      const settings = settingsForDb(parsed.data);
      await db
        .insert(tripCostSettings)
        .values({ tripId, ...settings, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: tripCostSettings.tripId,
          set: { ...settings, updatedAt: new Date() },
        });
    } else if (action === "addLine") {
      const parsed = LineItemSchema.safeParse(json.line);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid line item." }, { status: 400 });
      }
      const raw = await loadCostLedgerRaw(tripId);
      const [created] = await db
        .insert(costLineItems)
        .values({
          tripId,
          sortOrder: raw.lineItems.length,
          category: parsed.data.category,
          description: parsed.data.description,
          notes: parsed.data.notes ?? null,
          totalAmountCents: parsed.data.totalAmountCents,
          currency: parsed.data.currency,
          quantity: parsed.data.quantity != null ? String(parsed.data.quantity) : null,
          allocationRuleType: parsed.data.allocationRuleType,
          allocationRulePayload: parsed.data.allocationRulePayload,
          linkedStayId: parsed.data.linkedStayId ?? null,
          linkedTransportLegId: parsed.data.linkedTransportLegId ?? null,
          linkedActivityId: parsed.data.linkedActivityId ?? null,
          supplierPaymentStatus: parsed.data.supplierPaymentStatus ?? null,
        })
        .returning();
      if (created && parsed.data.overrides?.length) {
        await db.insert(costAllocationOverrides).values(
          parsed.data.overrides.map((o) => ({
            lineItemId: created.id,
            participantId: o.participantId,
            amountCents: o.amountCents,
          })),
        );
      }
    } else if (action === "updateLine") {
      const lineId = json.lineId as string | undefined;
      const parsed = LineItemSchema.partial().safeParse(json.line);
      if (!lineId || !parsed.success) {
        return NextResponse.json({ error: "Invalid line update." }, { status: 400 });
      }
      await db
        .update(costLineItems)
        .set({
          ...(parsed.data.category ? { category: parsed.data.category } : {}),
          ...(parsed.data.description ? { description: parsed.data.description } : {}),
          ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
          ...(parsed.data.totalAmountCents !== undefined
            ? { totalAmountCents: parsed.data.totalAmountCents }
            : {}),
          ...(parsed.data.currency ? { currency: parsed.data.currency } : {}),
          ...(parsed.data.quantity !== undefined
            ? { quantity: parsed.data.quantity != null ? String(parsed.data.quantity) : null }
            : {}),
          ...(parsed.data.allocationRuleType
            ? { allocationRuleType: parsed.data.allocationRuleType }
            : {}),
          ...(parsed.data.allocationRulePayload
            ? { allocationRulePayload: parsed.data.allocationRulePayload }
            : {}),
          ...(parsed.data.supplierPaymentStatus !== undefined
            ? { supplierPaymentStatus: parsed.data.supplierPaymentStatus }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(costLineItems.id, lineId));
      if (parsed.data.overrides) {
        await db
          .delete(costAllocationOverrides)
          .where(eq(costAllocationOverrides.lineItemId, lineId));
        if (parsed.data.overrides.length) {
          await db.insert(costAllocationOverrides).values(
            parsed.data.overrides.map((o) => ({
              lineItemId: lineId,
              participantId: o.participantId,
              amountCents: o.amountCents,
            })),
          );
        }
      }
    } else if (action === "deleteLine") {
      const lineId = json.lineId as string | undefined;
      if (!lineId) {
        return NextResponse.json({ error: "Line id required." }, { status: 400 });
      }
      await db.delete(costLineItems).where(eq(costLineItems.id, lineId));
    } else if (action === "deleteEmptyLines") {
      await db
        .delete(costLineItems)
        .where(and(eq(costLineItems.tripId, tripId), eq(costLineItems.totalAmountCents, 0)));
    } else if (action === "addFund") {
      const parsed = FundSchema.safeParse(json.fund);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid fund." }, { status: 400 });
      }
      const raw = await loadCostLedgerRaw(tripId);
      await db.insert(tripFunds).values({
        tripId,
        sortOrder: raw.funds.length,
        name: parsed.data.name,
        amountCents: parsed.data.amountCents,
        currency: parsed.data.currency,
        allocationRuleType: parsed.data.allocationRuleType,
        allocationRulePayload: parsed.data.allocationRulePayload,
        notes: parsed.data.notes ?? null,
      });
    } else if (action === "deleteFund") {
      const fundId = json.fundId as string | undefined;
      if (!fundId) {
        return NextResponse.json({ error: "Fund id required." }, { status: 400 });
      }
      await db.delete(tripFunds).where(eq(tripFunds.id, fundId));
    } else if (action === "addPayment") {
      const parsed = PaymentSchema.safeParse(json.payment);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid payment." }, { status: 400 });
      }
      await db.insert(participantPayments).values({
        tripId,
        participantId: parsed.data.participantId,
        amountCents: parsed.data.amountCents,
        currency: parsed.data.currency,
        paidAt: parsed.data.paidAt,
        label: parsed.data.label,
        notes: parsed.data.notes ?? null,
      });
    } else if (action === "deletePayment") {
      const paymentId = json.paymentId as string | undefined;
      if (!paymentId) {
        return NextResponse.json({ error: "Payment id required." }, { status: 400 });
      }
      await db.delete(participantPayments).where(eq(participantPayments.id, paymentId));
    } else if (action === "seedFromTrip") {
      const graph = await loadTripGraph(tripId);
      if (!graph) {
        return NextResponse.json({ error: "Trip not found." }, { status: 404 });
      }
      await syncCostLedgerFromGraph(tripId, graph);
    } else {
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    const graph = await loadTripGraph(tripId);
    const projection = await loadCostLedgerProjection(tripId, graph);
    return NextResponse.json({ costLedger: projection });
  } catch (err) {
    return hostApiError(err);
  }
}
