export type GstSettings = {
  gstEnabled: boolean;
  gstRate: number;
  gstDisplayMode: "plus_gst" | "inc_gst";
  gstLabel: string;
  currency: string;
};

export function calcGstAmount(basePriceCents: number, gstRate: number): number {
  return Math.round(basePriceCents * gstRate);
}

export function calcTotalIncGst(basePriceCents: number, gstRate: number): number {
  return basePriceCents + calcGstAmount(basePriceCents, gstRate);
}

export function formatCents(cents: number, currency = "NZD"): string {
  const amount = cents / 100;
  if (currency === "NZD") {
    return amount % 1 === 0 ? `$${amount.toFixed(0)}` : `$${amount.toFixed(2)}`;
  }
  return `${amount.toFixed(2)} ${currency}`;
}

export function billingPeriodSuffix(period: string): string {
  if (period === "year") return " / year";
  if (period === "month") return " / month";
  if (period === "once") return " once";
  return "";
}

export function formatPublicPrice(params: {
  basePriceCents: number;
  billingPeriod: string;
  settings: GstSettings;
}): { display: string; subtotalCents: number; gstCents: number; totalCents: number } {
  const { basePriceCents, billingPeriod, settings } = params;
  const gstCents = settings.gstEnabled
    ? calcGstAmount(basePriceCents, settings.gstRate)
    : 0;
  const totalCents = basePriceCents + gstCents;
  const period = billingPeriodSuffix(billingPeriod);

  if (!settings.gstEnabled) {
    return {
      display: `${formatCents(basePriceCents, settings.currency)}${period}`,
      subtotalCents: basePriceCents,
      gstCents: 0,
      totalCents: basePriceCents,
    };
  }

  if (settings.gstDisplayMode === "inc_gst") {
    return {
      display: `${formatCents(totalCents, settings.currency)} incl. ${settings.gstLabel}${period}`,
      subtotalCents: basePriceCents,
      gstCents,
      totalCents,
    };
  }

  return {
    display: `${formatCents(basePriceCents, settings.currency)} + ${settings.gstLabel}${period}`,
    subtotalCents: basePriceCents,
    gstCents,
    totalCents,
  };
}

export function formatInvoiceAmounts(params: {
  subtotalCents: number;
  gstRate: number;
  gstLabel?: string;
  currency?: string;
}) {
  const gstCents = calcGstAmount(params.subtotalCents, params.gstRate);
  const totalCents = params.subtotalCents + gstCents;
  const currency = params.currency ?? "NZD";
  const label = params.gstLabel ?? "GST";
  return {
    gstCents,
    totalCents,
    lines: {
      subtotal: formatCents(params.subtotalCents, currency),
      gst: `${formatCents(gstCents, currency)} (${label})`,
      total: formatCents(totalCents, currency),
    },
  };
}
