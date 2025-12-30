/**
 * Модуль интеграции с ЕГАИС (Единая государственная автоматизированная информационная система)
 * Полная поддержка учета алкогольной продукции, маркировки и отчетности
 */

class EGAISModule {
    constructor() {
        this.egaisConfig = null;
        this.isConnected = false;
        this.lastSync = null;
        this.alcoholProducts = new Map();
        this.marks = new Map();
        this.reports = [];
        this.syncQueue = [];
        this.init();
    }

    init() {
        this.loadEGAISConfig();
        this.setupEventListeners();
        this.testConnection();
        this.loadAlcoholProducts();
        this.loadMarks();
    }

    // Загрузка конфигурации ЕГАИС
    loadEGAISConfig() {
        const config = JSON.parse(localStorage.getItem('egaisConfig') || '{}');
        this.egaisConfig = {
            // Основные настройки
            apiUrl: config.apiUrl || 'https://api.egais.ru/v1',
            apiKey: config.apiKey || '',
            username: config.username || '',
            password: config.password || '',
            
            // Настройки организации
            organizationId: config.organizationId || '',
            inn: config.inn || '',
            kpp: config.kpp || '',
            organizationName: config.organizationName || '',
            
            // Настройки лицензий
            alcoholLicense: config.alcoholLicense || '',
            retailLicense: config.retailLicense || '',
            licenseExpiry: config.licenseExpiry || '',
            
            // Настройки синхронизации
            syncInterval: config.syncInterval || 300000, // 5 минут
            timeout: config.timeout || 30000,
            retryAttempts: config.retryAttempts || 3,
            
            // Настройки учета
            autoMarking: config.autoMarking !== false,
            strictControl: config.strictControl !== false,
            reportGeneration: config.reportGeneration !== false,
            
            ...config
        };
    }

    // Сохранение конфигурации
    saveEGAISConfig() {
        localStorage.setItem('egaisConfig', JSON.stringify(this.egaisConfig));
    }

    // Настройка обработчиков событий
    setupEventListeners() {
        // Обработка изменения статуса сети
        window.addEventListener('online', () => {
            this.onNetworkOnline();
        });

        window.addEventListener('offline', () => {
            this.onNetworkOffline();
        });

        // Обработка событий от POS
        document.addEventListener('pos:alcoholSold', (event) => {
            this.processAlcoholSale(event.detail);
        });

        document.addEventListener('pos:alcoholReturned', (event) => {
            this.processAlcoholReturn(event.detail);
        });

        document.addEventListener('pos:inventoryChanged', (event) => {
            this.processInventoryChange(event.detail);
        });
    }

    // Тестирование подключения
    async testConnection() {
        if (!this.egaisConfig.apiKey) {
            console.warn('ЕГАИС: не настроен API ключ');
            return false;
        }

        try {
            const response = await this.makeRequest('GET', '/health');
            this.isConnected = true;
            this.lastSync = new Date();
            console.log('ЕГАИС: подключение успешно');
            return true;
        } catch (error) {
            this.isConnected = false;
            console.error('ЕГАИС: ошибка подключения:', error);
            return false;
        }
    }

    // Обработка продажи алкоголя
    async processAlcoholSale(saleData) {
        try {
            // Проверяем, является ли товар алкогольным
            if (!saleData.isAlcohol) return;

            // Проверяем наличие маркировки
            if (saleData.isMarked && !saleData.mark) {
                throw new Error('ЕГАИС: отсутствует маркировка для алкогольного товара');
            }

            // Формируем данные для ЕГАИС
            const egaisData = {
                organizationId: this.egaisConfig.organizationId,
                inn: this.egaisConfig.inn,
                kpp: this.egaisConfig.kpp,
                saleId: saleData.id,
                timestamp: saleData.timestamp,
                product: {
                    id: saleData.productId,
                    name: saleData.name,
                    alcVolumeL: saleData.alcVolumeL,
                    alcStrength: saleData.alcStrength,
                    isDraft: saleData.isDraft,
                    draftLiters: saleData.draftLiters
                },
                quantity: saleData.quantity,
                price: saleData.price,
                total: saleData.total,
                mark: saleData.mark,
                customer: saleData.customer,
                paymentMethod: saleData.paymentMethod
            };

            // Отправляем в ЕГАИС
            const response = await this.makeRequest('POST', '/sales', egaisData);
            
            // Сохраняем данные
            saleData.egaisSaleId = response.id;
            saleData.egaisStatus = response.status;
            
            // Обновляем остатки
            await this.updateInventory(saleData.productId, -saleData.quantity);
            
            // Отправляем событие
            document.dispatchEvent(new CustomEvent('egais:saleProcessed', {
                detail: { saleData, egaisResponse: response }
            }));

            console.log('ЕГАИС: продажа алкоголя обработана', response.id);
            return response;

        } catch (error) {
            console.error('ЕГАИС: ошибка обработки продажи алкоголя:', error);
            this.addToSyncQueue('sale', saleData);
            throw error;
        }
    }

    // Обработка возврата алкоголя
    async processAlcoholReturn(returnData) {
        try {
            if (!returnData.isAlcohol) return;

            const egaisData = {
                organizationId: this.egaisConfig.organizationId,
                returnId: returnData.id,
                originalSaleId: returnData.originalSaleId,
                timestamp: returnData.timestamp,
                product: {
                    id: returnData.productId,
                    name: returnData.name,
                    alcVolumeL: returnData.alcVolumeL,
                    alcStrength: returnData.alcStrength
                },
                quantity: returnData.quantity,
                price: returnData.price,
                total: returnData.total,
                mark: returnData.mark,
                reason: returnData.reason || 'Возврат товара'
            };

            const response = await this.makeRequest('POST', '/returns', egaisData);
            
            returnData.egaisReturnId = response.id;
            returnData.egaisStatus = response.status;
            
            // Обновляем остатки
            await this.updateInventory(returnData.productId, returnData.quantity);
            
            document.dispatchEvent(new CustomEvent('egais:returnProcessed', {
                detail: { returnData, egaisResponse: response }
            }));

            console.log('ЕГАИС: возврат алкоголя обработан', response.id);
            return response;

        } catch (error) {
            console.error('ЕГАИС: ошибка обработки возврата алкоголя:', error);
            this.addToSyncQueue('return', returnData);
            throw error;
        }
    }

    // Обработка изменения остатков
    async processInventoryChange(inventoryData) {
        try {
            if (!inventoryData.isAlcohol) return;

            const egaisData = {
                organizationId: this.egaisConfig.organizationId,
                productId: inventoryData.productId,
                quantity: inventoryData.quantity,
                changeType: inventoryData.changeType || 'adjustment',
                reason: inventoryData.reason || 'Корректировка остатков',
                timestamp: inventoryData.timestamp
            };

            const response = await this.makeRequest('POST', '/inventory', egaisData);
            
            document.dispatchEvent(new CustomEvent('egais:inventoryUpdated', {
                detail: { inventoryData, egaisResponse: response }
            }));

            console.log('ЕГАИС: остатки обновлены', response.id);
            return response;

        } catch (error) {
            console.error('ЕГАИС: ошибка обновления остатков:', error);
            this.addToSyncQueue('inventory', inventoryData);
            throw error;
        }
    }

    // Загрузка алкогольных товаров
    async loadAlcoholProducts() {
        try {
            const response = await this.makeRequest('GET', '/products/alcohol');
            const products = response.data || [];
            
            this.alcoholProducts.clear();
            products.forEach(product => {
                this.alcoholProducts.set(product.id, product);
            });
            
            console.log(`ЕГАИС: загружено ${products.length} алкогольных товаров`);
            
            // Отправляем событие
            document.dispatchEvent(new CustomEvent('egais:productsLoaded', {
                detail: { products, count: products.length }
            }));

        } catch (error) {
            console.error('ЕГАИС: ошибка загрузки алкогольных товаров:', error);
        }
    }

    // Загрузка марок
    async loadMarks() {
        try {
            const response = await this.makeRequest('GET', '/marks');
            const marks = response.data || [];
            
            this.marks.clear();
            marks.forEach(mark => {
                this.marks.set(mark.code, mark);
            });
            
            console.log(`ЕГАИС: загружено ${marks.length} марок`);
            
            document.dispatchEvent(new CustomEvent('egais:marksLoaded', {
                detail: { marks, count: marks.length }
            }));

        } catch (error) {
            console.error('ЕГАИС: ошибка загрузки марок:', error);
        }
    }

    // Проверка маркировки
    async checkMark(markCode) {
        try {
            const response = await this.makeRequest('GET', `/marks/${markCode}`);
            return response;
        } catch (error) {
            console.error('ЕГАИС: ошибка проверки маркировки:', error);
            throw error;
        }
    }

    // Валидация алкогольного товара
    validateAlcoholProduct(product) {
        const errors = [];
        
        // Проверяем обязательные поля
        if (!product.alcVolumeL) {
            errors.push('Не указан объем алкоголя');
        }
        
        if (!product.alcStrength) {
            errors.push('Не указана крепость алкоголя');
        }
        
        // Проверяем маркировку
        if (product.isMarked && !product.mark) {
            errors.push('Отсутствует маркировка');
        }
        
        // Проверяем лицензию
        if (!this.egaisConfig.alcoholLicense) {
            errors.push('Отсутствует лицензия на алкоголь');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Обновление остатков
    async updateInventory(productId, quantityChange) {
        try {
            const currentQuantity = this.getCurrentInventory(productId);
            const newQuantity = currentQuantity + quantityChange;
            
            if (newQuantity < 0 && this.egaisConfig.strictControl) {
                throw new Error('ЕГАИС: недостаточно остатков для продажи');
            }
            
            const inventoryData = {
                productId,
                quantity: newQuantity,
                changeType: quantityChange > 0 ? 'receipt' : 'sale',
                timestamp: new Date().toISOString()
            };
            
            await this.processInventoryChange(inventoryData);
            
        } catch (error) {
            console.error('ЕГАИС: ошибка обновления остатков:', error);
            throw error;
        }
    }

    // Получение текущих остатков
    getCurrentInventory(productId) {
        const product = this.alcoholProducts.get(productId);
        return product ? product.quantity : 0;
    }

    // Генерация отчетов
    async generateReport(reportType, dateFrom, dateTo) {
        try {
            const reportData = {
                organizationId: this.egaisConfig.organizationId,
                reportType,
                dateFrom: dateFrom.toISOString(),
                dateTo: dateTo.toISOString(),
                inn: this.egaisConfig.inn,
                kpp: this.egaisConfig.kpp
            };
            
            const response = await this.makeRequest('POST', '/reports', reportData);
            
            const report = {
                id: response.id,
                type: reportType,
                dateFrom,
                dateTo,
                status: response.status,
                url: response.url,
                generatedAt: new Date()
            };
            
            this.reports.push(report);
            
            document.dispatchEvent(new CustomEvent('egais:reportGenerated', {
                detail: { report }
            }));
            
            console.log('ЕГАИС: отчет сгенерирован', report.id);
            return report;
            
        } catch (error) {
            console.error('ЕГАИС: ошибка генерации отчета:', error);
            throw error;
        }
    }

    // Выполнение HTTP запроса
    async makeRequest(method, endpoint, data = null) {
        const url = this.egaisConfig.apiUrl + endpoint;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${this.egaisConfig.apiKey}`,
                'X-Organization-ID': this.egaisConfig.organizationId,
                'X-INN': this.egaisConfig.inn,
                'X-KPP': this.egaisConfig.kpp
            },
            timeout: this.egaisConfig.timeout
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    }

    // Добавление в очередь синхронизации
    addToSyncQueue(type, data) {
        this.syncQueue.push({
            type,
            data,
            timestamp: new Date(),
            attempts: 0
        });
        
        localStorage.setItem('egaisSyncQueue', JSON.stringify(this.syncQueue));
    }

    // Обработка очереди синхронизации
    async processSyncQueue() {
        if (this.syncQueue.length === 0) return;

        const queue = [...this.syncQueue];
        this.syncQueue = [];

        for (const item of queue) {
            try {
                if (item.type === 'sale') {
                    await this.processAlcoholSale(item.data);
                } else if (item.type === 'return') {
                    await this.processAlcoholReturn(item.data);
                } else if (item.type === 'inventory') {
                    await this.processInventoryChange(item.data);
                }
                
                console.log(`ЕГАИС: успешно обработан ${item.type}`);
            } catch (error) {
                item.attempts++;
                
                if (item.attempts < this.egaisConfig.retryAttempts) {
                    this.syncQueue.push(item);
                } else {
                    console.error(`ЕГАИС: превышено количество попыток для ${item.type}`, error);
                }
            }
        }

        localStorage.setItem('egaisSyncQueue', JSON.stringify(this.syncQueue));
    }

    // Обработка восстановления сети
    onNetworkOnline() {
        console.log('ЕГАИС: сеть восстановлена, запуск синхронизации');
        this.processSyncQueue();
        this.loadAlcoholProducts();
        this.loadMarks();
    }

    // Обработка потери сети
    onNetworkOffline() {
        console.log('ЕГАИС: сеть недоступна, работа в офлайн режиме');
    }

    // Настройка модуля
    configure(settings) {
        this.egaisConfig = { ...this.egaisConfig, ...settings };
        this.saveEGAISConfig();
        this.testConnection();
    }

    // Получение статуса модуля
    getStatus() {
        return {
            isConnected: this.isConnected,
            lastSync: this.lastSync,
            queueLength: this.syncQueue.length,
            alcoholProductsCount: this.alcoholProducts.size,
            marksCount: this.marks.size,
            reportsCount: this.reports.length,
            config: {
                hasApiKey: !!this.egaisConfig.apiKey,
                hasOrganizationId: !!this.egaisConfig.organizationId,
                hasAlcoholLicense: !!this.egaisConfig.alcoholLicense,
                hasInn: !!this.egaisConfig.inn
            }
        };
    }

    // Получение алкогольных товаров
    getAlcoholProducts() {
        return Array.from(this.alcoholProducts.values());
    }

    // Получение марок
    getMarks() {
        return Array.from(this.marks.values());
    }

    // Получение отчетов
    getReports() {
        return this.reports;
    }
}

// Экспорт модуля
window.EGAISModule = EGAISModule;
