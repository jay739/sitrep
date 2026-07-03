import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { verifyAdminPassword, adminConfigured } from "$lib/server/auth";
import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "$lib/server/session";
import { rateLimit } from "$lib/server/rate-limit";

export const load: PageServerLoad = ({ locals }) => {
  if (locals.admin) redirect(303, "/admin");
  return { configured: adminConfigured() };
};

export const actions: Actions = {
  default: async ({ request, cookies, getClientAddress }) => {
    if (!rateLimit(`login:${getClientAddress()}`, 5, 5)) {
      return fail(429, {
        error: "Too many attempts. Wait a minute and try again.",
      });
    }

    if (!adminConfigured()) {
      return fail(503, {
        error:
          "ADMIN_PASSWORD is not set on the server, so the admin area is disabled.",
      });
    }

    const form = await request.formData();
    const password = form.get("password");
    if (
      typeof password !== "string" ||
      password.length === 0 ||
      password.length > 512
    ) {
      return fail(400, { error: "Enter the admin password." });
    }

    if (!verifyAdminPassword(password)) {
      return fail(400, { error: "Incorrect password." });
    }

    cookies.set(SESSION_COOKIE, createSessionToken(), sessionCookieOptions);
    redirect(303, "/admin");
  },
};
