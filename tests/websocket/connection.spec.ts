import { WebSocketClient } from '@clients/websocket-client';
import { expect, test } from '@fixtures/base.fixture';

test.describe('WebSocket connection', () => {
  test('connects with a valid token and receives a welcome message @smoke @ws', async ({ userSocket, userServices }) => {
    const msg = await userSocket.waitForMessage((m) => m.type === 'connected');
    expect(msg).toEqual({ type: 'connected', userId: userServices.session.user.id });
  });

  test('answers ping with pong', async ({ userSocket }) => {
    userSocket.send({ type: 'ping' });
    const pong = await userSocket.waitForMessage((m) => m.type === 'pong');
    expect(pong.ts).toEqual(expect.any(Number));
  });

  test('echoes arbitrary JSON messages', async ({ userSocket }) => {
    userSocket.send({ type: 'hello', n: 42 });
    const echo = await userSocket.waitForMessage((m) => m.type === 'echo');
    expect(echo.payload).toEqual({ type: 'hello', n: 42 });
  });

  test('reports malformed JSON without closing the connection', async ({ userSocket }) => {
    userSocket.sendRaw('this is not json');
    await userSocket.waitForMessage((m) => m.type === 'error' && m.message === 'Invalid JSON');
    userSocket.send({ type: 'ping' });
    await userSocket.waitForMessage((m) => m.type === 'pong');
  });

  test('rejects an invalid token with 401', async () => {
    await expect(new WebSocketClient('not-a-valid-token').connect()).rejects.toThrow(/401/);
  });

  test('rejects a missing token with 401', async () => {
    await expect(new WebSocketClient('').connect()).rejects.toThrow(/401/);
  });

  test('supports several concurrent connections for one user', async ({ userServices, userSocket }) => {
    const second = new WebSocketClient(userServices.session.token);
    await second.connect();
    try {
      second.send({ type: 'ping' });
      await second.waitForMessage((m) => m.type === 'pong');
      userSocket.send({ type: 'ping' });
      await userSocket.waitForMessage((m) => m.type === 'pong');
    } finally {
      await second.close();
    }
  });
});
