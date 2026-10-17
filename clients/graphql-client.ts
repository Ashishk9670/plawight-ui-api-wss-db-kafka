import type { APIRequestContext } from '@playwright/test';
import { env } from '@config/env';
import { logger } from '@utils/logger';

export interface GraphQLResponse<T> {
  data?: T | null;
  errors?: { message: string; extensions?: Record<string, unknown> }[];
}

export class GraphQLClient {
  constructor(
    private request: APIRequestContext,
    private token?: string,
    private url = env.GRAPHQL_URL,
  ) {}

  withToken(token?: string) {
    return new GraphQLClient(this.request, token, this.url);
  }

  /** GraphQL returns HTTP 200 even for resolver errors, so errors[] is returned, not thrown. */
  async execute<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<GraphQLResponse<T>> {
    const res = await this.request.post(this.url, {
      data: { query, variables },
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
    });
    const body = (await res.json()) as GraphQLResponse<T>;
    logger.info(`GraphQL ${query.trim().split(/[({\s]/)[1] ?? 'op'} -> ${res.status()}${body.errors ? ' (errors)' : ''}`);
    return body;
  }
}
