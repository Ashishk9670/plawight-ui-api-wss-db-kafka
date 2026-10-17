import WebSocket from 'ws';
import { env } from '@config/env';
import { logger } from '@utils/logger';

/** Buffers every message so a test can await one that arrived before it started listening. */
export class WebSocketClient {
  private socket?: WebSocket;
  readonly messages: any[] = [];
  private listeners: (() => void)[] = [];

  constructor(private token: string, private url = env.WS_URL) {}

  async connect(timeout = 5_000): Promise<void> {
    this.socket = new WebSocket(`${this.url}?token=${this.token}`);
    this.socket.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      logger.debug(`WS <- ${raw.toString()}`);
      this.messages.push(msg);
      this.listeners.forEach((l) => l());
    });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WebSocket connect timeout')), timeout);
      this.socket!.once('open', () => {
        clearTimeout(timer);
        resolve();
      });
      this.socket!.once('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });
    });
  }

  send(message: object) {
    logger.debug(`WS -> ${JSON.stringify(message)}`);
    this.socket?.send(JSON.stringify(message));
  }

  waitForMessage<T = any>(predicate: (m: any) => boolean, timeout = 10_000): Promise<T> {
    return new Promise((resolve, reject) => {
      const check = () => {
        const found = this.messages.find(predicate);
        if (found) {
          cleanup();
          resolve(found);
        }
      };
      const cleanup = () => {
        clearTimeout(timer);
        this.listeners = this.listeners.filter((l) => l !== check);
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`No matching WebSocket message within ${timeout}ms. Received: ${JSON.stringify(this.messages)}`));
      }, timeout);
      this.listeners.push(check);
      check();
    });
  }

  async close() {
    if (!this.socket || this.socket.readyState === WebSocket.CLOSED) return;
    await new Promise<void>((resolve) => {
      this.socket!.once('close', () => resolve());
      this.socket!.close();
    });
  }
}
