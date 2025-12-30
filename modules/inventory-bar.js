/**
 * DANDY Inventory — Модуль бара и разливного алкоголя
 * Вскрытие бутылок, учёт кег, списание в ЕГАИС
 */

class BarModule {
    constructor(inventorySystem) {
        this.system = inventorySystem;
        this.openedBottles = this.loadOpenedBottles();
        this.kegs = this.loadKegs();
    }

    /**
     * Инициализация модуля
     */
    init() {
        console.log('🍺 Bar module initialized');
        this.renderOpenedBottles();
        this.renderKegs();
    }

    /**
     * Загрузка открытых бутылок
     */
    loadOpenedBottles() {
        const saved = this.system.loadFromLocalStorage('openedBottles');
        return saved || [];
    }

    /**
     * Загрузка кег
     */
    loadKegs() {
        const saved = this.system.loadFromLocalStorage('kegs');
        return saved || [
            { id: 1, name: 'Светлое нефильтрованное', tap: 1, volume: 50, currentVolume: 28.5, soldToday: 12.3 },
            { id: 2, name: 'Темное', tap: 2, volume: 30, currentVolume: 15.0, soldToday: 8.5 }
        ];
    }

    /**
     * Отрисовка открытых бутылок
     */
    renderOpenedBottles() {
        const tbody = document.querySelector('#openedBottlesBody');
        if (!tbody) return;

        if (this.openedBottles.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 2rem; color: #999;">
                        Открытых бутылок нет
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.openedBottles.map(bottle => {
            const product = this.system.products.find(p => p.id === bottle.productId);
            if (!product) return '';

            const remainingPercent = (bottle.remainingVolume / bottle.totalVolume) * 100;
            const statusColor = remainingPercent > 50 ? '#16a34a' : remainingPercent > 20 ? '#f59e0b' : '#ef4444';

            return `
                <tr>
                    <td><strong>${product.name}</strong></td>
                    <td>${bottle.totalVolume} мл</td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <strong>${bottle.remainingVolume} мл</strong>
                            <div style="flex: 1; background: #e5e7eb; height: 8px; border-radius: 4px; overflow: hidden;">
                                <div style="width: ${remainingPercent}%; height: 100%; background: ${statusColor}; transition: width 0.3s;"></div>
                            </div>
                            <span style="font-size: 0.85em; color: #666;">${remainingPercent.toFixed(0)}%</span>
                        </div>
                    </td>
                    <td>${bottle.openedAt ? new Date(bottle.openedAt).toLocaleString('ru-RU') : '—'}</td>
                    <td>
                        <button class="btn btn-secondary btn-small" onclick="barModule.pourFromBottle(${bottle.id}, 50)">
                            🍸 Налить (50 мл)
                        </button>
                        <button class="btn btn-secondary btn-small" onclick="barModule.closeBottle(${bottle.id})">
                            🗑️ Утилизировать
                        </button>
                    </td>
                </tr>
            `;
        }).filter(html => html).join('');
    }

    /**
     * Отрисовка кег
     */
    renderKegs() {
        const container = document.getElementById('kegsContainer');
        if (!container) return;

        container.innerHTML = this.kegs.map(keg => {
            const remainingPercent = (keg.currentVolume / keg.volume) * 100;
            const statusColor = remainingPercent > 50 ? '#16a34a' : remainingPercent > 20 ? '#f59e0b' : '#ef4444';

            return `
                <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12);">
                    <h4 style="margin: 0 0 0.5rem 0; color: #eebc5c;">
                        🍺 Кран №${keg.tap}: ${keg.name}
                    </h4>
                    
                    <div style="margin-bottom: 0.5rem;">
                        <div style="display: flex; justify-content: space-between; font-size: 0.9em; margin-bottom: 0.25rem; color: #F3EADB;">
                            <span>В кеге:</span>
                            <strong>${keg.currentVolume} л / ${keg.volume} л</strong>
                        </div>
                        <div style="background: rgba(0,0,0,0.3); height: 12px; border-radius: 6px; overflow: hidden;">
                            <div style="width: ${remainingPercent}%; height: 100%; background: ${statusColor}; transition: width 0.3s;"></div>
                        </div>
                    </div>
                    
                    <div style="background: #094a45; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12); padding: 0.5rem; border-radius: 6px; margin-bottom: 0.5rem; font-size: 0.9em;">
                        Продано за смену: <strong>${keg.soldToday} л</strong>
                    </div>
                    
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-secondary btn-small" onclick="barModule.pourFromKeg(${keg.id}, 0.5)">
                            🍺 0.5 л
                        </button>
                        <button class="btn btn-secondary btn-small" onclick="barModule.pourFromKeg(${keg.id}, 0.3)">
                            🍺 0.3 л
                        </button>
                        <button class="btn btn-primary btn-small" onclick="barModule.replaceKeg(${keg.id})">
                            🔄 Заменить кегу
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Вскрытие бутылки
     */
    openBottle() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        // Фильтруем только алкоголь
        const alcoholProducts = this.system.products.filter(p => p.isAlcohol);

        modal.innerHTML = `
            <div style="background: #094a45; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 2rem; max-width: 500px; width: 90%;">
                <h2 style="margin: 0 0 1.5rem 0; color: #eebc5c;">🔓 Вскрытие бутылки</h2>

                <div class="form-group">
                    <label class="form-label">Выберите бутылку*</label>
                    <select class="form-select" id="openBottleProduct">
                        <option value="">Выберите...</option>
                        ${alcoholProducts.map(p => `
                            <option value="${p.id}" data-volume="500">${p.name}</option>
                        `).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Объём (мл)</label>
                    <input type="number" class="form-input" id="openBottleVolume" value="500" step="50">
                </div>

                <div class="alert alert-info">
                    <span>ℹ️</span>
                    <div>
                        <strong>Списание в ЕГАИС</strong><br>
                        При вскрытии будет создан акт списания на полный объём бутылки.
                        Внутренний остаток будет учитываться отдельно.
                    </div>
                </div>

                <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                    <button onclick="barModule.saveOpenBottle()" class="btn btn-primary">
                        🔓 Вскрыть
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
     * Сохранение вскрытия бутылки
     */
    saveOpenBottle() {
        const productId = parseInt(document.getElementById('openBottleProduct').value);
        const totalVolume = parseInt(document.getElementById('openBottleVolume').value);

        if (!productId || !totalVolume) {
            alert('⚠️ Заполните все поля');
            return;
        }

        const product = this.system.products.find(p => p.id === productId);
        if (!product) return;

        // Создаём запись об открытой бутылке
        const openedBottle = {
            id: Date.now(),
            productId,
            totalVolume,
            remainingVolume: totalVolume,
            openedAt: new Date().toISOString()
        };

        this.openedBottles.push(openedBottle);
        this.system.saveToLocalStorage('openedBottles', this.openedBottles);

        // Создаём акт списания в ЕГАИС
        if (this.system.createEGAISAct) {
            this.system.createEGAISAct({
                operationType: 'sale',
                documentId: Date.now(),
                productId,
                quantity: 1, // 1 бутылка
                reason: 'Вскрытие для реализации'
            });
        }

        // Закрываем модалку
        document.querySelector('.modal-overlay').remove();

        // Обновляем список
        this.renderOpenedBottles();

        // Уведомление
        this.showNotification(`✅ Бутылка "${product.name}" вскрыта!\n📤 Акт ЕГАИС отправлен`, 'success');
    }

    /**
     * Налить из бутылки
     */
    pourFromBottle(bottleId, volume) {
        const bottle = this.openedBottles.find(b => b.id === bottleId);
        if (!bottle) return;

        if (bottle.remainingVolume < volume) {
            alert(`⚠️ Недостаточно остатка в бутылке!\nОстаток: ${bottle.remainingVolume} мл`);
            return;
        }

        bottle.remainingVolume -= volume;

        // Если бутылка пустая, удаляем
        if (bottle.remainingVolume <= 0) {
            this.openedBottles = this.openedBottles.filter(b => b.id !== bottleId);
            this.showNotification('🗑️ Бутылка опустошена и удалена', 'info');
        }

        this.system.saveToLocalStorage('openedBottles', this.openedBottles);
        this.renderOpenedBottles();
    }

    /**
     * Закрыть/утилизировать бутылку
     */
    closeBottle(bottleId) {
        const bottle = this.openedBottles.find(b => b.id === bottleId);
        if (!bottle) return;

        const product = this.system.products.find(p => p.id === bottle.productId);
        
        if (!confirm(`🗑️ Утилизировать бутылку "${product ? product.name : 'Неизвестно'}"?\n\nОстаток: ${bottle.remainingVolume} мл будет списан как техпотери.`)) {
            return;
        }

        // Создаём акт списания техпотерь
        if (bottle.remainingVolume > 0 && this.system.createEGAISAct) {
            this.system.createEGAISAct({
                operationType: 'writeoff',
                productId: bottle.productId,
                quantity: bottle.remainingVolume / 1000, // в литрах
                reason: 'Техпотери/пролив'
            });
        }

        // Удаляем бутылку
        this.openedBottles = this.openedBottles.filter(b => b.id !== bottleId);
        this.system.saveToLocalStorage('openedBottles', this.openedBottles);

        this.renderOpenedBottles();
        this.showNotification('🗑️ Бутылка утилизирована', 'success');
    }

    /**
     * Налить из кеги
     */
    pourFromKeg(kegId, volume) {
        const keg = this.kegs.find(k => k.id === kegId);
        if (!keg) return;

        if (keg.currentVolume < volume) {
            alert(`⚠️ Недостаточно пива в кеге!\nОстаток: ${keg.currentVolume} л`);
            return;
        }

        keg.currentVolume = Math.max(0, keg.currentVolume - volume);
        keg.soldToday = (keg.soldToday || 0) + volume;

        this.system.saveToLocalStorage('kegs', this.kegs);
        this.renderKegs();

        this.showNotification(`🍺 Налито ${volume} л из крана №${keg.tap}`, 'success');
    }

    /**
     * Замена кеги
     */
    replaceKeg(kegId) {
        const keg = this.kegs.find(k => k.id === kegId);
        if (!keg) return;

        if (!confirm(`🔄 Заменить кегу на кране №${keg.tap}?\n\nТекущий остаток: ${keg.currentVolume} л будет списан как техпотери.`)) {
            return;
        }

        // Списываем остаток
        if (keg.currentVolume > 0) {
            // Создаём акт списания в ЕГАИС
            if (this.system.createEGAISAct) {
                this.system.createEGAISAct({
                    operationType: 'writeoff',
                    productId: keg.productId,
                    quantity: keg.currentVolume,
                    reason: 'Техпотери при замене кеги'
                });
            }
        }

        // Устанавливаем новую кегу
        keg.currentVolume = keg.volume;
        keg.soldToday = 0;

        this.system.saveToLocalStorage('kegs', this.kegs);
        this.renderKegs();

        this.showNotification(`✅ Кега на кране №${keg.tap} заменена!`, 'success');
    }

    /**
     * Сверка с расходомером
     */
    syncWithFlowMeter(kegId) {
        alert('🔄 Сверка с расходомером\n\nПолучение данных с устройства...\n\nБудет реализовано при интеграции с оборудованием');
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
    module.exports = BarModule;
}

