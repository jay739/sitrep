import { createHash, timingSafeEqual } from "node:crypto";
import { config } from "./config";

// Hashing both sides first makes the comparison constant-time regardless of
// input length, which timingSafeEqual alone cannot do.
export function verifyAdminPassword(candidate: string): boolean {
  if (!config.adminPassword) return false;
  const a = createHash("sha256").update(candidate).digest();
  const b = createHash("sha256").update(config.adminPassword).digest();
  return timingSafeEqual(a, b);
}

export function adminConfigured(): boolean {
  return config.adminPassword !== null;
}
