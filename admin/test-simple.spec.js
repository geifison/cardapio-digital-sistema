import { test, expect } from '@playwright/test';

test('Verificar se o componente Orders está sendo renderizado', async ({ page }) => {
  console.log('🚀 Teste simples de renderização...');
  
  // Capturar TODOS os logs do console
  page.on('console', msg => {
    const text = msg.text();
    console.log('🖥️ Console:', text);
    // Log especial para socket - mais específico
    if (text.includes('🔌') || text.includes('getAdminSocket') || text.includes('Socket') || text.includes('URL') || text.includes('namespace')) {
      console.log('🔍 SOCKET LOG:', text);
    }
  });
  
  page.on('pageerror', error => {
    console.log('❌ Erro na página:', error.message);
  });
  
  // Navegar para a página de pedidos
  await page.goto('http://localhost:5173/pedidos');
  await page.waitForLoadState('networkidle');
  
  // Verificar URL atual
  console.log('🌐 URL atual:', page.url());
  
  // Verificar se há elementos na página
  const title = await page.textContent('h1').catch(() => 'Não encontrado');
  console.log('📄 Título:', title);
  
  // Verificar se há cards de pedidos
  const cards = await page.locator('.rounded-lg').count();
  console.log('📊 Cards encontrados:', cards);
  
  // Aguardar um pouco para ver logs
  await page.waitForTimeout(3000);
  
  console.log('✅ Teste concluído');
});