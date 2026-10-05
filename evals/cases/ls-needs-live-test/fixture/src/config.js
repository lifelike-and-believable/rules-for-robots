// Reads client settings from the environment. See README.md for the variables.
export function loadConfig(env = process.env) {
  if (!env.TELEMETRY_URL) throw new Error('TELEMETRY_URL is not set');
  return {
    url: `${env.TELEMETRY_URL}/ingest`,
    baseDelayMs: Number(env.TELEMETRY_BASE_DELAY_MS ?? 500),
    maxDelayMs: Number(env.TELEMETRY_MAX_DELAY ?? 60000),
  };
}
