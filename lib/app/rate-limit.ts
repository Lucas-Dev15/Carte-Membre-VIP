/** Limiteur simple en mémoire (par instance). En production : Redis / edge. */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const t = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= t) {
    buckets.set(key, { count: 1, resetAt: t + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}
