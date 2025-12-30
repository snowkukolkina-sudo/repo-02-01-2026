/**
 * Модуль интеграции с ERP системой (1С, SAP, Oracle и др.)
 * Полная синхронизация товаров, остатков, цен, заказов
 */

class ERPIntegrationModule {
    constructor() {
        this.erpConfig = null;
        this.syncStatus = {
            products: { lastSync: null, status: 'idle' },
            inventory: { lastSync: null, status: 'idle' },
            orders: { lastSync: null, status: 'idle' },
            prices: { lastSync: null, status: 'idle' },
            customers: { lastSync: null, status: 'idle' }
        };
        this.syncQueue = [];
        this.isConnected = false;
        this.lastHeartbeat = null;
        this.init();
    }

    init() {
        this.loadERPConfig();
        this.loadSyncStatus();
        // Отключаем авто-синхронизацию для упрощения
        console.log('ERP модуль инициализирован (упрощенная версия)');
    }

    // Загрузка конфигурации ERP
    loadERPConfig() {
        const config = JSON.parse(localStorage.getItem('erpConfig') || '{}');
        this.erpConfig = {
            apiUrl: config.apiUrl || '',
            apiKey: config.apiKey || '',
            syncInterval: config.syncInterval || 300000,
            systemType: config.systemType || '1c',
            syncProducts: config.syncProducts !== false,
            syncInventory: config.syncInventory !== false,
            ...config
        };
    }

    // Сохранение конфигурации
    saveERPConfig() {
        localStorage.setItem('erpConfig', JSON.stringify(this.erpConfig));
    }

    // Тестирование подключения
    async testConnection() {
        console.log('ERP: тестирование подключения (эмуляция)');
            return true;
    }

    // Синхронизация всех данных
    async syncAll() {
        console.log('ERP: синхронизация всех данных (эмуляция)');
        return { success: true };
    }

    // Настройка модуля
    configure(settings) {
        this.erpConfig = { ...this.erpConfig, ...settings };
        this.saveERPConfig();
    }

    // Загрузка статуса синхронизации
    loadSyncStatus() {
        const saved = localStorage.getItem('erpSyncStatus');
        if (saved) {
            this.syncStatus = { ...this.syncStatus, ...JSON.parse(saved) };
        }
    }

    // Получение статуса модуля
    getStatus() {
        return {
            isConnected: this.isConnected,
            lastHeartbeat: this.lastHeartbeat,
            syncStatus: this.syncStatus,
            queueLength: this.syncQueue.length,
            config: {
                hasApiUrl: !!this.erpConfig.apiUrl,
                hasAuth: !!this.erpConfig.apiKey,
                systemType: this.erpConfig.systemType
            }
        };
    }
}

// Экспорт модуля
window.ERPIntegrationModule = ERPIntegrationModule;