import { NextResponse } from "next/server";
import { rotateIfDue } from "@/lib/game";
import { pushNow } from "@/lib/vestaboard";

export const dynamic = "force-dynamic";

// Vercel Cron ruft das täglich auf; gewechselt wird nur, wenn ROTATE_HOURS (48 h) um sind.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const q = await rotateIfDue();
  if (q) await pushNow().catch(console.error);
  return NextResponse.json({ rotated: Boolean(q), question: q });
}
