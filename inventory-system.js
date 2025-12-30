/**
 * DANDY Inventory System — Товароучётная система
 * Version: 1.0.0
 * Date: 30.09.2025
 */

const INVENTORY_DEFAULT_STATE = {
    products: [
        { id: 1, code: 'ING-001', name: 'Лосось филе', type: 'ingredient', category: 'Рыба и морепродукты', baseUnit: 'кг', isAlcohol: false, minStock: 5, currentStock: 0.8, price: 1200, salePrice: 0, description: 'Свежий лосось для роллов и тартаров', visible_on_site: false },
        { id: 2, code: 'ING-002', name: 'Креветки королевские', type: 'ingredient', category: 'Рыба и морепродукты', baseUnit: 'кг', isAlcohol: false, minStock: 3, currentStock: 1.2, price: 1800, salePrice: 0, description: 'Очищенные креветки 21/25', visible_on_site: false },
        { id: 3, code: 'SEMI-001', name: 'Соус томатный базовый', type: 'semi_product', category: 'Соусы', baseUnit: 'л', isAlcohol: false, minStock: 10, currentStock: 8.5, price: 180, salePrice: 0, description: 'База для пиццы, готова к использованию', visible_on_site: false },
        { id: 4, code: 'ING-004', name: 'Сыр Моцарелла 45%', type: 'ingredient', category: 'Молочные продукты', baseUnit: 'кг', isAlcohol: false, minStock: 20, currentStock: 12.4, price: 450, salePrice: 0, description: 'Итальянская моцарелла для пиццы', visible_on_site: false },
        { id: 5, code: 'SEMI-002', name: 'Тесто для пиццы (заготовка)', type: 'semi_product', category: 'Полуфабрикаты', baseUnit: 'шт', isAlcohol: false, minStock: 30, currentStock: 15, price: 85, salePrice: 0, description: 'Основа 33 см, шоковая заморозка', visible_on_site: false },
        { id: 6, code: 'PKG-001', name: 'Коробка пиццы 33 см', type: 'package', category: 'Упаковка', baseUnit: 'шт', isAlcohol: false, minStock: 200, currentStock: 150, price: 14, salePrice: 0, description: 'Фирменная коробка с печатью', visible_on_site: false },
        { id: 7, code: 'ING-007', name: 'Колбаса Пепперони', type: 'ingredient', category: 'Колбасы', baseUnit: 'кг', isAlcohol: false, minStock: 5, currentStock: 3.2, price: 950, salePrice: 0, description: 'Острая салями', visible_on_site: false },
        { id: 8, code: 'ING-008', name: 'Рис для роллов', type: 'ingredient', category: 'Бакалея', baseUnit: 'кг', isAlcohol: false, minStock: 20, currentStock: 18.5, price: 180, salePrice: 0, description: 'Японский рис, 25 кг', visible_on_site: false },
        { id: 9, code: 'ING-009', name: 'Сыр Филадельфия', type: 'ingredient', category: 'Молочные продукты', baseUnit: 'кг', isAlcohol: false, minStock: 8, currentStock: 6.5, price: 750, salePrice: 0, description: 'Для холодных роллов', visible_on_site: false },
        { id: 10, code: 'ING-010', name: 'Авокадо Хасс', type: 'ingredient', category: 'Овощи и зелень', baseUnit: 'шт', isAlcohol: false, minStock: 40, currentStock: 25, price: 70, salePrice: 0, description: 'Калибр 16, спелый', visible_on_site: false },
        { id: 101, code: 'DISH-101', name: 'Пицца Маргарита 33 см', type: 'dish', category: 'Пицца', baseUnit: 'шт', isAlcohol: false, minStock: 5, currentStock: 12, price: 190, salePrice: 590, description: 'Классическая пицца с моцареллой и томатами', visible_on_site: true },
        { id: 102, code: 'DISH-102', name: 'Пицца Пепперони 33 см', type: 'dish', category: 'Пицца', baseUnit: 'шт', isAlcohol: false, minStock: 5, currentStock: 10, price: 210, salePrice: 640, description: 'Острая пицца с салями Пепперони', visible_on_site: true },
        { id: 201, code: 'DISH-201', name: 'Ролл Филадельфия', type: 'dish', category: 'Роллы', baseUnit: 'шт', isAlcohol: false, minStock: 10, currentStock: 18, price: 155, salePrice: 520, description: 'Классический ролл с лососем и сыром', visible_on_site: true },
        { id: 301, code: 'DRK-301', name: 'Coca-Cola 0.33л', type: 'ingredient', category: 'Напитки', baseUnit: 'шт', isAlcohol: false, minStock: 100, currentStock: 85, price: 35, salePrice: 90, description: 'Газированный напиток', visible_on_site: true },
        { id: 401, code: 'ALK-401', name: 'Вино красное сухое "Кубань" 0.75л', type: 'alcohol', category: 'Вино', baseUnit: 'шт', isAlcohol: true, alcoholStrength: 12, minStock: 20, currentStock: 15, price: 310, salePrice: 650, description: 'Столовое красное сухое вино', visible_on_site: false }
    ],
    recipes: [
        {
            id: 1,
            code: 'TK-001',
            dishId: 102,
            dishName: 'Пицца Пепперони 33 см',
            version: 'v1.0',
            yieldOut: 450,
            yieldUnit: 'г',
            costPrice: 210,
            ingredients: [
                { id: 5, name: 'Тесто для пиццы', qty: 1, unit: 'шт' },
                { id: 3, name: 'Соус томатный', qty: 80, unit: 'г' },
                { id: 4, name: 'Сыр Моцарелла', qty: 150, unit: 'г' },
                { id: 7, name: 'Колбаса Пепперони', qty: 90, unit: 'г' }
            ]
        },
        {
            id: 2,
            code: 'TK-002',
            dishId: 201,
            dishName: 'Ролл Филадельфия',
            version: 'v1.0',
            yieldOut: 220,
            yieldUnit: 'г',
            costPrice: 155,
            ingredients: [
                { id: 8, name: 'Рис для роллов', qty: 120, unit: 'г' },
                { id: 1, name: 'Лосось филе', qty: 80, unit: 'г' },
                { id: 9, name: 'Сыр Филадельфия', qty: 50, unit: 'г' }
            ]
        }
    ],
    warehouses: [
        { id: 1, code: 'WH-MAIN', name: 'Основной склад', type: 'main' },
        { id: 2, code: 'WH-KITCHEN', name: 'Цех/Кухня', type: 'kitchen' },
        { id: 3, code: 'WH-BAR', name: 'Бар', type: 'bar' }
    ],
    stockBalances: [
        { warehouseId: 1, productId: 1, quantity: 0.8, costPerUnit: 1200, batchNumber: 'L-20240115', expiryDate: '2024-12-31' },
        { warehouseId: 1, productId: 2, quantity: 10.5, costPerUnit: 1800, batchNumber: 'S-20240201', expiryDate: '2024-11-30' },
        { warehouseId: 1, productId: 4, quantity: 20, costPerUnit: 450, batchNumber: 'M-20240210', expiryDate: '2024-08-15' }
    ],
    documents: [],
    inventories: [],
    productionOrders: [],
    openedBottles: [],
    kegs: [],
    onec_settings: {},
    rkeeper_settings: {},
    kontur_settings: {},
    crptCodes: [],
    mercuryVSD: [],
    egaisOperations: [],
    settings: {},
    auditLog: []
};

class DandyInventorySystem {
    constructor() {
        this.currentPage = 'dashboard';
        this.currentUser = null;

        this.stateCache = {};
        this.stateSyncTimers = {};
        this.initializeDefaultState();

        this.bootstrapFromServer()
            .catch((error) => {
                console.warn('⚠️ Не удалось получить состояние товароучётки с сервера:', error);
            })
            .then(() => this.loadProducts())
            .then((products) => {
                this.products = products;
                console.log(`✅ Товары загружены: ${products.length} шт.`);
                if (window.nomenclatureModule) {
                    window.nomenclatureModule.renderProductsList();
                }
            })
            .catch((error) => {
                console.error('❌ Ошибка загрузки товаров:', error);
            });

        this.init();
    }
    
    initializeDefaultState() {
        const defaults = this.getDefaultState();
        this.products = defaults.products || [];
        this.recipes = defaults.recipes || [];
        this.warehouses = defaults.warehouses || [];
        this.stockBalances = defaults.stockBalances || [];
        this.documents = defaults.documents || [];
        this.inventories = defaults.inventories || [];
        this.productionOrders = defaults.productionOrders || [];
        this.openedBottles = defaults.openedBottles || [];
        this.kegs = defaults.kegs || [];
        this.egaisOperations = defaults.egaisOperations || [];
        this.crptCodes = defaults.crptCodes || [];
        this.mercuryVSD = defaults.mercuryVSD || [];
        this.settings = defaults.settings || {};
        this.auditLog = defaults.auditLog || [];
        this.onec_settings = defaults.onec_settings || {};
        this.rkeeper_settings = defaults.rkeeper_settings || {};
        this.kontur_settings = defaults.kontur_settings || {};
        Object.keys(defaults).forEach((key) => {
            this.stateCache[key] = JSON.parse(JSON.stringify(defaults[key]));
        });
    }
    
    /**
     * Определение типа товара на основе категории
     */
    determineProductType(product) {
        const categoryName = product.category_name || (product.categories && product.categories.length > 0 ? product.categories[0].name : '');
        const categoryLower = categoryName.toLowerCase();
        
        // Алкогольные категории
        if (categoryLower.includes('алкоголь') || categoryLower.includes('вино') || 
            categoryLower.includes('пиво') || categoryLower.includes('водка') ||
            categoryLower.includes('коньяк') || categoryLower.includes('виски')) {
            return 'alcohol';
        }
        
        // Напитки (не алкоголь)
        if (categoryLower.includes('напитки') || categoryLower.includes('сок') || 
            categoryLower.includes('вода') || categoryLower.includes('кофе')) {
            return 'ingredient';
        }
        
        // Соусы - полуфабрикаты
        if (categoryLower.includes('соус')) {
            return 'semi_product';
        }
        
        // Готовые блюда
        if (categoryLower.includes('пицца') || categoryLower.includes('ролл') ||
            categoryLower.includes('суши') || categoryLower.includes('салат') ||
            categoryLower.includes('суп') || categoryLower.includes('сэндвич') ||
            categoryLower.includes('сет') || categoryLower.includes('комбо') ||
            categoryLower.includes('завтрак') || categoryLower.includes('блин') ||
            categoryLower.includes('пирог')) {
            return 'dish';
        }
        
        // По умолчанию - ингредиент
        return 'ingredient';
    }
    
    init() {
        console.log('🎯 DANDY Inventory System initializing...');
        this.setupEventListeners();
        this.loadDashboardData();
        
        // НЕ загружаем автоматически - слишком долго!
        // Пользователь сам нажмёт кнопку в интерфейсе
        
        console.log('✅ System ready');
    }
    
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const page = e.target.dataset.page;
                this.switchPage(page);
            });
        });
    }
    
    switchPage(page) {
        console.log(`🔀 Switching to page: ${page}`);
        this.currentPage = page;
        
        // Update tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        const activeTab = document.querySelector(`[data-page="${page}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
            console.log(`✅ Tab activated: ${page}`);
        } else {
            console.error(`❌ Tab not found for: ${page}`);
        }
        
        // Update content
        document.querySelectorAll('.page-content').forEach(content => {
            content.classList.remove('active');
        });
        const activePage = document.getElementById(page);
        if (activePage) {
            activePage.classList.add('active');
            console.log(`✅ Page content shown: ${page}`);
        } else {
            console.error(`❌ Page content not found: ${page}`);
        }
        
        // Load page data
        this.loadPageData(page);
    }
    
    loadPageData(page) {
        console.log(`📄 Loading page: ${page}`);
        
        switch(page) {
            case 'dashboard':
                this.loadDashboardData();
                break;
            case 'nomenclature':
                this.loadNomenclatureData();
                if (window.nomenclatureModule) {
                    nomenclatureModule.init();
                }
                break;
            case 'recipes':
                this.loadRecipesData();
                if (window.recipesModule) {
                    recipesModule.init();
                }
                break;
            case 'warehouse':
                this.loadWarehouseData();
                if (window.warehouseModule) {
                    warehouseModule.init();
                }
                break;
            case 'production':
                this.loadProductionData();
                break;
            case 'bar':
                this.loadBarData();
                if (window.barModule) {
                    barModule.init();
                }
                break;
            case 'inventory':
                this.loadInventoryData();
                break;
            case 'egais-module':
                this.loadEGAISData();
                break;
            case 'crpt':
                this.loadCRPTData();
                break;
            case 'mercury':
                this.loadMercuryData();
                break;
            case 'integrations':
                this.loadIntegrationsData();
                break;
            case 'reports':
                this.loadReportsData();
                break;
            case 'settings':
                this.loadSettingsData();
                break;
        }
    }
    
    // ===== Data Loaders =====
    
    async loadProducts(forceReload = false) {
        try {
            console.log('📡 Загрузка товаров из inventory API...');
            const response = await fetch('/api/inventory/products');
            if (!response.ok) {
                throw new Error('Inventory API недоступен');
            }
            const payload = await response.json();
            const apiProducts = Array.isArray(payload?.data) ? payload.data : [];
            if (apiProducts.length > 0) {
                this.products = apiProducts;
                this.updateStateCache('products', apiProducts, { sync: false });
                console.log('✅ Товары загружены из API:', apiProducts.length);
                return apiProducts;
            }
        } catch (error) {
            console.warn('⚠️ Ошибка загрузки товаров из API:', error);
        }

        const fallback = this.getDefaultState().products;
        console.log('📦 Используются демо-данные номенклатуры');
        this.updateStateCache('products', fallback, { sync: false });
        return fallback;
    }
    
    loadRecipes() {
        // Демо-данные техкарт
        return [
            {
                id: 1,
                code: 'TK-001',
                dishId: 101,
                dishName: 'Пицца Пепперони 30 см',
                version: 'v1.2',
                yieldOut: 450,
                yieldUnit: 'г',
                costPrice: 180,
                ingredients: [
                    { id: 1, name: 'Тесто', qty: 250, unit: 'г', k_evap: 5 },
                    { id: 2, name: 'Моцарелла', qty: 150, unit: 'г' },
                    { id: 3, name: 'Пепперони', qty: 100, unit: 'г' },
                    { id: 4, name: 'Соус томатный', qty: 80, unit: 'г' }
                ]
            },
            {
                id: 2,
                code: 'TK-002',
                dishId: 102,
                dishName: 'Ролл Филадельфия',
                version: 'v1.0',
                yieldOut: 220,
                yieldUnit: 'г',
                costPrice: 220,
                ingredients: [
                    { id: 5, name: 'Рис для роллов', qty: 120, unit: 'г' },
                    { id: 1, name: 'Лосось филе', qty: 80, unit: 'г' },
                    { id: 6, name: 'Сыр Филадельфия', qty: 50, unit: 'г' }
                ]
            }
        ];
    }
    
    loadWarehouses() {
        return [
            { id: 1, code: 'WH-MAIN', name: 'Основной склад', type: 'main' },
            { id: 2, code: 'WH-KITCHEN', name: 'Кухня/Цех', type: 'kitchen' },
            { id: 3, code: 'WH-BAR', name: 'Бар', type: 'bar' },
            { id: 4, code: 'WH-DRAFT', name: 'Разливной узел', type: 'draft_beer' }
        ];
    }
    
    loadStockBalances() {
        return [
            { warehouseId: 1, productId: 1, quantity: 0.8, costPerUnit: 1200, batchNumber: 'L-20240115', expiryDate: '2024-01-22' },
            { warehouseId: 1, productId: 2, quantity: 45.5, costPerUnit: 450, batchNumber: 'M-20240110', expiryDate: '2024-02-10' },
            { warehouseId: 3, productId: 3, quantity: 12, costPerUnit: 450, batchNumber: 'V-20240105', expiryDate: '2025-12-31' }
        ];
    }
    
    loadDashboardData() {
        console.log('📊 Loading dashboard data...');
        // Dashboard уже статичен в HTML, здесь можно обновить метрики
    }
    
    loadNomenclatureData() {
        console.log('📦 Loading nomenclature...');
        console.log('📦 Products count:', this.products.length);
        // Инициализация модуля номенклатуры
        if (window.nomenclatureModule) {
            console.log('🔄 Calling nomenclatureModule.init()...');
            nomenclatureModule.init();
        } else {
            console.error('❌ nomenclatureModule not found!');
        }
    }
    
    loadRecipesData() {
        console.log('📖 Loading recipes...');
        if (window.recipesModule) {
            recipesModule.init();
        }
    }
    
    loadWarehouseData() {
        console.log('🏭 Loading warehouse data...');
        if (window.warehouseModule) {
            warehouseModule.init();
        }
    }
    
    loadProductionData() {
        console.log('⚙️ Loading production data...');
        if (window.productionModule) {
            productionModule.init();
        }
    }
    
    loadBarData() {
        console.log('🍺 Loading bar data...');
        if (window.barModule) {
            barModule.init();
        }
    }
    
    loadInventoryData() {
        console.log('📋 Loading inventory data...');
        if (window.inventoryCountModule) {
            inventoryCountModule.init();
        }
    }
    
    loadEGAISData() {
        console.log('🍷 Loading EGAIS data...');
        if (window.egaisModule) {
            egaisModule.init();
        }
    }
    
    loadCRPTData() {
        console.log('🏷️ Loading CRPT data...');
        if (window.crptModule) {
            crptModule.init();
        }
    }
    
    loadMercuryData() {
        console.log('🐄 Loading Mercury data...');
        if (window.mercuryModule) {
            mercuryModule.init();
        }
    }
    
    loadIntegrationsData() {
        console.log('🔄 Loading integrations...');
        if (window.integrationsModule) {
            integrationsModule.init();
        }
    }
    
    loadReportsData() {
        console.log('📈 Loading reports...');
        if (window.reportsModule) {
            reportsModule.init();
        }
    }
    
    loadSettingsData() {
        console.log('⚙️ Loading settings...');
        
        // Инициализируем модуль настроек
        if (window.settingsModule) {
            settingsModule.init();
        }
        
        // Рендерим UI backup
        if (window.backupModule) {
            backupModule.renderBackupUI();
        }
        
        // Показываем Audit Log
        this.renderAuditLog();
    }

    /**
     * Рендер Audit Log
     */
    renderAuditLog() {
        const container = document.getElementById('auditLogContainer');
        if (!container) return;

        const logs = this.getAuditLog(50);

        if (logs.length === 0) {
            container.innerHTML = `
                <p style="text-align: center; color: var(--text-light); opacity: 0.7; padding: 2rem;">
                    Журнал изменений пуст
                </p>
            `;
            return;
        }

        const getActionText = (action) => {
            const actions = {
                'product_created': '➕ Создан товар',
                'product_updated': '✏️ Изменён товар',
                'product_deleted': '🗑️ Удалён товар',
                'recipe_created': '➕ Создана техкарта',
                'recipe_updated': '✏️ Изменена техкарта',
                'document_posted': '✓ Проведён документ',
                'backup_created': '💾 Создан backup',
                'backup_restored': '↩️ Восстановлен backup',
                'old_data_cleared': '🗑️ Очищены старые данные',
                'settings_updated': '⚙️ Изменены настройки'
            };
            return actions[action] || action;
        };

        container.innerHTML = `
            <div style="max-height: 500px; overflow-y: auto;">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Дата/Время</th>
                            <th>Действие</th>
                            <th>Пользователь</th>
                            <th>Детали</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${logs.map(log => `
                            <tr>
                                <td style="white-space: nowrap;">${new Date(log.timestamp).toLocaleString('ru-RU')}</td>
                                <td>${getActionText(log.action)}</td>
                                <td><code>${log.user}</code></td>
                                <td style="font-size: 0.85em; color: var(--text-light); opacity: 0.8;">
                                    ${JSON.stringify(log.details).substring(0, 100)}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    /**
     * Добавление записи в Audit Log
     */
    addAuditLog(action, details = {}) {
        const logEntry = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            action: action,
            user: this.currentUser || 'system',
            details: details
        };

        // Загружаем существующий лог
        let auditLog = [];
        // Загружаем audit log из кеша или используем текущий
        const cached = this.auditLog || [];
        if (Array.isArray(cached)) {
            auditLog = cached;
        } else {
            auditLog = Array.isArray(this.auditLog) ? [...this.auditLog] : [];
        }

        // Добавляем новую запись
        auditLog.push(logEntry);

        // Храним только последние 1000 записей
        if (auditLog.length > 1000) {
            auditLog = auditLog.slice(-1000);
        }

        // Сохраняем
        this.auditLog = auditLog;
        
        // Сохраняем через API
        (async () => {
            try {
                const response = await fetch('/api/inventory/audit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(logEntry)
                });
                if (response.ok) {
                    this.updateStateCache('auditLog', this.auditLog, { sync: false });
                }
            } catch (error) {
                console.warn('⚠️ Не удалось сохранить audit log через API:', error);
            }
        })();

        console.log('📝 Audit log:', action, details);
    }

    /**
     * Получение Audit Log
     */
    async getAuditLog(limit = 100) {
        try {
            const response = await fetch(`/api/inventory/audit?limit=${limit}`);
            if (response.ok) {
                const payload = await response.json();
                if (payload?.ok && Array.isArray(payload?.data)) {
                    this.auditLog = payload.data;
                    this.updateStateCache('auditLog', payload.data, { sync: false });
                    return payload.data.reverse();
                }
            }
        } catch (error) {
            console.warn('⚠️ Не удалось загрузить audit log через API:', error);
        }
        
        // Fallback на локальные данные
        const log = Array.isArray(this.auditLog) ? this.auditLog : [];
        return log.slice(-limit).reverse();
    }
    
    // ===== Business Logic =====
    
    /**
     * Создание нового товара
     */
    createProduct(productData) {
        const newProduct = {
            id: Date.now(),
            code: productData.code || `PRD-${Date.now()}`,
            name: productData.name,
            type: productData.type,
            category: productData.category,
            baseUnit: productData.baseUnit,
            isAlcohol: productData.isAlcohol || false,
            minStock: productData.minStock || 0,
            currentStock: 0,
            price: productData.price || 0,
            createdAt: new Date().toISOString()
        };
        
        this.products.push(newProduct);
        
        // Сохраняем через API
        try {
            const response = await fetch('/api/inventory/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newProduct)
            });
            if (response.ok) {
                const payload = await response.json();
                if (payload?.ok && payload?.data) {
                    // Обновляем ID с сервера
                    const index = this.products.length - 1;
                    this.products[index] = payload.data;
                    newProduct = payload.data;
                    this.updateStateCache('products', this.products, { sync: false });
                    console.log('✅ Товар создан через API:', newProduct.id);
                }
            }
        } catch (error) {
            console.warn('⚠️ Не удалось сохранить товар через API:', error);
        }
        
        return newProduct;
    }
    
    /**
     * Создание техкарты
     */
    createRecipe(recipeData) {
        const newRecipe = {
            id: Date.now(),
            code: recipeData.code || `TK-${Date.now()}`,
            dishId: recipeData.dishId,
            dishName: recipeData.dishName,
            version: recipeData.version || 'v1.0',
            yieldOut: recipeData.yieldOut,
            yieldUnit: recipeData.yieldUnit,
            ingredients: recipeData.ingredients || [],
            createdAt: new Date().toISOString()
        };
        
        // Расчет себестоимости
        newRecipe.costPrice = this.calculateRecipeCost(newRecipe);
        
        this.recipes.push(newRecipe);
        
        // Сохраняем через API
        (async () => {
            try {
                const response = await fetch('/api/inventory/recipes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newRecipe)
                });
                if (response.ok) {
                    const payload = await response.json();
                    if (payload?.ok && payload?.data) {
                        // Обновляем ID с сервера
                        const index = this.recipes.length - 1;
                        this.recipes[index] = payload.data;
                        this.updateStateCache('recipes', this.recipes, { sync: false });
                        console.log('✅ Техкарта создана через API:', payload.data.id);
                    }
                }
            } catch (error) {
                console.warn('⚠️ Не удалось сохранить техкарту через API:', error);
            }
        })();
        
        return newRecipe;
    }
    
    /**
     * Расчет себестоимости по ТК
     */
    calculateRecipeCost(recipe) {
        let totalCost = 0;
        
        recipe.ingredients.forEach(ing => {
            const product = this.products.find(p => p.id === ing.id);
            if (product) {
                // Учитываем потери (уварка/ужарка)
                const lossCoeff = 1 + (ing.k_evap || 0) / 100;
                const actualQty = ing.qty * lossCoeff;
                
                // Пересчет в базовую единицу
                const qtyInBaseUnit = this.convertToBaseUnit(actualQty, ing.unit, product.baseUnit);
                
                totalCost += qtyInBaseUnit * product.price;
            }
        });
        
        return Math.round(totalCost * 100) / 100;
    }
    
    /**
     * Конвертация единиц измерения
     */
    convertToBaseUnit(quantity, fromUnit, toUnit) {
        // Упрощенная конверсия (в реальной системе — таблица пересчетов)
        const conversions = {
            'кг-г': 1000,
            'г-кг': 0.001,
            'л-мл': 1000,
            'мл-л': 0.001
        };
        
        const key = `${toUnit}-${fromUnit}`;
        const coeff = conversions[key] || 1;
        
        return quantity * coeff;
    }
    
    /**
     * Создание документа прихода
     */
    createArrivalDocument(docData) {
        const newDoc = {
            id: Date.now(),
            docType: 'arrival',
            docNumber: docData.docNumber || `ARR-${Date.now()}`,
            docDate: docData.docDate || new Date().toISOString().split('T')[0],
            warehouseId: docData.warehouseId,
            supplierId: docData.supplierId,
            lines: docData.lines || [],
            status: 'draft',
            createdAt: new Date().toISOString()
        };
        
        // Расчет общей суммы
        newDoc.totalAmount = newDoc.lines.reduce((sum, line) => {
            return sum + (line.quantity * line.costPerUnit);
        }, 0);
        
        this.documents.push(newDoc);
        
        // Сохраняем через API
        (async () => {
            try {
                const response = await fetch('/api/inventory/documents', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newDoc)
                });
                if (response.ok) {
                    const payload = await response.json();
                    if (payload?.ok && payload?.data) {
                        // Обновляем ID с сервера
                        const index = this.documents.length - 1;
                        this.documents[index] = payload.data;
                        this.updateStateCache('documents', this.documents, { sync: false });
                        console.log('✅ Документ создан через API:', payload.data.id);
                    }
                }
            } catch (error) {
                console.warn('⚠️ Не удалось сохранить документ через API:', error);
            }
        })();
        
        return newDoc;
    }
    
    /**
     * Проведение документа (обновление остатков)
     */
    async postDocument(docId) {
        const doc = this.documents.find(d => d.id === docId);
        if (!doc || doc.status === 'posted') {
            throw new Error('Document not found or already posted');
        }
        
        const docType = doc.docType || doc.type || 'arrival';
        const isArrival = docType === 'arrival' || docType === 'receipt';
        const isWriteoff = docType === 'writeoff' || docType === 'consumption';
        const isTransfer = docType === 'transfer';
        const isInventory = docType === 'inventory';
        
        // Определяем направление движения остатков
        const quantityMultiplier = isArrival ? 1 : (isWriteoff ? -1 : 0);
        
        // Обновляем остатки в зависимости от типа документа
        const stockChanges = [];
        
        doc.lines.forEach(line => {
            const quantityChange = line.quantity * quantityMultiplier;
            
            if (quantityChange === 0 && !isInventory) {
                return; // Для перемещений и инвентаризации отдельная логика
            }
            
            const balance = this.stockBalances.find(b => 
                b.warehouseId === doc.warehouseId && 
                b.productId === line.productId &&
                b.batchNumber === (line.batchNumber || 'DEFAULT')
            );
            
            if (balance) {
                balance.quantity += quantityChange;
                if (balance.quantity < 0) {
                    console.warn(`⚠️ Отрицательный остаток для товара ${line.productId} на складе ${doc.warehouseId}`);
                    balance.quantity = 0; // Защита от отрицательных остатков
                }
            } else if (quantityChange > 0) {
                // Создаём новую запись только при приходе
                this.stockBalances.push({
                    warehouseId: doc.warehouseId,
                    productId: line.productId,
                    quantity: quantityChange,
                    costPerUnit: line.costPerUnit || 0,
                    batchNumber: line.batchNumber || 'DEFAULT',
                    expiryDate: line.expiryDate || null
                });
            }
            
            // Обновляем текущий остаток в номенклатуре
            const product = this.products.find(p => p.id === line.productId);
            if (product) {
                const oldStock = product.currentStock || 0;
                product.currentStock = Math.max(0, (product.currentStock || 0) + quantityChange);
                
                // Записываем изменение для отправки события
                if (quantityChange !== 0) {
                    stockChanges.push({
                        productId: line.productId,
                        productName: product.name || '',
                        warehouseId: doc.warehouseId,
                        oldQuantity: oldStock,
                        newQuantity: product.currentStock,
                        change: quantityChange
                    });
                }
            }
        });
        
        // Обновляем статус документа
        doc.status = 'posted';
        doc.postedAt = new Date().toISOString();
        
        // Сохраняем документ через API и отправляем события
        try {
            const response = await fetch(`/api/inventory/documents/${doc.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(doc)
            });
            if (response.ok) {
                const payload = await response.json();
                if (payload?.ok && payload?.data) {
                    const index = this.documents.findIndex(d => d.id === doc.id);
                    if (index !== -1) {
                        this.documents[index] = payload.data;
                        this.updateStateCache('documents', this.documents, { sync: false });
                        console.log('✅ Документ проведён через API:', doc.id);
                        
                        // Обновляем статус на 'synced' после успешного сохранения
                        if (payload.data.status === 'posted') {
                            doc.status = 'synced';
                            doc.syncedAt = new Date().toISOString();
                            
                            // Обновляем статус через API
                            fetch(`/api/inventory/documents/${doc.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: 'synced', syncedAt: doc.syncedAt })
                            }).catch(err => console.warn('⚠️ Не удалось обновить статус на synced:', err));
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ Не удалось обновить документ через API:', error);
        }
        
        // Сохраняем остатки через API и отправляем события об изменении остатков
        try {
            const response = await fetch('/api/inventory/stock-balances', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: this.stockBalances })
            });
            if (response.ok) {
                this.updateStateCache('stockBalances', this.stockBalances, { sync: false });
                console.log('✅ Остатки обновлены через API');
                
                // Отправляем события об изменении остатков для каждого товара
                for (const change of stockChanges) {
                    try {
                        await fetch('/api/inventory/events', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                type: 'STOCK_CHANGED',
                                product_id: change.productId,
                                product_name: change.productName,
                                warehouse_id: change.warehouseId,
                                old_quantity: change.oldQuantity,
                                new_quantity: change.newQuantity,
                                change: change.change,
                                document_id: doc.id,
                                document_type: docType,
                                reason: 'document_posted'
                            })
                        });
                    } catch (error) {
                        console.warn(`⚠️ Не удалось отправить событие STOCK_CHANGED для товара ${change.productId}:`, error);
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ Не удалось сохранить остатки через API:', error);
        }
        
        // Обновляем товары через API (если изменился currentStock)
        try {
            const updatedProducts = this.products.filter(p => {
                const original = this.stateCache?.products?.find(op => op.id === p.id);
                return !original || original.currentStock !== p.currentStock;
            });
            
            for (const product of updatedProducts) {
                try {
                    const response = await fetch(`/api/inventory/products/${product.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ currentStock: product.currentStock })
                    });
                    if (response.ok) {
                        const payload = await response.json();
                        if (payload?.ok && payload?.data) {
                            const index = this.products.findIndex(p => p.id === product.id);
                            if (index !== -1) {
                                this.products[index] = payload.data;
                            }
                        }
                    }
                } catch (error) {
                    console.warn(`⚠️ Не удалось обновить товар ${product.id} через API:`, error);
                }
            }
            if (updatedProducts.length > 0) {
                this.updateStateCache('products', this.products, { sync: false });
                console.log(`✅ Обновлено товаров через API: ${updatedProducts.length}`);
            }
        } catch (error) {
            console.warn('⚠️ Не удалось обновить товары через API:', error);
        }
        
        // Записываем в audit log
        this.logAudit('document_posted', {
            documentId: doc.id,
            documentType: docType,
            documentNumber: doc.docNumber || doc.number || '',
            warehouseId: doc.warehouseId,
            linesCount: doc.lines?.length || 0,
            totalAmount: doc.totalAmount || doc.total || 0
        });
        
        return doc;
    }
    
    /**
     * Списание по чеку (реализация)
     */
    async writeoffBySale(saleData) {
        const writeoffDoc = {
            id: Date.now(),
            docType: 'writeoff',
            docNumber: `WO-${Date.now()}`,
            docDate: new Date().toISOString().split('T')[0],
            reason: 'sale',
            receiptId: saleData.receiptId,
            warehouseId: saleData.warehouseId,
            lines: [],
            status: 'draft',
            createdAt: new Date().toISOString()
        };
        
        // Разбираем блюда по ТК
        saleData.items.forEach(item => {
            const dishId = item.dishId || item.id || item.productId;
            if (!dishId) return;
            
            // Ищем техкарту по product_id (связь через recipes.product_id = products.id)
            const recipe = this.recipes.find(r => {
                // Поддерживаем оба варианта: dishId (старый) и product_id (новый)
                return (r.product_id && r.product_id == dishId) || (r.dishId && r.dishId == dishId);
            });
            
            if (recipe) {
                const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : 
                    (typeof recipe.ingredients === 'string' ? JSON.parse(recipe.ingredients) : []);
                
                ingredients.forEach(ing => {
                    const ingredientId = ing.product_id || ing.id;
                    const ingredientQty = ing.quantity || ing.qty || 0;
                    const ingredientUnit = ing.unit || 'шт';
                    
                    if (!ingredientId || ingredientQty <= 0) return;
                    
                    // FEFO: списываем с ближайшим сроком годности
                    const batch = this.findBatchForWriteoff(ingredientId, saleData.warehouseId);
                    
                    if (batch) {
                        writeoffDoc.lines.push({
                            productId: ingredientId,
                            batchId: batch.id,
                            batchNumber: batch.batchNumber || 'DEFAULT',
                            quantity: ingredientQty * item.quantity,
                            unit: ingredientUnit,
                            costPerUnit: batch.costPerUnit
                        });
                    } else {
                        console.warn(`⚠️ Недостаточно остатка для ингредиента ID=${ingredientId} (${ing.name || 'unknown'})`);
                    }
                });
            } else {
                console.warn(`⚠️ Техкарта не найдена для блюда ID=${dishId}`);
            }
        });
        
        // Расчет общей суммы
        writeoffDoc.totalAmount = writeoffDoc.lines.reduce((sum, line) => {
            return sum + (line.quantity * line.costPerUnit);
        }, 0);
        
        this.documents.push(writeoffDoc);
        
        // Сохраняем документ через API
        try {
            const response = await fetch('/api/inventory/documents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(writeoffDoc)
            });
            if (response.ok) {
                const payload = await response.json();
                if (payload?.ok && payload?.data) {
                    const index = this.documents.length - 1;
                    this.documents[index] = payload.data;
                    writeoffDoc.id = payload.data.id;
                    this.updateStateCache('documents', this.documents, { sync: false });
                    console.log('✅ Документ списания создан через API:', writeoffDoc.id);
                }
            }
        } catch (error) {
            console.warn('⚠️ Не удалось сохранить документ списания через API:', error);
        }
        
        // Проводим документ
        await this.postDocument(writeoffDoc.id);
        
        return writeoffDoc;
    }
    
    /**
     * Поиск партии для списания (FEFO)
     */
    findBatchForWriteoff(productId, warehouseId) {
        const batches = this.stockBalances
            .filter(b => b.productId === productId && b.warehouseId === warehouseId && b.quantity > 0)
            .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
        
        return batches[0];
    }
    
    /**
     * Инвентаризация
     */
    createInventory(inventoryData) {
        const invDoc = {
            id: Date.now(),
            docType: 'inventory',
            docNumber: `INV-${Date.now()}`,
            docDate: new Date().toISOString().split('T')[0],
            warehouseId: inventoryData.warehouseId,
            lines: inventoryData.lines || [],
            status: 'draft',
            createdAt: new Date().toISOString()
        };
        
        // Расчет расхождений
        invDoc.lines.forEach(line => {
            const balance = this.stockBalances.find(b => 
                b.warehouseId === invDoc.warehouseId && 
                b.productId === line.productId &&
                b.batchNumber === line.batchNumber
            );
            
            line.quantityByAccount = balance ? balance.quantity : 0;
            line.quantityActual = line.quantityActual || 0;
            line.difference = line.quantityActual - line.quantityByAccount;
            line.amountDifference = line.difference * (balance ? balance.costPerUnit : 0);
        });
        
        this.documents.push(invDoc);
        // Сохраняем документ через API
        (async () => {
            try {
                const response = await fetch('/api/inventory/documents', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(invDoc)
                });
                if (response.ok) {
                    const payload = await response.json();
                    if (payload?.ok && payload?.data) {
                        const index = this.documents.length - 1;
                        this.documents[index] = payload.data;
                        this.updateStateCache('documents', this.documents, { sync: false });
                    }
                }
            } catch (error) {
                console.warn('⚠️ Не удалось сохранить документ через API:', error);
            }
        })();
        
        return invDoc;
    }
    
    /**
     * ЕГАИС: создание акта списания
     */
    createEGAISAct(actData) {
        const egaisAct = {
            id: Date.now(),
            operationType: actData.operationType, // 'sale', 'writeoff'
            documentId: actData.documentId,
            egaisGuid: `act-${Date.now()}`,
            ttnNumber: actData.ttnNumber,
            utmStatus: 'pending',
            createdAt: new Date().toISOString()
        };
        
        this.egaisOperations.push(egaisAct);
        // Сохраняем через API (egaisOperations пока через state)
        this.updateStateCache('egaisOperations', this.egaisOperations);
        
        // Имитация отправки в УТМ
        setTimeout(() => {
            egaisAct.utmStatus = 'sent';
            console.log('📤 ЕГАИС акт отправлен в УТМ:', egaisAct.egaisGuid);
        }, 1000);
        
        return egaisAct;
    }
    
    // ===== Utilities =====
    
    saveToLocalStorage(key, data) {
        this.updateStateCache(key, data);
    }
    
    loadFromLocalStorage(key) {
        if (!this.stateCache || typeof this.stateCache[key] === 'undefined') {
            this.fetchStateKey(key);
            return null;
        }
        try {
            return JSON.parse(JSON.stringify(this.stateCache[key]));
        } catch (error) {
            console.error('❌ Error reading cached state:', error);
            return null;
        }
    }
    
    updateStateCache(key, data, options = {}) {
        if (!this.stateCache) {
            this.stateCache = {};
        }
        try {
            this.stateCache[key] = JSON.parse(JSON.stringify(data));
        } catch (_) {
            this.stateCache[key] = data;
        }
        if (options.sync !== false) {
            this.queueServerSync(key);
        }
    }
    
    queueServerSync(key) {
        if (!this.stateSyncTimers) {
            this.stateSyncTimers = {};
        }
        clearTimeout(this.stateSyncTimers[key]);
        this.stateSyncTimers[key] = setTimeout(() => this.syncStateToServer(key), 250);
    }
    
    async syncStateToServer(key) {
        if (!this.stateCache || typeof this.stateCache[key] === 'undefined') {
            return;
        }
        try {
            const response = await fetch(`/api/inventory/state/${encodeURIComponent(key)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: this.stateCache[key] })
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.warn(`⚠️ Не удалось синхронизировать ключ ${key}:`, error.message);
        }
    }
    
    async fetchStateKey(key) {
        try {
            const response = await fetch(`/api/inventory/state/${encodeURIComponent(key)}`);
            if (!response.ok) return;
            const payload = await response.json();
            if (payload?.ok) {
                this.updateStateCache(key, payload.data || null, { sync: false });
            }
        } catch (error) {
            console.warn(`⚠️ Не удалось получить состояние ключа ${key}:`, error.message);
        }
    }
    
    async bootstrapFromServer() {
        try {
            const response = await fetch('/api/inventory/bootstrap');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const payload = await response.json();
            if (!payload?.ok) {
                throw new Error(payload?.error || 'Не удалось получить состояние товароучётки');
            }
            const state = payload.state || {};
            Object.keys(state).forEach((key) => {
                this.updateStateCache(key, state[key], { sync: false });
                if (Array.isArray(this[key])) {
                    this[key] = Array.isArray(state[key]) ? state[key] : [];
                } else if (typeof this[key] === 'object' && this[key] !== null) {
                    this[key] = state[key] || {};
                } else if (typeof state[key] !== 'undefined') {
                    this[key] = state[key];
                }
            });
            console.log('🔄 Состояние товароучётки синхронизировано с сервером');
            
            // Дополнительно загружаем через API endpoints для гарантии актуальности
            await Promise.all([
                this.loadRecipes(),
                this.loadDocuments(),
                this.loadStockBalances(),
                this.loadWarehouses()
            ]);
        } catch (error) {
            console.warn('⚠️ Не удалось загрузить состояние инвентаря с сервера:', error.message);
        }
    }
    
    async loadRecipes() {
        try {
            const response = await fetch('/api/inventory/recipes');
            if (response.ok) {
                const payload = await response.json();
                if (payload?.ok && Array.isArray(payload?.data)) {
                    this.recipes = payload.data;
                    this.updateStateCache('recipes', payload.data, { sync: false });
                    console.log('✅ Техкарты загружены из API:', payload.data.length);
                }
            }
        } catch (error) {
            console.warn('⚠️ Не удалось загрузить техкарты через API:', error);
        }
    }
    
    async loadDocuments() {
        try {
            const response = await fetch('/api/inventory/documents');
            if (response.ok) {
                const payload = await response.json();
                if (payload?.ok && Array.isArray(payload?.data)) {
                    this.documents = payload.data;
                    this.updateStateCache('documents', payload.data, { sync: false });
                    console.log('✅ Документы загружены из API:', payload.data.length);
                }
            }
        } catch (error) {
            console.warn('⚠️ Не удалось загрузить документы через API:', error);
        }
    }
    
    async loadStockBalances() {
        try {
            const response = await fetch('/api/inventory/stock-balances');
            if (response.ok) {
                const payload = await response.json();
                if (payload?.ok && Array.isArray(payload?.data)) {
                    this.stockBalances = payload.data;
                    this.updateStateCache('stockBalances', payload.data, { sync: false });
                    console.log('✅ Остатки загружены из API:', payload.data.length);
                }
            }
        } catch (error) {
            console.warn('⚠️ Не удалось загрузить остатки через API:', error);
        }
    }
    
    async loadWarehouses() {
        try {
            const response = await fetch('/api/inventory/warehouses');
            if (response.ok) {
                const payload = await response.json();
                if (payload?.ok && Array.isArray(payload?.data)) {
                    this.warehouses = payload.data;
                    this.updateStateCache('warehouses', payload.data, { sync: false });
                    console.log('✅ Склады загружены из API:', payload.data.length);
                }
            }
        } catch (error) {
            console.warn('⚠️ Не удалось загрузить склады через API:', error);
        }
    }
    
    getDefaultState() {
        return JSON.parse(JSON.stringify(INVENTORY_DEFAULT_STATE));
    }
    
    async publishMenuToSite(productIds = []) {
        try {
            const response = await fetch('/api/inventory/menu/publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productIds })
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const payload = await response.json();
            if (!payload?.ok) {
                throw new Error(payload?.error || 'Не удалось опубликовать меню');
            }
            this.addAuditLog('product_updated', {
                scope: 'menu_publish',
                products: payload?.result?.count || 0
            });
            alert(`✅ Меню опубликовано на сайт\nТоваров: ${payload?.result?.count || 0}`);
            return payload.result;
        } catch (error) {
            console.error('❌ Ошибка публикации меню на сайт:', error);
            alert('❌ Ошибка публикации меню: ' + error.message);
            throw error;
        }
    }
    
    /**
     * Загрузка меню из menu_data.json (вызывается из модуля номенклатуры)
     */
    async autoLoadMenuData() {
        try {
            // Быстрая попытка загрузить через backend
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 секунды таймаут
            
            const response = await fetch('/menu_data.json', {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error('Backend not available');
            }
            
            const data = await response.json();
            let addedCount = 0;
            
            // Маппинг категорий к типам товаров
            const categoryTypeMap = {
                'Пицца': 'dish',
                'Роллы': 'dish',
                'Маки': 'dish',
                'Запеченные': 'dish',
                'Темпура': 'dish',
                'Гунканы': 'dish',
                'Суши': 'dish',
                'Сеты': 'dish',
                'Салаты': 'dish',
                'Закуски': 'dish',
                'Супы': 'dish',
                'Сэндвичи': 'dish',
                'Wok': 'dish',
                'Завтраки': 'dish',
                'Блины': 'dish',
                'Пироги': 'dish',
                'Напитки': 'ingredient',
                'Соусы': 'semi_product',
                'Комбо': 'dish'
            };
            
            // Получаем текущий максимальный ID
            let maxId = Math.max(...this.products.map(p => p.id), 0);
            
            data.offers.forEach(item => {
                // Проверяем, не существует ли уже такой товар
                const exists = this.products.some(p => 
                    p.code === `MENU-${item.id}` || p.name.toLowerCase() === item.name.trim().toLowerCase()
                );
                
                if (exists) return;
                
                // Определяем тип товара на основе категории
                const categoryName = item.category_name || 'Другое';
                const productType = categoryTypeMap[categoryName] || 'ingredient';
                
                // Вычисляем примерную себестоимость (40% от цены продажи)
                const price = parseInt(item.price) || 0;
                const cost = Math.round(price * 0.4);
                
                // Пропускаем акционные товары за 1 рубль
                if (price <= 1) return;
                
                // Добавляем новый товар
                maxId++;
                this.products.push({
                    id: maxId,
                    code: `MENU-${item.id}`,
                    name: item.name.trim(),
                    type: productType,
                    category: categoryName,
                    baseUnit: 'шт',
                    isAlcohol: false,
                    minStock: 5.0,
                    currentStock: 0,
                    price: cost,
                    salePrice: price,
                    description: item.description ? item.description.replace(/<[^>]*>/g, '').substring(0, 200) : '',
                    picture: item.picture || '',
                    url: item.url || ''
                });
                
                addedCount++;
            });
            
            // Сохраняем обновлённый список
            // Обновляем товары через API
            (async () => {
                try {
                    for (const product of this.products) {
                        const response = await fetch(`/api/inventory/products/${product.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(product)
                        });
                        if (response.ok) {
                            const payload = await response.json();
                            if (payload?.ok && payload?.data) {
                                const index = this.products.findIndex(p => p.id === product.id);
                                if (index !== -1) {
                                    this.products[index] = payload.data;
                                }
                            }
                        }
                    }
                    this.updateStateCache('products', this.products, { sync: false });
                } catch (error) {
                    console.warn('⚠️ Не удалось обновить товары через API:', error);
                }
            })();
            
            console.log(`✅ Auto-loaded ${addedCount} products from menu! Total: ${this.products.length}`);
            
            // Обновляем таблицу, если мы на странице номенклатуры
            if (this.currentPage === 'nomenclature' && window.nomenclatureModule) {
                setTimeout(() => {
                    nomenclatureModule.renderProductsList();
                }, 100);
            }
            
        } catch (error) {
            console.warn('⚠️ Could not auto-load menu:', error.message);
        }
    }
    
    /**
     * Генерация отчетов
     */
    generateReport(reportType, params = {}) {
        console.log(`📊 Generating report: ${reportType}`, params);
        
        switch(reportType) {
            case 'cogs':
                return this.generateCOGSReport(params);
            case 'menu_engineering':
                return this.generateMenuEngineeringReport(params);
            case 'abc_xyz':
                return this.generateABCXYZReport(params);
            default:
                console.warn('Unknown report type:', reportType);
                return null;
        }
    }
    
    generateCOGSReport(params) {
        // COGS (Cost of Goods Sold) отчет
        const report = {
            type: 'cogs',
            period: params.period,
            totalSales: 0,
            totalCOGS: 0,
            grossProfit: 0,
            grossMargin: 0,
            items: []
        };
        
        // Здесь бы шел реальный расчет по проданным блюдам
        
        return report;
    }
    
    generateMenuEngineeringReport(params) {
        // Menu Engineering: Stars, Plowhorses, Puzzles, Dogs
        return {
            type: 'menu_engineering',
            stars: [], // Высокая маржа + высокий спрос
            plowhorses: [], // Низкая маржа + высокий спрос
            puzzles: [], // Высокая маржа + низкий спрос
            dogs: [] // Низкая маржа + низкий спрос
        };
    }
    
    generateABCXYZReport(params) {
        // ABC-XYZ анализ
        return {
            type: 'abc_xyz',
            A: [], // Высокая значимость (80% оборота)
            B: [], // Средняя (15%)
            C: [], // Низкая (5%)
            X: [], // Стабильный спрос
            Y: [], // Сезонный
            Z: [] // Непредсказуемый
        };
    }
}

// ===== Global Functions =====

function createProduct() {
    if (window.inventorySystem) {
        alert('🎯 Форма создания товара\n\nВведите данные о товаре');
        // В реальной системе — модальное окно с формой
    }
}

function createRecipe() {
    if (window.inventorySystem) {
        alert('📖 Редактор техкарты\n\nСоздание новой ТК/ТТК');
        // В реальной системе — визуальный редактор ТК
    }
}

function editRecipe(code) {
    if (window.inventorySystem) {
        alert(`✏️ Редактирование техкарты ${code}`);
    }
}

function startInventory() {
    if (window.inventorySystem) {
        alert('🎯 Начало инвентаризации\n\nВыберите склад и зону для пересчета');
    }
}

function openBottle() {
    if (window.inventorySystem) {
        alert('🔓 Вскрытие бутылки\n\nБудет создан акт списания в ЕГАИС');
    }
}

function syncFlowMeter() {
    if (window.inventorySystem) {
        alert('🔄 Сверка с расходомером\n\nПолучение данных с устройства...');
    }
}

// ===== Initialization =====

let inventorySystem;

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing DANDY Inventory System...');
    
    inventorySystem = new DandyInventorySystem();
    window.inventorySystem = inventorySystem; // Make globally available
    
    console.log('✅ System initialized successfully');
    console.log('📦 Products:', inventorySystem.products.length);
    console.log('📖 Recipes:', inventorySystem.recipes.length);
    console.log('🏭 Warehouses:', inventorySystem.warehouses.length);
});

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DandyInventorySystem;
}

