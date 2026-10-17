import { env } from '@config/env';
import { expect, test } from '@fixtures/base.fixture';
import { buildProduct } from '@utils/data-factory';

test.describe('Orders list (state prepared through the seeding API)', () => {
  test('shows seeded orders in every status with their totals', async ({ seed, shopPage }) => {
    const [product] = await seed.products([buildProduct({ price: 12.5, stock: 50 })]);
    const statuses = ['PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
    const orders = await seed.orders(
      statuses.map((status, i) => ({
        userEmail: env.USER_EMAIL,
        status,
        items: [{ productId: product.id, quantity: i + 1 }],
      })),
    );

    await shopPage.open();
    for (const [i, order] of orders.entries()) {
      await shopPage.expectOrder(order.id, { status: statuses[i], total: ((i + 1) * 12.5).toFixed(2) });
    }
  });

  test('a status change of a seeded order is pushed live', async ({ seed, shopPage, adminServices }) => {
    const [product] = await seed.products([buildProduct({ stock: 10 })]);
    const [order] = await seed.orders([
      { userEmail: env.USER_EMAIL, status: 'PAID', items: [{ productId: product.id, quantity: 1 }] },
    ]);

    await shopPage.open();
    await expect(shopPage.orderStatus(order.id)).toHaveText('PAID');
    await adminServices.orders.updateStatus(order.id, 'SHIPPED');
    await expect(shopPage.orderStatus(order.id)).toHaveText('SHIPPED');
  });
});
