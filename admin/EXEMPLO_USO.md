# Exemplos Práticos de Uso - Sistema Administrativo

Este arquivo contém exemplos práticos de como usar a nova estrutura modular do sistema administrativo.

## 🚀 Exemplo 1: Adicionando Novo Modal

### 1. Adicionar HTML no `modals.html`
```html
<!-- Novo Modal de Configurações -->
<div class="modal-overlay" id="settingsModal">
    <div class="modal">
        <div class="modal-header">
            <h3><i class="fas fa-cog"></i> Configurações</h3>
            <button class="close-modal" onclick="closeSettingsModal()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="modal-content">
            <form id="settingsForm">
                <div class="form-group">
                    <label for="companyName">Nome da Empresa</label>
                    <input type="text" id="companyName" name="company_name" required>
                </div>
                <div class="form-group">
                    <label for="themeColor">Cor do Tema</label>
                    <input type="color" id="themeColor" name="theme_color" value="#667eea">
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button class="btn-secondary" onclick="closeSettingsModal()">
                <i class="fas fa-times"></i> Cancelar
            </button>
            <button class="btn-primary" onclick="saveSettings()">
                <i class="fas fa-save"></i> Salvar
            </button>
        </div>
    </div>
</div>
```

### 2. Adicionar JavaScript no `admin.js`
```javascript
// Função para mostrar modal de configurações
function showSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        DOMUtils.show(modal);
        DOMUtils.addClasses(modal, 'show');
        
        // Carregar configurações atuais
        loadCurrentSettings();
    }
}

// Função para fechar modal de configurações
function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        DOMUtils.removeClasses(modal, 'show');
        DOMUtils.fadeOut(modal, getConfig('UI.MODAL_ANIMATION_DURATION'));
    }
}

// Função para salvar configurações
async function saveSettings() {
    try {
        const form = document.getElementById('settingsForm');
        const formData = new FormData(form);
        
        // Validar dados
        const companyName = formData.get('company_name');
        if (!ValidationUtils.required(companyName)) {
            showError('Nome da empresa é obrigatório');
            return;
        }
        
        if (!ValidationUtils.minLength(companyName, getConfig('VALIDATION.MIN_NAME_LENGTH'))) {
            showError(`Nome deve ter pelo menos ${getConfig('VALIDATION.MIN_NAME_LENGTH')} caracteres`);
            return;
        }
        
        // Salvar via API
        const response = await fetch(getApiUrl('settings/save'), {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            showSuccess('Configurações salvas com sucesso!');
            closeSettingsModal();
        } else {
            throw new Error('Erro ao salvar configurações');
        }
    } catch (error) {
        console.error('Erro ao salvar configurações:', error);
        showError('Erro ao salvar configurações. Tente novamente.');
    }
}
```

### 3. Adicionar botão no `index.html`
```html
<button class="nav-item" onclick="showSettingsModal()">
    <i class="fas fa-cog"></i>
    Configurações
</button>
```

## 🔧 Exemplo 2: Usando Utilitários

### Formatação de Dados
```javascript
// Formatar preços de produtos
function formatProductPrices(products) {
    return products.map(product => ({
        ...product,
        formattedPrice: FormatUtils.currency(product.price),
        formattedDate: FormatUtils.date(product.created_at, 'DD/MM/YYYY'),
        timeAgo: FormatUtils.timeAgo(product.created_at)
    }));
}

// Aplicar formatação
const formattedProducts = formatProductPrices(productsList);
renderProductsGrid(formattedProducts);
```

### Validação de Formulários
```javascript
// Validar formulário de produto
function validateProductForm(formData) {
    const errors = [];
    
    // Validar nome
    const name = formData.get('name');
    if (!ValidationUtils.required(name)) {
        errors.push('Nome do produto é obrigatório');
    } else if (!ValidationUtils.minLength(name, getConfig('VALIDATION.MIN_NAME_LENGTH'))) {
        errors.push(`Nome deve ter pelo menos ${getConfig('VALIDATION.MIN_NAME_LENGTH')} caracteres`);
    }
    
    // Validar preço
    const price = formData.get('price');
    if (!ValidationUtils.price(price)) {
        errors.push('Preço deve ser um valor válido');
    }
    
    // Validar email (se aplicável)
    const email = formData.get('email');
    if (email && !ValidationUtils.email(email)) {
        errors.push('Email deve ser válido');
    }
    
    return errors;
}

// Usar validação
const form = document.getElementById('productForm');
const formData = new FormData(form);
const errors = validateProductForm(formData);

if (errors.length > 0) {
    errors.forEach(error => showError(error));
    return false;
}
```

### Manipulação de DOM
```javascript
// Criar card de produto dinamicamente
function createProductCard(product) {
    const card = DOMUtils.createElement('div', 'product-card');
    
    // Adicionar classes condicionais
    if (product.active) {
        DOMUtils.addClasses(card, 'active');
    } else {
        DOMUtils.addClasses(card, 'inactive');
    }
    
    // Adicionar conteúdo
    card.innerHTML = `
        <div class="product-image">
            ${product.image_url ? 
                `<img src="${product.image_url}" alt="${product.name}">` : 
                '<div class="no-image"><i class="fas fa-image"></i></div>'
            }
        </div>
        <div class="product-info">
            <div class="product-header">
                <h3 class="product-name">${StringUtils.escapeHtml(product.name)}</h3>
                <span class="product-price">${FormatUtils.currency(product.price)}</span>
            </div>
            <p class="product-description">${StringUtils.truncate(product.description, 100)}</p>
        </div>
    `;
    
    // Adicionar eventos
    card.addEventListener('click', () => showProductDetail(product.id));
    
    return card;
}

// Animar entrada de elementos
function animateProductCards() {
    const cards = document.querySelectorAll('.product-card');
    cards.forEach((card, index) => {
        setTimeout(() => {
            DOMUtils.fadeIn(card, 300);
        }, index * 100);
    });
}
```

## ⚙️ Exemplo 3: Configurações Personalizadas

### Alterar Configurações em Tempo de Execução
```javascript
// Alterar tema dinamicamente
function changeTheme(themeName) {
    const themes = {
        'default': {
            primary: '#667eea',
            secondary: '#764ba2'
        },
        'dark': {
            primary: '#2c3e50',
            secondary: '#34495e'
        },
        'light': {
            primary: '#3498db',
            secondary: '#2980b9'
        }
    };
    
    const theme = themes[themeName];
    if (theme) {
        setConfig('THEME.PRIMARY_COLOR', theme.primary);
        setConfig('THEME.SECONDARY_COLOR', theme.secondary);
        applyTheme();
    }
}

// Aplicar tema
function applyTheme() {
    const root = document.documentElement;
    root.style.setProperty('--primary-color', getConfig('THEME.PRIMARY_COLOR'));
    root.style.setProperty('--secondary-color', getConfig('THEME.SECONDARY_COLOR'));
}

// Usar configurações personalizadas
function setupCustomConfig() {
    // Configurações específicas do ambiente
    if (window.location.hostname === 'localhost') {
        setConfig('API.BASE_URL', 'http://localhost:8000/api/');
        setConfig('DEBUG.ENABLED', true);
        setConfig('UI.REFRESH_INTERVAL', 10000);
    } else if (window.location.hostname === 'staging.exemplo.com') {
        setConfig('API.BASE_URL', 'https://staging-api.exemplo.com/');
        setConfig('DEBUG.ENABLED', true);
    } else {
        setConfig('API.BASE_URL', 'https://api.exemplo.com/');
        setConfig('DEBUG.ENABLED', false);
    }
}
```

## 📊 Exemplo 4: Sistema de Cache

### Implementar Cache Inteligente
```javascript
// Sistema de cache simples
const cache = new Map();

// Função para obter dados com cache
async function getDataWithCache(key, fetchFunction, ttl = getConfig('CACHE.TTL')) {
    const cached = cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < ttl) {
        console.log(`Dados obtidos do cache: ${key}`);
        return cached.data;
    }
    
    try {
        const data = await fetchFunction();
        
        // Armazenar no cache
        cache.set(key, {
            data,
            timestamp: Date.now()
        });
        
        // Limpar cache se exceder limite
        if (cache.size > getConfig('CACHE.MAX_ITEMS')) {
            const firstKey = cache.keys().next().value;
            cache.delete(firstKey);
        }
        
        console.log(`Dados obtidos da API e armazenados no cache: ${key}`);
        return data;
    } catch (error) {
        console.error(`Erro ao buscar dados: ${key}`, error);
        throw error;
    }
}

// Usar cache para produtos
async function loadProductsWithCache() {
    return getDataWithCache('products', async () => {
        const response = await fetch(getApiUrl('products/list'));
        return response.json();
    });
}

// Usar cache para categorias
async function loadCategoriesWithCache() {
    return getDataWithCache('categories', async () => {
        const response = await fetch(getApiUrl('categories/list'));
        return response.json();
    });
}
```

## 🎯 Exemplo 5: Sistema de Eventos

### Implementar Sistema de Eventos Customizados
```javascript
// Sistema de eventos
const EventBus = {
    events: {},
    
    // Registrar evento
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    },
    
    // Emitir evento
    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Erro no callback do evento ${event}:`, error);
                }
            });
        }
    },
    
    // Remover evento
    off(event, callback) {
        if (this.events[event]) {
            const index = this.events[event].indexOf(callback);
            if (index > -1) {
                this.events[event].splice(index, 1);
            }
        }
    }
};

// Usar sistema de eventos
EventBus.on('product:created', (product) => {
    console.log('Novo produto criado:', product);
    refreshProductsList();
    showSuccess(`Produto "${product.name}" criado com sucesso!`);
});

EventBus.on('order:status-changed', (order) => {
    console.log('Status do pedido alterado:', order);
    playNotificationSound();
    updateOrderDisplay(order);
});

// Emitir eventos
function createProduct(productData) {
    // ... lógica de criação ...
    
    // Emitir evento
    EventBus.emit('product:created', newProduct);
}

function updateOrderStatus(orderId, newStatus) {
    // ... lógica de atualização ...
    
    // Emitir evento
    EventBus.emit('order:status-changed', updatedOrder);
}
```

## 🔍 Exemplo 6: Debug e Logs

### Sistema de Logs Estruturados
```javascript
// Sistema de logs
const Logger = {
    levels: {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3
    },
    
    currentLevel: getConfig('DEBUG.LOG_LEVEL'),
    
    // Função de log
    log(level, message, data = null) {
        if (getConfig('DEBUG.ENABLED') && this.levels[level] >= this.levels[this.currentLevel]) {
            const timestamp = new Date().toISOString();
            const logEntry = {
                timestamp,
                level,
                message,
                data,
                url: window.location.href,
                userAgent: navigator.userAgent
            };
            
            if (getConfig('DEBUG.SHOW_CONSOLE_LOGS')) {
                console.log(`[${level}] ${message}`, data || '');
            }
            
            // Armazenar logs (pode ser enviado para servidor)
            this.storeLog(logEntry);
        }
    },
    
    // Logs específicos
    debug(message, data) { this.log('DEBUG', message, data); },
    info(message, data) { this.log('INFO', message, data); },
    warn(message, data) { this.log('WARN', message, data); },
    error(message, data) { this.log('ERROR', message, data); },
    
    // Armazenar log
    storeLog(logEntry) {
        // Implementar armazenamento local ou envio para servidor
        const logs = JSON.parse(localStorage.getItem('admin_logs') || '[]');
        logs.push(logEntry);
        
        // Manter apenas últimos 100 logs
        if (logs.length > 100) {
            logs.shift();
        }
        
        localStorage.setItem('admin_logs', JSON.stringify(logs));
    }
};

// Usar sistema de logs
Logger.info('Sistema administrativo iniciado');
Logger.debug('Configurações carregadas', ADMIN_CONFIG);

try {
    // Alguma operação
    const result = await someAsyncOperation();
    Logger.info('Operação realizada com sucesso', result);
} catch (error) {
    Logger.error('Erro na operação', error);
}
```

## 📱 Exemplo 7: Responsividade e Mobile

### Detectar e Adaptar para Mobile
```javascript
// Detectar dispositivo
const DeviceUtils = {
    isMobile: () => window.innerWidth <= 768,
    isTablet: () => window.innerWidth > 768 && window.innerWidth <= 1024,
    isDesktop: () => window.innerWidth > 1024,
    
    // Adaptar interface para dispositivo
    adaptInterface() {
        if (this.isMobile()) {
            this.enableMobileFeatures();
        } else {
            this.enableDesktopFeatures();
        }
    },
    
    // Recursos mobile
    enableMobileFeatures() {
        // Reduzir intervalo de atualização
        setConfig('UI.REFRESH_INTERVAL', 10000);
        
        // Desabilitar animações complexas
        setConfig('UI.ANIMATION_DURATION', 150);
        
        // Adicionar classes CSS para mobile
        document.body.classList.add('mobile-view');
        
        // Configurar gestos de touch
        this.setupTouchGestures();
    },
    
    // Recursos desktop
    enableDesktopFeatures() {
        // Restaurar configurações padrão
        setConfig('UI.REFRESH_INTERVAL', 5000);
        setConfig('UI.ANIMATION_DURATION', 300);
        
        // Remover classes mobile
        document.body.classList.remove('mobile-view');
    },
    
    // Configurar gestos de touch
    setupTouchGestures() {
        let startY = 0;
        let startX = 0;
        
        document.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
            startX = e.touches[0].clientX;
        });
        
        document.addEventListener('touchend', (e) => {
            const endY = e.changedTouches[0].clientY;
            const endX = e.changedTouches[0].clientX;
            
            const diffY = startY - endY;
            const diffX = startX - endX;
            
            // Swipe para baixo = atualizar
            if (Math.abs(diffY) > 50 && diffY > 0) {
                refreshOrders();
            }
            
            // Swipe para direita = voltar
            if (Math.abs(diffX) > 50 && diffX > 0) {
                history.back();
            }
        });
    }
};

// Inicializar adaptação de interface
DeviceUtils.adaptInterface();

// Adaptar quando redimensionar
window.addEventListener('resize', () => {
    DeviceUtils.adaptInterface();
});
```

## 🎨 Exemplo 8: Temas e Personalização

### Sistema de Temas Dinâmicos
```javascript
// Sistema de temas
const ThemeManager = {
    themes: {
        'default': {
            name: 'Padrão',
            colors: {
                primary: '#667eea',
                secondary: '#764ba2',
                success: '#28a745',
                warning: '#ffc107',
                danger: '#dc3545'
            }
        },
        'dark': {
            name: 'Escuro',
            colors: {
                primary: '#2c3e50',
                secondary: '#34495e',
                success: '#27ae60',
                warning: '#f39c12',
                danger: '#e74c3c'
            }
        },
        'light': {
            name: 'Claro',
            colors: {
                primary: '#3498db',
                secondary: '#2980b9',
                success: '#2ecc71',
                warning: '#f1c40f',
                danger: '#e67e22'
            }
        }
    },
    
    currentTheme: 'default',
    
    // Aplicar tema
    applyTheme(themeName) {
        const theme = this.themes[themeName];
        if (!theme) return;
        
        this.currentTheme = themeName;
        
        // Aplicar cores CSS
        Object.entries(theme.colors).forEach(([key, value]) => {
            document.documentElement.style.setProperty(`--${key}-color`, value);
        });
        
        // Salvar preferência
        localStorage.setItem('admin_theme', themeName);
        
        // Atualizar interface
        this.updateThemeSelector();
        
        // Emitir evento
        EventBus.emit('theme:changed', themeName);
    },
    
    // Carregar tema salvo
    loadSavedTheme() {
        const savedTheme = localStorage.getItem('admin_theme');
        if (savedTheme && this.themes[savedTheme]) {
            this.applyTheme(savedTheme);
        }
    },
    
    // Atualizar seletor de tema
    updateThemeSelector() {
        const selector = document.getElementById('themeSelector');
        if (selector) {
            selector.value = this.currentTheme;
        }
    },
    
    // Criar seletor de tema
    createThemeSelector() {
        const container = document.createElement('div');
        container.className = 'theme-selector';
        
        const label = document.createElement('label');
        label.textContent = 'Tema: ';
        
        const select = document.createElement('select');
        select.id = 'themeSelector';
        
        Object.entries(this.themes).forEach(([key, theme]) => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = theme.name;
            select.appendChild(option);
        });
        
        select.addEventListener('change', (e) => {
            this.applyTheme(e.target.value);
        });
        
        container.appendChild(label);
        container.appendChild(select);
        
        return container;
    }
};

// Inicializar sistema de temas
ThemeManager.loadSavedTheme();

// Adicionar seletor de tema ao header
document.addEventListener('DOMContentLoaded', () => {
    const headerActions = document.querySelector('.header-actions');
    if (headerActions) {
        const themeSelector = ThemeManager.createThemeSelector();
        headerActions.appendChild(themeSelector);
    }
});
```

## 📝 Conclusão

Estes exemplos demonstram como usar efetivamente a nova estrutura modular:

1. **Separação clara** entre HTML, CSS e JavaScript
2. **Reutilização** de utilitários e configurações
3. **Manutenibilidade** com código organizado e focado
4. **Extensibilidade** para novas funcionalidades
5. **Performance** com cache e otimizações
6. **Debug** com sistema de logs estruturados
7. **Responsividade** com adaptação automática
8. **Personalização** com sistema de temas

Use estes padrões para manter a consistência e qualidade do código ao adicionar novas funcionalidades ao sistema administrativo.
