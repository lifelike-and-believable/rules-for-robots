// Test double for streamlib's StreamClient. Delivers packets to whichever data callback
// is registered, preferring the labelled one.
export class FakeStreamClient {
  constructor() { this.onData = null; this.onDataLabelled = null; }
  setDataCallback(fn) { this.onData = fn; }
  setLabelledDataCallback(fn) { this.onDataLabelled = fn; }
  async connectAsync() {}
  deliver(label, bytes) {
    if (this.onDataLabelled) this.onDataLabelled(label, bytes);
    else if (this.onData) this.onData(bytes);
  }
}
