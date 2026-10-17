import { test as base, expect } from '@playwright/test';
import { GraphQLClient } from '@clients/graphql-client';
import { KafkaClient } from '@clients/kafka-client';
import { RestClient } from '@clients/rest-client';
import { WebSocketClient } from '@clients/websocket-client';
import { LoginPage } from '@pages/login-page';
import { ShopPage } from '@pages/shop-page';
import { AuthService, type LoginResult } from '@services/auth-service';
import { OrderService } from '@services/order-service';
import { ProductService } from '@services/product-service';
import { DbClient } from '@utils/db-client';

interface TestFixtures {
  loginPage: LoginPage;
  shopPage: ShopPage;
  rest: RestClient;
  authService: AuthService;
  /** Services authenticated as the standard user / as admin. */
  userServices: { orders: OrderService; products: ProductService; session: LoginResult };
  adminServices: { orders: OrderService; products: ProductService; session: LoginResult };
  graphql: GraphQLClient;
  /** Connected WebSocket client for the standard user; closed after the test. */
  userSocket: WebSocketClient;
}

interface WorkerFixtures {
  db: DbClient;
  kafka: KafkaClient;
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  // ---- worker-scoped: created once per worker ----
  db: [
    async ({}, use) => {
      const db = new DbClient();
      await use(db);
      await db.close();
    },
    { scope: 'worker' },
  ],
  kafka: [async ({}, use) => use(new KafkaClient()), { scope: 'worker' }],

  // ---- pages ----
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  shopPage: async ({ page }, use) => use(new ShopPage(page)),

  // ---- API ----
  rest: async ({ request }, use) => use(new RestClient(request)),
  authService: async ({ request }, use) => use(new AuthService(request)),
  graphql: async ({ request }, use) => use(new GraphQLClient(request)),

  userServices: async ({ authService, rest }, use) => {
    const session = await authService.loginAsUser();
    const authed = rest.withToken(session.token);
    await use({ orders: new OrderService(authed), products: new ProductService(authed), session });
  },
  adminServices: async ({ authService, rest }, use) => {
    const session = await authService.loginAsAdmin();
    const authed = rest.withToken(session.token);
    await use({ orders: new OrderService(authed), products: new ProductService(authed), session });
  },

  userSocket: async ({ userServices }, use) => {
    const socket = new WebSocketClient(userServices.session.token);
    await socket.connect();
    await use(socket);
    await socket.close();
  },
});

export { expect };
