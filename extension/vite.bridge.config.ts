import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/content/page-bridge.ts'),
      name: 'CodePilotPageBridge',
      formats: ['iife'],
      fileName: () => 'page-bridge.js',
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
  },
});
