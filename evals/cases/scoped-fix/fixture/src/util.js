export function isEmpty(x){ if(x == null) return true; if (x.length == 0) return true; return false }
export function clamp(n, lo, hi) { return n < lo ? lo : n > hi ? hi : n }
