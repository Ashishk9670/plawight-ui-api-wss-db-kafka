import { Pool } from 'pg';
import { hashPassword } from './auth.js';

export const pool = new Pool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER ?? 'shop',
  password: process.env.DB_PASSWORD ?? 'shop',
  database: process.env.DB_NAME ?? 'shop',
});

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const SEED_USERS = [
  { email: 'user@shop.test', name: 'Test User', password: 'Password123!', role: 'user' },
  { email: 'admin@shop.test', name: 'Admin User', password: 'Admin123!', role: 'admin' },
];

export async function seedUsers(): Promise<void> {
  for (const u of SEED_USERS) {
    await pool.query(
      `INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      [u.email, u.name, hashPassword(u.password), u.role],
    );
  }
}

export async function waitForDb(retries = 30): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error('Database not reachable');
}
