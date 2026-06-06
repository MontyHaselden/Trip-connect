"use client";

import { useEffect, useState } from "react";

export function useTypewriterText(text: string, active: boolean, charsPerTick = 2) {
  const [visible, setVisible] = useState(active ? "" : text);

  useEffect(() => {
    if (!active) {
      setVisible(text);
      return;
    }

    setVisible("");
    let index = 0;
    const interval = window.setInterval(() => {
      index = Math.min(text.length, index + charsPerTick);
      setVisible(text.slice(0, index));
      if (index >= text.length) {
        window.clearInterval(interval);
      }
    }, 24);

    return () => window.clearInterval(interval);
  }, [active, text, charsPerTick]);

  return visible;
}
