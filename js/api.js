/**
 * DANDY POS API Helper
 * Единый модуль для работы с backend API
 */

class DandyAPI {
    constructor() {
        // Определяем базовый URL API
        this.baseURL = window.location.origin + '/api';
        this.token = localStorage.getItem('dandy_auth_token');
    }

    // ========== Приватные методы ==========
    
    /**
     * Выполняет HTTP запрос к API
     */
    async request(endpoint, options = {}) {
        const url = this.baseURL + endpoint;
        
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        // Добавляем токен авторизации если есть
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const config = {
            ...options,
            headers
        };

        try {
            console.log(`API Request: ${options.method || 'GET'} ${endpoint}`);
            const response = await fetch(url, config);
            
            // Проверяем статус ответа
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(error.error || `HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log(`API Response:`, data);
            return data;
        } catch (error) {
            console.error(`API Error: ${endpoint}`, error);
            throw error;
        }
    }

    /**
     * GET запрос
     */
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        
        return this.request(url, {
            method: 'GET'
        });
    }

    /**
     * POST запрос
     */
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * PUT запрос
     */
    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE запрос
     */
    async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }

    // ========== Авторизация ==========
    
    /**
     * Вход в систему
     */
    async login(email, password, site = '111') {
        const response = await this.post('/auth/login', { email, password, site });
        
        if (response.success && response.data.token) {
            this.token = response.data.token;
            localStorage.setItem('dandy_auth_token', this.token);
            localStorage.setItem('dandy_user', JSON.stringify(response.data.user));
        }
        
        return response;
    }

    /**
     * Выход из системы
     */
    logout() {
        this.token = null;
        localStorage.removeItem('dandy_auth_token');
        localStorage.removeItem('dandy_user');
    }

    /**
     * Получить текущего пользователя
     */
    getCurrentUser() {
        const userStr = localStorage.getItem('dandy_user');
        return userStr ? JSON.parse(userStr) : null;
    }

    /**
     * Проверка авторизации
     */
    isAuthenticated() {
        return !!this.token;
    }

    // ========== Продукты и меню ==========
    
    /**
     * Получить все продукты
     */
    async getProducts(params = {}) {
        return this.get('/products', params);
    }

    /**
     * Получить категории
     */
    async getCategories() {
        return this.get('/categories');
    }

    /**
     * Получить продукт по ID
     */
    async getProduct(id) {
        return this.get(`/products/${id}`);
    }

    // ========== Заказы ==========
    
    /**
     * Создать заказ
     */
    async createOrder(orderData) {
        return this.post('/orders', orderData);
    }

    /**
     * Получить все заказы
     */
    async getOrders(params = {}) {
        return this.get('/orders', params);
    }

    /**
     * Получить заказ по ID
     */
    async getOrder(id) {
        return this.get(`/orders/${id}`);
    }

    /**
     * Обновить статус заказа
     */
    async updateOrderStatus(id, status) {
        return this.put(`/orders/${id}/status`, { status });
    }

    /**
     * Получить статистику заказов
     */
    async getOrderStats() {
        return this.get('/orders/stats');
    }

    // ========== Платежи ==========
    
    /**
     * Создать платеж
     */
    async createPayment(paymentData) {
        return this.post('/payments', paymentData);
    }

    // ========== Фискализация ==========
    
    /**
     * Создать фискальный чек
     */
    async createFiscalReceipt(receiptData) {
        return this.post('/fiscal/receipt', receiptData);
    }

    // ========== Dashboard ==========
    
    /**
     * Получить статистику для дашборда
     */
    async getDashboardStats() {
        return this.get('/dashboard/stats');
    }

    // ========== Склад ==========
    
    /**
     * Получить остатки на складе
     */
    async getInventory(params = {}) {
        return this.get('/inventory', params);
    }

    /**
     * Обновить остаток товара
     */
    async updateInventoryItem(id, data) {
        return this.put(`/inventory/${id}`, data);
    }

    // ========== Настройки ==========
    
    /**
     * Получить настройки
     */
    async getSettings() {
        return this.get('/settings');
    }

    /**
     * Обновить настройки
     */
    async updateSettings(settings) {
        return this.put('/settings', settings);
    }

    // ========== Health Check ==========
    
    /**
     * Проверка здоровья API
     */
    async healthCheck() {
        return this.get('/health');
    }
}

// Создаем глобальный экземпляр API
window.dandyAPI = new DandyAPI();

// Экспортируем для использования в модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DandyAPI;
}
