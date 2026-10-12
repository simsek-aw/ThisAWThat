import { randomUUID } from "crypto";
import { cookies } from "next/headers";

const COOKIE = "taw_vid";

/** Anonyme Wähler-ID per Cookie (eine Stimme pro Gerät, änderbar). */
export async function voterId(create = false) {
  const jar = await cookies();
  let id = jar.get(COOKIE)?.value;
  if (!id && create) {
    id = randomUUID();
    jar.set(COOKIE, id, { httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 24 * 365, path: "/" });
  }
  return id;
}
