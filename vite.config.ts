import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// Plugin API mini chạy ngay trong Vite
function localDatabasePlugin(): Plugin {
  const dataDir = path.resolve(fileURLToPath(new URL('.', import.meta.url)), 'data_storage');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const getFilePath = (name: string) => path.join(dataDir, `${name}.json`);

  return {
    name: 'local-database-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Chỉ xử lý các API bắt đầu bằng /api/local/
        if (!req.url?.startsWith('/api/local/')) {
          return next();
        }

        const endpoint = req.url.replace('/api/local/', '').split('?')[0];
        const filePath = getFilePath(endpoint);

        // GET: Đọc dữ liệu từ file trên máy
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf-8');
            res.end(data);
          } else {
            res.end(JSON.stringify([]));
          }
          return;
        }

        // POST: Nhận dữ liệu từ web/điện thoại và lưu đè vào file trên máy
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              fs.writeFileSync(filePath, body, 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, count: JSON.parse(body || '[]').length }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), localDatabasePlugin()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('.', import.meta.url)),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});