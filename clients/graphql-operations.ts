const ORDER_FIELDS = `id userId status total createdAt items { productId name quantity unitPrice }`;

export const PRODUCTS = `query Products($search: String, $category: String) {
  products(search: $search, category: $category) { id name description category price stock }
}`;

export const PRODUCT = `query Product($id: Int!) {
  product(id: $id) { id name description category price stock }
}`;

export const ORDERS = `query Orders { orders { ${ORDER_FIELDS} } }`;

export const ORDER = `query Order($id: Int!) { order(id: $id) { ${ORDER_FIELDS} } }`;

export const CREATE_ORDER = `mutation CreateOrder($items: [OrderItemInput!]!) {
  createOrder(items: $items) { ${ORDER_FIELDS} }
}`;

export const UPDATE_ORDER_STATUS = `mutation UpdateOrderStatus($id: Int!, $status: String!) {
  updateOrderStatus(id: $id, status: $status) { ${ORDER_FIELDS} }
}`;
