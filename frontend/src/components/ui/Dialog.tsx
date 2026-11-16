"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "./primitives";

export function Dialog({ open, onClose, title, description, children }: {
  open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-fade-up relative flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-line-strong bg-surface-container-lowest shadow-2xl sm:rounded-xl">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-on-surface">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-outline">{description}</p>}
          </div>
          <IconButton label="Close" onClick={onClose}><X className="h-4 w-4" /></IconButton>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
