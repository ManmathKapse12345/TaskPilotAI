"use client";

import { useCallback, useEffect, useState } from "react";

/** Per-browser conveniences only (saved results, UI preferences). Task data itself lives in the backend DB. */
export interface Prefs {
  autoScroll: boolean;
  expandExecution: boolean;
  sidebarCollapsed: boolean;
}

const DEFAULTS: Prefs = { autoScroll: true, expandExecution: true, sidebarCollapsed: false };
const PREFS_KEY = "taskpilot.prefs.v1";
const SAVED_KEY = "taskpilot.saved.v1";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode etc.) - preference just won't persist */
  }
}

export function usePrefs() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  useEffect(() => {
    setPrefs(read(PREFS_KEY, DEFAULTS)); // eslint-disable-line react-hooks/set-state-in-effect -- hydrate after mount
  }, []);
  const update = useCallback((patch: Partial<Prefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      write(PREFS_KEY, next);
      return next;
    });
  }, []);
  return [prefs, update] as const;
}

export function useSaved() {
  const [saved, setSaved] = useState<string[]>([]);
  useEffect(() => {
    setSaved(read<{ ids: string[] }>(SAVED_KEY, { ids: [] }).ids); // eslint-disable-line react-hooks/set-state-in-effect -- hydrate after mount
  }, []);
  const persist = (ids: string[]) => { write(SAVED_KEY, { ids }); return ids; };
  const toggle = useCallback((id: string) => {
    setSaved((s) => persist(s.includes(id) ? s.filter((x) => x !== id) : [id, ...s]));
  }, []);
  const remove = useCallback((id: string) => setSaved((s) => persist(s.filter((x) => x !== id))), []);
  const clear = useCallback(() => setSaved(persist([])), []);
  return { saved, toggle, remove, clear };
}
