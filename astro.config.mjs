import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  // WAJIB: Mengubah output menjadi 'server' untuk fitur dinamis (upload/download)
  output: 'server',
  
  // Menggunakan adapter Node.js (mode standalone agar bisa dijalankan dengan node server.mjs)
  adapter: node({
    mode: 'standalone',
  }),

  // Kita tidak perlu integrasi Tailwind disini karena Anda menggunakan CDN di Layout
});
