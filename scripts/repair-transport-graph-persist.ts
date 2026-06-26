/**
 * Persist transport graph repairs (deduped products, linked legs, fixed dates) to the DB.
 *
 * Usage:
 *   TRIP_ID=<uuid> npx tsx scripts/repair-transport-graph-persist.ts
 *   DRY_RUN=1 TRIP_ID=<uuid> npx tsx scripts/repair-transport-graph-persist.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

function transportFingerprint(state: {
  transportProducts?: Array<{ id: string; kind: string; name: string }>;
  outboundLegs: Array<{ id: string; transportProductId?: string | null; travelDate: string; arrivalDate?: string | null }>;
  returnLegs: Array<{ id: string; transportProductId?: string | null; travelDate: string; arrivalDate?: string | null }>;
  intercityLegs: Array<{ id: string; transportProductId?: string | null; travelDate: string; arrivalDate?: string | null }>;
}): string {
  const products = (state.transportProducts ?? [])
    .map((p) => `${p.id}:${p.kind}:${p.name}`)
    .sort()
    .join("|");
  const leg = (rows: typeof state.outboundLegs) =>
    rows
      .map((l) => `${l.id}:${l.transportProductId ?? ""}:${l.travelDate}:${l.arrivalDate ?? ""}`)
      .sort()
      .join("|");
  return [products, leg(state.outboundLegs), leg(state.returnLegs), leg(state.intercityLegs)].join("\n");
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required (.env.local or environment).");
  }

  const tripId = process.env.TRIP_ID?.trim();
  if (!tripId) {
    throw new Error("TRIP_ID is required.");
  }

  const dryRun = process.env.DRY_RUN === "1";

  const { loadTripLocationState } = await import("../src/lib/host/locations/trip-location-state");
  const { loadTripSetupState } = await import("../src/lib/host/setup/load-setup-state");
  const { applyTripSetupState } = await import("../src/lib/host/setup/apply-setup-state");
  const { syncTripBoundsFromContent } = await import("../src/lib/host/setup/sync-trip-bounds");
  const { loadTripGraph } = await import("../src/lib/trip-engine/load-trip-graph");
  const { repairTransportProductFinanceLinks } = await import(
    "../src/lib/trip-engine/cost-ledger/repair-transport-product-finance-links"
  );
  const { ensureMainGroupForTrip } = await import("../src/lib/groups/main-group");

  const mainGroupId = await ensureMainGroupForTrip(tripId);
  const rawLocation = await loadTripLocationState(tripId);
  if (!rawLocation) {
    throw new Error(`Trip ${tripId} not found or has no location state.`);
  }

  const rawState = {
    transportProducts: rawLocation.transportProducts ?? [],
    outboundLegs: rawLocation.outboundLegs,
    returnLegs: rawLocation.returnLegs,
    intercityLegs: rawLocation.intercityLegs,
  };

  const repairedState = await loadTripSetupState(tripId);
  if (!repairedState) {
    throw new Error(`Could not load setup state for ${tripId}.`);
  }

  const before = transportFingerprint(rawState);
  const after = transportFingerprint(repairedState);

  console.log(`Trip ${tripId} (main group ${mainGroupId})`);
  console.log(`  Products before: ${rawState.transportProducts.length}`);
  console.log(`  Products after:  ${(repairedState.transportProducts ?? []).length}`);

  if (before === after) {
    console.log("  No transport graph changes needed — DB already matches repair.");
  } else if (dryRun) {
    console.log("  [dry-run] Would persist repaired transport graph.");
  } else {
    await applyTripSetupState(tripId, syncTripBoundsFromContent(repairedState), {
      skipWizardItineraryItems: true,
      syncTransportItems: true,
      syncAccommodationItems: false,
    });
    console.log("  Persisted repaired transport graph.");
  }

  const graph = await loadTripGraph(tripId);
  if (!graph) {
    throw new Error("Could not reload trip graph after repair.");
  }

  if (dryRun) {
    console.log("  [dry-run] Would run repairTransportProductFinanceLinks.");
    return;
  }

  const financeRepaired = await repairTransportProductFinanceLinks(tripId, graph);
  console.log(`  Finance links repaired: ${financeRepaired}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
