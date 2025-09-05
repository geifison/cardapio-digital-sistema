import { test, expect } from '@playwright/test';

test('Sistema deve receber novos pedidos automaticamente via Socket.IO', async ({ page }) => {
  console.log('🚀 Iniciando teste de tempo real...');
  
  // Garantir que o socket não seja desabilitado durante o teste
  await page.addInitScript(() => {
    window.__DISABLE_SOCKET__ = false;
  });
  
  // Navegar para a página de pedidos
  await page.goto('http://localhost:5173/pedidos');

  // Aguardar carregamento da página
  await page.waitForLoadState('networkidle');
  
  // Verificar se foi redirecionado para login
  const currentUrl = page.url();
  console.log('🌐 URL atual:', currentUrl);
  
  if (currentUrl.includes('/login')) {
    console.log('🔐 Redirecionado para login - fazendo autenticação...');
    
    // Fazer login
    await page.fill('input[type="email"]', 'admin@admin.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    
    // Aguardar redirecionamento após login
    await page.waitForURL('http://localhost:5173/');
    
    // Navegar novamente para pedidos
    await page.goto('http://localhost:5173/pedidos');
    await page.waitForLoadState('networkidle');
    
    console.log('✅ Login realizado, navegando para pedidos');
  }
  
  // Verificar se a página carregou
  const pageTitle = await page.textContent('h1');
  console.log('📄 Título da página:', pageTitle);
  
  // Aguardar conexão Socket.IO
    console.log('⏳ Aguardando conexão Socket.IO...');
    
    // Verificar logs do console do navegador
    page.on('console', msg => {
      const text = msg.text();
      // Capturar TODOS os logs para debug
      console.log('🖥️ Console do navegador:', text);
      if (msg.type() === 'error') {
        console.log('❌ Erro no console:', text);
      }
    });
    
    await page.waitForTimeout(5000);
    
    // Contar cards de pedidos iniciais (cada card é um div.rounded-md.border.p-3)
    const cardSelector = 'div.rounded-md.border.p-3';
    const initialCards = await page.locator(cardSelector).count();
    console.log('📊 Pedidos iniciais encontrados:', initialCards);
  
  // Verificar se Socket.IO está conectado
  const socketStatus = await page.evaluate(() => {
    // Verificar múltiplas formas de status do socket
    const globalSocket = window.__SOCKET_CONNECTED__;
    const storeSocket = window.__ZUSTAND_STORE__?.ordersStore?.socketConnected;
    const disableSocket = window.__DISABLE_SOCKET__;
    
    // Tentar acessar o socket diretamente
    let adminSocketInfo = null;
    try {
      // Verificar se existe uma instância do socket no window
      const adminSocket = window.__ADMIN_SOCKET__ || window.adminSocket;
      if (adminSocket) {
        adminSocketInfo = {
          connected: adminSocket.connected,
          id: adminSocket.id,
          transport: adminSocket.io?.engine?.transport?.name,
          url: adminSocket.io?.uri
        };
      }
    } catch (e) {
      console.log('Erro ao acessar socket:', e.message);
    }
    
    console.log('Debug socket - global:', globalSocket, 'store:', storeSocket, 'disable:', disableSocket);
    console.log('Admin socket info:', adminSocketInfo);
    
    return {
      global: globalSocket || 'unknown',
      store: storeSocket || 'unknown',
      disableSocket: disableSocket,
      adminSocket: adminSocketInfo
    };
  });
  console.log('🔌 Status detalhado do Socket.IO:', socketStatus);
  
  // Simular criação de novo pedido via API
  console.log('📝 Simulando criação de novo pedido...');
  
  const newOrderData = {
    customer_name: 'Cliente Teste Tempo Real',
    customer_phone: '11999999999',
    customer_address: 'Rua Teste, 123',
    payment_method: 'pix',
    order_type: 'delivery',
    items: [
      {
        product_id: 1,
        product_name: 'Pizza Teste',
        quantity: 1,
        price: 25.90,
        notes: 'Teste de tempo real'
      }
    ],
    total: 25.90
  };
  
  // Fazer requisição para criar pedido
  const response = await page.request.post('http://localhost:8000/api/orders', {
    data: newOrderData,
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  const responseData = await response.json();
  console.log('📦 Resposta da API:', responseData);
  
  if (response.ok() && responseData.success) {
    console.log('✅ Pedido criado com sucesso:', responseData.data?.order_number);
    
    // Aguardar atualização automática via Socket.IO
    console.log('⏳ Aguardando atualização automática...');
    await page.waitForTimeout(2000);
    // Aguarda aumento no número de cards, se possível
    await page
      .waitForFunction(
        (sel, initial) => document.querySelectorAll(sel).length > initial,
        cardSelector,
        initialCards
      )
      .catch(() => {});
    
    // Contar pedidos após criação
    const finalCards = await page.locator(cardSelector).count();
    console.log('📊 Pedidos após criação:', finalCards);
    
    // Verificar se o novo pedido apareceu (busca pelo título com #<numero>)
    const orderNumber = String(responseData.data?.order_number || '');
    const orderLocator = page.getByText(`#${orderNumber}`);
    await expect(orderLocator).toBeVisible({ timeout: 10000 });
    const orderNumberExists = true;
    console.log('🔍 Novo pedido visível na tela:', orderNumberExists);
    
    // Verificar se houve aumento no número de cards
    const cardsIncreased = finalCards > initialCards;
    console.log('📈 Número de cards aumentou:', cardsIncreased);
    
    // Resultados do teste
    console.log('\n📋 RESULTADOS DO TESTE:');
    console.log('- Pedidos iniciais:', initialCards);
    console.log('- Pedidos finais:', finalCards);
    console.log('- Novo pedido visível:', orderNumberExists);
    console.log('- Cards aumentaram:', cardsIncreased);
    console.log('- Socket conectado:', socketStatus);
    
    // Assertions
    expect(orderNumberExists).toBe(true);
    expect(cardsIncreased).toBe(true);
    
  } else {
    console.error('❌ Erro ao criar pedido:', responseData);
    throw new Error('Falha ao criar pedido de teste');
  }
  
  console.log('✅ Teste de tempo real concluído!');
});