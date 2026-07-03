// In-memory token bucket. Single-instance deployments are the target (SQLite
// storage already implies that), so no shared store is needed. Buckets are
// pruned lazily to bound memory against key churn from spoofed IPs.
type Bucket = { tokens: number; last: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export function rateLimit(
  key: string,
  ratePerMinute: number,
  burst = ratePerMinute,
): boolean {
  const now = Date.now();

  if (buckets.size > MAX_BUCKETS) {
    for (const [k, b] of buckets) {
      if (now - b.last > 120_000) buckets.delete(k);
    }
    if (buckets.size > MAX_BUCKETS) buckets.clear();
  }

  const bucket = buckets.get(key) ?? { tokens: burst, last: now };
  bucket.tokens = Math.min(
    burst,
    bucket.tokens + ((now - bucket.last) / 60_000) * ratePerMinute,
  );
  bucket.last = now;

  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    return false;
  }
  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return true;
}
