import { createAPIFileRoute } from '@tanstack/react-start/api';
import db from '@/lib/db';

export const APIRoute = createAPIFileRoute('/api/public/make-admin')({
  GET: async ({ request }) => {
    try {
      const url = new URL(request.url);
      const email = url.searchParams.get('email');
      const secret = url.searchParams.get('secret');

      if (secret !== 'vw2admin2026') {
        return new Response('Unauthorized', { status: 401 });
      }

      if (!email) {
        return new Response('Email required', { status: 400 });
      }

      // Buscar user_id pelo email
      const [users]: any = await db.query('SELECT id FROM users WHERE email = ?', [email]);
      
      if (!users || users.length === 0) {
        return new Response(`Usuário ${email} não encontrado no banco. Logue primeiro.`, { status: 404 });
      }

      const userId = users[0].id;

      // Promover a admin
      await db.query(
        "INSERT INTO user_roles (id, user_id, role) VALUES (UUID(), ?, 'admin') ON DUPLICATE KEY UPDATE role='admin'", 
        [userId]
      );

      return new Response(`Sucesso! O usuário ${email} agora é um Administrador. Pode atualizar a página!`, { status: 200 });

    } catch (e: any) {
      return new Response(`Erro: ${e.message}`, { status: 500 });
    }
  },
});
