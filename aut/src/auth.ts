import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET ?? 'aut-dev-secret';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: 'user' | 'admin';
}

// Test AUT only: a plain SHA-256 keeps it dependency-free. Never do this in a real app.
export const hashPassword = (pw: string) => crypto.createHash('sha256').update(pw).digest('hex');

export const signToken = (user: AuthUser) => jwt.sign(user, SECRET, { expiresIn: '8h' });

export function verifyToken(token: string): AuthUser | null {
  try {
    const { id, email, name, role } = jwt.verify(token, SECRET) as AuthUser;
    return { id, email, name, role };
  } catch {
    return null;
  }
}

export function userFromHeader(header?: string): AuthUser | null {
  if (!header?.startsWith('Bearer ')) return null;
  return verifyToken(header.slice(7));
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = userFromHeader(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  req.user = user;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
}
