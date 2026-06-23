"use client";

import { useState } from "react";

import { FinanceCellPopover } from "./FinanceCellPopover";

export function FinanceAbsentCell(props: { message: string }) {
  const [open, setOpen] = useState(false);

  return (
    <FinanceCellPopover
      open={open}
      onClose={() => setOpen(false)}
      minWidth="14rem"
      trigger={
        <button
          type="button"
          className="block min-h-[1.5rem] w-full rounded hover:bg-zinc-100/90 focus-visible:bg-zinc-100 focus-visible:outline-none"
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          aria-label={props.message}
        />
      }
    >
      <p className="text-[11px] leading-snug text-zinc-700">{props.message}</p>
      <p className="mt-2 text-[10px] text-zinc-500">
        Their calendar plan does not include this segment — this cell stays blank unless
        you change their trip on the calendar.
      </p>
    </FinanceCellPopover>
  );
}
