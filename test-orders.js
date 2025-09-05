import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Capturar logs do console
  page.on('console', msg => {
    console.log('CONSOLE:', msg.text());
  });
  
  // Navegar para a página de pedidos
  await page.goto('http://localhost:5190/');
  console.log('URL atual:', page.url());
  
  // Aguardar um pouco para a página carregar
  await page.waitForTimeout(3000);
  
  // Verificar se estamos na página de login
  const isLoginPage = await page.locator('input[type="email"], input[type="password"]').count();
  console.log('Elementos de login encontrados:', isLoginPage);
  
  // Se estamos na página de login, fazer login
  if (isLoginPage > 0) {
    console.log('Fazendo login...');
    await page.fill('input[type="email"]', 'diretor@gsite.com.br');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Aguardar redirecionamento
     await page.waitForTimeout(3000);
     console.log('URL após login:', page.url());
     
     // Navegar explicitamente para a página de pedidos se não estivermos lá
     if (!page.url().includes('/orders')) {
       console.log('Navegando para /orders...');
       await page.goto('http://localhost:5190/orders');
       await page.waitForTimeout(3000);
       console.log('URL após navegar para orders:', page.url());
     }
   }
  
  // Aguardar mais tempo para os pedidos carregarem
  await page.waitForTimeout(5000);
  
  // Aguardar um pouco mais para garantir que tudo carregou
  await page.waitForTimeout(5000);
  
  // Verificar se os pedidos estão sendo filtrados pela data de hoje
  const todayDate = new Date().toISOString().split('T')[0];
  console.log(`Data de hoje: ${todayDate}`);
  
  // Executar JavaScript para verificar o estado dos pedidos
  const ordersState = await page.evaluate(() => {
      // Tentar acessar o store do Zustand
      if (window.useOrdersStore) {
          const state = window.useOrdersStore.getState();
          return {
              totalOrders: state.orders?.length || 0,
              todayOrders: state.orders?.filter(o => o.created_at?.startsWith('2025-09-03'))?.length || 0,
              orderStatuses: state.orders?.map(o => o.status) || [],
              firstOrderDate: state.orders?.[0]?.created_at || null
          };
      }
      return { error: 'Store não encontrado' };
  });
  
  console.log('Estado dos pedidos:', JSON.stringify(ordersState, null, 2));
  
  // Verificar elementos específicos das colunas Kanban
  const novosColumn = await page.$('[data-column="novos"], .novos-column');
  const producaoColumn = await page.$('[data-column="producao"], .producao-column');
  const entregaColumn = await page.$('[data-column="entrega"], .entrega-column');
  const finalizadosColumn = await page.$('[data-column="finalizados"], .finalizados-column');
  
  console.log(`Coluna Novos: ${novosColumn ? 'encontrada' : 'não encontrada'}`);
  console.log(`Coluna Produção: ${producaoColumn ? 'encontrada' : 'não encontrada'}`);
  console.log(`Coluna Entrega: ${entregaColumn ? 'encontrada' : 'não encontrada'}`);
  console.log(`Coluna Finalizados: ${finalizadosColumn ? 'encontrada' : 'não encontrada'}`);
  
  // Verificar cards de pedidos em cada coluna
  const orderCards = await page.$$('.order-card, [data-testid="order-card"], .sortable-card');
  console.log(`Cards de pedidos encontrados: ${orderCards.length}`);
  
  console.log('Teste concluído');
  
  // Capturar screenshot
  await page.screenshot({ path: 'orders-page.png', fullPage: true });
  
  // Aguardar mais um pouco para ver os logs
  await page.waitForTimeout(5000);
  
  await browser.close();
})();