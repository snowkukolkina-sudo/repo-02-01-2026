/**
 * Модуль фискализации для соответствия 54-ФЗ и ФФД
 * Поддержка фискального накопителя, ОФД, электронных чеков
 */

class FiscalModule {
    constructor() {
        this.fnSerial = null;
        this.ofdUrl = null;
        this.isOnline = true;
        this.pendingReceipts = [];
        this.init();
    }

    init() {
        this.loadFiscalSettings();
        this.setupEventListeners();
    }

    // Настройки фискализации
    loadFiscalSettings() {
        const settings = JSON.parse(localStorage.getItem('fiscalSettings') || '{}');
        this.fnSerial = settings.fnSerial || '9999999999999999';
        this.ofdUrl = settings.ofdUrl || 'https://ofd.ru';
        this.taxSystem = settings.taxSystem || 1; // ОСН
        this.operatorName = settings.operatorName || 'Кассир';
    }

    // Создание фискального чека
    async createFiscalReceipt(receiptData) {
        const fiscalReceipt = {
            id: this.generateReceiptId(),
            timestamp: new Date().toISOString(),
            fnSerial: this.fnSerial,
            receiptType: receiptData.type || 'sale', // sale, refund, correction
            total: receiptData.total,
            items: receiptData.items.map(item => ({
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                sum: item.sum,
                vat: item.vat || 20,
                paymentMethod: item.paymentMethod || 'card',
                fiscalTag: this.getFiscalTag(item)
            })),
            payments: receiptData.payments || [],
            fiscalTags: this.generateFiscalTags(receiptData)
        };

        // Отправка в фискальный накопитель
        const fnResult = await this.sendToFN(fiscalReceipt);
        
        if (fnResult.success) {
            // Отправка в ОФД
            await this.sendToOFD(fiscalReceipt);
            
            // Создание электронного чека
            await this.createElectronicReceipt(fiscalReceipt);
            
            return { success: true, receiptId: fiscalReceipt.id };
        }
        
        return { success: false, error: fnResult.error };
    }

    // Генерация фискальных тегов ФФД
    generateFiscalTags(receiptData) {
        return {
            '1008': this.operatorName, // Наименование кассира
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

    // Отправка в фискальный накопитель
    async sendToFN(fiscalReceipt) {
        try {
            // Симуляция отправки в ФН
            const fnData = {
                receipt: fiscalReceipt,
                command: 'CREATE_RECEIPT',
                timestamp: Date.now()
            };

            // В реальной системе здесь будет взаимодействие с ФН через протокол ФФД
            console.log('Отправка в ФН:', fnData);
            
            // Симуляция успешного ответа
            return {
                success: true,
                fnDocumentId: `FN_${fiscalReceipt.id}`,
                fiscalSign: this.generateFiscalSign(fiscalReceipt)
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
                ofdUrl: this.ofdUrl,
                timestamp: Date.now()
            };

            // Симуляция отправки в ОФД
            console.log('Отправка в ОФД:', ofdData);
            
            return { success: true };
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
            email: fiscalReceipt.customerEmail,
            phone: fiscalReceipt.customerPhone
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
        // Упрощенная генерация фискального признака
        const data = `${fiscalReceipt.id}${fiscalReceipt.total}${this.fnSerial}`;
        return btoa(data).substring(0, 10);
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
            
            console.log('Отправка чека по email:', emailData);
            return { success: true };
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
            
            console.log('Отправка чека по SMS:', smsData);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Генерация HTML для электронного чека
    generateReceiptHTML(electronicReceipt) {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto;">
                <h2>Электронный чек</h2>
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
            this.isOnline = true;
            this.syncPendingReceipts();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
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

    // Получение фискального тега для товара
    getFiscalTag(item) {
        if (item.isAlcohol) return '1030'; // Алкоголь
        if (item.isService) return '1031'; // Услуга
        return '1022'; // Товар
    }
}

// Экспорт модуля
window.FiscalModule = FiscalModule;
