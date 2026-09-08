import { useEffect, useState } from 'react';
import { resolveWebSocketUrl } from './api';

export function useLiveRelay(sessionId) {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!sessionId) {
      return undefined;
    }

    const socket = new WebSocket(resolveWebSocketUrl());

    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ type: 'subscribe', sessionId }));
    });

    socket.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(event.data);
        setEvents((current) => [...current, payload]);
      } catch {
        setEvents((current) => [...current, { type: 'relay.error', message: 'Invalid message payload' }]);
      }
    });

    return () => socket.close();
  }, [sessionId]);

  return events;
}
