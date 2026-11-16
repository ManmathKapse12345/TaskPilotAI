"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { useWorkspace } from "@/lib/workspace";
import { AppSidebar } from "./AppSidebar";
import { MainHeader } from "./MainHeader";
import { MobileNav } from "./MobileNav";
import { NAV, hrefFor, navFor } from "./nav";
import { SettingsDialog } from "./SettingsDialog";

export const COMPOSER_ID = "directive-input";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const ws = useWorkspace();
  const nav = navFor(pathname);
  const chord = useRef<number>(0);
  const { activeId, setActiveId } = ws;

  const newTask = useCallback(() => {
    setActiveId(null);
    router.push("/");
    // wait for the workspace route to mount before focusing the directive box
    setTimeout(() => document.getElementById(COMPOSER_ID)?.focus(), 120);
  }, [router, setActiveId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest("input, textarea, select, [contenteditable]");
      if (e.altKey && e.key.toLowerCase() === "n") { e.preventDefault(); newTask(); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") { e.preventDefault(); document.getElementById("global-search")?.focus(); return; }
      const k = e.key.toLowerCase();
      if (k === "g") { chord.current = Date.now(); return; }
      if (Date.now() - chord.current < 1200) {
        const item = NAV.find((n) => n.chord === k);
        if (item) { e.preventDefault(); chord.current = 0; router.push(hrefFor(item, activeId)); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newTask, router, activeId]);

  return (
    <div className="flex h-dvh overflow-hidden bg-surface text-on-surface">
      <AppSidebar current={nav.key} onNew={newTask} />
      <div id="main-scroll" className="flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
        <MainHeader nav={nav} />
        <main className="w-full flex-1 px-4 pb-28 pt-4 sm:px-6 lg:px-8 lg:pb-8 lg:pt-6">{children}</main>
      </div>
      <MobileNav current={nav.key} />
      <SettingsDialog />
    </div>
  );
}
