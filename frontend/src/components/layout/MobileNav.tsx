"use client";

import Link from "next/link";
import { useWorkspace } from "@/lib/workspace";
import { cx } from "../ui/primitives";
import { NAV, hrefFor, type NavKey } from "./nav";

/** Bottom tab bar for phones and tablets (the sidebar takes over at lg). */
export function MobileNav({ current }: { current: NavKey }) {
  const ws = useWorkspace();
  const running = ws.history.some((t) => t.status === "running" || t.status === "queued");
  return (
    <nav aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 bg-surface-container-lowest/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_8px_rgba(0,0,0,0.25)] backdrop-blur-xl lg:hidden">
      {NAV.map((item) => {
        const active = item.key === current;
        return (
          <Link key={item.key} href={hrefFor(item, ws.activeId)} aria-current={active ? "page" : undefined}
            className={cx("relative flex flex-col items-center gap-1 py-2.5 font-mono text-label-code uppercase tracking-wider transition-colors",
              active ? "text-primary" : "text-on-surface-variant hover:text-on-surface")}>
            <item.icon className="h-5 w-5" />
            {item.short}
            {item.key === "live" && running && <span className="absolute right-[calc(50%-14px)] top-2 h-1.5 w-1.5 animate-pulse rounded-full bg-secondary" />}
          </Link>
        );
      })}
    </nav>
  );
}
