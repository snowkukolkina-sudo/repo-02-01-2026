/**
 * Модуль интеграции с Контур.Касса
 * Полная интеграция с API Контур.Касса для фискализации и управления
 */

class KonturKassaModule {
    constructor() {
        this.apiUrl = 'https://api.kontur.ru/kassa/v1';
        this.apiKey = null;
        this.cashboxId = null;
        this.deviceId = null;
        this.isConnected = false;
        this.lastSync = null;
        this.syncQueue = [];
        this.init();
    }

    init() {
        this.loadSettings();
        this.setupEventListeners();
        this.testConnection();
    }

    // Загрузка настроек Контур.Касса
    loadSettings() {
        const settings = JSON.parse(localStorage.getItem('konturKassaSettings') || '{}');
        this.apiKey = settings.apiKey || '';
        this.cashboxId = settings.cashboxId || '';
        this.deviceId = settings.deviceId || '';
        this.apiUrl = settings.apiUrl || 'https://api.kontur.ru/kassa/v1';
        this.timeout = settings.timeout || 30000;
        this.retryAttempts = settings.retryAttempts || 3;
    }

    // Сохранение настроек
    saveSettings() {
        const settings = {
            apiKey: this.apiKey,
            cashboxId: this.cashboxId,
            deviceId: this.deviceId,
            apiUrl: this.apiUrl,
            timeout: this.timeout,
            retryAttempts: this.retryAttempts
        };
        localStorage.setItem('konturKassaSettings', JSON.stringify(settings));
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

        // Обработка событий от других модулей
        document.addEventListener('pos:receiptCreated', (event) => {
            this.processReceipt(event.detail);
        });

        document.addEventListener('pos:refundCreated', (event) => {
            this.processRefund(event.detail);
        });
    }

    // Тестирование подключения
    async testConnection() {
        if (!this.apiKey || !this.cashboxId) {
            console.warn('Контур.Касса: не настроены API ключ или ID кассы');
            return false;
        }

        try {
            const response = await this.makeRequest('GET', '/cashboxes/' + this.cashboxId);
            this.isConnected = true;
            this.lastSync = new Date();
            console.log('Контур.Касса: подключение успешно');
            return true;
        } catch (error) {
            this.isConnected = false;
            console.error('Контур.Касса: ошибка подключения:', error);
            return false;
        }
    }

    // Обработка чека продажи
    async processReceipt(receiptData) {
        try {
            const konturReceipt = this.convertToKonturFormat(receiptData);
            
            const response = await this.makeRequest('POST', '/receipts', konturReceipt);
            
            // Сохраняем ID чека для отслеживания
            receiptData.konturReceiptId = response.id;
            receiptData.konturStatus = response.status;
            
            // Отправляем событие об успешной фискализации
            document.dispatchEvent(new CustomEvent('kontur:receiptProcessed', {
                detail: { receiptData, konturResponse: response }
            }));

            return response;
        } catch (error) {
            console.error('Контур.Касса: ошибка обработки чека:', error);
            
            // Добавляем в очередь для повторной отправки
            this.addToSyncQueue('receipt', receiptData);
            
            throw error;
        }
    }

    // Обработка возврата
    async processRefund(refundData) {
        try {
            const konturRefund = this.convertToKonturRefundFormat(refundData);
            
            const response = await this.makeRequest('POST', '/refunds', konturRefund);
            
            refundData.konturRefundId = response.id;
            refundData.konturStatus = response.status;
            
            document.dispatchEvent(new CustomEvent('kontur:refundProcessed', {
                detail: { refundData, konturResponse: response }
            }));

            return response;
        } catch (error) {
            console.error('Контур.Касса: ошибка обработки возврата:', error);
            this.addToSyncQueue('refund', refundData);
            throw error;
        }
    }

    // Конвертация в формат Контур.Касса
    convertToKonturFormat(receiptData) {
        return {
            cashboxId: this.cashboxId,
            deviceId: this.deviceId,
            receiptType: receiptData.type || 'sale',
            total: receiptData.total,
            items: receiptData.items.map(item => ({
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                sum: item.sum,
                vat: this.convertVAT(item.vat),
                paymentMethod: this.convertPaymentMethod(item.paymentMethod),
                fiscalTag: item.fiscalTag || this.generateFiscalTag(item)
            })),
            payments: receiptData.payments || [{
                type: receiptData.paymentMethod || 'card',
                sum: receiptData.total
            }],
            fiscalTags: receiptData.fiscalTags || this.generateFiscalTags(receiptData),
            timestamp: receiptData.timestamp || new Date().toISOString()
        };
    }

    // Конвертация возврата в формат Контур.Касса
    convertToKonturRefundFormat(refundData) {
        return {
            cashboxId: this.cashboxId,
            deviceId: this.deviceId,
            receiptType: 'refund',
            originalReceiptId: refundData.originalReceiptId,
            total: refundData.total,
            items: refundData.items.map(item => ({
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                sum: item.sum,
                vat: this.convertVAT(item.vat),
                paymentMethod: this.convertPaymentMethod(item.paymentMethod),
                fiscalTag: item.fiscalTag
            })),
            payments: refundData.payments || [{
                type: refundData.paymentMethod || 'card',
                sum: refundData.total
            }],
            reason: refundData.reason || 'Возврат товара',
            timestamp: refundData.timestamp || new Date().toISOString()
        };
    }

    // Конвертация НДС
    convertVAT(vat) {
        const vatMap = {
            0: 'vat0',
            10: 'vat10',
            20: 'vat20',
            'none': 'vatNone'
        };
        return vatMap[vat] || 'vat20';
    }

    // Конвертация способа оплаты
    convertPaymentMethod(method) {
        const methodMap = {
            'cash': 'cash',
            'card': 'card',
            'mixed': 'mixed',
            'sbp': 'sbp',
            'prepaid': 'prepaid'
        };
        return methodMap[method] || 'card';
    }

    // Генерация фискального тега
    generateFiscalTag(item) {
        return {
            tag: 1054, // Признак способа расчета
            value: this.getPaymentMethodTag(item.paymentMethod)
        };
    }

    // Генерация фискальных тегов
    generateFiscalTags(receiptData) {
        const tags = [];
        
        // Признак способа расчета
        tags.push({
            tag: 1054,
            value: this.getPaymentMethodTag(receiptData.paymentMethod)
        });
        
        // Признак предмета расчета
        tags.push({
            tag: 1059,
            value: 1 // Товар
        });
        
        // Признак способа расчета
        tags.push({
            tag: 1055,
            value: 4 // Полный расчет
        });
        
        return tags;
    }

    // Получение тега способа оплаты
    getPaymentMethodTag(method) {
        const methodTags = {
            'cash': 1,
            'card': 2,
            'mixed': 3,
            'sbp': 4,
            'prepaid': 5
        };
        return methodTags[method] || 2;
    }

    // Выполнение HTTP запроса
    async makeRequest(method, endpoint, data = null) {
        const url = this.apiUrl + endpoint;
        const options = {
            method,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: this.timeout
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
        
        // Сохраняем очередь
        localStorage.setItem('konturSyncQueue', JSON.stringify(this.syncQueue));
    }

    // Обработка очереди синхронизации
    async processSyncQueue() {
        if (this.syncQueue.length === 0) return;

        const queue = [...this.syncQueue];
        this.syncQueue = [];

        for (const item of queue) {
            try {
                if (item.type === 'receipt') {
                    await this.processReceipt(item.data);
                } else if (item.type === 'refund') {
                    await this.processRefund(item.data);
                }
                
                console.log(`Контур.Касса: успешно обработан ${item.type}`);
            } catch (error) {
                item.attempts++;
                
                if (item.attempts < this.retryAttempts) {
                    this.syncQueue.push(item);
                } else {
                    console.error(`Контур.Касса: превышено количество попыток для ${item.type}`, error);
                }
            }
        }

        // Сохраняем обновленную очередь
        localStorage.setItem('konturSyncQueue', JSON.stringify(this.syncQueue));
    }

    // Обработка восстановления сети
    onNetworkOnline() {
        console.log('Контур.Касса: сеть восстановлена, запуск синхронизации');
        this.processSyncQueue();
    }

    // Обработка потери сети
    onNetworkOffline() {
        console.log('Контур.Касса: сеть недоступна, работа в офлайн режиме');
    }

    // Получение статуса чека
    async getReceiptStatus(receiptId) {
        try {
            const response = await this.makeRequest('GET', `/receipts/${receiptId}`);
            return response;
        } catch (error) {
            console.error('Контур.Касса: ошибка получения статуса чека:', error);
            throw error;
        }
    }

    // Получение отчетов
    async getReports(dateFrom, dateTo) {
        try {
            const params = new URLSearchParams({
                dateFrom: dateFrom.toISOString(),
                dateTo: dateTo.toISOString()
            });
            
            const response = await this.makeRequest('GET', `/reports?${params}`);
            return response;
        } catch (error) {
            console.error('Контур.Касса: ошибка получения отчетов:', error);
            throw error;
        }
    }

    // Настройка модуля
    configure(settings) {
        this.apiKey = settings.apiKey;
        this.cashboxId = settings.cashboxId;
        this.deviceId = settings.deviceId;
        this.apiUrl = settings.apiUrl || this.apiUrl;
        this.timeout = settings.timeout || this.timeout;
        this.retryAttempts = settings.retryAttempts || this.retryAttempts;
        
        this.saveSettings();
        this.testConnection();
    }

    // Получение статуса модуля
    getStatus() {
        return {
            isConnected: this.isConnected,
            lastSync: this.lastSync,
            queueLength: this.syncQueue.length,
            settings: {
                hasApiKey: !!this.apiKey,
                hasCashboxId: !!this.cashboxId,
                hasDeviceId: !!this.deviceId
            }
        };
    }
}

// Экспорт модуля
window.KonturKassaModule = KonturKassaModule;
