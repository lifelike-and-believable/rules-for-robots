const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

// Human-readable size in powers of 1024, with at most one decimal place.
export function formatBytes(bytes) {
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${Number(value.toFixed(1))} ${UNITS[exponent]}`;
}
