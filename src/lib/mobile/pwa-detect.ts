export function isStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia("(display-mode: standalone)");
  if (mq.matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone);
}

export function isPwaReady(): boolean {
  if (typeof window === "undefined") return false;
  if (isStandaloneDisplayMode()) return true;
  try {
    return localStorage.getItem("tc_pwa_ready") === "1";
  } catch {
    return false;
  }
}

export function markPwaReady() {
  try {
    localStorage.setItem("tc_pwa_ready", "1");
  } catch {
    // ignore
  }
}

export function detectMobileBrowser(): "ios" | "android" | "other" {
  if (typeof window === "undefined") return "other";
  const ua = window.navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "other";
}
