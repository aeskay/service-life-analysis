import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  // Force Vite to pre-bundle Plotly at startup so it's never discovered
  // mid-session (which would cause a dep-optimizer restart + connection drop)
  optimizeDeps: {
    include: ['plotly.js-dist-min'],
  },
});
