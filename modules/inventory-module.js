// ===== Inventory Module - Складской учёт =====
// Полная система управления складом с FEFO, сроками годности и автоматическими уведомлениями

class InventoryModule {
    constructor() {
        this.inventory = [];
        this.movements = []; // История движения товаров
        this.notifications = [];
        this.categories = ['Мука и тесто', 'Сыры', 'Овощи', 'Мясо и рыба', 'Соусы', 'Напитки', 'Упаковка'];
        this.autoRefreshInterval = null;
        
        // Конфигурация
        this.config = {
            expiryWarningDays: 3, // предупреждение за 3 дня до истечения срока
            lowStockPercent: 20, // критический остаток 20% от минимума
            autoRefreshSeconds: 30 // автообновление каждые 30 секунд
        };
        
        this.init();
    }

    init() {
        this.loadInventory();
        this.loadMovements();
        this.checkNotifications();
        this.startAutoRefresh();
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            // Добавить товар на склад
            if (e.target.id === 'addInventoryItem') {
                this.showAddItemModal();
            }
            
            // Оприходовать товар (приход)
            if (e.target.classList.contains('add-stock-btn')) {
                this.showAddStockModal(e.target.dataset.itemId);
            }
            
            // Списать товар
            if (e.target.classList.contains('write-off-btn')) {
                this.showWriteOffModal(e.target.dataset.itemId);
            }
            
            // Редактировать товар
            if (e.target.classList.contains('edit-inventory-btn')) {
                this.showEditItemModal(e.target.dataset.itemId);
            }
            
            // Показать историю
            if (e.target.classList.contains('history-btn')) {
                this.showItemHistory(e.target.dataset.itemId);
            }
            
            // Экспорт в Excel
            if (e.target.id === 'exportInventory') {
                this.exportToExcel();
            }
            
            // Фильтрация
            if (e.target.classList.contains('inventory-filter')) {
                this.filterInventory(e.target.dataset.filter);
            }
        });
    }

    loadInventory() {
        // Загружаем из localStorage (позже можно заменить на API)
        const saved = localStorage.getItem('dandy_inventory');
        if (saved) {
            this.inventory = JSON.parse(saved);
        } else {
            // Демо данные
            this.inventory = [
                {
                    id: '1',
                    name: 'Мука высший сорт',
                    category: 'Мука и тесто',
                    quantity: 45,
                    unit: 'кг',
                    minStock: 20,
                    purchasePrice: 45,
                    batches: [
                        { batchId: 'B001', quantity: 25, expiryDate: '2025-12-31', receiptDate: '2024-11-01' },
                        { batchId: 'B002', quantity: 20, expiryDate: '2026-01-15', receiptDate: '2024-11-15' }
                    ]
                },
                {
                    id: '2',
                    name: 'Сыр Моцарелла',
                    category: 'Сыры',
                    quantity: 8,
                    unit: 'кг',
                    minStock: 10,
                    purchasePrice: 450,
                    batches: [
                        { batchId: 'B003', quantity: 8, expiryDate: '2025-10-15', receiptDate: '2024-10-01' }
                    ]
                },
                {
                    id: '3',
                    name: 'Лосось свежий',
                    category: 'Мясо и рыба',
                    quantity: 0,
                    unit: 'кг',
                    minStock: 5,
                    purchasePrice: 890,
                    batches: []
                },
                {
                    id: '4',
                    name: 'Томаты',
                    category: 'Овощи',
                    quantity: 15,
                    unit: 'кг',
                    minStock: 5,
                    purchasePrice: 120,
                    batches: [
                        { batchId: 'B004', quantity: 15, expiryDate: '2025-10-05', receiptDate: '2024-10-01' }
                    ]
                }
            ];
            this.saveInventory();
        }
    }

    loadMovements() {
        const saved = localStorage.getItem('dandy_inventory_movements');
        if (saved) {
            this.movements = JSON.parse(saved);
        }
    }

    saveInventory() {
        localStorage.setItem('dandy_inventory', JSON.stringify(this.inventory));
    }

    saveMovements() {
        localStorage.setItem('dandy_inventory_movements', JSON.stringify(this.movements));
    }

    checkNotifications() {
        this.notifications = [];
        const now = new Date();
        
        this.inventory.forEach(item => {
            // Проверка низких остатков
            if (item.quantity <= item.minStock * (this.config.lowStockPercent / 100)) {
                this.notifications.push({
                    type: 'critical',
                    message: `❌ ${item.name}: критический остаток (${item.quantity} ${item.unit})`,
                    itemId: item.id
                });
            } else if (item.quantity <= item.minStock) {
                this.notifications.push({
                    type: 'warning',
                    message: `⚠️ ${item.name}: низкий остаток (${item.quantity} ${item.unit})`,
                    itemId: item.id
                });
            }
            
            // Проверка сроков годности
            item.batches.forEach(batch => {
                const expiryDate = new Date(batch.expiryDate);
                const daysToExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
                
                if (daysToExpiry < 0) {
                    this.notifications.push({
                        type: 'critical',
                        message: `❌ ${item.name} (партия ${batch.batchId}): срок годности истёк!`,
                        itemId: item.id
                    });
                } else if (daysToExpiry <= this.config.expiryWarningDays) {
                    this.notifications.push({
                        type: 'warning',
                        message: `⚠️ ${item.name} (партия ${batch.batchId}): истекает через ${daysToExpiry} дн.`,
                        itemId: item.id
                    });
                }
            });
        });
    }

    addMovement(type, itemId, quantity, reason, batchId = null) {
        const item = this.inventory.find(i => i.id === itemId);
        if (!item) return;
        
        this.movements.push({
            id: Date.now().toString(),
            type, // 'receipt' (приход), 'writeoff' (списание), 'sale' (продажа)
            itemId,
            itemName: item.name,
            quantity,
            unit: item.unit,
            reason,
            batchId,
            timestamp: new Date().toISOString(),
            user: 'Администратор'
        });
        
        this.saveMovements();
    }

    showAddItemModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div style="background: white; border-radius: 16px; padding: 2rem; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <h2 style="margin: 0 0 1.5rem 0; color: var(--dandy-green);">➕ Добавить товар на склад</h2>
                
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Название товара:</label>
                    <input type="text" id="newItemName" style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                </div>
                
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Категория:</label>
                    <select id="newItemCategory" style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                        ${this.categories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
                    </select>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div>
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Единица измерения:</label>
                        <select id="newItemUnit" style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                            <option value="кг">кг</option>
                            <option value="л">л</option>
                            <option value="шт">шт</option>
                            <option value="уп">уп</option>
                        </select>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Минимальный остаток:</label>
                        <input type="number" id="newItemMinStock" value="10" style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                    </div>
                </div>
                
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Цена закупки (за единицу):</label>
                    <input type="number" id="newItemPrice" value="0" style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                </div>
                
                <div style="display: flex; gap: 1rem;">
                    <button onclick="inventoryModule.saveNewItem()" style="flex: 1; padding: 1rem; background: var(--dandy-green); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                        💾 Сохранить
                    </button>
                    <button onclick="this.closest('.modal-overlay').remove()" style="flex: 1; padding: 1rem; background: #6b7280; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                        ❌ Отмена
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    saveNewItem() {
        const name = document.getElementById('newItemName').value;
        const category = document.getElementById('newItemCategory').value;
        const unit = document.getElementById('newItemUnit').value;
        const minStock = parseInt(document.getElementById('newItemMinStock').value);
        const purchasePrice = parseFloat(document.getElementById('newItemPrice').value);
        
        if (!name) {
            alert('Введите название товара');
            return;
        }
        
        const newItem = {
            id: Date.now().toString(),
            name,
            category,
            quantity: 0,
            unit,
            minStock,
            purchasePrice,
            batches: []
        };
        
        this.inventory.push(newItem);
        this.saveInventory();
        
        document.querySelector('.modal-overlay').remove();
        this.render();
        
        alert('✅ Товар добавлен на склад!');
    }

    showAddStockModal(itemId) {
        const item = this.inventory.find(i => i.id === itemId);
        if (!item) return;
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div style="background: white; border-radius: 16px; padding: 2rem; max-width: 500px; width: 90%;">
                <h2 style="margin: 0 0 1.5rem 0; color: var(--dandy-green);">📦 Оприходовать: ${item.name}</h2>
                
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Количество (${item.unit}):</label>
                    <input type="number" id="addQuantity" value="10" min="0" step="0.1" style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                </div>
                
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Номер партии:</label>
                    <input type="text" id="batchId" value="B${Date.now().toString().slice(-6)}" style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                </div>
                
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Срок годности:</label>
                    <input type="date" id="expiryDate" value="${new Date(Date.now() + 90*24*60*60*1000).toISOString().split('T')[0]}" style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                </div>
                
                <div style="display: flex; gap: 1rem;">
                    <button onclick="inventoryModule.addStock('${itemId}')" style="flex: 1; padding: 1rem; background: #16a34a; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                        ✅ Оприходовать
                    </button>
                    <button onclick="this.closest('.modal-overlay').remove()" style="flex: 1; padding: 1rem; background: #6b7280; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                        ❌ Отмена
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    addStock(itemId) {
        const item = this.inventory.find(i => i.id === itemId);
        if (!item) return;
        
        const quantity = parseFloat(document.getElementById('addQuantity').value);
        const batchId = document.getElementById('batchId').value;
        const expiryDate = document.getElementById('expiryDate').value;
        
        if (!quantity || quantity <= 0) {
            alert('Введите корректное количество');
            return;
        }
        
        // Добавляем новую партию
        item.batches.push({
            batchId,
            quantity,
            expiryDate,
            receiptDate: new Date().toISOString().split('T')[0]
        });
        
        // Увеличиваем общее количество
        item.quantity += quantity;
        
        // Записываем движение
        this.addMovement('receipt', itemId, quantity, 'Приход товара', batchId);
        
        this.saveInventory();
        document.querySelector('.modal-overlay').remove();
        this.render();
        
        alert(`✅ Оприходовано: ${quantity} ${item.unit}`);
    }

    showWriteOffModal(itemId) {
        const item = this.inventory.find(i => i.id === itemId);
        if (!item) return;
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div style="background: white; border-radius: 16px; padding: 2rem; max-width: 500px; width: 90%;">
                <h2 style="margin: 0 0 1.5rem 0; color: #dc2626;">🗑️ Списать: ${item.name}</h2>
                
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Количество (${item.unit}):</label>
                    <input type="number" id="writeOffQuantity" value="1" min="0" max="${item.quantity}" step="0.1" style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                    <div style="font-size: 0.85rem; color: #666; margin-top: 0.25rem;">Доступно: ${item.quantity} ${item.unit}</div>
                </div>
                
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Причина списания:</label>
                    <select id="writeOffReason" style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                        <option value="expired">Истёк срок годности</option>
                        <option value="damaged">Порча/брак</option>
                        <option value="theft">Недостача</option>
                        <option value="other">Другое</option>
                    </select>
                </div>
                
                <div style="display: flex; gap: 1rem;">
                    <button onclick="inventoryModule.writeOff('${itemId}')" style="flex: 1; padding: 1rem; background: #dc2626; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                        🗑️ Списать
                    </button>
                    <button onclick="this.closest('.modal-overlay').remove()" style="flex: 1; padding: 1rem; background: #6b7280; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                        ❌ Отмена
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    writeOff(itemId) {
        const item = this.inventory.find(i => i.id === itemId);
        if (!item) return;
        
        const quantity = parseFloat(document.getElementById('writeOffQuantity').value);
        const reason = document.getElementById('writeOffReason').value;
        
        if (!quantity || quantity <= 0 || quantity > item.quantity) {
            alert('Введите корректное количество');
            return;
        }
        
        // Списываем по FEFO (First Expired, First Out)
        let remaining = quantity;
        const sortedBatches = item.batches.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
        
        for (let batch of sortedBatches) {
            if (remaining <= 0) break;
            
            if (batch.quantity >= remaining) {
                batch.quantity -= remaining;
                this.addMovement('writeoff', itemId, remaining, this.getWriteOffReasonText(reason), batch.batchId);
                remaining = 0;
            } else {
                remaining -= batch.quantity;
                this.addMovement('writeoff', itemId, batch.quantity, this.getWriteOffReasonText(reason), batch.batchId);
                batch.quantity = 0;
            }
        }
        
        // Удаляем пустые партии
        item.batches = item.batches.filter(b => b.quantity > 0);
        
        // Уменьшаем общее количество
        item.quantity -= quantity;
        
        this.saveInventory();
        document.querySelector('.modal-overlay').remove();
        this.render();
        
        alert(`✅ Списано: ${quantity} ${item.unit}`);
    }

    getWriteOffReasonText(reason) {
        const reasons = {
            'expired': 'Истёк срок годности',
            'damaged': 'Порча/брак',
            'theft': 'Недостача',
            'other': 'Другое'
        };
        return reasons[reason] || reason;
    }

    showItemHistory(itemId) {
        const item = this.inventory.find(i => i.id === itemId);
        if (!item) return;
        
        const itemMovements = this.movements.filter(m => m.itemId === itemId);
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div style="background: white; border-radius: 16px; padding: 2rem; max-width: 800px; width: 90%; max-height: 80vh; overflow-y: auto;">
                <h2 style="margin: 0 0 1.5rem 0; color: var(--dandy-green);">📊 История движения: ${item.name}</h2>
                
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f3f4f6;">
                            <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #e5e7eb;">Дата/Время</th>
                            <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #e5e7eb;">Тип</th>
                            <th style="padding: 0.75rem; text-align: right; border-bottom: 2px solid #e5e7eb;">Количество</th>
                            <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #e5e7eb;">Причина</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemMovements.length === 0 
                            ? '<tr><td colspan="4" style="padding: 2rem; text-align: center; color: #999;">Нет записей</td></tr>'
                            : itemMovements.reverse().map(m => `
                                <tr>
                                    <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">${new Date(m.timestamp).toLocaleString()}</td>
                                    <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">
                                        ${m.type === 'receipt' ? '📦 Приход' : m.type === 'writeoff' ? '🗑️ Списание' : '📤 Продажа'}
                                    </td>
                                    <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600; color: ${m.type === 'receipt' ? '#16a34a' : '#dc2626'};">
                                        ${m.type === 'receipt' ? '+' : '-'}${m.quantity} ${m.unit}
                                    </td>
                                    <td style="padding: 0.75rem; border-bottom: 1px solid #e5e7eb;">${m.reason}</td>
                                </tr>
                            `).join('')
                        }
                    </tbody>
                </table>
                
                <button onclick="this.closest('.modal-overlay').remove()" style="width: 100%; margin-top: 1rem; padding: 1rem; background: #6b7280; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                    Закрыть
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    filterInventory(filter) {
        // Обновляем активную кнопку
        document.querySelectorAll('.inventory-filter').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
        
        this.render(filter);
    }

    exportToExcel() {
        // Простой CSV экспорт
        let csv = 'Название,Категория,Количество,Единица,Мин. остаток,Цена закупки,Статус\n';
        
        this.inventory.forEach(item => {
            const status = item.quantity === 0 ? 'Нет в наличии' : 
                          item.quantity <= item.minStock ? 'Низкий остаток' : 'В наличии';
            csv += `"${item.name}","${item.category}",${item.quantity},"${item.unit}",${item.minStock},${item.purchasePrice},"${status}"\n`;
        });
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `inventory_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        
        alert('✅ Экспортировано в CSV!');
    }

    startAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }
        
        this.autoRefreshInterval = setInterval(() => {
            this.checkNotifications();
            this.render();
        }, this.config.autoRefreshSeconds * 1000);
    }

    render(filter = 'all') {
        const container = document.getElementById('inventoryContent') || document.getElementById('stockContent');
        if (!container) return;
        
        // Фильтруем товары
        let filteredInventory = this.inventory;
        if (filter === 'low') {
            filteredInventory = this.inventory.filter(i => i.quantity > 0 && i.quantity <= i.minStock);
        } else if (filter === 'out') {
            filteredInventory = this.inventory.filter(i => i.quantity === 0);
        } else if (filter === 'expiring') {
            const now = new Date();
            filteredInventory = this.inventory.filter(i => 
                i.batches.some(b => {
                    const daysToExpiry = Math.ceil((new Date(b.expiryDate) - now) / (1000 * 60 * 60 * 24));
                    return daysToExpiry <= this.config.expiryWarningDays && daysToExpiry >= 0;
                })
            );
        }
        
        const totalItems = this.inventory.length;
        const lowStock = this.inventory.filter(i => i.quantity > 0 && i.quantity <= i.minStock).length;
        const outOfStock = this.inventory.filter(i => i.quantity === 0).length;
        const totalValue = this.inventory.reduce((sum, i) => sum + (i.quantity * i.purchasePrice), 0);
        
        container.innerHTML = `
            <div class="inventory-header" style="background: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
                    <div>
                        <h2 style="margin: 0 0 0.5rem 0; color: var(--dandy-green);">📦 Складской учёт</h2>
                        <p style="margin: 0; color: #666;">Управление остатками с контролем сроков годности (FEFO)</p>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button id="addInventoryItem" style="padding: 0.75rem 1.5rem; background: var(--dandy-green); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                            ➕ Добавить товар
                        </button>
                        <button id="exportInventory" style="padding: 0.75rem 1.5rem; background: #2563eb; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                            📊 Экспорт
                        </button>
                    </div>
                </div>
                
                <!-- Статистика -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                    <div style="background: #dbeafe; padding: 1rem; border-radius: 8px;">
                        <div style="font-size: 2rem; font-weight: 700; color: #1e40af;">${totalItems}</div>
                        <div style="color: #1e40af; font-weight: 600;">Всего товаров</div>
                    </div>
                    <div style="background: #fef3c7; padding: 1rem; border-radius: 8px;">
                        <div style="font-size: 2rem; font-weight: 700; color: #92400e;">${lowStock}</div>
                        <div style="color: #92400e; font-weight: 600;">Низкий остаток</div>
                    </div>
                    <div style="background: #fee2e2; padding: 1rem; border-radius: 8px;">
                        <div style="font-size: 2rem; font-weight: 700; color: #991b1b;">${outOfStock}</div>
                        <div style="color: #991b1b; font-weight: 600;">Нет в наличии</div>
                    </div>
                    <div style="background: #d1fae5; padding: 1rem; border-radius: 8px;">
                        <div style="font-size: 1.5rem; font-weight: 700; color: #065f46;">${totalValue.toFixed(0)} ₽</div>
                        <div style="color: #065f46; font-weight: 600;">Стоимость склада</div>
                    </div>
                </div>
                
                <!-- Уведомления -->
                ${this.notifications.length > 0 ? `
                    <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                        <h3 style="margin: 0 0 0.5rem 0; color: #991b1b;">⚠️ Требуют внимания (${this.notifications.length}):</h3>
                        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                            ${this.notifications.slice(0, 5).map(n => `
                                <div style="font-size: 0.9rem; color: #991b1b;">${n.message}</div>
                            `).join('')}
                            ${this.notifications.length > 5 ? `<div style="font-size: 0.9rem; color: #666;">... и ещё ${this.notifications.length - 5}</div>` : ''}
                        </div>
                    </div>
                ` : ''}
                
                <!-- Фильтры -->
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button class="inventory-filter ${filter === 'all' ? 'active' : ''}" data-filter="all"
                            style="padding: 0.5rem 1rem; border: 2px solid var(--dandy-green); border-radius: 8px; background: ${filter === 'all' ? 'var(--dandy-green)' : 'white'}; color: ${filter === 'all' ? 'white' : 'var(--dandy-green)'}; cursor: pointer; font-weight: 600;">
                        Все (${totalItems})
                    </button>
                    <button class="inventory-filter ${filter === 'low' ? 'active' : ''}" data-filter="low"
                            style="padding: 0.5rem 1rem; border: 2px solid #f59e0b; border-radius: 8px; background: ${filter === 'low' ? '#f59e0b' : 'white'}; color: ${filter === 'low' ? 'white' : '#f59e0b'}; cursor: pointer; font-weight: 600;">
                        Низкий остаток (${lowStock})
                    </button>
                    <button class="inventory-filter ${filter === 'out' ? 'active' : ''}" data-filter="out"
                            style="padding: 0.5rem 1rem; border: 2px solid #dc2626; border-radius: 8px; background: ${filter === 'out' ? '#dc2626' : 'white'}; color: ${filter === 'out' ? 'white' : '#dc2626'}; cursor: pointer; font-weight: 600;">
                        Нет в наличии (${outOfStock})
                    </button>
                    <button class="inventory-filter ${filter === 'expiring' ? 'active' : ''}" data-filter="expiring"
                            style="padding: 0.5rem 1rem; border: 2px solid #7c3aed; border-radius: 8px; background: ${filter === 'expiring' ? '#7c3aed' : 'white'}; color: ${filter === 'expiring' ? 'white' : '#7c3aed'}; cursor: pointer; font-weight: 600;">
                        Скоро истекают
                    </button>
                </div>
            </div>
            
            <!-- Таблица товаров -->
            <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: var(--dandy-green); color: white;">
                            <th style="padding: 1rem; text-align: left;">Товар</th>
                            <th style="padding: 1rem; text-align: left;">Категория</th>
                            <th style="padding: 1rem; text-align: right;">Остаток</th>
                            <th style="padding: 1rem; text-align: right;">Мин. остаток</th>
                            <th style="padding: 1rem; text-align: left;">Партии</th>
                            <th style="padding: 1rem; text-align: center;">Статус</th>
                            <th style="padding: 1rem; text-align: center;">Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredInventory.map(item => this.renderInventoryRow(item)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    renderInventoryRow(item) {
        const status = item.quantity === 0 ? { text: 'Нет в наличии', color: '#dc2626' } :
                      item.quantity <= item.minStock ? { text: 'Низкий остаток', color: '#f59e0b' } :
                      { text: 'В наличии', color: '#16a34a' };
        
        const now = new Date();
        const batchesInfo = item.batches.map(b => {
            const daysToExpiry = Math.ceil((new Date(b.expiryDate) - now) / (1000 * 60 * 60 * 24));
            const isExpiring = daysToExpiry <= this.config.expiryWarningDays && daysToExpiry >= 0;
            const isExpired = daysToExpiry < 0;
            
            return `<div style="font-size: 0.85rem; ${isExpired ? 'color: #dc2626; font-weight: 600;' : isExpiring ? 'color: #f59e0b; font-weight: 600;' : ''}">
                ${b.batchId}: ${b.quantity} ${item.unit} (до ${new Date(b.expiryDate).toLocaleDateString()})
            </div>`;
        }).join('');
        
        return `
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 1rem;">
                    <div style="font-weight: 600;">${item.name}</div>
                    <div style="font-size: 0.85rem; color: #666;">Закупка: ${item.purchasePrice} ₽/${item.unit}</div>
                </td>
                <td style="padding: 1rem;">${item.category}</td>
                <td style="padding: 1rem; text-align: right; font-weight: 700; font-size: 1.1rem;" style="color: ${status.color};">
                    ${item.quantity} ${item.unit}
                </td>
                <td style="padding: 1rem; text-align: right; color: #666;">
                    ${item.minStock} ${item.unit}
                </td>
                <td style="padding: 1rem;">
                    ${batchesInfo || '<span style="color: #999;">Нет партий</span>'}
                </td>
                <td style="padding: 1rem; text-align: center;">
                    <span style="display: inline-block; padding: 0.25rem 0.75rem; background: ${status.color}; color: white; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">
                        ${status.text}
                    </span>
                </td>
                <td style="padding: 1rem;">
                    <div style="display: flex; gap: 0.25rem; flex-wrap: wrap; justify-content: center;">
                        <button class="add-stock-btn" data-item-id="${item.id}" 
                                style="padding: 0.4rem 0.75rem; background: #16a34a; color: white; border: none; border-radius: 6px; font-size: 0.85rem; cursor: pointer; white-space: nowrap;">
                            📦 Приход
                        </button>
                        <button class="write-off-btn" data-item-id="${item.id}"
                                style="padding: 0.4rem 0.75rem; background: #dc2626; color: white; border: none; border-radius: 6px; font-size: 0.85rem; cursor: pointer; white-space: nowrap;">
                            🗑️ Списать
                        </button>
                        <button class="history-btn" data-item-id="${item.id}"
                                style="padding: 0.4rem 0.75rem; background: #2563eb; color: white; border: none; border-radius: 6px; font-size: 0.85rem; cursor: pointer;">
                            📊
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    destroy() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }
    }
}

// Глобальный экземпляр
window.inventoryModule = null;

// Инициализация
window.initInventory = function() {
    if (window.inventoryModule) {
        window.inventoryModule.destroy();
    }
    window.inventoryModule = new InventoryModule();
};

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InventoryModule;
}
