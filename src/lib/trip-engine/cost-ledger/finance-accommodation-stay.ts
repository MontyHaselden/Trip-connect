/** Named stays only — excludes city-only placeholders inferred from location paint. */
export function isFinanceAccommodationStay(stay: { name?: string | null }): boolean {
  return Boolean(stay.name?.trim());
}
