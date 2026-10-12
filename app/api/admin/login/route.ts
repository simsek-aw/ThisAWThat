import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminToken, checkPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (!checkPassword(password ?? "")) return NextResponse.json({ error: "Falsches Passwort" }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, adminToken(), { httpOnly: true, sameSite: "strict", secure: true, path: "/", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
