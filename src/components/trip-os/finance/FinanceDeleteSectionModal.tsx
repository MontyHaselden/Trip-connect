"use client";

import { TripConfirmModal } from "../shared/TripConfirmModal";

export function FinanceDeleteSectionModal(props: {
  open: boolean;
  sectionName: string;
  lineCount: number;
  fundCount: number;
  saving?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const hasRows = props.lineCount > 0 || props.fundCount > 0;
  const rowParts: string[] = [];
  if (props.lineCount > 0) {
    rowParts.push(`${props.lineCount} expense row${props.lineCount === 1 ? "" : "s"}`);
  }
  if (props.fundCount > 0) {
    rowParts.push(`${props.fundCount} payment row${props.fundCount === 1 ? "" : "s"}`);
  }

  const description = hasRows
    ? `Delete the “${props.sectionName}” tab? ${rowParts.join(" and ")} will move to Other.`
    : `Delete the “${props.sectionName}” tab? This cannot be undone.`;

  return (
    <TripConfirmModal
      open={props.open}
      eyebrow="Finance section"
      title="Delete section"
      description={description}
      tone="danger"
      confirmLabel="Delete section"
      confirmLoading={props.saving}
      onCancel={props.onCancel}
      onConfirm={() => void props.onConfirm()}
    />
  );
}
