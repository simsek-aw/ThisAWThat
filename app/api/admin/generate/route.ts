import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { generateQuestions } from "@/lib/ai";
import { getHistory, getQueue } from "@/lib/game";

// KI-Vorschläge holen (werden nicht automatisch gespeichert)
export async function POST() {
  if (!(await isAdmin())) return unauthorized();
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY fehlt" }, { status: 400 });
  const avoid = [...(await getQueue()), ...(await getHistory())].map((q) => `${q.a} / ${q.b}`);
  try {
    return NextResponse.json({ suggestions: await generateQuestions(6, avoid) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
