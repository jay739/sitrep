import { fail } from "@sveltejs/kit";
import { z } from "zod";
import type { Actions, PageServerLoad } from "./$types";
import { db } from "$lib/server/db";
import { COMPONENT_STATUSES } from "$lib/status";

export const load: PageServerLoad = () => {
  const components = db
    .prepare(
      "SELECT id, name, description, status, display_order FROM components ORDER BY display_order, name",
    )
    .all() as Array<{
    id: number;
    name: string;
    description: string;
    status: string;
    display_order: number;
  }>;
  return { components };
};

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(300).default(""),
});

const updateSchema = z.object({
  id: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(300).default(""),
  status: z.enum(COMPONENT_STATUSES),
  display_order: z.coerce.number().int().min(0).max(9999),
});

const idSchema = z.object({ id: z.coerce.number().int().positive() });

export const actions: Actions = {
  create: async ({ request }) => {
    const parsed = createSchema.safeParse(
      Object.fromEntries(await request.formData()),
    );
    if (!parsed.success)
      return fail(400, { error: "A component needs a name (max 100 chars)." });
    try {
      db.prepare(
        "INSERT INTO components (name, description, display_order) VALUES (?, ?, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM components))",
      ).run(parsed.data.name, parsed.data.description);
    } catch {
      return fail(400, { error: "A component with that name already exists." });
    }
    return { done: `Component "${parsed.data.name}" created.` };
  },

  update: async ({ request }) => {
    const parsed = updateSchema.safeParse(
      Object.fromEntries(await request.formData()),
    );
    if (!parsed.success)
      return fail(400, { error: "Invalid component values." });
    const { id, name, description, status, display_order } = parsed.data;
    try {
      db.prepare(
        "UPDATE components SET name = ?, description = ?, status = ?, display_order = ? WHERE id = ?",
      ).run(name, description, status, display_order, id);
    } catch {
      return fail(400, { error: "A component with that name already exists." });
    }
    return { done: `Component "${name}" saved.` };
  },

  remove: async ({ request }) => {
    const parsed = idSchema.safeParse(
      Object.fromEntries(await request.formData()),
    );
    if (!parsed.success) return fail(400, { error: "Invalid component." });
    db.prepare("DELETE FROM components WHERE id = ?").run(parsed.data.id);
    return { done: "Component deleted, along with its history and bindings." };
  },
};
