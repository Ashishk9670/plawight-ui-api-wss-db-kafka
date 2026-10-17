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

  /** Returns the HTTP status too. This server answers 200 with errors[] for both validation and resolver errors. */
  async executeRaw<T = unknown>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<{ status: number; body: GraphQLResponse<T> }> {
    const res = await this.request.post(this.url, {
      data: { query, variables },
      headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
    });
    const body = (await res.json()) as GraphQLResponse<T>;
    logger.info(
      `GraphQL ${query.trim().split(/[({\s]/)[1] ?? 'op'} -> ${res.status()}${body.errors ? ' (errors)' : ''}`,
    );
    return { status: res.status(), body };
  }

  async execute<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<GraphQLResponse<T>> {
    return (await this.executeRaw<T>(query, variables)).body;
  }
}
