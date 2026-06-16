import { createFileRoute } from '@tanstack/react-router';
import fs from 'fs';
import path from 'path';

// Get current directory path in ESM
const __dirname = path.resolve();

export const Route = createFileRoute('/api/storage/upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { path: filePath, fileData } = await request.json();
          if (!filePath || !fileData) {
            return new Response(JSON.stringify({ error: 'Missing path or fileData' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          // Safety normalization to prevent directory traversal
          const safePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
          const fullPath = path.join(__dirname, 'public', 'uploads', safePath);
          const dir = path.dirname(fullPath);

          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          const buffer = Buffer.from(fileData, 'base64');
          fs.writeFileSync(fullPath, buffer);

          return new Response(JSON.stringify({ success: true, path: safePath }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (err: any) {
          console.error('[Storage API] Upload error:', err);
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }
  }
});
