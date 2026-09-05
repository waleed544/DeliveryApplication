import React, { createContext, useContext, useEffect } from 'react';
import socket from '../utils/socket';
import { useAuth } from './AuthContext';

const SocketContext = createContext(socket);

export function SocketProvider({ children }) {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      // Attach the JWT token as auth so the server can authenticate the socket
      const token = localStorage.getItem('token');
      socket.auth = { token };
      socket.connect();
    } else {
      // User logged out — disconnect cleanly
      socket.disconnect();
    }

    return () => {
      // Component unmount — nothing extra needed; the socket persists as a singleton
    };
  }, [user]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

/** Hook to get the shared socket instance */
export function useSocket() {
  return useContext(SocketContext);
}
