import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

export function useSocket(events: Record<string, (data: any) => void>) {
  const { token } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) return;

    const socket = io('/', { auth: { token } });
    socketRef.current = socket;

    for (const [event, handler] of Object.entries(events)) {
      socket.on(event, handler);
    }

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // Re-connect when token changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return socketRef;
}
