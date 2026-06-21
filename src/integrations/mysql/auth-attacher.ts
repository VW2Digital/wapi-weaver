import { createMiddleware } from '@tanstack/react-start'
import { db } from './client'

// Registrado como `functionMiddleware` global em `src/start.ts`.
// Anexa o token JWT de autenticação em todas as chamadas de serverFn.
export const attachAuth = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    const { data } = await db.auth.getSession()
    const token = data.session?.access_token
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  },
)
