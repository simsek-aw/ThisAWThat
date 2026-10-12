"use client";

import { useCallback, useEffect, useState } from "react";

type Choice = "a" | "b";
interface State {
  question: { id: string; a: string; b: string; prompt?: string; endsAt: number };
  counts: { a: number; b: number };
  myVote: Choice | null;
}

const BAR = 22;

function Tiles({ share, side }: { share: number; side: Choice }) {
  const n = Math.round(share * BAR);
  return (
    <div className="tiles">
      {Array.from({ length: BAR }, (_, i) => (
        <div key={i} className={`tile ${i < n ? side : ""}`} />
      ))}
    </div>
  );
}

function timeLeft(ms: number) {
  if (ms <= 0) return "neue Frage kommt gleich";
  const h = Math.floor(ms / 3600_000);
  if (h >= 1) return `noch ${h} Std.`;
  return `noch ${Math.max(1, Math.round(ms / 60_000))} Min.`;
}

export default function VotePage() {
  const [s, setS] = useState<State | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/current", { cache: "no-store" });
    if (r.ok) setS(await r.json());
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 3000);
    return () => clearInterval(t);
  }, [load]);

  async function vote(choice: Choice) {
    if (!s || busy || s.myVote === choice) return;
    setBusy(true);
    setErr("");
    const prev = s;
    // sofort anzeigen, Server korrigiert danach
    const counts = { ...s.counts, [choice]: s.counts[choice] + 1 };
    if (s.myVote) counts[s.myVote] = Math.max(0, counts[s.myVote] - 1);
    setS({ ...s, counts, myVote: choice });
    const r = await fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: s.question.id, choice }),
    });
    if (r.ok) {
      const d = await r.json();
      setS((cur) => (cur ? { ...cur, counts: d.counts, myVote: d.myVote } : cur));
    } else {
      setS(prev);
      setErr((await r.json().catch(() => ({}))).error || "Hat nicht geklappt");
      load();
    }
    setBusy(false);
  }

  if (!s) return <main className="vote"><div className="logo">THIS <b>AW</b> THAT?</div></main>;

  const { question: q, counts: c } = s;
  const total = c.a + c.b;
  const share = (n: number) => (total ? n / total : 0);
  const pct = (n: number) => `${Math.round(share(n) * 100)}%`;

  return (
    <main className="vote">
      <div className="logo">THIS <b>AW</b> THAT?</div>
      {q.prompt && <h1 className="prompt">{q.prompt}</h1>}

      <div className="options">
        <button className={`opt a ${s.myVote === "a" ? "mine" : ""}`} onClick={() => vote("a")}>{q.a}</button>
        <span className="aw">AW</span>
        <button className={`opt b ${s.myVote === "b" ? "mine" : ""}`} onClick={() => vote("b")}>{q.b}</button>
      </div>

      {err && <div className="err">{err}</div>}

      <section className="results" aria-live="polite">
        <div className="row">
          <span className="label">{q.a}</span>
          <span className="num">{c.a} · {pct(c.a)}</span>
          <Tiles share={share(c.a)} side="a" />
        </div>
        <div className="row">
          <span className="label">{q.b}</span>
          <span className="num">{c.b} · {pct(c.b)}</span>
          <Tiles share={share(c.b)} side="b" />
        </div>
      </section>

      <div className="meta">
        {s.myVote ? "Deine Stimme ist drin – du kannst noch wechseln." : "Tippe auf deine Wahl."}
        <br />
        {total} {total === 1 ? "Stimme" : "Stimmen"} · {timeLeft(q.endsAt - Date.now())}
      </div>
    </main>
  );
}
