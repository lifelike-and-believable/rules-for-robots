// Reconnecting client. transport: { connect(): Promise<void>, onClose: () => void }
export class Client {
  constructor(transport, { baseDelayMs = 500, maxDelayMs = 60000, sleep = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
    this.transport = transport;
    this.baseDelayMs = baseDelayMs;
    this.maxDelayMs = maxDelayMs;
    this.sleep = sleep;
    this.attempts = 0;
    this.delays = [];
  }

  nextDelay() {
    return Math.min(this.maxDelayMs, this.baseDelayMs * 2 ** this.attempts);
  }

  async start() {
    this.transport.onClose = () => this.reconnect();
    await this.transport.connect();
  }

  async reconnect() {
    for (;;) {
      const delay = this.nextDelay();
      this.delays.push(delay);
      this.attempts += 1;
      await this.sleep(delay);
      try {
        await this.transport.connect();
        return;
      } catch {
        // try again
      }
    }
  }
}
