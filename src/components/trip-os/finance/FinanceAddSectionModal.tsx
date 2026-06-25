"use client";

import { useState } from "react";

import { TripConfirmModal } from "../shared/TripConfirmModal";

export function FinanceAddSectionModal(props: {
  open: boolean;
  saving?: boolean;
  onCancel: () => void;
  onAdd: (name: string, description: string) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function handleConfirm() {
    const trimmed = name.trim();
    if (!trimmed) return;
    void props.onAdd(trimmed, description.trim());
  }

  return (
    <TripConfirmModal
      open={props.open}
      eyebrow="Finance section"
      title="Add section"
      description="Create an extra tab for costs beyond Accommodation, Transport, Activities, and Other — e.g. visas, contingency, or a separate fund."
      confirmLabel="Add section"
      confirmDisabled={!name.trim()}
      confirmLoading={props.saving}
      onCancel={props.onCancel}
      onConfirm={handleConfirm}
    >
      <label className="block">
        <span className="text-xs font-medium text-zinc-900">Section name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Gifts"
          className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm text-zinc-900"
          autoFocus
        />
      </label>
      <label className="mt-3 block">
        <span className="text-xs font-medium text-zinc-900">Description (optional)</span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short note for the tab header"
          className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm text-zinc-900"
        />
      </label>
    </TripConfirmModal>
  );
}
