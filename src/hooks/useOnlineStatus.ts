"use client";

import { useEffect, useState } from "react";

/** Stable on server + first client paint; real value after mount (avoids hydration mismatch). */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    function onUp() {
      setOnline(true);
    }
    function onDown() {
      setOnline(false);
    }
    window.addEventListener("online", onUp);
    window.addEventListener("offline", onDown);
    return () => {
      window.removeEventListener("online", onUp);
      window.removeEventListener("offline", onDown);
    };
  }, []);

  return online;
}
