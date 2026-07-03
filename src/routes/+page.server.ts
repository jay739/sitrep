import type { PageServerLoad } from "./$types";
import { db } from "$lib/server/db";
import { config } from "$lib/server/config";
import { dailyUptime, type Transition } from "$lib/server/uptime";
import { renderMarkdown } from "$lib/server/markdown";
import {
  overallStatus,
  type ComponentStatus,
  type IncidentStatus,
  type Severity,
} from "$lib/status";

const UPTIME_DAYS = 90;
const HISTORY_DAYS = 14;

type ComponentRow = {
  id: number;
  name: string;
  description: string;
  status: ComponentStatus;
};

type IncidentRow = {
  id: number;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  created_at: number;
  resolved_at: number | null;
};

type UpdateRow = {
  incident_id: number;
  status: IncidentStatus;
  body: string;
  created_at: number;
};

export const load: PageServerLoad = () => {
  try {
    const nowTs = Math.floor(Date.now() / 1000);

    const components = db
      .prepare(
        "SELECT id, name, description, status FROM components ORDER BY display_order, name",
      )
      .all() as unknown as ComponentRow[];

    const uptimeByComponent: Record<
      number,
      ReturnType<typeof dailyUptime>
    > = {};
    const uptimeStmt = db.prepare(
      "SELECT ts, up FROM transitions WHERE component_id = ? AND ts >= ? ORDER BY ts, id",
    );
    const stateBeforeStmt = db.prepare(
      "SELECT up FROM transitions WHERE component_id = ? AND ts < ? ORDER BY ts DESC, id DESC LIMIT 1",
    );
    const rangeStart = nowTs - (UPTIME_DAYS + 1) * 86_400;
    for (const component of components) {
      const rows = uptimeStmt.all(
        component.id,
        rangeStart,
      ) as unknown as Transition[];
      const before = stateBeforeStmt.get(component.id, rangeStart) as
        | { up: 0 | 1 }
        | undefined;
      const transitions: Transition[] = before
        ? [{ ts: rangeStart, up: before.up }, ...rows]
        : rows;
      uptimeByComponent[component.id] = dailyUptime(
        transitions,
        UPTIME_DAYS,
        nowTs,
      );
    }

    const activeIncidents = db
      .prepare(
        "SELECT id, title, severity, status, created_at, resolved_at FROM incidents WHERE status != 'resolved' ORDER BY created_at DESC",
      )
      .all() as unknown as IncidentRow[];

    const recentResolved = db
      .prepare(
        "SELECT id, title, severity, status, created_at, resolved_at FROM incidents WHERE status = 'resolved' AND resolved_at >= ? ORDER BY resolved_at DESC",
      )
      .all(nowTs - HISTORY_DAYS * 86_400) as unknown as IncidentRow[];

    const incidentIds = [...activeIncidents, ...recentResolved].map(
      (i) => i.id,
    );
    const updatesByIncident: Record<
      number,
      Array<{ status: IncidentStatus; html: string; created_at: number }>
    > = {};
    if (incidentIds.length > 0) {
      const placeholders = incidentIds.map(() => "?").join(",");
      const updates = db
        .prepare(
          `SELECT incident_id, status, body, created_at FROM incident_updates WHERE incident_id IN (${placeholders}) ORDER BY created_at DESC, id DESC`,
        )
        .all(...incidentIds) as unknown as UpdateRow[];
      for (const update of updates) {
        (updatesByIncident[update.incident_id] ??= []).push({
          status: update.status,
          html: renderMarkdown(update.body),
          created_at: update.created_at,
        });
      }
    }

    const maintenances = db
      .prepare(
        "SELECT id, title, body, starts_at, ends_at FROM maintenances WHERE ends_at >= ? ORDER BY starts_at LIMIT 10",
      )
      .all(nowTs) as unknown as Array<{
      id: number;
      title: string;
      body: string;
      starts_at: number;
      ends_at: number;
    }>;

    return {
      ok: true as const,
      siteName: config.siteName,
      overall: overallStatus(components.map((c) => c.status)),
      components,
      uptimeByComponent,
      uptimeDays: UPTIME_DAYS,
      activeIncidents,
      recentResolved,
      updatesByIncident,
      maintenances: maintenances.map((m) => ({
        ...m,
        html: renderMarkdown(m.body),
      })),
      generatedAt: nowTs,
    };
  } catch (err) {
    console.error("status page load failed", err);
    return { ok: false as const, siteName: config.siteName };
  }
};
