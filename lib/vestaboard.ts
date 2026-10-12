import { waitUntil } from "@vercel/functions";
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

export const boardConfigured = () => Boolean(process.env.VESTABOARD_RW_KEY);

async function send(chars: number[][]) {
  const res = await fetch(process.env.VESTABOARD_API_URL || "https://rw.vestaboard.com/", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Vestaboard-Read-Write-Key": process.env.VESTABOARD_RW_KEY! },
    body: JSON.stringify(chars),
  });
  // 409 = gleicher Inhalt wie auf dem Board → kein Fehler
  if (!res.ok && res.status !== 409) throw new Error(`Vestaboard ${res.status}: ${await res.text()}`);
}

/** Aktuellen Stand sofort aufs Board schicken. */
export async function pushNow() {
  if (!boardConfigured()) return { ok: false, reason: "VESTABOARD_RW_KEY fehlt" };
  const cur = await getCurrent();
  if (!cur) return { ok: false, reason: "Keine aktive Frage" };
  await store().set("taw:vb:lock", Date.now(), { px: MIN_INTERVAL });
  await send(layout(cur, await getCounts(cur.id)));
  return { ok: true };
}

/**
 * Nach jeder Stimme aufrufen: schickt sofort, oder – wenn gerade erst gesendet wurde –
 * plant genau ein Update nach Ablauf des Limits (mit dem dann neuesten Stand).
 */
export async function scheduleBoardUpdate() {
  if (!boardConfigured()) return;
  const s = store();
  const now = Date.now();
  if (await s.set("taw:vb:lock", now, { nx: true, px: MIN_INTERVAL })) {
    const cur = await getCurrent();
    if (cur) waitUntil(getCounts(cur.id).then((c) => send(layout(cur, c))).catch(console.error));
    return;
  }
  const lockedAt = (await s.get<number>("taw:vb:lock")) ?? now;
  const wait = Math.max(1000, lockedAt + MIN_INTERVAL - now + 500);
  if (!(await s.set("taw:vb:pending", 1, { nx: true, px: wait + 15_000 }))) return;
  waitUntil(
    (async () => {
      await new Promise((r) => setTimeout(r, wait));
      try {
        await pushNow();
      } catch (e) {
        console.error(e);
      } finally {
        await s.del("taw:vb:pending");
      }
    })(),
  );
}
