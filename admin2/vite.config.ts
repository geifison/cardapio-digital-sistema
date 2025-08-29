import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // Base dinâmica: "/" em dev (Vite), e caminho do Apache em produção
  base: mode === 'production' ? '/cardapio-digital-sistema/admin2/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5190,
    strictPort: true,
    proxy: {
      // Encaminha /api -> servidor PHP embutido
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
}));
