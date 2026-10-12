import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getQueue, newQuestion, setQueue } from "@/lib/game";

// POST {a, b, prompt?} → hinten anhängen · DELETE ?id= → entfernen · PATCH {id, dir} → verschieben
export async function POST(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const { a, b, prompt } = (await req.json().catch(() => ({}))) as { a?: string; b?: string; prompt?: string };
  if (!a?.trim() || !b?.trim()) return NextResponse.json({ error: "Beide Optionen ausfüllen" }, { status: 400 });
  const queue = await getQueue();
  queue.push(newQuestion(a, b, prompt));
  await setQueue(queue);
  return NextResponse.json({ queue });
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const id = new URL(req.url).searchParams.get("id");
  const queue = (await getQueue()).filter((q) => q.id !== id);
  await setQueue(queue);
  return NextResponse.json({ queue });
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return unauthorized();
  const { id, dir } = (await req.json().catch(() => ({}))) as { id?: string; dir?: number };
  const queue = await getQueue();
  const i = queue.findIndex((q) => q.id === id);
  const j = i + (dir ?? 0);
  if (i >= 0 && j >= 0 && j < queue.length) [queue[i], queue[j]] = [queue[j], queue[i]];
  await setQueue(queue);
  return NextResponse.json({ queue });
}
