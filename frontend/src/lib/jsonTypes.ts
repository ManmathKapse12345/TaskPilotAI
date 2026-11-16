/** Derives TypeScript declarations from a JSON value (used by the "TypeScript Types" tab). Pure and deterministic. */

type Shape =
  | { k: "prim"; t: "string" | "number" | "boolean" | "null" }
  | { k: "arr"; of: Shape[] }
  | { k: "obj"; fields: Map<string, { shapes: Shape[]; seen: number }>; count: number }
  | { k: "unknown" };

function shapeOf(v: unknown): Shape {
  if (v === null) return { k: "prim", t: "null" };
  if (Array.isArray(v)) return { k: "arr", of: merge(v.map(shapeOf)) };
  if (typeof v === "object") {
    const fields = new Map<string, { shapes: Shape[]; seen: number }>();
    for (const [key, val] of Object.entries(v as Record<string, unknown>)) fields.set(key, { shapes: [shapeOf(val)], seen: 1 });
    return { k: "obj", fields, count: 1 };
  }
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return { k: "prim", t: typeof v as "string" | "number" | "boolean" };
  return { k: "unknown" };
}

/** Merges shapes so all objects in an array become one interface (keys missing in some become optional). */
function merge(shapes: Shape[]): Shape[] {
  const out: Shape[] = [];
  let obj: Extract<Shape, { k: "obj" }> | null = null;
  const arrays: Shape[] = [];
  for (const s of shapes) {
    if (s.k === "obj") {
      if (!obj) { obj = { k: "obj", fields: new Map(), count: 0 }; out.push(obj); }
      obj.count += s.count;
      for (const [key, f] of s.fields) {
        const cur = obj.fields.get(key);
        if (cur) { cur.shapes = merge([...cur.shapes, ...f.shapes]); cur.seen += f.seen; }
        else obj.fields.set(key, { shapes: [...f.shapes], seen: f.seen });
      }
    } else if (s.k === "arr") {
      arrays.push(...s.of);
      if (!out.some((o) => o.k === "arr")) out.push({ k: "arr", of: [] });
    } else if (!out.some((o) => o.k === s.k && (o.k !== "prim" || (s.k === "prim" && o.t === s.t)))) {
      out.push(s);
    }
  }
  const arr = out.find((o) => o.k === "arr") as Extract<Shape, { k: "arr" }> | undefined;
  if (arr) arr.of = merge(arrays);
  return out;
}

const pascal = (s: string) => s.replace(/(^|[^a-zA-Z0-9]+)([a-zA-Z0-9])/g, (_, __, c: string) => c.toUpperCase()).replace(/^[^a-zA-Z]+/, "") || "Item";
const singular = (s: string) => (s.endsWith("ies") ? `${s.slice(0, -3)}y` : s.endsWith("s") && !s.endsWith("ss") ? s.slice(0, -1) : s);
const safeKey = (k: string) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k));

export function jsonToTypeScript(value: unknown, rootName = "TaskPilotResult"): string {
  const decls: string[] = [];
  const used = new Set<string>();
  const nameFor = (base: string) => {
    let n = pascal(base);
    for (let i = 2; used.has(n); i++) n = `${pascal(base)}${i}`;
    used.add(n);
    return n;
  };

  const render = (shapes: Shape[], hint: string): string => {
    const parts = shapes.map((s) => {
      if (s.k === "prim") return s.t;
      if (s.k === "unknown") return "unknown";
      if (s.k === "arr") {
        if (!s.of.length) return "unknown[]";
        const inner = render(s.of, singular(hint));
        return s.of.length > 1 ? `(${inner})[]` : `${inner}[]`;
      }
      const name = nameFor(hint);
      const lines = [...s.fields].map(([k, f]) => `  ${safeKey(k)}${f.seen < s.count ? "?" : ""}: ${render(f.shapes, k)};`);
      decls.push(`export interface ${name} {\n${lines.join("\n")}\n}`);
      return name;
    });
    return parts.length ? parts.join(" | ") : "unknown";
  };

  const root = render([shapeOf(value)], rootName);
  if (root !== pascal(rootName)) decls.push(`export type ${pascal(rootName)} = ${root};`);
  return decls.reverse().join("\n\n") + "\n";
}
