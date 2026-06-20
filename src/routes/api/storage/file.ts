import { createFileRoute } from '@tanstack/react-router';
import fs from 'fs';
import path from 'path';

// Get current directory path in ESM
const __dirname = path.resolve();

export const Route = createFileRoute('/api/storage/file')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const filePath = url.searchParams.get("path");
          
          if (!filePath) {
            return new Response("Missing path parameter", { status: 400 });
          }

          // Safety normalization to prevent directory traversal
          const safePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
          const fullPath = path.join(__dirname, 'public', 'uploads', safePath);

          if (!fs.existsSync(fullPath)) {
            return new Response("File not found", { status: 404 });
          }

          const fileData = fs.readFileSync(fullPath);
          
          // Determine mime type roughly
          const ext = path.extname(fullPath).toLowerCase();
          let contentType = 'application/octet-stream';
          if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
          else if (ext === '.png') contentType = 'image/png';
          else if (ext === '.webp') contentType = 'image/webp';
          else if (ext === '.gif') contentType = 'image/gif';
          else if (ext === '.svg') contentType = 'image/svg+xml';

          return new Response(fileData, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=86400',
            }
          });
        } catch (err: any) {
          console.error('[Storage API] Serve file error:', err);
          return new Response("Internal Server Error", { status: 500 });
        }
      }
    }
  }
});
