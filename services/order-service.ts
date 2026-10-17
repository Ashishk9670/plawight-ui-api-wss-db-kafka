import { env } from '@config/env';
import type { RestClient } from '@clients/rest-client';

export interface OrderDto {
  id: number;
  userId: number;
  status: string;
  total: number;
  createdAt: string;
  items: { productId: number; name: string; quantity: number; unitPrice: number }[];
}

export class OrderService {
  constructor(private rest: RestClient) {}

  async create(items: { productId: number; quantity: number }[]): Promise<OrderDto> {
    const res = await this.rest.post(`${env.API_URL}/api/orders`, { data: { items } });
    if (res.status() !== 201) throw new Error(`Create order failed: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  async get(id: number): Promise<OrderDto> {
    return (await this.rest.get(`${env.API_URL}/api/orders/${id}`)).json();
  }

  async updateStatus(id: number, status: string) {
    return this.rest.patch(`${env.API_URL}/api/orders/${id}/status`, { data: { status } });
  }
}
