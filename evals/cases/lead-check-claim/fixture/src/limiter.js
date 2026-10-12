const windowMs = 60_000;
const max = 5;
const failures = new Map();

export function recordFailure(ip, now = Date.now()) {
  const recent = (failures.get(ip) ?? []).filter(t => now - t < windowMs);
  recent.push(now);
  failures.set(ip, recent);
}

export function isLimited(ip, now = Date.now()) {
  return (failures.get(ip) ?? []).filter(t => now - t < windowMs).length >= max;
}
