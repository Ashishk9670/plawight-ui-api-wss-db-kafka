import type { Server } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { verifyToken } from './auth.js';

const sockets = new Map<number, Set<WebSocket>>();

export function attachWebSocket(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '', 'http://localhost');
    if (url.pathname !== '/ws') return socket.destroy();
    const user = verifyToken(url.searchParams.get('token') ?? '');
    if (!user) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      return socket.destroy();
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      if (!sockets.has(user.id)) sockets.set(user.id, new Set());
      sockets.get(user.id)!.add(ws);
      ws.on('close', () => sockets.get(user.id)?.delete(ws));
      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
          else ws.send(JSON.stringify({ type: 'echo', payload: msg }));
        } catch {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
        }
      });
      ws.send(JSON.stringify({ type: 'connected', userId: user.id }));
    });
  });
}

export function notifyUser(userId: number, message: object) {
  const payload = JSON.stringify(message);
  sockets.get(userId)?.forEach((ws) => ws.readyState === ws.OPEN && ws.send(payload));
}
