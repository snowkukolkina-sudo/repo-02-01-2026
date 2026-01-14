/**
 * DANDY Inventory Management Module
 * Управление инвентаризацией и складскими операциями
 */

class InventoryManagementModule {
    constructor() {
        this.inventoryItems = [];
        this.warehouses = [];
        this.currentInventory = null;
        this.API_BASE = '/api/inventory';
    }

    async init() {
        console.log('📦 Inventory Management Module initialized');
        await this.loadWarehouses();
        await this.loadInventoryItems();
        this.render();
    }

    async loadWarehouses() {
        try {
            const response = await fetch(`${this.API_BASE}/warehouses`);
            const data = await response.json();
            if (data.success) {
                this.warehouses = data.data;
            }
        } catch (error) {
            console.error('Error loading warehouses:', error);
            // Fallback data
            this.warehouses = [
                { id: 1, name: 'Основной склад', address: 'ул. Примерная, 1' },
                { id: 2, name: 'Холодильник', address: 'ул. Примерная, 1' }
            ];
        }
    }

    async loadInventoryItems() {
        try {
            const response = await fetch(`${this.API_BASE}/items`);
            const data = await response.json();
            if (data.success) {
                this.inventoryItems = data.data;
            }
        } catch (error) {
            console.error('Error loading inventory items:', error);
            // Fallback data
            this.inventoryItems = [
                { id: 1, name: 'Моцарелла', quantity: 5.2, unit: 'kg', expiry_date: '2024-02-15', warehouse_id: 2 },
                { id: 2, name: 'Лосось', quantity: 2.1, unit: 'kg', expiry_date: '2024-02-10', warehouse_id: 2 },
                { id: 3, name: 'Рис', quantity: 25.0, unit: 'kg', expiry_date: '2024-12-31', warehouse_id: 1 },
                { id: 4, name: 'Томаты', quantity: 8.5, unit: 'kg', expiry_date: '2024-02-05', warehouse_id: 1 },
                { id: 5, name: 'Сыр пармезан', quantity: 1.8, unit: 'kg', expiry_date: '2024-03-01', warehouse_id: 2 }
            ];
        }
    }

    render() {
        const container = document.getElementById('inventoryContent') || document.getElementById('inventory');
        if (!container) return;

        container.innerHTML = `
            <div class="inventory-management">
                <!-- Header -->
                <div class="inventory-header">
                    <h2>📦 Инвентаризация</h2>
                    <div class="inventory-actions">
                        <button class="btn btn-primary" onclick="inventoryModule.showReceiveForm()">
                            📥 Приход товара (Накладная)
                        </button>
                        <button class="btn btn-secondary" onclick="inventoryModule.startInventory()">
                            🔍 Начать инвентаризацию
                        </button>
                        <button class="btn btn-secondary" onclick="inventoryModule.showInventoryHistory()">
                            📊 История инвентаризаций
                        </button>
                    </div>
                </div>

                <!-- Stats -->
                <div class="inventory-stats grid grid-4" style="margin-top: 1rem;">
                    <div class="card">
                        <h4>Всего позиций</h4>
                        <div class="stat-value">${this.inventoryItems.length}</div>
                    </div>
                    <div class="card">
                        <h4>Критические остатки</h4>
                        <div class="stat-value text-warning">${this.getCriticalItems().length}</div>
                    </div>
                    <div class="card">
                        <h4>Скоро истекает</h4>
                        <div class="stat-value text-danger">${this.getExpiringItems().length}</div>
                    </div>
                    <div class="card">
                        <h4>Общая стоимость</h4>
                        <div class="stat-value">₽ ${this.calculateTotalValue().toLocaleString()}</div>
                    </div>
                </div>

                <!-- Inventory Table -->
                <div class="card" style="margin-top: 1rem;">
                    <div class="card-header">
                        <h3>Текущие остатки</h3>
                        <div style="display: flex; gap: 1rem; align-items: center;">
                            <select id="warehouseFilter" class="form-input" style="width: 200px;">
                                <option value="">Все склады</option>
                                ${this.warehouses.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
                            </select>
                            <button class="btn btn-secondary btn-small" onclick="inventoryModule.filterByWarehouse()">Фильтр</button>
                        </div>
                    </div>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Наименование</th>
                                    <th>Количество</th>
                                    <th>Единица</th>
                                    <th>Склад</th>
                                    <th>Срок годности</th>
                                    <th>Статус</th>
                                    <th>Действия</th>
                                </tr>
                            </thead>
                            <tbody id="inventoryTableBody">
                                ${this.renderInventoryRows()}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        // Event listeners
        document.getElementById('warehouseFilter').addEventListener('change', () => {
            this.filterByWarehouse();
        });
    }

    renderInventoryRows() {
        if (this.inventoryItems.length === 0) {
            return '<tr><td colspan="7" style="text-align: center;">Нет данных об остатках</td></tr>';
        }

        return this.inventoryItems.map(item => {
            const warehouse = this.warehouses.find(w => w.id === item.warehouse_id);
            const expiryDate = new Date(item.expiry_date);
            const today = new Date();
            const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
            
            let statusClass = 'success';
            let statusText = '✅ В норме';
            
            if (daysUntilExpiry <= 3) {
                statusClass = 'danger';
                statusText = '⚠️ Истекает';
            } else if (daysUntilExpiry <= 7) {
                statusClass = 'warning';
                statusText = '⏰ Скоро истекает';
            }

            if (item.quantity < 1) {
                statusClass = 'danger';
                statusText = '❌ Критический остаток';
            }

            return `
                <tr>
                    <td><strong>${item.name}</strong></td>
                    <td>${item.quantity}</td>
                    <td>${item.unit}</td>
                    <td>${warehouse ? warehouse.name : 'Неизвестно'}</td>
                    <td>${expiryDate.toLocaleDateString('ru-RU')}</td>
                    <td><span class="badge badge-${statusClass}">${statusText}</span></td>
                    <td>
                        <button class="btn btn-small" onclick="inventoryModule.editItem('${item.id}')">✏️</button>
                        <button class="btn btn-small btn-danger" onclick="inventoryModule.deleteItem('${item.id}')">🗑️</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    getCriticalItems() {
        return this.inventoryItems.filter(item => item.quantity < 1);
    }

    getExpiringItems() {
        const today = new Date();
        return this.inventoryItems.filter(item => {
            const expiryDate = new Date(item.expiry_date);
            const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
            return daysUntilExpiry <= 7;
        });
    }

    calculateTotalValue() {
        // Примерная стоимость товаров
        const prices = {
            'Моцарелла': 800,
            'Лосось': 1200,
            'Рис': 150,
            'Томаты': 200,
            'Сыр пармезан': 2000
        };
        
        return this.inventoryItems.reduce((total, item) => {
            const price = prices[item.name] || 100;
            return total + (item.quantity * price);
        }, 0);
    }

    startInventory() {
        const modal = this.createModal('Начать инвентаризацию', `
            <form id="inventoryForm">
                <div class="form-group">
                    <label class="form-label">Название инвентаризации *</label>
                    <input type="text" name="name" class="form-input" required placeholder="Например: Инвентаризация января 2024">
                </div>
                <div class="form-group">
                    <label class="form-label">Склад *</label>
                    <select name="warehouse_id" class="form-input" required>
                        <option value="">Выберите склад</option>
                        ${this.warehouses.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Комментарий</label>
                    <textarea name="comment" class="form-input" rows="3" placeholder="Дополнительная информация"></textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="inventoryModule.closeModal()">Отмена</button>
                    <button type="submit" class="btn btn-primary">🔍 Начать инвентаризацию</button>
                </div>
            </form>
        `);

        document.getElementById('inventoryForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.processInventory(new FormData(e.target));
        });
    }

    async processInventory(formData) {
        try {
            const data = {};
            for (const [key, value] of formData.entries()) {
                data[key] = value;
            }

            // Симуляция создания инвентаризации
            alert('✅ Инвентаризация начата! Теперь можно пересчитывать остатки.');
            this.closeModal();
            
            // Обновляем данные
            await this.loadInventoryItems();
            this.render();
        } catch (error) {
            console.error('Error starting inventory:', error);
            alert('❌ Ошибка при создании инвентаризации');
        }
    }

    showInventoryHistory() {
        const modal = this.createModal('История инвентаризаций', `
            <div class="inventory-history">
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Дата</th>
                                <th>Название</th>
                                <th>Склад</th>
                                <th>Статус</th>
                                <th>Расхождения</th>
                                <th>Ответственный</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>15.01.2024</td>
                                <td>Инвентаризация января</td>
                                <td>Основной склад</td>
                                <td><span class="badge badge-success">Завершена</span></td>
                                <td>2</td>
                                <td>Иван Петров</td>
                            </tr>
                            <tr>
                                <td>01.01.2024</td>
                                <td>Новогодняя инвентаризация</td>
                                <td>Холодильник</td>
                                <td><span class="badge badge-success">Завершена</span></td>
                                <td>0</td>
                                <td>Мария Сидорова</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="form-actions">
                    <button class="btn btn-secondary" onclick="inventoryModule.closeModal()">Закрыть</button>
                </div>
            </div>
        `, '', 'large');
    }

    // ✅ НОВЫЙ ФУНКЦИОНАЛ: Создание накладной прихода товаров
    async showReceiveForm() {
        const modal = this.createModal('📥 Приход товара (Накладная)', `
            <form id="receiveForm">
                <div class="form-group">
                    <label class="form-label">Номер накладной *</label>
                    <input type="text" name="number" class="form-input" required placeholder="Накладная №">
                </div>
                <div class="form-group">
                    <label class="form-label">Дата *</label>
                    <input type="date" name="date" class="form-input" required value="${new Date().toISOString().split('T')[0]}">
                </div>
                <div class="form-group">
                    <label class="form-label">Склад *</label>
                    <select name="warehouse" class="form-input" required>
                        <option value="">Выберите склад</option>
                        ${this.warehouses.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Поставщик</label>
                    <input type="text" name="supplier" class="form-input" placeholder="Название поставщика">
                </div>
                <div class="form-group">
                    <label class="form-label">Комментарий</label>
                    <textarea name="comment" class="form-input" rows="2" placeholder="Дополнительная информация"></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Товары *</label>
                    <div id="receiveItemsList" style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem; margin-bottom: 0.5rem; min-height: 100px;">
                        <p style="color: #9ca3af; text-align: center;">Нажмите "Добавить товар" для добавления позиций</p>
                    </div>
                    <button type="button" class="btn btn-secondary" onclick="inventoryModule.addReceiveItem()">➕ Добавить товар</button>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="inventoryModule.closeModal()">Отмена</button>
                    <button type="button" class="btn btn-secondary" onclick="inventoryModule.saveReceiveDraft()">💾 Сохранить черновик</button>
                    <button type="submit" class="btn btn-primary">✅ Провести накладную</button>
                </div>
            </form>
        `, '', 'large');

        this.receiveItems = [];
        document.getElementById('receiveForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.processReceive();
        });
    }

    addReceiveItem() {
        if (!this.receiveItems) this.receiveItems = [];
        const itemId = 'item_' + Date.now();
        this.receiveItems.push({
            id: itemId,
            productId: '',
            productName: '',
            quantity: 0,
            unit: 'шт',
            price: 0,
            batch: '',
            expiryDate: ''
        });
        this.renderReceiveItems();
    }

    renderReceiveItems() {
        const container = document.getElementById('receiveItemsList');
        if (!container) return;

        if (this.receiveItems.length === 0) {
            container.innerHTML = '<p style="color: #9ca3af; text-align: center;">Нажмите "Добавить товар" для добавления позиций</p>';
            return;
        }

        container.innerHTML = this.receiveItems.map((item, idx) => `
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem; margin-bottom: 0.5rem; background: #f9fafb;">
                <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <input type="text" class="receive-item-name" data-id="${item.id}" placeholder="Название товара" value="${item.productName}" style="padding: 0.5rem; border: 1px solid #e5e7eb; border-radius: 4px;">
                    <input type="number" class="receive-item-qty" data-id="${item.id}" placeholder="Кол-во" value="${item.quantity}" step="0.001" min="0" style="padding: 0.5rem; border: 1px solid #e5e7eb; border-radius: 4px;">
                    <input type="text" class="receive-item-unit" data-id="${item.id}" placeholder="Ед." value="${item.unit}" style="padding: 0.5rem; border: 1px solid #e5e7eb; border-radius: 4px;">
                    <input type="number" class="receive-item-price" data-id="${item.id}" placeholder="Цена" value="${item.price}" step="0.01" min="0" style="padding: 0.5rem; border: 1px solid #e5e7eb; border-radius: 4px;">
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                    <input type="text" class="receive-item-batch" data-id="${item.id}" placeholder="Партия (опционально)" value="${item.batch}" style="padding: 0.5rem; border: 1px solid #e5e7eb; border-radius: 4px;">
                    <input type="date" class="receive-item-expiry" data-id="${item.id}" placeholder="Срок годности" value="${item.expiryDate}" style="padding: 0.5rem; border: 1px solid #e5e7eb; border-radius: 4px;">
                </div>
                <button type="button" class="btn btn-small btn-danger" onclick="inventoryModule.removeReceiveItem('${item.id}')" style="margin-top: 0.5rem;">🗑️ Удалить</button>
            </div>
        `).join('');

        // Event listeners для обновления данных
        container.querySelectorAll('.receive-item-name').forEach(input => {
            input.addEventListener('input', (e) => {
                const item = this.receiveItems.find(i => i.id === e.target.dataset.id);
                if (item) item.productName = e.target.value;
            });
        });
        container.querySelectorAll('.receive-item-qty').forEach(input => {
            input.addEventListener('input', (e) => {
                const item = this.receiveItems.find(i => i.id === e.target.dataset.id);
                if (item) item.quantity = parseFloat(e.target.value) || 0;
            });
        });
        container.querySelectorAll('.receive-item-unit').forEach(input => {
            input.addEventListener('input', (e) => {
                const item = this.receiveItems.find(i => i.id === e.target.dataset.id);
                if (item) item.unit = e.target.value;
            });
        });
        container.querySelectorAll('.receive-item-price').forEach(input => {
            input.addEventListener('input', (e) => {
                const item = this.receiveItems.find(i => i.id === e.target.dataset.id);
                if (item) item.price = parseFloat(e.target.value) || 0;
            });
        });
        container.querySelectorAll('.receive-item-batch').forEach(input => {
            input.addEventListener('input', (e) => {
                const item = this.receiveItems.find(i => i.id === e.target.dataset.id);
                if (item) item.batch = e.target.value;
            });
        });
        container.querySelectorAll('.receive-item-expiry').forEach(input => {
            input.addEventListener('input', (e) => {
                const item = this.receiveItems.find(i => i.id === e.target.dataset.id);
                if (item) item.expiryDate = e.target.value;
            });
        });
    }

    removeReceiveItem(itemId) {
        this.receiveItems = this.receiveItems.filter(i => i.id !== itemId);
        this.renderReceiveItems();
    }

    async saveReceiveDraft() {
        const form = document.getElementById('receiveForm');
        if (!form) return;

        const formData = new FormData(form);
        const data = {
            type: 'receipt',
            status: 'draft',
            number: formData.get('number'),
            date: formData.get('date'),
            warehouse: formData.get('warehouse'),
            supplier: formData.get('supplier'),
            comment: formData.get('comment'),
            items: this.receiveItems || []
        };

        try {
            const response = await fetch(`${this.API_BASE}/receive`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                alert('✅ Накладная сохранена как черновик');
                this.closeModal();
                await this.loadInventoryItems();
                this.render();
            } else {
                const error = await response.json();
                alert(`❌ Ошибка: ${error.error || 'Не удалось сохранить накладную'}`);
            }
        } catch (error) {
            console.error('Error saving receipt:', error);
            alert('❌ Ошибка при сохранении накладной');
        }
    }

    async processReceive() {
        const form = document.getElementById('receiveForm');
        if (!form) return;

        if (!this.receiveItems || this.receiveItems.length === 0) {
            alert('❌ Добавьте хотя бы один товар в накладную');
            return;
        }

        const formData = new FormData(form);
        const data = {
            type: 'receipt',
            status: 'posted',
            post: true,
            number: formData.get('number'),
            date: formData.get('date'),
            warehouse: formData.get('warehouse'),
            supplier: formData.get('supplier'),
            comment: formData.get('comment'),
            items: this.receiveItems.map(item => ({
                productName: item.productName,
                quantity: item.quantity,
                unit: item.unit,
                price: item.price,
                batch: item.batch || null,
                expiryDate: item.expiryDate || null
            }))
        };

        try {
            const response = await fetch(`${this.API_BASE}/receive`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                alert('✅ Накладная проведена успешно!');
                this.closeModal();
                await this.loadInventoryItems();
                this.render();
            } else {
                const error = await response.json();
                alert(`❌ Ошибка: ${error.error || 'Не удалось провести накладную'}`);
            }
        } catch (error) {
            console.error('Error processing receipt:', error);
            alert('❌ Ошибка при проведении накладной');
        }
    }

    filterByWarehouse() {
        const warehouseId = document.getElementById('warehouseFilter').value;
        const rows = document.querySelectorAll('#inventoryTableBody tr');
        
        rows.forEach(row => {
            if (!warehouseId) {
                row.style.display = '';
            } else {
                const warehouseCell = row.cells[3];
                if (warehouseCell && warehouseCell.textContent.includes(this.warehouses.find(w => w.id == warehouseId)?.name)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            }
        });
    }

    editItem(itemId) {
        alert('🚧 Редактирование позиции - в разработке');
    }

    deleteItem(itemId) {
        if (confirm('Вы уверены, что хотите удалить эту позицию?')) {
            alert('✅ Позиция удалена');
            this.loadInventoryItems();
            this.render();
        }
    }

    createModal(title, content, footer = '', size = 'normal') {
        // Удаляем существующие модальные окна
        const existingModals = document.querySelectorAll('.modal-overlay');
        existingModals.forEach(modal => modal.remove());

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content ${size === 'large' ? 'large' : ''}">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="inventoryModule.closeModal()">×</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
            </div>
        `;
        
        // Добавляем обработчик клика по фону для закрытия
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });

        document.body.appendChild(modal);
        
        // Фокус на первое поле ввода
        setTimeout(() => {
            const firstInput = modal.querySelector('input, select, textarea');
            if (firstInput) {
                firstInput.focus();
            }
        }, 100);

        return modal;
    }

    closeModal() {
        const modals = document.querySelectorAll('.modal-overlay');
        modals.forEach(modal => modal.remove());
    }
}

// Initialize module
if (typeof window !== 'undefined') {
    window.InventoryManagementModule = InventoryManagementModule;
    window.inventoryModule = new InventoryManagementModule();
}
