import type { APIRequestContext } from '@playwright/test';
import { env } from '@config/env';

export interface LoginResult {
  token: string;
  user: { id: number; email: string; name: string; role: 'user' | 'admin' };
}

export class AuthService {
  constructor(private request: APIRequestContext) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const res = await this.request.post(`${env.API_URL}/api/auth/login`, { data: { email, password } });
    if (!res.ok()) throw new Error(`Login failed for ${email}: ${res.status()} ${await res.text()}`);
    return res.json();
  }

  loginAsUser = () => this.login(env.USER_EMAIL, env.USER_PASSWORD);
  loginAsAdmin = () => this.login(env.ADMIN_EMAIL, env.ADMIN_PASSWORD);
}
