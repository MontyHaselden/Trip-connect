export type TimelineItemBase = {
  id: string;
  startTime: string;
  endTime: string | null;
  title: string;
  sortOrder: number;
};

export type TimelineBlockLayout = {
  id: string;
  startMinutes: number;
  endMinutes: number;
  column: number;
  columnCount: number;
  topPx: number;
  heightPx: number;
  leftPercent: number;
  widthPercent: number;
};
