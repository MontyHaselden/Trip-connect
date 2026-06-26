"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";

/** Scroll `target` to the top of `scroller` with optional padding. */
export function scrollElementToTop(
  scroller: HTMLElement,
  target: HTMLElement,
  padding = 12,
): void {
  const scrollerRect = scroller.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  scroller.scrollTop = Math.max(
    0,
    targetRect.top - scrollerRect.top + scroller.scrollTop - padding,
  );
}

/**
 * Preserves calendar scroll position across re-renders and command dispatch.
 * Initial scroll-to-trip is handled by InteractiveTripCalendar once cells mount.
 */
export function useCalendarScroll() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const savedScrollTop = useRef(0);
  const userHasScrolled = useRef(false);

  const saveScrollPosition = useCallback(() => {
    if (scrollRef.current) {
      savedScrollTop.current = scrollRef.current.scrollTop;
      userHasScrolled.current = true;
    }
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      savedScrollTop.current = el.scrollTop;
      userHasScrolled.current = true;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useLayoutEffect(() => {
    if (!userHasScrolled.current) return;
    const el = scrollRef.current;
    if (!el) return;
    if (Math.abs(el.scrollTop - savedScrollTop.current) > 1) {
      el.scrollTop = savedScrollTop.current;
    }
  });

  const rememberScrollPosition = useCallback((scrollTop: number) => {
    savedScrollTop.current = scrollTop;
    userHasScrolled.current = true;
  }, []);

  return { scrollRef, saveScrollPosition, rememberScrollPosition };
}

export function useCalendarInitialScroll(params: {
  scrollRef: RefObject<HTMLDivElement | null>;
  anchorDate: string;
  scrollKey: string;
  contentReady: boolean;
  onInitialScroll?: (scrollTop: number) => void;
}) {
  const hasAutoScrolled = useRef(false);
  const lastScrollKey = useRef("");

  useLayoutEffect(() => {
    if (lastScrollKey.current !== params.scrollKey) {
      lastScrollKey.current = params.scrollKey;
      hasAutoScrolled.current = false;
    }

    if (hasAutoScrolled.current || !params.contentReady || !params.anchorDate) return;

    const scroller = params.scrollRef.current;
    if (!scroller) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 80;

    function tryScroll(): boolean {
      const anchor = scroller!.querySelector(
        `[data-calendar-day="${params.anchorDate}"]`,
      ) as HTMLElement | null;
      if (!anchor) return false;
      scrollElementToTop(scroller!, anchor);
      hasAutoScrolled.current = true;
      params.onInitialScroll?.(scroller!.scrollTop);
      return true;
    }

    function tick() {
      if (cancelled || hasAutoScrolled.current) return;
      if (tryScroll()) return;
      attempts += 1;
      if (attempts < maxAttempts) {
        window.requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      cancelled = true;
    };
  }, [params.scrollKey, params.anchorDate, params.contentReady, params.scrollRef, params.onInitialScroll]);
}
