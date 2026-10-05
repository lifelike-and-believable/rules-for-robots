import { StreamClient } from '../vendor/streamlib/client.js';

// Receives frames from the server and queues them for the decoder.
export class Receiver {
  constructor(transport) {
    this.client = new StreamClient(transport);
    this.frames = [];
  }

  async start(url) {
    this.client.setDataCallback(bytes => this.frames.push({ label: 'default', bytes }));
    this.client.setLabelledDataCallback((label, bytes) => this.frames.push({ label, bytes }));
    await this.client.connectAsync(url);
  }
}
