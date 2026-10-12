import { after } from "next/server";
import { store } from "./store";
import { getCounts, getCurrent, type Counts, type Current } from "./game";

// Vestaboard Flagship: 6 Zeilen × 22 Spalten, Zeichen-Codes laut Vestaboard-Doku.
const ROWS = 6;
const COLS = 22;
const BAR = 17;
const COLOR_A = 64; // Orange
const COLOR_B = 67; // Blau
// Read/Write-API erlaubt ca. 1 Nachricht / 15 s
const MIN_INTERVAL = 16_000;

const CHARS: Record<string, number> = {
  " ": 0, "!": 37, "@": 38, "#": 39, $: 40, "(": 41, ")": 42, "-": 44, "+": 46, "&": 47, "=": 48,
  ";": 49, ":": 50, "'": 52, '"': 53, "%": 54, ",": 55, ".": 56, "/": 59, "?": 60, "°": 62,
};

function codes(text: string): number[] {
  const t = text
    .toUpperCase()
    .replace(/Ä/g, "AE").replace(/Ö/g, "OE").replace(/Ü/g, "UE").replace(/ẞ|ß/g, "SS")
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
  return [...t].map((c) => {
    if (c >= "A" && c <= "Z") return c.charCodeAt(0) - 64;
    if (c >= "1" && c <= "9") return 26 + Number(c);
    if (c === "0") return 36;
    return CHARS[c] ?? 0;
  });
}

const blank = () => Array<number>(COLS).fill(0);
function center(text: string) {
  const c = codes(text).slice(0, COLS);
  const row = blank();
  row.splice(Math.floor((COLS - c.length) / 2), c.length, ...c);
  return row;
}
function leftRight(left: string, right: string) {
  const r = codes(right);
  const l = codes(left).slice(0, COLS - r.length - 1);
  const row = blank();
  row.splice(0, l.length, ...l);
  row.splice(COLS - r.length, r.length, ...r);
  return row;
}
function bar(share: number, votes: number, color: number) {
  let n = Math.round(share * BAR);
  if (votes > 0 && n === 0) n = 1;
  const row = blank();
  row.fill(color, 0, n);
  const pct = codes(`${Math.round(share * 100)}%`);
  row.splice(COLS - pct.length, pct.length, ...pct);
  return row;
}

export function layout(q: Pick<Current, "a" | "b" | "prompt">, c: Counts): number[][] {
  const total = c.a + c.b;
  const sa = total ? c.a / total : 0;
  const sb = total ? c.b / total : 0;
  const rows = [
    center(q.prompt || "THIS AW THAT?"),
    leftRight(q.a, String(c.a)),
    bar(sa, c.a, COLOR_A),
    leftRight(q.b, String(c.b)),
    bar(sb, c.b, COLOR_B),
    center(process.env.VESTABOARD_FOOTER || "JETZT VOTEN!"),
  ];
  return rows.slice(0, ROWS);
}

const boardKey = () => (process.env.VESTABOARD_TOKEN || process.env.VESTABOARD_RW_KEY || "").trim();
export const boardConfigured = () => Boolean(boardKey());

export interface BoardStatus {
  ok: boolean;
  at: number;
  info: string;
}
export const getBoardStatus = () => store().get<BoardStatus>("taw:vb:status");

async function post(url: string, headers: Record<string, string>, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, text: (await res.text()).slice(0, 300) };
}

async function send(chars: number[][]) {
  const key = boardKey();
  // Aktuelle Cloud API (Token aus web.vestaboard.com → Developer) …
  let r = await post(process.env.VESTABOARD_API_URL || "https://cloud.vestaboard.com/", { "X-Vestaboard-Token": key }, { characters: chars });
  let api = "Cloud API";
  // … ältere Read/Write-Keys laufen noch über rw.vestaboard.com
  if (r.status === 401 || r.status === 403) {
    const old = await post("https://rw.vestaboard.com/", { "X-Vestaboard-Read-Write-Key": key }, chars);
    if (old.status < 400 || old.status === 409) [r, api] = [old, "Read/Write API"];
    else r = { status: r.status, text: `${r.text} | Read/Write API ${old.status}: ${old.text}` };
  }
  // 409 = gleicher Inhalt wie auf dem Board → kein Fehler
  const ok = r.status < 400 || r.status === 409;
  const status: BoardStatus = { ok, at: Date.now(), info: ok ? `${api} ${r.status}` : `Vestaboard ${r.status}: ${r.text}` };
  await store().set("taw:vb:status", status);
  if (!ok) throw new Error(status.info);
}

const LOCK = "taw:vb:lock";
const DIRTY = "taw:vb:dirty";
const PENDING = "taw:vb:pending";

async function sendCurrent() {
  const cur = await getCurrent();
  if (!cur) return { ok: false, reason: "Keine aktive Frage" };
  await send(layout(cur, await getCounts(cur.id)));
  return { ok: true };
}

/** Aktuellen Stand sofort aufs Board schicken (Admin, Fragenwechsel). */
export async function pushNow() {
  if (!boardConfigured()) return { ok: false, reason: "VESTABOARD_TOKEN fehlt" };
  await store().set(LOCK, Date.now(), { px: MIN_INTERVAL });
  await store().del(DIRTY);
  return sendCurrent();
}

/**
 * Schickt den Stand, wenn es seit dem letzten Senden neue Stimmen gab und das
 * API-Limit es zulässt. Wird bei jeder Stimme und bei jedem Abruf der Seite aufgerufen
 * (die Seite fragt alle 3 s nach) – so braucht es keine Hintergrund-Timer.
 */
export async function flushBoard() {
  if (!boardConfigured()) return;
  const s = store();
  if (!(await s.get(DIRTY))) return;
  if (!(await s.set(LOCK, Date.now(), { nx: true, px: MIN_INTERVAL }))) return;
  await s.del(DIRTY);
  try {
    await sendCurrent();
  } catch (e) {
    console.error("Vestaboard:", e);
  }
}

/** Nach jeder Stimme aufrufen. */
export async function scheduleBoardUpdate() {
  if (!boardConfigured()) return;
  const s = store();
  await s.set(DIRTY, Date.now());
  await flushBoard();
  // Falls gerade niemand die Seite offen hat: einmal nach Ablauf des Limits nachsenden
  if (await s.set(PENDING, 1, { nx: true, px: MIN_INTERVAL + 2_000 })) {
    after(async () => {
      await new Promise((r) => setTimeout(r, MIN_INTERVAL + 1_000));
      await flushBoard();
    });
  }
}
