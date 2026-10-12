"use client";

import { useCallback, useEffect, useState } from "react";

interface Question { id: string; a: string; b: string; prompt?: string }
interface Current extends Question { startedAt: number; source: string }
interface Archived extends Current { endedAt: number; votesA: number; votesB: number }
interface AdminState {
  current: Current | null;
  counts: { a: number; b: number } | null;
  preview: number[][] | null;
  queue: Question[];
  history: Archived[];
  rotateHours: number;
  board: boolean;
  ai: boolean;
}

const COLORS: Record<number, string> = { 63: "#d6362b", 64: "#f5871f", 65: "#f2c14e", 66: "#3aa55b", 67: "#2f7fd8", 68: "#7b4fc4", 69: "#f4f1ea", 70: "#000" };
const SYMBOLS: Record<number, string> = { 37: "!", 38: "@", 39: "#", 40: "$", 41: "(", 42: ")", 44: "-", 46: "+", 47: "&", 48: "=", 49: ";", 50: ":", 52: "'", 53: '"', 54: "%", 55: ",", 56: ".", 59: "/", 60: "?", 62: "°" };
const glyph = (n: number) =>
  n >= 1 && n <= 26 ? String.fromCharCode(64 + n) : n >= 27 && n <= 35 ? String(n - 26) : n === 36 ? "0" : SYMBOLS[n] ?? "";

const api = async (url: string, method = "GET", body?: unknown) => {
  const r = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || d.reason || `Fehler ${r.status}`), { status: r.status });
  return d;
};

const fmt = (t: number) => new Date(t).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function Login({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  return (
    <main className="admin">
      <form
        className="card"
        style={{ maxWidth: 360, margin: "15vh auto 0", width: "100%" }}
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api("/api/admin/login", "POST", { password: pw });
            onDone();
          } catch (e) {
            setErr((e as Error).message);
          }
        }}
      >
        <h2>Admin · This AW That</h2>
        <input className="field" type="password" placeholder="Passwort" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        <button className="btn primary">Anmelden</button>
        {err && <span className="warn">{err}</span>}
      </form>
    </main>
  );
}

export default function AdminPage() {
  const [s, setS] = useState<AdminState | null>(null);
  const [auth, setAuth] = useState<boolean | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ a: "", b: "", prompt: "" });
  const [ideas, setIdeas] = useState<Question[]>([]);

  const load = useCallback(async () => {
    try {
      setS(await api("/api/admin/state"));
      setAuth(true);
    } catch (e) {
      if ((e as { status?: number }).status === 401) setAuth(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    setMsg("");
    try {
      const r = (await fn()) as { board?: { ok: boolean; reason?: string } } | undefined;
      if (r?.board && !r.board.ok) setMsg(`Board: ${r.board.reason}`);
      else if (ok) setMsg(ok);
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    }
    setBusy(false);
  };

  if (auth === false) return <Login onDone={load} />;
  if (!s) return <main className="admin"><p className="small">Lädt …</p></main>;

  const c = s.counts;
  const add = (q: { a: string; b: string; prompt?: string }) => api("/api/admin/queue", "POST", q);

  return (
    <main className="admin">
      <header>
        <h1>THIS AW THAT · ADMIN</h1>
        <div className="btns">
          <a className="btn ghost" href="/" target="_blank">Abstimmungsseite ↗</a>
          <button className="btn ghost" onClick={() => run(() => api("/api/admin/logout", "POST")).then(() => setAuth(false))}>Abmelden</button>
        </div>
      </header>

      {msg && <div className="card warn">{msg}</div>}

      <section className="card">
        <h2>Aktuelle Frage</h2>
        {s.current ? (
          <>
            <div className="item">
              <span className="q">
                {s.current.prompt && <span className="small">{s.current.prompt} · </span>}
                {s.current.a} <i>AW</i> {s.current.b}
              </span>
              <span className="small">
                {c?.a} : {c?.b} · seit {fmt(s.current.startedAt)} · Wechsel ~{fmt(s.current.startedAt + s.rotateHours * 3600_000)}
              </span>
            </div>
            {s.preview && (
              <div className="board" aria-label="Vestaboard-Vorschau">
                {s.preview.map((row, i) => (
                  <div className="r" key={i}>
                    {row.map((n, j) => (
                      <div className="c" key={j} style={COLORS[n] ? { background: COLORS[n] } : undefined}>{glyph(n)}</div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="small">Noch keine Frage aktiv.</p>
        )}
        <div className="btns">
          <button className="btn primary" disabled={busy} onClick={() => run(() => api("/api/admin/activate", "POST", {}), "Nächste Frage gestartet")}>
            Nächste Frage jetzt starten
          </button>
          <button className="btn" disabled={busy || !s.board} onClick={() => run(() => api("/api/admin/push", "POST"), "Ans Vestaboard gesendet")}>
            Aufs Vestaboard senden
          </button>
          <span className={`small ${s.board ? "ok" : "warn"}`}>{s.board ? "● Vestaboard verbunden" : "● VESTABOARD_RW_KEY fehlt"}</span>
        </div>
      </section>

      <section className="card">
        <h2>Frage hinzufügen</h2>
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await add(form);
              setForm({ a: "", b: "", prompt: "" });
            }, "Zur Warteschlange hinzugefügt");
          }}
        >
          <input className="field" placeholder="Option 1 (z. B. Pizza)" maxLength={22} value={form.a} onChange={(e) => setForm({ ...form, a: e.target.value })} />
          <input className="field" placeholder="Option 2 (z. B. Burger)" maxLength={22} value={form.b} onChange={(e) => setForm({ ...form, b: e.target.value })} />
          <input className="field wide" placeholder="Überschrift (optional, Standard: THIS AW THAT?)" maxLength={22} value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} />
          <div className="btns wide">
            <button className="btn primary" disabled={busy || !form.a.trim() || !form.b.trim()}>In Warteschlange</button>
            <button
              type="button"
              className="btn"
              disabled={busy || !form.a.trim() || !form.b.trim()}
              onClick={() => run(async () => {
                const r = await api("/api/admin/activate", "POST", form);
                setForm({ a: "", b: "", prompt: "" });
                return r;
              }, "Sofort gestartet")}
            >
              Sofort starten
            </button>
            <button type="button" className="btn" disabled={busy || !s.ai} title={s.ai ? "" : "ANTHROPIC_API_KEY fehlt"}
              onClick={() => run(async () => setIdeas((await api("/api/admin/generate", "POST")).suggestions))}>
              ✨ KI-Vorschläge
            </button>
          </div>
        </form>
        {ideas.length > 0 && (
          <div className="list">
            {ideas.map((q) => (
              <div className="item" key={q.id}>
                <span className="q">{q.a} <i>AW</i> {q.b}</span>
                <button className="btn" disabled={busy} onClick={() => run(async () => {
                  await add(q);
                  setIdeas((l) => l.filter((x) => x.id !== q.id));
                })}>+ Warteschlange</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Warteschlange ({s.queue.length})</h2>
        {s.queue.length === 0 && (
          <p className="small">Leer – beim nächsten Wechsel {s.ai ? "erfindet die KI eine Frage" : "kommt eine Frage aus der eingebauten Liste"}.</p>
        )}
        <div className="list">
          {s.queue.map((q, i) => (
            <div className="item" key={q.id}>
              <span className="q">
                {i + 1}. {q.prompt && <span className="small">{q.prompt} · </span>}{q.a} <i>AW</i> {q.b}
              </span>
              <div className="btns">
                <button className="btn" disabled={busy || i === 0} onClick={() => run(() => api("/api/admin/queue", "PATCH", { id: q.id, dir: -1 }))}>↑</button>
                <button className="btn" disabled={busy || i === s.queue.length - 1} onClick={() => run(() => api("/api/admin/queue", "PATCH", { id: q.id, dir: 1 }))}>↓</button>
                <button className="btn" disabled={busy} onClick={() => run(() => api("/api/admin/activate", "POST", { id: q.id }), "Gestartet")}>Jetzt starten</button>
                <button className="btn" disabled={busy} onClick={() => run(() => api(`/api/admin/queue?id=${q.id}`, "DELETE"))}>Entfernen</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Verlauf</h2>
        {s.history.length === 0 && <p className="small">Noch nichts.</p>}
        <div className="list">
          {s.history.map((h) => (
            <div className="item" key={h.id + h.endedAt}>
              <span className="q">
                <b style={{ color: h.votesA >= h.votesB ? "var(--a)" : undefined }}>{h.a}</b> <i>AW</i>{" "}
                <b style={{ color: h.votesB >= h.votesA ? "var(--b)" : undefined }}>{h.b}</b>
              </span>
              <span className="small">{h.votesA} : {h.votesB} · {fmt(h.startedAt)}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
