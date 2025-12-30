/**
 * DANDY Inventory — Модуль производства
 * Выпуск полуфабрикатов, сменные наряды, учёт потерь
 */

class ProductionModule {
    constructor(inventorySystem) {
        this.system = inventorySystem;
        this.productionOrders = this.loadProductionOrders();
        this.semiProducts = this.loadSemiProducts();
    }

    /**
     * Инициализация модуля
     */
    init() {
        console.log('⚙️ Production module initialized');
        this.renderProductionOrders();
    }

    /**
     * Загрузка производственных нарядов
     */
    loadProductionOrders() {
        const saved = this.system.loadFromLocalStorage('productionOrders');
        return saved || [
            {
                id: 1,
                orderNumber: 'ПН-001',
                date: '2024-01-15',
                shift: 'Утренняя (08:00-16:00)',
                semiProductId: 1,
                semiProductName: 'Тесто для пиццы',
                planQty: 50,
                actualQty: 48,
                wasteQty: 2,
                status: 'completed',
                chef: 'Иванов И.И.'
            },
            {
                id: 2,
                orderNumber: 'ПН-002',
                date: '2024-01-15',
                shift: 'Дневная (14:00-22:00)',
                semiProductId: 2,
                semiProductName: 'Соус томатный',
                planQty: 10,
                actualQty: 0,
                wasteQty: 0,
                status: 'in_progress',
                chef: 'Петров П.П.'
            }
        ];
    }

    /**
     * Загрузка полуфабрикатов
     */
    loadSemiProducts() {
        return [
            { id: 1, name: 'Тесто для пиццы', unit: 'кг', shelfLife: 24 },
            { id: 2, name: 'Соус томатный', unit: 'л', shelfLife: 72 },
            { id: 3, name: 'Фарш мясной', unit: 'кг', shelfLife: 12 },
            { id: 4, name: 'Бульон куриный', unit: 'л', shelfLife: 48 }
        ];
    }

    /**
     * Отрисовка производственных нарядов
     */
    renderProductionOrders() {
        const tbody = document.querySelector('#productionOrdersBody');
        if (!tbody) return;

        if (this.productionOrders.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem; color: #F3EADB; opacity: 0.7;">
                        Нарядов пока нет
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.productionOrders.map(order => {
            const statusBadge = this.getStatusBadge(order.status);
            const yieldPercent = order.actualQty > 0 
                ? ((order.actualQty / order.planQty) * 100).toFixed(1) 
                : '0.0';

            return `
                <tr onclick="productionModule.showOrderDetails(${order.id})" style="cursor: pointer;">
                    <td><code>${order.orderNumber}</code></td>
                    <td>${new Date(order.date).toLocaleDateString('ru-RU')}</td>
                    <td><strong>${order.semiProductName}</strong></td>
                    <td>${order.planQty} ${this.getSemiProductUnit(order.semiProductId)}</td>
                    <td>${order.actualQty || '—'} ${order.actualQty ? this.getSemiProductUnit(order.semiProductId) : ''}</td>
                    <td>
                        ${order.actualQty > 0 ? `
                            <span class="badge ${yieldPercent >= 95 ? 'badge-success' : yieldPercent >= 90 ? '' : 'badge-warning'}">
                                ${yieldPercent}%
                            </span>
                        ` : '—'}
                    </td>
                    <td>${statusBadge}</td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Получение единицы измерения полуфабриката
     */
    getSemiProductUnit(semiProductId) {
        const semiProduct = this.semiProducts.find(sp => sp.id === semiProductId);
        return semiProduct ? semiProduct.unit : 'шт';
    }

    /**
     * Получение бейджа статуса
     */
    getStatusBadge(status) {
        const badges = {
            'draft': '<span class="badge">Черновик</span>',
            'in_progress': '<span class="badge badge-info">В работе</span>',
            'completed': '<span class="badge badge-success">Завершён</span>',
            'cancelled': '<span class="badge badge-danger">Отменён</span>'
        };
        return badges[status] || status;
    }

    /**
     * Создание производственного наряда
     */
    createProductionOrder() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: #094a45; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 2rem; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <h2 style="margin: 0 0 1.5rem 0; color: #eebc5c;">⚙️ Новый производственный наряд</h2>

                <div class="form-group">
                    <label class="form-label">Дата*</label>
                    <input type="date" class="form-input" id="orderDate" value="${new Date().toISOString().split('T')[0]}">
                </div>

                <div class="form-group">
                    <label class="form-label">Смена*</label>
                    <select class="form-select" id="orderShift">
                        <option value="morning">Утренняя (08:00-16:00)</option>
                        <option value="day">Дневная (14:00-22:00)</option>
                        <option value="evening">Вечерняя (20:00-04:00)</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Полуфабрикат*</label>
                    <select class="form-select" id="orderSemiProduct">
                        <option value="">Выберите...</option>
                        ${this.semiProducts.map(sp => `
                            <option value="${sp.id}">${sp.name} (${sp.unit})</option>
                        `).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Плановое количество*</label>
                    <input type="number" class="form-input" id="orderPlanQty" value="0" step="0.001" min="0">
                </div>

                <div class="form-group">
                    <label class="form-label">Ответственный повар</label>
                    <input type="text" class="form-input" id="orderChef" placeholder="Иванов И.И.">
                </div>

                <div class="form-group">
                    <label class="form-label">Комментарий</label>
                    <textarea class="form-input" id="orderComment" rows="3"></textarea>
                </div>

                <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                    <button onclick="productionModule.saveProductionOrder()" class="btn btn-primary">
                        ✅ Создать наряд
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
     * Сохранение производственного наряда
     */
    saveProductionOrder() {
        const date = document.getElementById('orderDate').value;
        const shift = document.getElementById('orderShift').value;
        const semiProductId = parseInt(document.getElementById('orderSemiProduct').value);
        const planQty = parseFloat(document.getElementById('orderPlanQty').value);
        const chef = document.getElementById('orderChef').value.trim();
        const comment = document.getElementById('orderComment').value.trim();

        if (!date || !semiProductId || planQty <= 0) {
            alert('⚠️ Заполните все обязательные поля');
            return;
        }

        const semiProduct = this.semiProducts.find(sp => sp.id === semiProductId);
        if (!semiProduct) return;

        const shiftNames = {
            'morning': 'Утренняя (08:00-16:00)',
            'day': 'Дневная (14:00-22:00)',
            'evening': 'Вечерняя (20:00-04:00)'
        };

        const order = {
            id: Date.now(),
            orderNumber: `ПН-${String(this.productionOrders.length + 1).padStart(3, '0')}`,
            date,
            shift: shiftNames[shift],
            semiProductId,
            semiProductName: semiProduct.name,
            planQty,
            actualQty: 0,
            wasteQty: 0,
            status: 'draft',
            chef,
            comment
        };

        this.productionOrders.unshift(order);
        this.system.saveToLocalStorage('productionOrders', this.productionOrders);

        document.querySelector('.modal-overlay').remove();
        this.renderProductionOrders();

        this.showNotification(`✅ Наряд ${order.orderNumber} создан!`, 'success');
    }

    /**
     * Детали производственного наряда
     */
    showOrderDetails(orderId) {
        const order = this.productionOrders.find(o => o.id === orderId);
        if (!order) return;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        const yieldPercent = order.actualQty > 0 
            ? ((order.actualQty / order.planQty) * 100).toFixed(1) 
            : '0.0';

        modal.innerHTML = `
            <div style="background: #094a45; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 2rem; max-width: 700px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h2 style="margin: 0; color: #eebc5c;">⚙️ Наряд ${order.orderNumber}</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" 
                            style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #F3EADB; opacity: 0.7;">×</button>
                </div>

                <div style="background: #f9f9f9; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div>
                            <strong>Дата:</strong><br>
                            ${new Date(order.date).toLocaleDateString('ru-RU')}
                        </div>
                        <div>
                            <strong>Смена:</strong><br>
                            ${order.shift}
                        </div>
                        <div>
                            <strong>Полуфабрикат:</strong><br>
                            ${order.semiProductName}
                        </div>
                        <div>
                            <strong>Статус:</strong><br>
                            ${this.getStatusBadge(order.status)}
                        </div>
                    </div>
                </div>

                <h3 style="margin: 1.5rem 0 1rem 0; color: #eebc5c;">Выработка</h3>
                <div class="grid grid-3" style="margin-bottom: 1.5rem;">
                    <div style="background: #f0f9ff; padding: 1rem; border-radius: 8px; text-align: center;">
                        <div style="font-size: 1.5rem; font-weight: bold; color: #2563eb;">${order.planQty}</div>
                        <div style="font-size: 0.85em; color: #666;">План</div>
                    </div>
                    <div style="background: #f0fdf4; padding: 1rem; border-radius: 8px; text-align: center;">
                        <div style="font-size: 1.5rem; font-weight: bold; color: #16a34a;">${order.actualQty || 0}</div>
                        <div style="font-size: 0.85em; color: #666;">Факт</div>
                    </div>
                    <div style="background: #fef3c7; padding: 1rem; border-radius: 8px; text-align: center;">
                        <div style="font-size: 1.5rem; font-weight: bold; color: #d97706;">${order.wasteQty || 0}</div>
                        <div style="font-size: 0.85em; color: #666;">Потери</div>
                    </div>
                </div>

                ${order.actualQty > 0 ? `
                    <div style="background: ${yieldPercent >= 95 ? '#f0fdf4' : yieldPercent >= 90 ? '#fffbeb' : '#fef2f2'}; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                        <strong>Выход:</strong> ${yieldPercent}%
                        ${yieldPercent < 95 ? '<br><span style="color: #666; font-size: 0.9em;">⚠️ Ниже нормы (95%)</span>' : ''}
                    </div>
                ` : ''}

                ${order.chef ? `
                    <div style="background: #f9f9f9; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                        <strong>Ответственный:</strong> ${order.chef}
                    </div>
                ` : ''}

                <div style="display: flex; gap: 1rem;">
                    ${order.status === 'draft' || order.status === 'in_progress' ? `
                        <button onclick="productionModule.completeOrder(${order.id}); this.closest('.modal-overlay').remove();" class="btn btn-primary">
                            ✅ Завершить
                        </button>
                        <button onclick="productionModule.registerYield(${order.id}); this.closest('.modal-overlay').remove();" class="btn btn-secondary">
                            📝 Зафиксировать выход
                        </button>
                    ` : ''}
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">
                        Закрыть
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * Регистрация выхода
     */
    registerYield(orderId) {
        const order = this.productionOrders.find(o => o.id === orderId);
        if (!order) return;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: #094a45; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 2rem; max-width: 500px; width: 90%;">
                <h2 style="margin: 0 0 1.5rem 0; color: #eebc5c;">📝 Фактический выход</h2>

                <div style="background: #f9f9f9; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                    <div><strong>Наряд:</strong> ${order.orderNumber}</div>
                    <div><strong>Полуфабрикат:</strong> ${order.semiProductName}</div>
                    <div><strong>План:</strong> ${order.planQty} ${this.getSemiProductUnit(order.semiProductId)}</div>
                </div>

                <div class="form-group">
                    <label class="form-label">Фактическое количество*</label>
                    <input type="number" class="form-input" id="yieldActualQty" value="${order.actualQty || 0}" step="0.001" min="0">
                </div>

                <div class="form-group">
                    <label class="form-label">Потери</label>
                    <input type="number" class="form-input" id="yieldWasteQty" value="${order.wasteQty || 0}" step="0.001" min="0">
                </div>

                <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                    <button onclick="productionModule.saveYield(${order.id})" class="btn btn-primary">
                        ✅ Сохранить
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
     * Сохранение выхода
     */
    saveYield(orderId) {
        const order = this.productionOrders.find(o => o.id === orderId);
        if (!order) return;

        const actualQty = parseFloat(document.getElementById('yieldActualQty').value);
        const wasteQty = parseFloat(document.getElementById('yieldWasteQty').value);

        if (actualQty < 0 || wasteQty < 0) {
            alert('⚠️ Количество не может быть отрицательным');
            return;
        }

        order.actualQty = actualQty;
        order.wasteQty = wasteQty;
        if (order.status === 'draft') {
            order.status = 'in_progress';
        }

        this.system.saveToLocalStorage('productionOrders', this.productionOrders);

        document.querySelector('.modal-overlay').remove();
        this.renderProductionOrders();

        this.showNotification('✅ Выход зафиксирован!', 'success');
    }

    /**
     * Завершение наряда
     */
    completeOrder(orderId) {
        const order = this.productionOrders.find(o => o.id === orderId);
        if (!order) return;

        if (order.actualQty <= 0) {
            alert('⚠️ Сначала зафиксируйте фактический выход');
            return;
        }

        order.status = 'completed';
        this.system.saveToLocalStorage('productionOrders', this.productionOrders);

        this.renderProductionOrders();
        this.showNotification(`✅ Наряд ${order.orderNumber} завершён!`, 'success');
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
    module.exports = ProductionModule;
}

