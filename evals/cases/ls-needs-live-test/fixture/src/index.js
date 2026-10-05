import { Client } from './client.js';
import { loadConfig } from './config.js';

// Builds a client from the environment. transport: { connect(url): Promise<void>, onClose }
export function createClient(transport, env = process.env) {
  const { url, baseDelayMs, maxDelayMs } = loadConfig(env);
  const connect = transport.connect.bind(transport);
  transport.connect = () => connect(url);
  return new Client(transport, { baseDelayMs, maxDelayMs });
}
