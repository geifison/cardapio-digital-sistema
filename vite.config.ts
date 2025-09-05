import { createRequire } from 'module';
import path from 'node:path';

// Carrega dependências do Vite e plugins a partir do workspace admin
const requireFromAdmin = createRequire(new URL('./admin/package.json', import.meta.url));
const react = requireFromAdmin('@vitejs/plugin-react-swc').default;

// Exporta configuração unificada para o projeto, apontando o root para admin
export default ({ mode }: { mode: string }) => ({
  root: path.resolve(__dirname, 'admin'),
  // Base dinâmica: "/" em dev (Vite), e caminho do Apache em produção
  base: mode === 'production' ? '/cardapio-digital-sistema/admin/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'admin', 'src'),
    },
  },
  server: {
    port: 5190,
    strictPort: true,
    proxy: {
      // Encaminha /api -> servidor PHP embutido
      '/api': {
        target: process.env.API_TARGET || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});