import app from './api/app';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const distPath = path.resolve(__dirname, 'dist');
  
  // Ensure dist exists on production boot if Cloud Run didn't run npm run build
  if (!fs.existsSync(path.resolve(distPath, 'index.html'))) {
    console.log('[Teh Kota Server] dist/ not found, building Vite app on the fly for production...');
    try {
      const { build } = await import('vite');
      await build();
      console.log('[Teh Kota Server] Vite build completed successfully on startup.');
    } catch (e) {
      console.error('[Teh Kota Server] Failed to build Vite app on startup:', e);
    }
  }

  if (process.env.NODE_ENV === 'production' || fs.existsSync(distPath)) {
    if (fs.existsSync(distPath)) {
      app.use(
        express.static(distPath, {
          setHeaders: (res, filePath) => {
            if (
              filePath.endsWith('.html') ||
              filePath.endsWith('sw.js') ||
              filePath.endsWith('.webmanifest') ||
              filePath.endsWith('registerSW.js')
            ) {
              res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
              res.setHeader('Pragma', 'no-cache');
              res.setHeader('Expires', '0');
            } else if (filePath.includes('/assets/')) {
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            }
          },
        })
      );
    }
    app.use(express.static(path.resolve(__dirname, 'public')));
    app.get('*', (_req, res) => {
      const indexPath = path.resolve(distPath, 'index.html');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.sendFile(path.resolve(__dirname, 'index.html'));
      }
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Teh Kota Server] running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
  });
}

export default app;
