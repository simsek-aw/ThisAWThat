import { randomUUID } from "crypto";
import { store } from "./store";
import { FALLBACK } from "./fallback";
import { generateQuestions } from "./ai";

export type Choice = "a" | "b";
export interface Question {
  id: string;
  a: string;
  b: string;
  prompt?: string;
}
export interface Current extends Question {
  startedAt: number;
  source: "queue" | "ai" | "fallback" | "manual";
}
export interface Archived extends Current {
  endedAt: number;
  votesA: number;
  votesB: number;
}
export interface Counts {
  a: number;
  b: number;
}

const K = {
  current: "taw:current",
  queue: "taw:queue",
  history: "taw:history",
  votes: (id: string) => `taw:votes:${id}`,
  voters: (id: string) => `taw:voters:${id}`,
};

export const ROTATE_HOURS = Number(process.env.ROTATE_HOURS || 48);

export function newQuestion(a: string, b: string, prompt?: string): Question {
  return { id: randomUUID().slice(0, 8), a: a.trim(), b: b.trim(), prompt: prompt?.trim() || undefined };
}

export const getCurrent = () => store().get<Current>(K.current);
export const getQueue = async () => (await store().get<Question[]>(K.queue)) ?? [];
export const getHistory = async () => (await store().get<Archived[]>(K.history)) ?? [];
export const setQueue = (q: Question[]) => store().set(K.queue, q);

export async function getCounts(id: string): Promise<Counts> {
  const h = await store().hgetall<number>(K.votes(id));
  return { a: Math.max(0, Number(h?.a ?? 0)), b: Math.max(0, Number(h?.b ?? 0)) };
}

export async function getVote(id: string, voter: string) {
  return store().hget<Choice>(K.voters(id), voter);
}

/** Stimme abgeben oder ändern. Gibt true zurück, wenn sich etwas geändert hat. */
export async function vote(id: string, voter: string, choice: Choice): Promise<boolean> {
  const s = store();
  const prev = await s.hget<Choice>(K.voters(id), voter);
  if (prev === choice) return false;
  await s.hset(K.voters(id), { [voter]: choice });
  await s.hincrby(K.votes(id), choice, 1);
  if (prev) await s.hincrby(K.votes(id), prev, -1);
  return true;
}

/** Aktuelle Frage archivieren und die nächste starten. */
export async function activate(next?: Question & { source?: Current["source"] }): Promise<Current> {
  const s = store();
  const cur = await getCurrent();
  const history = await getHistory();
  if (cur) {
    const c = await getCounts(cur.id);
    history.unshift({ ...cur, endedAt: Date.now(), votesA: c.a, votesB: c.b });
    await s.set(K.history, history.slice(0, 50));
  }

  let q: Question | undefined = next;
  let source: Current["source"] = next?.source ?? "manual";
  if (!q) {
    const queue = await getQueue();
    q = queue.shift();
    source = "queue";
    if (q) await setQueue(queue);
  }
  if (!q) {
    const recent = history.map((h) => `${h.a} / ${h.b}`);
    q = (await generateQuestions(1, recent).catch((e) => (console.error("KI-Fehler", e), [])))[0];
    source = "ai";
  }
  if (!q) {
    const used = new Set(history.map((h) => `${h.a}|${h.b}`.toLowerCase()));
    const pool = FALLBACK.filter(([a, b]) => !used.has(`${a}|${b}`.toLowerCase()));
    const [a, b] = (pool.length ? pool : FALLBACK)[Math.floor(Math.random() * (pool.length || FALLBACK.length))];
    q = newQuestion(a, b);
    source = "fallback";
  }

  const current: Current = { id: q.id, a: q.a, b: q.b, prompt: q.prompt, startedAt: Date.now(), source };
  await s.set(K.current, current);
  return current;
}

export async function rotateIfDue(): Promise<Current | null> {
  const cur = await getCurrent();
  // 1 h Toleranz, damit ein täglicher Cron zuverlässig jeden 2. Tag wechselt
  if (cur && Date.now() - cur.startedAt < (ROTATE_HOURS - 1) * 3600_000) return null;
  return activate();
}
