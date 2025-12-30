/**
 * DANDY Inventory — Модуль ЕГАИС
 * Учёт алкогольной продукции, интеграция с УТМ
 */

class EGAISModule {
    constructor(inventorySystem) {
        this.system = inventorySystem;
        this.operations = this.loadOperations();
        this.utmStatus = 'connected'; // connected, disconnected, error
    }

    /**
     * Инициализация модуля
     */
    init() {
        console.log('🍷 EGAIS module initialized');
        this.renderOperations();
        this.renderAlcoholStock();
        this.updateUTMStatus();
    }

    /**
     * Загрузка операций
     */
    loadOperations() {
        const saved = this.system.loadFromLocalStorage('egaisOperations');
        return saved || [
            {
                id: 1,
                dateTime: '2024-01-15T14:30:00',
                operationType: 'sale',
                documentNumber: 'ACT-00456',
                status: 'confirmed',
                error: null
            },
            {
                id: 2,
                dateTime: '2024-01-15T12:15:00',
                operationType: 'arrival',
                documentNumber: 'TTN-00123',
                status: 'posted',
                error: null
            },
            {
                id: 3,
                dateTime: '2024-01-15T10:45:00',
                operationType: 'writeoff',
                documentNumber: 'ACT-00455',
                status: 'pending',
                error: null
            }
        ];
    }

    /**
     * Обновление статуса УТМ
     */
    updateUTMStatus() {
        const statusElement = document.getElementById('utmStatus');
        if (!statusElement) return;

        const statusBadge = this.utmStatus === 'connected' 
            ? '<span class="badge badge-success">Подключен</span>'
            : '<span class="badge badge-danger">Отключен</span>';

        statusElement.innerHTML = statusBadge;
    }

    /**
     * Отрисовка остатков алкоголя
     */
    renderAlcoholStock() {
        const container = document.getElementById('alcoholStockContainer');
        if (!container) return;

        // Фильтруем только алкоголь
        const alcoholProducts = this.system.products.filter(p => p.isAlcohol);
        
        // Группируем по типу
        const spirits = alcoholProducts.filter(p => p.alcoholStrength > 15); // крепкий
        const beer = alcoholProducts.filter(p => p.alcoholStrength <= 15); // пиво

        const spiritsVolume = spirits.reduce((sum, p) => sum + (p.currentStock || 0), 0);
        const beerBottles = beer.reduce((sum, p) => sum + (p.currentStock || 0), 0);

        container.innerHTML = `
            <table class="table">
                <tr>
                    <td><strong>Крепкий алкоголь</strong></td>
                    <td style="text-align: right;">${spiritsVolume.toFixed(1)} л</td>
                </tr>
                <tr>
                    <td><strong>Пиво (бутылки)</strong></td>
                    <td style="text-align: right;">${beerBottles} шт</td>
                </tr>
                <tr>
                    <td><strong>Пиво (кеги)</strong></td>
                    <td style="text-align: right;">3 шт (110 л)</td>
                </tr>
            </table>
        `;
    }

    /**
     * Отрисовка журнала операций
     */
    renderOperations() {
        const tbody = document.querySelector('#egaisOperationsBody');
        if (!tbody) return;

        if (this.operations.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 2rem; color: #999;">
                        Операций пока нет
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.operations.map(op => {
            const statusBadge = this.getStatusBadge(op.status);
            const operationLabel = this.getOperationLabel(op.operationType);

            return `
                <tr>
                    <td>${new Date(op.dateTime).toLocaleString('ru-RU')}</td>
                    <td>${operationLabel}</td>
                    <td><code>${op.documentNumber}</code></td>
                    <td>${statusBadge}</td>
                    <td>${op.error || '—'}</td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Получение бейджа статуса
     */
    getStatusBadge(status) {
        const badges = {
            'pending': '<span class="badge badge-warning">Ожидает отправки</span>',
            'sent': '<span class="badge badge-info">Отправлен</span>',
            'confirmed': '<span class="badge badge-success">Подтверждён</span>',
            'posted': '<span class="badge badge-success">Проведён</span>',
            'rejected': '<span class="badge badge-danger">Отклонён</span>',
            'error': '<span class="badge badge-danger">Ошибка</span>'
        };
        return badges[status] || status;
    }

    /**
     * Получение названия операции
     */
    getOperationLabel(operationType) {
        const labels = {
            'arrival': 'Приход ТТН',
            'sale': 'Акт списания (реализация)',
            'writeoff': 'Акт порчи',
            'return': 'Возврат поставщику',
            'transfer': 'Перемещение'
        };
        return labels[operationType] || operationType;
    }

    /**
     * Приём ТТН
     */
    acceptTTN() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: #094a45; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 2rem; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <h2 style="margin: 0 0 1.5rem 0; color: #eebc5c;">📥 Приём ТТН ЕГАИС</h2>

                <div class="alert alert-info">
                    <span>ℹ️</span>
                    <div>
                        <strong>Внимание!</strong><br>
                        Приём алкогольной продукции осуществляется только по ТТН из ЕГАИС.
                        Убедитесь, что УТМ подключён и работает.
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Номер ТТН ЕГАИС*</label>
                    <input type="text" class="form-input" id="ttnNumber" placeholder="000000000000">
                </div>

                <div class="form-group">
                    <label class="form-label">Дата ТТН*</label>
                    <input type="date" class="form-input" id="ttnDate" value="${new Date().toISOString().split('T')[0]}">
                </div>

                <div class="form-group">
                    <label class="form-label">Поставщик</label>
                    <input type="text" class="form-input" id="ttnSupplier" placeholder="ООО Алко-Поставщик">
                </div>

                <div class="form-group">
                    <label class="form-label">Комментарий</label>
                    <textarea class="form-input" id="ttnComment" rows="3" placeholder="Дополнительная информация..."></textarea>
                </div>

                <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); color: #F3EADB; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; border-left: 4px solid #f59e0b;">
                    <strong>⚠️ Важно:</strong><br>
                    После приёма ТТН система автоматически:
                    <ul style="margin: 0.5rem 0 0 1.5rem;">
                        <li>Запросит данные из УТМ</li>
                        <li>Сверит факт с документом</li>
                        <li>Поставит на баланс с партиями/кегами</li>
                        <li>Отправит подтверждение в ЕГАИС</li>
                    </ul>
                </div>

                <div style="display: flex; gap: 1rem;">
                    <button onclick="egaisModule.saveTTN()" class="btn btn-primary">
                        ✅ Принять ТТН
                    </button>
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">
                        Отмена
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * Сохранение ТТН
     */
    saveTTN() {
        const ttnNumber = document.getElementById('ttnNumber').value.trim();
        const ttnDate = document.getElementById('ttnDate').value;
        const supplier = document.getElementById('ttnSupplier').value.trim();
        const comment = document.getElementById('ttnComment').value.trim();

        if (!ttnNumber || !ttnDate) {
            alert('⚠️ Заполните обязательные поля');
            return;
        }

        // Создаём операцию
        const operation = {
            id: Date.now(),
            dateTime: new Date().toISOString(),
            operationType: 'arrival',
            documentNumber: ttnNumber,
            status: 'pending',
            supplier,
            comment,
            error: null
        };

        this.operations.unshift(operation);
        this.system.saveToLocalStorage('egaisOperations', this.operations);

        // Имитация отправки в УТМ
        setTimeout(() => {
            operation.status = 'sent';
            this.renderOperations();
            console.log('📤 ТТН отправлен в УТМ');

            setTimeout(() => {
                operation.status = 'confirmed';
                this.renderOperations();
                console.log('✅ ТТН подтверждён ЕГАИС');
                this.showNotification(`✅ ТТН ${ttnNumber} успешно принят!`, 'success');
            }, 2000);
        }, 1000);

        // Закрываем модалку
        document.querySelector('.modal-overlay').remove();

        // Обновляем список
        this.renderOperations();

        this.showNotification('📤 ТТН отправлен в УТМ...', 'info');
    }

    /**
     * Создание акта списания
     */
    createWriteoffAct() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        const alcoholProducts = this.system.products.filter(p => p.isAlcohol);

        modal.innerHTML = `
            <div style="background: #094a45; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 2rem; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <h2 style="margin: 0 0 1.5rem 0; color: #eebc5c;">📋 Акт списания ЕГАИС</h2>

                <div class="form-group">
                    <label class="form-label">Тип операции*</label>
                    <select class="form-select" id="writeoffType">
                        <option value="sale">Реализация (продажа)</option>
                        <option value="writeoff">Порча/Брак</option>
                        <option value="loss">Утеря</option>
                        <option value="spill">Пролив (техпотери)</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Дата*</label>
                    <input type="date" class="form-input" id="writeoffDate" value="${new Date().toISOString().split('T')[0]}">
                </div>

                <div class="form-group">
                    <label class="form-label">Товар*</label>
                    <select class="form-select" id="writeoffProduct">
                        <option value="">Выберите...</option>
                        ${alcoholProducts.map(p => `
                            <option value="${p.id}">${p.name} (${p.alcoholStrength}%)</option>
                        `).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Количество (л)*</label>
                    <input type="number" class="form-input" id="writeoffQuantity" value="0" step="0.001">
                </div>

                <div class="form-group">
                    <label class="form-label">Причина</label>
                    <textarea class="form-input" id="writeoffReason" rows="3" placeholder="Укажите причину списания..."></textarea>
                </div>

                <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                    <button onclick="egaisModule.saveWriteoffAct()" class="btn btn-primary">
                        📤 Отправить в ЕГАИС
                    </button>
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">
                        Отмена
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * Сохранение акта списания
     */
    saveWriteoffAct() {
        const writeoffType = document.getElementById('writeoffType').value;
        const writeoffDate = document.getElementById('writeoffDate').value;
        const productId = parseInt(document.getElementById('writeoffProduct').value);
        const quantity = parseFloat(document.getElementById('writeoffQuantity').value);
        const reason = document.getElementById('writeoffReason').value.trim();

        if (!writeoffDate || !productId || quantity <= 0) {
            alert('⚠️ Заполните все обязательные поля');
            return;
        }

        const product = this.system.products.find(p => p.id === productId);
        if (!product) return;

        // Создаём операцию
        const operation = {
            id: Date.now(),
            dateTime: new Date().toISOString(),
            operationType: writeoffType,
            documentNumber: `ACT-${Date.now()}`,
            status: 'pending',
            productId,
            productName: product.name,
            quantity,
            reason,
            error: null
        };

        this.operations.unshift(operation);
        this.system.saveToLocalStorage('egaisOperations', this.operations);

        // Имитация отправки в УТМ
        setTimeout(() => {
            operation.status = 'sent';
            this.renderOperations();
            console.log('📤 Акт отправлен в УТМ');

            setTimeout(() => {
                operation.status = 'confirmed';
                this.renderOperations();
                console.log('✅ Акт подтверждён ЕГАИС');
                this.showNotification(`✅ Акт ${operation.documentNumber} подтверждён!`, 'success');
            }, 2000);
        }, 1000);

        // Закрываем модалку
        document.querySelector('.modal-overlay').remove();

        // Обновляем список
        this.renderOperations();

        this.showNotification('📤 Акт отправлен в УТМ...', 'info');
    }

    /**
     * Возврат поставщику
     */
    createReturnAct() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        const alcoholProducts = this.system.products.filter(p => p.isAlcohol);

        modal.innerHTML = `
            <div style="background: #094a45; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 2rem; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <h2 style="margin: 0 0 1.5rem 0; color: #eebc5c;">↩️ Возврат поставщику</h2>

                <div class="alert alert-warning">
                    <span>⚠️</span>
                    <div>
                        <strong>Внимание!</strong><br>
                        Возврат алкогольной продукции возможен только с оформлением через ЕГАИС.
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Основание возврата*</label>
                    <select class="form-select" id="returnReason">
                        <option value="defect">Брак/Несоответствие</option>
                        <option value="expired">Просрочен срок годности</option>
                        <option value="damaged">Повреждённая упаковка</option>
                        <option value="other">Другое</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Поставщик*</label>
                    <input type="text" class="form-input" id="returnSupplier" placeholder="ООО Алко-Поставщик">
                </div>

                <div class="form-group">
                    <label class="form-label">Товар*</label>
                    <select class="form-select" id="returnProduct">
                        <option value="">Выберите...</option>
                        ${alcoholProducts.map(p => `
                            <option value="${p.id}">${p.name}</option>
                        `).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Количество*</label>
                    <input type="number" class="form-input" id="returnQuantity" value="0" step="1">
                </div>

                <div class="form-group">
                    <label class="form-label">Комментарий</label>
                    <textarea class="form-input" id="returnComment" rows="3"></textarea>
                </div>

                <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                    <button onclick="egaisModule.saveReturnAct()" class="btn btn-primary">
                        📤 Создать возврат
                    </button>
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">
                        Отмена
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * Сохранение возврата
     */
    saveReturnAct() {
        const reason = document.getElementById('returnReason').value;
        const supplier = document.getElementById('returnSupplier').value.trim();
        const productId = parseInt(document.getElementById('returnProduct').value);
        const quantity = parseFloat(document.getElementById('returnQuantity').value);
        const comment = document.getElementById('returnComment').value.trim();

        if (!supplier || !productId || quantity <= 0) {
            alert('⚠️ Заполните все обязательные поля');
            return;
        }

        const product = this.system.products.find(p => p.id === productId);
        if (!product) return;

        // Создаём операцию
        const operation = {
            id: Date.now(),
            dateTime: new Date().toISOString(),
            operationType: 'return',
            documentNumber: `RTN-${Date.now()}`,
            status: 'pending',
            productId,
            productName: product.name,
            quantity,
            supplier,
            reason,
            comment,
            error: null
        };

        this.operations.unshift(operation);
        this.system.saveToLocalStorage('egaisOperations', this.operations);

        // Закрываем модалку
        document.querySelector('.modal-overlay').remove();

        // Обновляем список
        this.renderOperations();

        this.showNotification('📤 Возврат создан и отправлен в УТМ', 'success');
    }

    /**
     * Сверка остатков с ЕГАИС
     */
    syncWithEGAIS() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: #094a45; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 2rem; max-width: 700px; width: 90%;">
                <h2 style="margin: 0 0 1.5rem 0; color: #eebc5c;">🔄 Сверка остатков с ЕГАИС</h2>

                <div style="text-align: center; padding: 2rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">⏳</div>
                    <p style="font-size: 1.1em; color: #666;">
                        Запрос остатков из ЕГАИС...<br>
                        Это может занять несколько секунд.
                    </p>
                </div>

                <div style="display: flex; justify-content: center; gap: 1rem;">
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">
                        Отмена
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Имитация запроса
        setTimeout(() => {
            modal.remove();
            this.showSyncResults();
        }, 2000);
    }

    /**
     * Показать результаты сверки
     */
    showSyncResults() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: #094a45; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 2rem; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <h2 style="margin: 0 0 1.5rem 0; color: #eebc5c;">✅ Результаты сверки</h2>

                <div class="alert alert-info">
                    <span>ℹ️</span>
                    <div>
                        Сверка выполнена: ${new Date().toLocaleString('ru-RU')}<br>
                        Расхождений: <strong>0</strong>
                    </div>
                </div>

                <table class="table">
                    <thead>
                        <tr>
                            <th>Товар</th>
                            <th>По учёту</th>
                            <th>В ЕГАИС</th>
                            <th>Расхождение</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Водка "Русский Стандарт" 0.5л</td>
                            <td>12 шт</td>
                            <td>12 шт</td>
                            <td><span class="badge badge-success">✓ Совпадает</span></td>
                        </tr>
                        <tr>
                            <td>Пиво светлое (кега 50л)</td>
                            <td>28.5 л</td>
                            <td>28.5 л</td>
                            <td><span class="badge badge-success">✓ Совпадает</span></td>
                        </tr>
                    </tbody>
                </table>

                <div style="display: flex; justify-content: center; margin-top: 1.5rem;">
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-primary">
                        Закрыть
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * Показ уведомления
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10001;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            animation: slideIn 0.3s ease-out;
            ${type === 'success' ? 'background: #16a34a;' : ''}
            ${type === 'error' ? 'background: #dc2626;' : ''}
            ${type === 'info' ? 'background: #2563eb;' : ''}
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EGAISModule;
}

