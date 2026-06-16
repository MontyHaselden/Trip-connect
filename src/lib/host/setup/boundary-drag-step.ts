/** One calendar-day step once horizontal drag exceeds this fraction of a cell width. */
export const BOUNDARY_DRAG_STEP_RATIO = 0.38;

export const BOUNDARY_DRAG_MIN_STEP_PX = 48;

export function boundaryDragThreshold(cellWidth: number): number {
  return Math.max(BOUNDARY_DRAG_MIN_STEP_PX, cellWidth * BOUNDARY_DRAG_STEP_RATIO);
}

/** Consume horizontal pointer movement into -1/1 day steps (chronological, not grid row). */
export function consumeBoundaryDragDelta(
  accumX: number,
  deltaX: number,
  cellWidth: number,
): { steps: Array<-1 | 1>; accumX: number } {
  const threshold = boundaryDragThreshold(cellWidth);
  let nextAccum = accumX + deltaX;
  const steps: Array<-1 | 1> = [];

  while (nextAccum >= threshold) {
    steps.push(1);
    nextAccum -= threshold;
  }
  while (nextAccum <= -threshold) {
    steps.push(-1);
    nextAccum += threshold;
  }

  return { steps, accumX: nextAccum };
}
