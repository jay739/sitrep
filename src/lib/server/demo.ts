import type { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";

// Fictional but realistic dataset so CI, screenshots, and first-run
// evaluation need zero external services. Only runs when the database is
// empty, so restarting a demo container does not duplicate rows.
export function seedDemoData(db: DatabaseSync): void {
  const existing = db.prepare("SELECT COUNT(*) AS n FROM components").get() as {
    n: number;
  };
  if (existing.n > 0) return;

  const now = Math.floor(Date.now() / 1000);
  const day = 86_400;

  const components: Array<[string, string, string]> = [
    ["Website", "Public marketing site and docs", "operational"],
    ["API", "REST API for all clients", "operational"],
    ["Dashboard", "Customer-facing web app", "degraded"],
    ["Authentication", "Login, sessions, SSO", "operational"],
    ["Database", "Primary datastore", "operational"],
    ["Object Storage", "File uploads and static assets", "operational"],
    ["Webhooks", "Outbound event delivery", "major_outage"],
    ["DNS", "Name resolution", "operational"],
  ];

  const insertComponent = db.prepare(
    "INSERT INTO components (name, description, status, display_order) VALUES (?, ?, ?, ?)",
  );
  const insertTransition = db.prepare(
    "INSERT INTO transitions (component_id, ts, up, note) VALUES (?, ?, ?, ?)",
  );

  const ids: number[] = [];
  components.forEach(([name, description, status], i) => {
    const res = insertComponent.run(name, description, status, i);
    ids.push(Number(res.lastInsertRowid));
  });

  // 90 days of history: mostly up, a few believable outages per component.
  // Deterministic-ish per component index so the page always looks varied.
  ids.forEach((id, i) => {
    let ts = now - 90 * day;
    insertTransition.run(id, ts, 1, "monitoring started");
    const outages = (i * 7919) % 4; // 0..3 outages over the window
    for (let o = 0; o < outages; o += 1) {
      const start = now - ((i * 13 + o * 29) % 85) * day - (o + 1) * 3600;
      const duration = 600 + (((i + 1) * (o + 1) * 977) % 14_000);
      if (start > ts) {
        insertTransition.run(id, start, 0, "demo outage");
        insertTransition.run(id, start + duration, 1, "recovered");
        ts = start + duration;
      }
    }
  });

  // Webhooks is mid-incident right now.
  const webhooksId = ids[6];
  insertTransition.run(webhooksId, now - 3200, 0, "demo outage in progress");

  const insertIncident = db.prepare(
    "INSERT INTO incidents (title, severity, status, created_at, resolved_at, postmortem) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const insertUpdate = db.prepare(
    "INSERT INTO incident_updates (incident_id, status, body, created_at) VALUES (?, ?, ?, ?)",
  );
  const linkComponent = db.prepare(
    "INSERT INTO incident_components (incident_id, component_id) VALUES (?, ?)",
  );

  const active = Number(
    insertIncident.run(
      "Delayed webhook deliveries",
      "major",
      "identified",
      now - 3000,
      null,
      null,
    ).lastInsertRowid,
  );
  linkComponent.run(active, webhooksId);
  linkComponent.run(active, ids[2]);
  insertUpdate.run(
    active,
    "investigating",
    "We are seeing elevated failure rates on outbound webhook deliveries and are investigating.",
    now - 3000,
  );
  insertUpdate.run(
    active,
    "identified",
    "The delivery queue is backed up behind a stuck consumer. We have isolated the cause and are draining the backlog. **No events have been lost.**",
    now - 1500,
  );

  const resolved = Number(
    insertIncident.run(
      "Elevated API latency in EU region",
      "minor",
      "resolved",
      now - 3 * day,
      now - 3 * day + 5400,
      "A cache node was evicted during a routine scale-down and traffic fell through to the database.\n\n- Scale-down now drains caches before eviction\n- Added latency alerting at the 95th percentile",
    ).lastInsertRowid,
  );
  linkComponent.run(resolved, ids[1]);
  insertUpdate.run(
    resolved,
    "investigating",
    "API p95 latency is elevated in the EU region.",
    now - 3 * day,
  );
  insertUpdate.run(
    resolved,
    "resolved",
    "Latency has returned to normal levels.",
    now - 3 * day + 5400,
  );

  const insertMaintenance = db.prepare(
    "INSERT INTO maintenances (title, body, starts_at, ends_at) VALUES (?, ?, ?, ?)",
  );
  const linkMaintenance = db.prepare(
    "INSERT INTO maintenance_components (maintenance_id, component_id) VALUES (?, ?)",
  );
  const maint = Number(
    insertMaintenance.run(
      "Database version upgrade",
      "Primary datastore will be upgraded. Brief read-only windows of up to two minutes are expected.",
      now + 2 * day,
      now + 2 * day + 7200,
    ).lastInsertRowid,
  );
  linkMaintenance.run(maint, ids[4]);

  // A demo ingest source so the admin UI has something to show.
  db.prepare(
    "INSERT INTO sources (name, kind, token, auto_create) VALUES (?, ?, ?, 1)",
  ).run("Demo Uptime Kuma", "kuma", randomBytes(24).toString("base64url"));
}
