const { WebSocketServer } = require('ws');

function createRelayWsServer(server) {
  const wss = new WebSocketServer({ server });
  const subscribers = new Map();

  function subscribe(sessionId, socket) {
    const set = subscribers.get(sessionId) || new Set();
    set.add(socket);
    subscribers.set(sessionId, set);
  }

  function unsubscribe(socket) {
    for (const set of subscribers.values()) {
      set.delete(socket);
    }
  }

  wss.on('connection', (socket) => {
    socket.on('message', (raw) => {
      try {
        const message = JSON.parse(raw.toString());
        if (message.type === 'subscribe' && message.sessionId) {
          subscribe(message.sessionId, socket);
          socket.send(JSON.stringify({ type: 'subscribed', sessionId: message.sessionId }));
        }
      } catch {
        socket.send(JSON.stringify({ type: 'error', message: 'Invalid payload' }));
      }
    });

    socket.on('close', () => unsubscribe(socket));
  });

  function broadcast(sessionId, payload) {
    const sockets = subscribers.get(sessionId);
    if (!sockets) {
      return;
    }

    const data = JSON.stringify(payload);
    for (const socket of sockets) {
      if (socket.readyState === socket.OPEN) {
        socket.send(data);
      }
    }
  }

  return { broadcast };
}

module.exports = { createRelayWsServer };
