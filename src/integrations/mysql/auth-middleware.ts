import { createMiddleware } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import jwt from 'jsonwebtoken';
import { ServerMySQLClient } from '@/lib/db-client';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-this-in-production-or-use-a-strong-uuid-or-hash';

export const requireAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const request = getRequest();

    if (!request?.headers) {
      throw new Error('Não autorizado: cabeçalhos de requisição indisponíveis');
    }

    const authHeader = request.headers.get('authorization');

    if (!authHeader) {
      throw new Error('Não autorizado: cabeçalho de autorização ausente');
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new Error('Não autorizado: apenas tokens Bearer são suportados');
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      throw new Error('Não autorizado: token não fornecido');
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (!decoded || !decoded.sub) {
        throw new Error('Não autorizado: payload do token inválido');
      }

      // Cria cliente MySQL scopado ao usuário autenticado
      const db = new ServerMySQLClient(decoded.sub, decoded.role || 'user');

      return next({
        context: {
          db,
          // Alias de compatibilidade — preferir context.db em código novo
          supabase: db,
          userId: decoded.sub,
          claims: decoded,
        },
      });
    } catch (err) {
      console.error('[Auth] Falha na verificação do JWT:', err);
      throw new Error('Não autorizado: token inválido');
    }
  },
);
export { requireAuth as requireSupabaseAuth };
