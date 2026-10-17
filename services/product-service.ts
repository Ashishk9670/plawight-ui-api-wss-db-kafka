import { env } from '@config/env';
import type { RestClient } from '@clients/rest-client';
import type { components } from '@schemas/api.generated';
import type { ProductInput } from '@utils/data-factory';

/** Generated from aut/openapi.json (npm run gen:api-types). */
export type Product = components['schemas']['Product'];

export class ProductService {
  constructor(private rest: RestClient) {}

  async list(search?: string): Promise<Product[]> {
    const res = await this.rest.get(`${env.API_URL}/api/products`, { params: search ? { search } : undefined });
    return res.json();
  }

  async create(input: ProductInput): Promise<Product> {
    const res = await this.rest.post(`${env.API_URL}/api/products`, { data: input });
    if (res.status() !== 201) throw new Error(`Create product failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async remove(id: number) {
    return this.rest.delete(`${env.API_URL}/api/products/${id}`);
  }
}
