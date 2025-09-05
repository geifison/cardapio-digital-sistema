import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Interceptar logs do console com foco nos de filtragem
  page.on('console', msg => {
    const text = msg.text();
    console.log('CONSOLE:', text);
    
    // Destacar logs de filtragem e colunas
    if (text.includes('Filtrando pedidos') || text.includes('Pedidos filtrados') || text.includes('Pedido corresponde') || text.includes('CRIANDO COLUNAS') || text.includes('COLUNAS CRIADAS')) {
      console.log('🔍 FILTRO/COLUNAS:', text);
    }
  });
  
  // Interceptar erros
  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
  });
  
  // Interceptar erros de console
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('CONSOLE ERROR:', msg.text());
    }
  });
  
  try {
    // Navegar para a página
    await page.goto('http://localhost:5190/');
    console.log('URL atual:', page.url());
    
    // Fazer login
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
    await page.fill('input[type="email"], input[name="email"]', 'diretor@gsite.com.br');
    await page.fill('input[type="password"], input[name="password"]', 'admin123');
    await page.click('button[type="submit"], .login-button, button:has-text("Entrar")');
    
    // Aguardar login
    await page.waitForTimeout(3000);
    
    // Navegar explicitamente para /pedidos (rota correta)
  await page.goto('http://localhost:5190/pedidos');
  console.log('URL após navegação para /pedidos:', page.url());
    
    // Aguardar mais um pouco para os dados carregarem
  await page.waitForTimeout(8000);
  
  console.log('URL final:', page.url());
  
  // Forçar uma atualização da página para garantir que os logs sejam executados
  await page.reload();
  await page.waitForTimeout(3000);
    
    // Capturar screenshot
    await page.screenshot({ path: 'orders-page.png', fullPage: true });
    console.log('Screenshot salvo como orders-page.png');
    
    // Verificar HTML da página
    const bodyHTML = await page.innerHTML('body');
    
    // Verificar se há elementos relacionados a pedidos
    const hasKanban = bodyHTML.includes('kanban') || bodyHTML.includes('column');
    const hasOrders = bodyHTML.includes('order') || bodyHTML.includes('pedido');
    const hasCards = bodyHTML.includes('card');
    
    console.log('Página contém elementos Kanban:', hasKanban);
    console.log('Página contém elementos de pedidos:', hasOrders);
    console.log('Página contém cards:', hasCards);
    
    // Verificar se há texto "Nenhum pedido hoje"
    const hasNoOrdersText = bodyHTML.includes('Nenhum pedido') || bodyHTML.includes('No orders');
    console.log('Página mostra "Nenhum pedido":', hasNoOrdersText);
    
    // Verificar elementos específicos
    const kanbanColumns = await page.$$('[data-column], .column, .kanban-column');
    console.log('Colunas Kanban encontradas:', kanbanColumns.length);
    
    const orderCards = await page.$$('.order-card, [data-order-id], .sortable-card');
    console.log('Cards de pedidos encontrados:', orderCards.length);
    
    // Verificar divs com classes que podem ser cards
    const allDivs = await page.$$('div[class*="rounded"], div[class*="border"], div[class*="shadow"]');
    console.log('Divs com classes de card encontradas:', allDivs.length);
    
    // Verificar se há elementos com número de pedido
    const orderNumbers = await page.$$('text=/#\d+/');
    console.log('Números de pedido encontrados:', orderNumbers.length);
    
    // Verificar estrutura da página
    console.log('\n=== VERIFICAÇÃO DE ESTRUTURA ===');
    
    // Verificar colunas específicas
    const novosFound = await page.getByText('Novos').isVisible();
    const producaoFound = await page.getByText('Produção').isVisible();
    const entregaFound = await page.getByText('Entrega').isVisible();
    const concluidosFound = await page.getByText('Concluídos').isVisible();
    
    console.log(`Coluna "Novos" encontrada: ${novosFound}`);
    console.log(`Coluna "Produção" encontrada: ${producaoFound}`);
    console.log(`Coluna "Entrega" encontrada: ${entregaFound}`);
    console.log(`Coluna "Concluídos" encontrada: ${concluidosFound}`);
    
    // Verificar se o número do pedido está presente na página
    const pageText = await page.textContent('body');
    const hasOrderNumber = pageText.includes('20250904-5502');
    console.log(`Número do pedido 20250904-5502 encontrado na página: ${hasOrderNumber}`);
    
    // Verificar se há elementos com o número do pedido usando getByText
    const orderNumberVisible = await page.getByText('20250904-5502').isVisible().catch(() => false);
    console.log(`Elemento com número do pedido visível: ${orderNumberVisible}`);
    
    // Verificar se o card está sendo renderizado corretamente
    const cardElements = await page.locator('.rounded-lg').count();
    console.log(`Total de elementos com classe rounded-lg: ${cardElements}`);
     
   } catch (error) {
    console.error('Erro no teste:', error);
  } finally {
    await browser.close();
  }
})();