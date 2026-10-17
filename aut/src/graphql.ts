import { buildSchema } from 'graphql';
import { createHandler } from 'graphql-http/lib/use/express';
import { GraphQLError } from 'graphql';
import { userFromHeader, type AuthUser } from './auth.js';
import { HttpError } from './db.js';
import { createOrder, getOrder, getProduct, listOrders, listProducts, updateOrderStatus } from './orders.js';

const schema = buildSchema(`
  type Product { id: Int!, name: String!, description: String!, category: String!, price: Float!, stock: Int! }
  type OrderItem { productId: Int!, name: String!, quantity: Int!, unitPrice: Float! }
  type Order { id: Int!, userId: Int!, status: String!, total: Float!, createdAt: String!, items: [OrderItem!]! }
  input OrderItemInput { productId: Int!, quantity: Int! }

  type Query {
    products(search: String, category: String): [Product!]!
    product(id: Int!): Product
    orders: [Order!]!
    order(id: Int!): Order
  }
  type Mutation {
    createOrder(items: [OrderItemInput!]!): Order!
    updateOrderStatus(id: Int!, status: String!): Order!
  }
`);

interface Ctx {
  user: AuthUser | null;
}

const auth = (ctx: Ctx) => {
  if (!ctx.user) throw new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHENTICATED' } });
  return ctx.user;
};

const wrap = <A, R>(fn: (args: A, ctx: Ctx) => Promise<R>) => async (args: A, ctx: Ctx) => {
  try {
    return await fn(args, ctx);
  } catch (e) {
    if (e instanceof HttpError) throw new GraphQLError(e.message, { extensions: { code: String(e.status) } });
    throw e;
  }
};

const rootValue = {
  products: wrap(async (a: { search?: string; category?: string }) => listProducts(a.search, a.category)),
  product: wrap(async (a: { id: number }) => getProduct(a.id)),
  orders: wrap(async (_: unknown, ctx) => {
    const u = auth(ctx);
    return listOrders(u.id, u.role === 'admin');
  }),
  order: wrap(async (a: { id: number }, ctx) => {
    const u = auth(ctx);
    const o = await getOrder(a.id);
    return o && (u.role === 'admin' || o.userId === u.id) ? o : null;
  }),
  createOrder: wrap(async (a: { items: { productId: number; quantity: number }[] }, ctx) => createOrder(auth(ctx).id, a.items)),
  updateOrderStatus: wrap(async (a: { id: number; status: string }, ctx) => {
    if (auth(ctx).role !== 'admin') throw new GraphQLError('Forbidden', { extensions: { code: 'FORBIDDEN' } });
    return updateOrderStatus(a.id, a.status);
  }),
};

// graphql-http passes (args, context) to root resolvers via rootValue functions.
export const graphqlHandler = createHandler<any>({
  schema,
  rootValue,
  context: (req: { headers: { authorization?: string } }) => ({ user: userFromHeader(req.headers.authorization) }),
});
