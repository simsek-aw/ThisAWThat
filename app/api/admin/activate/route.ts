import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { activate, getQueue, newQuestion, setQueue } from "@/lib/game";
import { pushNow } from "@/lib/vestaboard";

// Sofort neue Frage starten: {id} aus der Warteschlange, {a, b} direkt, oder {} = nächste
export async function POST(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { id?: string; a?: string; b?: string; prompt?: string };
  let next;
  if (body.id) {
    const queue = await getQueue();
    next = queue.find((q) => q.id === body.id);
    if (!next) return NextResponse.json({ error: "Nicht in der Warteschlange" }, { status: 404 });
    await setQueue(queue.filter((q) => q.id !== body.id));
    next = { ...next, source: "queue" as const };
  } else if (body.a?.trim() && body.b?.trim()) {
    next = { ...newQuestion(body.a, body.b, body.prompt), source: "manual" as const };
  }
  const current = await activate(next);
  const board = await pushNow().catch((e) => ({ ok: false, reason: String(e) }));
  return NextResponse.json({ current, board });
}
