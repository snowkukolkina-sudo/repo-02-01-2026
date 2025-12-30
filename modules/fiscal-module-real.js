/**
 * РЕАЛЬНАЯ ФИСКАЛИЗАЦИЯ - МОДУЛЬ ККТ И ОФД
 * Интеграция с реальными онлайн-кассами и ОФД провайдерами
 */

class RealFiscalModule {
    constructor() {
        this.config = {
            // ОФД Провайдер (Такском, Первый ОФД, Контур.ОФД)
            ofdProvider: 'taxcom', // 'taxcom' | 'first-ofd' | 'kontur'
            
            // Настройки кассы
            kkt: {
                serialNumber: '', // Заводской номер ККТ
                regNumber: '', // Регистрационный номер ККТ
                fiscalDriveNumber: '', // Номер фискального накопителя
                inn: '', // ИНН организации
                taxSystem: 1, // Система налогообложения (1-ОСН, 2-УСН доход, 3-УСН доход-расход, 4-ЕНВД, 5-ЕСХН, 6-Патент)
            },
            
            // API ключи (НУЖНО ЗАМЕНИТЬ НА РЕАЛЬНЫЕ!)
            apiKeys: {
                taxcom: {
                    login: 'YOUR_TAXCOM_LOGIN',
                    password: 'YOUR_TAXCOM_PASSWORD',
                    groupCode: 'YOUR_GROUP_CODE',
                    apiUrl: 'https://api.taxcom.ru/v2'
                },
                firstOFD: {
                    token: 'YOUR_FIRST_OFD_TOKEN',
                    deviceId: 'YOUR_DEVICE_ID',
                    apiUrl: 'https://api.1-ofd.ru/v1'
                },
                kontur: {
                    login: 'YOUR_KONTUR_LOGIN',
                    password: 'YOUR_KONTUR_PASSWORD',
                    kktId: 'YOUR_KKT_ID',
                    apiUrl: 'https://kkt.kontur.ru/api/v1'
                }
            },
            
            // Настройки печати
            printer: {
                type: 'usb', // 'usb' | 'network' | 'bluetooth'
                port: 'COM3', // Для USB
                ip: '', // Для network
                model: 'АТОЛ' // АТОЛ, Штрих-М, Меркурий, Viki Print
            }
        };
        
        this.isConnected = false;
        this.currentShift = null;
        this.lastReceipt = null;
        
        this.init();
    }

    init() {
        console.log('🧾 Инициализация модуля фискализации...');
        this.loadConfig();
        this.checkConnection();
    }

    // ===== НАСТРОЙКА =====
    
    loadConfig() {
        const savedConfig = localStorage.getItem('fiscal_config');
        if (savedConfig) {
            this.config = { ...this.config, ...JSON.parse(savedConfig) };
        }
    }

    saveConfig() {
        localStorage.setItem('fiscal_config', JSON.stringify(this.config));
    }

    async checkConnection() {
        try {
            const result = await this.getKKTStatus();
            this.isConnected = result.online;
            console.log(`📡 Статус ККТ: ${this.isConnected ? 'Онлайн' : 'Офлайн'}`);
            return this.isConnected;
        } catch (error) {
            console.error('❌ Ошибка проверки связи с ККТ:', error);
            this.isConnected = false;
            return false;
        }
    }

    // ===== РАБОТА СО СМЕНАМИ =====
    
    async openShift(cashier) {
        try {
            console.log('📂 Открытие смены...');
            
            const request = {
                Type: 'openShift',
                Operator: {
                    Name: cashier.name,
                    Vatin: cashier.inn || this.config.kkt.inn
                }
            };

            const result = await this.sendToKKT(request);
            
            if (result.success) {
                this.currentShift = {
                    number: result.shiftNumber,
                    openedAt: new Date().toISOString(),
                    cashier: cashier.name,
                    receipts: 0,
                    totalCash: 0,
                    totalCard: 0
                };
                
                localStorage.setItem('current_shift', JSON.stringify(this.currentShift));
                console.log('✅ Смена открыта:', this.currentShift.number);
                return { success: true, shiftNumber: this.currentShift.number };
            }
            
            throw new Error(result.error || 'Не удалось открыть смену');
        } catch (error) {
            console.error('❌ Ошибка открытия смены:', error);
            return { success: false, error: error.message };
        }
    }

    async closeShift() {
        try {
            console.log('📕 Закрытие смены...');
            
            const request = {
                Type: 'closeShift',
                Operator: {
                    Name: this.currentShift.cashier
                }
            };

            const result = await this.sendToKKT(request);
            
            if (result.success) {
                const report = {
                    ...this.currentShift,
                    closedAt: new Date().toISOString(),
                    fiscalDocument: result.fiscalDocument
                };
                
                // Сохранить отчёт
                this.saveShiftReport(report);
                
                this.currentShift = null;
                localStorage.removeItem('current_shift');
                
                console.log('✅ Смена закрыта');
                return { success: true, report };
            }
            
            throw new Error(result.error || 'Не удалось закрыть смену');
        } catch (error) {
            console.error('❌ Ошибка закрытия смены:', error);
            return { success: false, error: error.message };
        }
    }

    // ===== ПЕЧАТЬ ЧЕКОВ =====
    
    async printReceipt(order, paymentType) {
        try {
            console.log('🧾 Печать чека для заказа:', order.id);
            
            if (!this.currentShift) {
                throw new Error('Смена не открыта! Откройте смену перед печатью чека.');
            }

            // Формируем данные чека
            const receipt = {
                Type: 'sell', // Приход
                TaxationType: this.config.kkt.taxSystem,
                Operator: {
                    Name: this.currentShift.cashier,
                    Vatin: this.config.kkt.inn
                },
                Items: order.items.map(item => ({
                    Name: item.name,
                    Price: item.price,
                    Quantity: item.quantity || 1,
                    Amount: item.total || (item.price * (item.quantity || 1)),
                    Tax: this.getTaxType(item.vat || 20),
                    PaymentMethod: 4, // Полная предоплата
                    PaymentObject: 1 // Товар
                })),
                Payments: [
                    {
                        Type: paymentType === 'cash' ? 0 : 1, // 0-наличные, 1-электронно
                        Amount: order.total
                    }
                ],
                Total: order.total
            };

            // Добавляем email/телефон для отправки чека
            if (order.customerEmail) {
                receipt.CustomerReceipt = {
                    Email: order.customerEmail
                };
            } else if (order.customerPhone) {
                receipt.CustomerReceipt = {
                    Phone: order.customerPhone
                };
            }

            // Отправляем на ККТ
            const result = await this.sendToKKT(receipt);
            
            if (result.success) {
                this.lastReceipt = {
                    orderId: order.id,
                    fiscalDocument: result.fiscalDocument,
                    fiscalSign: result.fiscalSign,
                    fiscalDateTime: result.fiscalDateTime,
                    shiftNumber: this.currentShift.number,
                    receiptNumber: result.receiptNumber,
                    qrCode: result.qrCode // QR-код для проверки чека
                };

                // Обновляем статистику смены
                this.currentShift.receipts++;
                if (paymentType === 'cash') {
                    this.currentShift.totalCash += order.total;
                } else {
                    this.currentShift.totalCard += order.total;
                }
                localStorage.setItem('current_shift', JSON.stringify(this.currentShift));

                // Сохраняем чек
                this.saveFiscalReceipt(this.lastReceipt);

                console.log('✅ Чек пробит успешно:', result.receiptNumber);
                return { success: true, receipt: this.lastReceipt };
            }
            
            throw new Error(result.error || 'Не удалось пробить чек');
        } catch (error) {
            console.error('❌ Ошибка печати чека:', error);
            return { success: false, error: error.message };
        }
    }

    async printRefund(order, amount) {
        try {
            console.log('💸 Печать чека возврата:', order.id);
            
            const receipt = {
                Type: 'sellReturn', // Возврат прихода
                TaxationType: this.config.kkt.taxSystem,
                Operator: {
                    Name: this.currentShift.cashier
                },
                Items: order.items.map(item => ({
                    Name: item.name,
                    Price: item.price,
                    Quantity: item.quantity || 1,
                    Amount: item.total,
                    Tax: this.getTaxType(item.vat || 20),
                    PaymentMethod: 4,
                    PaymentObject: 1
                })),
                Payments: [
                    {
                        Type: order.paymentMethod === 'cash' ? 0 : 1,
                        Amount: amount
                    }
                ],
                Total: amount
            };

            const result = await this.sendToKKT(receipt);
            
            if (result.success) {
                console.log('✅ Чек возврата пробит');
                return { success: true, receipt: result };
            }
            
            throw new Error(result.error);
        } catch (error) {
            console.error('❌ Ошибка печати чека возврата:', error);
            return { success: false, error: error.message };
        }
    }

    // ===== ОТПРАВКА НА ККТ =====
    
    async sendToKKT(data) {
        const provider = this.config.ofdProvider;
        const apiConfig = this.config.apiKeys[provider];

        try {
            // В зависимости от провайдера формируем разные запросы
            let response;
            
            switch (provider) {
                case 'taxcom':
                    response = await this.sendToTaxcom(data, apiConfig);
                    break;
                case 'firstOFD':
                    response = await this.sendToFirstOFD(data, apiConfig);
                    break;
                case 'kontur':
                    response = await this.sendToKontur(data, apiConfig);
                    break;
                default:
                    throw new Error(`Неизвестный провайдер: ${provider}`);
            }

            return response;
        } catch (error) {
            console.error('❌ Ошибка отправки на ККТ:', error);
            throw error;
        }
    }

    async sendToTaxcom(data, config) {
        // Такском API
        const response = await fetch(`${config.apiUrl}/requests`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${btoa(`${config.login}:${config.password}`)}`
            },
            body: JSON.stringify({
                groupCode: config.groupCode,
                ...data
            })
        });

        if (!response.ok) {
            throw new Error(`Такском API ошибка: ${response.status}`);
        }

        return await response.json();
    }

    async sendToFirstOFD(data, config) {
        // Первый ОФД API
        const response = await fetch(`${config.apiUrl}/devices/${config.deviceId}/documents`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.token}`
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`Первый ОФД API ошибка: ${response.status}`);
        }

        return await response.json();
    }

    async sendToKontur(data, config) {
        // Контур API
        const response = await fetch(`${config.apiUrl}/kkt/${config.kktId}/receipt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${btoa(`${config.login}:${config.password}`)}`
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`Контур API ошибка: ${response.status}`);
        }

        return await response.json();
    }

    // ===== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ =====
    
    getTaxType(vat) {
        // Тип НДС
        const taxTypes = {
            0: 6,    // Без НДС
            10: 2,   // НДС 10%
            20: 1    // НДС 20%
        };
        return taxTypes[vat] || 6;
    }

    async getKKTStatus() {
        try {
            // Получить статус ККТ
            const provider = this.config.ofdProvider;
            const apiConfig = this.config.apiKeys[provider];
            
            // Здесь запрос к API провайдера для получения статуса
            // Для примера возвращаем mock
            return {
                online: true,
                fiscalDriveOk: true,
                paperOk: true,
                shiftOpen: !!this.currentShift
            };
        } catch (error) {
            return {
                online: false,
                error: error.message
            };
        }
    }

    saveFiscalReceipt(receipt) {
        const receipts = JSON.parse(localStorage.getItem('fiscal_receipts') || '[]');
        receipts.push(receipt);
        localStorage.setItem('fiscal_receipts', JSON.stringify(receipts));
    }

    saveShiftReport(report) {
        const reports = JSON.parse(localStorage.getItem('shift_reports') || '[]');
        reports.push(report);
        localStorage.setItem('shift_reports', JSON.stringify(reports));
    }

    // ===== X/Z ОТЧЁТЫ =====
    
    async printXReport() {
        try {
            console.log('📄 Печать X-отчёта...');
            
            const request = {
                Type: 'xReport'
            };

            const result = await this.sendToKKT(request);
            
            if (result.success) {
                console.log('✅ X-отчёт распечатан');
                return { success: true };
            }
            
            throw new Error(result.error);
        } catch (error) {
            console.error('❌ Ошибка печати X-отчёта:', error);
            return { success: false, error: error.message };
        }
    }

    async printZReport() {
        // Z-отчёт = закрытие смены
        return await this.closeShift();
    }

    // ===== НАСТРОЙКА =====
    
    showConfigModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <h2>⚙️ Настройка фискализации</h2>
                
                <div class="form-group">
                    <label>ОФД Провайдер:</label>
                    <select id="ofdProvider" class="form-input">
                        <option value="taxcom">Такском</option>
                        <option value="firstOFD">Первый ОФД</option>
                        <option value="kontur">Контур.ОФД</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Серийный номер ККТ:</label>
                    <input type="text" id="serialNumber" class="form-input" value="${this.config.kkt.serialNumber}">
                </div>
                
                <div class="form-group">
                    <label>РН ККТ:</label>
                    <input type="text" id="regNumber" class="form-input" value="${this.config.kkt.regNumber}">
                </div>
                
                <div class="form-group">
                    <label>ИНН:</label>
                    <input type="text" id="inn" class="form-input" value="${this.config.kkt.inn}">
                </div>
                
                <div class="button-group">
                    <button class="btn btn-primary" onclick="fiscalModule.saveModalConfig()">Сохранить</button>
                    <button class="btn" onclick="this.closest('.modal-overlay').remove()">Отмена</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    saveModalConfig() {
        this.config.kkt.serialNumber = document.getElementById('serialNumber').value;
        this.config.kkt.regNumber = document.getElementById('regNumber').value;
        this.config.kkt.inn = document.getElementById('inn').value;
        this.config.ofdProvider = document.getElementById('ofdProvider').value;
        
        this.saveConfig();
        document.querySelector('.modal-overlay').remove();
        
        alert('✅ Настройки сохранены!');
    }
}

// Экспорт модуля
window.RealFiscalModule = RealFiscalModule;
