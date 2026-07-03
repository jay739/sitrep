import { createHmac, timingSafeEqual } from "node:crypto";
import { sessionSecret } from "./config";

const SESSION_TTL_SECONDS = 60 * 60 * 12;

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret)
    .update(payload)
    .digest("base64url");
}

export function createSessionToken(now = Date.now()): string {
  const expires = Math.floor(now / 1000) + SESSION_TTL_SECONDS;
  const payload = `admin.${expires}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(
  token: string | undefined,
  now = Date.now(),
): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "admin") return false;

  const expires = Number(parts[1]);
  if (!Number.isInteger(expires) || expires * 1000 < now) return false;

  const expected = Buffer.from(sign(`${parts[0]}.${parts[1]}`));
  const actual = Buffer.from(parts[2]);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const SESSION_COOKIE = "sitrep_session";

export const sessionCookieOptions = {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  secure: true,
  maxAge: SESSION_TTL_SECONDS,
} as const;
