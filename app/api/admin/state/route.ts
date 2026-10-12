import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { getCounts, getCurrent, getHistory, getQueue, ROTATE_HOURS } from "@/lib/game";
import { boardConfigured, getBoardStatus, layout } from "@/lib/vestaboard";
import { store, storeKind } from "@/lib/store";

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
    boardStatus: await getBoardStatus(),
    ai: Boolean(process.env.ANTHROPIC_API_KEY),
    diag: {
      storage: storeKind(),
      redisEnv: Object.keys(process.env).filter((k) => /REDIS|KV_/.test(k)),
      tokenVar: process.env.VESTABOARD_TOKEN ? "VESTABOARD_TOKEN" : process.env.VESTABOARD_RW_KEY ? "VESTABOARD_RW_KEY" : null,
      commit: (process.env.VERCEL_GIT_COMMIT_SHA || "lokal").slice(0, 7),
      env: process.env.VERCEL_ENV || "lokal",
      lastVote: await store().get<number>("taw:lastVote"),
      pending: Boolean(await store().get("taw:vb:dirty")),
    },
  });
}
