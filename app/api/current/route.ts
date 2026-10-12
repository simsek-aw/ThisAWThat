import { NextResponse } from "next/server";
import { activate, getCounts, getCurrent, getVote, ROTATE_HOURS } from "@/lib/game";
import { voterId } from "@/lib/voter";

export const dynamic = "force-dynamic";

export async function GET() {
  const q = (await getCurrent()) ?? (await activate());
  const vid = await voterId();
  return NextResponse.json({
    question: { id: q.id, a: q.a, b: q.b, prompt: q.prompt, endsAt: q.startedAt + ROTATE_HOURS * 3600_000 },
    counts: await getCounts(q.id),
    myVote: vid ? await getVote(q.id, vid) : null,
  });
}
