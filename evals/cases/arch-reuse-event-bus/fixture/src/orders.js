import { emit } from './events.js';

const orders = new Map();

export function createOrder(id, customerEmail, items) {
  const order = { id, customerEmail, items, status: 'created' };
  orders.set(id, order);
  emit('order.created', order);
  return order;
}

export function markShipped(id) {
  const order = orders.get(id);
  order.status = 'shipped';
  emit('order.shipped', order);
  return order;
}
