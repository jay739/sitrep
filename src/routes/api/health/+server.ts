import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { config } from "$lib/server/config";
import { APP_VERSION } from "$lib/version";

export const GET: RequestHandler = () => {
  let dbOk = false;
  try {
    db.prepare("SELECT 1").get();
    dbOk = true;
  } catch {
    // Reported via the boolean; details stay in server logs only.
  }

  return json(
    {
      ok: dbOk,
      version: APP_VERSION,
      mode: config.demoMode ? "demo" : "live",
    },
    { status: dbOk ? 200 : 503 },
  );
};
