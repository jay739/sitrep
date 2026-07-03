import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { config } from "./config";
import { seedDemoData } from "./demo";

const MIGRATIONS: string[] = [
  `
	CREATE TABLE components (
		id INTEGER PRIMARY KEY,
		name TEXT NOT NULL UNIQUE,
		description TEXT NOT NULL DEFAULT '',
		display_order INTEGER NOT NULL DEFAULT 0,
		status TEXT NOT NULL DEFAULT 'operational'
			CHECK (status IN ('operational','degraded','partial_outage','major_outage','maintenance')),
		created_at INTEGER NOT NULL DEFAULT (unixepoch())
	);

	CREATE TABLE sources (
		id INTEGER PRIMARY KEY,
		name TEXT NOT NULL,
		kind TEXT NOT NULL CHECK (kind IN ('kuma','alertmanager','generic')),
		token TEXT NOT NULL UNIQUE,
		auto_create INTEGER NOT NULL DEFAULT 1,
		created_at INTEGER NOT NULL DEFAULT (unixepoch())
	);

	CREATE TABLE bindings (
		id INTEGER PRIMARY KEY,
		source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
		monitor_key TEXT NOT NULL,
		component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
		down_impact TEXT NOT NULL DEFAULT 'major_outage'
			CHECK (down_impact IN ('degraded','partial_outage','major_outage')),
		UNIQUE (source_id, monitor_key)
	);

	CREATE TABLE transitions (
		id INTEGER PRIMARY KEY,
		component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
		ts INTEGER NOT NULL,
		up INTEGER NOT NULL CHECK (up IN (0,1)),
		note TEXT NOT NULL DEFAULT ''
	);
	CREATE INDEX idx_transitions_component_ts ON transitions(component_id, ts);

	CREATE TABLE incidents (
		id INTEGER PRIMARY KEY,
		title TEXT NOT NULL,
		severity TEXT NOT NULL CHECK (severity IN ('minor','major','critical')),
		status TEXT NOT NULL CHECK (status IN ('investigating','identified','monitoring','resolved')),
		created_at INTEGER NOT NULL DEFAULT (unixepoch()),
		resolved_at INTEGER,
		postmortem TEXT
	);

	CREATE TABLE incident_updates (
		id INTEGER PRIMARY KEY,
		incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
		status TEXT NOT NULL CHECK (status IN ('investigating','identified','monitoring','resolved')),
		body TEXT NOT NULL,
		created_at INTEGER NOT NULL DEFAULT (unixepoch())
	);

	CREATE TABLE incident_components (
		incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
		component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
		PRIMARY KEY (incident_id, component_id)
	);

	CREATE TABLE maintenances (
		id INTEGER PRIMARY KEY,
		title TEXT NOT NULL,
		body TEXT NOT NULL DEFAULT '',
		starts_at INTEGER NOT NULL,
		ends_at INTEGER NOT NULL,
		created_at INTEGER NOT NULL DEFAULT (unixepoch())
	);

	CREATE TABLE maintenance_components (
		maintenance_id INTEGER NOT NULL REFERENCES maintenances(id) ON DELETE CASCADE,
		component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
		PRIMARY KEY (maintenance_id, component_id)
	);

	CREATE TABLE settings (
		key TEXT PRIMARY KEY,
		value TEXT NOT NULL
	);
	`,
];

function open(): DatabaseSync {
  const db = new DatabaseSync(join(config.dataDir, "sitrep.db"));
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");

  const row = db.prepare("PRAGMA user_version").get() as {
    user_version: number;
  };
  let version = row.user_version;
  while (version < MIGRATIONS.length) {
    db.exec("BEGIN");
    try {
      db.exec(MIGRATIONS[version]);
      version += 1;
      db.exec(`PRAGMA user_version = ${version}`);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }
  return db;
}

export const db = open();

if (config.demoMode) {
  seedDemoData(db);
}
