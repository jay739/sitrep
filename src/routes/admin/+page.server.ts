import { fail, redirect } from "@sveltejs/kit";
import { z } from "zod";
import type { Actions, PageServerLoad } from "./$types";
import { db } from "$lib/server/db";
import { SESSION_COOKIE } from "$lib/server/session";
import { notifyTelegram, incidentMessage } from "$lib/server/notify";
import { INCIDENT_STATUSES, SEVERITIES } from "$lib/status";

export const load: PageServerLoad = () => {
  const incidents = db
    .prepare(
      `SELECT id, title, severity, status, created_at, resolved_at
			 FROM incidents ORDER BY (status = 'resolved'), created_at DESC LIMIT 50`,
    )
    .all() as Array<{
    id: number;
    title: string;
    severity: string;
    status: string;
    created_at: number;
    resolved_at: number | null;
  }>;

  const components = db
    .prepare("SELECT id, name FROM components ORDER BY display_order, name")
    .all() as Array<{ id: number; name: string }>;

  return { incidents, components };
};

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  severity: z.enum(SEVERITIES),
  body: z.string().trim().min(1).max(5000),
});

const updateSchema = z.object({
  incidentId: z.coerce.number().int().positive(),
  status: z.enum(INCIDENT_STATUSES),
  body: z.string().trim().min(1).max(5000),
  postmortem: z.string().trim().max(20000).optional(),
});

const idSchema = z.object({ id: z.coerce.number().int().positive() });

function componentIds(form: FormData): number[] {
  return form
    .getAll("components")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0);
}

export const actions: Actions = {
  logout: ({ cookies }) => {
    cookies.delete(SESSION_COOKIE, { path: "/" });
    redirect(303, "/admin/login");
  },

  create: async ({ request }) => {
    const form = await request.formData();
    const parsed = createSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) {
      return fail(400, {
        error: "Title, severity, and an initial update are required.",
      });
    }

    const { title, severity, body } = parsed.data;
    const now = Math.floor(Date.now() / 1000);

    const incidentId = Number(
      db
        .prepare(
          "INSERT INTO incidents (title, severity, status, created_at) VALUES (?, ?, 'investigating', ?)",
        )
        .run(title, severity, now).lastInsertRowid,
    );
    db.prepare(
      "INSERT INTO incident_updates (incident_id, status, body, created_at) VALUES (?, 'investigating', ?, ?)",
    ).run(incidentId, body, now);

    const link = db.prepare(
      "INSERT OR IGNORE INTO incident_components (incident_id, component_id) VALUES (?, ?)",
    );
    for (const componentId of componentIds(form)) {
      link.run(incidentId, componentId);
    }

    void notifyTelegram(
      incidentMessage("opened", title, "investigating", severity, body),
    );
    return { done: `Incident "${title}" opened.` };
  },

  update: async ({ request }) => {
    const form = await request.formData();
    const parsed = updateSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) {
      return fail(400, { error: "A status and update text are required." });
    }

    const { incidentId, status, body, postmortem } = parsed.data;
    const incident = db
      .prepare("SELECT title, severity FROM incidents WHERE id = ?")
      .get(incidentId) as { title: string; severity: string } | undefined;
    if (!incident) {
      return fail(404, { error: "That incident no longer exists." });
    }

    const now = Math.floor(Date.now() / 1000);
    db.prepare(
      "INSERT INTO incident_updates (incident_id, status, body, created_at) VALUES (?, ?, ?, ?)",
    ).run(incidentId, status, body, now);

    if (status === "resolved") {
      db.prepare(
        "UPDATE incidents SET status = ?, resolved_at = ?, postmortem = COALESCE(NULLIF(?, ''), postmortem) WHERE id = ?",
      ).run(status, now, postmortem ?? "", incidentId);
    } else {
      db.prepare(
        "UPDATE incidents SET status = ?, resolved_at = NULL WHERE id = ?",
      ).run(status, incidentId);
    }

    void notifyTelegram(
      incidentMessage(
        "updated",
        incident.title,
        status,
        incident.severity,
        body,
      ),
    );
    return { done: `Update posted to "${incident.title}".` };
  },

  remove: async ({ request }) => {
    const parsed = idSchema.safeParse(
      Object.fromEntries(await request.formData()),
    );
    if (!parsed.success) return fail(400, { error: "Invalid incident." });
    db.prepare("DELETE FROM incidents WHERE id = ?").run(parsed.data.id);
    return { done: "Incident deleted." };
  },
};
