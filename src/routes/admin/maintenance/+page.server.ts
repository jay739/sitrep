import { fail } from "@sveltejs/kit";
import { z } from "zod";
import type { Actions, PageServerLoad } from "./$types";
import { db } from "$lib/server/db";

export const load: PageServerLoad = () => {
  const maintenances = db
    .prepare(
      `SELECT m.id, m.title, m.body, m.starts_at, m.ends_at,
			        (SELECT GROUP_CONCAT(c.name, ', ')
			         FROM maintenance_components mc JOIN components c ON c.id = mc.component_id
			         WHERE mc.maintenance_id = m.id) AS component_names
			 FROM maintenances m ORDER BY m.starts_at DESC LIMIT 50`,
    )
    .all() as Array<{
    id: number;
    title: string;
    body: string;
    starts_at: number;
    ends_at: number;
    component_names: string | null;
  }>;

  const components = db
    .prepare("SELECT id, name FROM components ORDER BY display_order, name")
    .all() as Array<{ id: number; name: string }>;

  return { maintenances, components };
};

// datetime-local has no timezone; values are interpreted in the server's
// timezone, which is the sane default for a single-operator tool and is
// called out in the form label.
const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(5000).default(""),
  starts_at: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "invalid start"),
  ends_at: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "invalid end"),
});

const idSchema = z.object({ id: z.coerce.number().int().positive() });

export const actions: Actions = {
  create: async ({ request }) => {
    const form = await request.formData();
    const parsed = createSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) {
      return fail(400, {
        error: "Title, a valid start, and a valid end are required.",
      });
    }

    const starts = Math.floor(Date.parse(parsed.data.starts_at) / 1000);
    const ends = Math.floor(Date.parse(parsed.data.ends_at) / 1000);
    if (ends <= starts) {
      return fail(400, { error: "The window must end after it starts." });
    }

    const maintenanceId = Number(
      db
        .prepare(
          "INSERT INTO maintenances (title, body, starts_at, ends_at) VALUES (?, ?, ?, ?)",
        )
        .run(parsed.data.title, parsed.data.body, starts, ends).lastInsertRowid,
    );

    const link = db.prepare(
      "INSERT OR IGNORE INTO maintenance_components (maintenance_id, component_id) VALUES (?, ?)",
    );
    for (const value of form.getAll("components")) {
      const componentId = Number(value);
      if (Number.isInteger(componentId) && componentId > 0)
        link.run(maintenanceId, componentId);
    }

    return { done: `Maintenance "${parsed.data.title}" scheduled.` };
  },

  remove: async ({ request }) => {
    const parsed = idSchema.safeParse(
      Object.fromEntries(await request.formData()),
    );
    if (!parsed.success)
      return fail(400, { error: "Invalid maintenance window." });
    db.prepare("DELETE FROM maintenances WHERE id = ?").run(parsed.data.id);
    return { done: "Maintenance window deleted." };
  },
};
