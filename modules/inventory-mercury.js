/**
 * DANDY Inventory — Модуль ФГИС «Меркурий»
 * Ветеринарно-санитарный контроль, ВСД
 */

class MercuryModule {
    constructor(inventorySystem) {
        this.system = inventorySystem;
        this.vsdList = this.loadVSD();
        this.apiStatus = 'connected'; // connected, disconnected, error
    }

    /**
     * Инициализация модуля
     */
    init() {
        console.log('🐄 Mercury module initialized');
        this.renderVSDList();
        this.renderStatistics();
        this.updateAPIStatus();
    }

    /**
     * Загрузка ВСД
     */
    loadVSD() {
        const saved = this.system.loadFromLocalStorage('mercuryVSD');
        return saved || [
            {
                id: 1,
                uuid: '12345-ABC',
                vsdNumber: 'ВСД-12345',
                productId: 1,
                productName: 'Лосось филе',
                batchNumber: 'L-20240115',
                supplierGuid: 'supplier-123',
                volume: 15.0,
                unit: 'кг',
                productionDate: '2024-01-10',
                expiryDate: '2024-01-22',
                status: 'pending',
                arrivalDate: '2024-01-14',
                utilizedDate: null
            },
            {
                id: 2,
                uuid: '12344-XYZ',
                vsdNumber: 'ВСД-12344',
                productId: 3,
                productName: 'Говядина вырезка',
                batchNumber: 'B-20240112',
                supplierGuid: 'supplier-456',
                volume: 25.0,
                unit: 'кг',
                productionDate: '2024-01-08',
                expiryDate: '2024-01-20',
                status: 'utilized',
                arrivalDate: '2024-01-12',
                utilizedDate: '2024-01-13'
            }
        ];
    }

    /**
     * Обновление статуса API
     */
    updateAPIStatus() {
        const statusElement = document.getElementById('mercuryAPIStatus');
        if (!statusElement) return;

        const statusBadge = this.apiStatus === 'connected' 
            ? '<span class="badge badge-success">Подключен</span>'
            : '<span class="badge badge-danger">Отключен</span>';

        statusElement.innerHTML = statusBadge;
    }

    /**
     * Отрисовка статистики
     */
    renderStatistics() {
        const container = document.getElementById('mercuryStatisticsContainer');
        if (!container) return;

        const incoming = this.vsdList.length;
        const utilized = this.vsdList.filter(v => v.status === 'utilized').length;
        const pending = this.vsdList.filter(v => v.status === 'pending').length;

        container.innerHTML = `
            <table class="table">
                <tr>
                    <td><strong>Входящих ВСД</strong></td>
                    <td style="text-align: right;">${incoming}</td>
                </tr>
                <tr>
                    <td><strong>Погашено</strong></td>
                    <td style="text-align: right;">${utilized}</td>
                </tr>
                <tr>
                    <td><strong>Ожидают погашения</strong></td>
                    <td style="text-align: right; color: ${pending > 0 ? '#f59e0b' : 'inherit'};">${pending}</td>
                </tr>
            </table>
        `;
    }

    /**
     * Отрисовка списка ВСД
     */
    renderVSDList() {
        const tbody = document.querySelector('#mercuryVSDBody');
        if (!tbody) return;

        if (this.vsdList.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2rem; color: #999;">
                        ВСД пока нет
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.vsdList.map(vsd => {
            const statusBadge = this.getStatusBadge(vsd.status);
            const isExpiringSoon = this.isExpiringSoon(vsd.expiryDate);

            return `
                <tr onclick="mercuryModule.showVSDDetails(${vsd.id})" style="cursor: pointer;">
                    <td>
                        <code>${vsd.vsdNumber}</code>
                        ${isExpiringSoon && vsd.status === 'pending' ? '<br><span class="badge badge-danger" style="margin-top: 0.25rem;">⚠️ Требует погашения!</span>' : ''}
                    </td>
                    <td>${new Date(vsd.arrivalDate).toLocaleDateString('ru-RU')}</td>
                    <td>
                        <strong>${vsd.productName}</strong><br>
                        <span style="font-size: 0.85em; color: #666;">Партия: ${vsd.batchNumber}</span>
                    </td>
                    <td>${vsd.volume} ${vsd.unit}</td>
                    <td>${statusBadge}</td>
                    <td>
                        ${vsd.status === 'pending' ? `
                            <button class="btn btn-primary btn-small" onclick="event.stopPropagation(); mercuryModule.utilizeVSD(${vsd.id})">
                                ✅ Погасить
                            </button>
                        ` : vsd.utilizedDate ? new Date(vsd.utilizedDate).toLocaleDateString('ru-RU') : '—'}
                    </td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Получение бейджа статуса
     */
    getStatusBadge(status) {
        const badges = {
            'pending': '<span class="badge badge-warning">Ожидает погашения</span>',
            'active': '<span class="badge badge-info">Активен</span>',
            'utilized': '<span class="badge badge-success">Погашен</span>',
            'cancelled': '<span class="badge badge-danger">Аннулирован</span>'
        };
        return badges[status] || status;
    }

    /**
     * Проверка срочности погашения
     */
    isExpiringSoon(expiryDate) {
        if (!expiryDate) return false;
        const expiry = new Date(expiryDate);
        const today = new Date();
        const diffDays = Math.floor((expiry - today) / (1000 * 60 * 60 * 24));
        return diffDays <= 1;
    }

    /**
     * Загрузка входящих ВСД
     */
    loadIncomingVSD() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: #094a45; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 2rem; max-width: 600px; width: 90%;">
                <h2 style="margin: 0 0 1.5rem 0; color: #eebc5c;">📥 Загрузка входящих ВСД</h2>

                <div style="text-align: center; padding: 2rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">⏳</div>
                    <p style="font-size: 1.1em; color: #666;">
                        Запрос входящих ВСД из ВЕТИС.API...<br>
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

        // Имитация загрузки
        setTimeout(() => {
            modal.remove();
            this.showIncomingVSDResults();
        }, 2000);
    }

    /**
     * Показать результаты загрузки
     */
    showIncomingVSDResults() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: #094a45; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 2rem; max-width: 700px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <h2 style="margin: 0 0 1.5rem 0; color: #eebc5c;">📋 Входящие ВСД</h2>

                <div class="alert alert-info">
                    <span>✅</span>
                    <div>
                        Загружено: <strong>2 новых ВСД</strong><br>
                        Время запроса: ${new Date().toLocaleString('ru-RU')}
                    </div>
                </div>

                <table class="table">
                    <thead>
                        <tr>
                            <th>Номер ВСД</th>
                            <th>Товар</th>
                            <th>Объём</th>
                            <th>Действие</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>ВСД-12346</td>
                            <td>Курица охлаждённая</td>
                            <td>20.0 кг</td>
                            <td>
                                <button class="btn btn-primary btn-small" onclick="mercuryModule.acceptNewVSD('ВСД-12346')">
                                    ✅ Принять
                                </button>
                            </td>
                        </tr>
                        <tr>
                            <td>ВСД-12347</td>
                            <td>Молоко 3.2%</td>
                            <td>50.0 л</td>
                            <td>
                                <button class="btn btn-primary btn-small" onclick="mercuryModule.acceptNewVSD('ВСД-12347')">
                                    ✅ Принять
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <div style="display: flex; justify-content: center; margin-top: 1.5rem;">
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">
                        Закрыть
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * Принять новый ВСД
     */
    acceptNewVSD(vsdNumber) {
        alert(`✅ ВСД ${vsdNumber} принят!\n\nТовар поставлен на учёт с привязкой к партии.`);
        document.querySelector('.modal-overlay').remove();
        this.showNotification(`✅ ВСД ${vsdNumber} успешно принят!`, 'success');
    }

    /**
     * Погашение ВСД
     */
    utilizeVSD(vsdId) {
        const vsd = this.vsdList.find(v => v.id === vsdId);
        if (!vsd) return;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: #094a45; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 2rem; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <h2 style="margin: 0 0 1.5rem 0; color: #eebc5c;">✅ Погашение ВСД</h2>

                <div style="background: #f9f9f9; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                    <div><strong>Номер ВСД:</strong> ${vsd.vsdNumber}</div>
                    <div><strong>Товар:</strong> ${vsd.productName}</div>
                    <div><strong>Партия:</strong> ${vsd.batchNumber}</div>
                    <div><strong>Объём:</strong> ${vsd.volume} ${vsd.unit}</div>
                </div>

                <div class="form-group">
                    <label class="form-label">Дата погашения*</label>
                    <input type="date" class="form-input" id="utilizeDate" value="${new Date().toISOString().split('T')[0]}">
                </div>

                <div class="form-group">
                    <label class="form-label">Тип операции*</label>
                    <select class="form-select" id="utilizeType">
                        <option value="utilized">Использовано в производстве</option>
                        <option value="sold">Реализовано</option>
                        <option value="processed">Переработано</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Комментарий</label>
                    <textarea class="form-input" id="utilizeComment" rows="3"></textarea>
                </div>

                <div class="alert alert-warning">
                    <span>⚠️</span>
                    <div>
                        <strong>Внимание!</strong><br>
                        Операция погашения будет отправлена в ФГИС «Меркурий» и не может быть отменена.
                    </div>
                </div>

                <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                    <button onclick="mercuryModule.saveUtilization(${vsd.id})" class="btn btn-primary">
                        ✅ Погасить ВСД
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
     * Сохранение погашения
     */
    saveUtilization(vsdId) {
        const vsd = this.vsdList.find(v => v.id === vsdId);
        if (!vsd) return;

        const utilizeDate = document.getElementById('utilizeDate').value;
        const utilizeType = document.getElementById('utilizeType').value;
        const comment = document.getElementById('utilizeComment').value.trim();

        if (!utilizeDate) {
            alert('⚠️ Укажите дату погашения');
            return;
        }

        // Обновляем ВСД
        vsd.status = 'utilized';
        vsd.utilizedDate = utilizeDate;
        vsd.utilizeType = utilizeType;
        vsd.utilizeComment = comment;

        this.system.saveToLocalStorage('mercuryVSD', this.vsdList);

        // Закрываем модалку
        document.querySelector('.modal-overlay').remove();

        // Обновляем список
        this.renderVSDList();
        this.renderStatistics();

        // Имитация отправки в Меркурий
        this.showNotification('📤 Отправка в ФГИС «Меркурий»...', 'info');

        setTimeout(() => {
            console.log('✅ Погашение подтверждено в Меркурий');
            this.showNotification(`✅ ВСД ${vsd.vsdNumber} погашен!`, 'success');
        }, 1500);
    }

    /**
     * Детали ВСД
     */
    showVSDDetails(vsdId) {
        const vsd = this.vsdList.find(v => v.id === vsdId);
        if (!vsd) return;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: #094a45; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 2rem; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h2 style="margin: 0; color: #eebc5c;">🐄 ВСД ${vsd.vsdNumber}</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" 
                            style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #999;">×</button>
                </div>

                <div style="background: #f9f9f9; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                    <div style="margin-bottom: 0.5rem;"><strong>UUID:</strong> <code>${vsd.uuid}</code></div>
                    <div><strong>Статус:</strong> ${this.getStatusBadge(vsd.status)}</div>
                </div>

                <h3 style="margin: 1.5rem 0 1rem 0; color: #eebc5c;">Информация о товаре</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div>
                        <strong>Товар:</strong><br>
                        ${vsd.productName}
                    </div>
                    <div>
                        <strong>Партия:</strong><br>
                        ${vsd.batchNumber}
                    </div>
                    <div>
                        <strong>Объём:</strong><br>
                        ${vsd.volume} ${vsd.unit}
                    </div>
                    <div>
                        <strong>Дата производства:</strong><br>
                        ${new Date(vsd.productionDate).toLocaleDateString('ru-RU')}
                    </div>
                    <div>
                        <strong>Срок годности:</strong><br>
                        ${new Date(vsd.expiryDate).toLocaleDateString('ru-RU')}
                    </div>
                    <div>
                        <strong>Дата поступления:</strong><br>
                        ${new Date(vsd.arrivalDate).toLocaleDateString('ru-RU')}
                    </div>
                </div>

                ${vsd.status === 'utilized' ? `
                    <h3 style="margin: 1.5rem 0 1rem 0; color: #eebc5c;">Погашение</h3>
                    <div style="background: #f0fdf4; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                        <div><strong>Дата погашения:</strong> ${new Date(vsd.utilizedDate).toLocaleDateString('ru-RU')}</div>
                        ${vsd.utilizeComment ? `<div><strong>Комментарий:</strong> ${vsd.utilizeComment}</div>` : ''}
                    </div>
                ` : ''}

                <div style="display: flex; gap: 1rem;">
                    ${vsd.status === 'pending' ? `
                        <button onclick="mercuryModule.utilizeVSD(${vsd.id}); this.closest('.modal-overlay').remove();" 
                                class="btn btn-primary">
                            ✅ Погасить
                        </button>
                    ` : ''}
                    <button onclick="mercuryModule.showTraceability(${vsd.id})" class="btn btn-secondary">
                        🔍 Прослеживаемость
                    </button>
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">
                        Закрыть
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * Показать цепочку прослеживаемости
     */
    showTraceability(vsdId) {
        const vsd = this.vsdList.find(v => v.id === vsdId);
        if (!vsd) return;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: #094a45; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 2rem; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <h2 style="margin: 0 0 1.5rem 0; color: #eebc5c;">🔍 Прослеживаемость: ${vsd.productName}</h2>

                <div style="position: relative; padding: 2rem 0;">
                    <div style="position: absolute; left: 20px; top: 0; bottom: 0; width: 2px; background: var(--dandy-green);"></div>
                    
                    <div style="position: relative; margin-bottom: 2rem; padding-left: 50px;">
                        <div style="position: absolute; left: 10px; width: 24px; height: 24px; border-radius: 50%; background: var(--dandy-green); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.8em;">1</div>
                        <div style="background: #f0fdf4; padding: 1rem; border-radius: 8px;">
                            <strong>📥 Поступление сырья</strong><br>
                            ВСД: ${vsd.vsdNumber}<br>
                            Дата: ${new Date(vsd.arrivalDate).toLocaleDateString('ru-RU')}<br>
                            Партия: ${vsd.batchNumber}
                        </div>
                    </div>

                    <div style="position: relative; margin-bottom: 2rem; padding-left: 50px;">
                        <div style="position: absolute; left: 10px; width: 24px; height: 24px; border-radius: 50%; background: var(--dandy-green); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.8em;">2</div>
                        <div style="background: #f0f9ff; padding: 1rem; border-radius: 8px;">
                            <strong>⚙️ Использовано в производстве</strong><br>
                            Блюдо: Филадельфия ролл<br>
                            ТК: TK-002<br>
                            Дата: ${vsd.utilizedDate ? new Date(vsd.utilizedDate).toLocaleDateString('ru-RU') : '—'}
                        </div>
                    </div>

                    <div style="position: relative; padding-left: 50px;">
                        <div style="position: absolute; left: 10px; width: 24px; height: 24px; border-radius: 50%; background: var(--dandy-green); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.8em;">3</div>
                        <div style="background: #fef3c7; padding: 1rem; border-radius: 8px;">
                            <strong>🍽️ Реализация</strong><br>
                            Чек: CHK-00123<br>
                            Клиент: Иван Иванов<br>
                            Дата: ${vsd.utilizedDate ? new Date(vsd.utilizedDate).toLocaleDateString('ru-RU') : '—'}
                        </div>
                    </div>
                </div>

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
    module.exports = MercuryModule;
}

