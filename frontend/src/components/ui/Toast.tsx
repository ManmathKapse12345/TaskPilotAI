"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cx } from "./primitives";

type Tone = "success" | "error" | "info";
interface Toast { id: number; tone: Tone; title: string; body?: string }

const ToastCtx = createContext<(t: Omit<Toast, "id">) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

const ICON = { success: CheckCircle2, error: AlertCircle, info: Info };
const TONE = { success: "text-primary", error: "text-error", info: "text-primary" };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((all) => [...all.slice(-3), { ...t, id }]);
    setTimeout(() => dismiss(id), t.tone === "error" ? 6000 : 3200);
  }, [dismiss]);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end">
        {toasts.map((t) => {
          const Icon = ICON[t.tone];
          return (
            <div key={t.id} role="status"
              className="animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line-strong bg-surface-container/95 px-3.5 py-3 shadow-2xl shadow-black/40 backdrop-blur">
              <Icon className={cx("mt-0.5 h-4 w-4 shrink-0", TONE[t.tone])} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-on-surface">{t.title}</div>
                {t.body && <div className="mt-0.5 break-words text-xs text-on-surface-variant">{t.body}</div>}
              </div>
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-outline hover:text-on-surface"><X className="h-3.5 w-3.5" /></button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
