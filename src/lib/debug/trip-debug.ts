export type TripDebugEntry = {
  t: string;
  event: string;
  [key: string]: unknown;
};

const MAX_LOG = 40;
const log: TripDebugEntry[] = [];

function push(entry: TripDebugEntry) {
  log.unshift(entry);
  if (log.length > MAX_LOG) log.length = MAX_LOG;
}

export function tripDebug(event: string, data?: Record<string, unknown>) {
  const entry: TripDebugEntry = {
    t: new Date().toISOString().slice(11, 23),
    event,
    ...data,
  };
  push(entry);
  console.info("[TripConnect]", entry);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("tc-debug", { detail: entry }));
  }
}

export function getTripDebugLog(): TripDebugEntry[] {
  return [...log];
}

export function isTripDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem("tc_debug") === "1") return true;
    return new URLSearchParams(window.location.search).get("debug") === "1";
  } catch {
    return false;
  }
}

export function enableTripDebugPersisted() {
  try {
    localStorage.setItem("tc_debug", "1");
  } catch {
    // ignore
  }
}

declare global {
  interface Window {
    __tripConnectDebug?: {
      log: () => TripDebugEntry[];
      enable: () => void;
    };
  }
}

export function installTripDebugGlobal() {
  if (typeof window === "undefined") return;
  window.__tripConnectDebug = {
    log: getTripDebugLog,
    enable: enableTripDebugPersisted,
  };
}
