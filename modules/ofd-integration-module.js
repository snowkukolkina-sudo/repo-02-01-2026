/**
 * Модуль интеграции с ОФД (Операторы Фискальных Данных)
 * Поддержка всех основных ОФД: Такском, Первый ОФД, Контур.ОФД, Яндекс.ОФД и др.
 */

class OFDIntegrationModule {
    constructor() {
        this.ofdConfig = null;
        this.ofdProviders = new Map();
        this.activeProvider = null;
        this.isConnected = false;
        this.lastSync = null;
        this.syncQueue = [];
        this.init();
    }

    init() {
        this.loadOFDConfig();
        this.setupOFDProviders();
        this.setupEventListeners();
        this.testConnection();
    }

    // Загрузка конфигурации ОФД
    loadOFDConfig() {
        const config = JSON.parse(localStorage.getItem('ofdConfig') || '{}');
        this.ofdConfig = {
            // Основные настройки
            provider: config.provider || 'takskom', // takskom, first-ofd, kontur-ofd, yandex-ofd
            apiUrl: config.apiUrl || '',
            apiKey: config.apiKey || '',
            username: config.username || '',
            password: config.password || '',
            
            // Настройки фискализации
            fnSerial: config.fnSerial || '',
            ofdUrl: config.ofdUrl || '',
            taxSystem: config.taxSystem || 1, // ОСН
            operatorName: config.operatorName || 'Кассир',
            
            // Настройки синхронизации
            syncInterval: config.syncInterval || 60000, // 1 минута
            timeout: config.timeout || 30000,
            retryAttempts: config.retryAttempts || 3,
            
            // Настройки уведомлений
            emailNotifications: config.emailNotifications !== false,
            smsNotifications: config.smsNotifications !== false,
            webhookUrl: config.webhookUrl || '',
            
            ...config
        };
    }

    // Сохранение конфигурации
    saveOFDConfig() {
        localStorage.setItem('ofdConfig', JSON.stringify(this.ofdConfig));
    }

    // Настройка провайдеров ОФД
    setupOFDProviders() {
        // Такском
        this.ofdProviders.set('takskom', {
            name: 'Такском',
            apiUrl: 'https://api.takskom.ru/v1',
            endpoints: {
                receipts: '/receipts',
                reports: '/reports',
                status: '/status',
                health: '/health'
            },
            authType: 'bearer',
            features: ['receipts', 'reports', 'notifications', 'webhooks']
        });

        // Первый ОФД
        this.ofdProviders.set('first-ofd', {
            name: 'Первый ОФД',
            apiUrl: 'https://api.first-ofd.ru/v1',
            endpoints: {
                receipts: '/documents',
                reports: '/reports',
                status: '/status',
                health: '/health'
            },
            authType: 'basic',
            features: ['receipts', 'reports', 'notifications']
        });

        // Контур.ОФД
        this.ofdProviders.set('kontur-ofd', {
            name: 'Контур.ОФД',
            apiUrl: 'https://api.kontur.ru/ofd/v1',
            endpoints: {
                receipts: '/receipts',
                reports: '/reports',
                status: '/status',
                health: '/health'
            },
            authType: 'bearer',
            features: ['receipts', 'reports', 'notifications', 'webhooks']
        });

        // Яндекс.ОФД
        this.ofdProviders.set('yandex-ofd', {
            name: 'Яндекс.ОФД',
            apiUrl: 'https://api.ofd.yandex.ru/v1',
            endpoints: {
                receipts: '/receipts',
                reports: '/reports',
                status: '/status',
                health: '/health'
            },
            authType: 'oauth',
            features: ['receipts', 'reports', 'notifications']
        });

        // Эвотор.ОФД
        this.ofdProviders.set('evotor-ofd', {
            name: 'Эвотор.ОФД',
            apiUrl: 'https://api.evotor.ru/ofd/v1',
            endpoints: {
                receipts: '/receipts',
                reports: '/reports',
                status: '/status',
                health: '/health'
            },
            authType: 'bearer',
            features: ['receipts', 'reports', 'notifications']
        });

        // Установка активного провайдера
        this.activeProvider = this.ofdProviders.get(this.ofdConfig.provider);
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
        document.addEventListener('fiscal:receiptCreated', (event) => {
            this.sendReceiptToOFD(event.detail);
        });

        document.addEventListener('fiscal:refundCreated', (event) => {
            this.sendRefundToOFD(event.detail);
        });

        document.addEventListener('fiscal:correctionCreated', (event) => {
            this.sendCorrectionToOFD(event.detail);
        });
    }

    // Тестирование подключения
    async testConnection() {
        if (!this.activeProvider) {
            console.warn('ОФД: не настроен провайдер');
            return false;
        }

        try {
            const response = await this.makeRequest('GET', this.activeProvider.endpoints.health);
            this.isConnected = true;
            this.lastSync = new Date();
            console.log(`ОФД: подключение к ${this.activeProvider.name} успешно`);
            return true;
        } catch (error) {
            this.isConnected = false;
            console.error(`ОФД: ошибка подключения к ${this.activeProvider.name}:`, error);
            return false;
        }
    }

    // Отправка чека в ОФД
    async sendReceiptToOFD(receiptData) {
        try {
            const ofdReceipt = this.convertToOFDFormat(receiptData);
            
            const response = await this.makeRequest('POST', this.activeProvider.endpoints.receipts, ofdReceipt);
            
            // Сохраняем ID чека для отслеживания
            receiptData.ofdReceiptId = response.id;
            receiptData.ofdStatus = response.status;
            receiptData.ofdUrl = response.url;
            
            // Отправляем событие об успешной отправке
            document.dispatchEvent(new CustomEvent('ofd:receiptSent', {
                detail: { receiptData, ofdResponse: response }
            }));

            // Отправляем уведомления
            if (this.ofdConfig.emailNotifications) {
                await this.sendEmailNotification(receiptData, response);
            }
            
            if (this.ofdConfig.smsNotifications) {
                await this.sendSMSNotification(receiptData, response);
            }

            return response;
        } catch (error) {
            console.error('ОФД: ошибка отправки чека:', error);
            
            // Добавляем в очередь для повторной отправки
            this.addToSyncQueue('receipt', receiptData);
            
            throw error;
        }
    }

    // Отправка возврата в ОФД
    async sendRefundToOFD(refundData) {
        try {
            const ofdRefund = this.convertRefundToOFDFormat(refundData);
            
            const response = await this.makeRequest('POST', this.activeProvider.endpoints.receipts, ofdRefund);
            
            refundData.ofdRefundId = response.id;
            refundData.ofdStatus = response.status;
            refundData.ofdUrl = response.url;
            
            document.dispatchEvent(new CustomEvent('ofd:refundSent', {
                detail: { refundData, ofdResponse: response }
            }));

            return response;
        } catch (error) {
            console.error('ОФД: ошибка отправки возврата:', error);
            this.addToSyncQueue('refund', refundData);
            throw error;
        }
    }

    // Отправка коррекции в ОФД
    async sendCorrectionToOFD(correctionData) {
        try {
            const ofdCorrection = this.convertCorrectionToOFDFormat(correctionData);
            
            const response = await this.makeRequest('POST', this.activeProvider.endpoints.receipts, ofdCorrection);
            
            correctionData.ofdCorrectionId = response.id;
            correctionData.ofdStatus = response.status;
            correctionData.ofdUrl = response.url;
            
            document.dispatchEvent(new CustomEvent('ofd:correctionSent', {
                detail: { correctionData, ofdResponse: response }
            }));

            return response;
        } catch (error) {
            console.error('ОФД: ошибка отправки коррекции:', error);
            this.addToSyncQueue('correction', correctionData);
            throw error;
        }
    }

    // Конвертация в формат ОФД
    convertToOFDFormat(receiptData) {
        return {
            // Основные данные
            id: receiptData.id,
            timestamp: receiptData.timestamp,
            receiptType: receiptData.type || 'sale',
            
            // Данные фискального накопителя
            fnSerial: this.ofdConfig.fnSerial,
            ofdUrl: this.ofdConfig.ofdUrl,
            taxSystem: this.ofdConfig.taxSystem,
            operatorName: this.ofdConfig.operatorName,
            
            // Данные чека
            total: receiptData.total,
            items: receiptData.items.map(item => ({
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                sum: item.sum,
                vat: item.vat,
                paymentMethod: item.paymentMethod,
                fiscalTag: item.fiscalTag
            })),
            
            // Способы оплаты
            payments: receiptData.payments || [{
                type: receiptData.paymentMethod || 'card',
                sum: receiptData.total
            }],
            
            // Фискальные теги
            fiscalTags: receiptData.fiscalTags || this.generateFiscalTags(receiptData),
            
            // Дополнительные данные
            customer: receiptData.customer,
            delivery: receiptData.delivery,
            notes: receiptData.notes
        };
    }

    // Конвертация возврата в формат ОФД
    convertRefundToOFDFormat(refundData) {
        return {
            ...this.convertToOFDFormat(refundData),
            receiptType: 'refund',
            originalReceiptId: refundData.originalReceiptId,
            reason: refundData.reason || 'Возврат товара'
        };
    }

    // Конвертация коррекции в формат ОФД
    convertCorrectionToOFDFormat(correctionData) {
        return {
            ...this.convertToOFDFormat(correctionData),
            receiptType: 'correction',
            originalReceiptId: correctionData.originalReceiptId,
            reason: correctionData.reason || 'Коррекция чека',
            correctionType: correctionData.correctionType || 'self'
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
        
        // НДС
        tags.push({
            tag: 1059,
            value: this.getVATTag(receiptData.items[0]?.vat || 20)
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

    // Получение тега НДС
    getVATTag(vat) {
        const vatTags = {
            0: 1104,
            10: 1105,
            20: 1106,
            'none': 1107
        };
        return vatTags[vat] || 1106;
    }

    // Выполнение HTTP запроса
    async makeRequest(method, endpoint, data = null) {
        const url = this.activeProvider.apiUrl + endpoint;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': this.getAuthHeader()
            },
            timeout: this.ofdConfig.timeout
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

    // Получение заголовка авторизации
    getAuthHeader() {
        switch (this.activeProvider.authType) {
            case 'bearer':
                return `Bearer ${this.ofdConfig.apiKey}`;
            case 'basic':
                const credentials = btoa(`${this.ofdConfig.username}:${this.ofdConfig.password}`);
                return `Basic ${credentials}`;
            case 'oauth':
                return `OAuth ${this.ofdConfig.apiKey}`;
            default:
                return '';
        }
    }

    // Отправка email уведомления
    async sendEmailNotification(receiptData, ofdResponse) {
        if (!receiptData.customer?.email) return;

        try {
            const emailData = {
                to: receiptData.customer.email,
                subject: `Чек №${receiptData.id} от ${new Date(receiptData.timestamp).toLocaleDateString()}`,
                body: this.generateEmailBody(receiptData, ofdResponse),
                receiptUrl: ofdResponse.url
            };

            // Отправляем событие для отправки email
            document.dispatchEvent(new CustomEvent('email:send', {
                detail: emailData
            }));

        } catch (error) {
            console.error('ОФД: ошибка отправки email уведомления:', error);
        }
    }

    // Отправка SMS уведомления
    async sendSMSNotification(receiptData, ofdResponse) {
        if (!receiptData.customer?.phone) return;

        try {
            const smsData = {
                to: receiptData.customer.phone,
                message: `Чек №${receiptData.id} на сумму ${receiptData.total}₽. Ссылка: ${ofdResponse.url}`
            };

            // Отправляем событие для отправки SMS
            document.dispatchEvent(new CustomEvent('sms:send', {
                detail: smsData
            }));

        } catch (error) {
            console.error('ОФД: ошибка отправки SMS уведомления:', error);
        }
    }

    // Генерация тела email
    generateEmailBody(receiptData, ofdResponse) {
        return `
            <h2>Чек №${receiptData.id}</h2>
            <p>Дата: ${new Date(receiptData.timestamp).toLocaleString()}</p>
            <p>Сумма: ${receiptData.total}₽</p>
            <p>Способ оплаты: ${this.getPaymentMethodName(receiptData.paymentMethod)}</p>
            <p><a href="${ofdResponse.url}">Посмотреть чек</a></p>
        `;
    }

    // Получение названия способа оплаты
    getPaymentMethodName(method) {
        const methodNames = {
            'cash': 'Наличные',
            'card': 'Банковская карта',
            'mixed': 'Смешанная оплата',
            'sbp': 'СБП',
            'prepaid': 'Предоплата'
        };
        return methodNames[method] || 'Банковская карта';
    }

    // Добавление в очередь синхронизации
    addToSyncQueue(type, data) {
        this.syncQueue.push({
            type,
            data,
            timestamp: new Date(),
            attempts: 0
        });
        
        localStorage.setItem('ofdSyncQueue', JSON.stringify(this.syncQueue));
    }

    // Обработка очереди синхронизации
    async processSyncQueue() {
        if (this.syncQueue.length === 0) return;

        const queue = [...this.syncQueue];
        this.syncQueue = [];

        for (const item of queue) {
            try {
                if (item.type === 'receipt') {
                    await this.sendReceiptToOFD(item.data);
                } else if (item.type === 'refund') {
                    await this.sendRefundToOFD(item.data);
                } else if (item.type === 'correction') {
                    await this.sendCorrectionToOFD(item.data);
                }
                
                console.log(`ОФД: успешно обработан ${item.type}`);
            } catch (error) {
                item.attempts++;
                
                if (item.attempts < this.ofdConfig.retryAttempts) {
                    this.syncQueue.push(item);
                } else {
                    console.error(`ОФД: превышено количество попыток для ${item.type}`, error);
                }
            }
        }

        localStorage.setItem('ofdSyncQueue', JSON.stringify(this.syncQueue));
    }

    // Обработка восстановления сети
    onNetworkOnline() {
        console.log('ОФД: сеть восстановлена, запуск синхронизации');
        this.processSyncQueue();
    }

    // Обработка потери сети
    onNetworkOffline() {
        console.log('ОФД: сеть недоступна, работа в офлайн режиме');
    }

    // Получение статуса чека
    async getReceiptStatus(receiptId) {
        try {
            const response = await this.makeRequest('GET', `${this.activeProvider.endpoints.status}/${receiptId}`);
            return response;
        } catch (error) {
            console.error('ОФД: ошибка получения статуса чека:', error);
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
            
            const response = await this.makeRequest('GET', `${this.activeProvider.endpoints.reports}?${params}`);
            return response;
        } catch (error) {
            console.error('ОФД: ошибка получения отчетов:', error);
            throw error;
        }
    }

    // Настройка модуля
    configure(settings) {
        this.ofdConfig = { ...this.ofdConfig, ...settings };
        this.saveOFDConfig();
        this.setupOFDProviders();
        this.testConnection();
    }

    // Получение статуса модуля
    getStatus() {
        return {
            isConnected: this.isConnected,
            lastSync: this.lastSync,
            queueLength: this.syncQueue.length,
            provider: this.activeProvider?.name || 'Не настроен',
            config: {
                hasApiKey: !!this.ofdConfig.apiKey,
                hasFnSerial: !!this.ofdConfig.fnSerial,
                hasOfdUrl: !!this.ofdConfig.ofdUrl
            }
        };
    }

    // Получение списка доступных провайдеров
    getAvailableProviders() {
        return Array.from(this.ofdProviders.values());
    }
}

// Экспорт модуля
window.OFDIntegrationModule = OFDIntegrationModule;
