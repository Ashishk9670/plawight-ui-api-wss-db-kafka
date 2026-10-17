import { env } from '@config/env';
import type { RestClient } from '@clients/rest-client';
import type { ProductInput } from '@utils/data-factory';
import type { OrderDto } from '@services/order-service';
import type { Product } from '@services/product-service';

export interface SeedOrder {
  userEmail: string;
  status?: string;
  items: { productId: number; quantity: number }[];
}

/** Wraps the AUT's test-only seeding API (admin token required, ENABLE_TEST_API=true). */
export class SeedService {
  constructor(
    private adminRest: RestClient,
    private onProductCreated?: (product: Product) => void,
  ) {}

  async products(products: ProductInput[]): Promise<Product[]> {
    const res = await this.adminRest.post(`${env.API_URL}/api/test/seed/products`, { data: { products } });
    if (res.status() !== 201) throw new Error(`Seed products failed: ${res.status()} ${await res.text()}`);
    const created: Product[] = await res.json();
    created.forEach((p) => this.onProductCreated?.(p));
    return created;
  }

  async orders(orders: SeedOrder[]): Promise<OrderDto[]> {
    const res = await this.adminRest.post(`${env.API_URL}/api/test/seed/orders`, { data: { orders } });
    if (res.status() !== 201) throw new Error(`Seed orders failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async removeProduct(id: number) {
    return this.adminRest.delete(`${env.API_URL}/api/test/products/${id}`);
  }
}
