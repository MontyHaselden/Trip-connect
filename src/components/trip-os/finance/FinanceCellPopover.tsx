"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type MenuRect = { top: number; left: number; minWidth: number };

export function FinanceCellPopover(props: {
  open: boolean;
  onClose: () => void;
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  minWidth?: string;
}) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuRect, setMenuRect] = useState<MenuRect | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateMenuPosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const minWidthPx = 160;
    setMenuRect({
      top: rect.bottom + 4,
      left: props.align === "right" ? rect.right - minWidthPx : rect.left,
      minWidth: Math.max(rect.width, minWidthPx),
    });
  }, [props.align]);

  useEffect(() => {
    if (!props.open) return;
    updateMenuPosition();
    window.addEventListener("scroll", updateMenuPosition, true);
    window.addEventListener("resize", updateMenuPosition);
    return () => {
      window.removeEventListener("scroll", updateMenuPosition, true);
      window.removeEventListener("resize", updateMenuPosition);
    };
  }, [props.open, updateMenuPosition]);

  useEffect(() => {
    if (!props.open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      props.onClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [props.open, props.onClose]);

  const menu =
    props.open && menuRect ? (
      <div
        ref={menuRef}
        className="fixed z-[100] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
        style={{
          top: menuRect.top,
          left: menuRect.left,
          minWidth: menuRect.minWidth,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {props.children}
      </div>
    ) : null;

  return (
    <>
      <div ref={triggerRef} className="inline-block max-w-full">
        {props.trigger}
      </div>
      {mounted && menu ? createPortal(menu, document.body) : null}
    </>
  );
}

export function popoverOptionClass(active: boolean): string {
  return [
    "block w-full px-3 py-1.5 text-left text-[11px] transition",
    active ? "bg-violet-50 font-medium text-violet-900" : "text-zinc-800 hover:bg-zinc-50",
  ].join(" ");
}
