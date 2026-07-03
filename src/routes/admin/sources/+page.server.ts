import { fail } from "@sveltejs/kit";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import type { Actions, PageServerLoad } from "./$types";
import { db } from "$lib/server/db";

export const load: PageServerLoad = () => {
  const sources = db
    .prepare(
      `SELECT s.id, s.name, s.kind, s.token, s.auto_create,
			        (SELECT COUNT(*) FROM bindings b WHERE b.source_id = s.id) AS bound
			 FROM sources s ORDER BY s.created_at`,
    )
    .all() as Array<{
    id: number;
    name: string;
    kind: string;
    token: string;
    auto_create: number;
    bound: number;
  }>;
  return { sources };
};

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  // Only Uptime Kuma ingest is implemented so far; the enum widens when
  // Alertmanager and generic ingest land.
  kind: z.enum(["kuma"]),
});

const idSchema = z.object({ id: z.coerce.number().int().positive() });

export const actions: Actions = {
  create: async ({ request }) => {
    const parsed = createSchema.safeParse(
      Object.fromEntries(await request.formData()),
    );
    if (!parsed.success) return fail(400, { error: "A source needs a name." });
    const token = randomBytes(24).toString("base64url");
    db.prepare(
      "INSERT INTO sources (name, kind, token, auto_create) VALUES (?, ?, ?, 1)",
    ).run(parsed.data.name, parsed.data.kind, token);
    return { done: `Source "${parsed.data.name}" created.` };
  },

  toggleAuto: async ({ request }) => {
    const parsed = idSchema.safeParse(
      Object.fromEntries(await request.formData()),
    );
    if (!parsed.success) return fail(400, { error: "Invalid source." });
    db.prepare(
      "UPDATE sources SET auto_create = 1 - auto_create WHERE id = ?",
    ).run(parsed.data.id);
    return { done: "Auto-create setting flipped." };
  },

  remove: async ({ request }) => {
    const parsed = idSchema.safeParse(
      Object.fromEntries(await request.formData()),
    );
    if (!parsed.success) return fail(400, { error: "Invalid source." });
    db.prepare("DELETE FROM sources WHERE id = ?").run(parsed.data.id);
    return {
      done: "Source deleted. Its webhook URL stops working immediately.",
    };
  },
};
