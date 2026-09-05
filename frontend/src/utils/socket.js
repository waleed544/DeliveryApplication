/**
 * socket.js — singleton Socket.IO client
 *
 * Always import this file (not io()) to get the same socket instance
 * everywhere in the app.
 */
import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_API_URL
  ? process.env.REACT_APP_API_URL.replace('/api', '')
  : 'http://localhost:5000';

// Create the socket but do NOT connect automatically.
// SocketContext will call socket.connect() / socket.disconnect() when
// the user logs in / out.
const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
});

export default socket;
