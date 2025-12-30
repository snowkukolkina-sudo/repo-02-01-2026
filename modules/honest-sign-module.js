/**
 * Модуль интеграции с Честным ЗНАКом
 * Полная поддержка маркировки товаров, проверки подлинности и отчетности
 */

class HonestSignModule {
    constructor() {
        this.honestSignConfig = null;
        this.isConnected = false;
        this.lastSync = null;
        this.markedProducts = new Map();
        this.marks = new Map();
        this.scannedMarks = new Map();
        this.reports = [];
        this.syncQueue = [];
        this.init();
    }

    init() {
        this.loadHonestSignConfig();
        this.setupEventListeners();
        this.testConnection();
        this.loadMarkedProducts();
        this.loadMarks();
    }

    // Загрузка конфигурации Честного ЗНАКа
    loadHonestSignConfig() {
        const config = JSON.parse(localStorage.getItem('honestSignConfig') || '{}');
        this.honestSignConfig = {
            // Основные настройки
            apiUrl: config.apiUrl || 'https://api.честныйзнак.рф/v1',
            apiKey: config.apiKey || '',
            username: config.username || '',
            password: config.password || '',
            
            // Настройки организации
            organizationId: config.organizationId || '',
            inn: config.inn || '',
            kpp: config.kpp || '',
            organizationName: config.organizationName || '',
            
            // Настройки маркировки
            autoMarking: config.autoMarking !== false,
            strictControl: config.strictControl !== false,
            markValidation: config.markValidation !== false,
            
            // Настройки синхронизации
            syncInterval: config.syncInterval || 300000, // 5 минут
            timeout: config.timeout || 30000,
            retryAttempts: config.retryAttempts || 3,
            
            // Настройки сканирования
            enableScanning: config.enableScanning !== false,
            scanTimeout: config.scanTimeout || 10000,
            
            // Настройки отчетности
            reportGeneration: config.reportGeneration !== false,
            autoReports: config.autoReports !== false,
            
            ...config
        };
    }

    // Сохранение конфигурации
    saveHonestSignConfig() {
        localStorage.setItem('honestSignConfig', JSON.stringify(this.honestSignConfig));
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
        document.addEventListener('pos:markedProductSold', (event) => {
            this.processMarkedProductSale(event.detail);
        });

        document.addEventListener('pos:markedProductReturned', (event) => {
            this.processMarkedProductReturn(event.detail);
        });

        document.addEventListener('pos:markScanned', (event) => {
            this.processMarkScan(event.detail);
        });

        // Обработка сканирования QR-кодов
        document.addEventListener('scanner:qrScanned', (event) => {
            this.processQRScan(event.detail);
        });
    }

    // Тестирование подключения
    async testConnection() {
        if (!this.honestSignConfig.apiKey) {
            console.warn('Честный ЗНАК: не настроен API ключ');
            return false;
        }

        try {
            const response = await this.makeRequest('GET', '/health');
            this.isConnected = true;
            this.lastSync = new Date();
            console.log('Честный ЗНАК: подключение успешно');
            return true;
        } catch (error) {
            this.isConnected = false;
            console.error('Честный ЗНАК: ошибка подключения:', error);
            return false;
        }
    }

    // Обработка продажи маркированного товара
    async processMarkedProductSale(saleData) {
        try {
            // Проверяем, является ли товар маркированным
            if (!saleData.isMarked) return;

            // Проверяем наличие маркировки
            if (!saleData.mark) {
                throw new Error('Честный ЗНАК: отсутствует маркировка для товара');
            }

            // Валидируем маркировку
            const markValidation = await this.validateMark(saleData.mark);
            if (!markValidation.isValid) {
                throw new Error(`Честный ЗНАК: недействительная маркировка: ${markValidation.errors.join(', ')}`);
            }

            // Формируем данные для Честного ЗНАКа
            const honestSignData = {
                organizationId: this.honestSignConfig.organizationId,
                inn: this.honestSignConfig.inn,
                kpp: this.honestSignConfig.kpp,
                saleId: saleData.id,
                timestamp: saleData.timestamp,
                product: {
                    id: saleData.productId,
                    name: saleData.name,
                    category: saleData.category,
                    gtin: saleData.gtin,
                    serialNumber: saleData.serialNumber
                },
                mark: {
                    code: saleData.mark,
                    type: saleData.markType || 'qr',
                    format: saleData.markFormat || 'gs1'
                },
                quantity: saleData.quantity,
                price: saleData.price,
                total: saleData.total,
                customer: saleData.customer,
                paymentMethod: saleData.paymentMethod
            };

            // Отправляем в Честный ЗНАК
            const response = await this.makeRequest('POST', '/sales', honestSignData);
            
            // Сохраняем данные
            saleData.honestSignSaleId = response.id;
            saleData.honestSignStatus = response.status;
            
            // Обновляем статус маркировки
            await this.updateMarkStatus(saleData.mark, 'sold');
            
            // Отправляем событие
            document.dispatchEvent(new CustomEvent('honestSign:saleProcessed', {
                detail: { saleData, honestSignResponse: response }
            }));

            console.log('Честный ЗНАК: продажа маркированного товара обработана', response.id);
            return response;

        } catch (error) {
            console.error('Честный ЗНАК: ошибка обработки продажи маркированного товара:', error);
            this.addToSyncQueue('sale', saleData);
            throw error;
        }
    }

    // Обработка возврата маркированного товара
    async processMarkedProductReturn(returnData) {
        try {
            if (!returnData.isMarked) return;

            const honestSignData = {
                organizationId: this.honestSignConfig.organizationId,
                returnId: returnData.id,
                originalSaleId: returnData.originalSaleId,
                timestamp: returnData.timestamp,
                product: {
                    id: returnData.productId,
                    name: returnData.name,
                    gtin: returnData.gtin
                },
                mark: {
                    code: returnData.mark,
                    type: returnData.markType || 'qr'
                },
                quantity: returnData.quantity,
                price: returnData.price,
                total: returnData.total,
                reason: returnData.reason || 'Возврат товара'
            };

            const response = await this.makeRequest('POST', '/returns', honestSignData);
            
            returnData.honestSignReturnId = response.id;
            returnData.honestSignStatus = response.status;
            
            // Обновляем статус маркировки
            await this.updateMarkStatus(returnData.mark, 'returned');
            
            document.dispatchEvent(new CustomEvent('honestSign:returnProcessed', {
                detail: { returnData, honestSignResponse: response }
            }));

            console.log('Честный ЗНАК: возврат маркированного товара обработан', response.id);
            return response;

        } catch (error) {
            console.error('Честный ЗНАК: ошибка обработки возврата маркированного товара:', error);
            this.addToSyncQueue('return', returnData);
            throw error;
        }
    }

    // Обработка сканирования маркировки
    async processMarkScan(scanData) {
        try {
            const markCode = scanData.markCode;
            
            // Проверяем маркировку
            const validation = await this.validateMark(markCode);
            
            // Сохраняем результат сканирования
            this.scannedMarks.set(markCode, {
                ...validation,
                scannedAt: new Date(),
                scannedBy: scanData.scannedBy || 'unknown'
            });
            
            // Отправляем событие
            document.dispatchEvent(new CustomEvent('honestSign:markScanned', {
                detail: { markCode, validation }
            }));
            
            console.log('Честный ЗНАК: маркировка отсканирована', markCode);
            return validation;
            
        } catch (error) {
            console.error('Честный ЗНАК: ошибка обработки сканирования маркировки:', error);
            throw error;
        }
    }

    // Обработка сканирования QR-кода
    async processQRScan(qrData) {
        try {
            const qrCode = qrData.qrCode;
            
            // Проверяем, является ли QR-код маркировкой
            if (this.isMarkQRCode(qrCode)) {
                return await this.processMarkScan({ markCode: qrCode, scannedBy: qrData.scannedBy });
            }
            
            // Обрабатываем как обычный QR-код
            const qrInfo = await this.decodeQRCode(qrCode);
            
            document.dispatchEvent(new CustomEvent('honestSign:qrDecoded', {
                detail: { qrCode, qrInfo }
            }));
            
            return qrInfo;
            
        } catch (error) {
            console.error('Честный ЗНАК: ошибка обработки QR-кода:', error);
            throw error;
        }
    }

    // Валидация маркировки
    async validateMark(markCode) {
        try {
            const response = await this.makeRequest('GET', `/marks/${markCode}/validate`);
            return {
                isValid: response.isValid,
                product: response.product,
                status: response.status,
                errors: response.errors || [],
                warnings: response.warnings || []
            };
        } catch (error) {
            console.error('Честный ЗНАК: ошибка валидации маркировки:', error);
            return {
                isValid: false,
                errors: ['Ошибка валидации маркировки'],
                warnings: []
            };
        }
    }

    // Проверка, является ли QR-код маркировкой
    isMarkQRCode(qrCode) {
        // Проверяем формат маркировки (GS1, Data Matrix и др.)
        const markPatterns = [
            /^01\d{14}21[A-Za-z0-9]{13}$/, // GS1 формат
            /^[A-Za-z0-9]{44}$/, // Data Matrix
            /^[A-Za-z0-9]{68}$/  // QR-код маркировки
        ];
        
        return markPatterns.some(pattern => pattern.test(qrCode));
    }

    // Декодирование QR-кода
    async decodeQRCode(qrCode) {
        try {
            const response = await this.makeRequest('POST', '/qr/decode', { qrCode });
            return response;
        } catch (error) {
            console.error('Честный ЗНАК: ошибка декодирования QR-кода:', error);
            return {
                type: 'unknown',
                data: qrCode,
                error: 'Не удалось декодировать QR-код'
            };
        }
    }

    // Обновление статуса маркировки
    async updateMarkStatus(markCode, status) {
        try {
            const markData = {
                code: markCode,
                status: status,
                updatedAt: new Date().toISOString()
            };
            
            await this.makeRequest('PUT', `/marks/${markCode}/status`, markData);
            
            // Обновляем локальный кэш
            if (this.marks.has(markCode)) {
                const mark = this.marks.get(markCode);
                mark.status = status;
                mark.updatedAt = new Date();
                this.marks.set(markCode, mark);
            }
            
        } catch (error) {
            console.error('Честный ЗНАК: ошибка обновления статуса маркировки:', error);
        }
    }

    // Загрузка маркированных товаров
    async loadMarkedProducts() {
        try {
            const response = await this.makeRequest('GET', '/products/marked');
            const products = response.data || [];
            
            this.markedProducts.clear();
            products.forEach(product => {
                this.markedProducts.set(product.id, product);
            });
            
            console.log(`Честный ЗНАК: загружено ${products.length} маркированных товаров`);
            
            document.dispatchEvent(new CustomEvent('honestSign:productsLoaded', {
                detail: { products, count: products.length }
            }));

        } catch (error) {
            console.error('Честный ЗНАК: ошибка загрузки маркированных товаров:', error);
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
            
            console.log(`Честный ЗНАК: загружено ${marks.length} марок`);
            
            document.dispatchEvent(new CustomEvent('honestSign:marksLoaded', {
                detail: { marks, count: marks.length }
            }));

        } catch (error) {
            console.error('Честный ЗНАК: ошибка загрузки марок:', error);
        }
    }

    // Генерация отчетов
    async generateReport(reportType, dateFrom, dateTo) {
        try {
            const reportData = {
                organizationId: this.honestSignConfig.organizationId,
                reportType,
                dateFrom: dateFrom.toISOString(),
                dateTo: dateTo.toISOString(),
                inn: this.honestSignConfig.inn,
                kpp: this.honestSignConfig.kpp
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
            
            document.dispatchEvent(new CustomEvent('honestSign:reportGenerated', {
                detail: { report }
            }));
            
            console.log('Честный ЗНАК: отчет сгенерирован', report.id);
            return report;
            
        } catch (error) {
            console.error('Честный ЗНАК: ошибка генерации отчета:', error);
            throw error;
        }
    }

    // Выполнение HTTP запроса
    async makeRequest(method, endpoint, data = null) {
        const url = this.honestSignConfig.apiUrl + endpoint;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${this.honestSignConfig.apiKey}`,
                'X-Organization-ID': this.honestSignConfig.organizationId,
                'X-INN': this.honestSignConfig.inn,
                'X-KPP': this.honestSignConfig.kpp
            },
            timeout: this.honestSignConfig.timeout
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
        
        localStorage.setItem('honestSignSyncQueue', JSON.stringify(this.syncQueue));
    }

    // Обработка очереди синхронизации
    async processSyncQueue() {
        if (this.syncQueue.length === 0) return;

        const queue = [...this.syncQueue];
        this.syncQueue = [];

        for (const item of queue) {
            try {
                if (item.type === 'sale') {
                    await this.processMarkedProductSale(item.data);
                } else if (item.type === 'return') {
                    await this.processMarkedProductReturn(item.data);
                }
                
                console.log(`Честный ЗНАК: успешно обработан ${item.type}`);
            } catch (error) {
                item.attempts++;
                
                if (item.attempts < this.honestSignConfig.retryAttempts) {
                    this.syncQueue.push(item);
                } else {
                    console.error(`Честный ЗНАК: превышено количество попыток для ${item.type}`, error);
                }
            }
        }

        localStorage.setItem('honestSignSyncQueue', JSON.stringify(this.syncQueue));
    }

    // Обработка восстановления сети
    onNetworkOnline() {
        console.log('Честный ЗНАК: сеть восстановлена, запуск синхронизации');
        this.processSyncQueue();
        this.loadMarkedProducts();
        this.loadMarks();
    }

    // Обработка потери сети
    onNetworkOffline() {
        console.log('Честный ЗНАК: сеть недоступна, работа в офлайн режиме');
    }

    // Настройка модуля
    configure(settings) {
        this.honestSignConfig = { ...this.honestSignConfig, ...settings };
        this.saveHonestSignConfig();
        this.testConnection();
    }

    // Получение статуса модуля
    getStatus() {
        return {
            isConnected: this.isConnected,
            lastSync: this.lastSync,
            queueLength: this.syncQueue.length,
            markedProductsCount: this.markedProducts.size,
            marksCount: this.marks.size,
            scannedMarksCount: this.scannedMarks.size,
            reportsCount: this.reports.length,
            config: {
                hasApiKey: !!this.honestSignConfig.apiKey,
                hasOrganizationId: !!this.honestSignConfig.organizationId,
                hasInn: !!this.honestSignConfig.inn,
                autoMarking: this.honestSignConfig.autoMarking,
                strictControl: this.honestSignConfig.strictControl
            }
        };
    }

    // Получение маркированных товаров
    getMarkedProducts() {
        return Array.from(this.markedProducts.values());
    }

    // Получение марок
    getMarks() {
        return Array.from(this.marks.values());
    }

    // Получение отсканированных марок
    getScannedMarks() {
        return Array.from(this.scannedMarks.values());
    }

    // Получение отчетов
    getReports() {
        return this.reports;
    }
}

// Экспорт модуля
window.HonestSignModule = HonestSignModule;
