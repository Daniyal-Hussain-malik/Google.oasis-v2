import { EventEmitter } from 'node:events';

// In-process fan-out for the kitchen display. One API process serves every
// screen; if the API is ever scaled out, swap this for Redis pub/sub.
export const bus = new EventEmitter();
bus.setMaxListeners(200);

export function publish(type, payload = {}) {
  bus.emit('event', { type, ...payload, at: Date.now() });
}
