import { redirect, type Handle } from "@sveltejs/kit";
import { SESSION_COOKIE, verifySessionToken } from "$lib/server/session";

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.admin = verifySessionToken(event.cookies.get(SESSION_COOKIE));

  // Admin enforcement lives HERE, not only in the layout load: SvelteKit
  // runs form actions before layout loads, so a layout guard alone lets an
  // unauthenticated POST execute the action before the redirect fires.
  const path = event.url.pathname;
  if (
    path.startsWith("/admin") &&
    path !== "/admin/login" &&
    !event.locals.admin
  ) {
    if (event.request.method === "GET" || event.request.method === "HEAD") {
      redirect(303, "/admin/login");
    }
    return new Response(
      JSON.stringify({ ok: false, error: "authentication required" }),
      {
        status: 403,
        headers: { "content-type": "application/json" },
      },
    );
  }

  const response = await resolve(event);

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );

  return response;
};
