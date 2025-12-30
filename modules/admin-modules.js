// Дополнительные модули для DANDY CRM
// Расширенная функциональность для всех разделов админки

class AdminModules {
    constructor(adminInstance) {
        this.admin = adminInstance;
        this.initModules();
    }
    
    initModules() {
        console.log('🔧 AdminModules: Initializing...');
        
        // Инициализируем модули только если они доступны
        this.initProjectSwitcher();
        this.initSoundNotifications();
        this.initInventoryModule();
        this.initReportsModule();
        this.initKDSModule();
        this.initCouriersModule();
        this.initProductCardsModule();
        this.initRecipesModule();
        this.initPromotionsModule();
        this.initWarehouseModule();
        this.initCashierReportModule();
        this.initIntegrationsModule();
        
        console.log('✅ AdminModules: All modules initialized');
    }
    
    initProjectSwitcher() {
        if (window.projectSwitcher) {
            try {
                window.projectSwitcher.init();
                console.log('✅ Project Switcher initialized');
            } catch (error) {
                console.warn('⚠️ Project Switcher initialization failed:', error);
            }
        }
    }
    
    initSoundNotifications() {
        if (window.SoundNotificationsModule) {
            try {
                this.soundNotifications = new SoundNotificationsModule();
                console.log('✅ Sound Notifications initialized');
            } catch (error) {
                console.warn('⚠️ Sound Notifications initialization failed:', error);
            }
        }
    }
    
    initInventoryModule() {
        if (window.InventoryModule) {
            try {
                this.inventoryModule = new InventoryModule();
                console.log('✅ Inventory Module initialized');
            } catch (error) {
                console.warn('⚠️ Inventory Module initialization failed:', error);
            }
        }
    }
    
    initReportsModule() {
        if (window.ReportsModule) {
            try {
                this.reportsModule = new ReportsModule();
                console.log('✅ Reports Module initialized');
            } catch (error) {
                console.warn('⚠️ Reports Module initialization failed:', error);
            }
        }
    }
    
    initKDSModule() {
        if (window.KDSModule) {
            try {
                this.kdsModule = new KDSModule();
                console.log('✅ KDS Module initialized');
            } catch (error) {
                console.warn('⚠️ KDS Module initialization failed:', error);
            }
        }
    }
    
    initCouriersModule() {
        if (window.CouriersModule) {
            try {
                this.couriersModule = new CouriersModule();
                console.log('✅ Couriers Module initialized');
            } catch (error) {
                console.warn('⚠️ Couriers Module initialization failed:', error);
            }
        }
    }
    
    initProductCardsModule() {
        if (window.ProductCardsManager) {
            try {
                this.productCardsModule = new ProductCardsManager();
                console.log('✅ Product Cards Module initialized');
            } catch (error) {
                console.warn('⚠️ Product Cards Module initialization failed:', error);
            }
        }
    }
    
    initRecipesModule() {
        if (window.RecipesModule) {
            try {
                this.recipesModule = new RecipesModule();
                console.log('✅ Recipes Module initialized');
            } catch (error) {
                console.warn('⚠️ Recipes Module initialization failed:', error);
            }
        }
    }
    
    initPromotionsModule() {
        if (window.PromotionsModule) {
            try {
                this.promotionsModule = new PromotionsModule();
                console.log('✅ Promotions Module initialized');
            } catch (error) {
                console.warn('⚠️ Promotions Module initialization failed:', error);
            }
        }
    }
    
    initWarehouseModule() {
        if (window.WarehouseModule) {
            try {
                this.warehouseModule = new WarehouseModule();
                console.log('✅ Warehouse Module initialized');
            } catch (error) {
                console.warn('⚠️ Warehouse Module initialization failed:', error);
            }
        }
    }
    
    initCashierReportModule() {
        if (window.CashierReportModule) {
            try {
                this.cashierReportModule = new CashierReportModule();
                console.log('✅ Cashier Report Module initialized');
            } catch (error) {
                console.warn('⚠️ Cashier Report Module initialization failed:', error);
            }
        }
    }
    
    initIntegrationsModule() {
        // Инициализируем IntegrationsConfigModule
        if (window.IntegrationsConfigModule) {
            try {
                this.integrationsModule = new IntegrationsConfigModule();
                window.integrationsConfig = this.integrationsModule;
                console.log('✅ Integrations Config Module initialized');
            } catch (error) {
                console.warn('⚠️ Integrations Config Module initialization failed:', error);
            }
        }
    }
    
    // Метод для обновления контента интеграций
    updateIntegrationsContent() {
        if (window.integrationsConfig) {
            window.integrationsConfig.render();
        } else if (window.initIntegrations) {
            window.initIntegrations();
        } else {
            console.warn('⚠️ Integrations module not available');
        }
    }
    
    // Методы для работы с модулями
    getModule(moduleName) {
        return this[moduleName + 'Module'] || null;
    }
    
    isModuleLoaded(moduleName) {
        return !!this[moduleName + 'Module'];
    }
    
    // Метод для обновления всех модулей
    updateAllModules() {
        Object.keys(this).forEach(key => {
            if (key.endsWith('Module') && this[key] && typeof this[key].update === 'function') {
                try {
                    this[key].update();
                } catch (error) {
                    console.warn(`⚠️ Error updating ${key}:`, error);
                }
            }
        });
    }

    // Эти методы удалены, так как теперь модули вызываются напрямую из admin.js
}

// Глобальная функция для инициализации модулей
function initializeAdminModules(adminInstance) {
    if (!window.adminModules) {
        window.adminModules = new AdminModules(adminInstance);
    }
    return window.adminModules;
}

// Экспортируем для использования в других модулях
window.AdminModules = AdminModules;
window.initializeAdminModules = initializeAdminModules;