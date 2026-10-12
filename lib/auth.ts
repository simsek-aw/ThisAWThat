import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const ADMIN_COOKIE = "taw_admin";

const token = () => createHmac("sha256", process.env.ADMIN_PASSWORD || "").update("taw-admin").digest("hex");

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export function checkPassword(pw: string) {
  return Boolean(process.env.ADMIN_PASSWORD) && same(pw, process.env.ADMIN_PASSWORD!);
}

export function adminToken() {
  return token();
}

export async function isAdmin() {
  if (!process.env.ADMIN_PASSWORD) return false;
  const c = (await cookies()).get(ADMIN_COOKIE)?.value;
  return Boolean(c) && same(c!, token());
}

export const unauthorized = () => NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
