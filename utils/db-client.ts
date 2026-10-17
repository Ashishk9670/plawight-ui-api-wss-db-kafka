import { Pool, type QueryResultRow } from 'pg';
import { env } from '@config/env';
import { logger } from '@utils/logger';

export class DbClient {
  private pool = new Pool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    max: 3,
  });

  async query<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    logger.debug(`DB ${sql.replace(/\s+/g, ' ').trim()} ${JSON.stringify(params)}`);
    const { rows } = await this.pool.query<T>(sql, params);
    return rows;
  }

  async queryOne<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return (await this.query<T>(sql, params))[0];
  }

  async close() {
    await this.pool.end();
  }
}
