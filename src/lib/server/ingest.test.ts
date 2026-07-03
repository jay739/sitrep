import { describe, expect, it } from "vitest";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

// The db module reads DATA_DIR at import time, so the test database location
// must be set before the dynamic imports below. Kept inside the repo (and
// gitignored) rather than the OS tmpdir.
const testDir = join(
  process.cwd(),
  ".test-data",
  `run-${Date.now()}-${process.pid}`,
);
mkdirSync(testDir, { recursive: true });
process.env.DATA_DIR = testDir;
process.env.DEMO_MODE = "false";

const { db } = await import("./db");
const { findSource, ingestKuma } = await import("./ingest");

const token = randomBytes(24).toString("base64url");
db.prepare(
  "INSERT INTO sources (name, kind, token, auto_create) VALUES ('t', 'kuma', ?, 1)",
).run(token);
const source = findSource(token, "kuma")!;

const NOW = 1_800_000_000;

function kumaBody(status: number, monitorId: number, name: string) {
  return {
    heartbeat: { status, msg: "msg", time: "2026-07-03 12:00:00" },
    monitor: { id: monitorId, name },
    msg: `[${name}] status changed`,
  };
}

describe("findSource", () => {
  it("rejects malformed tokens without touching the database", () => {
    expect(findSource("short", "kuma")).toBeNull();
    expect(
      findSource("has spaces in it which is not allowed", "kuma"),
    ).toBeNull();
    expect(findSource(`${"a".repeat(100)}`, "kuma")).toBeNull();
  });

  it("returns null for unknown tokens and wrong kinds", () => {
    expect(
      findSource(randomBytes(24).toString("base64url"), "kuma"),
    ).toBeNull();
    expect(findSource(token, "alertmanager")).toBeNull();
    expect(findSource(token, "kuma")).not.toBeNull();
  });
});

describe("ingestKuma", () => {
  it("rejects payloads that are not Kuma-shaped", () => {
    expect(ingestKuma(source, { nope: true }, NOW).kind).toBe("rejected");
    expect(ingestKuma(source, null, NOW).kind).toBe("rejected");
    expect(ingestKuma(source, "string", NOW).kind).toBe("rejected");
  });

  it("ignores pending and maintenance heartbeats", () => {
    expect(ingestKuma(source, kumaBody(2, 1, "API"), NOW).kind).toBe("ignored");
    expect(ingestKuma(source, kumaBody(3, 1, "API"), NOW).kind).toBe("ignored");
  });

  it("auto-creates a component on first sight and marks it down", () => {
    const result = ingestKuma(source, kumaBody(0, 7, "Payments"), NOW);
    expect(result.kind).toBe("accepted");
    const component = db
      .prepare("SELECT status FROM components WHERE name = ?")
      .get("Payments") as { status: string };
    expect(component.status).toBe("major_outage");
  });

  it("is idempotent for repeated same-status notifications", () => {
    const first = ingestKuma(source, kumaBody(0, 8, "Search"), NOW);
    expect(first.kind).toBe("accepted");
    const repeat = ingestKuma(source, kumaBody(0, 8, "Search"), NOW + 60);
    expect(repeat).toMatchObject({ kind: "accepted", changed: false });
    const count = db
      .prepare(
        "SELECT COUNT(*) AS n FROM transitions WHERE component_id = (SELECT id FROM components WHERE name = ?)",
      )
      .get("Search") as { n: number };
    expect(count.n).toBe(1);
  });

  it("recovers a component to operational on an up heartbeat", () => {
    ingestKuma(source, kumaBody(0, 9, "Queue"), NOW);
    ingestKuma(source, kumaBody(1, 9, "Queue"), NOW + 120);
    const component = db
      .prepare("SELECT status FROM components WHERE name = ?")
      .get("Queue") as { status: string };
    expect(component.status).toBe("operational");
  });

  it("does not clear operator-set maintenance status", () => {
    ingestKuma(source, kumaBody(1, 10, "Cache"), NOW);
    db.prepare(
      "UPDATE components SET status = 'maintenance' WHERE name = 'Cache'",
    ).run();
    ingestKuma(source, kumaBody(0, 10, "Cache"), NOW + 60);
    const component = db
      .prepare("SELECT status FROM components WHERE name = ?")
      .get("Cache") as { status: string };
    expect(component.status).toBe("maintenance");
  });

  it("ignores unknown monitors when auto-create is off", () => {
    db.prepare("UPDATE sources SET auto_create = 0 WHERE id = ?").run(
      source.id,
    );
    const gated = { ...source, auto_create: 0 };
    expect(ingestKuma(gated, kumaBody(0, 99, "Ghost"), NOW).kind).toBe(
      "ignored",
    );
    expect(
      db.prepare("SELECT id FROM components WHERE name = ?").get("Ghost"),
    ).toBeUndefined();
  });
});
