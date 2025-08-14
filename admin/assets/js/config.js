/**
 * Configurações do Sistema Administrativo
 * Arquivo centralizado para todas as configurações
 */

const ADMIN_CONFIG = {
    // Configurações da API
    API: {
        BASE_URL: '../api/',
        ENDPOINTS: {
            AUTH: {
                LOGIN: 'auth/login',
                VERIFY: 'auth/verify',
                LOGOUT: 'auth/logout'
            },
            ORDERS: {
                LIST: 'orders/list',
                UPDATE_STATUS: 'orders/update-status',
                DETAILS: 'orders/details'
            },
            PRODUCTS: {
                LIST: 'products/list',
                CREATE: 'products/create',
                UPDATE: 'products/update',
                DELETE: 'products/delete',
                TOGGLE_STATUS: 'products/toggle-status'
            },
            CATEGORIES: {
                LIST: 'categories/list',
                CREATE: 'categories/create',
                UPDATE: 'categories/update',
                DELETE: 'categories/delete'
            },
            PIZZA: {
                SIZES: {
                    LIST: 'pizza/sizes/list',
                    CREATE: 'pizza/sizes/create',
                    UPDATE: 'pizza/sizes/update',
                    DELETE: 'pizza/sizes/delete',
                    TOGGLE: 'pizza/sizes/toggle'
                },
                FLAVORS: {
                    LIST: 'pizza/flavors/list',
                    CREATE: 'pizza/flavors/create',
                    UPDATE: 'pizza/flavors/update',
                    DELETE: 'pizza/flavors/delete',
                    TOGGLE: 'pizza/flavors/toggle'
                },
                EXTRAS: {
                    LIST: 'pizza/extras/list',
                    CREATE: 'pizza/extras/create',
                    UPDATE: 'pizza/extras/update',
                    DELETE: 'pizza/extras/delete',
                    TOGGLE: 'pizza/extras/toggle'
                }
            }
        }
    },

    // Configurações de interface
    UI: {
        REFRESH_INTERVAL: 5000, // 5 segundos
        ANIMATION_DURATION: 300,
        MODAL_ANIMATION_DURATION: 200,
        TOAST_DURATION: 3000
    },

    // Configurações de notificação
    NOTIFICATIONS: {
        SOUND_ENABLED: true,
        SOUND_FILE: '../order-sound.mp3',
        AUTO_PLAY_INTERVAL: 10000 // 10 segundos
    },

    // Configurações de paginação
    PAGINATION: {
        ITEMS_PER_PAGE: 20,
        MAX_PAGES_SHOWN: 5
    },

    // Configurações de filtros
    FILTERS: {
        DEBOUNCE_DELAY: 300,
        MIN_SEARCH_LENGTH: 2
    },

    // Configurações de validação
    VALIDATION: {
        MIN_NAME_LENGTH: 2,
        MAX_NAME_LENGTH: 100,
        MIN_DESCRIPTION_LENGTH: 0,
        MAX_DESCRIPTION_LENGTH: 500,
        MIN_PRICE: 0,
        MAX_PRICE: 9999.99,
        MIN_PREP_TIME: 0,
        MAX_PREP_TIME: 180
    },

    // Configurações de impressão
    PRINT: {
        KITCHEN_TEMPLATE: 'kitchen',
        CUSTOMER_TEMPLATE: 'customer',
        PAGE_SIZE: 'A4',
        MARGIN: '10mm',
        // URL da logo para impressão (altere o caminho do arquivo conforme desejar)
        LOGO_URL: '',
        // Nome do estabelecimento (usado quando não houver logo)
        BUSINESS_NAME: 'Seu Estabelecimento'
    },

    // Configurações de tema
    THEME: {
        PRIMARY_COLOR: '#667eea',
        SECONDARY_COLOR: '#764ba2',
        SUCCESS_COLOR: '#28a745',
        WARNING_COLOR: '#ffc107',
        DANGER_COLOR: '#dc3545',
        INFO_COLOR: '#17a2b8'
    },

    // Configurações de idioma
    LANGUAGE: {
        DEFAULT: 'pt-BR',
        SUPPORTED: ['pt-BR', 'en-US', 'es-ES']
    },

    // Configurações de cache
    CACHE: {
        ENABLED: true,
        TTL: 300000, // 5 minutos
        MAX_ITEMS: 100
    },

    // Configurações de debug
    DEBUG: {
        ENABLED: false,
        LOG_LEVEL: 'info', // 'debug', 'info', 'warn', 'error'
        SHOW_CONSOLE_LOGS: true
    }
};

// Função para obter configuração
function getConfig(path) {
    const keys = path.split('.');
    let value = ADMIN_CONFIG;
    
    for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
            value = value[key];
        } else {
            return undefined;
        }
    }
    
    return value;
}

// Função para definir configuração
function setConfig(path, value) {
    const keys = path.split('.');
    let current = ADMIN_CONFIG;
    
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!(key in current) || typeof current[key] !== 'object') {
            current[key] = {};
        }
        current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
}

// Função para obter URL da API
function getApiUrl(endpoint) {
    return ADMIN_CONFIG.API.BASE_URL + endpoint;
}

// Função para obter endpoint da API
function getApiEndpoint(category, action) {
    const categoryEndpoints = ADMIN_CONFIG.API.ENDPOINTS[category.toUpperCase()];
    if (categoryEndpoints && categoryEndpoints[action.toUpperCase()]) {
        return categoryEndpoints[action.toUpperCase()];
    }
    return null;
}

// Exportar para uso em outros módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ADMIN_CONFIG, getConfig, setConfig, getApiUrl, getApiEndpoint };
}

// Compatibilidade: alias global para código legado que usa CONFIG
// Garante que referências a CONFIG.API_BASE_URL continuem funcionando
if (typeof window !== 'undefined') {
    window.ADMIN_CONFIG = window.ADMIN_CONFIG || ADMIN_CONFIG;
    window.CONFIG = window.ADMIN_CONFIG;
    // Compat: expor CONFIG.API_BASE_URL além de CONFIG.API.BASE_URL
    if (!window.CONFIG.API_BASE_URL && window.ADMIN_CONFIG && window.ADMIN_CONFIG.API && window.ADMIN_CONFIG.API.BASE_URL) {
        window.CONFIG.API_BASE_URL = window.ADMIN_CONFIG.API.BASE_URL;
    }
}