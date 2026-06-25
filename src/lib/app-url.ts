/**
 * Canonical app base URL for emails, invite links, and redirects.
 * Prefer APP_URL; fall back to Vercel deployment URL or localhost in dev.
 */
export function getAppUrl(): string {
  const explicit =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim();

  if (explicit) {
    return explicit.startsWith("http") ? explicit.replace(/\/$/, "") : `https://${explicit}`;
  }

  if (process.env.NODE_ENV === "production") {
    return "https://itinerarylive.app";
  }

  const port = process.env.PORT?.trim() || "3000";
  return `http://localhost:${port}`;
}

export function appUrl(path: string): string {
  const base = getAppUrl();
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
