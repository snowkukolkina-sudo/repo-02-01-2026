/**
 * DANDY Inventory — Модуль складского учёта
 * Управление остатками, документами, перемещениями
 */

class WarehouseModule {
    constructor(inventorySystem) {
        this.system = inventorySystem;
        this.currentWarehouse = 'all';
        this.selectedDocument = null;
    }

    /**
     * Экранирование HTML для безопасности
     */
    escapeHtml(value) {
        if (value == null) return '';
        const div = document.createElement('div');
        div.textContent = String(value);
        return div.innerHTML;
    }

    /**
     * Инициализация модуля
     */
    init() {
        console.log('🏭 Warehouse module initialized');
        this.renderStockBalances();
    }

    /**
     * Отрисовка остатков
     */
    renderStockBalances() {
        const tbody = document.querySelector('#stockBalancesBody');
        if (!tbody) return;

        let balances = this.system.stockBalances;

        // Фильтр по складу
        if (this.currentWarehouse !== 'all') {
            balances = balances.filter(b => b.warehouseId === parseInt(this.currentWarehouse));
        }

        if (balances.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem; color: #F3EADB; opacity: 0.7;">
                        Остатков нет
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = balances.map(balance => {
            // Ищем товар по разным полям для совместимости
            const product = this.system.products.find(p => 
                String(p.id) === String(balance.productId) ||
                String(p.internal_id) === String(balance.productId) ||
                String(p.sku) === String(balance.productId) ||
                String(p.code) === String(balance.productId) ||
                (balance.productSku && String(p.sku) === String(balance.productSku)) ||
                (balance.productCode && String(p.code) === String(balance.productCode))
            );
            const warehouse = this.system.warehouses.find(w => 
                String(w.id) === String(balance.warehouseId) ||
                String(w.name) === String(balance.warehouseName || '')
            );
            
            // Безопасные значения для расчета
            const costPerUnit = parseFloat(balance.costPerUnit) || parseFloat(balance.purchase_price) || parseFloat(balance.cost) || 0;
            const quantity = parseFloat(balance.quantity) || parseFloat(balance.qty) || 0;
            const totalAmount = quantity * costPerUnit;
            
            // Если товар не найден, показываем информацию из balance
            if (!product) {
                const productName = balance.productName || balance.name || balance.product_name || 'Товар не найден';
                const productCode = balance.productCode || balance.productSku || balance.code || balance.sku || balance.productId || '—';
                const unit = balance.unit || balance.baseUnit || 'шт';
                
                return `
                    <tr>
                        <td><code>${this.escapeHtml(String(productCode))}</code></td>
                        <td>
                            <strong>${this.escapeHtml(String(productName))}</strong>
                            <span class="badge badge-warning" style="margin-left: 0.5rem;">⚠️ Товар не в справочнике</span>
                        </td>
                        <td>${balance.batchNumber || balance.batch_number || '—'}</td>
                        <td>${balance.expiryDate || balance.expiry_date || '—'}</td>
                        <td>${warehouse ? this.escapeHtml(warehouse.name) : (balance.warehouseName || balance.warehouse || '—')}</td>
                        <td><strong>${quantity}</strong> ${unit}</td>
                        <td><strong>₽ ${isNaN(totalAmount) ? '0.00' : totalAmount.toLocaleString('ru-RU', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></td>
                    </tr>
                `;
            }

            const isExpiring = balance.expiryDate && this.isExpiringSoon(balance.expiryDate);
            const isExpired = balance.expiryDate && new Date(balance.expiryDate) < new Date();
            const productName = product.name || 'Без названия';
            const productCode = product.code || product.sku || product.id || '—';
            const productUnit = product.baseUnit || product.unit || 'шт';

            return `
                <tr>
                    <td><code>${this.escapeHtml(String(productCode))}</code></td>
                    <td>
                        <strong>${this.escapeHtml(productName)}</strong>
                        ${isExpired ? '<span class="badge badge-danger" style="margin-left: 0.5rem;">Просрочено!</span>' : ''}
                        ${isExpiring && !isExpired ? '<span class="badge badge-warning" style="margin-left: 0.5rem;">Скоро истекает</span>' : ''}
                    </td>
                    <td>${balance.batchNumber || balance.batch_number || '—'}</td>
                    <td>${balance.expiryDate || balance.expiry_date || '—'}</td>
                    <td>${warehouse ? this.escapeHtml(warehouse.name) : (balance.warehouseName || balance.warehouse || '—')}</td>
                    <td><strong>${quantity}</strong> ${productUnit}</td>
                    <td><strong>₽ ${isNaN(totalAmount) ? '0.00' : totalAmount.toLocaleString('ru-RU', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong></td>
                </tr>
            `;
        }).filter(html => html).join('');
    }

    /**
     * Проверка срока годности
     */
    isExpiringSoon(expiryDate) {
        const days = this.getDaysUntilExpiry(expiryDate);
        return days > 0 && days <= 7;
    }

    /**
     * Дни до истечения
     */
    getDaysUntilExpiry(expiryDate) {
        const expiry = new Date(expiryDate);
        const today = new Date();
        const diff = expiry - today;
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    }

    /**
     * Создание документа прихода
     */
    createArrivalDocument() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: #094a45; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 2rem; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <h2 style="margin: 0 0 1.5rem 0; color: #eebc5c;">📥 Приход товара</h2>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                    <div class="form-group">
                        <label class="form-label">Номер документа*</label>
                        <input type="text" class="form-input" id="arrivalNumber" value="ARR-${Date.now()}" placeholder="ARR-00001">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Дата*</label>
                        <input type="date" class="form-input" id="arrivalDate" value="${new Date().toISOString().split('T')[0]}">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Склад*</label>
                        <select class="form-select" id="arrivalWarehouse">
                            ${this.system.warehouses.map(w => `
                                <option value="${w.id}">${w.name}</option>
                            `).join('')}
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Поставщик</label>
                        <input type="text" class="form-input" id="arrivalSupplier" placeholder="ООО Поставщик">
                    </div>
                </div>

                <h3 style="margin-bottom: 1rem; color: #eebc5c;">Позиции</h3>
                
                <div id="arrivalLines" style="margin-bottom: 1rem;">
                    <!-- Строки будут здесь -->
                </div>

                <button onclick="warehouseModule.addArrivalLine()" class="btn btn-secondary btn-small" style="margin-bottom: 1rem;">
                    ➕ Добавить позицию
                </button>

                <div style="background: #f0fdf4; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                    <strong>Сумма документа:</strong> 
                    <span id="arrivalTotal" style="font-size: 1.2em; font-weight: 700; color: #eebc5c; margin-left: 0.5rem;">
                        ₽ 0.00
                    </span>
                </div>

                <div style="display: flex; gap: 1rem;">
                    <button onclick="warehouseModule.saveArrivalDocument()" class="btn btn-primary">
                        💾 Сохранить и провести
                    </button>
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">
                        Отмена
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Инициализация
        this.arrivalLines = [];
        this.addArrivalLine();
    }

    /**
     * Добавить строку в приход
     */
    addArrivalLine() {
        this.arrivalLines = this.arrivalLines || [];
        this.arrivalLines.push({
            productId: null,
            quantity: 0,
            costPerUnit: 0,
            batchNumber: '',
            expiryDate: ''
        });
        this.renderArrivalLines();
    }

    /**
     * Отрисовка строк прихода
     */
    renderArrivalLines() {
        const container = document.getElementById('arrivalLines');
        if (!container) return;

        container.innerHTML = this.arrivalLines.map((line, index) => {
            const product = line.productId ? this.system.products.find(p => p.id === line.productId) : null;
            
            return `
                <div style="background: #f9fafb; padding: 1rem; border-radius: 8px; margin-bottom: 0.75rem;">
                    <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr auto; gap: 0.75rem; align-items: end;">
                        <div class="form-group" style="margin: 0;">
                            <label class="form-label" style="font-size: 0.85em;">Товар</label>
                            <select class="form-select" onchange="warehouseModule.updateArrivalLine(${index}, 'productId', parseInt(this.value))">
                                <option value="">Выберите...</option>
                                ${this.system.products.map(p => `
                                    <option value="${p.id}" ${line.productId === p.id ? 'selected' : ''}>${p.name}</option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <div class="form-group" style="margin: 0;">
                            <label class="form-label" style="font-size: 0.85em;">Количество</label>
                            <input type="number" class="form-input" value="${line.quantity}" step="0.01" 
                                   onchange="warehouseModule.updateArrivalLine(${index}, 'quantity', parseFloat(this.value))">
                        </div>
                        
                        <div class="form-group" style="margin: 0;">
                            <label class="form-label" style="font-size: 0.85em;">Цена</label>
                            <input type="number" class="form-input" value="${line.costPerUnit}" step="0.01" 
                                   onchange="warehouseModule.updateArrivalLine(${index}, 'costPerUnit', parseFloat(this.value))">
                        </div>
                        
                        <div class="form-group" style="margin: 0;">
                            <label class="form-label" style="font-size: 0.85em;">Партия</label>
                            <input type="text" class="form-input" value="${line.batchNumber}" 
                                   onchange="warehouseModule.updateArrivalLine(${index}, 'batchNumber', this.value)">
                        </div>
                        
                        <div class="form-group" style="margin: 0;">
                            <label class="form-label" style="font-size: 0.85em;">Срок годности</label>
                            <input type="date" class="form-input" value="${line.expiryDate}" 
                                   onchange="warehouseModule.updateArrivalLine(${index}, 'expiryDate', this.value)">
                        </div>
                        
                        <button onclick="warehouseModule.removeArrivalLine(${index})" 
                                style="padding: 0.5rem 0.75rem; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer;">
                            🗑️
                        </button>
                    </div>
                    ${product ? `<div style="margin-top: 0.5rem; color: #666; font-size: 0.85em;">
                        Сумма: ₽ ${(line.quantity * line.costPerUnit).toFixed(2)}
                    </div>` : ''}
                </div>
            `;
        }).join('');

        this.calculateArrivalTotal();
    }

    /**
     * Обновить строку прихода
     */
    updateArrivalLine(index, field, value) {
        if (this.arrivalLines[index]) {
            this.arrivalLines[index][field] = value;
            this.renderArrivalLines();
        }
    }

    /**
     * Удалить строку прихода
     */
    removeArrivalLine(index) {
        this.arrivalLines.splice(index, 1);
        this.renderArrivalLines();
    }

    /**
     * Расчёт суммы прихода
     */
    calculateArrivalTotal() {
        const total = this.arrivalLines.reduce((sum, line) => {
            return sum + (line.quantity * line.costPerUnit);
        }, 0);

        const totalElement = document.getElementById('arrivalTotal');
        if (totalElement) {
            totalElement.textContent = `₽ ${total.toFixed(2)}`;
        }

        return total;
    }

    /**
     * Сохранение документа прихода
     */
    saveArrivalDocument() {
        const docNumber = document.getElementById('arrivalNumber').value.trim();
        const docDate = document.getElementById('arrivalDate').value;
        const warehouseId = parseInt(document.getElementById('arrivalWarehouse').value);

        if (!docNumber || !docDate) {
            alert('⚠️ Заполните обязательные поля');
            return;
        }

        if (this.arrivalLines.length === 0 || !this.arrivalLines.some(l => l.productId)) {
            alert('⚠️ Добавьте хотя бы одну позицию');
            return;
        }

        // Создаём документ
        const doc = this.system.createArrivalDocument({
            docNumber,
            docDate,
            warehouseId,
            lines: this.arrivalLines.filter(l => l.productId)
        });

        // Проводим документ (обновляем остатки)
        this.system.postDocument(doc.id);

        // Закрываем модалку
        document.querySelector('.modal-overlay').remove();

        // Обновляем остатки
        this.renderStockBalances();

        // Уведомление
        this.showNotification('✅ Документ прихода проведён!', 'success');
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
    module.exports = WarehouseModule;
}

