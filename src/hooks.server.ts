import type { Handle } from "@sveltejs/kit";
import { SESSION_COOKIE, verifySessionToken } from "$lib/server/session";

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.admin = verifySessionToken(event.cookies.get(SESSION_COOKIE));

  const response = await resolve(event);

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );

  return response;
};
