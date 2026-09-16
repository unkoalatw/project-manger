import { defineConfig } from 'vite';

export default defineConfig({
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
    host: '0.0.0.0',
    port: 3000,
    open: false,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    open: false,
  }
});
