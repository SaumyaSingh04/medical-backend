'use strict';

const logger = require('../utils/logger');

// Basic guard: orderId must be a non-empty string (cuid/uuid/mongo ObjectId).
const isValidId = (id) => typeof id === 'string' && /^[\w-]{6,64}$/.test(id);

/**
 * Handle order-related real-time events.
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
const orderSocket = (io, socket) => {
  socket.on('order:subscribe', (orderId) => {
    if (!isValidId(orderId)) return;
    socket.join(`order:${orderId}`);
    logger.info(`Socket ${socket.id} subscribed to order:${orderId}`);
  });

  socket.on('order:unsubscribe', (orderId) => {
    if (!isValidId(orderId)) return;
    socket.leave(`order:${orderId}`);
  });
};

/**
 * Broadcast order status update to all subscribers of that order.
 * Called from orderService.updateOrderStatus().
 */
const emitOrderStatusUpdate = (io, orderId, status, data = {}) => {
  if (!io) return;
  io.to(`order:${orderId}`).emit('order:status_updated', {
    orderId,
    status,
    ...data,
    timestamp: new Date().toISOString(),
  });
  logger.info(`Emitted order:status_updated for order ${orderId} → ${status}`);
};

module.exports = { orderSocket, emitOrderStatusUpdate };
