import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { pushNow } from "@/lib/vestaboard";

export async function POST() {
  if (!(await isAdmin())) return unauthorized();
  try {
    return NextResponse.json(await pushNow());
  } catch (e) {
    return NextResponse.json({ ok: false, reason: String(e) }, { status: 502 });
  }
}
