import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getCounts, getCurrent, getHistory, getQueue, ROTATE_HOURS } from "@/lib/game";
import { boardConfigured, layout } from "@/lib/vestaboard";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  const current = await getCurrent();
  const counts = current ? await getCounts(current.id) : null;
  return NextResponse.json({
    current,
    counts,
    preview: current && counts ? layout(current, counts) : null,
    queue: await getQueue(),
    history: (await getHistory()).slice(0, 20),
    rotateHours: ROTATE_HOURS,
    board: boardConfigured(),
    ai: Boolean(process.env.ANTHROPIC_API_KEY),
  });
}
