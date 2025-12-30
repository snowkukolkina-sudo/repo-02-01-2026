/**
 * DANDY Pizza & Sushi - Frontend Configuration
 * Автоматически определяет URL для API на основе текущего домена
 */

const DANDY_CONFIG = {
    // Автоматическое определение базового URL
    BASE_URL: window.location.origin,
    
    // API Endpoints
    API: {
        BASE: window.location.origin + '/api',
        ORDERS: '/api/orders',
        PRODUCTS: '/api/products',
        CATEGORIES: '/api/categories',
        PROMOTIONS: '/api/promotions'
    },
    
    // Версия API
    VERSION: '1.0',
    
    // Настройки
    SETTINGS: {
        CURRENCY: '₽',
        LOCALE: 'ru-RU',
        TIMEZONE: 'Europe/Moscow'
    }
};

// Функция для получения полного URL API
function getApiUrl(endpoint) {
    // Если endpoint уже начинается с /, убираем дублирование
    if (endpoint.startsWith('/api')) {
        return DANDY_CONFIG.BASE_URL + endpoint;
    }
    return DANDY_CONFIG.BASE_URL + '/api' + (endpoint.startsWith('/') ? endpoint : '/' + endpoint);
}

// Экспорт для использования в других скриптах
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DANDY_CONFIG, getApiUrl };
}

console.log('✅ DANDY Config loaded:', DANDY_CONFIG.BASE_URL);

