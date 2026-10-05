// streamlib 2.4.1 client (vendored). Do not edit; update by re-vendoring.

export class StreamClient {
  constructor(transport) {
    this.transport = transport;
    this.onData = null;          // (bytes) => void
    this.onDataLabelled = null;  // (label, bytes) => void
  }

  setDataCallback(fn) { this.onData = fn; }
  setLabelledDataCallback(fn) { this.onDataLabelled = fn; }

  // Synchronous connect: delivers each packet once, to the labelled callback if one is
  // set, otherwise to the unlabelled callback.
  connect(url) {
    this.transport.open(url);
    this.transport.onPacket = packet => {
      if (this.onDataLabelled) this.onDataLabelled(packet.label, packet.bytes);
      else if (this.onData) this.onData(packet.bytes);
    };
  }

  // Asynchronous connect: the event loop runs on the transport's worker and delivers
  // every packet to the unlabelled callback only. The labelled callback is not used on
  // this path (see the async event loop below).
  async connectAsync(url) {
    await this.transport.openAsync(url);
    this.transport.onPacket = packet => {
      if (this.onData) this.onData(packet.bytes);
    };
  }
}
