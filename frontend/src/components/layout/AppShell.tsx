"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useWorkspace } from "@/lib/workspace";
import { COMPOSER_ID } from "../chat/Composer";
import { RunDetails } from "../chat/RunDetails";
import { AppSidebar } from "./AppSidebar";
import { MainHeader } from "./MainHeader";
import { SettingsDialog } from "./SettingsDialog";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const ws = useWorkspace();
  const [menu, setMenu] = useState(false);
  const current = pathname.startsWith("/history") ? "history" : "chat";
  const { newChat, openThread } = ws;

  const startNew = useCallback(() => {
    newChat();
    setMenu(false);
    router.push("/");
    setTimeout(() => document.getElementById(COMPOSER_ID)?.focus(), 120);
  }, [newChat, router]);

  const open = useCallback((id: string) => {
    openThread(id);
    setMenu(false);
    router.push(`/?task=${id}`);
  }, [openThread, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest("input, textarea, select, [contenteditable]");
      if (e.altKey && e.key.toLowerCase() === "n") { e.preventDefault(); startNew(); }
      else if (e.key === "/" && !typing) { e.preventDefault(); document.getElementById(COMPOSER_ID)?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [startNew]);

  return (
    <div className="flex h-dvh overflow-hidden bg-surface text-on-surface">
      <AppSidebar open={menu} onClose={() => setMenu(false)} onNew={startNew} onOpen={open} current={current} />
      <div id="main-scroll" className="flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
        <MainHeader current={current} onMenu={() => setMenu(true)} onNew={startNew} />
        <main className="w-full flex-1 px-4 pt-4 sm:px-6 lg:px-8">{children}</main>
      </div>
      <RunDetails />
      <SettingsDialog />
    </div>
  );
}
