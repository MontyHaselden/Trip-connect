export type FinanceCalculatorHistoryEntry = {
  id: string;
  expression: string;
  result: number;
  at: string;
};

export type FinanceCalculatorPersisted = {
  position: { x: number; y: number };
  history: FinanceCalculatorHistoryEntry[];
};

const STORAGE_PREFIX = "trip-os-finance-calculator:";

export function calculatorStorageKey(tripId: string): string {
  return `${STORAGE_PREFIX}${tripId}`;
}

export function loadCalculatorState(tripId: string): FinanceCalculatorPersisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(calculatorStorageKey(tripId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FinanceCalculatorPersisted;
    if (!parsed?.position || !Array.isArray(parsed.history)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCalculatorState(tripId: string, state: FinanceCalculatorPersisted): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(calculatorStorageKey(tripId), JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

export function defaultCalculatorPosition(): { x: number; y: number } {
  if (typeof window === "undefined") return { x: 24, y: 120 };
  const width = 340;
  return {
    x: Math.max(16, window.innerWidth - width - 24),
    y: Math.max(80, window.innerHeight - 520),
  };
}
