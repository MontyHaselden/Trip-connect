const BUSY_THRESHOLD = 7;

export function dayDensityLabel(itemCount: number): {
  count: number;
  label: string;
  isBusy: boolean;
} {
  const isBusy = itemCount >= BUSY_THRESHOLD;
  return {
    count: itemCount,
    label: isBusy ? "busy day" : "quiet day",
    isBusy,
  };
}

export const BUSY_DAY_THRESHOLD = BUSY_THRESHOLD;
