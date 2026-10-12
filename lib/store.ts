import { Redis } from "@upstash/redis";

// Minimaler Key-Value-Speicher: Upstash Redis auf Vercel, In-Memory lokal.
export interface Store {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { nx?: boolean; px?: number }): Promise<boolean>;
  del(key: string): Promise<void>;
  hget<T>(key: string, field: string): Promise<T | null>;
  hset(key: string, values: Record<string, unknown>): Promise<void>;
  hincrby(key: string, field: string, by: number): Promise<number>;
  hgetall<T>(key: string): Promise<Record<string, T> | null>;
}

function upstash(): Store | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const r = new Redis({ url, token });
  return {
    get: (k) => r.get(k),
    async set(k, v, o) {
      const res = o?.nx
        ? await r.set(k, v, o.px ? { nx: true, px: o.px } : { nx: true })
        : await r.set(k, v, o?.px ? { px: o.px } : undefined);
      return res === "OK";
    },
    async del(k) {
      await r.del(k);
    },
    hget: (k, f) => r.hget(k, f),
    async hset(k, v) {
      await r.hset(k, v);
    },
    hincrby: (k, f, by) => r.hincrby(k, f, by),
    hgetall: (k) => r.hgetall(k),
  };
}

function memory(): Store {
  const g = globalThis as unknown as { __tawMem?: Map<string, { v: unknown; exp?: number }> };
  const m = (g.__tawMem ??= new Map());
  const read = (k: string) => {
    const e = m.get(k);
    if (e?.exp && e.exp < Date.now()) {
      m.delete(k);
      return undefined;
    }
    return e?.v;
  };
  const hash = (k: string) => {
    let h = read(k) as Record<string, unknown> | undefined;
    if (!h) m.set(k, { v: (h = {}) });
    return h;
  };
  return {
    get: async <T,>(k: string) => (read(k) ?? null) as T | null,
    async set(k, v, o) {
      if (o?.nx && read(k) !== undefined) return false;
      m.set(k, { v, exp: o?.px ? Date.now() + o.px : undefined });
      return true;
    },
    async del(k) {
      m.delete(k);
    },
    hget: async <T,>(k: string, f: string) => ((read(k) as Record<string, T> | undefined)?.[f] ?? null),
    async hset(k, v) {
      Object.assign(hash(k), v);
    },
    async hincrby(k, f, by) {
      const h = hash(k);
      h[f] = Number(h[f] ?? 0) + by;
      return h[f] as number;
    },
    hgetall: async <T,>(k: string) => (read(k) ?? null) as Record<string, T> | null,
  };
}

let cached: Store | undefined;
export function store(): Store {
  return (cached ??= upstash() ?? memory());
}
