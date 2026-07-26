import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function normalizeBasePath(value: string | undefined): string {
  const raw = value?.trim() || '/';
  const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

export default defineConfig({
  plugins: [react()],
  base: normalizeBasePath(process.env.VITE_BASE_PATH),
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
