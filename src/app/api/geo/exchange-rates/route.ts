import { NextResponse } from "next/server";

import { FINANCE_DISPLAY_CURRENCIES } from "@/lib/trip-engine/cost-ledger/exchange-rates";

export async function GET(req: Request) {
  const base =
    new URL(req.url).searchParams.get("base")?.toUpperCase().trim() || "NZD";
  if (!FINANCE_DISPLAY_CURRENCIES.includes(base as (typeof FINANCE_DISPLAY_CURRENCIES)[number])) {
    return NextResponse.json({ error: "Unsupported base currency." }, { status: 400 });
  }

  const targets = FINANCE_DISPLAY_CURRENCIES.filter((c) => c !== base).join(",");
  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}&to=${targets}`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) {
      return NextResponse.json({ error: "Exchange rate provider unavailable." }, { status: 502 });
    }
    const body = (await res.json()) as {
      base: string;
      date: string;
      rates: Record<string, number>;
    };
    return NextResponse.json({
      base: body.base,
      date: body.date,
      rates: { [base]: 1, ...body.rates },
    });
  } catch {
    return NextResponse.json({ error: "Could not load exchange rates." }, { status: 502 });
  }
}
