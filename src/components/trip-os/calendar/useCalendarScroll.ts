"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

const MAX_SCROLL_ATTEMPTS = 16;

/**
 * Preserves calendar scroll position across re-renders and command dispatch.
 * Initial load scrolls to trip dates — not today.
 */
export function useCalendarScroll(tripKey: string, anchorDate: string) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasInitialScrolled = useRef(false);
  const savedScrollTop = useRef(0);
  const restorePending = useRef(false);
  const scrollGeneration = useRef("");

  const saveScrollPosition = useCallback(() => {
    if (scrollRef.current) {
      savedScrollTop.current = scrollRef.current.scrollTop;
      restorePending.current = true;
    }
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      savedScrollTop.current = el.scrollTop;
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  });

  useLayoutEffect(() => {
    if (!restorePending.current) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = savedScrollTop.current;
    restorePending.current = false;
  });

  useEffect(() => {
    const generation = `${tripKey}:${anchorDate}`;
    if (!anchorDate) return;

    if (scrollGeneration.current !== generation) {
      scrollGeneration.current = generation;
      hasInitialScrolled.current = false;
    }

    if (hasInitialScrolled.current) return;

    let cancelled = false;
    let attempts = 0;

    function centerOnAnchor(): boolean {
      const scroller = scrollRef.current;
      if (!scroller) return false;

      const anchor = scroller.querySelector(`[data-calendar-day="${anchorDate}"]`);
      if (!anchor) return false;

      anchor.scrollIntoView({ block: "center", inline: "nearest" });
      savedScrollTop.current = scroller.scrollTop;
      hasInitialScrolled.current = true;
      return true;
    }

    function tryScroll() {
      if (cancelled || hasInitialScrolled.current) return;
      if (centerOnAnchor()) return;

      attempts += 1;
      if (attempts < MAX_SCROLL_ATTEMPTS) {
        window.requestAnimationFrame(tryScroll);
      }
    }

    window.requestAnimationFrame(tryScroll);

    return () => {
      cancelled = true;
    };
  }, [tripKey, anchorDate]);

  return { scrollRef, saveScrollPosition };
}
