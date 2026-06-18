"use client";

import { useEffect, useRef, useState } from "react";

import { TripInput } from "./TripInput";

export function EditableTripName(props: {
  name: string;
  onSave: (name: string) => void;
  variant?: "hero" | "ghost";
  className?: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(props.name);
  const focusedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(props.name);
    }
  }, [props.name]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  function commitSave(value: string) {
    const trimmed = value.trim() || "New trip";
    if (trimmed === props.name.trim()) return;
    props.onSave(trimmed);
  }

  function scheduleSave(value: string) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => commitSave(value), 500);
  }

  return (
    <TripInput
      variant={props.variant ?? "ghost"}
      value={draft}
      placeholder={props.placeholder ?? "Name your trip"}
      className={props.className}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={() => {
        focusedRef.current = false;
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        commitSave(draft);
      }}
      onChange={(e) => {
        const next = e.target.value;
        setDraft(next);
        scheduleSave(next);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}
