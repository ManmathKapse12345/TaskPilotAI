"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, Code2, Database, FileJson, ListOrdered, Minimize2, Search, ShieldCheck, X } from "lucide-react";
import { jsonToTypeScript } from "@/lib/jsonTypes";
import { cx, formatBytes } from "../ui/primitives";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Tab = "formatted" | "tree" | "raw" | "types" | "data";
const LINE_CAP = 4000;

/**
 * Stitch "Structured JSON Schema Viewer & Interactive Inspector". Renders the backend's JSON with React
 * nodes only (no innerHTML). `extra` adds a tab for a custom view (e.g. the extracted-data browser).
 */
export function JsonViewer({ value, nodePath, onClearNode, extra, meta }: {
  value: unknown;
  /** Path of the node being shown, e.g. `data.pages[2]`. */
  nodePath: string;
  onClearNode?: () => void;
  extra?: { label: string; render: () => ReactNode };
  meta?: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("formatted");
  const [lineNumbers, setLineNumbers] = useState(true);
  const [query, setQuery] = useState("");
  const [tree, setTree] = useState({ gen: 0, depth: 2 });
  const [showAll, setShowAll] = useState(false);

  const pretty = useMemo(() => JSON.stringify(value, null, 2) ?? "null", [value]);
  const minified = useMemo(() => JSON.stringify(value) ?? "null", [value]);
  const types = useMemo(() => (tab === "types" ? jsonToTypeScript(value) : ""), [tab, value]);
  const size = useMemo(() => new Blob([pretty]).size, [pretty]);
  const lines = useMemo(() => pretty.split("\n"), [pretty]);
  const q = query.trim().toLowerCase();
  const hits = useMemo(() => (q ? lines.reduce((n, l) => n + (l.toLowerCase().includes(q) ? 1 : 0), 0) : 0), [lines, q]);

  const tabs: { key: Tab; label: string; icon: typeof FileJson }[] = [
    { key: "formatted", label: "Structured JSON", icon: FileJson },
    { key: "tree", label: "Tree", icon: ChevronsUpDown },
    { key: "raw", label: "Minified", icon: Minimize2 },
    { key: "types", label: "TS Types", icon: Code2 },
    ...(extra ? [{ key: "data" as Tab, label: extra.label, icon: Database }] : []),
  ];

  return (
    <div className="relative flex min-w-0 flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-md">
      <div className="flex flex-col items-stretch justify-between gap-2 bg-surface-container-low px-3 py-1 sm:flex-row sm:items-center">
        <div role="tablist" className="flex items-center gap-1 overflow-x-auto rounded-lg bg-surface-container p-1 no-scrollbar">
          {tabs.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
              className={cx("flex shrink-0 items-center gap-1.5 rounded px-3 py-1 text-label-md font-medium transition-colors",
                tab === t.key ? "bg-surface-container-high text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface")}>
              <t.icon className="h-3.5 w-3.5" /><span>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 self-end sm:self-center">
          {tab === "tree" && (
            <>
              <ToolBtn label="Expand all" onClick={() => setTree((t) => ({ gen: t.gen + 1, depth: 99 }))}><ChevronsUpDown className="h-4 w-4" /></ToolBtn>
              <ToolBtn label="Collapse all" onClick={() => setTree((t) => ({ gen: t.gen + 1, depth: 1 }))}><ChevronsDownUp className="h-4 w-4" /></ToolBtn>
            </>
          )}
          {tab === "formatted" && (
            <>
              <ToolBtn label="Toggle line numbers" onClick={() => setLineNumbers((v) => !v)} active={lineNumbers}><ListOrdered className="h-4 w-4" /></ToolBtn>
              <label className="flex items-center rounded-lg bg-surface-container px-2 py-1 text-on-surface-variant focus-within:ring-1 focus-within:ring-primary/40">
                <Search className="h-3.5 w-3.5" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search JSON…" aria-label="Search JSON"
                  className="w-28 border-0 bg-transparent px-1 font-mono text-code-sm text-on-surface outline-none placeholder:text-on-surface-variant" />
                {q && <span className="font-mono text-label-code text-secondary">{hits}</span>}
              </label>
            </>
          )}
        </div>
      </div>

      <div className="relative max-h-[720px] min-h-[420px] w-full overflow-auto bg-surface-container-lowest p-3 font-mono text-code-sm lg:min-h-[580px]">
        {tab === "formatted" && (
          <>
            <Highlighted lines={showAll ? lines : lines.slice(0, LINE_CAP)} numbers={lineNumbers} query={q} />
            {lines.length > LINE_CAP && !showAll && (
              <button type="button" onClick={() => setShowAll(true)} className="mt-2 rounded bg-surface-container px-2 py-1 text-label-md text-secondary hover:bg-surface-container-high">
                Show all {lines.length.toLocaleString()} lines
              </button>
            )}
          </>
        )}
        {tab === "tree" && <div className="leading-6"><Node key={tree.gen} value={value as Json} depth={0} openDepth={tree.depth} last /></div>}
        {tab === "raw" && <pre className="whitespace-pre-wrap break-all leading-6 text-on-surface-variant">{minified}</pre>}
        {tab === "types" && <pre className="leading-6 text-on-surface"><TsHighlight code={types} /></pre>}
        {tab === "data" && extra && <div className="font-sans">{extra.render()}</div>}

        {tab !== "data" && (
          <div className="sticky bottom-0 ml-auto mt-3 flex w-fit items-center gap-2 rounded-full bg-surface-container-high/90 px-3 py-1.5 font-mono text-code-sm text-on-surface shadow-md backdrop-blur-md">
            <span className="flex items-center gap-1.5 text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary" />{lines.length.toLocaleString()} lines</span>
            <span className="text-on-surface-variant/40">•</span>
            <span className="text-on-surface-variant">{formatBytes(size)}</span>
            <span className="text-on-surface-variant/40">•</span>
            <span className="flex items-center gap-1 text-secondary"><ShieldCheck className="h-3.5 w-3.5" />CLI output</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 bg-surface-container-low px-3 py-2 font-mono text-code-sm text-on-surface-variant">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-label-code uppercase tracking-wider text-on-surface-variant/70">Selected node:</span>
          <span className="truncate text-primary">{nodePath}</span>
          {onClearNode && (
            <button type="button" onClick={onClearNode} aria-label="Show the full document" title="Show the full document" className="shrink-0 rounded p-0.5 hover:bg-surface-container hover:text-on-surface">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {meta && <div className="hidden shrink-0 items-center gap-1 sm:flex">{meta}</div>}
      </div>
    </div>
  );
}

function ToolBtn({ label, active, children, onClick }: { label: string; active?: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} aria-pressed={active}
      className={cx("rounded-lg bg-surface-container p-1.5 transition-colors hover:bg-surface-container-high", active ? "text-primary" : "text-on-surface-variant hover:text-on-surface")}>
      {children}
    </button>
  );
}

/* ---------- formatted view: line-numbered syntax highlighting ---------- */

const TOKEN = /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g;

function tokenClass(tok: string, isKey: boolean) {
  if (tok.startsWith('"')) return isKey ? "font-medium text-secondary" : "text-primary";
  if (tok === "true" || tok === "false") return "text-tertiary";
  if (tok === "null") return "text-outline";
  return "text-[#acedff]";
}

function Highlighted({ lines, numbers, query }: { lines: string[]; numbers: boolean; query: string }) {
  const width = String(lines.length).length;
  return (
    <div className="leading-6">
      {lines.map((line, i) => {
        const parts: ReactNode[] = [];
        let last = 0;
        for (const m of line.matchAll(TOKEN)) {
          if (m.index! > last) parts.push(<span key={`p${last}`} className="text-on-surface-variant">{line.slice(last, m.index)}</span>);
          parts.push(<span key={`t${m.index}`} className={tokenClass(m[0], !!m[2])}>{m[0]}</span>);
          last = m.index! + m[0].length;
        }
        if (last < line.length) parts.push(<span key={`p${last}`} className="text-on-surface-variant">{line.slice(last)}</span>);
        const hit = query && line.toLowerCase().includes(query);
        return (
          <div key={i} className={cx("flex", hit && "-mx-1 rounded bg-secondary/10 px-1")}>
            {numbers && <span className="shrink-0 select-none pr-3 text-right text-on-surface-variant/40" style={{ minWidth: `${width + 1}ch` }}>{String(i + 1).padStart(2, "0")}</span>}
            <span className="whitespace-pre text-on-surface">{parts}</span>
          </div>
        );
      })}
    </div>
  );
}

function TsHighlight({ code }: { code: string }) {
  const parts = code.split(/(\bexport\b|\binterface\b|\btype\b|\bstring\b|\bnumber\b|\bboolean\b|\bnull\b|\bunknown\b|"[^"]*")/g);
  return (
    <>
      {parts.map((p, i) => {
        const c = /^(export|interface|type)$/.test(p) ? "text-tertiary" : /^(string|number|boolean|null|unknown)$/.test(p) ? "text-primary" : p.startsWith('"') ? "text-secondary" : undefined;
        return <span key={i} className={c}>{p}</span>;
      })}
    </>
  );
}

/* ---------- tree view ---------- */

function Scalar({ v }: { v: Json }) {
  if (v === null) return <span className="text-outline">null</span>;
  if (typeof v === "string") return <span className="whitespace-pre-wrap break-all text-primary">&quot;{v}&quot;</span>;
  if (typeof v === "number") return <span className="text-[#acedff]">{v}</span>;
  return <span className="text-tertiary">{String(v)}</span>;
}

function Node({ name, value, depth, openDepth, last }: { name?: string; value: Json; depth: number; openDepth: number; last: boolean }) {
  const isObj = value !== null && typeof value === "object";
  const [open, setOpen] = useState(depth < openDepth);
  const key = name != null && <><span className="font-medium text-secondary">&quot;{name}&quot;</span><span className="text-on-surface-variant">: </span></>;
  const comma = last ? null : <span className="text-on-surface-variant">,</span>;

  if (!isObj) return <div className="pl-4">{key}<Scalar v={value} />{comma}</div>;

  const arr = Array.isArray(value);
  const entries: [string | undefined, Json][] = arr ? (value as Json[]).map((v) => [undefined, v]) : Object.entries(value as Record<string, Json>);
  const [o, c] = arr ? ["[", "]"] : ["{", "}"];

  if (entries.length === 0) return <div className="pl-4">{key}<span className="text-on-surface-variant">{o}{c}</span>{comma}</div>;

  return (
    <div className={depth === 0 ? "" : "pl-4"}>
      <button type="button" onClick={() => setOpen((x) => !x)} className="-ml-4 inline-flex items-baseline text-left hover:bg-white/[0.03]" aria-expanded={open}>
        <ChevronRight className={cx("mr-0.5 h-3 w-3 self-center text-on-surface-variant transition-transform", open && "rotate-90")} />
        {key}<span className="text-on-surface-variant">{o}</span>
        {!open && <span className="mx-1 rounded bg-surface-container px-1 text-label-code text-on-surface-variant">{entries.length} {arr ? "items" : "keys"}</span>}
        {!open && <span className="text-on-surface-variant">{c}</span>}
        {!open && comma}
      </button>
      {open && (
        <>
          <div className="border-l border-line">
            {entries.map(([k, v], i) => (
              <Node key={k ?? i} name={k} value={v} depth={depth + 1} openDepth={openDepth} last={i === entries.length - 1} />
            ))}
          </div>
          <div><span className="text-on-surface-variant">{c}</span>{comma}</div>
        </>
      )}
    </div>
  );
}
