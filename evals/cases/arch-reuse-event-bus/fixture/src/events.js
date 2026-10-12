// In-process event bus. Handlers run in the same process, in registration order.
import { EventEmitter } from 'node:events';

const emitter = new EventEmitter();

export function on(name, handler) {
  emitter.on(name, handler);
}

export function emit(name, payload) {
  emitter.emit(name, payload);
}
