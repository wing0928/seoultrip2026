import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function offlinePrecacheManifest() {
  return {
    name: 'offline-precache-manifest',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle)
        .filter((fileName) => !fileName.endsWith('.map'))
        .map((fileName) => `./${fileName}`);

      this.emitFile({
        type: 'asset',
        fileName: 'precache-manifest.json',
        source: JSON.stringify({ files }, null, 2)
      });
    }
  };
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), offlinePrecacheManifest()]
});
