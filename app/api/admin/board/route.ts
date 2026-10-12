import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { boardConfigured, readBoard } from "@/lib/vestaboard";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  if (!boardConfigured()) return NextResponse.json({ error: "Token fehlt" }, { status: 400 });
  try {
    return NextResponse.json(await readBoard());
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
