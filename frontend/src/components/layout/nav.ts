import { Braces, BrainCircuit, History, SquareTerminal } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavKey = "workspace" | "live" | "results" | "history";

export interface NavItem {
  key: NavKey;
  href: "/" | "/live" | "/results" | "/history";
  label: string;
  short: string;
  title: string;
  icon: LucideIcon;
  /** second key of the "G <key>" shortcut */
  chord: string;
  /** whether the route shows a specific task (?id=) */
  taskScoped: boolean;
}

export const NAV: NavItem[] = [
  { key: "workspace", href: "/", label: "Agent Workspace", short: "Workspace", title: "Workspace", icon: BrainCircuit, chord: "w", taskScoped: false },
  { key: "live", href: "/live", label: "Live CLI Execution", short: "Live CLI", title: "Live CLI Execution", icon: SquareTerminal, chord: "l", taskScoped: true },
  { key: "results", href: "/results", label: "Results & Schema", short: "Data/JSON", title: "Results & Schema", icon: Braces, chord: "r", taskScoped: true },
  { key: "history", href: "/history", label: "Task History", short: "Tasks", title: "Task History", icon: History, chord: "h", taskScoped: false },
];

export function navFor(pathname: string): NavItem {
  return NAV.find((n) => n.href !== "/" && pathname.startsWith(n.href)) ?? NAV[0];
}

export function hrefFor(item: NavItem, taskId: string | null): string {
  return item.taskScoped && taskId ? `${item.href}?id=${encodeURIComponent(taskId)}` : item.href;
}
