/**
 * DANDY Inventory — Модуль инвентаризации
 * Создание, проведение, акты разницы
 */

class InventoryCountModule {
    constructor(inventorySystem) {
        this.system = inventorySystem;
        this.inventories = this.loadInventories();
    }

    /**
     * Инициализация модуля
     */
    init() {
        console.log('📋 Inventory Count module initialized');
        this.renderInventories();
    }

    /**
     * Загрузка инвентаризаций
     */
    loadInventories() {
        const saved = this.system.loadFromLocalStorage('inventories');
        return saved || [
            {
                id: 1,
                invNumber: 'ИНВ-2024-001',
                date: '2024-01-15',
                warehouseId: 1,
                warehouseName: 'Основной склад',
                status: 'completed',
                totalItems: 145,
                countedItems: 145,
                differencesFound: 8,
                totalDifferenceAmount: -2450,
                responsible: 'Иванов И.И.',
                lines: [
                    {
                        productId: 1,
                        productName: 'Лосось филе',
                        batchNumber: 'L-20240115',
                        quantityByAccount: 0.8,
                        quantityActual: 0.5,
                        difference: -0.3,
                        costPerUnit: 1200,
                        amountDifference: -360
                    }
                ]
            }
        ];
    }

    /**
     * Отрисовка списка инвентаризаций
     */
    renderInventories() {
        const tbody = document.querySelector('#inventoriesBody');
        if (!tbody) return;

        if (this.inventories.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 2rem; color: #F3EADB; opacity: 0.7;">
                        Инвентаризаций пока нет
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.inventories.map(inv => {
            const statusBadge = this.getStatusBadge(inv.status);
            const progress = inv.totalItems > 0 
                ? ((inv.countedItems / inv.totalItems) * 100).toFixed(0) 
                : 0;

            return `
                <tr onclick="inventoryCountModule.showInventoryDetails(${inv.id})" style="cursor: pointer;">
                    <td><code>${inv.invNumber}</code></td>
                    <td>${new Date(inv.date).toLocaleDateString('ru-RU')}</td>
                    <td><strong>${inv.warehouseName}</strong></td>
                    <td>${progress}% (${inv.countedItems}/${inv.totalItems})</td>
                    <td>
                        ${inv.differencesFound > 0 
                            ? `<span class="badge badge-warning">${inv.differencesFound} шт</span>`
                            : `<span class="badge badge-success">Нет</span>`
                        }
                    </td>
                    <td>${statusBadge}</td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Получение бейджа статуса
     */
    getStatusBadge(status) {
        const badges = {
            'draft': '<span class="badge">Черновик</span>',
            'in_progress': '<span class="badge badge-info">В работе</span>',
            'completed': '<span class="badge badge-success">Завершена</span>',
            'approved': '<span class="badge badge-success">Утверждена</span>'
        };
        return badges[status] || status;
    }

    /**
     * Создание новой инвентаризации
     */
    startInventory() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: #094a45; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 2rem; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <h2 style="margin: 0 0 1.5rem 0; color: #eebc5c;">📋 Новая инвентаризация</h2>

                <div class="alert alert-info">
                    <span>ℹ️</span>
                    <div>
                        <strong>Инструкция:</strong><br>
                        1. Выберите склад для инвентаризации<br>
                        2. Система загрузит все товары со склада<br>
                        3. Внесите фактические остатки<br>
                        4. Система рассчитает расхождения
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Дата инвентаризации*</label>
                    <input type="date" class="form-input" id="invDate" value="${new Date().toISOString().split('T')[0]}">
                </div>

                <div class="form-group">
                    <label class="form-label">Склад*</label>
                    <select class="form-select" id="invWarehouse">
                        <option value="">Выберите...</option>
                        ${this.system.warehouses.map(wh => `
                            <option value="${wh.id}">${wh.name}</option>
                        `).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Ответственный*</label>
                    <input type="text" class="form-input" id="invResponsible" placeholder="Иванов И.И.">
                </div>

                <div class="form-group">
                    <label class="form-label">Зона/Секция (опционально)</label>
                    <input type="text" class="form-input" id="invZone" placeholder="Зона А, Стеллаж 1-5">
                </div>

                <div class="form-group">
                    <label class="form-label">Комментарий</label>
                    <textarea class="form-input" id="invComment" rows="3"></textarea>
                </div>

                <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                    <button onclick="inventoryCountModule.createInventory()" class="btn btn-primary">
                        ✅ Начать инвентаризацию
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
     * Создание инвентаризации
     */
    createInventory() {
        const date = document.getElementById('invDate').value;
        const warehouseId = parseInt(document.getElementById('invWarehouse').value);
        const responsible = document.getElementById('invResponsible').value.trim();
        const zone = document.getElementById('invZone').value.trim();
        const comment = document.getElementById('invComment').value.trim();

        if (!date || !warehouseId || !responsible) {
            alert('⚠️ Заполните все обязательные поля');
            return;
        }

        const warehouse = this.system.warehouses.find(wh => wh.id === warehouseId);
        if (!warehouse) return;

        // Получаем остатки по складу
        const stockBalances = this.system.stockBalances.filter(b => b.warehouseId === warehouseId);
        
        const lines = stockBalances.map(balance => {
            const product = this.system.products.find(p => p.id === balance.productId);
            return {
                productId: balance.productId,
                productName: product ? product.name : 'Неизвестный товар',
                batchNumber: balance.batchNumber,
                quantityByAccount: balance.quantity,
                quantityActual: null, // Будет заполнено при пересчёте
                difference: 0,
                costPerUnit: balance.costPerUnit,
                amountDifference: 0,
                counted: false
            };
        });

        const inventory = {
            id: Date.now(),
            invNumber: `ИНВ-2024-${String(this.inventories.length + 1).padStart(3, '0')}`,
            date,
            warehouseId,
            warehouseName: warehouse.name,
            status: 'draft',
            totalItems: lines.length,
            countedItems: 0,
            differencesFound: 0,
            totalDifferenceAmount: 0,
            responsible,
            zone,
            comment,
            lines
        };

        this.inventories.unshift(inventory);
        this.system.saveToLocalStorage('inventories', this.inventories);

        document.querySelector('.modal-overlay').remove();
        this.renderInventories();

        this.showNotification(`✅ Инвентаризация ${inventory.invNumber} создана!`, 'success');
        
        // Открываем для заполнения
        setTimeout(() => {
            this.showInventoryDetails(inventory.id);
        }, 500);
    }

    /**
     * Детали инвентаризации
     */
    showInventoryDetails(invId) {
        const inv = this.inventories.find(i => i.id === invId);
        if (!inv) return;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        const progress = inv.totalItems > 0 
            ? ((inv.countedItems / inv.totalItems) * 100).toFixed(0) 
            : 0;

        modal.innerHTML = `
            <div style="background: #094a45; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 2rem; max-width: 1000px; width: 95%; max-height: 90vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h2 style="margin: 0; color: #eebc5c;">📋 ${inv.invNumber}</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" 
                            style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #F3EADB; opacity: 0.7;">×</button>
                </div>

                <!-- Информация -->
                <div style="background: #f9f9f9; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
                        <div>
                            <strong>Дата:</strong> ${new Date(inv.date).toLocaleDateString('ru-RU')}
                        </div>
                        <div>
                            <strong>Склад:</strong> ${inv.warehouseName}
                        </div>
                        <div>
                            <strong>Ответственный:</strong> ${inv.responsible}
                        </div>
                    </div>
                </div>

                <!-- Прогресс -->
                <div style="margin-bottom: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span><strong>Прогресс подсчёта:</strong></span>
                        <span>${progress}% (${inv.countedItems}/${inv.totalItems})</span>
                    </div>
                    <div style="background: #e5e7eb; height: 24px; border-radius: 12px; overflow: hidden;">
                        <div style="background: var(--dandy-green); height: 100%; width: ${progress}%; transition: width 0.3s;"></div>
                    </div>
                </div>

                <!-- Статистика расхождений -->
                ${inv.differencesFound > 0 ? `
                    <div class="grid grid-3" style="margin-bottom: 1.5rem;">
                        <div style="background: #fef2f2; padding: 1rem; border-radius: 8px; text-align: center;">
                            <div style="font-size: 1.5rem; font-weight: bold; color: #dc2626;">${inv.differencesFound}</div>
                            <div style="font-size: 0.85em; color: #F3EADB; opacity: 0.8;">Расхождений</div>
                        </div>
                        <div style="background: ${inv.totalDifferenceAmount < 0 ? '#fef2f2' : '#f0fdf4'}; padding: 1rem; border-radius: 8px; text-align: center;">
                            <div style="font-size: 1.5rem; font-weight: bold; color: ${inv.totalDifferenceAmount < 0 ? '#dc2626' : '#16a34a'};">
                                ₽ ${inv.totalDifferenceAmount.toLocaleString('ru-RU')}
                            </div>
                            <div style="font-size: 0.85em; color: #F3EADB; opacity: 0.8;">Сумма разницы</div>
                        </div>
                        <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); color: #F3EADB; padding: 1rem; border-radius: 8px; text-align: center;">
                            <div style="font-size: 1.5rem; font-weight: bold; color: #d97706;">${((inv.differencesFound / inv.totalItems) * 100).toFixed(1)}%</div>
                            <div style="font-size: 0.85em; color: #F3EADB; opacity: 0.8;">Точность</div>
                        </div>
                    </div>
                ` : ''}

                <!-- Таблица товаров -->
                <h3 style="margin-bottom: 1rem;">Позиции инвентаризации:</h3>
                <div style="max-height: 400px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Товар</th>
                                <th style="text-align: right;">По учёту</th>
                                <th style="text-align: right;">Факт</th>
                                <th style="text-align: right;">Разница</th>
                                <th style="text-align: right;">Сумма ₽</th>
                                <th>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${inv.lines.map((line, index) => {
                                const diffClass = line.difference < 0 ? 'color: #dc2626;' : line.difference > 0 ? 'color: #16a34a;' : '';
                                return `
                                    <tr style="${line.counted ? 'background: #f9f9f9;' : ''}">
                                        <td>
                                            <strong>${line.productName}</strong><br>
                                            <span style="font-size: 0.85em; color: #F3EADB; opacity: 0.8;">Партия: ${line.batchNumber}</span>
                                        </td>
                                        <td style="text-align: right;">${line.quantityByAccount.toFixed(3)}</td>
                                        <td style="text-align: right;">
                                            ${line.quantityActual !== null ? line.quantityActual.toFixed(3) : '—'}
                                        </td>
                                        <td style="text-align: right; ${diffClass} font-weight: bold;">
                                            ${line.difference !== 0 ? (line.difference > 0 ? '+' : '') + line.difference.toFixed(3) : '—'}
                                        </td>
                                        <td style="text-align: right; ${diffClass}">
                                            ${line.amountDifference !== 0 ? (line.amountDifference > 0 ? '+' : '') + line.amountDifference.toFixed(2) : '—'}
                                        </td>
                                        <td>
                                            ${inv.status !== 'completed' && inv.status !== 'approved' ? `
                                                <button class="btn btn-secondary btn-small" 
                                                        onclick="inventoryCountModule.countItem(${inv.id}, ${index}); event.stopPropagation();">
                                                    ${line.counted ? '✏️ Изменить' : '📝 Внести'}
                                                </button>
                                            ` : ''}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- Действия -->
                <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                    ${inv.status === 'draft' || inv.status === 'in_progress' ? `
                        <button onclick="inventoryCountModule.completeInventory(${inv.id}); this.closest('.modal-overlay').remove();" 
                                class="btn btn-primary" ${inv.countedItems < inv.totalItems ? 'disabled style="opacity: 0.5;"' : ''}>
                            ✅ Завершить инвентаризацию
                        </button>
                        <button onclick="inventoryCountModule.generateReport(${inv.id})" class="btn btn-secondary">
                            📄 Акт расхождений
                        </button>
                    ` : inv.status === 'completed' ? `
                        <button onclick="inventoryCountModule.approveInventory(${inv.id}); this.closest('.modal-overlay').remove();" 
                                class="btn btn-primary">
                            ✅ Утвердить
                        </button>
                        <button onclick="inventoryCountModule.generateReport(${inv.id})" class="btn btn-secondary">
                            📄 Акт расхождений
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
     * Внести данные по позиции
     */
    countItem(invId, lineIndex) {
        const inv = this.inventories.find(i => i.id === invId);
        if (!inv) return;

        const line = inv.lines[lineIndex];

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10001;
        `;

        modal.innerHTML = `
            <div style="background: #094a45; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 2rem; max-width: 500px; width: 90%;">
                <h2 style="margin: 0 0 1.5rem 0; color: #eebc5c;">📝 Фактический остаток</h2>

                <div style="background: #f9f9f9; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                    <div><strong>Товар:</strong> ${line.productName}</div>
                    <div><strong>Партия:</strong> ${line.batchNumber}</div>
                    <div><strong>По учёту:</strong> ${line.quantityByAccount.toFixed(3)}</div>
                </div>

                <div class="form-group">
                    <label class="form-label">Фактическое количество*</label>
                    <input type="number" class="form-input" id="actualQty" 
                           value="${line.quantityActual !== null ? line.quantityActual : line.quantityByAccount}" 
                           step="0.001" min="0" autofocus>
                </div>

                <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                    <button onclick="inventoryCountModule.saveCount(${invId}, ${lineIndex})" class="btn btn-primary">
                        ✅ Сохранить
                    </button>
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">
                        Отмена
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Фокус на поле
        setTimeout(() => {
            const input = document.getElementById('actualQty');
            if (input) {
                input.focus();
                input.select();
            }
        }, 100);
    }

    /**
     * Сохранение фактического количества
     */
    saveCount(invId, lineIndex) {
        const inv = this.inventories.find(i => i.id === invId);
        if (!inv) return;

        const line = inv.lines[lineIndex];
        const actualQty = parseFloat(document.getElementById('actualQty').value);

        if (isNaN(actualQty) || actualQty < 0) {
            alert('⚠️ Введите корректное количество');
            return;
        }

        const wasNotCounted = !line.counted;

        line.quantityActual = actualQty;
        line.difference = actualQty - line.quantityByAccount;
        line.amountDifference = line.difference * line.costPerUnit;
        line.counted = true;

        // Обновляем счётчики
        if (wasNotCounted) {
            inv.countedItems++;
        }

        // Пересчитываем общие показатели
        inv.differencesFound = inv.lines.filter(l => l.difference !== 0).length;
        inv.totalDifferenceAmount = inv.lines.reduce((sum, l) => sum + l.amountDifference, 0);

        // Обновляем статус
        if (inv.status === 'draft' && inv.countedItems > 0) {
            inv.status = 'in_progress';
        }

        this.system.saveToLocalStorage('inventories', this.inventories);

        // Закрываем модалку
        document.querySelectorAll('.modal-overlay').forEach((m, i) => {
            if (i > 0) m.remove(); // Закрываем верхнюю модалку (форму ввода)
        });

        // Обновляем основную модалку
        this.showInventoryDetails(invId);

        this.showNotification('✅ Данные сохранены!', 'success');
    }

    /**
     * Завершение инвентаризации
     */
    completeInventory(invId) {
        const inv = this.inventories.find(i => i.id === invId);
        if (!inv) return;

        if (inv.countedItems < inv.totalItems) {
            alert('⚠️ Сначала внесите данные по всем позициям');
            return;
        }

        inv.status = 'completed';
        this.system.saveToLocalStorage('inventories', this.inventories);

        this.renderInventories();
        this.showNotification(`✅ Инвентаризация ${inv.invNumber} завершена!`, 'success');
    }

    /**
     * Утверждение инвентаризации
     */
    approveInventory(invId) {
        const inv = this.inventories.find(i => i.id === invId);
        if (!inv) return;

        inv.status = 'approved';
        this.system.saveToLocalStorage('inventories', this.inventories);

        // Применить разницы к остаткам (в реальной системе)
        // ...

        this.renderInventories();
        this.showNotification(`✅ Инвентаризация ${inv.invNumber} утверждена!`, 'success');
    }

    /**
     * Генерация акта расхождений
     */
    generateReport(invId) {
        const inv = this.inventories.find(i => i.id === invId);
        if (!inv) return;

        console.log('📄 Generating inventory report...');

        // В реальной системе — экспорт в Excel/PDF
        const dataStr = JSON.stringify(inv, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${inv.invNumber}_${new Date().toISOString().split('T')[0]}.json`;
        link.click();

        this.showNotification('✅ Акт расхождений экспортирован!', 'success');
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
            z-index: 10002;
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
    module.exports = InventoryCountModule;
}

