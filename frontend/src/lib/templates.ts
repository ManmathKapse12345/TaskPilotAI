import { Braces, FileSearch, Globe, ScrollText } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const MANDATORY_DEMO =
  "Crawl https://example.com, extract the important information, give me a summary, and return the extracted data in JSON format.";

export interface Template {
  title: string;
  description: string;
  tag: string;
  icon: LucideIcon;
  tone: "primary" | "secondary" | "tertiary" | "outline";
  prompt: string;
  /** The part of the prompt to pre-select so the user can type their own URL over it. */
  url: string;
}

/** Task blueprints. Each is a plain natural-language prompt sent unchanged to POST /api/chat. */
export const TEMPLATES: Template[] = [
  {
    title: "Crawl a website",
    description: "Crawl, extract, summarise, JSON",
    tag: "Full",
    icon: Globe,
    tone: "primary",
    prompt: MANDATORY_DEMO,
    url: "https://example.com",
  },
  {
    title: "Extract website data",
    description: "Headings, links, contacts",
    tag: "Data",
    icon: FileSearch,
    tone: "secondary",
    prompt: "Crawl 5 pages of https://books.toscrape.com and extract the headings, links, contact details and social profiles.",
    url: "https://books.toscrape.com",
  },
  {
    title: "Website summary",
    description: "Plain-language overview",
    tag: "AI",
    icon: ScrollText,
    tone: "tertiary",
    prompt: "Summarise https://www.python.org: what the site offers, its main sections and who it is for.",
    url: "https://www.python.org",
  },
  {
    title: "Homepage to JSON",
    description: "Single page, structured",
    tag: "JSON",
    icon: Braces,
    tone: "outline",
    prompt: "Crawl only the homepage of https://quotes.toscrape.com and return the extracted data in JSON format.",
    url: "https://quotes.toscrape.com",
  },
];

const URL_RE = /https?:\/\/[^\s<>"'`]+|(?<![@\w.-])(?:[a-z0-9-]+\.)+[a-z]{2,24}(?:\/[^\s<>"'`]*)?/i;
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|\[?::1\]?|169\.254\.)|\.(local|internal)$/i;

/** First URL in the text, for the "target" hint. The backend re-validates everything; this is only a preview. */
export function detectUrl(text: string): { url: string; host: string; risky: boolean } | null {
  const m = text.match(URL_RE);
  if (!m) return null;
  const url = m[0].replace(/[.,;:!?)\]}]+$/, "");
  const host = url.replace(/^https?:\/\//i, "").split(/[/:?#]/)[0].toLowerCase();
  if (!host.includes(".") && host !== "localhost") return null;
  return { url, host, risky: PRIVATE_HOST.test(host) };
}

export function describeError(err: unknown): { title: string; text: string } {
  const msg = (err as Error)?.message ?? String(err);
  if (err instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(msg)) {
    return { title: "Backend unreachable", text: "TaskPilot could not reach the API. Check that the backend is running on the configured URL, then try again." };
  }
  if (/^429/.test(msg) || /too many|busy/i.test(msg)) return { title: "Backend is busy", text: msg };
  if (/^404/.test(msg)) return { title: "Task not found", text: "This task no longer exists on the backend. It may have been deleted." };
  return { title: "Request rejected", text: msg };
}
