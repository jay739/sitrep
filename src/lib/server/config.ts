import { env } from "$env/dynamic/private";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";

export const config = {
  dataDir: env.DATA_DIR ?? "data",
  demoMode: env.DEMO_MODE === "true",
  siteName: env.SITE_NAME ?? "Status",
  adminPassword:
    env.ADMIN_PASSWORD ?? (env.DEMO_MODE === "true" ? "demo-admin" : null),
};

mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });

// The session secret survives restarts so admin sessions do, too. Generated
// once, owner-readable only; DATA_DIR is the only writable location the app
// assumes to exist.
function loadOrCreateSecret(): Buffer {
  const secretPath = join(config.dataDir, "session-secret");
  if (existsSync(secretPath)) {
    return Buffer.from(readFileSync(secretPath, "utf8").trim(), "hex");
  }
  const secret = randomBytes(32);
  writeFileSync(secretPath, secret.toString("hex") + "\n", { mode: 0o600 });
  return secret;
}

export const sessionSecret = loadOrCreateSecret();
