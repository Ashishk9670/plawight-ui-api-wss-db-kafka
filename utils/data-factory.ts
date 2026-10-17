import { faker } from '@faker-js/faker';

export const buildProduct = (overrides: Partial<ProductInput> = {}): ProductInput => ({
  name: `${faker.commerce.productName()} ${faker.string.alphanumeric(6)}`,
  description: faker.commerce.productDescription(),
  category: 'test',
  price: Number(faker.commerce.price({ min: 5, max: 500 })),
  stock: faker.number.int({ min: 10, max: 100 }),
  ...overrides,
});

export interface ProductInput {
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
}
