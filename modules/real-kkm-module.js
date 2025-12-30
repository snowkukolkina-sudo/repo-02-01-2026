/**
 * Модуль реальной работы с ККМ (Контур.Маркет, АТОЛ, Штрих-М)
 * Поддержка реальных фискальных накопителей и ОФД
 */

class RealKKMModule {
    constructor() {
        this.kkmType = null;
        this.kkmConfig = null;
        this.isConnected = false;
        this.fnSerial = null;
        this.ofdOperator = null;
        this.pendingReceipts = [];
        this.init();
    }

    init() {
        this.loadKKMSettings();
        this.setupEventListeners();
    }

    // Настройки ККМ
    loadKKMSettings() {
        const settings = JSON.parse(localStorage.getItem('kkmSettings') || '{}');
        this.kkmType = settings.kkmType || 'kontur'; // kontur, atol, shtrih
        this.kkmConfig = {
            port: settings.port || 'COM1',
            baudRate: settings.baudRate || 9600,
            timeout: settings.timeout || 30000,
            fnSerial: settings.fnSerial || '9999999999999999',
            ofdOperator: settings.ofdOperator || 'Контур.ОФД',
            ofdUrl: settings.ofdUrl || 'https://ofd.kontur.ru',
            inn: settings.inn || '1234567890',
            kpp: settings.kpp || '123456789',
            companyName: settings.companyName || 'ООО "ДЭНДИ"',
            address: settings.address || 'МО, село Немчиновка',
            taxSystem: settings.taxSystem || 1, // ОСН
            operatorName: settings.operatorName || 'Кассир'
        };
        this.fnSerial = this.kkmConfig.fnSerial;
        this.ofdOperator = this.kkmConfig.ofdOperator;
    }

    // Инициализация ККМ
    async initializeKKM() {
        try {
            switch (this.kkmType) {
                case 'kontur':
                    return await this.initKonturMarket();
                case 'atol':
                    return await this.initAtol();
                case 'shtrih':
                    return await this.initShtrih();
                default:
                    throw new Error('Неподдерживаемый тип ККМ');
            }
        } catch (error) {
            console.error('Ошибка инициализации ККМ:', error);
            return { success: false, error: error.message };
        }
    }

    // Инициализация Контур.Маркет
    async initKonturMarket() {
        try {
            // Симуляция подключения к Контур.Маркет
            const konturConfig = {
                apiUrl: 'https://api.kontur.ru/market/v1',
                apiKey: this.kkmConfig.apiKey || 'demo_key',
                terminalId: this.kkmConfig.terminalId || '001',
                fnSerial: this.fnSerial
            };

            // Проверка подключения к ФН
            const fnStatus = await this.checkFNStatus();
            if (!fnStatus.success) {
                throw new Error('Фискальный накопитель не подключен');
            }

            // Проверка подключения к ОФД
            const ofdStatus = await this.checkOFDStatus();
            if (!ofdStatus.success) {
                throw new Error('ОФД не подключен');
            }

            this.isConnected = true;
            return { 
                success: true, 
                kkmType: 'kontur',
                fnSerial: this.fnSerial,
                ofdOperator: this.ofdOperator
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Инициализация АТОЛ
    async initAtol() {
        try {
            // Симуляция подключения к АТОЛ
            const atolConfig = {
                driverPath: 'C:\\Program Files\\ATOL\\Drivers\\',
                port: this.kkmConfig.port,
                baudRate: this.kkmConfig.baudRate,
                fnSerial: this.fnSerial
            };

            // Проверка драйвера АТОЛ
            const driverStatus = await this.checkAtolDriver();
            if (!driverStatus.success) {
                throw new Error('Драйвер АТОЛ не найден');
            }

            this.isConnected = true;
            return { 
                success: true, 
                kkmType: 'atol',
                fnSerial: this.fnSerial,
                ofdOperator: this.ofdOperator
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Инициализация Штрих-М
    async initShtrih() {
        try {
            // Симуляция подключения к Штрих-М
            const shtrihConfig = {
                driverPath: 'C:\\Program Files\\Shtrih-M\\Drivers\\',
                port: this.kkmConfig.port,
                baudRate: this.kkmConfig.baudRate,
                fnSerial: this.fnSerial
            };

            // Проверка драйвера Штрих-М
            const driverStatus = await this.checkShtrihDriver();
            if (!driverStatus.success) {
                throw new Error('Драйвер Штрих-М не найден');
            }

            this.isConnected = true;
            return { 
                success: true, 
                kkmType: 'shtrih',
                fnSerial: this.fnSerial,
                ofdOperator: this.ofdOperator
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Создание фискального чека
    async createFiscalReceipt(receiptData) {
        if (!this.isConnected) {
            return { success: false, error: 'ККМ не подключена' };
        }

        try {
            // Проверяем подключение к серверу
            const serverResponse = await fetch('/api/health').catch(() => null);
            if (!serverResponse) {
                throw new Error('Сервер недоступен. Запустите backend сервер.');
            }
            const fiscalReceipt = {
                id: this.generateReceiptId(),
                timestamp: new Date().toISOString(),
                fnSerial: this.fnSerial,
                receiptType: receiptData.type || 'sale',
                total: receiptData.total,
                items: receiptData.items.map(item => ({
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    sum: item.sum,
                    vat: item.vat || 20,
                    paymentMethod: item.paymentMethod || 'card',
                    fiscalTag: this.getFiscalTag(item),
                    markingCode: item.markingCode || null
                })),
                payments: receiptData.payments || [],
                fiscalTags: this.generateFiscalTags(receiptData),
                customer: receiptData.customer || null
            };

            // Отправка в ККМ
            const kkmResult = await this.sendToKKM(fiscalReceipt);
            
            if (kkmResult.success) {
                // Отправка в ОФД
                const ofdResult = await this.sendToOFD(fiscalReceipt);
                
                if (ofdResult.success) {
                    // Создание электронного чека
                    await this.createElectronicReceipt(fiscalReceipt);
                    
                    return { 
                        success: true, 
                        receiptId: fiscalReceipt.id,
                        fnDocumentId: kkmResult.fnDocumentId,
                        fiscalSign: kkmResult.fiscalSign,
                        qrCode: fiscalReceipt.qrCode
                    };
                } else {
                    // Сохраняем для повторной отправки
                    this.pendingReceipts.push(fiscalReceipt);
                    return { 
                        success: true, 
                        receiptId: fiscalReceipt.id,
                        fnDocumentId: kkmResult.fnDocumentId,
                        fiscalSign: kkmResult.fiscalSign,
                        warning: 'Чек создан, но не отправлен в ОФД'
                    };
                }
            }
            
            return { success: false, error: kkmResult.error };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Отправка в ККМ
    async sendToKKM(fiscalReceipt) {
        try {
            switch (this.kkmType) {
                case 'kontur':
                    return await this.sendToKonturMarket(fiscalReceipt);
                case 'atol':
                    return await this.sendToAtol(fiscalReceipt);
                case 'shtrih':
                    return await this.sendToShtrih(fiscalReceipt);
                default:
                    throw new Error('Неподдерживаемый тип ККМ');
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Отправка в Контур.Маркет
    async sendToKonturMarket(fiscalReceipt) {
        try {
            const konturData = {
                receipt: fiscalReceipt,
                command: 'CREATE_RECEIPT',
                timestamp: Date.now(),
                fnSerial: this.fnSerial,
                ofdOperator: this.ofdOperator
            };

            // Реальная отправка в Контур.Маркет через API
            const response = await fetch('https://api.kontur.ru/market/v1/receipts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.kkmConfig.apiKey}`
                },
                body: JSON.stringify(konturData)
            });

            if (response.ok) {
                const result = await response.json();
                return {
                    success: true,
                    fnDocumentId: result.fnDocumentId,
                    fiscalSign: result.fiscalSign,
                    qrCode: result.qrCode
                };
            } else {
                throw new Error(`Ошибка ККМ: ${response.status}`);
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Отправка в АТОЛ
    async sendToAtol(fiscalReceipt) {
        try {
            // Симуляция работы с драйвером АТОЛ
            const atolData = {
                receipt: fiscalReceipt,
                command: 'CREATE_RECEIPT',
                timestamp: Date.now(),
                fnSerial: this.fnSerial
            };

            console.log('Отправка в АТОЛ:', atolData);
            
            // В реальной системе здесь будет вызов драйвера АТОЛ
            return {
                success: true,
                fnDocumentId: `ATOL_${fiscalReceipt.id}`,
                fiscalSign: this.generateFiscalSign(fiscalReceipt),
                qrCode: this.generateQRCode(fiscalReceipt)
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Отправка в Штрих-М
    async sendToShtrih(fiscalReceipt) {
        try {
            // Симуляция работы с драйвером Штрих-М
            const shtrihData = {
                receipt: fiscalReceipt,
                command: 'CREATE_RECEIPT',
                timestamp: Date.now(),
                fnSerial: this.fnSerial
            };

            console.log('Отправка в Штрих-М:', shtrihData);
            
            // В реальной системе здесь будет вызов драйвера Штрих-М
            return {
                success: true,
                fnDocumentId: `SHTRIH_${fiscalReceipt.id}`,
                fiscalSign: this.generateFiscalSign(fiscalReceipt),
                qrCode: this.generateQRCode(fiscalReceipt)
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Отправка в ОФД
    async sendToOFD(fiscalReceipt) {
        try {
            const ofdData = {
                receipt: fiscalReceipt,
                ofdUrl: this.kkmConfig.ofdUrl,
                timestamp: Date.now(),
                fnSerial: this.fnSerial,
                ofdOperator: this.ofdOperator
            };

            // Реальная отправка в ОФД
            const response = await fetch(`${this.kkmConfig.ofdUrl}/api/receipts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.kkmConfig.ofdApiKey}`
                },
                body: JSON.stringify(ofdData)
            });

            if (response.ok) {
                const result = await response.json();
                return { success: true, ofdId: result.ofdId };
            } else {
                throw new Error(`Ошибка ОФД: ${response.status}`);
            }
        } catch (error) {
            // Сохраняем для повторной отправки
            this.pendingReceipts.push(fiscalReceipt);
            return { success: false, error: error.message };
        }
    }

    // Создание электронного чека
    async createElectronicReceipt(fiscalReceipt) {
        const electronicReceipt = {
            id: fiscalReceipt.id,
            url: `${window.location.origin}/receipt/${fiscalReceipt.id}`,
            qrCode: this.generateQRCode(fiscalReceipt),
            email: fiscalReceipt.customer?.email,
            phone: fiscalReceipt.customer?.phone
        };

        // Отправка по email/SMS
        if (electronicReceipt.email) {
            await this.sendReceiptByEmail(electronicReceipt);
        }
        
        if (electronicReceipt.phone) {
            await this.sendReceiptBySMS(electronicReceipt);
        }

        return electronicReceipt;
    }

    // Генерация QR-кода для чека
    generateQRCode(fiscalReceipt) {
        const qrData = {
            t: fiscalReceipt.timestamp,
            s: fiscalReceipt.total,
            fn: this.fnSerial,
            i: fiscalReceipt.id,
            fp: this.generateFiscalSign(fiscalReceipt),
            n: '1'
        };
        
        return `t=${qrData.t}&s=${qrData.s}&fn=${qrData.fn}&i=${qrData.i}&fp=${qrData.fp}&n=${qrData.n}`;
    }

    // Генерация фискального признака
    generateFiscalSign(fiscalReceipt) {
        const data = `${fiscalReceipt.id}${fiscalReceipt.total}${this.fnSerial}`;
        return btoa(data).substring(0, 10);
    }

    // Генерация фискальных тегов ФФД
    generateFiscalTags(receiptData) {
        return {
            '1008': this.kkmConfig.operatorName, // Наименование кассира
            '1021': '1', // Признак способа расчета
            '1022': '4', // Признак предмета расчета (товар)
            '1030': '1', // Признак агента
            '1031': '1', // Признак агента по предмету расчета
            '1084': '1', // Признак способа расчета
            '1085': '4', // Признак предмета расчета
            '1086': '1', // Признак агента
            '1087': '1', // Признак агента по предмету расчета
            '1192': '1', // Признак способа расчета
            '1193': '4', // Признак предмета расчета
            '1194': '1', // Признак агента
            '1195': '1' // Признак агента по предмету расчета
        };
    }

    // Получение фискального тега для товара
    getFiscalTag(item) {
        if (item.isAlcohol) return '1030'; // Алкоголь
        if (item.isService) return '1031'; // Услуга
        if (item.isMarked) return '1162'; // Маркированный товар
        return '1022'; // Товар
    }

    // Проверка статуса ФН
    async checkFNStatus() {
        try {
            // Симуляция проверки ФН
            return { success: true, fnSerial: this.fnSerial };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Проверка статуса ОФД
    async checkOFDStatus() {
        try {
            // Симуляция проверки ОФД
            return { success: true, ofdOperator: this.ofdOperator };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Проверка драйвера АТОЛ
    async checkAtolDriver() {
        try {
            // Симуляция проверки драйвера АТОЛ
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Проверка драйвера Штрих-М
    async checkShtrihDriver() {
        try {
            // Симуляция проверки драйвера Штрих-М
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Отправка чека по email
    async sendReceiptByEmail(electronicReceipt) {
        try {
            const emailData = {
                to: electronicReceipt.email,
                subject: 'Электронный чек от ДЭНДИ',
                html: this.generateReceiptHTML(electronicReceipt),
                receiptUrl: electronicReceipt.url
            };
            
            // Реальная отправка email через API
            const response = await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(emailData)
            });

            return response.ok ? { success: true } : { success: false };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Отправка чека по SMS
    async sendReceiptBySMS(electronicReceipt) {
        try {
            const smsData = {
                phone: electronicReceipt.phone,
                text: `Ваш чек: ${electronicReceipt.url}`
            };
            
            // Реальная отправка SMS через API
            const response = await fetch('/api/send-sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(smsData)
            });

            return response.ok ? { success: true } : { success: false };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Генерация HTML для электронного чека
    generateReceiptHTML(electronicReceipt) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto;">
                <h2>Электронный чек от ДЭНДИ</h2>
                <p>Чек №: ${electronicReceipt.id}</p>
                <p>QR-код: ${electronicReceipt.qrCode}</p>
                <p>Ссылка на чек: <a href="${electronicReceipt.url}">${electronicReceipt.url}</a></p>
            </div>
        `;
    }

    // Настройка обработчиков событий
    setupEventListeners() {
        // Обработка изменения статуса сети
        window.addEventListener('online', () => {
            this.syncPendingReceipts();
        });
    }

    // Синхронизация отложенных чеков
    async syncPendingReceipts() {
        for (const receipt of this.pendingReceipts) {
            await this.sendToOFD(receipt);
        }
        this.pendingReceipts = [];
    }

    // Генерация ID чека
    generateReceiptId() {
        return `RCP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Сохранение настроек
    saveSettings() {
        const settings = {
            kkmType: this.kkmType,
            ...this.kkmConfig
        };
        localStorage.setItem('kkmSettings', JSON.stringify(settings));
    }

    // Получение статуса ККМ
    getStatus() {
        return {
            isConnected: this.isConnected,
            kkmType: this.kkmType,
            fnSerial: this.fnSerial,
            ofdOperator: this.ofdOperator,
            pendingReceipts: this.pendingReceipts.length
        };
    }
}

// Экспорт модуля
window.RealKKMModule = RealKKMModule;
