import { createMiddleware } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import jwt from 'jsonwebtoken';
import { ServerSupabaseMySQLClient } from '@/lib/supabase-mysql';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-this-in-production-or-use-a-strong-uuid-or-hash';

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const request = getRequest();

    if (!request?.headers) {
      throw new Error('Unauthorized: No request headers available');
    }

    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      throw new Error('Unauthorized: No authorization header provided');
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized: Only Bearer tokens are supported');
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      throw new Error('Unauthorized: No token provided');
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (!decoded || !decoded.sub) {
        throw new Error('Unauthorized: Invalid token payload');
      }

      // Create local MySQL database client acting as Supabase
      const supabase = new ServerSupabaseMySQLClient(decoded.sub, decoded.role || 'user');

      return next({
        context: {
          supabase,
          userId: decoded.sub,
          claims: decoded,
        },
      });
    } catch (err) {
      console.error('[Auth Middleware] JWT verification failed:', err);
      throw new Error('Unauthorized: Invalid token');
    }
  },
);
