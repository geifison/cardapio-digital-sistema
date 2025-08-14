/**
 * Sistema de Cardápio Digital
 * JavaScript Principal
 */

// Configurações globais
const CONFIG = {
    API_BASE_URL: 'api/',
    DELIVERY_FEE: 5.00,
    CURRENCY: 'R$',
    REFRESH_INTERVAL: 5000,
    USE_SSE: true,
    STORE_ADDRESS: null, // endereço da loja física (apenas exibido/uso de referência)
    DELIVERY: { ENABLED: true }
};

// Carrega chave pública (se permitido) e prepara Autofill/Confirm
async function maybeInitMapboxAutofill() {
    try {
        const resp = await fetch(CONFIG.API_BASE_URL + 'delivery/public-key');
        if (!resp.ok) return;
        const data = await resp.json();
        if (!data || !data.success || !data.public_key) return;
        const key = data.public_key;
        // injeta script do Mapbox Search JS (Autofill/Confirm) conforme docs
        await injectScriptOnce('https://api.mapbox.com/search-js/v1.1.0/web.js');
        await injectStylesheetOnce('https://api.mapbox.com/search-js/v1.1.0/web.css');
        if (!window.mapboxsearch) return;
        // define accessToken global
        try { window.mapboxsearch.config.accessToken = key; } catch (_) {}
        const { autofill, confirmAddress } = window.mapboxsearch;
        if (autofill && typeof autofill === 'function') {
            try { autofill({}); } catch (_) {}
        }
        if (confirmAddress && typeof confirmAddress === 'function') {
            window.__MapboxConfirmAddress = async function(fullAddress) {
                try { await confirmAddress(fullAddress); } catch (e) { throw e; }
            };
        }
    } catch (_) {}
}

async function injectScriptOnce(src) {
    if (document.querySelector('script[src="' + src + '"]')) return;
    await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
}

async function injectStylesheetOnce(href) {
    if (document.querySelector('link[href="' + href + '"]')) return;
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    document.head.appendChild(l);
}

// Controle de horários de funcionamento (carregado do backend)
let businessHours = null;
let isWithinBusinessHours = true;
// Pausa global de pedidos (carregada do backend)
let isOrdersPaused = false;
let pauseMessage = '';

// Estado global da aplicação
let appState = {
    categories: [],
    products: [],
    cart: [],
    currentCategory: null,
    isCartOpen: false,
    lastSubmittedOrderPayload: null,
    deliveryFee: null,
    deliveryArea: null,
    deliveryDistanceKm: null,
    deliveryCalculating: false
};

// Inicialização da aplicação
document.addEventListener('DOMContentLoaded', function() {
	initializeApp();
});

// ===== Modo POS (embutido no admin) =====
function isPOSMode() {
    try {
        const url = new URL(window.location.href);
        return url.searchParams.get('pos') === '1';
    } catch (_) {
        return false;
    }
}

function getPOSModeParam() {
    try {
        const url = new URL(window.location.href);
        return url.searchParams.get('mode') || 'local';
    } catch (_) {
        return 'local';
    }
}

/**
 * Inicializa a aplicação
 */
async function initializeApp() {
    try {
        await ensureApiBaseUrl();
        await loadBusinessHours();
        await loadPauseState();
        applyBusinessHoursUI();
        applyPauseUI();
        await loadCategories();
        await loadProducts();
        setupEventListeners();
        // Inicializa Mapbox Autofill/Confirm de forma opcional, se habilitado no backend
        try { await maybeInitMapboxAutofill(); } catch (_) {}
        if (CONFIG.USE_SSE && !isPOSMode()) {
            startSSE();
        } else if (!isPOSMode()) {
            startAutoRefresh();
        }
        updateCartDisplay();
        if (isPOSMode()) {
            applyPOSUX();
        }
    } catch (error) {
        console.error('Erro ao inicializar aplicação:', error);
        showError('Erro ao carregar o cardápio. Tente recarregar a página.');
    }
}

// Detecta dinamicamente a BASE da API no frontend (sem quebrar quando o projeto está em subpasta)
async function ensureApiBaseUrl() {
    try {
        const bases = (function(){
            const res = [];
            try { if (CONFIG && CONFIG.API_BASE_URL) res.push(CONFIG.API_BASE_URL); } catch(_) {}
            res.push('/api/');
            try {
                const path = window.location.pathname || '/';
                const p = path.split('/').filter(Boolean);
                if (p.length > 0) res.push('/' + p[0] + '/api/');
                res.push('../api/');
                res.push('../../api/');
            } catch(_) {}
            return Array.from(new Set(res.filter(Boolean)));
        })();
        for (const b of bases) {
            try {
                const r = await fetch(b + 'health');
                if (r.ok) {
                    CONFIG.API_BASE_URL = b;
                    return b;
                }
            } catch(_) { /* tenta próximo */ }
            try {
                const r2 = await fetch(b + 'settings/business-hours');
                if (r2.ok) {
                    CONFIG.API_BASE_URL = b;
                    return b;
                }
            } catch(_) {}
        }
        return CONFIG.API_BASE_URL;
    } catch(_) {
        return CONFIG.API_BASE_URL;
    }
}

async function loadPauseState() {
    try {
        const resp = await fetch(CONFIG.API_BASE_URL + 'settings/pause');
        if (resp.ok) {
            const json = await resp.json();
            if (json && json.success && json.data) {
                isOrdersPaused = !!json.data.paused;
                pauseMessage = String(json.data.message || '');
                return;
            }
        }
    } catch (_) {}
    isOrdersPaused = false;
    pauseMessage = '';
}

async function loadBusinessHours() {
    try {
        const resp = await fetch(CONFIG.API_BASE_URL + 'settings/business-hours');
        if (resp.ok) {
            const json = await resp.json();
            if (json && json.success && json.data) {
                businessHours = json.data;
                isWithinBusinessHours = checkNowWithinBusinessHours(json.data);
                return;
            }
        }
    } catch (_) {}
    businessHours = null;
    isWithinBusinessHours = true; // fallback: não bloquear
}

function checkNowWithinBusinessHours(hours) {
    try {
        const now = new Date();
        const dayIdx = now.getDay(); // 0=Domingo ... 6=Sábado
        const map = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
        const key = map[dayIdx];
        const d = hours[key];
        if (!d || d.closed) return false;
        const [oh, om] = String(d.open).split(':').map(n => parseInt(n, 10));
        const [ch, cm] = String(d.close).split(':').map(n => parseInt(n, 10));
        if ([oh,om,ch,cm].some(v => Number.isNaN(v))) return true;
        // 24h aberto quando 00:00 ~ 00:00
        if (oh === 0 && om === 0 && ch === 0 && cm === 0) return true;
        const minutesNow = now.getHours() * 60 + now.getMinutes();
        const minutesOpen = oh * 60 + om;
        const minutesClose = ch * 60 + cm;
        return minutesNow >= minutesOpen && minutesNow < minutesClose;
    } catch (_) {
        return true;
    }
}

function applyBusinessHoursUI() {
    try {
        const bannerId = 'closedBanner';
        let banner = document.getElementById(bannerId);
        if (!isWithinBusinessHours) {
            if (!banner) {
                banner = document.createElement('div');
                banner.id = bannerId;
                banner.style.background = '#ffe3e3';
                banner.style.color = '#7f1d1d';
                banner.style.padding = '10px 16px';
                banner.style.textAlign = 'center';
                banner.style.fontWeight = '600';
                banner.innerHTML = '<i class="fas fa-clock"></i> Estamos fechados no momento. Consulte nossos horários.';
                const header = document.querySelector('.header') || document.body.firstElementChild;
                document.body.insertBefore(banner, header ? header.nextSibling : document.body.firstChild);
            }
            // Desabilitar botões de adicionar ao carrinho
            document.addEventListener('click', interceptAddToCart, true);
            // Desabilitar botões de checkout
            const checkoutBtns = document.querySelectorAll('.checkout-btn, .btn-checkout');
            checkoutBtns.forEach(btn => btn.disabled = true);
        } else {
            if (banner) banner.remove();
            document.removeEventListener('click', interceptAddToCart, true);
            const checkoutBtns = document.querySelectorAll('.checkout-btn, .btn-checkout');
            checkoutBtns.forEach(btn => btn.disabled = false);
        }
    } catch (_) { /* noop */ }
}

function applyPauseUI() {
    try {
        // Remover overlay antigo, se existir (id legado)
        const legacy = document.getElementById('pauseModalOverlay');
        if (legacy && legacy.parentNode) legacy.parentNode.removeChild(legacy);

        // Garante Tailwind CDN e fonte Inter como no layout fornecido
        ensureTailwindCdnAndInterFont();

        // Cria overlay com o layout EXATO solicitado (Tailwind)
        let overlay = document.getElementById('pause-modal-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'pause-modal-overlay';
            overlay.className = 'fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50';
            overlay.innerHTML = `
                <div id="pause-modal-content" class="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center transform transition-all">
                    <div class="mx-auto mb-5 h-16 w-16 flex items-center justify-center bg-yellow-100 rounded-full">
                        <svg class="h-8 w-8 text-yellow-500" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM8 4a.905.905 0 0 0-.9.995l.35 3.507a.552.552 0 0 0 1.1 0l.35-3.507A.905.905 0 0 0 8 4zm.002 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>
                        </svg>
                    </div>
                    <h2 class="text-2xl font-bold text-gray-900">Pedidos pausados temporariamente</h2>
                    <p class="text-gray-600 mt-3 leading-relaxed">Devido ao grande número de pedidos, estamos temporariamente pausando novas solicitações.</p>
                    <p class="text-gray-500 mt-6 text-sm">Pedimos desculpas pelo transtorno e agradecemos pela preferência.</p>
                </div>`;
            document.body.appendChild(overlay);
        }
        // Garante que o overlay fique acima de qualquer elemento da página
        if (overlay && overlay.style) {
            overlay.style.zIndex = '2147483647'; // topo absoluto
        }

        const checkoutBtn = document.getElementById('proceedToCheckoutBtn');
        if (isOrdersPaused) {
            overlay.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            if (checkoutBtn) checkoutBtn.disabled = true;
            document.addEventListener('click', interceptAddToCart, true);
        } else {
            overlay.style.display = 'none';
            document.body.style.overflow = '';
            if (checkoutBtn) checkoutBtn.disabled = !isWithinBusinessHours ? true : false;
            if (isWithinBusinessHours) {
                document.removeEventListener('click', interceptAddToCart, true);
            }
        }
    } catch (_) { /* noop */ }
}

function ensureTailwindCdnAndInterFont() {
    try {
        // Fonte Inter
        if (!document.querySelector('link[href*="fonts.googleapis.com"][href*="Inter"]')) {
            const link1 = document.createElement('link');
            link1.rel = 'preconnect';
            link1.href = 'https://fonts.googleapis.com';
            document.head.appendChild(link1);
            const link2 = document.createElement('link');
            link2.rel = 'preconnect';
            link2.href = 'https://fonts.gstatic.com';
            link2.crossOrigin = 'anonymous';
            document.head.appendChild(link2);
            const link3 = document.createElement('link');
            link3.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
            link3.rel = 'stylesheet';
            document.head.appendChild(link3);
        }
        // Tailwind CDN
        if (!document.querySelector('script[src*="cdn.tailwindcss.com"]')) {
            const script = document.createElement('script');
            script.src = 'https://cdn.tailwindcss.com';
            document.head.appendChild(script);
        }
        // Aplica família Inter no body, como no layout
        document.body.style.fontFamily = "'Inter', sans-serif";
    } catch (_) { /* noop */ }
}

function interceptAddToCart(e) {
    try {
        if (isWithinBusinessHours && !isOrdersPaused) return;
        const target = e.target;
        const isAddBtn = target.closest && target.closest('.add-to-cart');
        if (isAddBtn) {
            e.stopPropagation();
            e.preventDefault();
            if (isOrdersPaused) {
                alert(pauseMessage && pauseMessage.trim() !== '' ? pauseMessage : 'Pedidos temporariamente pausados.');
            } else {
                alert('Estamos fechados no momento. Por favor, volte dentro do horário de funcionamento.');
            }
        }
    } catch (_) { /* noop */ }
}

/**
 * Atualização automática do cardápio (near real-time)
 */
let autoRefreshTimer = null;
let isRefreshing = false;
function startAutoRefresh() {
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    autoRefreshTimer = setInterval(async () => {
        if (document.hidden || isRefreshing) return;
        // Se SSE está ativo, não fazer polling para evitar "piscadas"
        if (CONFIG.USE_SSE && sseSource) return;
        try {
            isRefreshing = true;
            const previousCategory = appState.currentCategory;
            await loadCategories();
            await loadProducts();
            // Reaplicar filtro atual, se houver
            if (previousCategory !== null) {
                filterByCategory(previousCategory);
            }
        } catch (_) {
            // silencioso
        } finally {
            isRefreshing = false;
        }
    }, CONFIG.REFRESH_INTERVAL);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            // Atualiza imediatamente ao voltar para a aba
            isRefreshing = false;
        }
    });
}

/**
 * Atualização reativa com SSE (sem polling)
 */
let sseSource = null;
let refreshScheduled = false;
let refreshTimerId = null;
async function scheduleRefresh() {
    if (refreshScheduled) return;
    refreshScheduled = true;
    if (refreshTimerId) clearTimeout(refreshTimerId);
    refreshTimerId = setTimeout(async () => {
        try {
            const previousCategory = appState.currentCategory;
            await loadCategories();
            await loadProducts();
            if (previousCategory !== null) {
                filterByCategory(previousCategory);
            }
        } catch (_) {
            // silencioso
        } finally {
            refreshScheduled = false;
            refreshTimerId = null;
        }
    }, 200);
}

function startSSE() {
    try {
        if (sseSource) {
            sseSource.close();
        }
        const url = CONFIG.API_BASE_URL + 'events/stream';
        sseSource = new EventSource(url);

        sseSource.addEventListener('products_updated', () => {
            scheduleRefresh();
        });
        sseSource.addEventListener('categories_updated', () => {
            scheduleRefresh();
        });
        sseSource.addEventListener('pizza_sizes_updated', () => {
            // Atualiza pizza builder com renderização incremental
            scheduleRefresh();
            if (document.getElementById('pizzaBuilderModal')?.classList.contains('show')) {
                // Recarrega dados de pizza apenas quando o modal estiver aberto
                loadPizzaData().then(() => {
                    // Mantém passo atual
                    updatePizzaStep();
                });
            }
        });
        sseSource.addEventListener('pizza_flavors_updated', () => {
            scheduleRefresh();
            if (document.getElementById('pizzaBuilderModal')?.classList.contains('show')) {
                loadPizzaData().then(() => {
                    updatePizzaStep();
                });
            }
        });
        sseSource.addEventListener('pizza_extras_updated', () => {
            scheduleRefresh();
            if (document.getElementById('pizzaBuilderModal')?.classList.contains('show')) {
                loadPizzaData().then(() => {
                    updatePizzaStep();
                });
            }
        });
        sseSource.addEventListener('orders_pause_updated', (evt) => {
            try {
                const data = JSON.parse(evt.data || '{}');
                const payload = data.payload || {};
                if (typeof payload.paused !== 'undefined') {
                    isOrdersPaused = !!payload.paused;
                    pauseMessage = String(payload.message || '');
                    applyPauseUI();
                }
            } catch (_) { /* noop */ }
        });
        sseSource.onmessage = () => {};
        sseSource.onerror = () => {
            // Não fazer fallback imediato para evitar recarregamentos duplos e "piscadas"
            // O EventSource tentará reconectar automaticamente.
        };
    } catch (_) {
        // Mantém a página estável; não aplica fallback imediato
    }
}

/**
 * Carrega as categorias do backend
 */
async function loadCategories() {
    try {
        const response = await fetch(CONFIG.API_BASE_URL + 'categories');
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                // Garante que apenas categorias ativas venham do backend; mas filtra por segurança
                appState.categories = Array.isArray(data.data) ? data.data.filter(c => c.active === 1 || c.active === true) : [];
                renderCategories();
            } else {
                throw new Error(data.message || 'Erro ao carregar categorias');
            }
        } else {
            throw new Error('Erro na requisição das categorias');
        }
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
        // Fallback para dados simulados em caso de erro
        appState.categories = [
            { id: 1, name: 'Lanches', description: 'Hambúrgueres e sanduíches' },
            { id: 2, name: 'Pizzas', description: 'Pizzas tradicionais e especiais' },
            { id: 3, name: 'Bebidas', description: 'Refrigerantes e sucos' },
            { id: 4, name: 'Sobremesas', description: 'Doces e sobremesas' },
            { id: 5, name: 'Pratos Executivos', description: 'Refeições completas' }
        ];
        renderCategories();
    }
}

/**
 * Carrega os produtos do backend
 */
async function loadProducts() {
    try {
        const response = await fetch(CONFIG.API_BASE_URL + 'products?active=true');
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                appState.products = data.data;
                renderProducts();
            } else {
                throw new Error(data.message || 'Erro ao carregar produtos');
            }
        } else {
            throw new Error('Erro na requisição dos produtos');
        }
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        // Fallback para dados simulados em caso de erro
        appState.products = [
            {
                id: 1,
                category_id: 1,
                name: 'X-Burger Clássico',
                description: 'Hambúrguer bovino, queijo, alface, tomate, cebola e molho especial',
                price: 15.90,
                image_url: null,
                is_vegetarian: false,
                is_spicy: false,
                is_gluten_free: false,
                preparation_time: 15
            },
            {
                id: 2,
                category_id: 1,
                name: 'X-Salada',
                description: 'Hambúrguer bovino, queijo, alface, tomate, cebola, ovo e batata palha',
                price: 18.90,
                image_url: null,
                is_vegetarian: false,
                is_spicy: false,
                is_gluten_free: false,
                preparation_time: 15
            },
            {
                id: 3,
                category_id: 1,
                name: 'X-Vegetariano',
                description: 'Hambúrguer de soja, queijo, alface, tomate, cebola e molho especial',
                price: 16.90,
                image_url: null,
                is_vegetarian: true,
                is_spicy: false,
                is_gluten_free: false,
                preparation_time: 12
            },
            {
                id: 4,
                category_id: 2,
                name: 'Pizza Margherita',
                description: 'Molho de tomate, mussarela, manjericão e azeite',
                price: 32.90,
                image_url: null,
                is_vegetarian: true,
                is_spicy: false,
                is_gluten_free: false,
                preparation_time: 25
            },
            {
                id: 5,
                category_id: 2,
                name: 'Pizza Calabresa',
                description: 'Molho de tomate, mussarela, calabresa e cebola',
                price: 35.90,
                image_url: null,
                is_vegetarian: false,
                is_spicy: false,
                is_gluten_free: false,
                preparation_time: 25
            },
            {
                id: 6,
                category_id: 3,
                name: 'Coca-Cola 350ml',
                description: 'Refrigerante de cola gelado',
                price: 4.50,
                image_url: null,
                is_vegetarian: true,
                is_spicy: false,
                is_gluten_free: true,
                preparation_time: 2
            },
            {
                id: 7,
                category_id: 3,
                name: 'Suco de Laranja Natural',
                description: 'Suco natural de laranja 300ml',
                price: 6.90,
                image_url: null,
                is_vegetarian: true,
                is_spicy: false,
                is_gluten_free: true,
                preparation_time: 5
            },
            {
                id: 8,
                category_id: 4,
                name: 'Pudim de Leite',
                description: 'Pudim caseiro com calda de caramelo',
                price: 8.90,
                image_url: null,
                is_vegetarian: true,
                is_spicy: false,
                is_gluten_free: false,
                preparation_time: 5
            }
        ];
        renderProducts();
    }
}

/**
 * Renderiza as categorias na navegação
 */
function renderCategories() {
    const categoriesList = document.getElementById('categoriesList');
    ensureAllCategoriesButton(categoriesList);

    const newMap = new Map();
    appState.categories.forEach(cat => newMap.set(String(cat.id), cat));

    const existingItems = Array.from(categoriesList.querySelectorAll('.category-item[data-category-id]'));
    existingItems.forEach(el => {
        const id = el.dataset.categoryId;
        if (id !== 'all' && !newMap.has(id)) el.remove();
    });

    appState.categories.forEach(category => {
        const id = String(category.id);
        let item = categoriesList.querySelector(`.category-item[data-category-id="${id}"]`);
        if (!item) {
            item = document.createElement('div');
            item.className = 'category-item';
            item.dataset.categoryId = id;
            item.textContent = category.name;
            item.onclick = () => filterByCategory(category.id);
            categoriesList.appendChild(item);
        } else if (item.textContent !== category.name) {
            item.textContent = category.name;
        }
    });
}

function ensureAllCategoriesButton(container) {
    let allBtn = container.querySelector('.category-item[data-category-id="all"]');
    if (!allBtn) {
        allBtn = document.createElement('div');
        allBtn.className = 'category-item active';
        allBtn.dataset.categoryId = 'all';
        allBtn.textContent = 'Todos';
        allBtn.onclick = () => filterByCategory(null);
        container.prepend(allBtn);
    }
}

/**
 * Renderiza os produtos na grade
 */
function renderProducts(filteredProducts = null) {
    const productsGrid = document.getElementById('productsGrid');
    const products = filteredProducts || appState.products;
    renderProductsOptimized(productsGrid, products);
}

/**
 * Cria um card de produto
 */
function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.productId = String(product.id);
    
    const badges = [];
    if (product.is_vegetarian) badges.push('<span class="badge vegetarian">Vegetariano</span>');
    if (product.is_spicy) badges.push('<span class="badge spicy">Picante</span>');
    if (product.is_gluten_free) badges.push('<span class="badge gluten-free">Sem Glúten</span>');
    
    // Determinar o preço a ser exibido
    let displayPrice = product.price;
    let priceLabel = '';
    let showPrice = true;
    
    // Se for produto de pizza gerenciável, usar preço mínimo
    if (product.product_type === 'pizza' && product.min_price > 0) {
        displayPrice = product.min_price;
        priceLabel = '<span class="price-label">A partir de</span>';
    }
    
    // Verificar se deve exibir o preço:
    // category_value é OPCIONAL - se definido (> 0), funciona como controle de exibição
    // se não definido (0 ou null), exibe preço normalmente
    const hasCategoryValue = product.category_value && parseFloat(product.category_value) > 0;
    const hasPrice = displayPrice && parseFloat(displayPrice) > 0;
    
    if (!hasPrice) {
        // Se não tem preço, nunca exibe
        showPrice = false;
    } else if (hasCategoryValue) {
        // Se tem category_value definido, só exibe se também tiver preço
        showPrice = hasPrice;
    } else {
        // Se category_value é 0 ou null, exibe preço normalmente
        showPrice = hasPrice;
    }
    
    card.innerHTML = `
        <div class="product-image">
            ${product.image_url ? 
                `<img src="${product.image_url}" alt="${product.name}">` : 
                '<i class="fas fa-utensils"></i>'
            }
            <div class="product-badges">
                ${badges.join('')}
            </div>
        </div>
        <div class="product-info">
            <h3 class="product-name">${product.name}</h3>
            <p class="product-description">${product.description}</p>
            <div class="product-footer">
                ${showPrice ? `
                    <div class="product-price-container">
                        ${priceLabel}
                        <span class="product-price">${formatCurrency(displayPrice)}</span>
                    </div>
                ` : '<div class="product-price-container"></div>'}
                <button class="add-to-cart" onclick="addToCart(${product.id})">
                    <i class="fas fa-plus"></i>
                    Adicionar
                </button>
            </div>
        </div>
    `;
    
    return card;
}

function renderProductsOptimized(container, products) {
    const fragment = document.createDocumentFragment();
    const newMap = new Map();
    products.forEach(p => newMap.set(String(p.id), p));

    const existingNodes = Array.from(container.querySelectorAll('.product-card'));
    existingNodes.forEach(node => {
        const id = node.dataset.productId;
        if (!newMap.has(id)) {
            node.remove();
        }
    });

    products.forEach(product => {
        const id = String(product.id);
        const existing = container.querySelector(`.product-card[data-product-id="${id}"]`);
        const prev = lastRenderedProducts.get(id);

        if (existing && prev && shallowEqualProduct(prev, product)) {
            return;
        }

        const newCard = createProductCard(product);
        if (existing) {
            container.replaceChild(newCard, existing);
        } else {
            fragment.appendChild(newCard);
        }
    });

    if (fragment.childNodes.length > 0) {
        container.appendChild(fragment);
    }

    lastRenderedProducts = newMap;
}

let lastRenderedProducts = new Map();
function shallowEqualProduct(a, b) {
    if (!a || !b) return false;
    return (
        a.name === b.name &&
        a.description === b.description &&
        String(a.price) === String(b.price) &&
        String(a.min_price || 0) === String(b.min_price || 0) &&
        a.image_url === b.image_url &&
        a.product_type === b.product_type &&
        String(a.category_value || 0) === String(b.category_value || 0) &&
        String(a.is_vegetarian || false) === String(b.is_vegetarian || false) &&
        String(a.is_spicy || false) === String(b.is_spicy || false) &&
        String(a.is_gluten_free || false) === String(b.is_gluten_free || false)
    );
}

/**
 * Filtra produtos por categoria
 */
function filterByCategory(categoryId) {
    appState.currentCategory = categoryId;
    
    // Atualiza visual das categorias
    document.querySelectorAll('.category-item').forEach(item => {
        item.classList.remove('active');
    });
    
    if (categoryId === null) {
        const allBtn = document.querySelector('.category-item[data-category-id="all"]');
        if (allBtn) allBtn.classList.add('active');
        renderProducts();
        return;
    }

    const normalizedCategoryId = String(categoryId);
    const filteredProducts = appState.products.filter(product => String(product.category_id) === normalizedCategoryId);
    renderProducts(filteredProducts);

    const activeItem = document.querySelector(`.category-item[data-category-id="${normalizedCategoryId}"]`);
    if (activeItem) activeItem.classList.add('active');
}

/**
 * Adiciona produto ao carrinho
 */
function addToCart(productId) {
    if (!isWithinBusinessHours || isOrdersPaused) {
        if (isOrdersPaused) {
            showError(pauseMessage && pauseMessage.trim() !== '' ? pauseMessage : 'Pedidos temporariamente pausados.');
        } else {
            showError('Estamos fechados no momento. Por favor, volte dentro do horário de funcionamento.');
        }
        return;
    }
    const product = appState.products.find(p => p.id === productId);
    if (!product) return;
    
    // Verificar se é um produto tipo pizza gerenciável
    // Abrir Pizza Builder quando:
    // - for o produto especial "Monte Sua Pizza"
    // - product_type === 'pizza'
    // - ou quando o backend tiver anexado configurações de pizza (ex.: pizza_sizes/pizza_flavors)
    if (
        product.name === 'Monte Sua Pizza' ||
        String(product.product_type || '').toLowerCase() === 'pizza' ||
        (Array.isArray(product.pizza_sizes) && product.pizza_sizes.length > 0) ||
        (Array.isArray(product.pizza_flavors) && product.pizza_flavors.length > 0)
    ) {
        openPizzaBuilder(product);
        return;
    }
    
    const existingItem = appState.cart.find(item => item.product.id === productId);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        appState.cart.push({
            product: product,
            quantity: 1,
            notes: ''
        });
    }
    
    updateCartDisplay();
    try { animateAddToCart(productId); } catch(_) {}
    showCartAnimation();
}

/**
 * Animação visual: miniatura voando até o carrinho (footer bar)
 */
function animateAddToCart(productId) {
    const productCard = document.querySelector(`.product-card[data-product-id="${productId}"]`);
    const footerBar = document.getElementById('footerCartBar');
    if (!productCard || !footerBar) return;

    const img = productCard.querySelector('.product-image img') || productCard.querySelector('.product-image i');
    if (!img) return;

    const ghost = document.createElement('div');
    ghost.className = 'cart-fly-ghost';
    const rect = img.getBoundingClientRect();
    ghost.style.position = 'fixed';
    ghost.style.left = rect.left + 'px';
    ghost.style.top = rect.top + 'px';
    ghost.style.width = rect.width + 'px';
    ghost.style.height = rect.height + 'px';
    ghost.style.zIndex = '2147483646';
    ghost.style.borderRadius = '12px';
    ghost.style.overflow = 'hidden';
    ghost.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
    ghost.style.transition = 'transform 0.6s cubic-bezier(.2,.8,.2,1), opacity 0.6s ease';
    ghost.style.background = '#fff';

    if (img.tagName.toLowerCase() === 'img') {
        const clone = img.cloneNode(true);
        clone.style.width = '100%';
        clone.style.height = '100%';
        clone.style.objectFit = 'cover';
        ghost.appendChild(clone);
    } else {
        const ic = img.cloneNode(true);
        ic.style.fontSize = '32px';
        ic.style.display = 'flex';
        ic.style.alignItems = 'center';
        ic.style.justifyContent = 'center';
        ic.style.width = '100%';
        ic.style.height = '100%';
        ghost.appendChild(ic);
    }

    document.body.appendChild(ghost);

    const targetRect = footerBar.getBoundingClientRect();
    const toX = targetRect.left + targetRect.width - rect.left - Math.min(60, rect.width);
    const toY = targetRect.top - rect.top + 8;

    requestAnimationFrame(() => {
        ghost.style.transform = `translate(${toX}px, ${toY}px) scale(0.2)`;
        ghost.style.opacity = '0.2';
    });

    setTimeout(() => {
        try { ghost.remove(); } catch(_) {}
    }, 650);
}

/**
 * Remove produto do carrinho
 */
function removeFromCart(productId) {
    appState.cart = appState.cart.filter(item => item.product.id !== productId);
    updateCartDisplay();
}

/**
 * Atualiza quantidade de um item no carrinho
 */
function updateCartItemQuantity(productId, newQuantity) {
    const item = appState.cart.find(item => item.product.id === productId);
    if (!item) return;
    
    if (newQuantity <= 0) {
        removeFromCart(productId);
    } else {
        item.quantity = newQuantity;
        updateCartDisplay();
    }
}

/**
 * Atualiza a exibição do carrinho
 */
function updateCartDisplay() {
    const cartCount = document.getElementById('cartCount');
    const cartItems = document.getElementById('cartItems');
    const cartEmpty = document.getElementById('cartEmpty');
    const cartFooter = document.getElementById('cartFooter');
    const cartSubtotal = document.getElementById('cartSubtotal');
    const deliveryFee = document.getElementById('deliveryFee');
    const cartTotal = document.getElementById('cartTotal');
    // Footer summary elements
    const footerBar = document.getElementById('footerCartBar');
    const footerCount = document.getElementById('footerCartCount');
    const footerSubtotal = document.getElementById('footerCartSubtotal');
    // Suggestion button
    const suggestionBtn = document.getElementById('cartSuggestion');
    const suggestionTextEl = suggestionBtn ? suggestionBtn.querySelector('.suggestion-text') : null;
    
    const totalItems = appState.cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = appState.cart.reduce((sum, item) => {
        // Produtos sem preço não contribuem para o subtotal
        const price = item.product.price && parseFloat(item.product.price) > 0 ? parseFloat(item.product.price) : 0;
        return sum + (price * item.quantity);
    }, 0);
    // No resumo do carrinho (sidebar), a entrega será calculada no checkout
    const total = subtotal;
    
    if (cartCount) cartCount.textContent = totalItems;
    
    if (appState.cart.length === 0) {
        cartEmpty.style.display = 'block';
        cartFooter.style.display = 'none';
        cartItems.innerHTML = '';
        if (footerBar) footerBar.style.display = 'none';
        if (suggestionBtn) suggestionBtn.style.display = 'none';
    } else {
        cartEmpty.style.display = 'none';
        cartFooter.style.display = 'block';
        
        cartItems.innerHTML = '';
        appState.cart.forEach(item => {
            const cartItem = createCartItem(item);
            cartItems.appendChild(cartItem);
        });
        
        if (cartSubtotal) cartSubtotal.textContent = formatCurrency(subtotal);
        if (deliveryFee) deliveryFee.textContent = 'A calcular';
        if (cartTotal) cartTotal.textContent = formatCurrency(total);
        // Atualiza barra do rodapé: mostra apenas subtotal (sem entrega)
        if (footerBar && footerCount && footerSubtotal) {
            footerCount.textContent = totalItems;
            footerSubtotal.textContent = formatCurrency(subtotal);
            footerBar.style.display = 'block';
        }
        // Atualiza sugestão dinâmica
        try { updateSuggestionButton(suggestionBtn, suggestionTextEl); } catch(_) {}
    }
}

/**
 * Atualiza o botão de sugestão com base nas categorias do carrinho/sistema
 */
function updateSuggestionButton(suggestionBtn, textEl) {
    if (!suggestionBtn || !textEl) return;
    const categories = Array.isArray(appState.categories) ? appState.categories : [];
    const products = Array.isArray(appState.products) ? appState.products : [];
    const cart = Array.isArray(appState.cart) ? appState.cart : [];

    const findCategoryIdByName = (name) => {
        const n = String(name || '').toLowerCase();
        const found = categories.find(c => String(c.name || '').toLowerCase() === n);
        return found ? found.id : null;
    };
    const bebidasId = findCategoryIdByName('bebidas');
    const sobremesasId = findCategoryIdByName('sobremesas');

    const hasBebida = bebidasId ? cart.some(ci => String(ci.product.category_id) === String(bebidasId)) : false;
    const hasSobremesa = sobremesasId ? cart.some(ci => String(ci.product.category_id) === String(sobremesasId)) : false;

    // Função para menor preço de uma categoria
    const minPriceInCategory = (catId) => {
        const list = products.filter(p => String(p.category_id) === String(catId) && parseFloat(p.price) > 0);
        if (!list.length) return null;
        return list.reduce((min, p) => Math.min(min, parseFloat(p.price)), parseFloat(list[0].price));
    };

    let label = 'Continuar comprando';
    let action = 'continue';
    if (bebidasId && !hasBebida) {
        const min = minPriceInCategory(bebidasId);
        const priceText = min != null ? formatCurrency(min) : '';
        label = `Adicione uma bebida a partir de ${priceText}`.trim();
        action = 'bebidas';
    } else if (hasBebida && sobremesasId && !hasSobremesa) {
        const min = minPriceInCategory(sobremesasId);
        const priceText = min != null ? formatCurrency(min) : '';
        label = `Adicione uma sobremesa a partir de ${priceText}`.trim();
        action = 'sobremesas';
    } else {
        // se categorias não existirem ou ambas já presentes
        label = 'Continuar comprando';
        action = 'continue';
    }

    textEl.textContent = label;
    suggestionBtn.dataset.action = action;
    suggestionBtn.style.display = 'inline-flex';
}

/**
 * Clique no botão de sugestão
 */
function handleSuggestionClick(btn) {
    if (!btn) return;
    const action = btn.dataset.action || 'continue';
    if (action === 'bebidas' || action === 'sobremesas') {
        // Filtra por categoria correspondente
        const targetName = action === 'bebidas' ? 'bebidas' : 'sobremesas';
        const target = (appState.categories || []).find(c => String(c.name || '').toLowerCase() === targetName);
        if (target) {
            try { filterByCategory(target.id); } catch(_) {}
            // mantém carrinho aberto para ver sugestão? Melhor fechar para visualizar produtos
            closeCart();
        } else {
            // fallback
            closeCart();
        }
    } else {
        // Continuar comprando → levar para a aba geral (Todos)
        try { filterByCategory(null); } catch(_) {}
        closeCart();
    }
}

/**
 * Cria um item do carrinho
 */
function createCartItem(item) {
    const cartItem = document.createElement('div');
    cartItem.className = 'cart-item';
    
    // Verificar se deve exibir o preço (apenas se produto tiver preço)
    const showPrice = item.product.price && parseFloat(item.product.price) > 0;
    
    cartItem.innerHTML = `
        <div class="cart-item-image">
            ${item.product.image_url ? 
                `<img src="${item.product.image_url}" alt="${item.product.name}">` : 
                '<i class="fas fa-utensils"></i>'
            }
        </div>
        <div class="cart-item-info">
            <div class="cart-item-name">${item.product.name}</div>
            ${showPrice ? `<div class="cart-item-price">${formatCurrency(item.product.price)}</div>` : ''}
            <div class="quantity-controls">
                <button class="quantity-btn" onclick="updateCartItemQuantity(${item.product.id}, ${item.quantity - 1})">
                    <i class="fas fa-minus"></i>
                </button>
                <span class="quantity">${item.quantity}</span>
                <button class="quantity-btn" onclick="updateCartItemQuantity(${item.product.id}, ${item.quantity + 1})">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
        </div>
        <button class="remove-item" onclick="removeFromCart(${item.product.id})">
            <i class="fas fa-trash"></i>
        </button>
    `;
    
    return cartItem;
}

/**
 * Alterna a exibição do carrinho
 */
function toggleCart() {
    const cartSidebar = document.getElementById('cartSidebar');
    const cartOverlay = document.getElementById('cartOverlay');
    const footerBar = document.getElementById('footerCartBar');
    
    appState.isCartOpen = !appState.isCartOpen;
    
    if (appState.isCartOpen) {
        cartSidebar.classList.add('open');
        cartOverlay.classList.add('show');
        document.body.style.overflow = 'hidden';
        if (footerBar) footerBar.style.display = 'none';
        try { initCartSwipeGesture(); } catch(_) {}
    } else {
        cartSidebar.classList.remove('open');
        cartOverlay.classList.remove('show');
        document.body.style.overflow = '';
        // Reexibe a barra do rodapé se houver itens
        if (footerBar) {
            const totalItems = appState.cart.reduce((sum, item) => sum + item.quantity, 0);
            if (totalItems > 0) footerBar.style.display = 'block';
        }
    }
}

/**
 * Inicializa gesto de swipe-down para fechar o carrinho (bottom sheet)
 */
function initCartSwipeGesture() {
    const sheet = document.getElementById('cartSidebar');
    if (!sheet || sheet.dataset.swipeInitialized === '1') return;
    const header = sheet.querySelector('.cart-header');
    const content = sheet.querySelector('.cart-content');
    const target = header || sheet;
    const state = { isDragging: false, startY: 0, lastY: 0, lastTime: 0, deltaY: 0, velocity: 0 };

    function getY(e) {
        if (e.touches && e.touches.length) return e.touches[0].clientY;
        if (e.changedTouches && e.changedTouches.length) return e.changedTouches[0].clientY;
        return e.clientY;
    }

    function onStart(e) {
        try {
            // Evita conflito com rolagem interna: só inicia se estiver no topo
            if (content && content.scrollTop > 0) return;
        } catch(_) {}
        state.isDragging = true;
        state.startY = getY(e);
        state.lastY = state.startY;
        state.lastTime = performance.now();
        sheet.style.transition = 'none';
        // Evita rolagem da página durante o gesto
        if (e.cancelable) e.preventDefault();
    }

    function onMove(e) {
        if (!state.isDragging) return;
        const y = getY(e);
        const dy = Math.max(0, y - state.startY);
        state.deltaY = dy;
        const now = performance.now();
        const dt = Math.max(1, now - state.lastTime);
        state.velocity = (y - state.lastY) / dt; // px/ms
        state.lastY = y;
        state.lastTime = now;
        sheet.style.transform = `translateY(${dy}px)`;
        if (e.cancelable) e.preventDefault();
    }

    function onEnd() {
        if (!state.isDragging) return;
        state.isDragging = false;
        sheet.style.transition = 'transform 0.2s ease';
        const closeByDistance = state.deltaY > 120;
        const closeByVelocity = state.velocity > 0.6; // 0.6 px/ms ~ rápido
        if (closeByDistance || closeByVelocity) {
            closeCart();
            sheet.style.transform = '';
        } else {
            sheet.style.transform = '';
        }
    }

    target.addEventListener('touchstart', onStart, { passive: false });
    target.addEventListener('touchmove', onMove, { passive: false });
    target.addEventListener('touchend', onEnd, { passive: true });

    // Marca como inicializado para não duplicar listeners
    sheet.dataset.swipeInitialized = '1';
}

/**
 * Fecha o carrinho (bottom sheet) garantindo estado consistente
 */
function closeCart() {
    try {
        const cartSidebar = document.getElementById('cartSidebar');
        const cartOverlay = document.getElementById('cartOverlay');
        const footerBar = document.getElementById('footerCartBar');
        appState.isCartOpen = false;
        if (cartSidebar) cartSidebar.classList.remove('open');
        if (cartOverlay) cartOverlay.classList.remove('show');
        document.body.style.overflow = '';
        if (footerBar) {
            const totalItems = appState.cart.reduce((sum, item) => sum + item.quantity, 0);
            footerBar.style.display = totalItems > 0 ? 'block' : 'none';
        }
    } catch(_) {}
}

/**
 * Rola até o menu de categorias
 */
function scrollToMenu() {
    const categoriesNav = document.querySelector('.categories-nav');
    categoriesNav.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Procede para o checkout
 */
function proceedToCheckout() {
    if (appState.cart.length === 0) {
        showError('Seu carrinho está vazio!');
        return;
    }
    // Fecha o carrinho/bottom sheet antes de abrir o checkout
    closeCart();

    populateCheckoutModal();
    showCheckoutModal();
}

// Autocomplete de endereço com base na área selecionada (OSM Overpass via backend)
async function setupAddressAutocomplete() {
    const streetInput = document.getElementById('addressStreet');
    const neighInput = document.getElementById('customerNeighborhood');
    if (!streetInput && !neighInput) return;

    // Cria datalists se não existirem
    let streetList = document.getElementById('streetSuggestions');
    if (!streetList) {
        streetList = document.createElement('datalist');
        streetList.id = 'streetSuggestions';
        document.body.appendChild(streetList);
    }
    let neighList = document.getElementById('neighbourhoodSuggestions');
    if (!neighList) {
        neighList = document.createElement('datalist');
        neighList.id = 'neighbourhoodSuggestions';
        document.body.appendChild(neighList);
    }

    try {
        // Autocomplete desativado por remoção do módulo de áreas
        streetList.innerHTML = '';
        neighList.innerHTML = '';
    } catch (_) { /* silencioso */ }
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Popula o modal de checkout com os dados do carrinho
 */
function populateCheckoutModal() {
    const checkoutItems = document.getElementById('checkoutItems');
    const checkoutSubtotal = document.getElementById('checkoutSubtotal');
    const checkoutDeliveryFee = document.getElementById('checkoutDeliveryFee');
    const checkoutTotal = document.getElementById('checkoutTotal');
    const orderTypeRadios = document.querySelectorAll('input[name="orderType"]');
    const balcaoWrapper = document.getElementById('orderTypeBalcaoWrapper');
    const addressSection = document.getElementById('deliveryAddressSection');
    
    const subtotal = appState.cart.reduce((sum, item) => {
        const price = item.product.price && parseFloat(item.product.price) > 0 ? parseFloat(item.product.price) : 0;
        return sum + (price * item.quantity);
    }, 0);
    if (balcaoWrapper) {
        balcaoWrapper.style.display = isPOSMode() ? 'inline-flex' : 'none';
    }
    if (orderTypeRadios && orderTypeRadios.length) {
        const defaultType = isPOSMode() ? 'balcao' : 'delivery';
        let hasChecked = false;
        orderTypeRadios.forEach(r => {
            if (r.value === defaultType) {
                r.checked = true;
                hasChecked = true;
            } else {
                r.checked = false;
            }
        });
        if (!hasChecked) {
            orderTypeRadios[0].checked = true;
        }
    }
    const selectedType = getSelectedOrderType();
    if (addressSection) addressSection.style.display = (selectedType === 'delivery') ? 'block' : 'none';
    const deliveryFeeValue = (selectedType === 'delivery') ? (appState.deliveryFee ?? null) : 0;
    const total = subtotal + ((selectedType === 'delivery') ? (deliveryFeeValue ?? 0) : 0);
    
    checkoutItems.innerHTML = '';
    appState.cart.forEach(item => {
        const checkoutItem = document.createElement('div');
        checkoutItem.className = 'checkout-item';
        const itemPrice = item.product.price && parseFloat(item.product.price) > 0 ? parseFloat(item.product.price) : 0;
        checkoutItem.innerHTML = `
            <span>${item.quantity}x ${item.product.name}</span>
            <span>${formatCurrency(itemPrice * item.quantity)}</span>
        `;
        checkoutItems.appendChild(checkoutItem);
    });
    
    checkoutSubtotal.textContent = formatCurrency(subtotal);
    if (selectedType === 'delivery') {
        checkoutDeliveryFee.textContent = (deliveryFeeValue === null) ? 'A calcular' : formatCurrency(deliveryFeeValue);
    } else {
        checkoutDeliveryFee.textContent = formatCurrency(0);
    }
    checkoutTotal.textContent = formatCurrency(total);
}

/**
 * Exibe o modal de checkout
 */
function showCheckoutModal() {
    const checkoutModal = document.getElementById('checkoutModal');
    checkoutModal.classList.add('show');
    document.body.style.overflow = 'hidden';
    try { attachCheckoutAddressListeners(); } catch (_) {}
    try { maybeInitMapboxAutofill(); } catch (_) {}
    try { initCheckoutWizard(); } catch (_) {}
}

/**
 * Fecha o modal de checkout
 */
function closeCheckoutModal() {
    const checkoutModal = document.getElementById('checkoutModal');
    checkoutModal.classList.remove('show');
    document.body.style.overflow = '';
}

// ===== Checkout Wizard (5 passos) =====
let checkoutCurrentStep = 1;
const CHECKOUT_TOTAL_STEPS = 5;
let checkoutProgressHandlersAttached = false;

function initCheckoutWizard() {
    checkoutCurrentStep = 1;
    updateCheckoutStepUI();
    // Configura rótulo inicial do botão primário
    const primaryBtn = document.getElementById('checkoutPrimaryBtn');
    if (primaryBtn) {
        primaryBtn.innerHTML = '<i class="fas fa-arrow-right"></i> Continuar';
    }
    const backBtn = document.getElementById('checkoutBackBtn');
    if (backBtn) backBtn.disabled = true;
    setupCheckoutProgressClicks();
}

function setupCheckoutProgressClicks() {
    if (checkoutProgressHandlersAttached) return;
    const steps = document.querySelectorAll('#checkoutProgress .progress-step');
    steps.forEach((el) => {
        el.addEventListener('click', () => {
            const target = parseInt(el.getAttribute('data-step'), 10) || 1;
            // Permite apenas voltar para passos anteriores
            if (target < checkoutCurrentStep) {
                checkoutCurrentStep = target;
                updateCheckoutStepUI();
            }
        });
    });
    checkoutProgressHandlersAttached = true;
}

function updateCheckoutStepUI() {
    // Passos de conteúdo
    for (let i = 1; i <= CHECKOUT_TOTAL_STEPS; i++) {
        const stepEl = document.getElementById('checkout-step-' + i);
        if (stepEl) stepEl.classList.toggle('active', i === checkoutCurrentStep);
    }
    // Barra de progresso
    const steps = document.querySelectorAll('#checkoutProgress .progress-step');
    steps.forEach((el) => {
        const stepIndex = parseInt(el.getAttribute('data-step'), 10);
        el.classList.toggle('active', stepIndex === checkoutCurrentStep);
        el.classList.toggle('completed', stepIndex < checkoutCurrentStep);
    });
    // Botões
    const backBtn = document.getElementById('checkoutBackBtn');
    const primaryBtn = document.getElementById('checkoutPrimaryBtn');
    if (backBtn) backBtn.disabled = checkoutCurrentStep === 1;
    if (primaryBtn) {
        if (checkoutCurrentStep < CHECKOUT_TOTAL_STEPS) {
            primaryBtn.innerHTML = '<i class="fas fa-arrow-right"></i> Continuar';
        } else {
            primaryBtn.innerHTML = '<i class="fas fa-check"></i> Confirmar Pedido';
        }
    }
    // Atualiza totais quando entrar nos passos 3-5
    if (checkoutCurrentStep >= 3) {
        populateCheckoutTotalsOnly();
    }
}

function prevCheckoutStep() {
    if (checkoutCurrentStep > 1) {
        checkoutCurrentStep--;
        updateCheckoutStepUI();
    }
}

function nextCheckoutStepOrSubmit() {
    // Validação por passo antes de avançar
    if (!validateCurrentStep()) return;
    if (checkoutCurrentStep < CHECKOUT_TOTAL_STEPS) {
        const orderType = getSelectedOrderType();
        // Se for pular endereço (não-delivery), salta do 2 para o 4
        if (checkoutCurrentStep === 2 && orderType !== 'delivery') {
            checkoutCurrentStep = 4;
        } else {
            checkoutCurrentStep++;
        }
        // Cálculo de entrega quando avançar do passo 3
        if (checkoutCurrentStep === 4) {
            try { verifyDeliveryAreaFromForm(); } catch(_) {}
        }
        updateCheckoutStepUI();
    } else {
        // Último passo: enviar
        submitOrder();
    }
}

function validateCurrentStep() {
    const form = document.getElementById('checkoutForm');
    const fd = new FormData(form);
    const orderType = getSelectedOrderType();
    if (checkoutCurrentStep === 1) {
        // Tipo do pedido: sem validação extra
        return true;
    }
    if (checkoutCurrentStep === 2) {
        if (!hasValue(fd.get('customerName'))) { showError('Informe o nome.'); return false; }
        const phone = (fd.get('customerPhone') || '').trim();
        if (!isValidBrazilPhone(phone)) { showError('Informe um telefone válido (DDD + número).'); return false; }
        return true;
    }
    if (checkoutCurrentStep === 3) {
        if (orderType !== 'delivery') return true;
        const street = fd.get('addressStreet');
        const number = fd.get('addressNumber');
        const neighborhood = fd.get('customerNeighborhood');
        const city = fd.get('addressCity');
        const zip = fd.get('addressZip');
        const reference = fd.get('customerReference');
        if (!hasValue(street) || !hasValue(number) || !hasValue(neighborhood) || !hasValue(city) || !hasValue(zip) || !hasValue(reference)) {
            showError('Preencha todos os campos de endereço obrigatórios.');
            return false;
        }
        if (!isValidBrazilCEP(zip)) {
            showError('CEP inválido. Use o formato 00000-000.');
            return false;
        }
        return true;
    }
    if (checkoutCurrentStep === 4) {
        const paymentMethod = fd.get('paymentMethod');
        if (paymentMethod === 'dinheiro') {
            const paymentValue = parseFloat(fd.get('paymentValue')) || 0;
            const orderTypeLocal = getSelectedOrderType();
            const subtotal = appState.cart.reduce((sum, item) => {
                const price = item.product.price && parseFloat(item.product.price) > 0 ? parseFloat(item.product.price) : 0;
                return sum + (price * item.quantity);
            }, 0);
            const totalAmount = subtotal + (orderTypeLocal === 'delivery' ? (appState.deliveryFee ?? CONFIG.DELIVERY_FEE) : 0);
            if (fd.get('paymentValue') && paymentValue < totalAmount) {
                showError('O valor para pagamento deve ser maior ou igual ao total do pedido.');
                return false;
            }
        }
        return true;
    }
    // Passo 5: sem validação extra aqui
    return true;
}

// ===== Endereço: ViaCEP + verificação de área =====
let addressVerifyTimer = null;
function attachCheckoutAddressListeners() {
    const cepEl = document.getElementById('addressZip');
    const streetEl = document.getElementById('addressStreet');
    const numEl = document.getElementById('addressNumber');
    const neighEl = document.getElementById('customerNeighborhood');
    const cityEl = document.getElementById('addressCity');
    const refEl = document.getElementById('customerReference');
    if (!cepEl || !streetEl || !numEl || !neighEl || !cityEl) return;

    const debouncedVerify = () => {
        if (addressVerifyTimer) clearTimeout(addressVerifyTimer);
        addressVerifyTimer = setTimeout(() => {
            verifyDeliveryAreaFromForm();
        }, 500);
    };

    // ViaCEP quando CEP completo perder foco
    const fillFromViaCEP = async () => {
        const cepDigits = String(cepEl.value || '').replace(/\D/g, '');
        if (cepDigits.length !== 8) return;
        try {
            const resp = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
            const data = await resp.json();
            if (!data || data.erro) return;
            if (streetEl) { streetEl.value = data.logradouro || ''; }
            if (neighEl) { neighEl.value = data.bairro || ''; }
            if (cityEl) { cityEl.value = `${data.localidade || ''} - ${data.uf || ''}`.trim(); }
            // Campos automáticos ficam readonly
            if (streetEl) streetEl.readOnly = true;
            if (neighEl) neighEl.readOnly = true;
            if (cityEl) cityEl.readOnly = true;
        } catch (_) {}
        debouncedVerify();
    };

    // Preenche ao sair do campo CEP ou quando completar 9 chars (00000-000)
    cepEl.addEventListener('blur', fillFromViaCEP);
    cepEl.addEventListener('input', () => {
        const v = String(cepEl.value || '');
        if (v.replace(/\D/g, '').length === 8 && v.length >= 9) {
            fillFromViaCEP();
        }
    });

    [streetEl, numEl, neighEl, cityEl, refEl].forEach(el => {
        if (!el) return;
        el.addEventListener('change', debouncedVerify);
        el.addEventListener('blur', debouncedVerify);
        el.addEventListener('input', debouncedVerify);
    });

    // Máscara leve/normalização da cidade: manter padrão "Cidade - UF"
    if (cityEl) {
        cityEl.addEventListener('input', function(e) {
            const v = String(e.target.value || '').trim();
            // se vier só cidade, tenta preservar; se já tem UF, garante formato XX maiúsculo
            const parts = v.split('-').map(s => s.trim()).filter(Boolean);
            if (parts.length === 2) {
                const city = parts[0];
                const uf = parts[1].slice(0, 2).toUpperCase();
                e.target.value = city + ' - ' + uf;
            }
        });
    }
}

async function verifyDeliveryAreaFromForm() {
	try {
		const orderType = getSelectedOrderType();
		if (orderType !== 'delivery') return;
		const form = document.getElementById('checkoutForm');
		const formData = new FormData(form);
		// Requer rua, número, bairro, cidade e CEP
		const requiredOk = hasValue(formData.get('addressStreet')) && hasValue(formData.get('addressNumber')) && hasValue(formData.get('customerNeighborhood')) && hasValue(formData.get('addressCity')) && hasValue(formData.get('addressZip'));
		if (!requiredOk) {
			appState.deliveryArea = null;
			appState.deliveryFee = null;
			populateCheckoutTotalsOnly();
			return;
		}
		// Calcular frete via API quando habilitado
		if (CONFIG.DELIVERY && CONFIG.DELIVERY.ENABLED) {
			if (appState.deliveryCalculating) return;
			appState.deliveryCalculating = true;
			// feedback visual leve: muda texto para "Calculando..."
			try {
				const el = document.getElementById('checkoutDeliveryFee');
				if (el) el.textContent = 'Calculando...';
			} catch(_) {}
			const payload = {
				zip: String(formData.get('addressZip') || ''),
				street: String(formData.get('addressStreet') || ''),
				number: String(formData.get('addressNumber') || ''),
				neighborhood: String(formData.get('customerNeighborhood') || ''),
				city: String(formData.get('addressCity') || '')
			};
            try {
				const resp = await fetch(CONFIG.API_BASE_URL + 'delivery/quote', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
				const data = await resp.json();
				if (resp.ok && data && data.success) {
					appState.deliveryFee = parseFloat(data.fee);
                    appState.deliveryDistanceKm = (typeof data.distance_km === 'number') ? data.distance_km : null;
					populateCheckoutTotalsOnly();
					return;
				}
			} catch (_) { /* fallback abaixo */ }
			finally { appState.deliveryCalculating = false; }
		}
		// Fallback: taxa padrão
		appState.deliveryArea = null;
		appState.deliveryFee = CONFIG.DELIVERY_FEE;
        appState.deliveryDistanceKm = null;
		populateCheckoutTotalsOnly();
	} catch (_) {
		appState.deliveryArea = null;
		appState.deliveryFee = null;
        appState.deliveryDistanceKm = null;
		populateCheckoutTotalsOnly();
	}
}

/**
 * Submete o pedido
 */
async function submitOrder() {
    const form = document.getElementById('checkoutForm');
    const formData = new FormData(form);
    
    // Validação básica
    if (!validateCheckoutForm(formData)) {
        return;
    }
    const orderType = getSelectedOrderType();
    const isDelivery = orderType === 'delivery';
    const deliveryAddress = isDelivery ? buildDeliveryAddress(formData) : '';

    // Garante cálculo da taxa de entrega antes do envio (sem fallback silencioso)
    let deliveryFeeValue = 0;
    if (isDelivery) {
        try {
            if (appState.deliveryFee === null) {
                const requiredOk = hasValue(formData.get('addressStreet')) && hasValue(formData.get('addressNumber')) && hasValue(formData.get('customerNeighborhood')) && hasValue(formData.get('addressCity')) && hasValue(formData.get('addressZip'));
                if (!requiredOk) {
                    showError('Preencha o endereço completo para calcular a entrega.');
                    return;
                }
                const payload = {
                    zip: String(formData.get('addressZip') || ''),
                    street: String(formData.get('addressStreet') || ''),
                    number: String(formData.get('addressNumber') || ''),
                    neighborhood: String(formData.get('customerNeighborhood') || ''),
                    city: String(formData.get('addressCity') || '')
                };
                const resp = await fetch(CONFIG.API_BASE_URL + 'delivery/quote', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await resp.json();
                if (resp.ok && data && data.success) {
                    appState.deliveryFee = parseFloat(data.fee);
                    appState.deliveryDistanceKm = (typeof data.distance_km === 'number') ? data.distance_km : null;
                    populateCheckoutTotalsOnly();
                } else {
                    showError((data && data.message) ? data.message : 'Não foi possível calcular a taxa de entrega. Verifique o endereço.');
                    return;
                }
            }
            deliveryFeeValue = appState.deliveryFee ?? 0;
        } catch (_) {
            showError('Erro ao calcular a taxa de entrega. Tente novamente.');
            return;
        }
    }
    if (!isDelivery) {
        deliveryFeeValue = 0;
    }

    const orderData = {
        customer_name: formData.get('customerName'),
        customer_phone: formData.get('customerPhone'),
        customer_address: deliveryAddress,
        customer_neighborhood: formData.get('customerNeighborhood'),
        customer_reference: formData.get('customerReference'),
        order_type: orderType,
        payment_method: formData.get('paymentMethod'),
        payment_value: formData.get('paymentValue') || null,
        notes: formData.get('orderNotes'),
        items: appState.cart.map(item => ({
            product_id: item.product.id,
            product_name: item.product.name,
            product_price: item.product.price,
            quantity: item.quantity,
            notes: item.notes
        })),
        subtotal: appState.cart.reduce((sum, item) => {
            const price = item.product.price && parseFloat(item.product.price) > 0 ? parseFloat(item.product.price) : 0;
            return sum + (price * item.quantity);
        }, 0),
        delivery_fee: deliveryFeeValue,
        total_amount: appState.cart.reduce((sum, item) => {
            const price = item.product.price && parseFloat(item.product.price) > 0 ? parseFloat(item.product.price) : 0;
            return sum + (price * item.quantity);
        }, 0) + deliveryFeeValue
    };
    
    // Calcula o troco se necessário
    if (orderData.payment_method === 'dinheiro' && orderData.payment_value) {
        orderData.change_amount = parseFloat(orderData.payment_value) - orderData.total_amount;
    }
    
    try {
        // Se Autofill/Confirm estiver disponível, opcionalmente confirmar endereço antes de enviar
        if (typeof window.__MapboxConfirmAddress === 'function') {
            const form = document.getElementById('checkoutForm');
            const formData = new FormData(form);
            const zip = String(formData.get('addressZip') || '');
            const street = String(formData.get('addressStreet') || '');
            const number = String(formData.get('addressNumber') || '');
            const neighborhood = String(formData.get('customerNeighborhood') || '');
            const city = String(formData.get('addressCity') || '');
            const fullAddress = [street + ', ' + number, neighborhood, city, zip].filter(Boolean).join(' - ');
            try { await window.__MapboxConfirmAddress(fullAddress); } catch (_) { /* segue mesmo assim */ }
        }
        showLoadingOverlay();
        
        // Envia o pedido para a API
        const response = await fetch(CONFIG.API_BASE_URL + 'orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            const orderNumber = data.data.order_number;
            
            hideLoadingOverlay();
            closeCheckoutModal();
            showSuccessModal(orderNumber);
            appState.lastSubmittedOrderPayload = { orderNumber, orderData };
            
            // Limpa o carrinho
            appState.cart = [];
            updateCartDisplay();
            if (appState.isCartOpen) {
                toggleCart();
            }

            // Se POS: notifica o admin
            if (isPOSMode()) {
                // 1) Canal moderno entre abas
                try {
                    const ch = new BroadcastChannel('pos-orders');
                    ch.postMessage({ type: 'posOrderCreated', payload: { orderNumber } });
                    // opcionalmente: ch.close();
                } catch (_) { /* noop */ }

                // 2) Se aberto via iframe
                if (window.parent && window.parent !== window) {
                    try {
                        window.parent.postMessage({ type: 'posOrderCreated', payload: { orderNumber } }, '*');
                    } catch (_) { /* noop */ }
                }

                // 3) Se aberto via window.open
                if (window.opener && !window.opener.closed) {
                    try {
                        window.opener.postMessage({ type: 'posOrderCreated', payload: { orderNumber } }, '*');
                    } catch (_) { /* noop */ }
                    // Fecha a aba/janela do POS quando foi aberta via window.open
                    try {
                        window.close();
                    } catch (_) { /* noop */ }
                }
            }
            
        } else {
            throw new Error(data.message || 'Erro ao processar pedido');
        }
        
    } catch (error) {
        hideLoadingOverlay();
        console.error('Erro ao enviar pedido:', error);
        showError('Erro ao processar pedido: ' + error.message);
    }
}

/**
 * Valida o formulário de checkout
 */
function validateCheckoutForm(formData) {
    const orderType = getSelectedOrderType();
    // Comuns
    if (!hasValue(formData.get('customerName'))) {
        showError('Por favor, preencha o campo Nome.');
        return false;
    }
    const phone = (formData.get('customerPhone') || '').trim();
    if (!isValidBrazilPhone(phone)) {
        showError('Informe um telefone válido (DDD + número).');
        return false;
    }
    // Delivery: validar endereço completo e CEP
    if (orderType === 'delivery') {
        const street = formData.get('addressStreet');
        const number = formData.get('addressNumber');
        const neighborhood = formData.get('customerNeighborhood');
        const city = formData.get('addressCity');
        const zip = formData.get('addressZip');
        const reference = formData.get('customerReference');
        if (!hasValue(street) || !hasValue(number) || !hasValue(neighborhood) || !hasValue(city) || !hasValue(zip) || !hasValue(reference)) {
            showError('Preencha todos os campos de endereço obrigatórios (Rua, Número, Bairro, Cidade, CEP e Referência).');
            return false;
        }
        if (!isValidBrazilCEP(zip)) {
            showError('CEP inválido. Use o formato 00000-000.');
            return false;
        }
    }
    // Retirada/Balcão: não solicita endereço
    
    // Validação específica para pagamento em dinheiro
    const paymentMethod = formData.get('paymentMethod');
    const paymentValue = formData.get('paymentValue');
    const totalAmount = appState.cart.reduce((sum, item) => {
        const price = item.product.price && parseFloat(item.product.price) > 0 ? parseFloat(item.product.price) : 0;
        return sum + (price * item.quantity);
    }, 0) + (orderType === 'delivery' ? (appState.deliveryFee ?? CONFIG.DELIVERY_FEE) : 0);
    
    if (paymentMethod === 'dinheiro' && paymentValue && parseFloat(paymentValue) < totalAmount) {
        showError('O valor para pagamento deve ser maior ou igual ao total do pedido.');
        return false;
    }
    
    return true;
}

/**
 * Retorna o rótulo do campo para mensagens de erro
 */
function getFieldLabel(fieldName) {
    const labels = {
        customerName: 'Nome Completo',
        customerPhone: 'Telefone',
        customerAddress: 'Endereço',
        customerNeighborhood: 'Bairro'
    };
    return labels[fieldName] || fieldName;
}

/**
 * Gera um número de pedido único
 */
function generateOrderNumber() {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `PED${timestamp.toString().slice(-6)}${random.toString().padStart(3, '0')}`;
}

/**
 * Exibe o modal de sucesso
 */
function showSuccessModal(orderNumber) {
    const successModal = document.getElementById('successModal');
    const orderNumberElement = document.getElementById('orderNumber');
    
    orderNumberElement.textContent = orderNumber;
    successModal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

/**
 * Fecha o modal de sucesso
 */
function closeSuccessModal() {
    const successModal = document.getElementById('successModal');
    successModal.classList.remove('show');
    document.body.style.overflow = '';
}

// WhatsApp: Enviar e acompanhar
function openWhatsAppWithOrder() {
    try {
        const payload = appState.lastSubmittedOrderPayload;
        const number = '5571993210590'; // +55 71 99321-0590 (somente dígitos no wa.me)
        if (!payload || !payload.orderData) {
            const url = `https://wa.me/${number}`;
            window.open(url, '_blank');
            return;
        }
        const { orderNumber, orderData } = payload;
        const itemsText = (orderData.items || [])
            .map(it => {
                const qty = it.quantity || 0;
                const unit = parseFloat(it.product_price) || 0;
                const lineSubtotal = unit * qty;
                const linesLocal = [];
                linesLocal.push(`${qty}x ${it.product_name}`);
                if (it.notes && String(it.notes).trim() !== '') {
                    String(it.notes).split(' | ').forEach(part => {
                        const label = part.split(':')[0] || '';
                        const value = part.slice(label.length + 1).trim();
                        if (label && value) {
                            linesLocal.push(`${label.toUpperCase()}: ${value}`);
                        } else {
                            linesLocal.push(part);
                        }
                    });
                }
                linesLocal.push(`Unitário: ${formatCurrency(unit)}`);
                linesLocal.push(`Subtotal: ${formatCurrency(lineSubtotal)}`);
                return linesLocal.join('\n');
            })
            .join('\n\n');
        const subtotalItems = (orderData.items || []).reduce((sum, it) => sum + ((parseFloat(it.product_price) || 0) * (it.quantity || 0)), 0);
        const subtotalText = formatCurrency(orderData.subtotal || subtotalItems || 0);
        const deliveryText = formatCurrency(orderData.delivery_fee || 0);
        const totalText = formatCurrency(orderData.total_amount || 0);
        const typeText = (orderData.order_type === 'delivery') ? 'ENTREGA' : (orderData.order_type === 'retirada' ? 'RETIRADA' : 'BALCÃO');
        const addressText = orderData.order_type === 'delivery' ? (orderData.customer_address || '') : '';
        const changeText = (orderData.payment_method === 'dinheiro' && orderData.payment_value)
            ? `\nTroco: ${formatCurrency(orderData.change_amount || 0)}`
            : '';
        const notesText = orderData.notes ? `\nObservações: ${orderData.notes}` : '';
        const paymentMap = { dinheiro: 'Dinheiro', cartao: 'Cartão', pix: 'PIX' };
        const paymentLabel = paymentMap[String(orderData.payment_method || '').toLowerCase()] || String(orderData.payment_method || '').toUpperCase();
        const lines = [
            `✅ PEDIDO: *#${orderNumber}*`,
            ``,
            `TIPO: ${typeText}`,
            `CLIENTE: ${orderData.customer_name}`,
            `TELEFONE: ${orderData.customer_phone}`,
            ...(orderData.order_type === 'delivery' ? [
                `ENDEREÇO: ${addressText}`,
                (orderData.customer_neighborhood ? `BAIRRO: ${orderData.customer_neighborhood}` : ''),
                (orderData.customer_reference ? `REFERÊNCIA: ${orderData.customer_reference}` : '')
            ] : []),
            ``,
            `${itemsText}`,
            ``,
            `Subtotal Itens: ${subtotalText}`,
            ...(orderData.delivery_fee && orderData.delivery_fee > 0 ? [`Entrega: ${deliveryText}`] : []),
            `*Total: ${totalText}*`,
            ``,
            `Pagamento: ${paymentLabel}${changeText}`,
            `${notesText}`,
            ``,
            `🕐 Tempo estimado: 30 min`
        ].filter(Boolean);
        const text = encodeURIComponent(lines.join('\n'));
        const url = `https://wa.me/${number}?text=${text}`;
        const win = window.open(url, '_blank');
        if (!win || win.closed || typeof win.closed === 'undefined') {
            // Se pop-up for bloqueado, abre no mesmo tab
            window.location.href = url;
        }
    } catch (_) {
        const url = `https://wa.me/5571993210590`;
        const win = window.open(url, '_blank');
        if (!win || win.closed || typeof win.closed === 'undefined') {
            window.location.href = url;
        }
    }
}

// Ajustes de UX quando rodando como POS dentro do admin
function applyPOSUX() {
    try {
        // Evita que o body trave rolamento por conta do admin
        document.body.style.overflow = '';
        // Garante que o carrinho inicie fechado
        if (appState.isCartOpen) toggleCart();
    } catch (_) { /* noop */ }
}

/**
 * Exibe overlay de carregamento
 */
function showLoadingOverlay() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.classList.add('show');
}

/**
 * Oculta overlay de carregamento
 */
function hideLoadingOverlay() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.classList.remove('show');
}

/**
 * Exibe animação do carrinho
 */
function showCartAnimation() {
    const cartCount = document.getElementById('cartCount');
    if (!cartCount) return;
    cartCount.style.animation = 'none';
    setTimeout(() => {
        cartCount.style.animation = 'bounce 0.6s ease-in-out';
    }, 10);
}

/**
 * Configura os event listeners
 */
function setupEventListeners() {
    // Event listener para mudança no método de pagamento
    document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const moneySection = document.getElementById('moneySection');
            if (this.value === 'dinheiro') {
                moneySection.style.display = 'block';
            } else {
                moneySection.style.display = 'none';
                document.getElementById('paymentValue').value = '';
                document.getElementById('changeDisplay').style.display = 'none';
            }
        });
    });
    
    // Event listener para tipo de pedido
    document.querySelectorAll('input[name="orderType"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const addressSection = document.getElementById('deliveryAddressSection');
            const isDelivery = this.value === 'delivery';
            if (addressSection) addressSection.style.display = isDelivery ? 'block' : 'none';
            // Atualiza totais (taxa de entrega somente delivery)
            populateCheckoutTotalsOnly();
        });
    });

    // Event listener para cálculo do troco
    document.getElementById('paymentValue').addEventListener('input', function() {
        const paymentValue = parseFloat(this.value) || 0;
        const orderType = getSelectedOrderType();
        const totalAmount = appState.cart.reduce((sum, item) => {
            const price = item.product.price && parseFloat(item.product.price) > 0 ? parseFloat(item.product.price) : 0;
            return sum + (price * item.quantity);
        }, 0) + (orderType === 'delivery' ? CONFIG.DELIVERY_FEE : 0);
        const changeDisplay = document.getElementById('changeDisplay');
        const changeAmount = document.getElementById('changeAmount');
        
        if (paymentValue > totalAmount) {
            const change = paymentValue - totalAmount;
            changeAmount.textContent = formatCurrency(change);
            changeDisplay.style.display = 'block';
        } else {
            changeDisplay.style.display = 'none';
        }
    });
    
    // Event listener para fechar modais com ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (document.getElementById('checkoutModal').classList.contains('show')) {
                closeCheckoutModal();
            }
            if (document.getElementById('successModal').classList.contains('show')) {
                closeSuccessModal();
            }
            if (appState.isCartOpen) {
                toggleCart();
            }
        }
    });

    // Máscara para telefone brasileiro (DDD + 9 dígitos)
    const phoneInput = document.getElementById('customerPhone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 11) value = value.slice(0, 11);
            let masked = '';
            if (value.length > 0) masked = '(' + value.substring(0, 2);
            if (value.length > 2) {
                if (value.length > 10) {
                    masked += ') ' + value.substring(2, 7) + '-' + value.substring(7, 11);
                } else {
                    masked += ') ' + value.substring(2, 6);
                    if (value.length > 6) masked += '-' + value.substring(6, 10);
                }
            }
            e.target.value = masked;
        });
    }

    // Máscara para CEP brasileiro (XXXXX-XXX)
    const cepInput = document.getElementById('addressZip');
    if (cepInput) {
        cepInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 8) value = value.slice(0, 8);
            let masked = '';
            if (value.length > 0) masked = value.substring(0, 5);
            if (value.length > 5) masked += '-' + value.substring(5, 8);
            e.target.value = masked;
        });
    }
}

function getSelectedOrderType() {
    const el = document.querySelector('input[name="orderType"]:checked');
    return el ? el.value : (isPOSMode() ? 'balcao' : 'delivery');
}

function hasValue(v) {
    return v && String(v).trim() !== '';
}

function isValidBrazilPhone(input) {
    const digits = String(input || '').replace(/\D/g, '');
    // Exige 11 dígitos (DDD + 9 dígitos), com '9' iniciando o número de celular
    if (digits.length !== 11) return false;
    const ddd = parseInt(digits.slice(0, 2), 10);
    if (Number.isNaN(ddd) || ddd < 11 || ddd > 99) return false;
    if (digits[2] !== '9') return false;
    return true;
}

function isValidBrazilCEP(input) {
    // Exige o formato 00000-000
    return /^\d{5}-\d{3}$/.test(String(input || '').trim());
}

function buildDeliveryAddress(formData) {
    const street = (formData.get('addressStreet') || '').trim();
    const number = (formData.get('addressNumber') || '').trim();
    const neighborhood = (formData.get('customerNeighborhood') || '').trim();
    const city = (formData.get('addressCity') || '').trim();
    const zip = (formData.get('addressZip') || '').trim();
    const complement = (formData.get('addressComplement') || '').trim();
    const parts = [
        `${street}, ${number}`,
        neighborhood,
        city,
        zip
    ];
    if (complement) parts.push(`Comp: ${complement}`);
    return parts.filter(Boolean).join(' - ');
}

function populateCheckoutTotalsOnly() {
    const checkoutSubtotal = document.getElementById('checkoutSubtotal');
    const checkoutDeliveryFee = document.getElementById('checkoutDeliveryFee');
    const checkoutTotal = document.getElementById('checkoutTotal');
    const orderType = getSelectedOrderType();
    const subtotal = appState.cart.reduce((sum, item) => {
        const price = item.product.price && parseFloat(item.product.price) > 0 ? parseFloat(item.product.price) : 0;
        return sum + (price * item.quantity);
    }, 0);
    const deliveryFeeValue = (orderType === 'delivery') ? (appState.deliveryFee ?? null) : 0;
    const total = subtotal + ((orderType === 'delivery') ? (deliveryFeeValue ?? 0) : 0);
    if (checkoutSubtotal) checkoutSubtotal.textContent = formatCurrency(subtotal);
    if (checkoutDeliveryFee) {
        if (orderType === 'delivery') {
            checkoutDeliveryFee.textContent = (deliveryFeeValue === null) ? 'A calcular' : formatCurrency(deliveryFeeValue);
            const dist = appState.deliveryDistanceKm;
            if (typeof dist === 'number' && !Number.isNaN(dist)) {
                checkoutDeliveryFee.setAttribute('title', 'Distância estimada: ' + dist.toFixed(2) + ' km');
            } else {
                checkoutDeliveryFee.removeAttribute('title');
            }
        } else {
            checkoutDeliveryFee.textContent = formatCurrency(0);
            checkoutDeliveryFee.removeAttribute('title');
        }
    }
    if (checkoutTotal) checkoutTotal.textContent = formatCurrency(total);
}

/**
 * Formata valor monetário
 */
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

/**
 * Exibe mensagem de erro
 */
function showError(message) {
    // Implementação simples - pode ser melhorada com um sistema de notificações mais sofisticado
    alert(message);
}

/**
 * Exibe mensagem de sucesso
 */
function showSuccess(message) {
    // Implementação simples - pode ser melhorada com um sistema de notificações mais sofisticado
    alert(message);
}



// ===== PIZZA BUILDER FUNCTIONS =====

// Estado do pizza builder
const pizzaBuilderState = {
    currentStep: 1,
    selectedSize: null,
    // Mantém compatibilidade: armazenaremos cada seleção como { id, name, description, category }
    // e controlaremos "partes" por sabor via contador separado
    selectedFlavors: [],
    selectedBorder: null,
    selectedExtras: [],
    sizes: [],
    flavors: [],
    borders: [],
    extras: [],
    currentPrice: 0,
    maxFlavors: 1,
    currentProduct: null // Produto pizza atual sendo personalizado
};

// Controle de partes por sabor (ex.: { [flavorId]: count })
let flavorPartsMap = {};
// Flag para evitar auto-avançar ao voltar para Step 2
let partsChangedInThisStep = false;
// Controle para não duplicar handler de clique da barra de progresso
let pizzaProgressHandlersAttached = false;

// Cores para o círculo da pizza
const PIZZA_COLORS = [
    '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
    '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd'
];

/**
 * Abre o modal do pizza builder
 */
function openPizzaBuilder(product = null) {
    const modal = document.getElementById('pizzaBuilderModal');
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    
    // Armazenar produto atual no estado
    pizzaBuilderState.currentProduct = product;
    
    // Atualizar título do modal com o nome do produto
    const titleElement = document.getElementById('pizzaBuilderTitle');
    if (titleElement && product && product.name) {
        titleElement.textContent = `🍕 ${product.name}`;
    } else {
        titleElement.textContent = '🍕 Monte Sua Pizza';
    }
    
    // Habilitar clique na barra de progresso para voltar em passos concluídos
    setupPizzaProgressClicks();

    // Carregar dados se ainda não foram carregados
    if (pizzaBuilderState.sizes.length === 0) {
        loadPizzaData();
    } else {
        renderPizzaStep1();
    }
}

/**
 * Fecha o modal do pizza builder
 */
function closePizzaBuilder() {
    const modal = document.getElementById('pizzaBuilderModal');
    modal.classList.remove('show');
    document.body.style.overflow = '';
    
    // Resetar estado
    resetPizzaBuilder();
}

/**
 * Carrega todos os dados necessários para o pizza builder
 */
async function loadPizzaData() {
    try {
        // Carregar tamanhos de pizza da API
        try {
            const sizesResponse = await fetch(CONFIG.API_BASE_URL + 'pizza/sizes');
            if (sizesResponse.ok) {
                const sizesData = await sizesResponse.json();
                if (sizesData.success) {
                    pizzaBuilderState.sizes = sizesData.data;
                } else {
                    throw new Error('Erro ao carregar tamanhos');
                }
            } else {
                throw new Error('Erro na requisição de tamanhos');
            }
        } catch (error) {

            // Fallback para dados fixos
            pizzaBuilderState.sizes = [
                { id: 1, name: 'Média', slices: 6, max_flavors: 2, description: 'Pizza média com 6 fatias' },
                { id: 2, name: 'Grande', slices: 8, max_flavors: 2, description: 'Pizza grande com 8 fatias' },
                { id: 3, name: 'Família', slices: 12, max_flavors: 3, description: 'Pizza família com 12 fatias' }
            ];
        }
        
        // Carregar sabores de pizza da API
        try {
            const flavorsResponse = await fetch(CONFIG.API_BASE_URL + 'pizza/flavors');
            if (flavorsResponse.ok) {
                const flavorsData = await flavorsResponse.json();
                if (flavorsData.success) {
                    pizzaBuilderState.flavors = flavorsData.data;
                } else {
                    throw new Error('Erro ao carregar sabores');
                }
            } else {
                throw new Error('Erro na requisição de sabores');
            }
        } catch (error) {

            // Fallback para dados fixos
            pizzaBuilderState.flavors = [
                // Tradicionais
                { id: 1, name: 'Margherita', category: 'tradicional', description: 'Molho de tomate, mussarela e manjericão' },
                { id: 2, name: 'Pepperoni', category: 'tradicional', description: 'Molho de tomate, mussarela e pepperoni' },
                { id: 3, name: 'Quatro Queijos', category: 'tradicional', description: 'Molho de tomate e quatro tipos de queijo' },
                { id: 4, name: 'Calabresa', category: 'tradicional', description: 'Molho de tomate, mussarela e calabresa' },
                { id: 5, name: 'Portuguesa', category: 'tradicional', description: 'Molho de tomate, mussarela, presunto, ovos e azeitonas' },
                
                // Especiais
                { id: 6, name: 'Frango com Catupiry', category: 'especial', description: 'Molho de tomate, mussarela, frango desfiado e catupiry' },
                { id: 7, name: 'Strogonoff', category: 'especial', description: 'Molho de tomate, mussarela, strogonoff de frango' },
                { id: 8, name: 'Bacon', category: 'especial', description: 'Molho de tomate, mussarela e bacon' },
                { id: 9, name: 'Atum', category: 'especial', description: 'Molho de tomate, mussarela e atum' },
                { id: 10, name: 'Carne Seca', category: 'especial', description: 'Molho de tomate, mussarela e carne seca' },
                
                // Doces
                { id: 11, name: 'Chocolate', category: 'doce', description: 'Chocolate ao leite derretido' },
                { id: 12, name: 'Chocolate com Morango', category: 'doce', description: 'Chocolate ao leite e morangos' },
                { id: 13, name: 'Banana com Canela', category: 'doce', description: 'Banana caramelizada com canela' }
            ];
        }
        
        pizzaBuilderState.flavorPrices = [];
        
        pizzaBuilderState.borders = [
            { id: 1, name: 'Tradicional', price: 0.00, description: 'Borda tradicional sem recheio' },
            { id: 2, name: 'Recheada Catupiry', price: 5.00, description: 'Borda recheada com catupiry' },
            { id: 3, name: 'Cheddar', price: 6.00, description: 'Borda recheada com cheddar' },
            { id: 4, name: 'Chocolate', price: 8.00, description: 'Borda recheada com chocolate' }
        ];
        
        pizzaBuilderState.extras = [
            // Queijos
            { id: 1, name: 'Mussarela Extra', category: 'queijos', price: 3.00, description: 'Queijo mussarela adicional' },
            { id: 2, name: 'Catupiry', category: 'queijos', price: 4.00, description: 'Catupiry cremoso' },
            { id: 3, name: 'Parmesão', category: 'queijos', price: 3.50, description: 'Parmesão ralado' },
            
            // Carnes
            { id: 4, name: 'Pepperoni Extra', category: 'carnes', price: 5.00, description: 'Pepperoni adicional' },
            { id: 5, name: 'Bacon', category: 'carnes', price: 4.50, description: 'Bacon crocante' },
            { id: 6, name: 'Frango Desfiado', category: 'carnes', price: 4.00, description: 'Frango desfiado' },
            
            // Vegetais
            { id: 7, name: 'Cebola', category: 'vegetais', price: 2.00, description: 'Cebola caramelizada' },
            { id: 8, name: 'Tomate', category: 'vegetais', price: 1.50, description: 'Tomate fresco' },
            { id: 9, name: 'Pimentão', category: 'vegetais', price: 2.00, description: 'Pimentão colorido' }
        ];

        renderPizzaStep1();
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados do pizza:', error);
        showError('Erro ao carregar dados. Tente novamente.');
    }
}

/**
 * Renderiza o Step 1 - Tamanhos
 */
function renderPizzaStep1() {
    const sizesGrid = document.getElementById('sizesGrid');

    // Se temos um produto específico, usar apenas seus tamanhos
    let availableSizes = pizzaBuilderState.sizes;
    
    if (pizzaBuilderState.currentProduct && pizzaBuilderState.currentProduct.product_type === 'pizza' && pizzaBuilderState.currentProduct.pizza_sizes) {
        // Filtrar apenas os tamanhos disponíveis para este produto
        const productSizeIds = pizzaBuilderState.currentProduct.pizza_sizes.map(ps => ps.id);
        availableSizes = pizzaBuilderState.sizes.filter(size => productSizeIds.includes(size.id));
    }

    // Se não temos tamanhos disponíveis, mostrar todos (fallback para "Monte Sua Pizza")
    if (availableSizes.length === 0) {
        availableSizes = pizzaBuilderState.sizes;
    }

    renderSizeCardsOptimized(sizesGrid, availableSizes);
}

function renderSizeCardsOptimized(container, sizes) {
    const fragment = document.createDocumentFragment();
    const newMap = new Map(sizes.map(s => [String(s.id), s]));

    const existing = Array.from(container.querySelectorAll('.size-card'));
    existing.forEach(node => {
        const id = node.dataset.sizeId;
        if (!newMap.has(id)) node.remove();
    });

    sizes.forEach(size => {
        const id = String(size.id);
        let card = container.querySelector(`.size-card[data-size-id="${id}"]`);
        if (!card) {
            card = document.createElement('div');
            card.className = 'size-card';
            card.dataset.sizeId = id;
            card.addEventListener('click', () => selectPizzaSize(size));
            fragment.appendChild(card);
        }
        card.innerHTML = `
            <div class="size-icon">🍕</div>
            <div class="size-name">${size.name}</div>
            <div class="size-info">
                ${size.slices} fatias • Até ${size.max_flavors} sabor${size.max_flavors > 1 ? 'es' : ''}
            </div>
            <div class="size-description">${size.description}</div>
            <div class="size-price">R$ ${parseFloat(size.price || 0).toFixed(2)}</div>
        `;
    });

    if (fragment.childNodes.length > 0) container.appendChild(fragment);
}

/**
 * Seleciona um tamanho de pizza
 */
function selectPizzaSize(size) {
    document.querySelectorAll('.size-card').forEach(card => {
        card.classList.remove('selected');
    });

    document.querySelector(`[data-size-id="${size.id}"]`).classList.add('selected');
    
    pizzaBuilderState.selectedSize = size;
    pizzaBuilderState.maxFlavors = size.max_flavors;
    
    // Avançar automaticamente para Sabores
    pizzaBuilderState.currentStep = 2;
    updatePizzaStep();
}

/**
 * Avança para o próximo step
 */
function nextPizzaStep() {
    if (pizzaBuilderState.currentStep < 4) {
        pizzaBuilderState.currentStep++;
        updatePizzaStep();
    }
}

/**
 * Volta para o step anterior
 */
function previousPizzaStep() {
    if (pizzaBuilderState.currentStep > 1) {
        pizzaBuilderState.currentStep--;
        // Evita auto-avançar ao retornar ao Step 2
        if (pizzaBuilderState.currentStep === 2) partsChangedInThisStep = false;
        updatePizzaStep();
    }
}

/**
 * Atualiza o step atual
 */
function updatePizzaStep() {
    // Atualizar progress bar
    document.querySelectorAll('.progress-step').forEach((step, index) => {
        step.classList.remove('active', 'completed');
        if (index + 1 === pizzaBuilderState.currentStep) {
            step.classList.add('active');
        } else if (index + 1 < pizzaBuilderState.currentStep) {
            step.classList.add('completed');
        }
    });

    // Esconder todos os steps
    document.querySelectorAll('.pizza-step').forEach(step => {
        step.classList.remove('active');
    });

    // Mostrar step atual
    document.getElementById(`step-${pizzaBuilderState.currentStep}`).classList.add('active');

    // Renderizar conteúdo do step
    switch (pizzaBuilderState.currentStep) {
        case 1:
            renderPizzaStep1();
            // Esconder botão de continuar quando não estiver no passo 2
            const continueBtn = document.getElementById('flavorsContinue');
            if (continueBtn) continueBtn.style.display = 'none';
            break;
        case 2:
            renderPizzaStep2();
            break;
        case 3:
            renderPizzaStep4();
            // Esconder botão de continuar quando não estiver no passo 2
            const continueBtn3 = document.getElementById('flavorsContinue');
            if (continueBtn3) continueBtn3.style.display = 'none';
            break;
        case 4:
            renderPizzaStep5();
            // Esconder botão de continuar quando não estiver no passo 2
            const continueBtn4 = document.getElementById('flavorsContinue');
            if (continueBtn4) continueBtn4.style.display = 'none';
            break;
    }
}

/**
 * Renderiza o Step 2 - Sabores
 */
function renderPizzaStep2() {
    if (!pizzaBuilderState.selectedSize) return;

    document.getElementById('maxFlavors').textContent = pizzaBuilderState.selectedSize.max_flavors;
    document.getElementById('selectedSizeName').textContent = pizzaBuilderState.selectedSize.name;
    document.getElementById('selectedSizeInfo').textContent = 
        `${pizzaBuilderState.selectedSize.slices} fatias • Até ${pizzaBuilderState.selectedSize.max_flavors} sabor${pizzaBuilderState.selectedSize.max_flavors > 1 ? 'es' : ''}`;

    renderPizzaFlavors();
    renderPizzaCircle();
    updateSelectedFlavorsInfo();
    syncPartsCounters();
    // Ao entrar no passo, só auto-avança se o usuário mudar algo
    partsChangedInThisStep = false;
    updateContinueByParts();
}

/**
 * Renderiza os sabores
 */
function renderPizzaFlavors() {
    const flavorsGrid = document.getElementById('flavorsGrid');

    // Se temos um produto específico, usar apenas seus sabores
    let availableFlavors = pizzaBuilderState.flavors;
    
    if (pizzaBuilderState.currentProduct && pizzaBuilderState.currentProduct.product_type === 'pizza' && pizzaBuilderState.currentProduct.pizza_flavors) {
        // Filtrar apenas os sabores disponíveis para este produto
        const productFlavorIds = pizzaBuilderState.currentProduct.pizza_flavors.map(pf => pf.id);
        availableFlavors = pizzaBuilderState.flavors.filter(flavor => productFlavorIds.includes(flavor.id));
    }

    // Se não temos sabores disponíveis, mostrar todos (fallback)
    if (availableFlavors.length === 0) {
        availableFlavors = pizzaBuilderState.flavors;
    }

    renderFlavorCardsOptimized(flavorsGrid, availableFlavors, pizzaBuilderState.selectedSize?.id);

    // Aplicar estado visual (itens já selecionados/numeração e bloqueio ao atingir limite)
    updateFlavorSelectionUI();
}

function renderFlavorCardsOptimized(container, flavors, sizeId) {
    const fragment = document.createDocumentFragment();
    const newMap = new Map(flavors.map(f => [String(f.id), f]));
    const existing = Array.from(container.querySelectorAll('.flavor-card'));
    existing.forEach(node => {
        const id = node.dataset.flavorId;
        if (!newMap.has(id)) node.remove();
    });
    flavors.forEach(flavor => {
        const id = String(flavor.id);
        let card = container.querySelector(`.flavor-card[data-flavor-id="${id}"]`);
        const html = `
            <div class="flavor-name">${flavor.name}</div>
            <div class="flavor-description">${flavor.description}</div>
            <div class="flavor-controls">
                <button type="button" class="flavor-decrease btn-circle btn-muted" data-flavor-id="${id}" aria-label="Diminuir">-</button>
                <span class="flavor-parts" data-flavor-id="${id}">0</span>
                <button type="button" class="flavor-increase btn-circle btn-muted" data-flavor-id="${id}" aria-label="Aumentar">+</button>
                <button type="button" class="flavor-remove btn-circle btn-danger-outline" data-flavor-id="${id}" aria-label="Remover" style="display:none;">×</button>
            </div>
        `;
        if (!card) {
            card = document.createElement('div');
            card.className = 'flavor-card';
            card.dataset.flavorId = id;
            card.dataset.category = flavor.category;
            card.addEventListener('click', () => selectPizzaFlavor(flavor));
            card.innerHTML = html;
            fragment.appendChild(card);
        } else {
            // Atualiza conteúdo apenas se mudar
            if (card.innerHTML !== html) card.innerHTML = html;
        }
    });
    if (fragment.childNodes.length > 0) container.appendChild(fragment);

    // Listeners dos controles
    container.querySelectorAll('.flavor-increase').forEach(btn => btn.addEventListener('click', onIncreaseFlavorPart));
    container.querySelectorAll('.flavor-decrease').forEach(btn => btn.addEventListener('click', onDecreaseFlavorPart));
    container.querySelectorAll('.flavor-remove').forEach(btn => btn.addEventListener('click', onRemoveFlavor));
}

/**
 * Obtém o preço de um sabor para um tamanho específico
 */
function getFlavorPrice(flavorId, sizeId) {
    return 0.00;
}

/**
 * Seleciona um sabor
 */
function selectPizzaFlavor(flavor) {
    // Não usado diretamente; controles +/− cuidam da seleção proporcional por partes
    // Mantemos por compatibilidade caso seja chamado: incrementa 1 parte
    if (!pizzaBuilderState.selectedSize) return;
    const max = pizzaBuilderState.selectedSize.max_flavors;
    const used = getUsedParts();
    if (used >= max) return;
    flavorPartsMap[flavor.id] = (flavorPartsMap[flavor.id] || 0) + 1;
    ensureFlavorInSelection(flavor);
    partsChangedInThisStep = true;
    onPartsChange();
}

/**
 * Gera texto formatado dos sabores selecionados com quantidades
 */
function getFormattedFlavorsText(flavors) {
    // Contar quantidades de cada sabor
    const flavorCounts = {};
    flavors.forEach(flavor => {
        flavorCounts[flavor.name] = (flavorCounts[flavor.name] || 0) + 1;
    });
    
    // Criar texto com quantidades
    const flavorTexts = [];
    for (const [name, count] of Object.entries(flavorCounts)) {
        if (count > 1) {
            flavorTexts.push(`${name} (${count}x)`);
        } else {
            flavorTexts.push(name);
        }
    }
    
    return flavorTexts.join(', ');
}

/**
 * Atualiza o contador visual de um sabor
 */
function updateFlavorCounter(flavorCard, flavorId) {
    // Contar quantas vezes este sabor foi selecionado
    const flavorCount = pizzaBuilderState.selectedFlavors.filter(f => f.id === flavorId).length;
    
    // Remove contador anterior se existir
    const existingCounter = flavorCard.querySelector('.flavor-counter');
    if (existingCounter) {
        existingCounter.remove();
    }
    
    // Adiciona novo contador se quantidade > 1
    if (flavorCount > 1) {
        const counter = document.createElement('div');
        counter.className = 'flavor-counter';
        counter.textContent = `${flavorCount}x`;
        flavorCard.appendChild(counter);
    }
}

// Atualiza UI dos cards de sabor (numeração e bloqueio quando atingir limite)
function updateFlavorSelectionUI() {
    const max = pizzaBuilderState.selectedSize ? pizzaBuilderState.selectedSize.max_flavors : pizzaBuilderState.maxFlavors;
    const selectedIds = Object.keys(flavorPartsMap).filter(id => flavorPartsMap[id] > 0).map(id => parseInt(id, 10));
    
    // Atualiza cada card
    document.querySelectorAll('.flavor-card').forEach(card => {
        const id = parseInt(card.dataset.flavorId, 10);
        const selectedIndex = selectedIds.indexOf(id);
        
        // Remover badge anterior, se existir
        const prevBadge = card.querySelector('.selection-badge');
        if (prevBadge) prevBadge.remove();
        
        if (selectedIndex !== -1) {
            card.classList.add('selected');
            const badge = document.createElement('div');
            badge.className = 'selection-badge';
            badge.textContent = String(selectedIndex + 1);
            card.appendChild(badge);
        } else {
            card.classList.remove('selected');
        }
    });
    
    // Bloquear não selecionados quando atingir o limite
    const reachedMax = getUsedParts() >= max;
    document.querySelectorAll('.flavor-card').forEach(card => {
        if (card.classList.contains('selected')) {
            card.classList.remove('disabled');
        } else {
            if (reachedMax) card.classList.add('disabled');
            else card.classList.remove('disabled');
        }
    });
}

function updateSelectedFlavorsInfo() {
    const infoEl = document.getElementById('flavorsInfo');
    if (!infoEl) return;
    const max = pizzaBuilderState.selectedSize ? pizzaBuilderState.selectedSize.max_flavors : 1;
    
    const selectedText = pizzaBuilderState.selectedFlavors.length > 0 
        ? ` - Selecionados: ${getFormattedFlavorsText(pizzaBuilderState.selectedFlavors)}` 
        : '';
    
    infoEl.innerHTML = `Selecione até <span id="maxFlavors">${max}</span> sabor${max > 1 ? 'es' : ''} - Você pode selecionar o mesmo sabor múltiplas vezes${selectedText}`;
}

/**
 * Renderiza o círculo da pizza
 */
function renderPizzaCircle() {
    const pizzaCircle = document.getElementById('pizzaCircle');
    
    const totalParts = getUsedParts();
    if (totalParts === 0) {
        pizzaCircle.style.background = '#f8f9fa';
        return;
    }
    let gradient = 'conic-gradient(';
    let currentAngle = 0;
    const partsEntries = Object.entries(flavorPartsMap).filter(([, count]) => count > 0);
    partsEntries.forEach(([flavorId, count], idx) => {
        const proportion = count / totalParts;
        const angle = proportion * 360;
        const color = PIZZA_COLORS[idx % PIZZA_COLORS.length];
        gradient += `${color} ${currentAngle}deg ${currentAngle + angle}deg`;
        currentAngle += angle;
        if (idx < partsEntries.length - 1) gradient += ', ';
    });
    gradient += ')';
    pizzaCircle.style.background = gradient;
}

/**
 * Renderiza o Step 3 - Bordas
 */
// Step 3 (Borda) removido

/**
 * Seleciona uma borda
 */
function selectPizzaBorder(border) {
    document.querySelectorAll('.border-card').forEach(card => {
        card.classList.remove('selected');
    });

    document.querySelector(`[data-border-id="${border.id}"]`).classList.add('selected');
    
    pizzaBuilderState.selectedBorder = border;
    document.getElementById('nextStep3').disabled = false;
}

/**
 * Renderiza o Step 4 - Adicionais
 */
function renderPizzaStep4() {
    const extrasGrid = document.getElementById('extrasGrid');
    renderExtraCardsOptimized(extrasGrid, pizzaBuilderState.extras);
}

function renderExtraCardsOptimized(container, extras) {
    const fragment = document.createDocumentFragment();
    const newMap = new Map(extras.map(e => [String(e.id), e]));
    const existing = Array.from(container.querySelectorAll('.extra-card'));
    existing.forEach(node => {
        const id = node.dataset.extraId;
        if (!newMap.has(id)) node.remove();
    });
    extras.forEach(extra => {
        const id = String(extra.id);
        let card = container.querySelector(`.extra-card[data-extra-id="${id}"]`);
        const html = `
            <div class="extra-name">${extra.name}</div>
            <div class="extra-description">${extra.description}</div>
            <div class="extra-price">+ R$ ${extra.price.toFixed(2)}</div>
        `;
        if (!card) {
            card = document.createElement('div');
            card.className = 'extra-card';
            card.dataset.extraId = id;
            card.dataset.category = extra.category;
            card.addEventListener('click', () => selectPizzaExtra(extra));
            card.innerHTML = html;
            fragment.appendChild(card);
        } else {
            if (card.innerHTML !== html) card.innerHTML = html;
        }
    });
    if (fragment.childNodes.length > 0) container.appendChild(fragment);
}

/**
 * Seleciona um adicional
 */
function selectPizzaExtra(extra) {
    const extraCard = document.querySelector(`[data-extra-id="${extra.id}"]`);
    
    if (extraCard.classList.contains('selected')) {
        extraCard.classList.remove('selected');
        pizzaBuilderState.selectedExtras = pizzaBuilderState.selectedExtras.filter(e => e.id !== extra.id);
    } else {
        extraCard.classList.add('selected');
        pizzaBuilderState.selectedExtras.push(extra);
    }
}

/**
 * Renderiza o Step 5 - Resumo
 */
async function renderPizzaStep5() {
    await calculatePizzaPrice();
    
    document.getElementById('summarySize').textContent = pizzaBuilderState.selectedSize.name;
    document.getElementById('summaryFlavors').textContent = getFormattedFlavorsTextByParts();
    
    if (pizzaBuilderState.selectedExtras.length > 0) {
        document.getElementById('summaryExtrasContainer').style.display = 'block';
        document.getElementById('summaryExtras').textContent = pizzaBuilderState.selectedExtras.map(e => e.name).join(', ');
    } else {
        document.getElementById('summaryExtrasContainer').style.display = 'none';
    }
    
    document.getElementById('summaryPrice').textContent = `R$ ${pizzaBuilderState.currentPrice.toFixed(2)}`;
    renderPizzaPreview();
}

/**
 * Calcula o preço da pizza
 */
async function calculatePizzaPrice() {
    try {
        const response = await fetch(CONFIG.API_BASE_URL + 'pizza/calculate-price', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
                body: JSON.stringify({
                size_id: pizzaBuilderState.selectedSize.id,
                flavor_ids: pizzaBuilderState.selectedFlavors.map(f => f.id),
                border_id: pizzaBuilderState.selectedBorder ? pizzaBuilderState.selectedBorder.id : null,
                extra_ids: pizzaBuilderState.selectedExtras.map(e => e.id)
            })
        });

        const data = await response.json();
        
        if (data.success) {
            pizzaBuilderState.currentPrice = data.data.pricing.total_price;
            

        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        calculatePizzaPriceLocally();
    }
}

/**
 * Calcula preço localmente (fallback)
 */
function calculatePizzaPriceLocally() {
    let totalPrice = 0;
    
    // 1. Preço do tamanho (base)
    if (pizzaBuilderState.selectedSize && pizzaBuilderState.selectedSize.price) {
        totalPrice += parseFloat(pizzaBuilderState.selectedSize.price);
    }
    // 2. Adicional proporcional por sabor (placeholder: se houver tabelas futuras)
    // Mantemos compatível com a lógica atual: sem acréscimos por sabor por padrão
    // 3. Preço da borda (se selecionada)
    if (pizzaBuilderState.selectedBorder && pizzaBuilderState.selectedBorder.price) {
        totalPrice += parseFloat(pizzaBuilderState.selectedBorder.price);
    }
    
    // 4. Preço dos extras (somar todos os extras selecionados)
    pizzaBuilderState.selectedExtras.forEach(extra => {
        if (extra.price) {
            totalPrice += parseFloat(extra.price);
        }
    });
    
    pizzaBuilderState.currentPrice = totalPrice;
}

/**
 * Renderiza preview da pizza
 */
function renderPizzaPreview() {
    const pizzaPreview = document.getElementById('pizzaPreview');
    
    const totalParts = getUsedParts();
    if (totalParts === 0) {
        pizzaPreview.style.background = '#f8f9fa';
        return;
    }
    let gradient = 'conic-gradient(';
    let currentAngle = 0;
    const partsEntries = Object.entries(flavorPartsMap).filter(([, count]) => count > 0);
    partsEntries.forEach(([flavorId, count], idx) => {
        const proportion = count / totalParts;
        const angle = proportion * 360;
        const color = PIZZA_COLORS[idx % PIZZA_COLORS.length];
        gradient += `${color} ${currentAngle}deg ${currentAngle + angle}deg`;
        currentAngle += angle;
        if (idx < partsEntries.length - 1) gradient += ', ';
    });
    gradient += ')';
    pizzaPreview.style.background = gradient;
}

/**
 * Adiciona pizza ao carrinho
 */
function addPizzaToCart() {
    try {
        // Calcula preço localmente (mais confiável que API neste fluxo)
        calculatePizzaPriceLocally();

        // Usar nome do produto atual ou "Monte Sua Pizza" como fallback
        const baseProductName = pizzaBuilderState.currentProduct 
            ? pizzaBuilderState.currentProduct.name 
            : 'Monte Sua Pizza';
        
        const productName = `${baseProductName} - ${pizzaBuilderState.selectedSize.name}`;
        const observations = (document.getElementById('pizzaObservations')?.value || '').trim();
        const prefs = Array.from(document.querySelectorAll('.pizza-pref:checked')).map(el => el.value);
        const notesParts = [];
        notesParts.push(`Sabores: ${getFormattedFlavorsTextByParts()}`);
        if (pizzaBuilderState.selectedExtras.length > 0) notesParts.push(`Adicionais: ${pizzaBuilderState.selectedExtras.map(e => e.name).join(', ')}`);
        if (prefs.length > 0) notesParts.push(`Preferências: ${prefs.join(', ')}`);
        if (observations) notesParts.push(`Observações: ${observations}`);
        const notes = notesParts.join(' | ');

        const cartItem = {
            product: {
                id: pizzaBuilderState.currentProduct ? pizzaBuilderState.currentProduct.id : -Date.now(), // Usar ID do produto ou sintético
                name: productName,
                price: pizzaBuilderState.currentPrice,
                image_url: pizzaBuilderState.currentProduct ? pizzaBuilderState.currentProduct.image_url : null
            },
            quantity: 1,
            notes
        };

        appState.cart.push(cartItem);
        updateCartDisplay();
        showCartAnimation();

        // Mostra modal de sucesso central para pizza
        showPizzaAddSuccessModal();
    } catch (error) {
        showError('Erro ao adicionar ao carrinho. Tente novamente.');
    }
}

/**
 * Atualiza a exibição do botão de continuar
 */
function updateContinueButton() {
    const continueBtn = document.getElementById('flavorsContinue');
    if (!continueBtn) return;
    
    // Mostrar botão se pelo menos 1 sabor selecionado e não atingiu o máximo
    if (pizzaBuilderState.selectedFlavors.length > 0 && 
        pizzaBuilderState.selectedFlavors.length < pizzaBuilderState.maxFlavors) {
        continueBtn.style.display = 'block';
    } else {
        continueBtn.style.display = 'none';
    }
}

/**
 * Continua do passo de sabores manualmente
 */
function continueFromFlavors() {
    if (pizzaBuilderState.selectedFlavors.length === 0) {
        showError('Selecione pelo menos um sabor para continuar');
        return;
    }
    
    // Ir para o próximo passo
    pizzaBuilderState.currentStep = 3;
    updatePizzaStep();
}

/**
 * Reseta o estado do pizza builder
 */
function resetPizzaBuilder() {
    pizzaBuilderState.currentStep = 1;
    pizzaBuilderState.selectedSize = null;
    pizzaBuilderState.selectedFlavors = [];
    pizzaBuilderState.selectedBorder = null;
    pizzaBuilderState.selectedExtras = [];
    pizzaBuilderState.currentPrice = 0;
    pizzaBuilderState.maxFlavors = 1;
    pizzaBuilderState.currentProduct = null;
    flavorPartsMap = {};
    
    // Esconder botão de continuar
    const continueBtn = document.getElementById('flavorsContinue');
    if (continueBtn) {
        continueBtn.style.display = 'none';
    }
    
    updatePizzaStep();
}

// ======= Helpers de Partes e Controles =======
function getUsedParts() {
    return Object.values(flavorPartsMap).reduce((sum, n) => sum + (parseInt(n, 10) || 0), 0);
}

function ensureFlavorInSelection(flavor) {
    if (!pizzaBuilderState.selectedFlavors.some(f => f.id === flavor.id)) {
        pizzaBuilderState.selectedFlavors.push({ id: flavor.id, name: flavor.name, description: flavor.description, category: flavor.category });
    }
}

function syncPartsCounters() {
    const used = getUsedParts();
    const max = pizzaBuilderState.selectedSize ? pizzaBuilderState.selectedSize.max_flavors : 0;
    const usedEl = document.getElementById('usedPartsCounter');
    const totalEl = document.getElementById('totalPartsCounter');
    if (usedEl) usedEl.textContent = String(used);
    if (totalEl) totalEl.textContent = String(max);
    // Atualiza spans nos cards
    document.querySelectorAll('.flavor-parts').forEach(span => {
        const id = parseInt(span.dataset.flavorId, 10);
        span.textContent = String(flavorPartsMap[id] || 0);
    });
    // Mostra/esconde botão remover
    document.querySelectorAll('.flavor-remove').forEach(btn => {
        const id = parseInt(btn.dataset.flavorId, 10);
        btn.style.display = (flavorPartsMap[id] || 0) > 0 ? 'inline-flex' : 'none';
    });
}

function onPartsChange() {
    // Remover sabores com 0 partes do array de seleção
    pizzaBuilderState.selectedFlavors = pizzaBuilderState.selectedFlavors.filter(f => (flavorPartsMap[f.id] || 0) > 0);
    updateFlavorSelectionUI();
    renderPizzaCircle();
    renderPizzaPreview();
    updateSelectedFlavorsInfo();
    syncPartsCounters();
    updateContinueByParts();
}

function onIncreaseFlavorPart(e) {
    e.stopPropagation();
    const id = parseInt(e.currentTarget.dataset.flavorId, 10);
    const flavor = (pizzaBuilderState.flavors || []).find(f => f.id === id);
    if (!flavor || !pizzaBuilderState.selectedSize) return;
    const max = pizzaBuilderState.selectedSize.max_flavors;
    if (getUsedParts() >= max) return;
    flavorPartsMap[id] = (flavorPartsMap[id] || 0) + 1;
    ensureFlavorInSelection(flavor);
    partsChangedInThisStep = true;
    onPartsChange();
}

function onDecreaseFlavorPart(e) {
    e.stopPropagation();
    const id = parseInt(e.currentTarget.dataset.flavorId, 10);
    if (!flavorPartsMap[id]) return;
    flavorPartsMap[id] = Math.max(0, (flavorPartsMap[id] || 0) - 1);
    onPartsChange();
}

function onRemoveFlavor(e) {
    e.stopPropagation();
    const id = parseInt(e.currentTarget.dataset.flavorId, 10);
    flavorPartsMap[id] = 0;
    onPartsChange();
}

function updateContinueByParts() {
    const max = pizzaBuilderState.selectedSize ? pizzaBuilderState.selectedSize.max_flavors : 0;
    const used = getUsedParts();
    // Avanço imediato ao completar as partes
    if (used === max && max > 0 && partsChangedInThisStep) {
        pizzaBuilderState.currentStep = 3;
        updatePizzaStep();
        partsChangedInThisStep = false;
    }
}

function getFormattedFlavorsTextByParts() {
    const partsEntries = Object.entries(flavorPartsMap).filter(([, count]) => count > 0);
    if (partsEntries.length === 0) return '-';
    const byName = partsEntries.map(([id, count]) => {
        const fl = (pizzaBuilderState.flavors || []).find(f => f.id === parseInt(id, 10));
        if (!fl) return null;
        return `${fl.name} (${count}x)`;
    }).filter(Boolean);
    return byName.join(', ');
}

// ===== Modal de Sucesso Pizza =====
function showPizzaAddSuccessModal() {
    const overlay = document.getElementById('pizzaAddSuccess');
    if (!overlay) return;
    overlay.classList.add('show');
    // Botões
    const continueBtn = document.getElementById('btnContinueShopping');
    const goToCartBtn = document.getElementById('btnGoToCart');
    if (continueBtn) {
        continueBtn.onclick = () => {
            overlay.classList.remove('show');
            // Fechar builder e manter fluxo normal
            closePizzaBuilder();
        };
    }
    if (goToCartBtn) {
        goToCartBtn.onclick = () => {
            overlay.classList.remove('show');
            closePizzaBuilder();
            if (!appState.isCartOpen) toggleCart();
        };
    }
}

// Permite clicar em passos concluídos da barra de progresso para voltar
function setupPizzaProgressClicks() {
    if (pizzaProgressHandlersAttached) return;
    const container = document.querySelector('.pizza-progress');
    if (!container) return;
    container.addEventListener('click', (e) => {
        const stepEl = e.target.closest('.progress-step');
        if (!stepEl) return;
        const targetStep = parseInt(stepEl.dataset.step, 10);
        if (Number.isNaN(targetStep)) return;
        // Só permite voltar para passos anteriores já concluídos
        if (stepEl.classList.contains('completed') && targetStep < pizzaBuilderState.currentStep) {
            pizzaBuilderState.currentStep = targetStep;
            partsChangedInThisStep = false;
            updatePizzaStep();
        }
    });
    pizzaProgressHandlersAttached = true;
}


// ===== Persistência do Último Pedido (localStorage) + Repetição com 1 clique =====
(function() {
	const LAST_ORDER_STORAGE_KEY = 'cds:lastOrderV1';

	function ensureRepeatLastOrderStyles() {
		try {
			if (document.getElementById('repeat-last-order-style')) return;
			const style = document.createElement('style');
			style.id = 'repeat-last-order-style';
			style.textContent = `
#repeatLastOrderTopArea{display:flex;justify-content:center;margin:16px 0}
#repeatLastOrderTopArea .btn-repeat-last-order{appearance:none;background:#f8fafc;border:1px solid #e5e7eb;color:#111827;padding:10px 16px;border-radius:9999px;font-weight:600;display:inline-flex;align-items:center;gap:8px;cursor:pointer;transition:background .2s,border-color .2s,transform .05s}
#repeatLastOrderTopArea .btn-repeat-last-order:hover{background:#f1f5f9;border-color:#d1d5db}
#repeatLastOrderTopArea .btn-repeat-last-order:active{transform:translateY(1px)}
#repeatLastOrderTopArea .btn-repeat-last-order i{font-size:14px}
			`;
			document.head.appendChild(style);
		} catch(_) { /* noop */ }
	}

	function saveLastOrderToLocalStorage(payload, rawFormValues) {
		try {
			if (!payload || !payload.orderData) return;
			const od = payload.orderData;
			const snapshot = {
				timestamp: Date.now(),
				orderNumber: payload.orderNumber || null,
				order: {
					customer_name: od.customer_name || '',
					customer_phone: od.customer_phone || '',
					order_type: od.order_type || 'delivery',
					payment_method: od.payment_method || 'dinheiro',
					payment_value: od.payment_value || null,
					customer_address: od.customer_address || '',
					customer_neighborhood: od.customer_neighborhood || '',
					customer_reference: od.customer_reference || '',
					items: Array.isArray(od.items) ? od.items.map(it => ({
						product_id: it.product_id,
						product_name: it.product_name,
						product_price: it.product_price,
						quantity: it.quantity,
						notes: it.notes || ''
					})) : [],
					subtotal: od.subtotal || 0,
					delivery_fee: od.delivery_fee || 0,
					total_amount: od.total_amount || 0,
					__rawAddress: rawFormValues || null
				}
			};
			localStorage.setItem(LAST_ORDER_STORAGE_KEY, JSON.stringify(snapshot));
		} catch (_) { /* noop */ }
	}

	function getLastOrderFromLocalStorage() {
		try {
			const txt = localStorage.getItem(LAST_ORDER_STORAGE_KEY);
			if (!txt) return null;
			const json = JSON.parse(txt);
			if (!json || !json.order || !Array.isArray(json.order.items)) return null;
			return json;
		} catch(_) { return null; }
	}

	function ensureRepeatLastOrderButton() {
		try {
			// Remove versões antigas dentro do carrinho
			['repeatLastOrderBtn', 'repeatLastOrderBtnEmpty'].forEach(id => {
				const el = document.getElementById(id);
				if (el && el.parentNode) el.parentNode.removeChild(el);
			});

			const productsSection = document.querySelector('.products-section');
			if (!productsSection) return;
			const hasLast = !!getLastOrderFromLocalStorage();
			let topArea = document.getElementById('repeatLastOrderTopArea');
			if (!hasLast) {
				if (topArea && topArea.parentNode) topArea.parentNode.removeChild(topArea);
				return;
			}
			if (!topArea) {
				ensureRepeatLastOrderStyles();
				topArea = document.createElement('div');
				topArea.id = 'repeatLastOrderTopArea';
				const btn = document.createElement('button');
				btn.id = 'repeatLastOrderBtnTop';
				btn.className = 'btn-repeat-last-order';
				btn.innerHTML = '<i class="fas fa-undo"></i><span>Repetir último pedido</span>';
				btn.onclick = repeatLastOrder;
				topArea.appendChild(btn);
				const productsGrid = document.getElementById('productsGrid');
				if (productsGrid && productsGrid.parentNode === productsSection) {
					productsSection.insertBefore(topArea, productsGrid);
				} else {
					productsSection.prepend(topArea);
				}
			}
		} catch(_) { /* noop */ }
	}

	function repeatLastOrder() {
		try {
			const data = getLastOrderFromLocalStorage();
			if (!data || !data.order) {
				showError('Nenhum pedido anterior encontrado.');
				return;
			}
			const od = data.order;
			// Reconstrói carrinho
			const items = (od.items || []).map((it, idx) => {
				const found = (appState.products || []).find(p => String(p.id) === String(it.product_id));
				const product = found || {
					id: it.product_id || (-Date.now() - idx),
					name: it.product_name,
					price: it.product_price,
					image_url: found ? found.image_url : null
				};
				return {
					product: product,
					quantity: it.quantity || 1,
					notes: it.notes || ''
				};
			});
			appState.cart = items;
			updateCartDisplay();

			// Abre checkout automaticamente e preenche dados
			proceedToCheckout();
			setTimeout(() => {
				try {
					prefillCheckoutFormFromSnapshot(od);
					verifyDeliveryAreaFromForm();
					populateCheckoutTotalsOnly();
				} catch(_) { /* noop */ }
			}, 50);
		} catch (error) {
			showError('Não foi possível repetir o pedido.');
		}
	}

	function prefillCheckoutFormFromSnapshot(od) {
		try {
			const form = document.getElementById('checkoutForm');
			if (!form) return;
			// Tipo do pedido
			const orderType = od.order_type || 'delivery';
			const typeEl = document.querySelector(`input[name="orderType"][value="${orderType}"]`);
			if (typeEl) {
				typeEl.checked = true;
				const addressSection = document.getElementById('deliveryAddressSection');
				if (addressSection) addressSection.style.display = (orderType === 'delivery') ? 'block' : 'none';
			}
			// Dados pessoais
			const nameEl = document.getElementById('customerName');
			const phoneEl = document.getElementById('customerPhone');
			if (nameEl) nameEl.value = od.customer_name || '';
			if (phoneEl) phoneEl.value = od.customer_phone || '';
			// Pagamento
			const payEl = document.querySelector(`input[name="paymentMethod"][value="${od.payment_method || 'dinheiro'}"]`);
			if (payEl) payEl.checked = true;
			const payValEl = document.getElementById('paymentValue');
			if (payValEl) payValEl.value = (od.payment_value || '')
			
			// Endereço
			const raw = od.__rawAddress || null;
			if (orderType === 'delivery') {
				const zipEl = document.getElementById('addressZip');
				const streetEl = document.getElementById('addressStreet');
				const numberEl = document.getElementById('addressNumber');
				const neighEl = document.getElementById('customerNeighborhood');
				const cityEl = document.getElementById('addressCity');
				const refEl = document.getElementById('customerReference');
				const compEl = document.getElementById('addressComplement');
				if (raw) {
					if (zipEl) zipEl.value = raw.addressZip || '';
					if (streetEl) streetEl.value = raw.addressStreet || '';
					if (numberEl) numberEl.value = raw.addressNumber || '';
					if (neighEl) neighEl.value = raw.customerNeighborhood || '';
					if (cityEl) cityEl.value = raw.addressCity || '';
					if (refEl) refEl.value = raw.customerReference || '';
					if (compEl) compEl.value = raw.addressComplement || '';
				} else {
					// Fallback: preenche somente os campos genéricos a partir de customer_address
					if (refEl) refEl.value = od.customer_reference || '';
				}
			}
		} catch(_) { /* noop */ }
	}

	// Monkey patch do submitOrder para salvar no localStorage após sucesso
	document.addEventListener('DOMContentLoaded', function() {
		try {
			ensureRepeatLastOrderButton();
			// Garante que após atualizar o carrinho o botão seja reavaliado, sem alterar a função existente
			if (typeof window.updateCartDisplay === 'function' && !window.__updateCartDisplayPatched) {
				const originalUpdate = window.updateCartDisplay;
				window.updateCartDisplay = function() {
					const result = originalUpdate.apply(this, arguments);
					try { ensureRepeatLastOrderButton(); } catch(_) {}
					return result;
				};
				window.__updateCartDisplayPatched = true;
			}
			if (typeof window.submitOrder === 'function' && !window.__submitOrderPatched) {
				const original = window.submitOrder;
				window.submitOrder = async function() {
					let rawFormValues = null;
					try {
						const form = document.getElementById('checkoutForm');
						if (form) {
							const fd = new FormData(form);
							rawFormValues = {
								addressZip: fd.get('addressZip') || '',
								addressStreet: fd.get('addressStreet') || '',
								addressNumber: fd.get('addressNumber') || '',
								customerNeighborhood: fd.get('customerNeighborhood') || '',
								addressCity: fd.get('addressCity') || '',
								addressComplement: fd.get('addressComplement') || '',
								customerReference: fd.get('customerReference') || '',
								orderType: getSelectedOrderType(),
								customerName: fd.get('customerName') || '',
								customerPhone: fd.get('customerPhone') || '',
								paymentMethod: fd.get('paymentMethod') || 'dinheiro',
								paymentValue: fd.get('paymentValue') || ''
							};
						}
					} catch(_) { /* noop */ }
					await original.apply(this, arguments);
					try {
						if (appState && appState.lastSubmittedOrderPayload) {
							saveLastOrderToLocalStorage(appState.lastSubmittedOrderPayload, rawFormValues);
							ensureRepeatLastOrderButton();
						}
					} catch(_) { /* noop */ }
				};
				window.__submitOrderPatched = true;
			}
		} catch(_) { /* noop */ }
	});

	// Fallback adicional: garante o botão após carregamento completo (desktop)
	window.addEventListener('load', function() {
		try {
			ensureRepeatLastOrderButton();
			setTimeout(ensureRepeatLastOrderButton, 150);
			setTimeout(ensureRepeatLastOrderButton, 400);
		} catch(_) { /* noop */ }
	});
})();

