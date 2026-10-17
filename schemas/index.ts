import { z } from 'zod';

export const ORDER_STATUSES = ['CREATED', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;

export const ProductSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  price: z.number(),
  stock: z.number().int(),
});

export const OrderItemSchema = z.object({
  productId: z.number().int(),
  name: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number(),
});

export const OrderSchema = z.object({
  id: z.number().int(),
  userId: z.number().int(),
  status: z.enum(ORDER_STATUSES),
  total: z.number(),
  createdAt: z.string().datetime(),
  items: z.array(OrderItemSchema).min(1),
});

/** Kafka payload published on the "orders" topic. */
export const OrderEventSchema = z.object({
  eventType: z.enum(['order.created', 'order.updated']),
  occurredAt: z.string().datetime(),
  order: OrderSchema,
});

/** WebSocket push when an order changes. */
export const WsOrderStatusSchema = z.object({
  type: z.literal('order.status'),
  orderId: z.number().int(),
  status: z.enum(ORDER_STATUSES),
});
