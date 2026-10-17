import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// TEST_ENV selects env/.env.<name>; real environment variables (CI secrets) always win.
const testEnv = process.env.TEST_ENV ?? 'dev';
dotenv.config({ path: path.resolve(__dirname, `../env/.env.${testEnv}`) });

const schema = z.object({
  BASE_URL: z.string().url(),
  API_URL: z.string().url(),
  GRAPHQL_URL: z.string().url(),
  WS_URL: z.string().min(1),
  DB_HOST: z.string(),
  DB_PORT: z.coerce.number(),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string(),
  KAFKA_BROKERS: z.string(),
  KAFKA_TOPIC_ORDERS: z.string().default('orders'),
  USER_EMAIL: z.string().email(),
  USER_PASSWORD: z.string(),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD: z.string(),
  JWT_SECRET: z.string().default('aut-dev-secret'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n  ');
  throw new Error(`Invalid test environment "${testEnv}":\n  ${issues}`);
}

export const env = { ...parsed.data, TEST_ENV: testEnv };
export type Env = typeof env;
