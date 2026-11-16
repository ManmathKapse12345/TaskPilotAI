"use client";

import { useEffect, useState } from "react";

/** Current time in seconds, ticking only while `active` (for live elapsed timers). */
export function useNow(active: boolean, every = 250) {
  // 0 during prerender (no task is shown there); real time once mounted in the browser.
  const [now, setNow] = useState(() => (typeof window === "undefined" ? 0 : Date.now() / 1000));
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now() / 1000), every);
    return () => clearInterval(t);
  }, [active, every]);
  return now;
}
