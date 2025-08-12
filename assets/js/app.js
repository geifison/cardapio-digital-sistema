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
    USE_SSE: true
};

// Estado global da aplicação
let appState = {
    categories: [],
    products: [],
    cart: [],
    currentCategory: null,
    isCartOpen: false
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
        await loadCategories();
        await loadProducts();
        setupEventListeners();
        if (CONFIG.USE_SSE) {
            startSSE();
        } else {
            startAutoRefresh();
        }
        updateCartDisplay();
    } catch (error) {
        console.error('Erro ao inicializar aplicação:', error);
        showError('Erro ao carregar o cardápio. Tente recarregar a página.');
    }
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
    const product = appState.products.find(p => p.id === productId);
    if (!product) return;
    
    // Verificar se é um produto tipo pizza (inclui "Monte Sua Pizza" e produtos pizza gerenciáveis)
    if (product.name === 'Monte Sua Pizza' || product.product_type === 'pizza') {
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
    showCartAnimation();
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
    
    const totalItems = appState.cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = appState.cart.reduce((sum, item) => {
        // Produtos sem preço não contribuem para o subtotal
        const price = item.product.price && parseFloat(item.product.price) > 0 ? parseFloat(item.product.price) : 0;
        return sum + (price * item.quantity);
    }, 0);
    const total = subtotal + CONFIG.DELIVERY_FEE;
    
    cartCount.textContent = totalItems;
    
    if (appState.cart.length === 0) {
        cartEmpty.style.display = 'block';
        cartFooter.style.display = 'none';
        cartItems.innerHTML = '';
    } else {
        cartEmpty.style.display = 'none';
        cartFooter.style.display = 'block';
        
        cartItems.innerHTML = '';
        appState.cart.forEach(item => {
            const cartItem = createCartItem(item);
            cartItems.appendChild(cartItem);
        });
        
        cartSubtotal.textContent = formatCurrency(subtotal);
        deliveryFee.textContent = formatCurrency(CONFIG.DELIVERY_FEE);
        cartTotal.textContent = formatCurrency(total);
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
    
    appState.isCartOpen = !appState.isCartOpen;
    
    if (appState.isCartOpen) {
        cartSidebar.classList.add('open');
        cartOverlay.classList.add('show');
        document.body.style.overflow = 'hidden';
    } else {
        cartSidebar.classList.remove('open');
        cartOverlay.classList.remove('show');
        document.body.style.overflow = '';
    }
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
    
    populateCheckoutModal();
    showCheckoutModal();
}

/**
 * Popula o modal de checkout com os dados do carrinho
 */
function populateCheckoutModal() {
    const checkoutItems = document.getElementById('checkoutItems');
    const checkoutSubtotal = document.getElementById('checkoutSubtotal');
    const checkoutDeliveryFee = document.getElementById('checkoutDeliveryFee');
    const checkoutTotal = document.getElementById('checkoutTotal');
    
    const subtotal = appState.cart.reduce((sum, item) => {
        const price = item.product.price && parseFloat(item.product.price) > 0 ? parseFloat(item.product.price) : 0;
        return sum + (price * item.quantity);
    }, 0);
    const total = subtotal + CONFIG.DELIVERY_FEE;
    
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
    checkoutDeliveryFee.textContent = formatCurrency(CONFIG.DELIVERY_FEE);
    checkoutTotal.textContent = formatCurrency(total);
}

/**
 * Exibe o modal de checkout
 */
function showCheckoutModal() {
    const checkoutModal = document.getElementById('checkoutModal');
    checkoutModal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

/**
 * Fecha o modal de checkout
 */
function closeCheckoutModal() {
    const checkoutModal = document.getElementById('checkoutModal');
    checkoutModal.classList.remove('show');
    document.body.style.overflow = '';
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
    
    const orderData = {
        customer_name: formData.get('customerName'),
        customer_phone: formData.get('customerPhone'),
        customer_address: formData.get('customerAddress'),
        customer_neighborhood: formData.get('customerNeighborhood'),
        customer_reference: formData.get('customerReference'),
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
        delivery_fee: CONFIG.DELIVERY_FEE,
        total_amount: appState.cart.reduce((sum, item) => {
            const price = item.product.price && parseFloat(item.product.price) > 0 ? parseFloat(item.product.price) : 0;
            return sum + (price * item.quantity);
        }, 0) + CONFIG.DELIVERY_FEE
    };
    
    // Calcula o troco se necessário
    if (orderData.payment_method === 'dinheiro' && orderData.payment_value) {
        orderData.change_amount = parseFloat(orderData.payment_value) - orderData.total_amount;
    }
    
    try {
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
            
            // Limpa o carrinho
            appState.cart = [];
            updateCartDisplay();
            toggleCart();
            
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
    const requiredFields = ['customerName', 'customerPhone', 'customerAddress', 'customerNeighborhood'];
    
    for (const field of requiredFields) {
        if (!formData.get(field) || formData.get(field).trim() === '') {
            showError(`Por favor, preencha o campo ${getFieldLabel(field)}.`);
            return false;
        }
    }
    
    // Validação específica para pagamento em dinheiro
    const paymentMethod = formData.get('paymentMethod');
    const paymentValue = formData.get('paymentValue');
    const totalAmount = appState.cart.reduce((sum, item) => {
        const price = item.product.price && parseFloat(item.product.price) > 0 ? parseFloat(item.product.price) : 0;
        return sum + (price * item.quantity);
    }, 0) + CONFIG.DELIVERY_FEE;
    
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
    
    // Event listener para cálculo do troco
    document.getElementById('paymentValue').addEventListener('input', function() {
        const paymentValue = parseFloat(this.value) || 0;
        const totalAmount = appState.cart.reduce((sum, item) => {
            const price = item.product.price && parseFloat(item.product.price) > 0 ? parseFloat(item.product.price) : 0;
            return sum + (price * item.quantity);
        }, 0) + CONFIG.DELIVERY_FEE;
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
    // Atualiza info de seleção ao entrar no passo
    updateSelectedFlavorsInfo();
    // Atualizar estado do botão de continuar
    updateContinueButton();
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
        const price = getFlavorPrice(flavor.id, sizeId);
        const html = `
            <div class="flavor-name">${flavor.name}</div>
            <div class="flavor-description">${flavor.description}</div>
            <div class="flavor-price">R$ ${price.toFixed(2)}</div>
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
    const flavorCard = document.querySelector(`[data-flavor-id="${flavor.id}"]`);
    if (!flavorCard) return;
    if (flavorCard.classList.contains('disabled')) return;
    
    // Calcular total de sabores já selecionados
    const totalSelectedFlavors = pizzaBuilderState.selectedFlavors.length;
    
    // Verificar se o sabor já está selecionado
    const existingFlavorIndex = pizzaBuilderState.selectedFlavors.findIndex(f => f.id === flavor.id);
    
    if (existingFlavorIndex !== -1) {
        // Sabor já selecionado - adicionar mais uma quantidade se possível
        if (totalSelectedFlavors < pizzaBuilderState.maxFlavors) {
            pizzaBuilderState.selectedFlavors.push(flavor);
            updateFlavorCounter(flavorCard, flavor.id);
        } else {
            showError(`Este tamanho permite no máximo ${pizzaBuilderState.maxFlavors} sabor${pizzaBuilderState.maxFlavors > 1 ? 'es' : ''}`);
            return;
        }
    } else {
        // Novo sabor
        if (totalSelectedFlavors >= pizzaBuilderState.maxFlavors) {
            showError(`Este tamanho permite no máximo ${pizzaBuilderState.maxFlavors} sabor${pizzaBuilderState.maxFlavors > 1 ? 'es' : ''}`);
            return;
        }
        
        flavorCard.classList.add('selected');
        pizzaBuilderState.selectedFlavors.push(flavor);
        updateFlavorCounter(flavorCard, flavor.id);
    }
    
    // Atualiza visual e informação de sabores selecionados
    updateFlavorSelectionUI();
    renderPizzaCircle();
    updateSelectedFlavorsInfo();
    
    // Mostrar/esconder botão de continuar
    updateContinueButton();
    
    // Avançar automaticamente quando atingir o limite permitido
    if (pizzaBuilderState.selectedFlavors.length === pizzaBuilderState.maxFlavors) {
        pizzaBuilderState.currentStep = 3;
        updatePizzaStep();
    }
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
    const max = pizzaBuilderState.maxFlavors;
    const selectedIds = pizzaBuilderState.selectedFlavors.map(f => f.id);
    
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
    const reachedMax = pizzaBuilderState.selectedFlavors.length >= max;
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
    
    if (pizzaBuilderState.selectedFlavors.length === 0) {
        pizzaCircle.style.background = '#f8f9fa';
        return;
    }
    
    if (pizzaBuilderState.selectedFlavors.length === 1) {
        pizzaCircle.style.background = PIZZA_COLORS[0];
    } else {
        const segments = pizzaBuilderState.selectedFlavors.length;
        const anglePerSegment = 360 / segments;
        
        let gradient = 'conic-gradient(';
        pizzaBuilderState.selectedFlavors.forEach((flavor, index) => {
            const startAngle = index * anglePerSegment;
            const endAngle = (index + 1) * anglePerSegment;
            const color = PIZZA_COLORS[index % PIZZA_COLORS.length];
            
            gradient += `${color} ${startAngle}deg ${endAngle}deg`;
            if (index < segments - 1) gradient += ', ';
        });
        gradient += ')';
        
        pizzaCircle.style.background = gradient;
    }
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
    document.getElementById('summaryFlavors').textContent = getFormattedFlavorsText(pizzaBuilderState.selectedFlavors);
    
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
                border_id: pizzaBuilderState.selectedBorder.id,
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
    
    if (pizzaBuilderState.selectedFlavors.length === 0) {
        pizzaPreview.style.background = '#f8f9fa';
        return;
    }
    
    if (pizzaBuilderState.selectedFlavors.length === 1) {
        pizzaPreview.style.background = PIZZA_COLORS[0];
    } else {
        const segments = pizzaBuilderState.selectedFlavors.length;
        const anglePerSegment = 360 / segments;
        
        let gradient = 'conic-gradient(';
        pizzaBuilderState.selectedFlavors.forEach((flavor, index) => {
            const startAngle = index * anglePerSegment;
            const endAngle = (index + 1) * anglePerSegment;
            const color = PIZZA_COLORS[index % PIZZA_COLORS.length];
            
            gradient += `${color} ${startAngle}deg ${endAngle}deg`;
            if (index < segments - 1) gradient += ', ';
        });
        gradient += ')';
        
        pizzaPreview.style.background = gradient;
    }
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
        const notes = `Sabores: ${getFormattedFlavorsText(pizzaBuilderState.selectedFlavors)}${pizzaBuilderState.selectedExtras.length > 0 ? ` | Adicionais: ${pizzaBuilderState.selectedExtras.map(e => e.name).join(', ')}` : ''}`;

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

        // Fecha o modal após adicionar
        closePizzaBuilder();
        showSuccess('Pizza personalizada adicionada ao carrinho!');
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
    
    // Esconder botão de continuar
    const continueBtn = document.getElementById('flavorsContinue');
    if (continueBtn) {
        continueBtn.style.display = 'none';
    }
    
    updatePizzaStep();
}

