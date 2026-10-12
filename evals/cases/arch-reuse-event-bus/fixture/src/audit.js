import { on } from './events.js';

export const auditLog = [];

on('order.created', order => auditLog.push({ event: 'order.created', id: order.id }));
on('order.shipped', order => auditLog.push({ event: 'order.shipped', id: order.id }));
