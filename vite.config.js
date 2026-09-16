import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_debugger: true,
        passes: 2
      },
      format: {
        comments: false
      },
      mangle: {
        toplevel: false,
        safari10: true
      }
    },
    cssMinify: true
  },
  server: {
    port: 3000,
    open: true,
  }
});
