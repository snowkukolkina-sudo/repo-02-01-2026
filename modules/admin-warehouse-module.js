/**
 * DANDY Warehouse Management Module
 * Управление складом, приход/списание товаров, инвентаризация
 */

class WarehouseManagementModule {
    constructor() {
        this.warehouses = [];
        this.inventory = [];
        this.expiringItems = [];
        this.currentWarehouse = null;
        this.API_BASE = '/api/inventory';
    }

    async init() {
        console.log('📦 Warehouse Management Module initialized');
        await this.loadWarehouses();
        await this.loadInventory();
        this.render();
    }

    async loadWarehouses() {
        try {
            const response = await fetch(`${this.API_BASE}/warehouses`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            if (data.success) {
                this.warehouses = data.data;
                if (!this.currentWarehouse && this.warehouses.length > 0) {
                    this.currentWarehouse = this.warehouses[0].id;
                }
            }
        } catch (error) {
            console.error('Error loading warehouses:', error);
        }
    }

    async loadInventory() {
        try {
            const url = this.currentWarehouse 
                ? `${this.API_BASE}/items?warehouse_id=${this.currentWarehouse}`
                : `${this.API_BASE}/items`;
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            if (data.success) {
                this.inventory = data.data;
            }
        } catch (error) {
            console.error('Error loading inventory:', error);
        }
    }

    async loadExpiringItems(days = 7) {
        try {
            const url = this.currentWarehouse
                ? `${this.API_BASE}/expiring?days=${days}&warehouse_id=${this.currentWarehouse}`
                : `${this.API_BASE}/expiring?days=${days}`;
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            if (data.success) {
                this.expiringItems = data.data;
            }
        } catch (error) {
            console.error('Error loading expiring items:', error);
        }
    }

    render() {
        const container = document.getElementById('stock');
        if (!container) return;

        container.innerHTML = `
            <div class="warehouse-management">
                <!-- Header -->
                <div class="warehouse-header">
                    <h2>📦 Управление складом</h2>
                    <div class="warehouse-actions">
                        <select id="warehouseSelect" class="form-input">
                            <option value="">Все склады</option>
                            ${this.warehouses.map(w => `
                                <option value="${w.id}" ${this.currentWarehouse === w.id ? 'selected' : ''}>
                                    ${w.name}
                                </option>
                            `).join('')}
                        </select>
                        <button class="btn btn-primary" onclick="warehouseModule.showReceiveForm()">
                            📥 Приход товара
                        </button>
                        <button class="btn btn-secondary" onclick="warehouseModule.showWriteoffForm()">
                            📤 Списание
                        </button>
                        <button class="btn btn-secondary" onclick="warehouseModule.showTransferForm()">
                            🔄 Перемещение
                        </button>
                        <button class="btn btn-secondary" onclick="warehouseModule.showInventoryCheck()">
                            📋 Инвентаризация
                        </button>
                        <button class="btn btn-secondary" onclick="warehouseModule.showVirtualStock()">
                            🍕 Вирт. остаток (43)
                        </button>
                    </div>
                </div>

                <!-- Stats -->
                <div class="warehouse-stats grid grid-4" style="margin-top: 1rem;">
                    <div class="card">
                        <h4>Всего позиций</h4>
                        <div class="stat-value">${this.inventory.length}</div>
                    </div>
                    <div class="card">
                        <h4>Критический остаток</h4>
                        <div class="stat-value text-danger">${this.inventory.filter(i => i.quantity <= (i.min_stock || 0)).length}</div>
                    </div>
                    <div class="card">
                        <h4>Истекающие (7 дней)</h4>
                        <div class="stat-value text-warning" id="expiringCount">-</div>
                    </div>
                    <div class="card">
                        <h4>Общая стоимость</h4>
                        <div class="stat-value">₽ ${this.calculateTotalValue().toLocaleString()}</div>
                    </div>
                </div>

                <!-- Inventory Table -->
                <div class="card" style="margin-top: 1rem;">
                    <div class="card-header">
                        <h3>Остатки на складе</h3>
                        <div class="search-box">
                            <input type="text" id="inventorySearch" placeholder="🔍 Поиск товаров..." class="form-input">
                        </div>
                    </div>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>SKU</th>
                                    <th>Наименование</th>
                                    <th>Склад</th>
                                    <th>Партия</th>
                                    <th>Количество</th>
                                    <th>Срок годности</th>
                                    <th>Цена закупки</th>
                                    <th>Сумма</th>
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

                <!-- Expiring Items Alert -->
                <div id="expiringAlert" style="margin-top: 1rem;"></div>
            </div>
        `;

        // Event listeners
        document.getElementById('warehouseSelect').addEventListener('change', (e) => {
            this.currentWarehouse = e.target.value || null;
            this.loadInventory();
            setTimeout(() => this.render(), 100);
        });

        document.getElementById('inventorySearch').addEventListener('input', (e) => {
            this.filterInventory(e.target.value);
        });

        // Load expiring items
        this.loadExpiringItems().then(() => {
            document.getElementById('expiringCount').textContent = this.expiringItems.total_items || 0;
            if (this.expiringItems.urgent > 0) {
                this.showExpiringAlert();
            }
        });
    }

    renderInventoryRows() {
        if (this.inventory.length === 0) {
            return '<tr><td colspan="10" style="text-align: center;">Нет данных</td></tr>';
        }

        return this.inventory.map(item => {
            const daysUntilExpiry = this.calculateDaysUntilExpiry(item.expiry_date);
            const statusClass = this.getStatusClass(daysUntilExpiry, item.quantity, item.min_stock);
            const statusText = this.getStatusText(daysUntilExpiry, item.quantity, item.min_stock);
            
            // Безопасное получение значений с проверкой на undefined/NaN
            const productSku = item.product_sku || item.sku || '—';
            const productName = item.product_name || item.name || 'Товар не найден';
            const warehouseName = item.warehouse_name || item.warehouse || '—';
            const batchNumber = item.batch_number || item.batch || '—';
            const quantity = parseFloat(item.quantity) || 0;
            const unit = item.unit || 'шт';
            const purchasePrice = parseFloat(item.purchase_price) || parseFloat(item.price) || 0;
            const totalAmount = quantity * purchasePrice;
            const expiryDate = item.expiry_date ? this.formatDate(item.expiry_date) : '—';
            const expiryDays = item.expiry_date ? `(${daysUntilExpiry} дн.)` : '';

            return `
                <tr class="${statusClass}">
                    <td>${productSku}</td>
                    <td><strong>${productName}</strong></td>
                    <td>${warehouseName}</td>
                    <td>${batchNumber}</td>
                    <td>${quantity} ${unit}</td>
                    <td>${expiryDate} ${expiryDays ? `<span class="text-muted">${expiryDays}</span>` : ''}</td>
                    <td>₽ ${isNaN(purchasePrice) ? '0.00' : purchasePrice.toFixed(2)}</td>
                    <td>₽ ${isNaN(totalAmount) ? '0.00' : totalAmount.toFixed(2)}</td>
                    <td><span class="badge badge-${statusClass}">${statusText}</span></td>
                    <td>
                        <button class="btn btn-small" onclick="warehouseModule.showItemDetails('${item.id}')">👁️</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    calculateDaysUntilExpiry(expiryDate) {
        const today = new Date();
        const expiry = new Date(expiryDate);
        const diff = expiry - today;
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }

    getStatusClass(daysUntilExpiry, quantity, minStock) {
        if (daysUntilExpiry <= 3) return 'danger';
        if (daysUntilExpiry <= 7) return 'warning';
        if (quantity <= minStock) return 'info';
        return 'normal';
    }

    getStatusText(daysUntilExpiry, quantity, minStock) {
        if (daysUntilExpiry <= 3) return '🔴 Истекает!';
        if (daysUntilExpiry <= 7) return '🟡 Скоро истечёт';
        if (quantity <= minStock) return '🔵 Мало';
        return '🟢 Норма';
    }

    calculateTotalValue() {
        return this.inventory.reduce((sum, item) => {
            return sum + (item.quantity * item.purchase_price);
        }, 0);
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU');
    }

    filterInventory(searchTerm) {
        const tbody = document.getElementById('inventoryTableBody');
        const rows = tbody.querySelectorAll('tr');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            if (text.includes(searchTerm.toLowerCase())) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    showExpiringAlert() {
        const alert = document.getElementById('expiringAlert');
        if (!alert) return;

        const urgent = this.expiringItems.categories?.urgent || [];
        const warning = this.expiringItems.categories?.warning || [];

        alert.innerHTML = `
            <div class="alert alert-danger">
                <h4>⚠️ Внимание! Истекающие товары</h4>
                ${urgent.length > 0 ? `
                    <div style="margin-top: 0.5rem;">
                        <strong>🔴 Критично (<=3 дня):</strong> ${urgent.length} позиций
                        <ul>
                            ${urgent.slice(0, 5).map(item => `
                                <li>${item.product_name} - ${item.batch_number} - ${item.days_until_expiry} дн.</li>
                            `).join('')}
                            ${urgent.length > 5 ? `<li>... и ещё ${urgent.length - 5}</li>` : ''}
                        </ul>
                    </div>
                ` : ''}
                ${warning.length > 0 ? `
                    <div style="margin-top: 0.5rem;">
                        <strong>🟡 Предупреждение (4-7 дней):</strong> ${warning.length} позиций
                    </div>
                ` : ''}
                <button class="btn btn-primary btn-small" onclick="warehouseModule.showAllExpiring()">
                    Посмотреть все
                </button>
            </div>
        `;
    }

    // ==================== FORMS ====================

    showReceiveForm() {
        const modal = this.createModal('Приход товара', `
            <form id="receiveForm">
                <div class="form-group">
                    <label class="form-label">Склад *</label>
                    <select name="warehouse_id" class="form-input" required>
                        ${this.warehouses.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Товар *</label>
                    <select name="product_id" class="form-input" required>
                        <option value="">Выберите товар...</option>
                        <!-- Products will be loaded dynamically -->
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Номер партии *</label>
                    <input type="text" name="batch_number" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Количество *</label>
                    <input type="number" name="quantity" class="form-input" step="0.001" min="0.001" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Единица измерения</label>
                    <select name="unit" class="form-input">
                        <option value="kg">кг</option>
                        <option value="pcs">шт</option>
                        <option value="l">л</option>
                        <option value="box">коробка</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Дата производства</label>
                    <input type="date" name="production_date" class="form-input">
                </div>
                <div class="form-group">
                    <label class="form-label">Срок годности *</label>
                    <input type="date" name="expiry_date" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Цена закупки *</label>
                    <input type="number" name="purchase_price" class="form-input" step="0.01" min="0" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Поставщик</label>
                    <input type="text" name="supplier" class="form-input">
                </div>
                <div class="form-group">
                    <label class="form-label">Номер накладной</label>
                    <input type="text" name="supplier_invoice" class="form-input">
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="warehouseModule.closeModal()">Отмена</button>
                    <button type="submit" class="btn btn-primary">💾 Сохранить</button>
                </div>
            </form>
        `);

        // Load products for dropdown
        this.loadProductsDropdown();

        document.getElementById('receiveForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitReceive(new FormData(e.target));
        });
    }

    async submitReceive(formData) {
        try {
            const data = Object.fromEntries(formData);
            
            const response = await fetch(`${this.API_BASE}/receive`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (result.success) {
                alert('✅ Товар успешно принят на склад!');
                this.closeModal();
                this.loadInventory();
                setTimeout(() => this.render(), 100);
            } else {
                alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
            }
        } catch (error) {
            console.error('Error submitting receive:', error);
            alert('❌ Ошибка соединения с сервером');
        }
    }

    showWriteoffForm() {
        const modal = this.createModal('Списание товара', `
            <form id="writeoffForm">
                <div class="form-group">
                    <label class="form-label">Склад *</label>
                    <select name="warehouse_id" class="form-input" required>
                        ${this.warehouses.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Товар *</label>
                    <select name="product_id" class="form-input" required>
                        <option value="">Выберите товар...</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Количество *</label>
                    <input type="number" name="quantity" class="form-input" step="0.001" min="0.001" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Причина списания *</label>
                    <select name="reason" class="form-input" required>
                        <option value="sale">Продажа</option>
                        <option value="damage">Брак</option>
                        <option value="expiry">Истёк срок годности</option>
                        <option value="loss">Утеря</option>
                        <option value="production">Производство</option>
                        <option value="other">Прочее</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Примечание</label>
                    <textarea name="notes" class="form-input" rows="3"></textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="warehouseModule.closeModal()">Отмена</button>
                    <button type="submit" class="btn btn-danger">📤 Списать</button>
                </div>
            </form>
        `);

        this.loadProductsDropdown();

        document.getElementById('writeoffForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitWriteoff(new FormData(e.target));
        });
    }

    async submitWriteoff(formData) {
        try {
            const data = Object.fromEntries(formData);
            
            if (!confirm(`Вы уверены, что хотите списать ${data.quantity} единиц товара?`)) {
                return;
            }

            const response = await fetch(`${this.API_BASE}/writeoff`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (result.success) {
                alert('✅ Товар успешно списан!');
                this.closeModal();
                this.loadInventory();
                setTimeout(() => this.render(), 100);
            } else {
                alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
            }
        } catch (error) {
            console.error('Error submitting writeoff:', error);
            alert('❌ Ошибка соединения с сервером');
        }
    }

    showTransferForm() {
        const modal = this.createModal('Перемещение товара', `
            <form id="transferForm">
                <div class="form-group">
                    <label class="form-label">Откуда (склад) *</label>
                    <select name="from_warehouse_id" class="form-input" required>
                        ${this.warehouses.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Куда (склад) *</label>
                    <select name="to_warehouse_id" class="form-input" required>
                        ${this.warehouses.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Товар *</label>
                    <select name="product_id" class="form-input" required>
                        <option value="">Выберите товар...</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Количество *</label>
                    <input type="number" name="quantity" class="form-input" step="0.001" min="0.001" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Примечание</label>
                    <textarea name="notes" class="form-input" rows="2"></textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="warehouseModule.closeModal()">Отмена</button>
                    <button type="submit" class="btn btn-primary">🔄 Переместить</button>
                </div>
            </form>
        `);

        this.loadProductsDropdown();

        document.getElementById('transferForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitTransfer(new FormData(e.target));
        });
    }

    async submitTransfer(formData) {
        try {
            const data = Object.fromEntries(formData);
            
            if (data.from_warehouse_id === data.to_warehouse_id) {
                alert('❌ Склады должны быть разными!');
                return;
            }

            const response = await fetch(`${this.API_BASE}/transfer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (result.success) {
                alert('✅ Товар успешно перемещён!');
                this.closeModal();
                this.loadInventory();
                setTimeout(() => this.render(), 100);
            } else {
                alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
            }
        } catch (error) {
            console.error('Error submitting transfer:', error);
            alert('❌ Ошибка соединения с сервером');
        }
    }

    showInventoryCheck() {
        alert('📋 Функция инвентаризации в разработке');
        // TODO: Implement full inventory check interface
    }

    async showVirtualStock() {
        const defaultWarehouseId = this.currentWarehouse ? this.currentWarehouse : 2;
        const modal = this.createModal('Виртуальный остаток блюд (счёт 43)', `
            <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px;">
                <div class="form-group" style="margin:0;">
                    <label class="form-label">Склад</label>
                    <select id="virtualStockWarehouse" class="form-input">
                        ${this.warehouses.map(w => `<option value="${w.id}" ${String(w.id) === String(defaultWarehouseId) ? 'selected' : ''}>${w.name}</option>`).join('')}
                    </select>
                </div>
                <button class="btn btn-secondary" id="virtualStockRefresh">Обновить</button>
            </div>
            <div id="virtualStockStatus" style="margin-bottom:10px;"></div>
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Блюдо</th>
                            <th>Доступно</th>
                            <th>Лимитирует</th>
                        </tr>
                    </thead>
                    <tbody id="virtualStockTableBody">
                        <tr><td colspan="3" style="text-align:center;">Загрузка...</td></tr>
                    </tbody>
                </table>
            </div>
        `);

        const statusEl = modal.querySelector('#virtualStockStatus');
        const tbody = modal.querySelector('#virtualStockTableBody');
        const whSelect = modal.querySelector('#virtualStockWarehouse');
        const btnRefresh = modal.querySelector('#virtualStockRefresh');

        const fetchProductsMap = async () => {
            try {
                const response = await fetch('/api/products', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                const data = await response.json().catch(() => null);
                const list = data && data.success && Array.isArray(data.data) ? data.data : [];
                const map = new Map();
                list.forEach(p => {
                    if (!p) return;
                    const id = p.id;
                    if (id === null || id === undefined) return;
                    map.set(String(id), p.name || p.product_name || p.title || String(id));
                });
                return map;
            } catch (e) {
                return new Map();
            }
        };

        const renderRows = (rows, productsMap) => {
            if (!Array.isArray(rows) || rows.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Нет данных</td></tr>';
                return;
            }

            const sorted = rows.slice().sort((a, b) => {
                const av = Number(a && a.virtual_available !== undefined ? a.virtual_available : 0);
                const bv = Number(b && b.virtual_available !== undefined ? b.virtual_available : 0);
                return av - bv;
            });

            tbody.innerHTML = sorted.map(r => {
                const dishName = (r && r.dish_name) ? r.dish_name : ('ID ' + (r && r.dish_product_id ? r.dish_product_id : ''));
                const available = r && r.virtual_available !== undefined ? r.virtual_available : 0;
                const limits = Array.isArray(r && r.limits) ? r.limits : [];
                let limitingText = '-';
                if (limits.length) {
                    const minPossible = Math.min.apply(null, limits.map(x => Number(x.possible || 0)));
                    const limiting = limits.filter(x => Number(x.possible || 0) === minPossible);
                    limitingText = limiting.map(x => {
                        const pid = x.ingredient_product_id !== undefined ? String(x.ingredient_product_id) : '';
                        const nm = productsMap.get(pid) || ('ID ' + pid);
                        const req = x.required_qty !== undefined ? x.required_qty : '';
                        const unit = x.required_unit || '';
                        const availBase = x.available_base !== undefined ? x.available_base : '';
                        const baseType = x.base_type || '';
                        return `${nm} (норма ${req} ${unit}; доступно ${availBase} ${baseType})`;
                    }).join('<br>');
                }

                return `
                    <tr>
                        <td><strong>${dishName}</strong></td>
                        <td>${available}</td>
                        <td>${limitingText}</td>
                    </tr>
                `;
            }).join('');
        };

        const load = async () => {
            const wh = whSelect && whSelect.value ? whSelect.value : defaultWarehouseId;
            statusEl.innerHTML = '<span class="badge badge-warning">Загрузка...</span>';
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Загрузка...</td></tr>';
            try {
                const [productsMap, resp] = await Promise.all([
                    fetchProductsMap(),
                    fetch(`${this.API_BASE}/virtual-stock?warehouseId=${encodeURIComponent(wh)}`)
                ]);
                const data = await resp.json().catch(() => null);
                if (!resp.ok || !data || !data.ok) {
                    throw new Error((data && (data.error || data.message)) ? (data.error || data.message) : `HTTP ${resp.status}`);
                }
                const rows = Array.isArray(data.data) ? data.data : [];
                statusEl.innerHTML = `<span class="badge badge-success">OK</span> <span class="badge badge-secondary">Блюд: ${rows.length}</span>`;
                renderRows(rows, productsMap);
            } catch (e) {
                statusEl.innerHTML = `<span class="badge badge-danger">Ошибка</span> ${String(e && e.message ? e.message : e)}`;
                tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Не удалось загрузить</td></tr>';
            }
        };

        if (btnRefresh) {
            btnRefresh.addEventListener('click', (e) => {
                e.preventDefault();
                load();
            });
        }
        if (whSelect) {
            whSelect.addEventListener('change', () => load());
        }

        await load();
    }

    showAllExpiring() {
        alert('🔍 Просмотр всех истекающих товаров в разработке');
        // TODO: Implement expiring items detailed view
    }

    showItemDetails(itemId) {
        const item = this.inventory.find(i => i.id === itemId);
        if (!item) return;

        this.createModal('Детали товара', `
            <div class="item-details">
                <p><strong>SKU:</strong> ${item.product_sku || '-'}</p>
                <p><strong>Наименование:</strong> ${item.product_name}</p>
                <p><strong>Склад:</strong> ${item.warehouse_name}</p>
                <p><strong>Партия:</strong> ${item.batch_number}</p>
                <p><strong>Количество:</strong> ${item.quantity} ${item.unit}</p>
                <p><strong>Срок годности:</strong> ${this.formatDate(item.expiry_date)}</p>
                <p><strong>Цена закупки:</strong> ₽ ${item.purchase_price}</p>
                <p><strong>Поставщик:</strong> ${item.supplier || '-'}</p>
                <p><strong>Накладная:</strong> ${item.supplier_invoice || '-'}</p>
            </div>
        `);
    }

    // ==================== HELPERS ====================

    async loadProductsDropdown() {
        try {
            const response = await fetch('/api/products', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            if (data.success) {
                const selects = document.querySelectorAll('select[name="product_id"]');
                selects.forEach(select => {
                    select.innerHTML = '<option value="">Выберите товар...</option>' +
                        data.data.map(p => `<option value="${p.id}">${p.name} (${p.sku})</option>`).join('');
                });
            }
        } catch (error) {
            console.error('Error loading products:', error);
        }
    }

    createModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="warehouseModule.closeModal()">×</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }

    closeModal() {
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            modal.remove();
        }
    }
}

// Initialize module
if (typeof window !== 'undefined') {
    window.WarehouseManagementModule = WarehouseManagementModule;
    window.warehouseModule = new WarehouseManagementModule();
}

