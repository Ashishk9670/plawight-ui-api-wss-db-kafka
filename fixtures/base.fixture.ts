import { test as base, expect } from '@playwright/test';
import { GraphQLClient } from '@clients/graphql-client';
import { KafkaClient } from '@clients/kafka-client';
import { RestClient } from '@clients/rest-client';
import { WebSocketClient } from '@clients/websocket-client';
import { LoginPage } from '@pages/login-page';
import { ShopPage } from '@pages/shop-page';
import { AuthService, type LoginResult } from '@services/auth-service';
import { OrderService } from '@services/order-service';
import { ProductService, type Product } from '@services/product-service';
import { buildProduct, type ProductInput } from '@utils/data-factory';
import { DbClient } from '@utils/db-client';
import { logger } from '@utils/logger';

interface RoleServices {
  orders: OrderService;
  products: ProductService;
  session: LoginResult;
}

interface TestFixtures {
  loginPage: LoginPage;
  shopPage: ShopPage;
  rest: RestClient;
  authService: AuthService;
  /** Services authenticated as the standard user / as admin. */
  userServices: RoleServices;
  adminServices: RoleServices;
  /** GraphQL clients: anonymous, standard user, admin. */
  graphql: GraphQLClient;
  userGraphql: GraphQLClient;
  adminGraphql: GraphQLClient;
  /** Connected WebSocket clients, closed after the test. */
  userSocket: WebSocketClient;
  adminSocket: WebSocketClient;
  /** Register teardown work; runs after the test in reverse order, even when the test fails. */
  cleanup: { add(fn: () => Promise<unknown>): void };
  /** Creates a product through the admin API and removes it (and any orders for it) afterwards. */
  makeProduct: (overrides?: Partial<ProductInput>) => Promise<Product>;
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

  userGraphql: async ({ graphql, userServices }, use) => use(graphql.withToken(userServices.session.token)),
  adminGraphql: async ({ graphql, adminServices }, use) => use(graphql.withToken(adminServices.session.token)),

  userSocket: async ({ userServices }, use) => {
    const socket = new WebSocketClient(userServices.session.token);
    await socket.connect();
    await use(socket);
    await socket.close();
  },
  adminSocket: async ({ adminServices }, use) => {
    const socket = new WebSocketClient(adminServices.session.token);
    await socket.connect();
    await use(socket);
    await socket.close();
  },

  cleanup: async ({}, use) => {
    const tasks: (() => Promise<unknown>)[] = [];
    await use({ add: (fn) => void tasks.push(fn) });
    for (const task of tasks.reverse()) {
      try {
        await task();
      } catch (e) {
        logger.warn(`Cleanup failed: ${String(e)}`);
      }
    }
  },

  makeProduct: async ({ adminServices, db, cleanup }, use) => {
    await use(async (overrides = {}) => {
      const product = await adminServices.products.create(buildProduct(overrides));
      cleanup.add(async () => {
        await db.query('DELETE FROM orders WHERE id IN (SELECT order_id FROM order_items WHERE product_id = $1)', [product.id]);
        await db.query('DELETE FROM products WHERE id = $1', [product.id]);
      });
      return product;
    });
  },
});

export { expect };
