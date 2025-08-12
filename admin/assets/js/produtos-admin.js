/**
 * Gerenciamento de Produtos e Categorias - Seção Admin
 * Integrado diretamente na seção "Produtos" do painel admin
 * Interface idêntica ao testes/index.php
 */

class ProdutosAdminManager {
    constructor() {
        this.categories = [];
        this.products = [];
        this.filteredData = [];
        this.isLoaded = false;
    }

    async init() {
        console.log('🚀 Inicializando ProdutosAdminManager...');
        await this.waitForModals();
        await this.loadData();
        this.setupEventListeners();
        this.renderCategories();
        this.applyFilters();
        this.isLoaded = true;
        console.log('✅ ProdutosAdminManager inicializado com sucesso!');
    }

    // Aguarda os modais serem carregados
    async waitForModals() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 50; // 5 segundos máximo
            
            const checkModals = () => {
                const productModal = document.getElementById('productModal');
                const categoryModal = document.getElementById('categoryModal');
                
                if (productModal && categoryModal) {
                    console.log('✅ Modais encontrados para produtos admin!');
                    resolve();
                } else {
                    attempts++;
                    if (attempts < maxAttempts) {
                        console.log(`⏳ Aguardando modais para produtos admin... (${attempts}/${maxAttempts})`);
                        setTimeout(checkModals, 100);
                    } else {
                        console.log('⚠️ Timeout ao aguardar modais, tentando recarregar...');
                        if (typeof loadModals === 'function') {
                            loadModals().then(() => {
                                setTimeout(() => {
                                    const productModal = document.getElementById('productModal');
                                    const categoryModal = document.getElementById('categoryModal');
                                    if (productModal && categoryModal) {
                                        console.log('✅ Modais carregados após retry!');
                                        resolve();
                                    } else {
                                        console.error('❌ Falha ao carregar modais após retry');
                                        resolve(); // Continua mesmo sem modais
                                    }
                                }, 500);
                            });
                        } else {
                            console.error('❌ Função loadModals não encontrada');
                            resolve(); // Continua mesmo sem modais
                        }
                    }
                }
            };
            
            checkModals();
        });
    }

    async loadData() {
        try {
            console.log('📡 Usando dados de appState...');

            const needsLoad = !window.appState ||
                !Array.isArray(appState.categories) || !Array.isArray(appState.products) ||
                appState.categories.length === 0 || appState.products.length === 0;

            if (needsLoad && typeof loadCategories === 'function' && typeof loadProducts === 'function') {
                try {
                    await Promise.allSettled([loadCategories(), loadProducts()]);
                } catch (_) {
                    // segue usando o que houver
                }
            }

            this.categories = Array.isArray(appState?.categories) ? appState.categories : [];
            this.products = Array.isArray(appState?.products) ? appState.products : [];

            // Agrupar produtos por categoria
            this.filteredData = this.categories.map(category => ({
                ...category,
                products: this.products.filter(product => product.category_id == category.id)
            }));

            // Preencher select de categorias
            this.populateCategoryFilter();

            console.log(`✅ Dados carregados: ${this.categories.length} categorias, ${this.products.length} produtos`);

        } catch (error) {
            console.error('❌ Erro ao carregar dados:', error);
            this.categories = [];
            this.products = [];
            this.filteredData = [];
        }
    }

    populateCategoryFilter() {
        const filterSelect = document.getElementById('produtos-filter-category');
        if (!filterSelect) return;

        // Manter a opção "Todas as Categorias"
        filterSelect.innerHTML = '<option value="all">Todas as Categorias</option>';
        
        // Adicionar categorias
        this.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            filterSelect.appendChild(option);
        });
    }

    setupEventListeners() {
        // Filtros
        const filterName = document.getElementById('produtos-filter-name');
        if (filterName) {
            filterName.addEventListener('input', () => this.applyFilters());
        }

        const filterCategory = document.getElementById('produtos-filter-category');
        if (filterCategory) {
            filterCategory.addEventListener('change', () => this.applyFilters());
        }

        const filterStatus = document.getElementById('produtos-filter-status');
        if (filterStatus) {
            filterStatus.addEventListener('change', () => this.applyFilters());
        }

        // Event listener para clicks no container do acordeão
        const accordionContainer = document.getElementById('produtos-accordion-container');
        if (accordionContainer) {
            accordionContainer.addEventListener('click', (event) => this.handleAccordionClick(event));
        }

        // Fechar dropdowns ao clicar fora
        document.addEventListener('click', (event) => this.handleOutsideClick(event));
    }

    renderCategories() {
        const container = document.getElementById('produtos-accordion-container');
        if (!container) return;

        if (this.filteredData.length === 0) {
            container.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-inbox"></i>
                    <p>Nenhuma categoria encontrada</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.filteredData.map(category => 
            this.renderCategory(category)
        ).join('');
    }

    renderCategory(category) {
        const products = category.products || [];
        const hasProducts = products.length > 0;
        const activeCount = products.filter(p => (p.active == 1 || p.active === true)).length;
        const inactiveCount = products.length - activeCount;
        
        return `
            <div class="produtos-accordion-item" data-category-id="${category.id}" data-category-name="${this.escapeHtml(category.name)}" data-category-active="${category.active}">
                <div class="produtos-accordion-button ${category.active ? '' : 'inactive-category'}">
                    <span class="produtos-category-name">
                        <i class="fa-solid fa-chevron-down"></i>
                        <span class="category-name-text">${this.escapeHtml(category.name)}</span>
                        <span class="category-counts">
                            <span style="background:#e2e3e5;color:#000;padding:2px 6px;border-radius:8px;font-size:12px;margin-left:6px;">Ativos: ${activeCount}</span>
                            ${inactiveCount > 0 ? `<span style="background:#e2e3e5;color:#000;padding:2px 6px;border-radius:8px;font-size:12px;margin-left:6px;">Inativos: ${inactiveCount}</span>` : ''}
                        </span>
                    </span>
                    <div class="produtos-category-actions">
                        <div class="produtos-actions-menu">
                            <button class="produtos-btn-icon" data-action="toggle-menu" title="Mais opções">
                                <i class="fa-solid fa-ellipsis-vertical"></i>
                            </button>
                            <div class="produtos-dropdown-menu">
                                <button class="produtos-dropdown-item" data-action="edit-category">
                                    <i class="fa-solid fa-pencil"></i> Editar
                                </button>
                                <button class="produtos-dropdown-item danger" data-action="delete-category">
                                    <i class="fa-solid fa-trash-can"></i> Apagar
                                </button>
                            </div>
                        </div>
                        <label class="produtos-switch" title="${category.active ? 'Desativar' : 'Ativar'}">
                            <input type="checkbox" ${category.active ? 'checked' : ''} data-action="toggle-category">
                            <span class="produtos-slider"></span>
                        </label>
                    </div>
                </div>
                <div class="produtos-accordion-content">
                    <ul class="produtos-product-list">
                        ${hasProducts ? 
                            products.map(product => this.renderProduct(product)).join('') :
                            '<li style="padding: 1rem 1.25rem; color: var(--gray-400);">Nenhum produto nesta categoria.</li>'
                        }
                    </ul>
                </div>
            </div>
        `;
    }

    renderProduct(product) {
        const descriptionHtml = this.buildProductDescriptionMinimal(product);
        const metaHtml = this.buildProductMetaMinimal(product);
        const priceHtml = (product.product_type === 'comum' || !product.product_type)
            ? `<span class="produtos-product-price">R$ ${this.formatPrice(product.price)}</span>`
            : '';
        return `
            <li class="produtos-product-item ${product.active ? '' : 'inactive-product'}" 
                data-product-id="${product.id}" 
                data-product-name="${this.escapeHtml(product.name)}" 
                data-product-active="${product.active}">
                <div class="produtos-product-details">
                    <span>${this.escapeHtml(product.name)}</span>
                    ${priceHtml}
                </div>
                ${descriptionHtml}
                ${metaHtml}
                <div class="produtos-product-actions">
                    <div class="produtos-actions-menu">
                        <button class="produtos-btn-icon" data-action="toggle-menu" title="Mais opções">
                            <i class="fa-solid fa-ellipsis-vertical"></i>
                        </button>
                        <div class="produtos-dropdown-menu">
                            <button class="produtos-dropdown-item" data-action="edit-product">
                                <i class="fa-solid fa-pencil"></i> Editar
                            </button>
                            <button class="produtos-dropdown-item danger" data-action="delete-product">
                                <i class="fa-solid fa-trash-can"></i> Apagar
                            </button>
                        </div>
                    </div>
                    <label class="produtos-switch" title="${product.active ? 'Desativar' : 'Ativar'}">
                        <input type="checkbox" ${product.active ? 'checked' : ''} data-action="toggle-product">
                        <span class="produtos-slider"></span>
                    </label>
                </div>
            </li>
        `;
    }

    handleAccordionClick(event) {
        const target = event.target;
        const accordionButton = target.closest('.produtos-accordion-button');
        const actionTarget = target.closest('[data-action]');

        // Lógica para abrir/fechar o acordeão
        if (accordionButton && !actionTarget) {
            accordionButton.classList.toggle('active');
            const content = accordionButton.nextElementSibling;
            if (content.style.maxHeight) {
                content.style.maxHeight = null;
            } else {
                content.style.maxHeight = content.scrollHeight + "px";
            }
        }
        
        // Lógica para os botões de ação
        if (actionTarget) {
            const action = actionTarget.dataset.action;

            // Lógica para o menu de 3 pontinhos
            if (action === 'toggle-menu') {
                const dropdown = actionTarget.nextElementSibling;
                // Fecha outros menus abertos
                document.querySelectorAll('.produtos-dropdown-menu.show').forEach(menu => {
                    if (menu !== dropdown) menu.classList.remove('show');
                });
                dropdown.classList.toggle('show');
            } else {
                // Ações de Categoria
                const categoryItem = target.closest('.produtos-accordion-item');
                if (categoryItem && action.includes('category')) {
                    this.handleCategoryAction(action, categoryItem.dataset.categoryId, actionTarget);
                }
                
                // Ações de Produto
                const productItem = target.closest('.produtos-product-item');
                if (productItem && action.includes('product')) {
                    this.handleProductAction(action, productItem.dataset.productId, actionTarget);
                }
            }
        }
    }

    handleOutsideClick(event) {
        if (!event.target.closest('.produtos-actions-menu')) {
            document.querySelectorAll('.produtos-dropdown-menu.show').forEach(menu => menu.classList.remove('show'));
        }
    }

    async handleCategoryAction(action, id, element) {
        try {
            switch (action) {
                case 'toggle-category':
                    await this.toggleCategoryStatus(id, element.checked);
                    break;
                case 'edit-category':
                    await this.editCategory(id);
                    break;
                case 'delete-category':
                    await this.deleteCategory(id);
                    break;
            }
        } catch (error) {
            console.error('Erro na ação da categoria:', error);
            this.showError('Erro ao executar ação. Tente novamente.');
        }
    }

    async handleProductAction(action, id, element) {
        try {
            switch (action) {
                case 'toggle-product':
                    await this.toggleProductStatus(id, element.checked);
                    break;
                case 'edit-product':
                    await this.editProduct(id);
                    break;
                case 'delete-product':
                    await this.deleteProduct(id);
                    break;
            }
        } catch (error) {
            console.error('Erro na ação do produto:', error);
            this.showError('Erro ao executar ação. Tente novamente.');
        }
    }

    async toggleCategoryStatus(id, active) {
        try {
            const category = this.categories.find(c => c.id == id);
            if (!category) {
                throw new Error('Categoria não encontrada no estado local');
            }

            // API de categorias exige payload completo no PUT
            const payload = {
                name: category.name,
                description: category.description || '',
                image_url: category.image_url || null,
                display_order: typeof category.display_order === 'number' ? category.display_order : (parseInt(category.display_order) || 0),
                active: active ? 1 : 0
            };

            const response = await fetch(`${getApiUrl('categories')}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json().catch(() => ({}));

            if (response.ok && data && data.success) {
                // Atualizar estado local a partir da resposta da API
                const updated = data.data || payload;
                category.active = updated.active ? 1 : 0;
                category.name = updated.name ?? category.name;
                category.description = updated.description ?? category.description;
                category.image_url = updated.image_url ?? category.image_url;
                category.display_order = typeof updated.display_order !== 'undefined' ? updated.display_order : category.display_order;
                this.updateCategoryUI(id, !!category.active);
            } else {
                const message = data?.message || 'Erro ao atualizar categoria';
                throw new Error(message);
            }
        } catch (error) {
            console.error('Erro ao alterar status da categoria:', error);
            this.showError('Erro ao alterar status da categoria');
        }
    }

    async toggleProductStatus(id, active) {
        try {
            // API possui endpoint PATCH para alternar status
            const response = await fetch(`${getApiUrl('products')}/${id}`, {
                method: 'PATCH'
            });

            const data = await response.json().catch(() => ({}));

            if (response.ok && data && data.success) {
                const newActive = data.data && typeof data.data.active !== 'undefined' ? data.data.active : active;
                // Atualizar estado local com o valor retornado pela API
                const product = this.products.find(p => p.id == id);
                if (product) {
                    product.active = newActive ? 1 : 0;
                    this.updateProductUI(id, !!product.active);
                    if (product.category_id) {
                        this.updateCategoryCountsUI(product.category_id);
                    }
                }
            } else {
                const message = data?.message || 'Erro ao atualizar produto';
                throw new Error(message);
            }
        } catch (error) {
            console.error('Erro ao alterar status do produto:', error);
            this.showError('Erro ao alterar status do produto');
        }
    }

    updateCategoryCountsUI(categoryId) {
        try {
            const container = document.querySelector(`[data-category-id="${categoryId}"] .category-counts`);
            if (!container) return;
            const products = this.products.filter(p => p.category_id == categoryId);
            const activeCount = products.filter(p => (p.active == 1 || p.active === true)).length;
            const inactiveCount = products.length - activeCount;
            const activeBadge = `<span style="background:#e2e3e5;color:#000;padding:2px 6px;border-radius:8px;font-size:12px;margin-left:6px;">Ativos: ${activeCount}</span>`;
            const inactiveBadge = inactiveCount > 0 ? `<span style=\"background:#e2e3e5;color:#000;padding:2px 6px;border-radius:8px;font-size:12px;margin-left:6px;\">Inativos: ${inactiveCount}</span>` : '';
            container.innerHTML = `${activeBadge}${inactiveBadge}`;
        } catch (_) {
            // silencioso
        }
    }

    updateCategoryUI(id, active) {
        const categoryItem = document.querySelector(`[data-category-id="${id}"]`);
        if (categoryItem) {
            const button = categoryItem.querySelector('.produtos-accordion-button');
            if (active) {
                button.classList.remove('inactive-category');
            } else {
                button.classList.add('inactive-category');
            }
        }
    }

    updateProductUI(id, active) {
        const productItem = document.querySelector(`[data-product-id="${id}"]`);
        if (productItem) {
            if (active) {
                productItem.classList.remove('inactive-product');
            } else {
                productItem.classList.add('inactive-product');
            }
        }
    }

    async editCategory(id) {
        // Verificar se os modais estão disponíveis primeiro
        const categoryModal = document.getElementById('categoryModal');
        if (!categoryModal) {
            this.showError('Modal de categoria não foi carregado. Aguarde ou recarregue a página.');
            return;
        }

        // Usar modal existente
        if (typeof window.showCategoryModal === 'function') {
            window.showCategoryModal(id);
        } else {
            this.showError('Função de modal de categoria não está disponível.');
        }
    }

    async editProduct(id) {
        // Verificar se os modais estão disponíveis primeiro
        const productModal = document.getElementById('productModal');
        if (!productModal) {
            this.showError('Modal de produto não foi carregado. Aguarde ou recarregue a página.');
            return;
        }

        // Usar modal existente
        if (typeof window.editProduct === 'function') {
            window.editProduct(id);
        } else {
            this.showError('Função de modal de produto não está disponível.');
        }
    }

    async deleteCategory(id) {
        const category = this.categories.find(c => c.id == id);
        if (!category) return;

        // Verificar se há produtos na categoria
        const productsInCategory = this.products.filter(p => p.category_id == id);
        
        if (productsInCategory.length > 0) {
            this.showError(`Não é possível excluir a categoria "${category.name}" pois ela possui ${productsInCategory.length} produto(s). Reclassifique os produtos primeiro.`);
            return;
        }

        if (confirm(`Tem certeza que deseja excluir a categoria "${category.name}"?`)) {
            try {
                const response = await fetch(`${getApiUrl('categories')}/${id}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    this.categories = this.categories.filter(c => c.id != id);
                    this.filteredData = this.filteredData.filter(c => c.id != id);
                    this.renderCategories();
                    this.populateCategoryFilter();
                    this.showSuccess('Categoria excluída com sucesso!');
                } else {
                    throw new Error('Erro ao excluir categoria');
                }
            } catch (error) {
                console.error('Erro ao excluir categoria:', error);
                this.showError('Erro ao excluir categoria');
            }
        }
    }

    async deleteProduct(id) {
        const numericId = parseInt(id, 10);
        const product = this.products.find(p => parseInt(p.id, 10) === numericId);
        if (!product) return;

        if (confirm(`Tem certeza que deseja excluir o produto "${product.name}"?`)) {
            try {
                const response = await fetch(`${getApiUrl('products')}/${numericId}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    this.products = this.products.filter(p => parseInt(p.id, 10) !== numericId);
                    this.updateFilteredData();
                    this.renderCategories();
                    this.showSuccess('Produto excluído com sucesso!');
                } else {
                    throw new Error('Erro ao excluir produto');
                }
            } catch (error) {
                console.error('Erro ao excluir produto:', error);
                this.showError('Erro ao excluir produto');
            }
        }
    }

    applyFilters() {
        const nameQuery = document.getElementById('produtos-filter-name')?.value.toLowerCase() || '';
        const categoryQuery = document.getElementById('produtos-filter-category')?.value || 'all';
        const statusQuery = document.getElementById('produtos-filter-status')?.value || 'all';

        document.querySelectorAll('.produtos-accordion-item').forEach(categoryItem => {
            const categoryId = categoryItem.dataset.categoryId;
            const categoryName = categoryItem.dataset.categoryName.toLowerCase();
            const categoryActive = categoryItem.dataset.categoryActive === '1';
            
            let categoryVisible = false;

            // Filtrar produtos dentro da categoria
            let visibleProductsCount = 0;
            categoryItem.querySelectorAll('.produtos-product-item').forEach(productItem => {
                const productName = productItem.dataset.productName.toLowerCase();
                const productActive = productItem.dataset.productActive === '1';

                const nameMatch = productName.includes(nameQuery) || categoryName.includes(nameQuery);
                const statusMatch = (statusQuery === 'all') || (statusQuery === 'active' && productActive) || (statusQuery === 'inactive' && !productActive);
                
                if (nameMatch && statusMatch) {
                    productItem.style.display = 'flex';
                    visibleProductsCount++;
                } else {
                    productItem.style.display = 'none';
                }
            });

            // Verificar se a categoria deve ser visível
            const categoryNameMatch = categoryName.includes(nameQuery);
            const categoryFilterMatch = categoryQuery === 'all' || categoryQuery === categoryId;
            const categoryStatusMatch = (statusQuery === 'all') || (statusQuery === 'active' && categoryActive) || (statusQuery === 'inactive' && !categoryActive);

            if (categoryFilterMatch && ( (categoryNameMatch && categoryStatusMatch) || (visibleProductsCount > 0) ) ) {
                 categoryVisible = true;
            }

            categoryItem.style.display = categoryVisible ? 'block' : 'none';
        });
    }

    updateFilteredData() {
        this.filteredData = this.categories.map(category => ({
            ...category,
            products: this.products.filter(product => product.category_id == category.id)
        }));
    }

    // Função para recarregar dados (chamada após salvar via modais)
    async reloadData() {
        await this.loadData();
        this.renderCategories();
        this.applyFilters();
    }

    // Funções utilitárias
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatPrice(price) {
        return parseFloat(price || 0).toFixed(2).replace('.', ',');
    }

    buildProductDescriptionMinimal(product) {
        const raw = (product.description || '').toString().trim();
        if (!raw) return '';
        const text = this.truncateText(raw, 160);
        return `<div class="produtos-product-desc" style="color: var(--gray-500); font-size: 0.88rem; margin-top: 4px;">${this.escapeHtml(text)}</div>`;
    }

    buildProductMetaMinimal(product) {
        const flags = [];
        const isTrue = (v) => v === true || v === 1 || v === '1';
        if (isTrue(product.is_vegetarian)) flags.push('<span class="feature-badge vegetarian">Vegetariano</span>');
        if (isTrue(product.is_vegan)) flags.push('<span class="feature-badge vegan">Vegano</span>');
        if (isTrue(product.is_gluten_free)) flags.push('<span class="feature-badge gluten-free">Sem Glúten</span>');
        if (isTrue(product.is_spicy)) flags.push('<span class="feature-badge spicy">Picante</span>');
        if (flags.length === 0) return '';
        return `<div class="produtos-product-meta" style="display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-top:6px;">${flags.join('\n')}</div>`;
    }

    truncateText(text, maxLength = 160) {
        if (!text) return '';
        const clean = text.toString();
        if (clean.length <= maxLength) return clean;
        return clean.slice(0, maxLength - 1) + '…';
    }

    showSuccess(message) {
        if (typeof window.showSuccess === 'function') {
            window.showSuccess(message);
        } else {
            alert('✅ ' + message);
        }
    }

    showError(message) {
        if (typeof window.showError === 'function') {
            window.showError(message);
        } else {
            alert('❌ ' + message);
        }
    }

    showInfo(message) {
        if (typeof window.showInfo === 'function') {
            window.showInfo(message);
        } else {
            alert('ℹ️ ' + message);
        }
    }
}

// Instância global para ser acessada de outras partes do admin
window.produtosAdminManager = null;

// Função para inicializar a seção de produtos
async function initProdutosAdmin() {
    console.log('🚀 Iniciando produtos admin...');
    
    // Garantir que os modais estão carregados primeiro
    await ensureModalsLoaded();
    
    if (!window.produtosAdminManager) {
        console.log('📦 Criando nova instância do ProdutosAdminManager...');
        window.produtosAdminManager = new ProdutosAdminManager();
        await window.produtosAdminManager.init();
    } else if (window.produtosAdminManager.isLoaded) {
        // Se já foi carregado, apenas reinicia a interface
        console.log('🔄 Reiniciando interface existente...');
        window.produtosAdminManager.renderCategories();
        window.produtosAdminManager.applyFilters();
    }
}

// Função para garantir que os modais estão carregados
async function ensureModalsLoaded() {
    console.log('🔍 Verificando se modais estão carregados...');
    
    const modalsContainer = document.getElementById('modals-container');
    if (!modalsContainer) {
        console.error('❌ Container de modais não encontrado!');
        return;
    }
    
    // Se o container está vazio, tenta carregar
    if (!modalsContainer.innerHTML.trim()) {
        console.log('📦 Container vazio, carregando modais...');
        if (typeof loadModals === 'function') {
            await loadModals();
        }
    }
    
    // Aguardar um pouco e verificar novamente
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const productModal = document.getElementById('productModal');
    const categoryModal = document.getElementById('categoryModal');
    
    if (!productModal || !categoryModal) {
        console.warn('⚠️ Modais não foram carregados, mas continuando...');
        console.log('productModal:', productModal ? '✅' : '❌');
        console.log('categoryModal:', categoryModal ? '✅' : '❌');
    } else {
        console.log('✅ Modais verificados e disponíveis!');
    }
}

// Função para recarregar dados (chamada após salvar via modais)
function reloadProdutosAdmin() {
    if (window.produtosAdminManager && window.produtosAdminManager.isLoaded) {
        window.produtosAdminManager.reloadData();
    }
}

// Função para debug - verificar se os modais estão carregados
function debugModalsStatus() {
    console.log('=== DEBUG MODAIS ===');
    console.log('productModal:', document.getElementById('productModal') ? '✅ Encontrado' : '❌ Não encontrado');
    console.log('categoryModal:', document.getElementById('categoryModal') ? '✅ Encontrado' : '❌ Não encontrado');
    console.log('modals-container:', document.getElementById('modals-container') ? '✅ Encontrado' : '❌ Não encontrado');
    console.log('showCategoryModal função:', typeof window.showCategoryModal);
    console.log('editProduct função:', typeof window.editProduct);
    console.log('showAddProductModal função:', typeof window.showAddProductModal);
    console.log('===================');
}

// Função para forçar recarga dos modais
async function forceReloadModals() {
    console.log('🔄 Forçando recarga dos modais...');
    if (typeof loadModals === 'function') {
        await loadModals();
        console.log('✅ Modais recarregados!');
        debugModalsStatus();
    } else {
        console.error('❌ Função loadModals não disponível');
    }
}

// Exportar funções para uso global
window.initProdutosAdmin = initProdutosAdmin;
window.reloadProdutosAdmin = reloadProdutosAdmin;
window.debugModalsStatus = debugModalsStatus;
window.forceReloadModals = forceReloadModals;
