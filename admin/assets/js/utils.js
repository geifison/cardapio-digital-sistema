/**
 * Utilitários do Sistema Administrativo
 * Funções comuns e helpers
 */

// Utilitários de formatação
const FormatUtils = {
    // Formatar moeda brasileira
    currency: (value, currency = 'R$') => {
        if (typeof value !== 'number') {
            value = parseFloat(value) || 0;
        }
        return `${currency} ${value.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
    },

    // Formatar data
    date: (date, format = 'DD/MM/YYYY HH:mm') => {
        if (!date) return '';
        
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        
        return format
            .replace('DD', day)
            .replace('MM', month)
            .replace('YYYY', year)
            .replace('HH', hours)
            .replace('mm', minutes);
    },

    // Formatar tempo decorrido
    timeAgo: (date) => {
        if (!date) return '';
        
        const now = new Date();
        const past = new Date(date);
        const diffMs = now - past;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffMins < 1) return 'Agora mesmo';
        if (diffMins < 60) return `${diffMins} min atrás`;
        if (diffHours < 24) return `${diffHours}h atrás`;
        if (diffDays < 7) return `${diffDays} dias atrás`;
        
        return FormatUtils.date(date, 'DD/MM/YYYY');
    },

    // Formatar número de telefone
    phone: (phone) => {
        if (!phone) return '';
        
        const cleaned = phone.replace(/\D/g, '');
        const match = cleaned.match(/^(\d{2})(\d{4,5})(\d{4})$/);
        
        if (match) {
            return `(${match[1]}) ${match[2]}-${match[3]}`;
        }
        
        return phone;
    },

    // Formatar CPF/CNPJ
    document: (doc) => {
        if (!doc) return '';
        
        const cleaned = doc.replace(/\D/g, '');
        
        if (cleaned.length === 11) {
            // CPF
            return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        } else if (cleaned.length === 14) {
            // CNPJ
            return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        }
        
        return doc;
    }
};

// Utilitários de validação
const ValidationUtils = {
    // Validar email
    email: (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    // Validar CPF
    cpf: (cpf) => {
        const cleaned = cpf.replace(/\D/g, '');
        if (cleaned.length !== 11) return false;
        
        // Verificar dígitos repetidos
        if (/^(\d)\1{10}$/.test(cleaned)) return false;
        
        // Validar primeiro dígito verificador
        let sum = 0;
        for (let i = 0; i < 9; i++) {
            sum += parseInt(cleaned.charAt(i)) * (10 - i);
        }
        let remainder = (sum * 10) % 11;
        if (remainder === 10 || remainder === 11) remainder = 0;
        if (remainder !== parseInt(cleaned.charAt(9))) return false;
        
        // Validar segundo dígito verificador
        sum = 0;
        for (let i = 0; i < 10; i++) {
            sum += parseInt(cleaned.charAt(i)) * (11 - i);
        }
        remainder = (sum * 10) % 11;
        if (remainder === 10 || remainder === 11) remainder = 0;
        if (remainder !== parseInt(cleaned.charAt(10))) return false;
        
        return true;
    },

    // Validar telefone
    phone: (phone) => {
        const cleaned = phone.replace(/\D/g, '');
        return cleaned.length >= 10 && cleaned.length <= 11;
    },

    // Validar preço
    price: (price) => {
        const num = parseFloat(price);
        return !isNaN(num) && num >= 0;
    },

    // Validar string não vazia
    required: (value) => {
        return value !== null && value !== undefined && String(value).trim().length > 0;
    },

    // Validar comprimento mínimo
    minLength: (value, min) => {
        return String(value).length >= min;
    },

    // Validar comprimento máximo
    maxLength: (value, max) => {
        return String(value).length <= max;
    }
};

// Utilitários de DOM
const DOMUtils = {
    // Criar elemento com classes
    createElement: (tag, className = '', innerHTML = '') => {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (innerHTML) element.innerHTML = innerHTML;
        return element;
    },

    // Adicionar classes
    addClasses: (element, ...classes) => {
        element.classList.add(...classes);
    },

    // Remover classes
    removeClasses: (element, ...classes) => {
        element.classList.remove(...classes);
    },

    // Alternar classes
    toggleClasses: (element, ...classes) => {
        classes.forEach(cls => element.classList.toggle(cls));
    },

    // Verificar se elemento tem classe
    hasClass: (element, className) => {
        return element.classList.contains(className);
    },

    // Mostrar elemento
    show: (element) => {
        element.style.display = '';
        element.style.visibility = 'visible';
        element.style.opacity = '1';
    },

    // Ocultar elemento
    hide: (element) => {
        element.style.display = 'none';
        element.style.visibility = 'hidden';
        element.style.opacity = '0';
    },

    // Fade in
    fadeIn: (element, duration = 300) => {
        element.style.opacity = '0';
        element.style.display = '';
        
        let start = null;
        const animate = (timestamp) => {
            if (!start) start = timestamp;
            const progress = timestamp - start;
            const opacity = Math.min(progress / duration, 1);
            
            element.style.opacity = opacity;
            
            if (progress < duration) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    },

    // Fade out
    fadeOut: (element, duration = 300) => {
        const startOpacity = parseFloat(getComputedStyle(element).opacity);
        let start = null;
        
        const animate = (timestamp) => {
            if (!start) start = timestamp;
            const progress = timestamp - start;
            const opacity = Math.max(startOpacity - (progress / duration), 0);
            
            element.style.opacity = opacity;
            
            if (progress < duration) {
                requestAnimationFrame(animate);
            } else {
                element.style.display = 'none';
            }
        };
        
        requestAnimationFrame(animate);
    }
};

// Utilitários de array/objeto
const ObjectUtils = {
    // Clonar objeto
    clone: (obj) => {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => ObjectUtils.clone(item));
        if (typeof obj === 'object') {
            const cloned = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    cloned[key] = ObjectUtils.clone(obj[key]);
                }
            }
            return cloned;
        }
    },

    // Mesclar objetos
    merge: (target, ...sources) => {
        if (!sources.length) return target;
        const source = sources.shift();
        
        if (source && typeof source === 'object') {
            for (const key in source) {
                if (source.hasOwnProperty(key)) {
                    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                        target[key] = target[key] || {};
                        ObjectUtils.merge(target[key], source[key]);
                    } else {
                        target[key] = source[key];
                    }
                }
            }
        }
        
        return ObjectUtils.merge(target, ...sources);
    },

    // Verificar se objeto está vazio
    isEmpty: (obj) => {
        if (obj == null) return true;
        if (Array.isArray(obj) || typeof obj === 'string') return obj.length === 0;
        if (obj instanceof Map || obj instanceof Set) return obj.size === 0;
        if (typeof obj === 'object') return Object.keys(obj).length === 0;
        return false;
    },

    // Obter valor aninhado de objeto
    get: (obj, path, defaultValue = undefined) => {
        const keys = path.split('.');
        let result = obj;
        
        for (const key of keys) {
            if (result && typeof result === 'object' && key in result) {
                result = result[key];
            } else {
                return defaultValue;
            }
        }
        
        return result;
    },

    // Definir valor aninhado em objeto
    set: (obj, path, value) => {
        const keys = path.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[keys[keys.length - 1]] = value;
        return obj;
    }
};

// Utilitários de string
const StringUtils = {
    // Capitalizar primeira letra
    capitalize: (str) => {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    },

    // Capitalizar todas as palavras
    titleCase: (str) => {
        if (!str) return '';
        return str.replace(/\w\S*/g, (txt) => {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
    },

    // Remover acentos
    removeAccents: (str) => {
        if (!str) return '';
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    },

    // Gerar slug
    slugify: (str) => {
        if (!str) return '';
        return str
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
    },

    // Truncar texto
    truncate: (str, length = 100, suffix = '...') => {
        if (!str || str.length <= length) return str;
        return str.substring(0, length - suffix.length) + suffix;
    },

    // Escapar HTML
    escapeHtml: (str) => {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};

// Utilitários de data
const DateUtils = {
    // Obter data atual
    now: () => new Date(),

    // Obter início do dia
    startOfDay: (date = new Date()) => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
    },

    // Obter fim do dia
    endOfDay: (date = new Date()) => {
        const d = new Date(date);
        d.setHours(23, 59, 59, 999);
        return d;
    },

    // Adicionar dias
    addDays: (date, days) => {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        return d;
    },

    // Adicionar meses
    addMonths: (date, months) => {
        const d = new Date(date);
        d.setMonth(d.getMonth() + months);
        return d;
    },

    // Adicionar anos
    addYears: (date, years) => {
        const d = new Date(date);
        d.setFullYear(d.getFullYear() + years);
        return d;
    },

    // Verificar se é hoje
    isToday: (date) => {
        const today = new Date();
        const d = new Date(date);
        return d.getDate() === today.getDate() &&
               d.getMonth() === today.getMonth() &&
               d.getFullYear() === today.getFullYear();
    },

    // Verificar se é este mês
    isThisMonth: (date) => {
        const today = new Date();
        const d = new Date(date);
        return d.getMonth() === today.getMonth() &&
               d.getFullYear() === today.getFullYear();
    },

    // Verificar se é este ano
    isThisYear: (date) => {
        const today = new Date();
        const d = new Date(date);
        return d.getFullYear() === today.getFullYear();
    }
};

// Exportar utilitários
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        FormatUtils,
        ValidationUtils,
        DOMUtils,
        ObjectUtils,
        StringUtils,
        DateUtils
    };
}
