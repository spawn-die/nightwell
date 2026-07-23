import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 4790, host: true },
  preview: { port: 4790 },
  build: { target: 'es2022', outDir: 'dist' },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
