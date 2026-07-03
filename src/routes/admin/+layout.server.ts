import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = ({ locals, url }) => {
  if (url.pathname !== "/admin/login" && !locals.admin) {
    redirect(303, "/admin/login");
  }
  return { admin: locals.admin };
};
