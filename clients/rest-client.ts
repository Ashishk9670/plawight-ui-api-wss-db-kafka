import type { APIRequestContext, APIResponse } from '@playwright/test';
import { logger } from '@utils/logger';

export interface RequestOptions {
  data?: unknown;
  params?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  token?: string;
  /** Milliseconds; Playwright's default (30s) applies when omitted. */
  timeout?: number;
}

/** Thin wrapper over Playwright's APIRequestContext: auth header + request/response logging. */
export class RestClient {
  constructor(
    private request: APIRequestContext,
    private defaultToken?: string,
  ) {}

  withToken(token?: string) {
    return new RestClient(this.request, token);
  }

  private async send(method: string, url: string, opts: RequestOptions = {}): Promise<APIResponse> {
    const token = opts.token ?? this.defaultToken;
    const started = Date.now();
    const res = await this.request.fetch(url, {
      method,
      data: opts.data,
      params: opts.params,
      timeout: opts.timeout,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers },
    });
    logger.info(`${method} ${url} -> ${res.status()} (${Date.now() - started}ms)`);
    return res;
  }

  get = (url: string, opts?: RequestOptions) => this.send('GET', url, opts);
  post = (url: string, opts?: RequestOptions) => this.send('POST', url, opts);
  put = (url: string, opts?: RequestOptions) => this.send('PUT', url, opts);
  patch = (url: string, opts?: RequestOptions) => this.send('PATCH', url, opts);
  delete = (url: string, opts?: RequestOptions) => this.send('DELETE', url, opts);
}
