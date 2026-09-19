import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig(() => {
  const here = import.meta.dirname
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(here, './src') },
    },
    server: {
      host: '0.0.0.0',
      port: parseInt(process.env.PORT || '5173'),
      strictPort: true,
      watch: { ignored: ['**/.figma/**'] },
      // Keep the browser on :5173 while forwarding optimizer/auth requests to
      // the Node API on :4000 during local development.
      proxy: {
        '/api': { target: process.env.VITE_BACKEND_URL || 'http://localhost:4000', changeOrigin: true },
      },
    },
    build: {
      sourcemap: process.env.NODE_ENV === 'development',
    },
  }
})
