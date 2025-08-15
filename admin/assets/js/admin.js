/**
 * Sistema de Painel Administrativo
 * JavaScript Principal
 */

// Configurações globais
const CONFIG = {
    API_BASE_URL: '../api/',
    REFRESH_INTERVAL: 5000, // 5 segundos
    CURRENCY: 'R$'
};

// Estado global da aplicação
let appState = {
    user: null,
    orders: [],
    products: [],
    categories: [],
    isAuthenticated: false,
    currentSection: 'orders',
    refreshInterval: null,
    orderTimers: new Map(),
    orderSoundInterval: null, // Intervalo para o som em loop
    hasNewOrders: false, // Flag para controlar se há pedidos novos
    ordersPaused: false,
    pauseMessage: ''
};

// Inicialização da aplicação
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

/**
 * Inicializa a aplicação
 */
async function initializeApp() {
    try {
        // Configura event listeners essenciais primeiro
        setupLoginEventListener();
        
        // Verifica se há autenticação
        const isAuth = await checkAuthentication();
        
        if (isAuth) {
            hideLoginModal();
            await Promise.all([
                loadInitialData(),
                fetchPauseState()
            ]);
            setupEventListeners();
            renderPauseButtonState();
            startAutoRefresh();
        } else {
            showLoginModal();
        }
    } catch (error) {
        console.error('Erro ao inicializar aplicação:', error);
        showLoginModal();
    }
}

// ====== Controle de Pausa de Pedidos ======
async function fetchPauseState() {
    try {
        const resp = await fetch(CONFIG.API_BASE_URL + 'settings/pause', { credentials: 'include' });
        if (!resp.ok) return;
        const json = await resp.json();
        if (json && json.success && json.data) {
            appState.ordersPaused = !!json.data.paused;
            appState.pauseMessage = String(json.data.message || '');
        }
    } catch (e) { /* noop */ }
}

async function togglePauseState() {
    try {
        const newState = !appState.ordersPaused;
        const resp = await fetch(CONFIG.API_BASE_URL + 'settings/pause', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ paused: newState, message: appState.pauseMessage || '' })
        });
        const json = await resp.json();
        if (resp.ok && json && json.success) {
            appState.ordersPaused = newState;
            renderPauseButtonState();
        } else {
            showError((json && (json.message || json.error)) || 'Falha ao alterar estado de pausa');
        }
    } catch (e) {
        showError('Erro ao comunicar com o servidor');
    }
}

function renderPauseButtonState() {
    try {
        const candidates = [
            { btn: document.getElementById('pauseOrdersBtn'), icon: document.getElementById('pauseIcon') },
            { btn: document.getElementById('pauseOrdersNavBtn'), icon: document.getElementById('pauseNavIcon') }
        ];
        candidates.forEach(({ btn, icon }) => {
            if (!btn || !icon) return;
            if (appState.ordersPaused) {
                icon.classList.add('orders-paused-blink');
                icon.style.color = '#dc3545';
                btn.title = 'Pedidos temporariamente pausados';
            } else {
                icon.classList.remove('orders-paused-blink');
                icon.style.color = '';
                btn.title = 'Pausar Pedidos';
            }
        });
    } catch (_) { /* noop */ }
}

/**
 * Verifica autenticação
 */
async function checkAuthentication() {
    try {
        const response = await fetch(CONFIG.API_BASE_URL + 'auth/verify', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.data.authenticated) {
                appState.user = data.data.user;
                appState.isAuthenticated = true;
                updateUserInfo();
                return true;
            }
        }
        
        return false;
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        return false;
    }
}

/**
 * Realiza login
 */
async function login(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const loginData = {
        email: formData.get('email'),
        password: formData.get('password')
    };
    
    try {
        showLoading();
        
        const response = await fetch(CONFIG.API_BASE_URL + 'auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(loginData)
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            appState.user = data.data.user;
            appState.isAuthenticated = true;
            
            hideLoginModal();
            updateUserInfo();
            await loadInitialData();
            setupEventListeners();
            startAutoRefresh();
        } else {
            // A API pode retornar um erro mesmo com um status HTTP 200, então verificamos a chave 'success'
            // Se o status não for 'ok', tratamos a mensagem de erro
            showError(data.message || data.error_message || 'Erro desconhecido ao fazer login');
        }
        
    } catch (error) {
        console.error('Erro no login:', error);
        showError('Erro de conexão. Tente novamente.');
    } finally {
        hideLoading();
    }
}

/**
 * Realiza logout
 */
async function logout() {
    try {
        await fetch(CONFIG.API_BASE_URL + 'auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
        
        appState.user = null;
        appState.isAuthenticated = false;
        
        stopAutoRefresh();
        stopOrderSoundLoop(); // Para o som ao fazer logout
        showLoginModal();
        
    } catch (error) {
        console.error('Erro no logout:', error);
    }
}

/**
 * Carrega dados iniciais
 */
async function loadInitialData() {
    try {
        await Promise.all([
            loadOrders(),
            loadProducts(),
            loadCategories()
        ]);
        
        renderOrdersBoard();
        renderProductsGrid();
        updateDashboard();
        
        // Carrega categorias para o formulário de produtos
        await loadCategoriesForProducts();
    } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
    }
}

/**
 * Carrega pedidos
 */
async function loadOrders(options = {}) {
    const suppressSound = options && options.suppressSound === true;
    try {
        // Garante filtro de hoje por padrão (usando data local, não UTC)
        if (typeof appState.ordersDateFilter === 'undefined' || appState.ordersDateFilter === null) {
            const now = new Date();
            const tzOffsetMin = now.getTimezoneOffset();
            const local = new Date(now.getTime() - tzOffsetMin * 60000);
            appState.ordersDateFilter = local.toISOString().split('T')[0];
        }

        const baseUrl = CONFIG.API_BASE_URL + 'orders';
        const url = appState.ordersDateFilter ? `${baseUrl}?date=${encodeURIComponent(appState.ordersDateFilter)}` : baseUrl;

        const response = await fetch(url, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                const previousOrdersCount = appState.orders.filter(order => order.status === 'novo').length;
                appState.orders = data.data;
                
                // Verifica se há novos pedidos para tocar som
                const currentNewOrdersCount = appState.orders.filter(order => order.status === 'novo').length;
                if (!suppressSound && currentNewOrdersCount > previousOrdersCount && appState.isAuthenticated) {
                    playNotificationSound();
                }
                
                renderOrdersBoard();
                updateOrderTimers();

                // Fallback: se filtrado por data e não retornou nada, tenta sem filtro de data
                const wasFilteredByDate = Boolean(appState.ordersDateFilter);
                if (wasFilteredByDate && Array.isArray(data.data) && data.data.length === 0 && options._retryWithoutDate !== true) {
                    try {
                        const response2 = await fetch(baseUrl, { credentials: 'include' });
                        if (response2.ok) {
                            const data2 = await response2.json();
                            if (data2.success && Array.isArray(data2.data)) {
                                appState.orders = data2.data;
                                renderOrdersBoard();
                                updateOrderTimers();
                            }
                        }
                    } catch (_) {}
                }
            }
        }
    } catch (error) {
        console.error('Erro ao carregar pedidos:', error);
    }
}

/**
 * Carrega produtos
 */
async function loadProducts() {
    try {
        const response = await fetch(CONFIG.API_BASE_URL + 'products', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                appState.products = data.data;
                renderProductsGrid();
            }
        }
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
    }
}

/**
 * Carrega categorias
 */
async function loadCategories() {
    try {
        console.log('🏷️ Carregando categorias...');
        const response = await fetch(CONFIG.API_BASE_URL + 'categories?all=true', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Categorias response:', data);
        
        if (data.success) {
            appState.categories = data.data;
            if (typeof productsState !== 'undefined') {
                productsState.categories = data.data; // sincroniza
            }
            console.log('✅ Categorias carregadas:', data.data.length);
        } else {
            throw new Error(data.message || 'Erro desconhecido ao carregar categorias');
        }
    } catch (error) {
        console.error('❌ Erro ao carregar categorias:', error);
        showError('Erro ao carregar categorias: ' + error.message);
    }
}

/**
 * Carrega categorias para o formulário de produtos
 */
async function loadCategoriesForProducts() {
    try {
        console.log('🏷️ Carregando categorias para produtos...');
        const response = await fetch(CONFIG.API_BASE_URL + 'categories?all=true');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Categorias response:', data);
        
        if (data.success) {
            productsState.categories = data.data;
            appState.categories = data.data; // Sincronizar ambas as variáveis
            console.log('✅ Categorias carregadas:', data.data.length);
            
            // Popula o select de categorias no formulário
            const select = document.getElementById('productCategory');
            if (select) {
                select.innerHTML = '<option value="">Selecione uma categoria</option>' +
                    data.data.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
                console.log('✅ Select de categorias populado');
            } else {
                console.warn('⚠️ Elemento productCategory não encontrado');
            }
        } else {
            throw new Error(data.message || 'Erro desconhecido');
        }
    } catch (error) {
        console.error('❌ Erro ao carregar categorias para produtos:', error);
        throw error;
    }
}

/**
 * Renderiza o quadro de pedidos
 */
function renderOrdersBoard() {
    const newOrdersList = document.getElementById('newOrdersList');
    const productionOrdersList = document.getElementById('productionOrdersList');
    const deliveryOrdersList = document.getElementById('deliveryOrdersList');
    const completedOrdersList = document.getElementById('completedOrdersList');
    
    // Filtra e ordena pedidos por status (mais antigos no topo)
    const sortByOldest = (a, b) => new Date(a.created_at) - new Date(b.created_at);

    const newOrders = appState.orders
        .filter(order => order.status === 'novo')
        .sort(sortByOldest);

    const productionOrders = appState.orders
        .filter(order => order.status === 'aceito' || order.status === 'producao')
        .sort(sortByOldest);

    const deliveryOrders = appState.orders
        .filter(order => order.status === 'entrega')
        .sort(sortByOldest);

    // Finalizados inclui também cancelados (sem limite, lista completa)
    const completedOrders = appState.orders
        .filter(order => order.status === 'finalizado' || order.status === 'cancelado')
        .sort(sortByOldest);
    
    // Atualiza contadores
    document.getElementById('newOrdersCount').textContent = newOrders.length;
    document.getElementById('productionOrdersCount').textContent = productionOrders.length;
    document.getElementById('deliveryOrdersCount').textContent = deliveryOrders.length;
    document.getElementById('completedOrdersCount').textContent = completedOrders.length;
    
    // Renderiza listas
    newOrdersList.innerHTML = newOrders.map(order => createOrderCard(order, 'new')).join('');
    productionOrdersList.innerHTML = productionOrders.map(order => createOrderCard(order, 'production')).join('');
    deliveryOrdersList.innerHTML = deliveryOrders.map(order => createOrderCard(order, 'delivery')).join('');
    completedOrdersList.innerHTML = completedOrders.map(order => createOrderCard(order, 'completed')).join('');
    
    // Controla o som em loop baseado nos pedidos novos, com suporte a supressão pontual
    const hadNewOrders = appState.hasNewOrders;
    const currentlyHasNewOrders = newOrders.length > 0;

    if (appState.suppressOrderSoundOnce) {
        // Atualiza flag interna, mas não inicia/para som nesta renderização
        appState.hasNewOrders = currentlyHasNewOrders;
        appState.suppressOrderSoundOnce = false;
        return;
    }

    appState.hasNewOrders = currentlyHasNewOrders;
    // Se não havia pedidos novos antes e agora há, inicia o som
    if (!hadNewOrders && appState.hasNewOrders) {
        startOrderSoundLoop();
    }
    // Se havia pedidos novos antes e agora não há, para o som
    else if (hadNewOrders && !appState.hasNewOrders) {
        stopOrderSoundLoop();
    }
    // Se já há pedidos novos e o som não está tocando, inicia o som (para casos de carregamento inicial)
    else if (appState.hasNewOrders && !appState.orderSoundInterval) {
        startOrderSoundLoop();
    }
}

/**
 * Cria um card de pedido
 */
function createOrderCard(order, type) {
    const orderTime = new Date(order.created_at);
    const timeString = orderTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    const itemsText = order.items.slice(0, 2).map(item => `${item.quantity}x ${item.product_name}`).join(', ');
    const moreItems = order.items.length > 2 ? ` +${order.items.length - 2} itens` : '';
    
    let actions = '';
    let timer = '';
    let timerBadge = '';
    
    // Timer para pedidos em produção
    if (type === 'production') {
        const startTime = new Date(order.accepted_at || order.created_at);
        const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000 / 60);
        const timerClass = elapsed > 30 ? 'warning' : elapsed > 45 ? 'danger' : 'normal';
        timer = `<div class="order-timer ${timerClass}">${elapsed}min</div>`;
        const bsTimerClass = elapsed > 45 ? 'bg-danger' : elapsed > 30 ? 'bg-warning' : 'bg-success';
        timerBadge = `<span class="badge ${bsTimerClass}">${elapsed}min</span>`;
    }
    
    // Botões de ação baseados no status
    switch (type) {
        case 'new':
            actions = `
                <button class="btn btn-sm btn-outline-success" onclick="updateOrderStatus(${order.id}, 'aceito')" title="Aceitar">
                    <i class="fas fa-check"></i>
                </button>
                <button class="btn btn-sm btn-outline-warning" onclick="editOrder(${order.id})" title="Editar Pedido">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="openCancelOrder(${order.id})" title="Cancelar">
                    <i class="fas fa-ban"></i>
                </button>
            `;
            break;
        case 'production':
            // Verifica se o pedido tem menos de 30 minutos desde aceito
            const productionStartTime = new Date(order.accepted_at || order.created_at);
            const productionElapsed = Math.floor((Date.now() - productionStartTime.getTime()) / 1000 / 60);
            const canEdit = productionElapsed < 30;
            
            actions = `
                <div class="btn-group dropup">
                    <button class="btn btn-sm btn-outline-warning dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false" title="Imprimir" onclick="event.stopPropagation()">
                        <i class="fas fa-print"></i>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end">
                        <li>
                            <button class="dropdown-item" onclick="printKitchenOrderFrom(${order.id}); event.stopPropagation();">
                                <i class=\"fas fa-fire me-2\"></i> Cozinha
                            </button>
                        </li>
                        <li>
                            <button class="dropdown-item" onclick="printCustomerReceipt(${order.id}); event.stopPropagation();">
                                <i class=\"fas fa-user me-2\"></i> Cliente
                            </button>
                        </li>
                    </ul>
                </div>
                <button class="btn btn-sm btn-outline-primary" onclick="updateOrderStatus(${order.id}, 'entrega')" title="Enviar para entrega">
                    <i class="fas fa-truck"></i>
                </button>
                ${canEdit ? `<button class="btn btn-sm btn-outline-warning" onclick="editOrder(${order.id})" title="Editar Pedido">
                    <i class="fas fa-edit"></i>
                </button>` : ''}
                <button class="btn btn-sm btn-outline-danger" onclick="openCancelOrder(${order.id})" title="Cancelar">
                    <i class="fas fa-ban"></i>
                </button>
            `;
            break;
        case 'delivery':
            actions = `
                <button class="btn btn-sm btn-outline-success" onclick="updateOrderStatus(${order.id}, 'finalizado')" title="Finalizar">
                    <i class="fas fa-check-circle"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="openCancelOrder(${order.id})" title="Cancelar">
                    <i class="fas fa-ban"></i>
                </button>
            `;
            break;
        case 'completed':
            // Pedidos finalizados não têm ações
            actions = '';
            break;
    }
    
    const canceledClass = order.status === 'cancelado' ? 'canceled opacity-75' : '';
    const borderClass = order.status === 'cancelado'
        ? 'border-secondary'
        : type === 'new' ? 'border-warning'
        : type === 'production' ? 'border-danger'
        : type === 'delivery' ? 'border-info'
        : 'border-success';
    const orderLabel = `#${order.order_number || order.id}${order.status === 'cancelado' ? ' • Cancelado' : ''}`;

    return `
        <div class="card order-card ${type} ${canceledClass} border-start ${borderClass} shadow-sm" onclick="showOrderDetail(${order.id})">
            <div class="card-header d-flex justify-content-between align-items-center py-2">
                <div class="d-flex align-items-center gap-2">
                    <span class="fw-semibold">${orderLabel}</span>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span class="text-muted small"><i class="far fa-clock me-1"></i>${timeString}</span>
                    ${timerBadge}
                </div>
            </div>
            <div class="card-body py-2">
                <div class="mb-1"><i class="fas fa-user me-1"></i>${order.customer_name}</div>
                <div class="text-muted small">${itemsText}${moreItems}</div>
            </div>
            <div class="card-footer d-flex justify-content-between align-items-center py-2">
                <span class="fw-semibold text-success">${formatCurrency(order.total_amount)}</span>
                <div class="d-flex gap-1" onclick="event.stopPropagation()">
                    ${actions}
                </div>
            </div>
        </div>
    `;
}

/**
 * Atualiza status do pedido
 */
async function updateOrderStatus(orderId, newStatus) {
    try {
        showLoading();
        
        const response = await fetch(CONFIG.API_BASE_URL + `orders/${orderId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ status: newStatus })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                // Não tocar som ao apenas mudar de fase
                await loadOrders({ suppressSound: true });
            } else {
                showError(data.message || 'Erro ao atualizar status');
            }
        } else {
            showError('Erro ao atualizar status do pedido');
        }
        
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        showError('Erro de conexão. Tente novamente.');
    } finally {
        hideLoading();
    }
}

// Fluxo de cancelamento com motivo
function openCancelOrder(orderId) {
    appState.cancelOrderId = orderId;
    const modal = document.getElementById('cancelOrderModal');
    const textarea = document.getElementById('cancelReason');
    if (textarea) textarea.value = '';
    if (modal) modal.classList.add('show');
}

function closeCancelOrderModal() {
    const modal = document.getElementById('cancelOrderModal');
    if (modal) modal.classList.remove('show');
}

async function confirmCancelOrder() {
    const orderId = appState.cancelOrderId;
    const reason = (document.getElementById('cancelReason')?.value || '').trim();
    if (!orderId) return;
    if (!reason) {
        showError('Informe o motivo do cancelamento.');
        return;
    }
    try {
        showLoading();
        const response = await fetch(CONFIG.API_BASE_URL + `orders/${orderId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ status: 'cancelado', cancellation_reason: reason })
        });
        const data = await response.json();
        if (response.ok && data && (data.success || data.data)) {
            // Cancelamento também não deve disparar som adicional
            await loadOrders({ suppressSound: true });
            showSuccess('Pedido cancelado.');
            closeCancelOrderModal();
        } else {
            showError(data.message || 'Erro ao cancelar pedido');
        }
    } catch (e) {
        console.error(e);
        showError('Erro de conexão ao cancelar.');
    } finally {
        hideLoading();
    }
}

/**
 * Mostra detalhes do pedido
 */
function showOrderDetail(orderId) {
    const order = appState.orders.find(o => o.id === orderId);
    if (!order) return;
    
    const modal = document.getElementById('orderDetailModal');
    const content = document.getElementById('orderDetailContent');
    
    // Calcula tempo decorrido
    const orderTime = new Date(order.created_at);
    const elapsed = Math.floor((Date.now() - orderTime.getTime()) / 1000 / 60);
    
    content.innerHTML = generateNewOrderDetailHtml(order);
    
    modal.classList.add('show');
    document.body.classList.add('modal-open');
}

/**
 * Gera HTML do modal de detalhes do pedido com novo layout Tailwind
 */
function generateNewOrderDetailHtml(order) {
    const createdAt = new Date(order.created_at).toLocaleString('pt-BR');
    const itemsSubtotal = Array.isArray(order.items)
        ? order.items.reduce((sum, it) => sum + (typeof it.subtotal === 'number' ? it.subtotal : (it.product_price || 0) * (it.quantity || 0)), 0)
        : 0;
    const subtotal = (order.total_amount || 0) - (order.delivery_fee || 0);
    const businessName = (window.CONFIG && window.CONFIG.PRINT && window.CONFIG.PRINT.BUSINESS_NAME) ? window.CONFIG.PRINT.BUSINESS_NAME : 'Seu Estabelecimento';
    const isMesa = (order.customer_name || '').toLowerCase().includes('mesa');
    const tipo = isMesa ? 'MESA' : ((order.customer_address && order.customer_address.trim() !== '') || (order.delivery_fee && order.delivery_fee > 0)
        ? 'ENTREGA' : 'RETIRADA');
    
    // Calcula desconto
    const discount = Math.max(0, (itemsSubtotal + (order.delivery_fee || 0)) - (order.total_amount || 0));
    
    // Calcula troco
    const changeAmount = order.payment_value && order.payment_value > order.total_amount 
        ? order.payment_value - order.total_amount 
        : 0;

    return `
    <div id="modal" class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-auto overflow-hidden max-h-[90vh]">
        <!-- Modal Content -->
        <div id="print-section" class="p-6 sm:p-8 overflow-y-auto max-h-[calc(90vh-120px)]">
            <!-- Header -->
            <div class="text-center border-b border-dashed pb-4 mb-6">
                <h1 class="text-2xl font-bold text-gray-800">${businessName}</h1>
                <p class="text-sm text-gray-500">${createdAt}</p>
            </div>

            <!-- Order Info -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 mb-6">
                <div class="flex items-center space-x-2">
                    <span class="font-semibold text-gray-600">PEDIDO:</span>
                    <span id="order-number" class="text-gray-800 font-bold">#${order.order_number || order.id || '-'}</span>
                    <button onclick="copyToClipboard('#order-number', 'Número do pedido copiado!')" class="no-print text-gray-400 hover:text-blue-600 transition-colors" title="Copiar número do pedido">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-copy"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="m22 13-2 2-2-2"></path><path d="M11 2H9a2 2 0 0 0-2 2v2"></path></svg>
                    </button>
                </div>
                <div class="flex items-center space-x-2">
                    <span class="font-semibold text-gray-600">STATUS:</span>
                    <span class="px-3 py-1 bg-green-100 text-green-800 text-sm font-semibold rounded-full">${getStatusText(order.status)}</span>
                </div>
                <div class="flex items-center space-x-2">
                    <span class="font-semibold text-gray-600">TIPO:</span>
                    <span class="text-gray-800">${tipo}</span>
                </div>
            </div>

            <!-- Customer Details -->
            <div class="bg-gray-50 p-5 rounded-lg mb-6 border border-gray-200">
                <h2 class="font-bold text-lg text-gray-800 mb-3">Detalhes do Cliente</h2>
                <div class="space-y-3 text-gray-700">
                    <p><span class="font-semibold">NOME:</span> ${order.customer_name || '-'}</p>
                    <div class="flex items-center justify-between">
                       <p><span class="font-semibold">TELEFONE:</span> <span id="phone-number">${order.customer_phone || '-'}</span></p>
                       <div class="no-print flex items-center space-x-2">
                           <button onclick="openWhatsApp()" class="text-gray-400 hover:text-green-600 transition-colors" title="Abrir no WhatsApp">
                               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-message-circle"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                           </button>
                           <button onclick="copyToClipboard('#phone-number', 'Telefone copiado!')" class="text-gray-400 hover:text-blue-600 transition-colors" title="Copiar telefone">
                               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-copy"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="m22 13-2 2-2-2"></path><path d="M11 2H9a2 2 0 0 0-2 2v2"></path></svg>
                           </button>
                       </div>
                    </div>
                    ${order.customer_address ? `
                    <div class="flex items-center justify-between">
                        <p class="pr-4"><span class="font-semibold">ENDEREÇO:</span> <span id="address">${order.customer_address}</span></p>
                        <button onclick="openMaps()" class="no-print text-gray-400 hover:text-red-600 transition-colors flex-shrink-0" title="Abrir no Mapa">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        </button>
                    </div>
                    ` : ''}
                    ${order.customer_neighborhood ? `<p><span class="font-semibold">BAIRRO:</span> ${order.customer_neighborhood}</p>` : ''}
                    ${order.customer_reference ? `<p><span class="font-semibold">REFERÊNCIA:</span> ${order.customer_reference}</p>` : ''}
                </div>
            </div>

            <!-- Items List -->
            <div>
                <h2 class="font-bold text-lg text-gray-800 mb-4">Itens do Pedido</h2>
                <div class="space-y-4">
                    ${order.items.map(item => `
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="font-semibold text-gray-800">${item.quantity}x ${item.product_name}</p>
                            ${item.notes ? `<p class="text-sm text-gray-500">${item.notes.split(/\n|;|,|\r/).map(s => s.trim()).filter(s => s).join(', ').toUpperCase()}</p>` : ''}
                            <p class="text-sm text-gray-500">Unitário: ${formatCurrency(item.product_price || 0)}</p>
                        </div>
                        <p class="font-semibold text-gray-800">${formatCurrency(typeof item.subtotal === 'number' ? item.subtotal : (item.product_price || 0) * (item.quantity || 0))}</p>
                    </div>
                    `).join('')}
                </div>
            </div>

            <!-- Totals -->
            <div class="border-t border-dashed mt-6 pt-6 space-y-2">
                <div class="flex justify-between text-gray-600">
                    <span>Subtotal Itens:</span>
                    <span>${formatCurrency(itemsSubtotal)}</span>
                </div>
                <div class="flex justify-between text-gray-600">
                    <span>Descontos:</span>
                    <span>-${formatCurrency(discount)}</span>
                </div>
                <div class="flex justify-between text-gray-600">
                    <span>Entrega:</span>
                    <span>${formatCurrency(order.delivery_fee || 0)}</span>
                </div>
                <div class="flex justify-between font-bold text-xl text-gray-900 mt-2">
                    <span>Total:</span>
                    <span>${formatCurrency(order.total_amount || 0)}</span>
                </div>
            </div>

            <!-- Payment Details -->
            <div class="bg-blue-50 border border-blue-200 p-4 rounded-lg mt-6 text-blue-800">
                 <p><span class="font-semibold">Pagamento:</span> ${getPaymentMethodText(order.payment_method)}</p>
                 ${order.payment_value ? `<p><span class="font-semibold">Valor pago:</span> ${formatCurrency(order.payment_value)}</p>` : ''}
                 ${changeAmount > 0 ? `<p><span class="font-semibold">Troco:</span> ${formatCurrency(changeAmount)}</p>` : ''}
                 ${order.estimated_delivery_time ? `<p><span class="font-semibold">Tempo estimado:</span> ${order.estimated_delivery_time} min</p>` : ''}
            </div>
        </div>

        <!-- Action Buttons -->
        <div class="no-print bg-gray-50 p-6 flex flex-col sm:flex-row items-center justify-end space-y-3 sm:space-y-0 sm:space-x-4 border-t">
            <button onclick="closeOrderDetailModal()" class="w-full sm:w-auto px-6 py-3 text-gray-700 bg-transparent hover:bg-gray-200 rounded-lg font-semibold transition-colors">
                Fechar
            </button>
            <button onclick="printCustomerReceipt(${order.id})" class="w-full sm:w-auto px-6 py-3 flex items-center justify-center space-x-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-printer"><polyline points="6,9 6,2 18,2 18,9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                <span>Imprimir Via do Cliente</span>
            </button>
        </div>
        
        <!-- Floating message for copy confirmation -->
        <div id="copy-message" class="no-print fixed bottom-5 right-5 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg opacity-0 transition-opacity duration-300">
            Texto copiado!
        </div>
    </div>`;
}

/**
 * Abre o POS para editar um pedido existente
 */
function editOrder(orderId) {
    const order = appState.orders.find(o => o.id === orderId);
    if (!order) {
        showError('Pedido não encontrado');
        return;
    }
    
    // Abre o POS em nova aba com parâmetros de edição
    const posUrl = `../pos.html?pos=1&edit=${orderId}&orderNumber=${order.order_number || order.id}`;
    window.open(posUrl, '_blank');
}

function printCustomerReceipt(orderId) {
    const order = appState.orders.find(o => o.id === orderId);
    if (!order) return;
    const html = generateCustomerReceiptHtml(order);
    printDocument(html);
}

// Gera HTML do recibo do cliente (organizado e claro, com logo opcional)
function generateCustomerReceiptHtml(order) {
    const createdAt = new Date(order.created_at).toLocaleString('pt-BR');
    const itemsSubtotal = Array.isArray(order.items)
        ? order.items.reduce((sum, it) => sum + (typeof it.subtotal === 'number' ? it.subtotal : (it.product_price || 0) * (it.quantity || 0)), 0)
        : 0;
    const subtotal = (order.total_amount || 0) - (order.delivery_fee || 0);
    const logoUrl = (window.CONFIG && window.CONFIG.PRINT && window.CONFIG.PRINT.LOGO_URL) ? window.CONFIG.PRINT.LOGO_URL : '';
    const businessName = (window.CONFIG && window.CONFIG.PRINT && window.CONFIG.PRINT.BUSINESS_NAME) ? window.CONFIG.PRINT.BUSINESS_NAME : 'Comanda';
    const isMesa = (order.customer_name || '').toLowerCase().includes('mesa');
    const tipo = isMesa ? 'MESA' : ((order.customer_address && order.customer_address.trim() !== '') || (order.delivery_fee && order.delivery_fee > 0)
        ? 'ENTREGA' : 'RETIRADA');

    return `
    <div class="receipt">
      <div class="header">
        ${logoUrl ? `<img src="${logoUrl}" class="logo" alt="Logo" />` : `<h1>${businessName}</h1>`}
        <p>${createdAt}</p>
      </div>
      <div class="order-details">
        <p><strong>PEDIDO:</strong> #${order.order_number || order.id || '-'}</p>
        <p><strong>STATUS:</strong> ${getStatusText(order.status)}</p>
        <p><strong>TIPO:</strong> ${tipo}</p>
      </div>
      <div class="order-details" style="margin-top:6px;">
        <p><strong>CLIENTE:</strong> ${order.customer_name || '-'}</p>
        <p><strong>TELEFONE:</strong> ${order.customer_phone || '-'}</p>
        ${order.customer_address ? `<p><strong>ENDEREÇO:</strong> ${order.customer_address}</p>` : ''}
        ${order.customer_neighborhood ? `<p><strong>BAIRRO:</strong> ${order.customer_neighborhood}</p>` : ''}
        ${order.customer_reference ? `<p><strong>REFERÊNCIA:</strong> ${order.customer_reference}</p>` : ''}
      </div>
      <div class="separator"></div>
      ${order.items.map(item => `
        <div class="item-section">
          <h2>${item.quantity}x ${item.product_name}</h2>
          ${item.notes ? `
            <ul class="item-details">
              ${item.notes.split(/\n|;|,|\r/).map(s => s.trim()).filter(s => s).map(s => `<li>${s.toUpperCase()}</li>`).join('')}
            </ul>
          ` : ''}
          <ul class="item-details" style="margin-top:4px;">
            <li><strong>Unitário:</strong> ${formatCurrency(item.product_price || 0)}</li>
            <li><strong>Subtotal:</strong> ${formatCurrency(typeof item.subtotal === 'number' ? item.subtotal : (item.product_price || 0) * (item.quantity || 0))}</li>
          </ul>
        </div>
      `).join('')}
      <div class="separator"></div>
      <div class="order-details">
        <p><strong>Subtotal Itens:</strong> ${formatCurrency(itemsSubtotal)}</p>
        <p><strong>Descontos:</strong> ${formatCurrency((itemsSubtotal + (order.delivery_fee || 0)) - (order.total_amount || 0))}</p>
        <p><strong>Entrega:</strong> ${formatCurrency(order.delivery_fee || 0)}</p>
        <p><strong>Total:</strong> ${formatCurrency(order.total_amount || 0)}</p>
      </div>
      <div class="order-details" style="margin-top:6px;">
        <p><strong>Pagamento:</strong> ${getPaymentMethodText(order.payment_method)}</p>
        ${order.payment_value ? `<p><strong>Valor pago:</strong> ${formatCurrency(order.payment_value)}</p>` : ''}
        ${order.change_amount > 0 ? `<p><strong>Troco:</strong> ${formatCurrency(order.change_amount)}</p>` : ''}
        ${order.estimated_delivery_time ? `<p><strong>Tempo estimado:</strong> ${order.estimated_delivery_time} min</p>` : ''}
      </div>
      ${order.notes ? `
        <div class="obs-section">
          <h2>*** OBSERVAÇÕES ***</h2>
          <ul>
            ${order.notes.split(/\n|;|\r/).map(s => s.trim()).filter(s => s).map(s => `<li>- ${s.toUpperCase()}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      <div class="separator"></div>
    </div>`;
}

// Gera HTML da comanda de cozinha (detalhe com fontes grandes e legíveis)
function generateKitchenTicketHtml(order) {
    const createdAt = new Date(order.created_at).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const logoUrl = (window.CONFIG && window.CONFIG.PRINT && window.CONFIG.PRINT.LOGO_URL) ? window.CONFIG.PRINT.LOGO_URL : '';
    const businessName = (window.CONFIG && window.CONFIG.PRINT && window.CONFIG.PRINT.BUSINESS_NAME) ? window.CONFIG.PRINT.BUSINESS_NAME : 'Cozinha';
    return `
    <div class="receipt">
      <div class="header">
        ${logoUrl ? `<img src="${logoUrl}" class="logo" alt="Logo" />` : `<h1>${businessName}</h1>`}
        <p>${createdAt}</p>
      </div>
      <div class="order-details">
        <p><strong>PEDIDO: #${order.order_number}</strong></p>
        ${order.customer_name ? `<p><strong>CLIENTE:</strong> ${order.customer_name}</p>` : ''}
      </div>
      <div class="separator"></div>
      ${order.items.map(item => `
        <div class="item-section">
          <h2>${item.quantity}x ${item.product_name}</h2>
          ${item.notes ? `
            <ul class="item-details">
              ${item.notes.split(/\n|;|,|\r/).map(s => s.trim()).filter(s => s).map(s => `<li><strong>•</strong> ${s.toUpperCase()}</li>`).join('')}
            </ul>
          ` : ''}
        </div>
      `).join('')}
      ${order.notes ? `
        <div class="obs-section">
          <h2>*** OBSERVAÇÕES ***</h2>
          <ul>
            ${order.notes.split(/\n|;|\r/).map(s => s.trim()).filter(s => s).map(s => `<li>- ${s.toUpperCase()}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      <div class="separator"></div>
    </div>`;
}

/**
 * Fecha modal de detalhes do pedido
 */
function closeOrderDetailModal() {
    const modal = document.getElementById('orderDetailModal');
    modal.classList.remove('show');
    document.body.classList.remove('modal-open');
}

/**
 * Mostra modal de impressão
 */
function showPrintModal(orderId) {
    appState.currentOrderId = orderId;
    const modal = document.getElementById('printModal');
    modal.classList.add('show');
}

/**
 * Fecha modal de impressão
 */
function closePrintModal() {
    const modal = document.getElementById('printModal');
    modal.classList.remove('show');
}

/**
 * Imprime comanda da cozinha
 */
function printKitchenOrder() {
    const order = appState.orders.find(o => o.id === appState.currentOrderId);
    if (!order) return;
    
    const printContent = generateKitchenTicketHtml(order);
    printDocument(printContent);
    closePrintModal();
}

// Atalho para acionar impressão da cozinha a partir do card (sem abrir modal)
function printKitchenOrderFrom(orderId) {
    appState.currentOrderId = orderId;
    printKitchenOrder();
}

/**
 * Imprime comanda do cliente
 */
function printCustomerOrder() {
    const order = appState.orders.find(o => o.id === appState.currentOrderId);
    if (!order) return;
    
    const printContent = generateCustomerReceiptHtml(order);
    printDocument(printContent);
    closePrintModal();
}

/**
 * Imprime documento
 */
function printDocument(content) {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Impressão - ${ (window.CONFIG && window.CONFIG.PRINT && window.CONFIG.PRINT.BUSINESS_NAME) ? window.CONFIG.PRINT.BUSINESS_NAME : 'Cardápio Digital' }</title>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <link href="https://fonts.googleapis.com/css2?family=Inconsolata:wght@400;700&display=swap" rel="stylesheet">
            <style>
                @media print {
                    body * { visibility: hidden; }
                    #print-area, #print-area * { visibility: visible; }
                    #print-area { position: absolute; left: 0; top: 0; width: 100%; }
                    .no-print { display: none; }
                    @page { margin: 0.5cm; size: 80mm auto; }
                }

                body { font-family: 'Inconsolata', monospace; background: #fff; margin: 0; padding: 10px; }
                .receipt { width: 302px; background: #fff; color: #000; padding: 15px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .receipt h1, .receipt h2, .receipt p, .receipt li { margin: 0; padding: 0; }
                .header { text-align: center; margin-bottom: 10px; }
                .header h1 { font-size: 1.5rem; font-weight: 700; text-transform: uppercase; }
                .logo { display: block; max-width: 160px; max-height: 60px; margin: 0 auto 6px; }
                .order-details p { font-size: 0.9rem; line-height: 1.4; }
                .separator { border-top: 1px dashed #000; margin: 10px 0; }
                .item-section h2 { text-align: center; font-size: 1.4rem; font-weight: 700; margin-bottom: 5px; text-transform: uppercase; }
                .item-details { font-size: 1.1rem; margin-left: 5px; list-style: none; }
                .item-details li { margin-bottom: 3px; }
                .obs-section { border: 2px solid #000; padding: 10px; margin-top: 10px; }
                .obs-section h2 { text-align: center; font-size: 1.2rem; font-weight: 700; margin-bottom: 5px; text-transform: uppercase; }
                .obs-section ul { font-size: 1.1rem; font-weight: 700; list-style: none; padding-left: 0; }
            </style>
        </head>
        <body>
            <div id="print-area">${content}</div>
            <script>
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                        setTimeout(function() {
                            window.close();
                        }, 500);
                    }, 100);
                }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

/**
 * Atualiza timers dos pedidos
 */
function updateOrderTimers() {
    const productionOrders = appState.orders.filter(order => 
        order.status === 'aceito' || order.status === 'producao'
    );
    
    productionOrders.forEach(order => {
        const startTime = new Date(order.accepted_at || order.created_at);
        const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000 / 60);
        
        const timerElement = document.querySelector(`[onclick="showOrderDetail(${order.id})"] .order-timer`);
        if (timerElement) {
            timerElement.textContent = `${elapsed}min`;
            
            // Atualiza classe baseada no tempo
            timerElement.className = 'order-timer';
            if (elapsed > 45) {
                timerElement.classList.add('danger');
            } else if (elapsed > 30) {
                timerElement.classList.add('warning');
            } else {
                timerElement.classList.add('normal');
            }
        }
    });
}

// Função renderProductsGrid antiga removida - agora usa a versão do acordeão

/**
 * Renderiza grade de categorias
 */
function renderCategoriesGrid() {
    const categoriesGrid = document.getElementById('categoriesGrid');
    
    // Verificar se o elemento existe (pode não existir em todas as páginas)
    if (!categoriesGrid) {
        console.log('ℹ️ Elemento categoriesGrid não encontrado - não renderizando grid');
        return;
    }
    
    if (appState.categories.length === 0) {
        categoriesGrid.innerHTML = '<p>Nenhuma categoria cadastrada.</p>';
        return;
    }
    
    categoriesGrid.innerHTML = appState.categories.map(category => `
        <div class="category-card">
            <div class="category-info">
                <h3>${category.name}</h3>
                <p>${category.description || 'Sem descrição'}</p>
            </div>
        </div>
    `).join('');
}

/**
 * Atualiza dashboard com estatísticas
 */
function updateDashboard() {
    const _now = new Date();
    const _tzOffsetMin = _now.getTimezoneOffset();
    const _local = new Date(_now.getTime() - _tzOffsetMin * 60000);
    const today = _local.toISOString().split('T')[0];
    const todayOrders = appState.orders.filter(order => 
        order.created_at.startsWith(today)
    );
    
    const todayRevenue = todayOrders
        .filter(order => order.status === 'finalizado')
        .reduce((sum, order) => sum + parseFloat(order.total_amount), 0);
    
    const completedOrders = todayOrders.filter(order => order.status === 'finalizado');
    const avgDeliveryTime = completedOrders.length > 0 
        ? Math.round(completedOrders.reduce((sum, order) => {
            const start = new Date(order.created_at);
            const end = new Date(order.completed_at);
            return sum + (end - start) / 1000 / 60;
        }, 0) / completedOrders.length)
        : 0;
    
    document.getElementById('todayOrdersCount').textContent = todayOrders.length;
    document.getElementById('todayRevenue').textContent = formatCurrency(todayRevenue);
    document.getElementById('avgDeliveryTime').textContent = `${avgDeliveryTime} min`;
}

/**
 * Configura event listener do login (chamado na inicialização)
 */
function setupLoginEventListener() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', login);
        console.log('Event listener do login configurado');
    } else {
        console.error('Formulário de login não encontrado');
    }
}

/**
 * Configura event listeners (chamado após login)
 */
function setupEventListeners() {
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeOrderDetailModal();
            closePrintModal();
        }
        
        if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
            e.preventDefault();
            refreshOrders();
        }
    });
    
    // Listener para mensagens de pedidos atualizados via POS
    try {
        const channel = new BroadcastChannel('pos-orders');
        channel.onmessage = function(event) {
            if (event.data && event.data.type === 'posOrderUpdated') {
                // Atualiza a lista de pedidos quando um pedido é editado
                loadOrders({ suppressSound: true });
                showSuccess(`Pedido #${event.data.payload.orderNumber} atualizado com sucesso!`);
            }
        };
    } catch (_) { /* noop */ }
}

// Render inicial do botão de pausa após DOM pronto
document.addEventListener('DOMContentLoaded', () => {
    try { renderPauseButtonState(); } catch (_) {}
});

/**
 * Mostra seção específica
 */
function showSection(sectionName) {
    // Remove active de todas as seções
    document.querySelectorAll('.admin-section').forEach(section => {
        section.classList.remove('active');
    });
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Ativa seção selecionada
    const sectionId = sectionName === 'pizza' ? 'pizzaSection' : sectionName + 'Section';
    document.getElementById(sectionId).classList.add('active');
    document.querySelector(`[onclick="showSection('${sectionName}')"]`).classList.add('active');
    
    appState.currentSection = sectionName;
    
    // Carrega dados específicos da seção
    if (sectionName === 'products') {
        // Inicializar a nova seção de produtos com interface do testes/index.php
        initProductsSection();
    } else if (sectionName === 'pizza') {
        loadPizzaAdminData();
    } else if (sectionName === 'produtos-categorias') {
        // A seção de produtos e categorias é apenas informativa
        // A funcionalidade completa está na página separada
        console.log('Seção de Produtos & Categorias ativada');
    }
}

/**
 * Inicializa a seção de produtos garantindo que os dados estejam carregados
 */
async function initProductsSection() {
    try {
        const ready = await waitForAppStateData(10, 300);

        if (!ready && (appState.categories.length === 0 || appState.products.length === 0)) {
            console.warn('Dados de produtos/categorias não carregados; tentando forçar carregamento...');
            await Promise.all([loadProducts(), loadCategories()]);
        }

        if (typeof initProdutosAdmin === 'function') {
            await initProdutosAdmin();
        } else {
            console.error('Função initProdutosAdmin não encontrada');
        }
    } catch (error) {
        console.error('Erro ao inicializar seção de produtos:', error);
    }
}

// Aguarda dados de categorias e produtos ficarem disponíveis em appState
async function waitForAppStateData(maxAttempts = 10, delayMs = 300) {
    for (let i = 0; i < maxAttempts; i++) {
        const categoriesReady = Array.isArray(appState.categories) && appState.categories.length > 0;
        const productsReady = Array.isArray(appState.products) && appState.products.length > 0;
        if (categoriesReady && productsReady) {
            return true;
        }

        // Na primeira iteração, dispara carregamento em paralelo
        if (i === 0) {
            try {
                await Promise.allSettled([loadCategories(), loadProducts()]);
            } catch (_) {
                // silencioso
            }
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    return false;
}

/**
 * Atualiza informações do usuário
 */
function updateUserInfo() {
    if (appState.user) {
        document.getElementById('userName').textContent = appState.user.name;
    }
}

/**
 * Inicia atualização automática
 */
function startAutoRefresh() {
    if (appState.refreshInterval) {
        clearInterval(appState.refreshInterval);
    }
    
    appState.refreshInterval = setInterval(() => {
        // Sempre verifica pedidos para tocar som em qualquer seção
        loadOrders();
    }, CONFIG.REFRESH_INTERVAL);
}

/**
 * Para atualização automática
 */
function stopAutoRefresh() {
    if (appState.refreshInterval) {
        clearInterval(appState.refreshInterval);
        appState.refreshInterval = null;
    }
}

/**
 * Atualiza pedidos manualmente
 */
async function refreshOrders() {
    await loadOrders();
    showSuccess('Pedidos atualizados!');
}

/**
 * Toca som de notificação
 */
function playNotificationSound() {
    const audio = document.getElementById('notificationSound');
    if (audio) {
        audio.play().catch(e => console.log('Erro ao tocar som:', e));
    }
}

/**
 * Inicia o som em loop para pedidos novos
 */
function startOrderSoundLoop() {
    if (appState.orderSoundInterval) {
        clearInterval(appState.orderSoundInterval);
    }
    
    const audio = document.getElementById('notificationSound');
    
    if (audio) {
        // Configura o áudio para loop
        audio.loop = false; // Vamos controlar o loop manualmente
        audio.volume = 0.7; // Volume moderado
        
        // Função para tocar o som
        const playSound = () => {
            if (appState.hasNewOrders) {
                audio.currentTime = 0; // Reinicia o áudio
                audio.play().catch(e => console.log('Erro ao tocar som de pedido:', e));
            }
        };
        
        // Toca imediatamente
        playSound();
        
        // Configura o loop a cada 3 segundos
        appState.orderSoundInterval = setInterval(playSound, 3000);
    }
}

/**
 * Para o som em loop de pedidos novos
 */
function stopOrderSoundLoop() {
    if (appState.orderSoundInterval) {
        clearInterval(appState.orderSoundInterval);
        appState.orderSoundInterval = null;
        console.log('🔇 Som de pedidos parado');
    }
    
    // Para o áudio atual se estiver tocando
    const audio = document.getElementById('notificationSound');
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
    }
}

/**
 * Mostra/oculta modais
 */
function showLoginModal() {
    document.getElementById('loginOverlay').style.display = 'flex';
}

function hideLoginModal() {
    document.getElementById('loginOverlay').style.display = 'none';
}

function showLoading() {
    document.getElementById('loadingOverlay').classList.add('show');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('show');
}

/**
 * Funções utilitárias
 */
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function getStatusText(status) {
    const statusMap = {
        'novo': 'Novo',
        'aceito': 'Aceito',
        'producao': 'Em Produção',
        'entrega': 'Em Entrega',
        'finalizado': 'Finalizado',
        'cancelado': 'Cancelado'
    };
    return statusMap[status] || status;
}

function getPaymentMethodText(method) {
    const methodMap = {
        'dinheiro': 'Dinheiro',
        'cartao': 'Cartão',
        'pix': 'PIX'
    };
    return methodMap[method] || method;
}

function showError(message) {
    alert('Erro: ' + message);
}

function showSuccess(message) {
    alert('Sucesso: ' + message);
}

// Expõe funções globais necessárias
window.showSection = showSection;
window.logout = logout;
window.refreshOrders = refreshOrders;
window.updateOrderStatus = updateOrderStatus;
window.showOrderDetail = showOrderDetail;
window.closeOrderDetailModal = closeOrderDetailModal;
window.openCancelOrder = openCancelOrder;
window.closeCancelOrderModal = closeCancelOrderModal;
window.confirmCancelOrder = confirmCancelOrder;

// ========================================
// FUNÇÕES DE GERENCIAMENTO DE PRODUTOS
// ========================================

// Listener para mensagens vindas do iframe do POS (frontend)
window.addEventListener('message', (event) => {
    try {
        const data = event.data || {};
        if (data && data.type === 'posOrderCreated') {
            // Fecha modal e atualiza quadro de pedidos
            closeNewOrderModal();
            // Evita tocar som para o próprio pedido recém-criado
            appState.suppressOrderSoundOnce = true;
            refreshOrders();
            showSuccess('Pedido criado no balcão com sucesso!');
        }
    } catch (_) { /* noop */ }
});

// ========================================
// NOVO PEDIDO (LOCAL/RETIRADA/DELIVERY)
// ========================================

let newOrderState = {
    mode: 'local',
    items: [],
    filteredProducts: [],
    search: '',
    pizza: {
        sizeId: null,
        sizeMaxFlavors: 0,
        flavorIds: [],
        borderId: null,
        extraIds: [],
        lastPrice: null,
        lastName: null
    }
};

async function openNewOrderModal(mode = 'local') {
    newOrderState = { mode, items: [] };
    const modal = document.getElementById('newOrderModal');
    if (!modal) {
        showError('Modal de novo pedido não carregado.');
        return;
    }

    // Tenta abordagem mais robusta: abrir POS em nova aba/janela
    try {
        const posUrl = new URL('../pos.html', window.location.href);
        posUrl.searchParams.set('pos', '1');
        posUrl.searchParams.set('mode', String(mode || 'local'));
        const win = window.open(posUrl.href, 'pos_window');
        if (win && !win.closed) {
            // Assinar canal para receber confirmação do pedido criado
            try {
                if (window.__posChannel) {
                    try { window.__posChannel.close(); } catch (_) {}
                }
                const ch = new BroadcastChannel('pos-orders');
                ch.onmessage = (ev) => {
                    const data = ev && ev.data;
                    if (data && data.type === 'posOrderCreated') {
                        appState.suppressOrderSoundOnce = true;
                        refreshOrders();
                        showSuccess('Pedido criado no balcão com sucesso!');
                    }
                };
                window.__posChannel = ch;
            } catch (_) { /* BroadcastChannel indisponível, seguirá fallback via postMessage */ }
            return; // Não abre o modal/iframe quando conseguiu abrir nova aba
        }
    } catch (_) { /* continua para fallback */ }

    // Fallback: POS via iframe dentro do modal
    const posIframe = document.getElementById('posIframe');
    if (posIframe) {
        try {
            // Monta URL absoluta do frontend (mais robusto que caminho relativo)
            // Preferir página POS dedicada para contexto de balcão
            const indexUrl = new URL('../pos.html', window.location.href);
            indexUrl.searchParams.set('pos', '1');
            indexUrl.searchParams.set('mode', String(mode || 'local'));
            posIframe.src = indexUrl.href;
        } catch (e) {
            console.warn('Falha ao configurar POS iframe:', e);
        }
        modal.classList.add('show');
        return; // Evita executar o fluxo antigo baseado em campos internos
    }

    // Campos
    const modeSelect = document.getElementById('orderModeSelect');
    const paymentMethod = document.getElementById('paymentMethod');
    const paymentValueGroup = document.getElementById('paymentValueGroup');
    const paymentValue = document.getElementById('paymentValue');
    const deliveryFields = document.getElementById('deliveryFields');
    const deliveryFee = document.getElementById('deliveryFee');
    const itemsList = document.getElementById('newOrderItemsList');
    const productsContainer = document.getElementById('newOrderProductsContainer');
    const searchInput = document.getElementById('newOrderSearch');
    const pizzaTabBtn = document.getElementById('newOrderTabPizza');
    const productsTabBtn = document.getElementById('newOrderTabProducts');
    const pizzaTab = document.getElementById('newOrderPizzaTab');
    const productsTab = document.getElementById('newOrderProductsTab');
    const totalEl = document.getElementById('newOrderTotal');

    // Reset
    if (modeSelect) modeSelect.value = mode;
    if (paymentMethod) paymentMethod.value = 'dinheiro';
    if (paymentValue) paymentValue.value = '';
    if (itemsList) itemsList.innerHTML = '';
    if (totalEl) totalEl.textContent = 'Total: R$ 0,00';
    if (deliveryFee) deliveryFee.value = mode === 'delivery' ? '0.00' : '0.00';

    // Popular vitrine amigável
    if (productsContainer) {
        newOrderState.search = '';
        if (searchInput) searchInput.value = '';
        newOrderState.filteredProducts = [...(appState.products || [])];
        renderNewOrderProducts();
    }

    // Preparar Pizza Builder (carregar dados)
    resetPizzaBuilderState();
    await ensurePizzaBuilderDataLoaded();
    renderPizzaBuilder();

    // Handlers
    if (paymentMethod) {
        paymentMethod.onchange = () => {
            if (paymentMethod.value === 'dinheiro') {
                paymentValueGroup.style.display = '';
            } else {
                paymentValueGroup.style.display = 'none';
                if (paymentValue) paymentValue.value = '';
            }
        };
        paymentMethod.onchange();
    }

    handleOrderModeChange(mode);

    modal.classList.add('show');
}

function closeNewOrderModal() {
    const modal = document.getElementById('newOrderModal');
    if (modal) {
        modal.classList.remove('show');
        const posIframe = document.getElementById('posIframe');
        if (posIframe) {
            // Limpa o src para liberar recursos
            posIframe.src = '';
        }
    }
}

function handleOrderModeChange(mode) {
    newOrderState.mode = mode;
    const deliveryFields = document.getElementById('deliveryFields');
    if (deliveryFields) deliveryFields.style.display = (mode === 'delivery') ? '' : 'none';
    recalcNewOrderTotal();
}

function addItemToNewOrder(productId) {
    const product = (appState.products || []).find(p => Number(p.id) === Number(productId));
    if (!product) return;
    const existingIndex = newOrderState.items.findIndex(it => Number(it.product_id) === Number(product.id));
    if (existingIndex >= 0) {
        newOrderState.items[existingIndex].quantity = Number(newOrderState.items[existingIndex].quantity || 1) + 1;
    } else {
        newOrderState.items.push({
            product_id: product.id,
            product_name: product.name,
            product_price: Number(product.price || 0),
            quantity: 1,
            notes: ''
        });
    }
    renderNewOrderItems();
}

function removeItemFromNewOrder(index) {
    if (index < 0 || index >= newOrderState.items.length) return;
    newOrderState.items.splice(index, 1);
    renderNewOrderItems();
}

function renderNewOrderItems() {
    const itemsList = document.getElementById('newOrderItemsList');
    if (!itemsList) return;
    if (!newOrderState.items.length) {
        itemsList.innerHTML = '<div class="empty-state"><i class="fas fa-box-open"></i><p>Nenhum item adicionado</p></div>';
        recalcNewOrderTotal();
        return;
    }
    itemsList.innerHTML = `
        <div class="list-row" style="font-weight:600; background:#f8f9fa;">
            <div class="list-col">Produto</div>
            <div class="list-col">Qtd</div>
            <div class="list-col">Unitário</div>
            <div class="list-col">Subtotal</div>
            <div class="list-col">Ações</div>
        </div>
    ` + newOrderState.items.map((it, idx) => {
        const subtotal = (Number(it.product_price || 0) * Number(it.quantity || 1));
        return `
            <div class="list-row">
                <div class="list-col">
                    <div class="item-info">
                        <strong>${it.quantity}x ${it.product_name}</strong>
                        ${it.notes ? `<small>${it.notes}</small>` : ''}
                    </div>
                </div>
                <div class="list-col">
                    <div class="qty-control">
                        <button type="button" class="action-btn" onclick="decrementItemQty(${idx})"><i class="fas fa-minus"></i></button>
                        <input type="number" min="1" value="${Number(it.quantity || 1)}" onchange="changeItemQty(${idx}, this.value)" style="width:64px; text-align:center;" />
                        <button type="button" class="action-btn" onclick="incrementItemQty(${idx})"><i class="fas fa-plus"></i></button>
                    </div>
                </div>
                <div class="list-col"><span class="price-display">${formatCurrency(Number(it.product_price || 0))}</span></div>
                <div class="list-col"><span class="price-display">${formatCurrency(subtotal)}</span></div>
                <div class="list-col list-actions">
                    <button class="action-btn delete" title="Remover" onclick="removeItemFromNewOrder(${idx})"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;
    }).join('');
    recalcNewOrderTotal();
}

function recalcNewOrderTotal() {
    const totalEl = document.getElementById('newOrderTotal');
    const deliveryFeeInput = document.getElementById('deliveryFee');
    const deliveryFee = (newOrderState.mode === 'delivery') ? Number(deliveryFeeInput?.value || 0) : 0;
    const subtotal = newOrderState.items.reduce((sum, it) => sum + Number(it.product_price || 0) * Number(it.quantity || 1), 0);
    const total = subtotal + deliveryFee;
    if (totalEl) totalEl.textContent = `Total: ${formatCurrency(total)}`;
}

function renderNewOrderProducts() {
    const container = document.getElementById('newOrderProductsContainer');
    if (!container) return;
    const products = newOrderState.filteredProducts || [];
    if (!products.length) {
        container.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><i class="fas fa-search"></i><p>Nenhum produto encontrado</p></div>';
        return;
    }
    // Agrupa por categoria
    const byCategory = products.reduce((acc, p) => {
        const key = p.category_name || 'Outros';
        acc[key] = acc[key] || [];
        acc[key].push(p);
        return acc;
    }, {});
    container.innerHTML = Object.entries(byCategory).map(([cat, prods]) => `
        <div class="accordion-item">
            <h2 class="accordion-header">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#newOrder-cat-${cat.replace(/\s+/g,'-')}">
                    <div class="category-title"><i class="fas fa-tag"></i><span>${cat}</span><span class="category-count">${prods.length} itens</span></div>
                </button>
            </h2>
            <div id="newOrder-cat-${cat.replace(/\s+/g,'-')}" class="accordion-collapse collapse">
                <div class="accordion-body">
                    <div class="products-grid">
                        ${prods.map(p => `
                            <div class="product-card">
                                <div class="product-info">
                                    <div class="product-header">
                                        <h4 class="product-name">${p.name}</h4>
                                        <div class="product-price">${formatCurrency(Number(p.price || 0))}</div>
                                    </div>
                                    <div class="product-actions">
                                        <button class="product-btn edit" title="Adicionar" onclick="addItemToNewOrder(${p.id})"><i class="fas fa-plus"></i></button>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function filterNewOrderProducts() {
    const term = (document.getElementById('newOrderSearch')?.value || '').toLowerCase();
    newOrderState.search = term;
    const base = Array.isArray(appState.products) ? appState.products : [];
    newOrderState.filteredProducts = !term ? [...base] : base.filter(p => `${p.name} ${p.category_name || ''}`.toLowerCase().includes(term));
    renderNewOrderProducts();
}

function changeItemQty(index, value) {
    const qty = Math.max(1, Number(value || 1));
    if (!newOrderState.items[index]) return;
    newOrderState.items[index].quantity = qty;
    renderNewOrderItems();
}

function incrementItemQty(index) {
    if (!newOrderState.items[index]) return;
    newOrderState.items[index].quantity = Number(newOrderState.items[index].quantity || 1) + 1;
    renderNewOrderItems();
}

function decrementItemQty(index) {
    if (!newOrderState.items[index]) return;
    const newQty = Number(newOrderState.items[index].quantity || 1) - 1;
    newOrderState.items[index].quantity = Math.max(1, newQty);
    renderNewOrderItems();
}

// =============================
// PIZZA BUILDER - ADMIN BALCÃO
// =============================

function showNewOrderTab(which) {
    const tabs = {
        products: document.getElementById('newOrderProductsTab'),
        pizza: document.getElementById('newOrderPizzaTab')
    };
    const btns = {
        products: document.getElementById('newOrderTabProducts'),
        pizza: document.getElementById('newOrderTabPizza')
    };
    Object.values(tabs).forEach(el => el && el.classList.remove('active'));
    Object.values(btns).forEach(el => el && el.classList.remove('active'));
    tabs[which]?.classList.add('active');
    btns[which]?.classList.add('active');
}

function resetPizzaBuilderState() {
    newOrderState.pizza = {
        sizeId: null,
        sizeMaxFlavors: 0,
        flavorIds: [],
        borderId: null,
        extraIds: [],
        lastPrice: null,
        lastName: null
    };
}

async function ensurePizzaBuilderDataLoaded() {
    // carrega via API pizza/ endpoints
    try {
        const [sizesRes, flavorsRes, bordersRes, extrasRes] = await Promise.all([
            fetch(CONFIG.API_BASE_URL + 'pizza/sizes'),
            fetch(CONFIG.API_BASE_URL + 'pizza/flavors'),
            fetch(CONFIG.API_BASE_URL + 'pizza/borders'),
            fetch(CONFIG.API_BASE_URL + 'pizza/extras')
        ]);
        const [sizes, flavors, borders, extras] = await Promise.all([
            sizesRes.json(), flavorsRes.json(), bordersRes.json(), extrasRes.json()
        ]);
        newOrderState.pizzaData = {
            sizes: (sizes.success ? sizes.data : []),
            flavors: (flavors.success ? flavors.data : []),
            borders: (borders.success ? borders.data : []),
            extras: (extras.success ? extras.data : [])
        };
    } catch (e) {
        console.error('Erro ao carregar dados do Pizza Builder', e);
        newOrderState.pizzaData = { sizes: [], flavors: [], borders: [], extras: [] };
    }
}

function renderPizzaBuilder(filterFlavorCategory = '') {
    const sizesWrap = document.getElementById('pbSizes');
    const flavorsWrap = document.getElementById('pbFlavors');
    const bordersWrap = document.getElementById('pbBorders');
    const extrasWrap = document.getElementById('pbExtras');
    const data = newOrderState.pizzaData || { sizes: [], flavors: [], borders: [], extras: [] };
    if (sizesWrap) {
        sizesWrap.innerHTML = (data.sizes || []).map(s => `
            <label class="checkbox-label">
              <input type="radio" name="pbSize" value="${s.id}" onchange="pbSelectSize(${s.id}, ${s.max_flavors})" ${Number(newOrderState.pizza.sizeId)===Number(s.id)?'checked':''} />
              <span class="checkmark"></span>
              <div class="size-info">
                <strong>${s.name}</strong>
                <small>${s.slices} fatias • até ${s.max_flavors} sabores</small>
                <span class="price">${formatCurrency(Number(s.price||0))}</span>
              </div>
            </label>
        `).join('');
    }
    if (flavorsWrap) {
        const list = (data.flavors || []).filter(f => !filterFlavorCategory || f.category === filterFlavorCategory);
        flavorsWrap.innerHTML = list.map(f => `
            <label class="checkbox-label">
              <input type="checkbox" value="${f.id}" onchange="pbToggleFlavor(${f.id})" ${newOrderState.pizza.flavorIds.includes(f.id)?'checked':''} />
              <span class="checkmark"></span>
              <div class="size-info">
                <strong>${f.name}</strong>
                <small>${f.category}</small>
              </div>
            </label>
        `).join('');
    }
    if (bordersWrap) {
        bordersWrap.innerHTML = (data.borders || []).map(b => `
            <label class="checkbox-label">
              <input type="radio" name="pbBorder" value="${b.id}" onchange="pbSelectBorder(${b.id})" ${Number(newOrderState.pizza.borderId)===Number(b.id)?'checked':''} />
              <span class="checkmark"></span>
              <div class="size-info">
                <strong>${b.name}</strong>
                <span class="price">+ ${formatCurrency(Number(b.additional_price||0))}</span>
              </div>
            </label>
        `).join('');
    }
    if (extrasWrap) {
        extrasWrap.innerHTML = (data.extras || []).map(ex => `
            <label class="checkbox-label">
              <input type="checkbox" value="${ex.id}" onchange="pbToggleExtra(${ex.id})" ${newOrderState.pizza.extraIds.includes(ex.id)?'checked':''} />
              <span class="checkmark"></span>
              <div class="size-info">
                <strong>${ex.name}</strong>
                <span class="price">+ ${formatCurrency(Number(ex.price||0))}</span>
              </div>
            </label>
        `).join('');
    }
    updatePizzaBuilderPrice();
}

function pbFilterFlavors(cat) {
    renderPizzaBuilder(cat);
}

function pbSelectSize(sizeId, maxFlavors) {
    newOrderState.pizza.sizeId = Number(sizeId);
    newOrderState.pizza.sizeMaxFlavors = Number(maxFlavors || 0);
    if (newOrderState.pizza.flavorIds.length > newOrderState.pizza.sizeMaxFlavors) {
        newOrderState.pizza.flavorIds = newOrderState.pizza.flavorIds.slice(0, newOrderState.pizza.sizeMaxFlavors);
    }
    updatePizzaBuilderPrice();
}

function pbToggleFlavor(flavorId) {
    flavorId = Number(flavorId);
    const idx = newOrderState.pizza.flavorIds.indexOf(flavorId);
    if (idx >= 0) {
        newOrderState.pizza.flavorIds.splice(idx, 1);
    } else {
        if (newOrderState.pizza.sizeMaxFlavors && newOrderState.pizza.flavorIds.length >= newOrderState.pizza.sizeMaxFlavors) {
            showError(`Este tamanho permite no máximo ${newOrderState.pizza.sizeMaxFlavors} sabores.`);
            return;
        }
        newOrderState.pizza.flavorIds.push(flavorId);
    }
    updatePizzaBuilderPrice();
}

function pbSelectBorder(borderId) {
    newOrderState.pizza.borderId = Number(borderId);
    updatePizzaBuilderPrice();
}

function pbToggleExtra(extraId) {
    extraId = Number(extraId);
    const idx = newOrderState.pizza.extraIds.indexOf(extraId);
    if (idx >= 0) {
        newOrderState.pizza.extraIds.splice(idx, 1);
    } else {
        newOrderState.pizza.extraIds.push(extraId);
    }
    updatePizzaBuilderPrice();
}

async function updatePizzaBuilderPrice() {
    const pz = newOrderState.pizza;
    const summaryEl = document.getElementById('pbSummary');
    if (!pz.sizeId || !pz.flavorIds.length) {
        if (summaryEl) summaryEl.textContent = 'Selecione tamanho e sabores para calcular o preço.';
        return;
    }
    try {
        const response = await fetch(CONFIG.API_BASE_URL + 'pizza/calculate-price', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                size_id: pz.sizeId,
                flavor_ids: pz.flavorIds,
                border_id: pz.borderId,
                extra_ids: pz.extraIds
            })
        });
        const data = await response.json();
        if (response.ok && data && data.success) {
            const d = data.data;
            pz.lastPrice = Number(d.pricing?.total_price || 0);
            const sizeName = d.summary?.size_name || '';
            const flavorsName = (d.summary?.flavor_names || []).join(', ');
            pz.lastName = `Pizza ${sizeName}${flavorsName ? ' - ' + flavorsName : ''}`;
            if (summaryEl) summaryEl.innerHTML = `
                <strong>${pz.lastName}</strong><br/>
                Total: <strong>${formatCurrency(pz.lastPrice)}</strong>
            `;
        } else {
            if (summaryEl) summaryEl.textContent = data?.message || 'Erro ao calcular';
        }
    } catch (e) {
        if (summaryEl) summaryEl.textContent = 'Erro ao calcular o preço.';
    }
}

function addBuiltPizzaToOrder() {
    const pz = newOrderState.pizza;
    if (!pz.sizeId || !pz.flavorIds.length || pz.lastPrice === null) {
        showError('Selecione tamanho e sabores para adicionar.');
        return;
    }
    // Adiciona como item único com nome/price calculado
    newOrderState.items.push({
        product_id: 0,
        product_name: pz.lastName || 'Pizza',
        product_price: Number(pz.lastPrice || 0),
        quantity: 1,
        notes: '',
        pizzaConfig: {
            sizeId: pz.sizeId,
            flavorIds: [...pz.flavorIds],
            borderId: pz.borderId,
            extraIds: [...pz.extraIds]
        }
    });
    renderNewOrderItems();
    showNewOrderTab('products');
}

async function submitNewOrder() {
    try {
        if (!newOrderState.items.length) {
            showError('Adicione pelo menos um item.');
            return;
        }

        // Campos do formulário
        const mode = newOrderState.mode;
        const customerName = (document.getElementById('customerName')?.value || '').trim();
        const customerPhone = (document.getElementById('customerPhone')?.value || '').trim();
        const customerAddress = (document.getElementById('customerAddress')?.value || '').trim();
        const customerNeighborhood = (document.getElementById('customerNeighborhood')?.value || '').trim();
        const customerReference = (document.getElementById('customerReference')?.value || '').trim();
        const deliveryFeeVal = (mode === 'delivery') ? Number(document.getElementById('deliveryFee')?.value || 0) : 0;
        const paymentMethod = (document.getElementById('paymentMethod')?.value || 'dinheiro');
        const paymentValueRaw = document.getElementById('paymentValue')?.value;
        const paymentValue = paymentMethod === 'dinheiro' && paymentValueRaw ? Number(paymentValueRaw) : null;
        const notes = (document.getElementById('orderNotes')?.value || '').trim();

        // Validações mínimas
        if (mode === 'delivery') {
            if (!customerName || !customerPhone || !customerAddress) {
                showError('Para delivery, preencha Nome, Telefone e Endereço.');
                return;
            }
        }

        // Backend exige campos mesmo para local/retirada: usar placeholders seguros
        const safeName = customerName || (mode === 'local' ? 'Mesa' : 'Cliente')
        const safePhone = customerPhone || '00000000000';
        const safeAddress = (mode === 'delivery') ? customerAddress : '-';

        const subtotal = newOrderState.items.reduce((sum, it) => sum + Number(it.product_price || 0) * Number(it.quantity || 1), 0);

        // Se houver pizzas montadas, criar produtos antes e atualizar itens
        for (let i = 0; i < newOrderState.items.length; i++) {
            const it = newOrderState.items[i];
            if (it && it.pizzaConfig && (!it.product_id || Number(it.product_id) === 0)) {
                try {
                    const resp = await fetch(CONFIG.API_BASE_URL + 'pizza/create', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                            size_id: it.pizzaConfig.sizeId,
                            flavor_ids: it.pizzaConfig.flavorIds,
                            border_id: it.pizzaConfig.borderId,
                            extra_ids: it.pizzaConfig.extraIds,
                            category_id: 2
                        })
                    });
                    const respData = await resp.json();
                    if (resp.ok && respData && respData.success && respData.data) {
                        it.product_id = respData.data.product_id;
                        it.product_name = respData.data.name || it.product_name;
                        it.product_price = Number(respData.data.price || it.product_price);
                    } else {
                        throw new Error(respData?.message || 'Falha ao criar pizza');
                    }
                } catch (e) {
                    showError(e.message || 'Erro ao criar pizza para o pedido');
                    return;
                }
            }
        }

        const payload = {
            customer_name: safeName,
            customer_phone: safePhone,
            customer_address: safeAddress,
            customer_neighborhood: customerNeighborhood,
            customer_reference: customerReference,
            payment_method: paymentMethod,
            payment_value: paymentValue,
            subtotal: subtotal,
            delivery_fee: deliveryFeeVal,
            notes: notes,
            estimated_delivery_time: 30,
            items: newOrderState.items.map(it => ({
                product_id: it.product_id,
                product_name: it.product_name,
                product_price: Number(it.product_price || 0),
                quantity: Number(it.quantity || 1),
                notes: it.notes || ''
            }))
        };

        showLoading();
        const response = await fetch(CONFIG.API_BASE_URL + 'orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok || !data || !data.success) {
            throw new Error(data?.message || 'Erro ao criar pedido');
        }

        closeNewOrderModal();
        await loadOrders({ suppressSound: true });
        showSuccess('Pedido criado com sucesso.');
    } catch (err) {
        console.error(err);
        showError(err.message || 'Erro ao criar pedido');
    } finally {
        hideLoading();
    }
}

// Expor globais
window.openNewOrderModal = openNewOrderModal;
window.closeNewOrderModal = closeNewOrderModal;
window.handleOrderModeChange = handleOrderModeChange;
window.addItemToNewOrder = addItemToNewOrder;
window.removeItemFromNewOrder = removeItemFromNewOrder;
window.filterNewOrderProducts = filterNewOrderProducts;
window.changeItemQty = changeItemQty;
window.incrementItemQty = incrementItemQty;
window.decrementItemQty = decrementItemQty;
window.submitNewOrder = submitNewOrder;
window.showNewOrderTab = showNewOrderTab;
window.pbFilterFlavors = pbFilterFlavors;
window.pbSelectSize = pbSelectSize;
window.pbToggleFlavor = pbToggleFlavor;
window.pbSelectBorder = pbSelectBorder;
window.pbToggleExtra = pbToggleExtra;
window.addBuiltPizzaToOrder = addBuiltPizzaToOrder;

// Estado dos produtos
let productsState = {
    products: [],
    categories: [],
    currentProduct: null,
    editingProduct: null
};

/**
 * Carrega produtos para a seção de gerenciamento
 */
async function loadProductsForManagement() {
    try {
        showLoading();
        console.log('🔄 Carregando produtos...');
        
        const url = CONFIG.API_BASE_URL + 'products';
        console.log('URL:', url);
        
        const response = await fetch(url);
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Response data:', data);
        
        if (data.success) {
            productsState.products = data.data;
            console.log('✅ Produtos carregados para gerenciamento:', data.data.length);
            console.log('📦 Primeiros produtos:', data.data.slice(0, 3));
            await renderProductsGrid();
            populateCategoryFilter();
            updateFilterCount();
        } else {
            throw new Error(data.message || 'Erro desconhecido');
        }
    } catch (error) {
        console.error('❌ Erro ao carregar produtos:', error);
        showError('Erro ao carregar produtos: ' + error.message);
    } finally {
        hideLoading();
    }
}

/**
 * Renderiza a grade de produtos organizados por categoria
 */
async function renderProductsGrid() {
    console.log('🎨 [NOVO] Renderizando grade de produtos com acordeão...');
    const grid = document.getElementById('productsGrid');
    if (!grid) {
        console.error('❌ Elemento productsGrid não encontrado');
        return;
    }
    
    console.log('📊 Estado atual:', {
        productsState: productsState.products?.length || 0,
        appState: appState.categories?.length || 0
    });
    
    const filteredProducts = filterProducts();
    console.log('📦 Produtos filtrados:', filteredProducts.length);
    
    if (!filteredProducts || filteredProducts.length === 0) {
        console.warn('⚠️ Nenhum produto filtrado para exibir');
    }
    
    if (filteredProducts.length === 0) {
        grid.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #666; grid-column: 1 / -1;">
                <i class="fas fa-box-open" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                <h3>Nenhum produto encontrado</h3>
                <p>Não há produtos que correspondam aos filtros selecionados.</p>
            </div>
        `;
        return;
    }
    
    // Garantir que as categorias estão carregadas
    if (!appState.categories || appState.categories.length === 0) {
        console.warn('⚠️ Categorias não carregadas, tentando carregar...');
        await loadCategories();
    }
    
    // Agrupar produtos por categoria
    const productsByCategory = groupProductsByCategory(filteredProducts);
    console.log('🗂️ Produtos por categoria:', productsByCategory);
    
    if (Object.keys(productsByCategory).length === 0) {
        console.warn('⚠️ Nenhuma categoria gerada');
        grid.innerHTML = '<div style="padding: 2rem; text-align: center;">Nenhum produto encontrado ou erro no agrupamento.</div>';
        return;
    }
    
    // Renderizar produtos organizados por categoria (estilo acordeão Bootstrap)
    grid.innerHTML = `
        <div class="accordion" id="productsAccordion">
            ${Object.entries(productsByCategory).map(([categoryName, products]) => {
                const slug = categoryName.replace(/\s+/g, '-').toLowerCase();
                const cat = appState.categories.find(c => c.name === categoryName);
                
                return `
                <div class="accordion-item" data-category-id="${cat?.id || ''}" id="category-${slug}">
                    <h2 class="accordion-header" id="heading-${slug}">
                        <div class="category-header-content">
                            <span class="category-drag-handle" title="Arraste para reordenar" onmousedown="startCategoryDrag(event, '${slug}')">
                                <i class="fas fa-grip-vertical"></i>
                            </span>
                            <button class="accordion-button collapsed" 
                                    type="button" 
                                    data-bs-toggle="collapse" 
                                    data-bs-target="#collapse-${slug}" 
                                    aria-expanded="false" 
                                    aria-controls="collapse-${slug}"
                                    data-bs-parent="#productsAccordion">
                                <div class="category-title">
                                    <i class="fas fa-tag"></i>
                                    <span>${categoryName}</span>
                                    <span class="category-count">${products.length} ${products.length === 1 ? 'produto' : 'produtos'}</span>
                                </div>
                            </button>
                            ${cat ? `
                            <div class="category-header-actions" onclick="event.stopPropagation()">
                                <button class="category-action-btn" title="Editar categoria" onclick="editCategoryFromHeader(${cat.id}, event)">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="category-action-btn" title="Excluir categoria" onclick="deleteCategory(${cat.id}); event.stopPropagation();">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>` : ''}
                        </div>
                    </h2>
                    <div id="collapse-${slug}" class="accordion-collapse collapse" 
                         aria-labelledby="heading-${slug}" 
                         data-bs-parent="#productsAccordion">
                        <div class="accordion-body">
                            <div class="products-grid">
                                ${products.map(product => createProductCard(product)).join('')}
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('')}
        </div>
    `;
    
    // Restaurar estados das categorias colapsadas
    setTimeout(() => restoreCategoryStates(), 100);
}

// Drag and Drop no acordeão de categorias
function startCategoryDrag(e, catSlug) {
    e.stopPropagation();
    const section = document.getElementById(`category-${catSlug}`);
    if (!section) return;
    const container = section.parentElement; // accordion container
    section.classList.add('dragging');

    const onMouseMove = (ev) => {
        ev.preventDefault();
        const after = getAfterAccordionItem(container, ev.clientY);
        if (!after) {
            container.appendChild(section);
        } else {
            container.insertBefore(section, after);
        }
    };

    const onMouseUp = async () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        section.classList.remove('dragging');
        await persistAccordionCategoryOrder();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

function getAfterAccordionItem(container, y) {
    const items = [...container.querySelectorAll('.accordion-item:not(.dragging)')];
    let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
    for (const item of items) {
        const rect = item.getBoundingClientRect();
        const offset = y - (rect.top + rect.height / 2);
        if (offset < 0 && offset > closest.offset) {
            closest = { offset, element: item };
        }
    }
    return closest.element;
}

async function persistAccordionCategoryOrder() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    const accordion = grid.querySelector('#productsAccordion');
    if (!accordion) return;
    
    const sections = [...accordion.querySelectorAll('.accordion-item')];
    const orderedNames = sections.map(sec => {
        const titleElement = sec.querySelector('.category-title span');
        return titleElement ? titleElement.textContent.trim() : null;
    }).filter(Boolean);
    
    const orderedIds = orderedNames.map(n => (appState.categories.find(c => c.name === n) || {}).id).filter(Boolean);
    if (!orderedIds.length) return;

    try {
        showLoading();
        for (let i = 0; i < orderedIds.length; i++) {
            const id = orderedIds[i];
            const original = appState.categories.find(c => c.id === id);
            if (!original) continue;
            const payload = {
                name: original.name,
                description: original.description || '',
                image_url: original.image_url || null,
                display_order: i,
                active: original.active ? 1 : 0
            };
            await fetch(CONFIG.API_BASE_URL + `categories/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }
        await loadCategories();
        await loadProductsForManagement();
        showSuccess('Ordem das categorias atualizada');
    } catch (e) {
        console.error(e);
        showError('Falha ao salvar nova ordem das categorias');
    } finally {
        hideLoading();
    }
}

/**
 * Agrupa produtos por categoria
 */
function groupProductsByCategory(products) {
    const grouped = {};
    
    products.forEach(product => {
        const categoryName = product.category_name || 'Sem categoria';
        if (!grouped[categoryName]) {
            grouped[categoryName] = [];
        }
        grouped[categoryName].push(product);
    });
    
    // Ordenar produtos dentro de cada categoria por nome
    Object.keys(grouped).forEach(category => {
        grouped[category].sort((a, b) => a.name.localeCompare(b.name));
    });
    
    // Ordenar categorias alfabeticamente, mas manter "Sem categoria" por último
    const sortedGrouped = {};
    const sortedCategories = Object.keys(grouped).sort((a, b) => {
        if (a === 'Sem categoria') return 1;
        if (b === 'Sem categoria') return -1;
        return a.localeCompare(b);
    });
    
    sortedCategories.forEach(category => {
        sortedGrouped[category] = grouped[category];
    });
    
    return sortedGrouped;
}

/**
 * Cria o HTML de um card de produto
 */
function createProductCard(product) {
    // Verificar se deve exibir o preço:
    // category_value é OPCIONAL - se definido (> 0), funciona como controle de exibição
    // se não definido (0 ou null), exibe preço normalmente
    const hasCategoryValue = product.category_value && parseFloat(product.category_value) > 0;
    const hasPrice = product.price && parseFloat(product.price) > 0;
    const showPrice = hasPrice; // Sempre exibe se tiver preço (category_value é opcional)
    
    return `
        <div class="product-card ${product.active ? '' : 'paused'}">
            <div class="product-image">
                ${product.image_url ? 
                    `<img src="${product.image_url}" alt="${product.name}" onerror="this.parentElement.innerHTML='<div class=\\'no-image\\'><i class=\\'fas fa-image\\'></i></div>'">` :
                    `<div class="no-image"><i class="fas fa-image"></i></div>`
                }
                <div class="product-status ${product.active ? 'active' : 'paused'}">
                    ${product.active ? 'Ativo' : 'Pausado'}
                </div>
            </div>
            <div class="product-info">
                <div class="product-header">
                    <h3 class="product-name">${product.name}</h3>
                    ${showPrice ? `<div class="product-price">${formatCurrency(product.price)}</div>` : ''}
                </div>
                <div class="product-category">
                    <i class="fas fa-tag"></i> ${product.category_name || 'Sem categoria'}
                </div>
                ${product.description ? `<div class="product-description">${product.description}</div>` : ''}
                
                <div class="product-features">
                    ${product.is_vegetarian ? '<span class="feature-badge vegetarian">Vegetariano</span>' : ''}
                    ${product.is_vegan ? '<span class="feature-badge vegan">Vegano</span>' : ''}
                    ${product.is_gluten_free ? '<span class="feature-badge gluten-free">Sem Glúten</span>' : ''}
                    ${product.is_spicy ? '<span class="feature-badge spicy">Picante</span>' : ''}
                </div>
                
                <div class="product-actions">
                    <button class="product-btn edit" onclick="editProduct(${product.id})" title="Editar produto">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="product-btn toggle ${product.active ? 'active' : ''}" onclick="toggleProductStatus(${product.id})" title="${product.active ? 'Pausar' : 'Ativar'} produto">
                        <i class="fas fa-${product.active ? 'pause' : 'play'}"></i>
                    </button>
                    <button class="product-btn delete" onclick="deleteProduct(${product.id}, '${product.name}')" title="Excluir produto">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Alterna entre expandir/colapsar categoria
 */
function toggleCategory(categoryId) {
    // Esta função não é mais necessária com o Bootstrap accordion
    // O Bootstrap gerencia automaticamente o estado expandido/colapsado
    console.log('toggleCategory chamada para:', categoryId);
}

/**
 * Restaura estado das categorias colapsadas
 */
function restoreCategoryStates() {
    // Esta função não é mais necessária com o Bootstrap accordion
    // O Bootstrap gerencia automaticamente o estado expandido/colapsado
    console.log('restoreCategoryStates: não é mais necessária com Bootstrap accordion');
}

/**
 * Filtra produtos baseado nos filtros selecionados
 */
function filterProducts() {
    console.log('🔍 Filtrando produtos...');
    console.log('Produtos disponíveis:', productsState.products.length);
    
    let filtered = productsState.products;
    
    const searchFilter = document.getElementById('searchFilter')?.value?.toLowerCase() || '';
    const categoryFilter = document.getElementById('categoryFilter')?.value || '';
    const statusFilter = document.getElementById('statusFilter')?.value || '';
    const priceFilter = document.getElementById('priceFilter')?.value || '';
    
    console.log('Filtros - Busca:', searchFilter, 'Categoria:', categoryFilter, 'Status:', statusFilter, 'Preço:', priceFilter);
    
    // Filtro por busca (nome)
    if (searchFilter) {
        filtered = filtered.filter(product => 
            product.name.toLowerCase().includes(searchFilter) ||
            (product.description && product.description.toLowerCase().includes(searchFilter))
        );
        console.log('Após filtro de busca:', filtered.length);
    }
    
    // Filtro por categoria
    if (categoryFilter) {
        filtered = filtered.filter(product => product.category_id == categoryFilter);
        console.log('Após filtro de categoria:', filtered.length);
    }
    
    // Filtro por status
    if (statusFilter !== '') {
        filtered = filtered.filter(product => product.active == statusFilter);
        console.log('Após filtro de status:', filtered.length);
    }
    
    // Filtro por preço
    if (priceFilter) {
        filtered = filtered.filter(product => {
            const price = parseFloat(product.price);
            switch (priceFilter) {
                case '0-10':
                    return price <= 10;
                case '10-20':
                    return price > 10 && price <= 20;
                case '20-50':
                    return price > 20 && price <= 50;
                case '50+':
                    return price > 50;
                default:
                    return true;
            }
        });
        console.log('Após filtro de preço:', filtered.length);
    }
    
    console.log('Produtos filtrados finais:', filtered.length);
    return filtered;
}

/**
 * Popula o filtro de categorias
 */
function populateCategoryFilter() {
    console.log('🏷️ Populando filtro de categorias...');
    const select = document.getElementById('categoryFilter');
    if (!select) {
        console.error('❌ Elemento categoryFilter não encontrado');
        return;
    }
    
    const categories = productsState.categories;
    console.log('Categorias disponíveis:', categories.length);
    
    select.innerHTML = '<option value="">Todas as categorias</option>' +
        categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
    
    console.log('✅ Filtro de categorias populado');
}

/**
 * Aplica filtros aos produtos
 */
function applyFilters() {
    console.log('🔍 Aplicando filtros...');
    renderProductsGrid();
    updateFilterCount();
}

/**
 * Limpa todos os filtros
 */
function clearFilters() {
    document.getElementById('searchFilter').value = '';
    document.getElementById('categoryFilter').value = '';
    document.getElementById('statusFilter').value = '';
    document.getElementById('priceFilter').value = '';
    applyFilters();
}

/**
 * Atualiza o contador de produtos filtrados
 */
function updateFilterCount() {
    const totalProducts = productsState.products.length;
    const filteredProducts = filterProducts();
    const filterCount = document.getElementById('filterCount');
    
    if (filterCount) {
        if (filteredProducts.length === totalProducts) {
            filterCount.textContent = `Mostrando todos os ${totalProducts} produtos`;
        } else {
            filterCount.textContent = `Mostrando ${filteredProducts.length} de ${totalProducts} produtos`;
        }
    }
}

/**
 * Mostra modal para adicionar produto
 */
async function showAddProductModal() {
    // Verificar se productsState existe
    if (typeof productsState === 'undefined') {
        showError('Erro: Estado dos produtos não inicializado. Tente novamente.');
        return;
    }
    
    productsState.editingProduct = null;
    document.getElementById('productModalTitle').innerHTML = '<i class="fas fa-plus"></i> Novo Produto';
    document.getElementById('productForm').reset();
    document.getElementById('productActive').checked = true;
    
    // Limpar pré-visualização da imagem
    const imagePreview = document.getElementById('imagePreview');
    const preview = document.getElementById('preview');
    if (imagePreview && preview) {
        imagePreview.style.display = 'none';
        preview.src = '#';
    }
    
    // Limpa checkboxes de características
    document.getElementById('productVegetarian').checked = false;
    document.getElementById('productVegan').checked = false;
    document.getElementById('productGlutenFree').checked = false;
    document.getElementById('productSpicy').checked = false;
    
    // Garantir que o select de categorias exista e esteja populado
    if (!document.getElementById('productCategory')) {
        if (typeof loadModals === 'function') {
            try { await loadModals(); } catch (_) {}
        }
    }
    try { await loadCategoriesForProducts(); } catch (_) {}

    // Reset tipo de produto para comum
    document.getElementById('productType').value = 'comum';
    toggleProductTypeFields();
    
    document.getElementById('productModal').style.display = 'flex';
}

/**
 * Fecha modal de produto
 */
function closeProductModal() {
    // Verificar se productsState existe
    if (typeof productsState !== 'undefined') {
        productsState.editingProduct = null;
    }
    
    document.getElementById('productModal').style.display = 'none';
}

/**
 * Alterna campos baseado no tipo de produto selecionado
 */
function toggleProductTypeFields() {
    const productType = document.getElementById('productType');
    const priceGroup = document.getElementById('productPriceGroup');
    const pizzaInfoGroup = document.getElementById('pizzaInfoGroup');
    const pizzaConfigSection = document.getElementById('pizzaConfigSection');
    const priceInput = document.getElementById('productPrice');
    
    // Verificar se todos os elementos existem
    if (!productType || !priceGroup || !pizzaInfoGroup || !pizzaConfigSection || !priceInput) {
        console.warn('Elementos do formulário de produto não encontrados');
        return;
    }
    
    if (productType.value === 'pizza') {
        // Para pizzas, oculta o campo de preço e mostra configurações
        priceGroup.style.display = 'none';
        pizzaInfoGroup.style.display = 'block';
        pizzaConfigSection.style.display = 'block';
        priceInput.required = false;
        priceInput.value = '0.00';
        
        // Carregar configurações disponíveis
        loadPizzaConfigurationsForProduct();
    } else {
        // Para produtos comuns, mostra o campo de preço e oculta configurações de pizza
        priceGroup.style.display = 'block';
        pizzaInfoGroup.style.display = 'none';
        pizzaConfigSection.style.display = 'none';
        priceInput.required = true;
        if (priceInput.value === '0.00') {
            priceInput.value = '';
        }
    }
}

/**
 * Carrega todas as configurações de pizza disponíveis
 */
async function loadPizzaConfigurationsForProduct() {
    await Promise.all([
        loadPizzaSizesForProduct(),
        loadPizzaFlavorsForProduct(),
        loadPizzaBordersForProduct(),
        loadPizzaExtrasForProduct()
    ]);
}

/**
 * Carrega tamanhos de pizza disponíveis para seleção
 */
async function loadPizzaSizesForProduct() {
    try {
        const response = await fetch(CONFIG.API_BASE_URL + 'pizza/sizes?all=true');
        const data = await response.json();
        
        if (data.success) {
            const checkboxContainer = document.getElementById('pizzaSizesCheckboxes');
            checkboxContainer.innerHTML = '';
            
            data.data.forEach(size => {
                const checkboxDiv = document.createElement('div');
                checkboxDiv.className = 'checkbox-item';
                
                checkboxDiv.innerHTML = `
                    <label class="checkbox-label">
                        <input type="checkbox" name="pizza_sizes[]" value="${size.id}" ${size.active ? '' : 'disabled'}>
                        <span class="checkmark"></span>
                        <span class="size-info">
                            <strong>${size.name}</strong>
                            <small>${size.description || size.slices + ' fatias'}</small>
                            <span class="price">R$ ${parseFloat(size.price).toFixed(2)}</span>
                        </span>
                    </label>
                `;
                
                checkboxContainer.appendChild(checkboxDiv);
            });
        } else {
            console.error('Erro ao carregar tamanhos de pizza:', data.message);
        }
    } catch (error) {
        console.error('Erro ao carregar tamanhos de pizza:', error);
    }
}

/**
 * Carrega sabores de pizza disponíveis
 */
async function loadPizzaFlavorsForProduct() {
    try {
        const response = await fetch(CONFIG.API_BASE_URL + 'pizza/flavors?all=true');
        const data = await response.json();
        
        if (data.success) {
            const checkboxContainer = document.getElementById('pizzaFlavorsCheckboxes');
            checkboxContainer.innerHTML = '';
            
            data.data.forEach(flavor => {
                const checkboxDiv = document.createElement('div');
                checkboxDiv.className = 'checkbox-item';
                checkboxDiv.dataset.category = flavor.category;
                
                checkboxDiv.innerHTML = `
                    <label class="checkbox-label">
                        <input type="checkbox" name="pizza_flavors[]" value="${flavor.id}" ${flavor.active ? '' : 'disabled'}>
                        <span class="checkmark"></span>
                        <span class="size-info">
                            <strong>${flavor.name}</strong>
                            <small>${flavor.description || 'Sabor ' + flavor.category}</small>
                            <span class="price">+ R$ ${parseFloat(flavor.price).toFixed(2)}</span>
                        </span>
                    </label>
                `;
                
                checkboxContainer.appendChild(checkboxDiv);
            });
            
            // Mostrar todos inicialmente
            showFlavorCategory('all');
        }
    } catch (error) {
        console.error('Erro ao carregar sabores de pizza:', error);
    }
}

/**
 * Carrega bordas de pizza disponíveis
 */
async function loadPizzaBordersForProduct() {
    try {
        const response = await fetch(CONFIG.API_BASE_URL + 'pizza/borders?all=true');
        const data = await response.json();
        
        if (data.success) {
            const checkboxContainer = document.getElementById('pizzaBordersCheckboxes');
            checkboxContainer.innerHTML = '';
            
            data.data.forEach(border => {
                const checkboxDiv = document.createElement('div');
                checkboxDiv.className = 'checkbox-item';
                
                checkboxDiv.innerHTML = `
                    <label class="checkbox-label">
                        <input type="checkbox" name="pizza_borders[]" value="${border.id}" ${border.active ? '' : 'disabled'}>
                        <span class="checkmark"></span>
                        <span class="size-info">
                            <strong>${border.name}</strong>
                            <small>${border.description || 'Borda especial'}</small>
                            <span class="price">+ R$ ${parseFloat(border.price).toFixed(2)}</span>
                        </span>
                    </label>
                `;
                
                checkboxContainer.appendChild(checkboxDiv);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar bordas de pizza:', error);
    }
}

/**
 * Carrega adicionais de pizza disponíveis
 */
async function loadPizzaExtrasForProduct() {
    try {
        const response = await fetch(CONFIG.API_BASE_URL + 'pizza/extras?all=true');
        const data = await response.json();
        
        if (data.success) {
            const checkboxContainer = document.getElementById('pizzaExtrasCheckboxes');
            checkboxContainer.innerHTML = '';
            
            data.data.forEach(extra => {
                const checkboxDiv = document.createElement('div');
                checkboxDiv.className = 'checkbox-item';
                checkboxDiv.dataset.category = extra.category;
                
                checkboxDiv.innerHTML = `
                    <label class="checkbox-label">
                        <input type="checkbox" name="pizza_extras[]" value="${extra.id}" ${extra.active ? '' : 'disabled'}>
                        <span class="checkmark"></span>
                        <span class="size-info">
                            <strong>${extra.name}</strong>
                            <small>${extra.description || extra.category}</small>
                            <span class="price">+ R$ ${parseFloat(extra.price).toFixed(2)}</span>
                        </span>
                    </label>
                `;
                
                checkboxContainer.appendChild(checkboxDiv);
            });
            
            // Mostrar todos inicialmente
            showExtraCategory('all');
        }
    } catch (error) {
        console.error('Erro ao carregar adicionais de pizza:', error);
    }
}

/**
 * Mostra sabores por categoria
 */
function showFlavorCategory(category) {
    const items = document.querySelectorAll('#pizzaFlavorsCheckboxes .checkbox-item');
    const tabs = document.querySelectorAll('#pizzaConfigSection .pizza-config-tabs .config-tab');
    
    // Atualizar tabs ativos
    tabs.forEach(tab => {
        if (tab.onclick.toString().includes(`'${category}'`)) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    // Mostrar/ocultar items
    items.forEach(item => {
        if (category === 'all' || item.dataset.category === category) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

/**
 * Mostra adicionais por categoria
 */
function showExtraCategory(category) {
    const items = document.querySelectorAll('#pizzaExtrasCheckboxes .checkbox-item');
    const tabs = document.querySelectorAll('#pizzaConfigSection .pizza-config-tabs .config-tab');
    
    // Atualizar tabs ativos (apenas os de extras)
    const extraTabs = Array.from(tabs).filter(tab => tab.onclick.toString().includes('showExtraCategory'));
    extraTabs.forEach(tab => {
        if (tab.onclick.toString().includes(`'${category}'`)) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    // Mostrar/ocultar items
    items.forEach(item => {
        if (category === 'all' || item.dataset.category === category) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

/**
 * Edita um produto
 */
async function editProduct(productId) {
    try {
        // Verificar se productsState existe
        if (typeof productsState === 'undefined') {
            showError('Erro: Estado dos produtos não inicializado. Tente novamente.');
            return;
        }
        
        showLoading();
        const response = await fetch(CONFIG.API_BASE_URL + 'products/' + productId);
        const data = await response.json();
        
        if (data.success) {
            productsState.editingProduct = data.data;
            // Garantir categorias carregadas e select populado antes de preencher o formulário
            try { await loadCategoriesForProducts(); } catch (_) {}
            populateProductForm(data.data);
            document.getElementById('productModalTitle').innerHTML = '<i class="fas fa-edit"></i> Editar Produto';
            document.getElementById('productModal').style.display = 'flex';
        } else {
            showError('Erro ao carregar produto: ' + data.message);
        }
    } catch (error) {
        console.error('Erro ao carregar produto:', error);
        showError('Erro ao carregar produto');
    } finally {
        hideLoading();
    }
}

/**
 * Popula o formulário com dados do produto
 */
function populateProductForm(product) {
    // Verificar se todos os elementos do formulário existem
    const elements = {
        name: document.getElementById('productName'),
        category: document.getElementById('productCategory'),
        price: document.getElementById('productPrice'),
        order: document.getElementById('productOrder'),
        description: document.getElementById('productDescription'),
        image: document.getElementById('productImage'),
        prepTime: document.getElementById('productPrepTime'),
        active: document.getElementById('productActive'),
        type: document.getElementById('productType'),
        vegetarian: document.getElementById('productVegetarian'),
        vegan: document.getElementById('productVegan'),
        glutenFree: document.getElementById('productGlutenFree'),
        spicy: document.getElementById('productSpicy')
    };
    
    // Verificar se todos os elementos existem
    for (const [key, element] of Object.entries(elements)) {
        if (!element) {
            console.warn(`Elemento ${key} não encontrado no formulário de produto`);
            return;
        }
    }
    
    // Preencher o formulário
    elements.name.value = product.name;
    elements.category.value = product.category_id;
    elements.price.value = product.price;
    elements.order.value = product.display_order || 0;
    elements.description.value = product.description || '';
    elements.image.value = product.image_url || '';
    elements.prepTime.value = product.preparation_time || 0;
    elements.active.checked = product.active;
    
    // Lida com a pré-visualização da imagem
    const imagePreview = document.getElementById('imagePreview');
    const preview = document.getElementById('preview');
    if (product.image_url) {
        preview.src = product.image_url;
        imagePreview.style.display = 'block';
    } else {
        imagePreview.style.display = 'none';
        preview.src = '#';
    }
    
    // Tipo de produto
    elements.type.value = product.product_type || 'comum';
    toggleProductTypeFields();
    
    // Se for pizza, marcar configurações selecionadas
    if (product.product_type === 'pizza') {
        setTimeout(() => {
            // Marcar tamanhos
            if (product.pizza_sizes) {
                product.pizza_sizes.forEach(size => {
                    const checkbox = document.querySelector(`input[name="pizza_sizes[]"][value="${size.id}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
            }
            
            // Marcar sabores
            if (product.pizza_flavors) {
                product.pizza_flavors.forEach(flavor => {
                    const checkbox = document.querySelector(`input[name="pizza_flavors[]"][value="${flavor.id}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
            }
            
            // Marcar bordas
            if (product.pizza_borders) {
                product.pizza_borders.forEach(border => {
                    const checkbox = document.querySelector(`input[name="pizza_borders[]"][value="${border.id}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
            }
            
            // Marcar adicionais
            if (product.pizza_extras) {
                product.pizza_extras.forEach(extra => {
                    const checkbox = document.querySelector(`input[name="pizza_extras[]"][value="${extra.id}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
            }
        }, 200); // Aguarda um pouco mais para os checkboxes serem carregados
    }
    
    // Características especiais
    elements.vegetarian.checked = product.is_vegetarian;
    elements.vegan.checked = product.is_vegan;
    elements.glutenFree.checked = product.is_gluten_free;
    elements.spicy.checked = product.is_spicy;
}

/**
 * Salva produto (criar ou atualizar)
 */
async function saveProduct() {
    try {
        if (typeof productsState === 'undefined') {
            showError('Erro: Estado dos produtos não inicializado. Tente novamente.');
            return;
        }

        showLoading();

        const form = document.getElementById('productForm');
        const formData = new FormData(form);
        const imageFile = document.getElementById('productImageUpload').files[0];
        let imageUrl = formData.get('image_url'); // Pega a URL existente (se houver)

        // 1. Fazer upload da imagem se uma nova foi selecionada
        if (imageFile) {
            const uploadFormData = new FormData();
            uploadFormData.append('image', imageFile);

            const uploadResponse = await fetch('../api/upload.php', {
                method: 'POST',
                body: uploadFormData
            });

            const uploadResult = await uploadResponse.json();

            if (uploadResult.success) {
                imageUrl = uploadResult.url; // Atualiza a URL da imagem
            } else {
                showError('Erro no upload da imagem: ' + (uploadResult.message || 'Erro desconhecido.'));
                hideLoading();
                return;
            }
        }

        // 2. Coletar os dados do produto, incluindo a nova URL da imagem
        const productData = {
            name: formData.get('name'),
            category_id: formData.get('category_id'),
            price: parseFloat(formData.get('price')) || 0,
            display_order: parseInt(formData.get('display_order')) || 0,
            description: formData.get('description'),
            image_url: imageUrl, // Usa a URL nova ou a existente
            preparation_time: parseInt(formData.get('preparation_time')) || 0,
            product_type: formData.get('product_type') || 'comum',
            active: document.getElementById('productActive').checked,
            is_vegetarian: document.getElementById('productVegetarian').checked,
            is_vegan: document.getElementById('productVegan').checked,
            is_gluten_free: document.getElementById('productGlutenFree').checked,
            is_spicy: document.getElementById('productSpicy').checked
        };

        if (productData.product_type === 'pizza') {
            const selectedSizes = [];
            document.querySelectorAll('input[name="pizza_sizes[]"]:checked').forEach(checkbox => selectedSizes.push(parseInt(checkbox.value)));
            productData.pizza_sizes = selectedSizes;

            const selectedFlavors = [];
            document.querySelectorAll('input[name="pizza_flavors[]"]:checked').forEach(checkbox => selectedFlavors.push(parseInt(checkbox.value)));
            productData.pizza_flavors = selectedFlavors;

            const selectedBorders = [];
            document.querySelectorAll('input[name="pizza_borders[]"]:checked').forEach(checkbox => selectedBorders.push(parseInt(checkbox.value)));
            productData.pizza_borders = selectedBorders;

            const selectedExtras = [];
            document.querySelectorAll('input[name="pizza_extras[]"]:checked').forEach(checkbox => selectedExtras.push(parseInt(checkbox.value)));
            productData.pizza_extras = selectedExtras;
        }
        
        // 3. Salvar os dados do produto
        const url = productsState.editingProduct ? 
            CONFIG.API_BASE_URL + 'products/' + productsState.editingProduct.id :
            CONFIG.API_BASE_URL + 'products';
        
        const method = productsState.editingProduct ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess(productsState.editingProduct ? 'Produto atualizado com sucesso!' : 'Produto criado com sucesso!');
            closeProductModal();
            loadProductsForManagement();
            if (typeof reloadProdutosAdmin === 'function') {
                reloadProdutosAdmin();
            }
        } else {
            showError('Erro ao salvar produto: ' + data.message);
        }
    } catch (error) {
        console.error('Erro ao salvar produto:', error);
        showError('Ocorreu um erro inesperado. Verifique o console para mais detalhes.');
    } finally {
        hideLoading();
    }
}

/**
 * Pausa/despausa um produto
 */
async function toggleProductStatus(productId) {
    try {
        showLoading();
        const response = await fetch(CONFIG.API_BASE_URL + 'products/' + productId, {
            method: 'PATCH'
        });
        
        const data = await response.json();
        
        if (data.success) {
            loadProductsForManagement();
        } else {
            showError('Erro ao alterar status: ' + data.message);
        }
    } catch (error) {
        console.error('Erro ao alterar status:', error);
        showError('Erro ao alterar status do produto');
    } finally {
        hideLoading();
    }
}

/**
 * Mostra modal de confirmação de exclusão
 */
function deleteProduct(productId, productName) {
    // Verificar se productsState existe
    if (typeof productsState === 'undefined') {
        showError('Erro: Estado dos produtos não inicializado. Tente novamente.');
        return;
    }
    
    productsState.currentProduct = { id: productId, name: productName };
    document.getElementById('deleteProductName').textContent = productName;
    document.getElementById('deleteProductModal').style.display = 'flex';
}

/**
 * Fecha modal de confirmação de exclusão
 */
function closeDeleteProductModal() {
    // Verificar se productsState existe
    if (typeof productsState !== 'undefined') {
        productsState.currentProduct = null;
    }
    
    document.getElementById('deleteProductModal').style.display = 'none';
}

/**
 * Confirma exclusão do produto
 */
async function confirmDeleteProduct() {
    // Verificar se productsState existe
    if (typeof productsState === 'undefined') {
        showError('Erro: Estado dos produtos não inicializado. Tente novamente.');
        return;
    }
    
    if (!productsState.currentProduct) return;
    
    try {
        showLoading();
        const response = await fetch(CONFIG.API_BASE_URL + 'products/' + productsState.currentProduct.id, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess('Produto excluído com sucesso!');
            closeDeleteProductModal();
            loadProductsForManagement();
            // Recarregar também a nova seção de produtos se estiver ativa
            if (typeof reloadProdutosAdmin === 'function') {
                reloadProdutosAdmin();
            }
        } else {
            showError('Erro ao excluir produto: ' + data.message);
        }
    } catch (error) {
        console.error('Erro ao excluir produto:', error);
        showError('Erro ao excluir produto');
    } finally {
        hideLoading();
    }
}

// Expõe funções de produtos
window.showAddProductModal = showAddProductModal;
window.closeProductModal = closeProductModal;
window.saveProduct = saveProduct;
window.editProduct = editProduct;
window.toggleProductStatus = toggleProductStatus;
window.deleteProduct = deleteProduct;
window.closeDeleteProductModal = closeDeleteProductModal;
window.toggleProductTypeFields = toggleProductTypeFields;
window.loadPizzaSizesForProduct = loadPizzaSizesForProduct;
window.loadPizzaConfigurationsForProduct = loadPizzaConfigurationsForProduct;
window.showFlavorCategory = showFlavorCategory;
window.showExtraCategory = showExtraCategory;
window.confirmDeleteProduct = confirmDeleteProduct;
window.filterProducts = filterProducts;
window.showPrintModal = showPrintModal;
window.closePrintModal = closePrintModal;
window.printKitchenOrder = printKitchenOrder;
window.printCustomerOrder = printCustomerOrder;

// ========================================
// PIZZA ADMIN (Tamanhos, Sabores, Adicionais, Preços)
// ========================================

const pizzaAdminState = {
    sizes: [],
    flavors: [],
    extras: [],
    prices: [],
    editingItem: null,
    editingType: null
};

// Debug log para verificar inicialização
console.log('🚀 pizzaAdminState inicializado:', pizzaAdminState);

async function loadPizzaAdminData() {
    try {
        showLoading();
        
        // Carregar tamanhos
        const sizesResponse = await fetch(CONFIG.API_BASE_URL + 'pizza/sizes?all=true');
        if (sizesResponse.ok) {
            const sizesData = await sizesResponse.json();
            if (sizesData.success) {
                pizzaAdminState.sizes = sizesData.data;
            }
        }
        
        // Carregar sabores
        const flavorsResponse = await fetch(CONFIG.API_BASE_URL + 'pizza/flavors?all=true');
        if (flavorsResponse.ok) {
            const flavorsData = await flavorsResponse.json();
            if (flavorsData.success) {
                pizzaAdminState.flavors = flavorsData.data;
            }
        }
        
        // Preços de sabores foram removidos – nada a carregar aqui
        
        // Carregar adicionais
        const extrasResponse = await fetch(CONFIG.API_BASE_URL + 'pizza/extras?all=true');
        if (extrasResponse.ok) {
            const extrasData = await extrasResponse.json();
            if (extrasData.success) {
                pizzaAdminState.extras = extrasData.data;
            }
        }
        
        // Renderizar dados
        renderPizzaSizes();
        renderPizzaFlavors();
        // renderPizzaPrices(); // seção removida
        renderPizzaExtras();
        
        // Atualizar contadores
        const sizesCountEl = document.getElementById('sizesCount');
        if (sizesCountEl) sizesCountEl.textContent = `${pizzaAdminState.sizes.length} itens`;
        const flavorsCountEl = document.getElementById('flavorsCount');
        if (flavorsCountEl) flavorsCountEl.textContent = `${pizzaAdminState.flavors.length} itens`;
        const extrasCountEl = document.getElementById('extrasCount');
        if (extrasCountEl) extrasCountEl.textContent = `${pizzaAdminState.extras.length} itens`;
        
    } catch (error) {
        console.error('Erro ao carregar dados das pizzas:', error);
        showError('Erro ao carregar dados das pizzas');
    } finally {
        hideLoading();
    }
}

function showPizzaTab(tab) {
    console.log('Mostrando aba pizza:', tab);
    
    // Esconder todas as abas
    document.querySelectorAll('.pizza-tab-pane').forEach(pane => pane.classList.remove('active'));
    document.querySelectorAll('.pizza-tab-item').forEach(item => item.classList.remove('active'));
    
    // Mostrar aba selecionada
    document.getElementById(`pizza${tab.charAt(0).toUpperCase() + tab.slice(1)}Tab`).classList.add('active');
    event.target.classList.add('active');
    
    // Carregar dados específicos da aba
    switch(tab) {
        case 'sizes':
            renderPizzaSizes();
            break;
        case 'flavors':
            renderPizzaFlavors();
            break;
        case 'prices':
            // === ABA REMOVIDA: Preços de Sabores ===
            console.warn('Aba de preços foi removida - sabores não têm preços próprios');
            break;
        case 'extras':
            renderPizzaExtras();
            break;
    }
}

// ========================================
// TAMANHOS
// ========================================

function showPizzaSizeModal(item = null) {
    pizzaAdminState.editingItem = item;
    pizzaAdminState.editingType = 'size';
    const modal = document.getElementById('pizzaSizeModal');
    const title = document.getElementById('pizzaSizeModalTitle');
    const form = document.getElementById('pizzaSizeForm');
    
    title.textContent = item ? 'Editar Tamanho' : 'Novo Tamanho';
    
    if (item) {
        form.sizeName.value = item.name;
        form.sizeSlices.value = item.slices;
        form.sizeMaxFlavors.value = item.max_flavors;
        form.sizePrice.value = item.price || '';
        form.sizeDescription.value = item.description || '';
        form.sizeActive.checked = item.active == 1;
    } else {
        form.reset();
        form.sizeActive.checked = true;
    }
    
    modal.classList.add('active');
}

function closePizzaSizeModal() {
    document.getElementById('pizzaSizeModal').classList.remove('active');
    pizzaAdminState.editingItem = null;
    pizzaAdminState.editingType = null;
}

async function savePizzaSize() {
    const form = document.getElementById('pizzaSizeForm');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    data.active = form.sizeActive.checked ? 1 : 0;
    
    try {
        showLoading();
        const url = CONFIG.API_BASE_URL + 'pizza/sizes';
        const method = pizzaAdminState.editingItem ? 'PUT' : 'POST';
        const finalUrl = pizzaAdminState.editingItem ? `${url}/${pizzaAdminState.editingItem.id}` : url;
        
        const response = await fetch(finalUrl, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        if (result.success) {
            showSuccess(pizzaAdminState.editingItem ? 'Tamanho atualizado com sucesso!' : 'Tamanho criado com sucesso!');
            closePizzaSizeModal();
            await loadPizzaAdminData();
        } else {
            showError(result.message || 'Erro ao salvar tamanho');
        }
    } catch (error) {
        console.error('Erro:', error);
        showError('Erro ao salvar tamanho');
    } finally {
        hideLoading();
    }
}

function editPizzaSize(size) {
    console.log('Editando tamanho:', size);
    showPizzaSizeModal(size);
}

function editPizzaSizeById(id) {
    console.log('Editando tamanho por ID:', id);
    const size = pizzaAdminState.sizes.find(s => s.id == id);
    if (size) {
        showPizzaSizeModal(size);
    } else {
        console.error('Tamanho não encontrado:', id);
        showError('Tamanho não encontrado');
    }
}

async function deletePizzaSize(id) {
    console.log('Excluindo tamanho ID:', id);
    const size = pizzaAdminState.sizes.find(s => s.id == id);
    if (!size) {
        console.error('Tamanho não encontrado:', id);
        return;
    }
    
    document.getElementById('deletePizzaItemName').textContent = `o tamanho "${size.name}"`;
    document.getElementById('deletePizzaItemModal').classList.add('active');
    pizzaAdminState.editingItem = { id, type: 'size' };
}

// ========================================
// SABORES
// ========================================

function showPizzaFlavorModal(item = null) {
    pizzaAdminState.editingItem = item;
    pizzaAdminState.editingType = 'flavor';
    const modal = document.getElementById('pizzaFlavorModal');
    const title = document.getElementById('pizzaFlavorModalTitle');
    const form = document.getElementById('pizzaFlavorForm');
    
    title.textContent = item ? 'Editar Sabor' : 'Novo Sabor';
    
    if (item) {
        form.flavorName.value = item.name;
        form.flavorCategory.value = item.category;
        // category_value (exibe formatado em pt-BR)
        const catValInput = document.getElementById('flavorCategoryValue');
        if (catValInput) {
            const raw = (item.category_value ?? 0);
            // Define valor exibido formatado
            catValInput.value = formatBRLInput(raw);
            // Prepara dataset em centavos para a máscara não sobrescrever
            const num = parseBRLToNumber(catValInput.value);
            catValInput.dataset.cents = String(Math.round(num * 100));
        }
        form.flavorDescription.value = item.description || '';
        form.flavorIngredients.value = item.ingredients || '';
        form.flavorVegan.checked = item.is_vegan == 1;
        form.flavorGlutenFree.checked = item.is_gluten_free == 1;
        form.flavorSpicy.checked = item.is_spicy == 1;
        form.flavorActive.checked = item.active == 1;
    } else {
        form.reset();
        form.flavorActive.checked = true;
        const catValInput2 = document.getElementById('flavorCategoryValue');
        if (catValInput2) catValInput2.value = '';
    }
    
    modal.classList.add('active');

    // Máscara/formatador para o campo de valor BRL
    const valueInput = document.getElementById('flavorCategoryValue');
    if (valueInput && !valueInput._brlCentBound) {
        // Liga a máscara de entrada por centavos
        bindBRLCentavosMask(valueInput);
        valueInput._brlCentBound = true;
    }
}

function closePizzaFlavorModal() {
    document.getElementById('pizzaFlavorModal').classList.remove('active');
    pizzaAdminState.editingItem = null;
    pizzaAdminState.editingType = null;
}

async function savePizzaFlavor() {
    const form = document.getElementById('pizzaFlavorForm');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    data.is_vegan = form.flavorVegan.checked ? 1 : 0;
    data.is_gluten_free = form.flavorGlutenFree.checked ? 1 : 0;
    data.is_spicy = form.flavorSpicy.checked ? 1 : 0;
    data.active = form.flavorActive.checked ? 1 : 0;
    // category_value vem do campo do formulário em formato BR (1.234,56)
    if (typeof data.category_value !== 'undefined' && data.category_value !== '') {
        // Se vier em formato de moeda, converter a partir do dataset de centavos
        const inputEl = document.getElementById('flavorCategoryValue');
        if (inputEl && inputEl.dataset && inputEl.dataset.cents) {
            data.category_value = parseInt(inputEl.dataset.cents, 10) / 100;
        } else {
            data.category_value = parseBRLToNumber(data.category_value);
        }
    } else {
        // fallback para 0 quando não informado
        data.category_value = 0;
    }
    
    try {
        showLoading();
        const url = CONFIG.API_BASE_URL + 'pizza/flavors';
        const method = pizzaAdminState.editingItem ? 'PUT' : 'POST';
        const finalUrl = pizzaAdminState.editingItem ? `${url}/${pizzaAdminState.editingItem.id}` : url;
        
        const response = await fetch(finalUrl, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        if (result.success) {
            showSuccess(pizzaAdminState.editingItem ? 'Sabor atualizado com sucesso!' : 'Sabor criado com sucesso!');
            closePizzaFlavorModal();
            await loadPizzaAdminData();
        } else {
            showError(result.message || 'Erro ao salvar sabor');
        }
    } catch (error) {
        console.error('Erro:', error);
        showError('Erro ao salvar sabor');
    } finally {
        hideLoading();
    }
}

function editPizzaFlavor(flavor) {
    console.log('Editando sabor:', flavor);
    showPizzaFlavorModal(flavor);
}

function editPizzaFlavorById(id) {
    console.log('Editando sabor por ID:', id);
    const flavor = pizzaAdminState.flavors.find(f => f.id == id);
    if (flavor) {
        showPizzaFlavorModal(flavor);
    } else {
        console.error('Sabor não encontrado:', id);
        showError('Sabor não encontrado');
    }
}

async function deletePizzaFlavor(id) {
    console.log('Excluindo sabor ID:', id);
    const flavor = pizzaAdminState.flavors.find(f => f.id == id);
    if (!flavor) {
        console.error('Sabor não encontrado:', id);
        return;
    }
    
    document.getElementById('deletePizzaItemName').textContent = `o sabor "${flavor.name}"`;
    document.getElementById('deletePizzaItemModal').classList.add('active');
    pizzaAdminState.editingItem = { id, type: 'flavor' };
}

// ========================================
// ADICIONAIS
// ========================================

function showPizzaExtraModal(item = null) {
    pizzaAdminState.editingItem = item;
    pizzaAdminState.editingType = 'extra';
    const modal = document.getElementById('pizzaExtraModal');
    const title = document.getElementById('pizzaExtraModalTitle');
    const form = document.getElementById('pizzaExtraForm');
    
    title.textContent = item ? 'Editar Adicional' : 'Novo Adicional';
    
    if (item) {
        form.extraName.value = item.name;
        form.extraCategory.value = item.category;
        form.extraPrice.value = item.price;
        form.extraDisplayOrder.value = item.display_order || 0;
        form.extraDescription.value = item.description || '';
        form.extraActive.checked = item.active == 1;
    } else {
        form.reset();
        form.extraActive.checked = true;
    }
    
    modal.classList.add('active');
}

function closePizzaExtraModal() {
    document.getElementById('pizzaExtraModal').classList.remove('active');
    pizzaAdminState.editingItem = null;
    pizzaAdminState.editingType = null;
}

async function savePizzaExtra() {
    const form = document.getElementById('pizzaExtraForm');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    data.active = form.extraActive.checked ? 1 : 0;
    
    try {
        showLoading();
        const url = CONFIG.API_BASE_URL + 'pizza/extras';
        const method = pizzaAdminState.editingItem ? 'PUT' : 'POST';
        const finalUrl = pizzaAdminState.editingItem ? `${url}/${pizzaAdminState.editingItem.id}` : url;
        
        const response = await fetch(finalUrl, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        if (result.success) {
            showSuccess(pizzaAdminState.editingItem ? 'Adicional atualizado com sucesso!' : 'Adicional criado com sucesso!');
            closePizzaExtraModal();
            await loadPizzaAdminData();
        } else {
            showError(result.message || 'Erro ao salvar adicional');
        }
    } catch (error) {
        console.error('Erro:', error);
        showError('Erro ao salvar adicional');
    } finally {
        hideLoading();
    }
}

function editPizzaExtra(extra) {
    console.log('Editando adicional:', extra);
    showPizzaExtraModal(extra);
}

function editPizzaExtraById(id) {
    console.log('Editando adicional por ID:', id);
    const extra = pizzaAdminState.extras.find(e => e.id == id);
    if (extra) {
        showPizzaExtraModal(extra);
    } else {
        console.error('Adicional não encontrado:', id);
        showError('Adicional não encontrado');
    }
}

async function deletePizzaExtra(id) {
    console.log('Excluindo adicional ID:', id);
    const extra = pizzaAdminState.extras.find(e => e.id == id);
    if (!extra) {
        console.error('Adicional não encontrado:', id);
        return;
    }
    
    document.getElementById('deletePizzaItemName').textContent = `o adicional "${extra.name}"`;
    document.getElementById('deletePizzaItemModal').classList.add('active');
    pizzaAdminState.editingItem = { id, type: 'extra' };
}

// ========================================
// PREÇOS
// ========================================

function renderPizzaPricesMatrix() {
    const container = document.getElementById('pizzaPricesMatrix');
    
    if (!pizzaAdminState.sizes.length || !pizzaAdminState.flavors.length) {
        container.innerHTML = `
            <div class="matrix-empty-state">
                <div class="empty-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h4>Matriz de Preços Indisponível</h4>
                <p>Para configurar a matriz de preços, você precisa ter pelo menos:</p>
                <ul>
                    <li><i class="fas fa-ruler-combined"></i> 1 tamanho de pizza cadastrado</li>
                    <li><i class="fas fa-pizza-slice"></i> 1 sabor de pizza cadastrado</li>
                </ul>
                <div class="quick-actions">
                    ${!pizzaAdminState.sizes.length ? '<button class="btn-quick" onclick="showPizzaTab(\'sizes\')"><i class="fas fa-plus"></i> Cadastrar Tamanhos</button>' : ''}
                    ${!pizzaAdminState.flavors.length ? '<button class="btn-quick" onclick="showPizzaTab(\'flavors\')"><i class="fas fa-plus"></i> Cadastrar Sabores</button>' : ''}
                </div>
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="matrix-container">
            <div class="matrix-header">
                <div class="matrix-stats">
                    <span class="stat-item">
                        <i class="fas fa-ruler-combined"></i>
                        ${pizzaAdminState.sizes.length} tamanhos
                    </span>
                    <span class="stat-item">
                        <i class="fas fa-pizza-slice"></i>
                        ${pizzaAdminState.flavors.length} sabores
                    </span>
                    <span class="stat-item">
                        <i class="fas fa-calculator"></i>
                        ${pizzaAdminState.sizes.length * pizzaAdminState.flavors.length} combinações
                    </span>
                </div>
            </div>
            
            <div class="matrix-table-wrapper">
                <table class="prices-matrix">
                    <thead>
                        <tr>
                            <th class="flavor-header">
                                <div class="header-content">
                                    <i class="fas fa-pizza-slice"></i>
                                    <span>Sabor / Tamanho</span>
                                </div>
                            </th>`;
    
    pizzaAdminState.sizes.forEach(size => {
        html += `
            <th class="size-header">
                <div class="size-info">
                    <strong>${size.name}</strong>
                    <small>${size.slices} fatias</small>
                    <small>${size.max_flavors} sabores</small>
                </div>
            </th>`;
    });
    
    html += '</tr></thead><tbody>';
    
    pizzaAdminState.flavors.forEach((flavor, flavorIndex) => {
        html += `<tr class="flavor-row ${flavorIndex % 2 === 0 ? 'even' : 'odd'}">`;
        html += `
            <td class="flavor-cell">
                <div class="flavor-info">
                    <strong>${flavor.name}</strong>
                    <small class="category-tag ${flavor.category.toLowerCase()}">${flavor.category}</small>
                    <div class="flavor-characteristics">
                        ${flavor.is_vegan ? '<span class="mini-tag vegan">V</span>' : ''}
                        ${flavor.is_gluten_free ? '<span class="mini-tag gluten-free">GF</span>' : ''}
                        ${flavor.is_spicy ? '<span class="mini-tag spicy">🌶️</span>' : ''}
                    </div>
                </div>
            </td>`;
        
        pizzaAdminState.sizes.forEach(size => {
            const inputId = `price_${flavor.id}_${size.id}`;
            const existingPrice = pizzaAdminState.prices.find(p => p.flavor_id == flavor.id && p.size_id == size.id);
            html += `
                <td class="price-cell">
                    <div class="price-input-wrapper">
                        <span class="currency-symbol">R$</span>
                        <input type="number" 
                               step="0.01" 
                               min="0" 
                               max="999.99"
                               id="${inputId}" 
                               class="price-input"
                               placeholder="0,00" 
                               value="${existingPrice ? existingPrice.price : ''}"
                               onchange="markPriceChanged()">
                    </div>
                </td>`;
        });
        html += '</tr>';
    });
    
    html += '</tbody></table></div></div>';
    container.innerHTML = html;
}

function markPriceChanged() {
    // Visual indicator that prices have changed
    const saveButton = document.querySelector('button[onclick="savePizzaPrices()"]');
    if (saveButton && !saveButton.classList.contains('changed')) {
        saveButton.classList.add('changed');
        saveButton.innerHTML = '<i class="fas fa-save"></i> Salvar Alterações';
    }
}

function loadPricesFromApi() {
    // Reload prices from API
    loadPizzaAdminData();
}

// ========================================
// FILTROS
// ========================================

function filterFlavors() {
    renderPizzaFlavors();
}

function filterExtras() {
    renderPizzaExtras();
}

// ========================================
// FUNÇÕES DE TOGGLE (PAUSAR/ATIVAR)
// ========================================

async function togglePizzaSize(id) {
    try {
        showLoading();
        const size = pizzaAdminState.sizes.find(s => s.id == id);
        if (!size) return;
        
        const newStatus = size.active ? 0 : 1;
        const response = await fetch(CONFIG.API_BASE_URL + `pizza/sizes/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...size, active: newStatus })
        });
        
        const result = await response.json();
        if (result.success) {
            await loadPizzaAdminData();
        } else {
            showError(result.message || 'Erro ao alterar status');
        }
    } catch (error) {
        console.error('Erro:', error);
        showError('Erro ao alterar status do tamanho');
    } finally {
        hideLoading();
    }
}

async function togglePizzaFlavor(id) {
    try {
        showLoading();
        const flavor = pizzaAdminState.flavors.find(f => f.id == id);
        if (!flavor) return;
        
        const newStatus = flavor.active ? 0 : 1;
        const response = await fetch(CONFIG.API_BASE_URL + `pizza/flavors/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...flavor, active: newStatus })
        });
        
        const result = await response.json();
        if (result.success) {
            await loadPizzaAdminData();
        } else {
            showError(result.message || 'Erro ao alterar status');
        }
    } catch (error) {
        console.error('Erro:', error);
        showError('Erro ao alterar status do sabor');
    } finally {
        hideLoading();
    }
}

async function togglePizzaExtra(id) {
    try {
        showLoading();
        const extra = pizzaAdminState.extras.find(e => e.id == id);
        if (!extra) return;
        
        const newStatus = extra.active ? 0 : 1;
        const response = await fetch(CONFIG.API_BASE_URL + `pizza/extras/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...extra, active: newStatus })
        });
        
        const result = await response.json();
        if (result.success) {
            await loadPizzaAdminData();
        } else {
            showError(result.message || 'Erro ao alterar status');
        }
    } catch (error) {
        console.error('Erro:', error);
        showError('Erro ao alterar status do adicional');
    } finally {
        hideLoading();
    }
}

async function savePizzaPrices() {
    try {
        const payload = [];
        pizzaAdminState.flavors.forEach(flavor => {
            pizzaAdminState.sizes.forEach(size => {
                const el = document.getElementById(`price_${flavor.id}_${size.id}`);
                if (el && el.value && parseFloat(el.value) > 0) {
                    payload.push({ 
                        flavor_id: flavor.id, 
                        size_id: size.id, 
                        price: parseFloat(el.value) 
                    });
                }
            });
        });
        
        if (payload.length === 0) {
            showError('Preencha ao menos um preço válido.');
            return;
        }
        
        showLoading();
        const res = await fetch(CONFIG.API_BASE_URL + 'pizza/prices', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (data.success) {
            showSuccess('Preços salvos com sucesso!');
            // Recarrega os preços
            const pricesRes = await fetch(CONFIG.API_BASE_URL + 'pizza/prices');
            const pricesData = await pricesRes.json();
            if (pricesData.success) {
                pizzaAdminState.prices = pricesData.data;
            }
        } else {
            showError(data.message || 'Erro ao salvar preços');
        }
    } catch (e) {
        console.error(e); 
        showError('Erro ao salvar preços');
    } finally { 
        hideLoading(); 
    }
}

// ========================================
// RENDERIZAÇÃO
// ========================================

function renderPizzaSizes() {
    const tableBody = document.getElementById('pizzaSizesTableBody');
    const count = document.getElementById('sizesCount');
    
    if (!pizzaAdminState.sizes.length) {
        tableBody.innerHTML = `
            <tr class="empty-row">
                <td colspan="7" class="empty-state">
                    <i class="fas fa-ruler-combined"></i>
                    <p>Nenhum tamanho cadastrado</p>
                    <button class="btn-add-new" onclick="showPizzaSizeModal()">
                        <i class="fas fa-plus"></i> Criar Primeiro Tamanho
                    </button>
                </td>
            </tr>
        `;
        count.textContent = '0 itens';
        return;
    }
    
    count.textContent = `${pizzaAdminState.sizes.length} itens`;
    
    tableBody.innerHTML = pizzaAdminState.sizes.map(size => `
        <tr>
            <td>
                <div class="item-name">
                    <strong>${size.name}</strong>
                </div>
            </td>
            <td>
                <span class="info-badge">
                    <i class="fas fa-cut"></i> ${size.slices}
                </span>
            </td>
            <td>
                <span class="info-badge">
                    <i class="fas fa-pizza-slice"></i> ${size.max_flavors}
                </span>
            </td>
            <td>
                <span class="price-display">
                    <i class="fas fa-dollar-sign"></i> R$ ${parseFloat(size.price || 0).toFixed(2)}
                </span>
            </td>
            <td>
                <span class="description-text">${size.description || '-'}</span>
            </td>
            <td>
                <span class="status-badge ${size.active ? 'active' : 'inactive'}">
                    ${size.active ? 'Ativo' : 'Pausado'}
                </span>
            </td>
            <td>
                <div class="table-actions">
                    <button class="btn-table edit" onclick="editPizzaSizeById(${size.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-table ${size.active ? 'pause' : 'play'}" onclick="togglePizzaSize(${size.id})" title="${size.active ? 'Pausar' : 'Ativar'}">
                        <i class="fas fa-${size.active ? 'pause' : 'play'}"></i>
                    </button>
                    <button class="btn-table delete" onclick="deletePizzaSize(${size.id})" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderPizzaFlavors() {
    const tableBody = document.getElementById('pizzaFlavorsTableBody');
    const count = document.getElementById('flavorsCount');
    
    // Apply filters
    let filteredFlavors = pizzaAdminState.flavors;
    const categoryFilter = document.getElementById('flavorCategoryFilter')?.value || '';
    const statusFilter = document.getElementById('flavorStatusFilter')?.value || '';
    
    if (categoryFilter) {
        filteredFlavors = filteredFlavors.filter(flavor => flavor.category === categoryFilter);
    }
    if (statusFilter !== '') {
        filteredFlavors = filteredFlavors.filter(flavor => flavor.active == statusFilter);
    }
    
    if (!filteredFlavors.length) {
        tableBody.innerHTML = `
            <tr class="empty-row">
                <td colspan="6" class="empty-state">
                    <i class="fas fa-pizza-slice"></i>
                    <p>${pizzaAdminState.flavors.length ? 'Nenhum sabor encontrado com os filtros aplicados' : 'Nenhum sabor cadastrado'}</p>
                    ${!pizzaAdminState.flavors.length ? `
                        <button class="btn-add-new" onclick="showPizzaFlavorModal()">
                            <i class="fas fa-plus"></i> Criar Primeiro Sabor
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
        count.textContent = '0 itens';
        return;
    }
    
    count.textContent = `${pizzaAdminState.flavors.length} itens`;
    
    tableBody.innerHTML = filteredFlavors.map(flavor => `
        <tr>
            <td>
                <div class="item-name">
                    <strong>${flavor.name}</strong>
                </div>
            </td>
            <td>
                <span class="category-badge ${flavor.category.toLowerCase()}">${flavor.category}</span>
            </td>
            <td>
                <div class="characteristics">
                    ${flavor.is_vegan ? '<span class="char-tag vegan"><i class="fas fa-leaf"></i> Vegano</span>' : ''}
                    ${flavor.is_gluten_free ? '<span class="char-tag gluten-free"><i class="fas fa-wheat"></i> S/ Glúten</span>' : ''}
                    ${flavor.is_spicy ? '<span class="char-tag spicy"><i class="fas fa-fire"></i> Picante</span>' : ''}
                    ${!flavor.is_vegan && !flavor.is_gluten_free && !flavor.is_spicy ? '<span class="char-tag default">-</span>' : ''}
                </div>
            </td>
            <td>
                <span class="description-text" title="${flavor.description || ''}">${flavor.description ? (flavor.description.length > 50 ? flavor.description.substring(0, 50) + '...' : flavor.description) : '-'}</span>
            </td>
            <td>
                <span class="status-badge ${flavor.active ? 'active' : 'inactive'}">
                    ${flavor.active ? 'Ativo' : 'Pausado'}
                </span>
            </td>
            <td>
                <div class="table-actions">
                    <button class="btn-table edit" onclick="editPizzaFlavorById(${flavor.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-table ${flavor.active ? 'pause' : 'play'}" onclick="togglePizzaFlavor(${flavor.id})" title="${flavor.active ? 'Pausar' : 'Ativar'}">
                        <i class="fas fa-${flavor.active ? 'pause' : 'play'}"></i>
                    </button>
                    <button class="btn-table delete" onclick="deletePizzaFlavor(${flavor.id})" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderPizzaExtras() {
    const tableBody = document.getElementById('pizzaExtrasTableBody');
    const count = document.getElementById('extrasCount');
    
    // Apply filters
    let filteredExtras = pizzaAdminState.extras;
    const categoryFilter = document.getElementById('extraCategoryFilter')?.value || '';
    const statusFilter = document.getElementById('extraStatusFilter')?.value || '';
    
    if (categoryFilter) {
        filteredExtras = filteredExtras.filter(extra => extra.category === categoryFilter);
    }
    if (statusFilter !== '') {
        filteredExtras = filteredExtras.filter(extra => extra.active == statusFilter);
    }
    
    if (!filteredExtras.length) {
        tableBody.innerHTML = `
            <tr class="empty-row">
                <td colspan="6" class="empty-state">
                    <i class="fas fa-plus-circle"></i>
                    <p>${pizzaAdminState.extras.length ? 'Nenhum adicional encontrado com os filtros aplicados' : 'Nenhum adicional cadastrado'}</p>
                    ${!pizzaAdminState.extras.length ? `
                        <button class="btn-add-new" onclick="showPizzaExtraModal()">
                            <i class="fas fa-plus"></i> Criar Primeiro Adicional
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
        count.textContent = '0 itens';
        return;
    }
    
    count.textContent = `${pizzaAdminState.extras.length} itens`;
    
    tableBody.innerHTML = filteredExtras.map(extra => `
        <tr>
            <td>
                <div class="item-name">
                    <strong>${extra.name}</strong>
                </div>
            </td>
            <td>
                <span class="category-badge ${extra.category.toLowerCase()}">${extra.category}</span>
            </td>
            <td>
                <span class="price-badge">${formatCurrency(extra.price)}</span>
            </td>
            <td>
                <span class="order-badge">${extra.display_order || 0}</span>
            </td>
            <td>
                <span class="status-badge ${extra.active ? 'active' : 'inactive'}">
                    ${extra.active ? 'Ativo' : 'Pausado'}
                </span>
            </td>
            <td>
                <div class="table-actions">
                    <button class="btn-table edit" onclick="editPizzaExtraById(${extra.id})" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-table ${extra.active ? 'pause' : 'play'}" onclick="togglePizzaExtra(${extra.id})" title="${extra.active ? 'Pausar' : 'Ativar'}">
                        <i class="fas fa-${extra.active ? 'pause' : 'play'}"></i>
                    </button>
                    <button class="btn-table delete" onclick="deletePizzaExtra(${extra.id})" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ========================================
// FUNÇÕES GLOBAIS
// ========================================

function closeDeletePizzaItemModal() {
    document.getElementById('deletePizzaItemModal').classList.remove('active');
    pizzaAdminState.editingItem = null;
}

async function confirmDeletePizzaItem() {
    if (!pizzaAdminState.editingItem) return;
    
    try {
        showLoading();
        const { id, type } = pizzaAdminState.editingItem;
        const endpoint = CONFIG.API_BASE_URL + `pizza/${type === 'size' ? 'sizes' : type === 'flavor' ? 'flavors' : 'extras'}/${id}`;
        
        const response = await fetch(endpoint, { method: 'DELETE' });
        const result = await response.json();
        
        if (result.success) {
            showSuccess('Item excluído com sucesso!');
            closeDeletePizzaItemModal();
            await loadPizzaAdminData();
        } else {
            showError(result.message || 'Erro ao excluir item');
        }
    } catch (error) {
        console.error('Erro:', error);
        showError('Erro ao excluir item');
    } finally {
        hideLoading();
    }
}

// ========================================
// FUNÇÕES DE EXCLUSÃO
// ========================================

function deletePizzaSize(id) {
    console.log('🗑️ deletePizzaSize chamada com ID:', id);
    console.log('pizzaAdminState.sizes:', pizzaAdminState.sizes);
    
    const size = pizzaAdminState.sizes.find(s => s.id == id);
    if (!size) {
        console.error('❌ Tamanho não encontrado:', id);
        return;
    }
    
    console.log('📝 Tamanho encontrado:', size);
    
    const nameElement = document.getElementById('deletePizzaItemName');
    const modalElement = document.getElementById('deletePizzaItemModal');
    
    if (!nameElement) {
        console.error('❌ Elemento deletePizzaItemName não encontrado');
        return;
    }
    
    if (!modalElement) {
        console.error('❌ Elemento deletePizzaItemModal não encontrado');
        return;
    }
    
    nameElement.textContent = `o tamanho "${size.name}"`;
    modalElement.classList.add('active');
    pizzaAdminState.editingItem = { id, type: 'size' };
    
    console.log('✅ Modal de exclusão aberto para:', size.name);
}

function deletePizzaFlavor(id) {
    console.log('Excluindo sabor ID:', id);
    const flavor = pizzaAdminState.flavors.find(f => f.id == id);
    if (!flavor) {
        console.error('Sabor não encontrado:', id);
        return;
    }
    
    document.getElementById('deletePizzaItemName').textContent = `o sabor "${flavor.name}"`;
    document.getElementById('deletePizzaItemModal').classList.add('active');
    pizzaAdminState.editingItem = { id, type: 'flavor' };
}

function deletePizzaExtra(id) {
    console.log('Excluindo adicional ID:', id);
    const extra = pizzaAdminState.extras.find(e => e.id == id);
    if (!extra) {
        console.error('Adicional não encontrado:', id);
        return;
    }
    
    document.getElementById('deletePizzaItemName').textContent = `o adicional "${extra.name}"`;
    document.getElementById('deletePizzaItemModal').classList.add('active');
    pizzaAdminState.editingItem = { id, type: 'extra' };
}

function closeDeletePizzaItemModal() {
    document.getElementById('deletePizzaItemModal').classList.remove('active');
    pizzaAdminState.editingItem = null;
}

async function confirmDeletePizzaItem() {
    console.log('🚀 confirmDeletePizzaItem iniciada');
    
    if (!pizzaAdminState.editingItem) return;
    
    try {
        showLoading();
        const { id, type } = pizzaAdminState.editingItem;
        console.log('Confirmando exclusão:', { id, type });
        
        const endpoint = CONFIG.API_BASE_URL + `pizza/${type === 'size' ? 'sizes' : type === 'flavor' ? 'flavors' : 'extras'}/${id}`;
        console.log('Endpoint de exclusão:', endpoint);
        
        const response = await fetch(endpoint, { method: 'DELETE' });
        const result = await response.json();
        
        console.log('Resultado da exclusão:', result);
        
        if (result.success) {
            showSuccess('Item excluído com sucesso!');
            closeDeletePizzaItemModal();
            await loadPizzaAdminData();
        } else {
            showError(result.message || 'Erro ao excluir item');
        }
    } catch (error) {
        console.error('Erro na exclusão:', error);
        showError('Erro ao excluir item');
    } finally {
        hideLoading();
    }
}

// Helpers
function capitalize(str) { 
    return str.charAt(0).toUpperCase() + str.slice(1); 
}

// ========================================
// EXPOSIÇÃO DE FUNÇÕES GLOBAIS
// ========================================

// Expor funções de exclusão no escopo global
window.deletePizzaSize = deletePizzaSize;
window.deletePizzaFlavor = deletePizzaFlavor;
window.deletePizzaExtra = deletePizzaExtra;
window.confirmDeletePizzaItem = confirmDeletePizzaItem;
window.closeDeletePizzaItemModal = closeDeletePizzaItemModal;

// Debug log para verificar se as funções estão sendo expostas
console.log('🔧 Funções de exclusão expostas:', {
    deletePizzaSize: typeof window.deletePizzaSize,
    deletePizzaFlavor: typeof window.deletePizzaFlavor,
    deletePizzaExtra: typeof window.deletePizzaExtra,
    confirmDeletePizzaItem: typeof window.confirmDeletePizzaItem,
    closeDeletePizzaItemModal: typeof window.closeDeletePizzaItemModal
});

// Expõe funções de produtos
window.closeDeleteProductModal = closeDeleteProductModal;
window.confirmDeleteProduct = confirmDeleteProduct;
window.filterProducts = filterProducts;
window.clearFilters = clearFilters;
window.showPrintModal = showPrintModal;
window.closePrintModal = closePrintModal;
window.printKitchenOrder = printKitchenOrder;
window.printCustomerOrder = printCustomerOrder;

// Expõe funções de pizza admin
window.showPizzaTab = showPizzaTab;
window.showPizzaSizeModal = showPizzaSizeModal;
window.closePizzaSizeModal = closePizzaSizeModal;
window.savePizzaSize = savePizzaSize;
window.editPizzaSize = editPizzaSize;
window.editPizzaSizeById = editPizzaSizeById;
window.deletePizzaSize = deletePizzaSize;
window.togglePizzaSize = togglePizzaSize;
window.showPizzaFlavorModal = showPizzaFlavorModal;
window.closePizzaFlavorModal = closePizzaFlavorModal;
window.savePizzaFlavor = savePizzaFlavor;
window.editPizzaFlavor = editPizzaFlavor;
window.editPizzaFlavorById = editPizzaFlavorById;
window.deletePizzaFlavor = deletePizzaFlavor;
window.togglePizzaFlavor = togglePizzaFlavor;
window.showPizzaExtraModal = showPizzaExtraModal;
window.closePizzaExtraModal = closePizzaExtraModal;
window.savePizzaExtra = savePizzaExtra;
window.editPizzaExtra = editPizzaExtra;
window.editPizzaExtraById = editPizzaExtraById;
window.deletePizzaExtra = deletePizzaExtra;
window.togglePizzaExtra = togglePizzaExtra;
window.savePizzaPrices = savePizzaPrices;
window.loadPricesFromApi = loadPricesFromApi;
window.markPriceChanged = markPriceChanged;
window.filterFlavors = filterFlavors;
window.filterExtras = filterExtras;
window.closeDeletePizzaItemModal = closeDeletePizzaItemModal;
window.confirmDeletePizzaItem = confirmDeletePizzaItem;

// ========================================
// PREÇOS DOS SABORES - REMOVIDOS
// ========================================
// Sabores não têm preços próprios - apenas tamanhos têm preços

/* FUNÇÃO REMOVIDA - showPizzaPriceModal() */
function showPizzaPriceModal(item = null) {
    pizzaAdminState.editingItem = item;
    pizzaAdminState.editingType = 'price';
    const modal = document.getElementById('pizzaPriceModal');
    const title = document.getElementById('pizzaPriceModalTitle');
    const form = document.getElementById('pizzaPriceForm');
    
    title.textContent = item ? 'Editar Preço' : 'Novo Preço';
    
    // Popular os selects com sabores e tamanhos
    populatePriceFormSelects();
    
    if (item) {
        form.priceFlavor.value = item.flavor_id;
        form.priceSize.value = item.size_id;
        form.priceValue.value = item.price;
    } else {
        form.reset();
    }
    
    modal.classList.add('active');
}

function closePizzaPriceModal() {
    document.getElementById('pizzaPriceModal').classList.remove('active');
    pizzaAdminState.editingItem = null;
    pizzaAdminState.editingType = null;
}

function populatePriceFormSelects() {
    const flavorSelect = document.getElementById('priceFlavor');
    const sizeSelect = document.getElementById('priceSize');
    
    // Popular sabores
    flavorSelect.innerHTML = '<option value="">Selecione um sabor</option>';
    pizzaAdminState.flavors.forEach(flavor => {
        if (flavor.active == 1) {
            flavorSelect.innerHTML += `<option value="${flavor.id}">${flavor.name} (${flavor.category})</option>`;
        }
    });
    
    // Popular tamanhos
    sizeSelect.innerHTML = '<option value="">Selecione um tamanho</option>';
    pizzaAdminState.sizes.forEach(size => {
        if (size.active == 1) {
            sizeSelect.innerHTML += `<option value="${size.id}">${size.name}</option>`;
        }
    });
}

async function savePizzaPrice() {
    const form = document.getElementById('pizzaPriceForm');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    if (!data.flavor_id || !data.size_id || !data.price) {
        showError('Todos os campos são obrigatórios');
        return;
    }
    
    try {
        showLoading();
        const url = CONFIG.API_BASE_URL + 'pizza/flavor-prices';
        const method = pizzaAdminState.editingItem ? 'PUT' : 'POST';
        const finalUrl = pizzaAdminState.editingItem ? `${url}/${pizzaAdminState.editingItem.id}` : url;
        
        const response = await fetch(finalUrl, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        if (result.success) {
            showSuccess(pizzaAdminState.editingItem ? 'Preço atualizado com sucesso!' : 'Preço criado com sucesso!');
            closePizzaPriceModal();
            await loadPizzaAdminData();
        } else {
            showError(result.message || 'Erro ao salvar preço');
        }
    } catch (error) {
        console.error('Erro:', error);
        showError('Erro ao salvar preço');
    } finally {
        hideLoading();
    }
}

function editPizzaPrice(price) {
    console.log('Editando preço:', price);
    showPizzaPriceModal(price);
}

function editPizzaPriceById(id) {
    console.log('Editando preço por ID:', id);
    const price = pizzaAdminState.prices.find(p => p.id == id);
    if (price) {
        showPizzaPriceModal(price);
    } else {
        console.error('Preço não encontrado:', id);
        showError('Preço não encontrado');
    }
}

async function deletePizzaPrice(id) {
    console.log('Excluindo preço ID:', id);
    const price = pizzaAdminState.prices.find(p => p.id == id);
    if (!price) {
        console.error('Preço não encontrado:', id);
        return;
    }
    
    if (confirm(`Tem certeza que deseja excluir o preço do sabor "${price.flavor_name}" para o tamanho "${price.size_name}"?`)) {
        try {
            showLoading();
            const response = await fetch(`${CONFIG.API_BASE_URL}pizza/flavor-prices/${id}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            if (result.success) {
                showSuccess('Preço excluído com sucesso!');
                await loadPizzaAdminData();
            } else {
                showError(result.message || 'Erro ao excluir preço');
            }
        } catch (error) {
            console.error('Erro:', error);
            showError('Erro ao excluir preço');
        } finally {
            hideLoading();
        }
    }
}

// ========================================

function renderPizzaPrices() {
    const tableBody = document.getElementById('pizzaPricesTableBody');
    
    // Verificar se temos dados de preços
    if (!pizzaAdminState.prices || !pizzaAdminState.prices.length) {
        tableBody.innerHTML = `
            <tr class="empty-row">
                <td colspan="5" class="empty-state">
                    <i class="fas fa-dollar-sign"></i>
                    <p>Nenhum preço configurado</p>
                    <button class="btn-add-new" onclick="showPizzaPriceModal()">
                        <i class="fas fa-plus"></i> Configurar Primeiro Preço
                    </button>
                </td>
            </tr>
        `;
        return;
    }
    
    // Aplicar filtros
    let filteredPrices = pizzaAdminState.prices;
    const sizeFilter = document.getElementById('priceSizeFilter')?.value || '';
    const categoryFilter = document.getElementById('priceCategoryFilter')?.value || '';
    
    if (sizeFilter) {
        filteredPrices = filteredPrices.filter(price => price.size_id == sizeFilter);
    }
    if (categoryFilter) {
        filteredPrices = filteredPrices.filter(price => {
            const flavor = pizzaAdminState.flavors.find(f => f.id == price.flavor_id);
            return flavor && flavor.category === categoryFilter;
        });
    }
    
    if (!filteredPrices.length) {
        tableBody.innerHTML = `
            <tr class="empty-row">
                <td colspan="5" class="empty-state">
                    <i class="fas fa-search"></i>
                    <p>Nenhum preço encontrado com os filtros aplicados</p>
                </td>
            </tr>
        `;
        return;
    }
    
    // Popular filtro de tamanhos
    const sizeFilterSelect = document.getElementById('priceSizeFilter');
    if (sizeFilterSelect) {
        sizeFilterSelect.innerHTML = '<option value="">Todos</option>';
        pizzaAdminState.sizes.forEach(size => {
            if (size.active == 1) {
                sizeFilterSelect.innerHTML += `<option value="${size.id}">${size.name}</option>`;
            }
        });
    }
    
    tableBody.innerHTML = filteredPrices.map(price => {
        const flavor = pizzaAdminState.flavors.find(f => f.id == price.flavor_id);
        const size = pizzaAdminState.sizes.find(s => s.id == price.size_id);
        
        return `
            <tr>
                <td>
                    <div class="item-name">
                        <strong>${flavor ? flavor.name : 'Sabor não encontrado'}</strong>
                        <small class="category-text">${flavor ? flavor.category : ''}</small>
                    </div>
                </td>
                <td>
                    <span class="size-badge">${size ? size.name : 'Tamanho não encontrado'}</span>
                </td>
                <td>
                    <span class="price-display">
                        <i class="fas fa-dollar-sign"></i> R$ ${parseFloat(price.price || 0).toFixed(2)}
                    </span>
                </td>
                <td>
                    <span class="category-badge ${flavor ? flavor.category.toLowerCase() : 'default'}">${flavor ? flavor.category : '-'}</span>
                </td>
                <td>
                    <div class="table-actions">
                        <button class="btn-table edit" onclick="editPizzaPriceById(${price.id})" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-table delete" onclick="deletePizzaPrice(${price.id})" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function filterPrices() {
    renderPizzaPrices();
}

// ========================================
// CATEGORY MANAGEMENT FUNCTIONS
// ========================================

// Utilidades para moeda BR
function formatBRLInput(value) {
    const num = typeof value === 'number' ? value : parseBRLToNumber(String(value));
    if (isNaN(num)) return '';
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}

function parseBRLToNumber(str) {
    if (typeof str !== 'string') return 0;
    // remove espaços
    let s = str.trim();
    // remove pontos (milhar) e troca vírgula por ponto
    s = s.replace(/\./g, '').replace(/,/g, '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
}

// Máscara de moeda com entrada em centavos (pt-BR)
function bindBRLCentavosMask(input) {
    if (!input) return;
    const formatFromCents = (cents) => {
        const num = (parseInt(String(cents || '0'), 10) || 0) / 100;
        input.dataset.cents = String(Math.round(num * 100));
        input.value = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
    };

    // Inicialização
    if (!input.dataset.cents) {
        input.dataset.cents = '0';
        formatFromCents(0);
    } else {
        formatFromCents(input.dataset.cents);
    }

    input.addEventListener('keydown', (e) => {
        const allowed = ['Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
        if (allowed.includes(e.key)) return;

        // Digitos
        if (/^[0-9]$/.test(e.key)) {
            e.preventDefault();
            const cur = input.dataset.cents || '0';
            const next = cur === '0' ? e.key : cur + e.key;
            formatFromCents(next);
            return;
        }

        // Backspace / Delete = remove último dígito
        if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault();
            let cur = input.dataset.cents || '0';
            cur = cur.slice(0, -1);
            if (cur.length === 0) cur = '0';
            formatFromCents(cur);
            return;
        }

        // Bloqueia outros caracteres
        e.preventDefault();
    });

    // Garante o cursor no fim ao focar
    input.addEventListener('focus', () => {
        setTimeout(() => {
            input.setSelectionRange(input.value.length, input.value.length);
        }, 0);
    });
}

// (removido) toggleCategoriesView - não há mais grid de categorias

// Função loadCategories removida (duplicata) - usando a versão mais robusta da linha 231

// (removido) renderCategories e contagem por grid

// (removido) loadCategoryProductCounts

/**
 * Mostra o modal de categoria
 */
function showCategoryModal(categoryId = null) {
    const modal = document.getElementById('categoryModal');
    const title = document.getElementById('categoryModalTitle');
    const form = document.getElementById('categoryForm');
    
    if (!modal || !title || !form) {
        showError('Erro: Modal de categoria não encontrado');
        return;
    }
    
    form.reset();
    
    if (categoryId) {
        // Verificar se appState.categories existe
        if (!appState.categories || !Array.isArray(appState.categories)) {
            showError('Erro: Categorias não carregadas. Tente novamente.');
            return;
        }
        
        const category = appState.categories.find(c => c.id == categoryId);
        if (category) {
            title.textContent = 'Editar Categoria';
            document.getElementById('categoryName').value = category.name;
            document.getElementById('categoryDescription').value = category.description || '';
            document.getElementById('categoryOrder').value = category.display_order || 0;
            document.getElementById('categoryActive').checked = category.active;
            form.dataset.categoryId = categoryId;
        } else {
            showError('Categoria não encontrada');
            return;
        }
    } else {
        title.textContent = 'Nova Categoria';
        delete form.dataset.categoryId;
    }
    
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

/**
 * Fecha o modal de categoria
 */
function closeCategoryModal() {
    const modal = document.getElementById('categoryModal');
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

/**
 * Salva a categoria
 */
async function saveCategory() {
    console.log('💾 Iniciando salvamento de categoria...');
    
    const form = document.getElementById('categoryForm');
    if (!form) {
        console.error('❌ Formulário não encontrado');
        showError('Formulário não encontrado');
        return;
    }
    
    const formData = new FormData(form);
    const categoryId = form.dataset.categoryId;
    
    const categoryData = {
        name: formData.get('name'),
        description: formData.get('description'),
        display_order: parseInt(formData.get('display_order')) || 0,
        active: formData.get('active') ? 1 : 0
    };
    
    console.log('📝 Dados da categoria:', categoryData);
    console.log('🆔 ID da categoria (edição):', categoryId);
    
    try {
        showLoading();
        
        const url = categoryId 
            ? CONFIG.API_BASE_URL + `categories/${categoryId}`
            : CONFIG.API_BASE_URL + 'categories';
        
        const method = categoryId ? 'PUT' : 'POST';
        
        console.log('🌐 URL da requisição:', url);
        console.log('📡 Método HTTP:', method);
        console.log('📦 Dados enviados:', JSON.stringify(categoryData));
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(categoryData)
        });
        
        console.log('📥 Response status:', response.status);
        console.log('📥 Response ok:', response.ok);
        
        if (!response.ok) {
            console.error('❌ HTTP Error:', response.status, response.statusText);
            const errorText = await response.text();
            console.error('❌ Response body:', errorText);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('📥 Response data:', data);
        
        if (data.success) {
            console.log('✅ Categoria salva com sucesso!');
            showSuccess(categoryId ? 'Categoria atualizada com sucesso!' : 'Categoria criada com sucesso!');
            closeCategoryModal();
            await loadCategories();
            await loadCategoriesForProducts(); // Recarregar categorias para produtos
            await loadProductsForManagement(); // Recarregar produtos para atualizar filtros
            // Recarregar também a nova seção de produtos se estiver ativa
            if (typeof reloadProdutosAdmin === 'function') {
                reloadProdutosAdmin();
            }
        } else {
            console.error('❌ Erro retornado pela API:', data.message);
            showError(data.message || 'Erro ao salvar categoria');
        }
    } catch (error) {
        console.error('❌ Erro ao salvar categoria:', error);
        console.error('❌ Stack trace:', error.stack);
        showError(`Erro ao salvar categoria: ${error.message}`);
    } finally {
        hideLoading();
    }
}

/**
 * Edita uma categoria
 */
function editCategory(categoryId) {
    showCategoryModal(categoryId);
}

// Editar categoria direto do cabeçalho do acordeão
function editCategoryFromHeader(categoryId, event) {
    if (event) event.stopPropagation();
    showCategoryModal(categoryId);
}

/**
 * Deleta uma categoria
 */
async function deleteCategory(categoryId) {
    // Verificar se appState.categories existe
    if (!appState.categories || !Array.isArray(appState.categories)) {
        showError('Erro: Categorias não carregadas. Tente novamente.');
        return;
    }
    
    const category = appState.categories.find(c => c.id == categoryId);
    if (!category) return;
    
    // Verificar quantos produtos estão nesta categoria
    try {
        // Garantir que o modal de exclusão está carregado
        let modal = document.getElementById('deleteCategoryModal');
        if (!modal && typeof loadModals === 'function') {
            try { await loadModals(); } catch (_) {}
            // pequena espera para o DOM atualizar
            await new Promise(r => setTimeout(r, 100));
            modal = document.getElementById('deleteCategoryModal');
        }

        const response = await fetch(CONFIG.API_BASE_URL + `products?category_id=${categoryId}`);
        const data = await response.json();
        
        if (data.success) {
            const productsCount = data.data.length;
            
            const nameElement = document.getElementById('deleteCategoryName');
            const countContainer = document.getElementById('categoryProductsCount');
            const productsCountElement = document.getElementById('productsInCategory');
            
            if (!modal || !nameElement || !countContainer || !productsCountElement) {
                showError('Modal de exclusão não carregado. Recarregue a página e tente novamente.');
                return;
            }

            nameElement.textContent = category.name;
            
            if (productsCount > 0) {
                countContainer.style.display = 'block';
                productsCountElement.textContent = productsCount;
            } else {
                countContainer.style.display = 'none';
            }
            
            modal.style.display = 'flex';
            modal.dataset.categoryId = categoryId;
            document.body.style.overflow = 'hidden';
        }
    } catch (error) {
        console.error('Erro ao verificar produtos da categoria:', error);
        showError('Erro ao verificar categoria');
    }
}

/**
 * Fecha o modal de exclusão de categoria
 */
function closeDeleteCategoryModal() {
    const modal = document.getElementById('deleteCategoryModal');
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

/**
 * Confirma a exclusão da categoria
 */
async function confirmDeleteCategory() {
    const modal = document.getElementById('deleteCategoryModal');
    const categoryId = modal.dataset.categoryId;
    
    if (!categoryId) return;
    
    try {
        showLoading();
        
        const response = await fetch(CONFIG.API_BASE_URL + `categories/${categoryId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccess('Categoria excluída com sucesso!');
            closeDeleteCategoryModal();
            await loadCategories();
            await loadCategoriesForProducts(); // Recarregar categorias para produtos
            await loadProductsForManagement(); // Recarregar produtos
            // Recarregar também a nova seção de produtos se estiver ativa
            if (typeof reloadProdutosAdmin === 'function') {
                reloadProdutosAdmin();
            }
        } else {
            showError(data.message || 'Erro ao excluir categoria');
        }
    } catch (error) {
        console.error('Erro ao excluir categoria:', error);
        showError('Erro ao excluir categoria');
    } finally {
        hideLoading();
    }
}

// ========================================

window.editPizzaFlavor = editPizzaFlavor;
window.editPizzaFlavorById = editPizzaFlavorById;
window.showPizzaPriceModal = showPizzaPriceModal;
window.closePizzaPriceModal = closePizzaPriceModal;
window.savePizzaPrice = savePizzaPrice;
window.editPizzaPrice = editPizzaPrice;
window.editPizzaPriceById = editPizzaPriceById;
window.deletePizzaPrice = deletePizzaPrice;
window.filterPrices = filterPrices;

// Category functions
window.showCategoryModal = showCategoryModal;
window.closeCategoryModal = closeCategoryModal;
window.saveCategory = saveCategory;
window.editCategory = editCategory;
window.editCategoryFromHeader = editCategoryFromHeader;
window.deleteCategory = deleteCategory;
window.closeDeleteCategoryModal = closeDeleteCategoryModal;
window.confirmDeleteCategory = confirmDeleteCategory;
window.startCategoryDrag = startCategoryDrag;

/**
 * Abre a página completa de produtos e categorias
 */
function openProdutosCategorias() {
    window.open('produtos-categorias.html', '_blank');
}

// Exportar função para uso global
window.openProdutosCategorias = openProdutosCategorias;

function previewImage(event) {
    const reader = new FileReader();
    reader.onload = function() {
        const preview = document.getElementById('preview');
        preview.src = reader.result;
        document.getElementById('imagePreview').style.display = 'block';
    }
    reader.readAsDataURL(event.target.files[0]);
}

function removeImage() {
    const preview = document.getElementById('preview');
    preview.src = '#';
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('productImageUpload').value = '';
    document.getElementById('productImage').value = '';
}

// Expor funções globalmente
window.previewImage = previewImage;
window.removeImage = removeImage;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

/**
 * Função para copiar texto para a área de transferência
 */
function copyToClipboard(elementSelector, messageText) {
    const textToCopy = document.querySelector(elementSelector).innerText;
    
    // Cria uma textarea temporária para executar o comando de cópia
    const textArea = document.createElement('textarea');
    textArea.value = textToCopy;
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        showCopyMessage(messageText);
    } catch (err) {
        console.error('Falha ao copiar texto: ', err);
    }
    document.body.removeChild(textArea);
}

/**
 * Função para mostrar uma mensagem de confirmação
 */
function showCopyMessage(text) {
    const message = document.getElementById('copy-message');
    if (message) {
        message.innerText = text;
        message.classList.remove('opacity-0');
        setTimeout(() => {
            message.classList.add('opacity-0');
        }, 2000); // Mensagem desaparece após 2 segundos
    }
}

/**
 * Função para abrir WhatsApp
 */
function openWhatsApp() {
    const phoneElement = document.getElementById('phone-number');
    if (phoneElement) {
        // Remove caracteres não numéricos e adiciona código do Brasil (55)
        const phoneNumber = '55' + phoneElement.innerText.replace(/\D/g, '');
        const url = `https://wa.me/${phoneNumber}`;
        window.open(url, '_blank');
    }
}

/**
 * Função para abrir Google Maps
 */
function openMaps() {
    const addressElement = document.getElementById('address');
    if (addressElement) {
        const address = addressElement.innerText;
        // Codifica o endereço para ser usado em uma URL
        const encodedAddress = encodeURIComponent(address);
        const url = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
        window.open(url, '_blank');
    }
}

