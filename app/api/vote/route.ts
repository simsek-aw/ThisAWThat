import { NextResponse } from "next/server";
import { getCounts, getCurrent, vote, type Choice } from "@/lib/game";
import { voterId } from "@/lib/voter";
import { scheduleBoardUpdate } from "@/lib/vestaboard";

export async function POST(req: Request) {
  const { id, choice } = (await req.json().catch(() => ({}))) as { id?: string; choice?: Choice };
  if (choice !== "a" && choice !== "b") return NextResponse.json({ error: "Ungültige Wahl" }, { status: 400 });
  const q = await getCurrent();
  if (!q || q.id !== id) return NextResponse.json({ error: "Frage ist nicht mehr aktiv" }, { status: 409 });

  const vid = (await voterId(true))!;
  if (await vote(q.id, vid, choice)) await scheduleBoardUpdate();
  return NextResponse.json({ counts: await getCounts(q.id), myVote: choice });
}
