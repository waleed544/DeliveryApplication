/**
 * socketManager.js
 * Singleton that stores the Socket.IO server instance and exposes
 * helper functions that route handlers can call to push events to clients.
 */

let _io = null;

/**
 * Initialise the manager with the Socket.IO server instance.
 * Called once from server.js right after creating the io server.
 */
function init(io) {
  _io = io;
}

/** @returns {import('socket.io').Server} */
function getIO() {
  if (!_io) throw new Error('Socket.IO has not been initialised yet');
  return _io;
}

/**
 * Emit an event to a specific user's personal room.
 * @param {number|string} userId - users.id
 * @param {string} event
 * @param {*} data
 */
function emitToUser(userId, event, data) {
  try {
    getIO().to(`user:${userId}`).emit(event, data);
  } catch (e) {
    // Non-fatal — socket may not be connected
    console.warn(`[socket] emitToUser failed for user ${userId}:`, e.message);
  }
}

/**
 * Emit a new chat message to the recipient's room.
 * @param {number|string} chatId
 * @param {number|string} recipientUserId
 * @param {object} message  - the full message row from DB
 */
function emitChatMessage(chatId, recipientUserId, message) {
  emitToUser(recipientUserId, 'new_message', { chatId, message });
}

/**
 * Emit an order status update to both the customer and the driver.
 * @param {number|string} customerUserId
 * @param {number|string|null} driverUserId
 * @param {object} payload  - { orderId, status, ... }
 */
function emitOrderUpdate(customerUserId, driverUserId, payload) {
  if (customerUserId) emitToUser(customerUserId, 'order_update', payload);
  if (driverUserId)   emitToUser(driverUserId,  'order_update', payload);
}

/**
 * Emit a driver location update to the customer watching the order.
 * @param {number|string} customerUserId
 * @param {object} payload  - { orderId, latitude, longitude }
 */
function emitDriverLocation(customerUserId, payload) {
  if (customerUserId) emitToUser(customerUserId, 'driver_location', payload);
}

/**
 * Notify a set of driver user-IDs that a new order is available.
 * @param {Array<number|string>} driverUserIds
 * @param {object} order  - the new order object
 */
function emitNewOrder(driverUserIds, order) {
  driverUserIds.forEach((uid) => emitToUser(uid, 'new_order', order));
}

/**
 * Emit a driver cost estimate/receipt to the customer.
 */
function emitEstimate(customerUserId, payload) {
  if (customerUserId) emitToUser(customerUserId, 'estimate_received', payload);
}

/**
 * Emit the customer's estimate response (approved/rejected) to the driver.
 */
function emitEstimateResponse(driverUserId, payload) {
  if (driverUserId) emitToUser(driverUserId, 'estimate_response', payload);
}

module.exports = { init, getIO, emitToUser, emitChatMessage, emitOrderUpdate, emitDriverLocation, emitNewOrder, emitEstimate, emitEstimateResponse };
