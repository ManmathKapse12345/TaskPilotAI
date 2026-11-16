/**
 * The backend accepts a single natural-language `message` (POST /api/chat) and its intent engine
 * (backend/app/ai/intent_engine.py) reads the target URL, "N pages", "only the homepage", "deep crawl",
 * "summary" and "JSON" from that text. The workspace form controls are therefore turned into plain
 * sentences appended to the user's directive; the exact message is shown before it is sent.
 * The API contract is unchanged.
 */
export type Scope = "auto" | "homepage" | "standard" | "deep";
export type Output = "auto" | "both" | "json" | "summary";

export interface DirectiveInput {
  url: string;
  directive: string;
  /** null = let the backend choose its default */
  maxPages: number | null;
  scope: Scope;
  output: Output;
}

export const MAX_MESSAGE = 4000; // ChatRequest.message max_length

export function normalizeUrl(raw: string): string {
  const u = raw.trim();
  if (!u) return "";
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

export function composeDirective(i: DirectiveInput): string {
  const parts: string[] = [];
  const directive = i.directive.trim();
  const url = normalizeUrl(i.url);
  const bare = url.replace(/^https?:\/\//i, "").replace(/\/$/, "").toLowerCase();

  if (url && !directive.toLowerCase().includes(bare)) parts.push(directive ? `Target website: ${url}.` : `Crawl ${url}.`);
  if (directive) parts.push(/[.!?]$/.test(directive) ? directive : `${directive}.`);

  if (i.scope === "homepage") parts.push("Crawl only the homepage.");
  else if (i.scope === "deep") parts.push("Do a deep crawl of the entire site.");
  if (i.maxPages != null && i.scope !== "homepage") parts.push(`Crawl up to ${i.maxPages} pages.`);

  if (i.output === "both") parts.push("Give me a summary and return the extracted data in JSON format.");
  else if (i.output === "json") parts.push("Return the extracted data in JSON format.");
  else if (i.output === "summary") parts.push("Give me a summary.");

  return parts.join(" ");
}
