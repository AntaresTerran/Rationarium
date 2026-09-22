import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname),
  plugins: [react()],
  build: { outDir: resolve(__dirname, '../../dist/client'), emptyOutDir: true },
  server: { proxy: { '/api': 'http://127.0.0.1:53117', '/ws': { target: 'ws://127.0.0.1:53117', ws: true } } },
});
