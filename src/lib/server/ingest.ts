import { z } from "zod";
import { db } from "./db";
import type { ComponentStatus } from "$lib/status";

export const MAX_BODY_BYTES = 64 * 1024;

// Uptime Kuma's generic webhook. Kuma sends heartbeat.status as 0 (down),
// 1 (up), 2 (pending), 3 (maintenance). Everything else in the payload is
// allowed but ignored; Kuma adds fields across versions and rejecting
// unknown keys here would break ingest on every Kuma upgrade.
const kumaPayload = z.object({
  heartbeat: z
    .object({
      status: z.number().int().min(0).max(3),
      msg: z.string().max(2000).optional().nullable(),
      time: z.string().max(64).optional(),
    })
    .passthrough(),
  monitor: z
    .object({
      id: z.union([z.number().int(), z.string().max(200)]).optional(),
      name: z.string().min(1).max(200),
    })
    .passthrough(),
  msg: z.string().max(2000).optional().nullable(),
});

export type IngestResult =
  | { kind: "accepted"; componentId: number; changed: boolean }
  | { kind: "ignored"; reason: string }
  | { kind: "rejected"; reason: string };

type SourceRow = { id: number; auto_create: number };
type BindingRow = { component_id: number; down_impact: ComponentStatus };
type ComponentRow = { status: ComponentStatus };
type TransitionRow = { up: 0 | 1 };

export function findSource(token: string, kind: string): SourceRow | null {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const row = db
    .prepare("SELECT id, auto_create FROM sources WHERE token = ? AND kind = ?")
    .get(token, kind) as SourceRow | undefined;
  return row ?? null;
}

export function ingestKuma(
  source: SourceRow,
  body: unknown,
  nowTs: number,
): IngestResult {
  const parsed = kumaPayload.safeParse(body);
  if (!parsed.success) {
    return {
      kind: "rejected",
      reason: "payload does not match the Uptime Kuma webhook shape",
    };
  }

  const { heartbeat, monitor } = parsed.data;

  // Pending and maintenance heartbeats carry no up/down information we act
  // on; acknowledge them so Kuma does not consider the notification failed.
  if (heartbeat.status === 2 || heartbeat.status === 3) {
    return { kind: "ignored", reason: "pending or maintenance heartbeat" };
  }
  const up: 0 | 1 = heartbeat.status === 1 ? 1 : 0;

  const monitorKey = String(monitor.id ?? monitor.name);

  let binding = db
    .prepare(
      "SELECT component_id, down_impact FROM bindings WHERE source_id = ? AND monitor_key = ?",
    )
    .get(source.id, monitorKey) as BindingRow | undefined;

  if (!binding) {
    if (!source.auto_create) {
      return {
        kind: "ignored",
        reason: "unknown monitor and auto-create is off for this source",
      };
    }
    binding = createComponentForMonitor(source.id, monitorKey, monitor.name);
  }

  const last = db
    .prepare(
      "SELECT up FROM transitions WHERE component_id = ? ORDER BY ts DESC, id DESC LIMIT 1",
    )
    .get(binding.component_id) as TransitionRow | undefined;

  if (last && last.up === up) {
    return {
      kind: "accepted",
      componentId: binding.component_id,
      changed: false,
    };
  }

  const note = (heartbeat.msg ?? parsed.data.msg ?? "").slice(0, 500);
  db.prepare(
    "INSERT INTO transitions (component_id, ts, up, note) VALUES (?, ?, ?, ?)",
  ).run(binding.component_id, nowTs, up, note);

  const current = db
    .prepare("SELECT status FROM components WHERE id = ?")
    .get(binding.component_id) as ComponentRow;

  // Maintenance is operator-set; automated heartbeats must not clear it.
  if (current.status !== "maintenance") {
    const next: ComponentStatus =
      up === 1 ? "operational" : binding.down_impact;
    db.prepare("UPDATE components SET status = ? WHERE id = ?").run(
      next,
      binding.component_id,
    );
  }

  return { kind: "accepted", componentId: binding.component_id, changed: true };
}

function createComponentForMonitor(
  sourceId: number,
  monitorKey: string,
  monitorName: string,
): BindingRow {
  // Component names are unique; a second source with a same-named monitor
  // binds to the existing component instead of failing.
  const existing = db
    .prepare("SELECT id FROM components WHERE name = ?")
    .get(monitorName) as { id: number } | undefined;

  const componentId = existing
    ? existing.id
    : Number(
        db
          .prepare(
            "INSERT INTO components (name, description, display_order) VALUES (?, ?, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM components))",
          )
          .run(monitorName, "Auto-created from monitoring").lastInsertRowid,
      );

  db.prepare(
    "INSERT INTO bindings (source_id, monitor_key, component_id) VALUES (?, ?, ?)",
  ).run(sourceId, monitorKey, componentId);

  return { component_id: componentId, down_impact: "major_outage" };
}
