/**
 * DANDY Cashier Report Module
 * Модуль отчёта кассира с разделением по источникам и расходам
 */

class CashierReportModule {
    constructor() {
        this.currentShift = null;
        this.report = null;
        this.shiftOrders = [];
        this.expenses = [];
        this.shiftsHistory = [];
        this.API_BASE = '/api/cashier-report';
    }

    async init() {
        console.log('💰 Cashier Report Module initialized');
        await this.loadCurrentShift();
        this.render();
    }

    async loadCurrentShift() {
        try {
            const response = await fetch(`${this.API_BASE}/shift/current`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            if (data.success) {
                this.currentShift = data.data?.shift || null;
                this.report = data.data?.report || null;
                this.shiftOrders = Array.isArray(data.data?.orders) ? data.data.orders : [];
            }
        } catch (error) {
            console.error('Error loading current shift:', error);
        }
    }

    formatSizeLabel(size) {
        if (!size && size !== 0) return '';
        const raw = String(size).trim();
        if (!raw) return '';
        return raw.toLowerCase().includes('см') ? raw : `${raw} см`;
    }

    buildOrderItemLabel(item) {
        const name = String(item?.name || '').trim();
        const size = this.formatSizeLabel(item?.size);
        return size ? `${name} (${size})` : name;
    }

    render() {
        const container = document.getElementById('cashier-report');
        if (!container) return;

        container.innerHTML = `
            <div class="cashier-report-management">
                <!-- Header -->
                <div class="report-header">
                    <h2>💰 Отчёт кассира</h2>
                    <div class="shift-controls">
                        ${this.currentShift ? `
                            <button class="btn btn-warning" onclick="cashierReportModule.showXReport()">📄 X-отчёт</button>
                            <button class="btn btn-danger" onclick="cashierReportModule.showCloseShift()">🔒 Закрыть смену</button>
                        ` : `
                            <button class="btn btn-success" onclick="cashierReportModule.showOpenShift()">🔓 Открыть смену</button>
                        `}
                        <button class="btn btn-secondary" onclick="cashierReportModule.showShiftsHistory()">📊 История смен</button>
                    </div>
                </div>

                ${this.currentShift ? this.renderCurrentShift() : this.renderNoShift()}
            </div>
        `;
    }

    renderNoShift() {
        return `
            <div class="card text-center" style="margin-top: 2rem; padding: 3rem;">
                <h3>🔒 Смена закрыта</h3>
                <p style="margin: 1rem 0;">Откройте смену, чтобы начать работу</p>
                <button class="btn btn-success btn-large" onclick="cashierReportModule.showOpenShift()">
                    🔓 Открыть смену
                </button>
            </div>
        `;
    }

    renderCurrentShift() {
        if (!this.report) return '';

        const shiftDuration = this.calculateShiftDuration();

        return `
            <!-- Shift Info -->
            <div class="card" style="margin-top: 1rem;">
                <div class="card-header">
                    <h3>📅 Текущая смена</h3>
                </div>
                <div class="grid grid-4">
                    <div class="info-block">
                        <p class="info-label">Открыта:</p>
                        <p class="info-value">${new Date(this.currentShift.opened_at).toLocaleString('ru-RU')}</p>
                    </div>
                    <div class="info-block">
                        <p class="info-label">Длительность:</p>
                        <p class="info-value">${shiftDuration}</p>
                    </div>
                    <div class="info-block">
                        <p class="info-label">Начальная касса:</p>
                        <p class="info-value">₽ ${this.currentShift.cash_initial.toFixed(2)}</p>
                    </div>
                    <div class="info-block">
                        <p class="info-label">Заказов:</p>
                        <p class="info-value text-success">${this.report.total_orders}</p>
                    </div>
                </div>
            </div>

            <!-- Income by Source -->
            <div class="card" style="margin-top: 1rem;">
                <div class="card-header">
                    <h3>💵 Поступления по источникам</h3>
                    <div class="stats-total">Всего: ₽ ${this.report.total_sales.toLocaleString()}</div>
                </div>
                <div class="income-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
                    
                    <!-- Cash at Store -->
                    <div class="income-card card">
                        <div class="income-icon">💵</div>
                        <h4>Наличные (касса)</h4>
                        <div class="income-amount">₽ ${this.report.income_by_source.cash_at_store.toFixed(2)}</div>
                        <div class="income-count">${this.report.income_by_source.cash_at_store_orders || 0} заказов</div>
                    </div>

                    <!-- Cash at Courier -->
                    <div class="income-card card">
                        <div class="income-icon">🚚💵</div>
                        <h4>Наличные (курьер)</h4>
                        <div class="income-amount">₽ ${this.report.income_by_source.cash_at_courier.toFixed(2)}</div>
                        <div class="income-count">${this.report.income_by_source.cash_at_courier_orders || 0} заказов</div>
                    </div>

                    <!-- Card at Store -->
                    <div class="income-card card">
                        <div class="income-icon">💳</div>
                        <h4>Эквайринг (касса)</h4>
                        <div class="income-amount">₽ ${this.report.income_by_source.card_at_store.toFixed(2)}</div>
                        <div class="income-count">${this.report.income_by_source.card_at_store_orders || 0} заказов</div>
                    </div>

                    <!-- Card at Courier -->
                    <div class="income-card card">
                        <div class="income-icon">🚚💳</div>
                        <h4>Эквайринг (курьер)</h4>
                        <div class="income-amount">₽ ${this.report.income_by_source.card_at_courier.toFixed(2)}</div>
                        <div class="income-count">${this.report.income_by_source.card_at_courier_orders || 0} заказов</div>
                    </div>

                    <!-- Yandex.Eda -->
                    <div class="income-card card">
                        <div class="income-icon">🟡</div>
                        <h4>Яндекс.Еда</h4>
                        <div class="income-amount">₽ ${this.report.income_by_source.yandex_eda.toFixed(2)}</div>
                        <div class="income-count">${this.report.income_by_source.yandex_eda_orders || 0} заказов</div>
                    </div>

                    <!-- VkusVill -->
                    <div class="income-card card">
                        <div class="income-icon">🟢</div>
                        <h4>ВкусВилл</h4>
                        <div class="income-amount">₽ ${this.report.income_by_source.vkusvill.toFixed(2)}</div>
                        <div class="income-count">${this.report.income_by_source.vkusvill_orders || 0} заказов</div>
                    </div>

                    <!-- Delivery Club -->
                    <div class="income-card card">
                        <div class="income-icon">🔴</div>
                        <h4>Delivery Club</h4>
                        <div class="income-amount">₽ ${this.report.income_by_source.delivery_club.toFixed(2)}</div>
                        <div class="income-count">${this.report.income_by_source.delivery_club_orders || 0} заказов</div>
                    </div>
                </div>
            </div>

            <!-- Expenses -->
            <div class="card" style="margin-top: 1rem;">
                <div class="card-header">
                    <h3>📤 Расходные операции</h3>
                    <button class="btn btn-primary btn-small" onclick="cashierReportModule.showAddExpense()">➕ Добавить расход</button>
                </div>
                <div id="expensesContent">
                    ${this.renderExpenses()}
                </div>
            </div>

            <!-- Summary -->
            <div class="card" style="margin-top: 1rem; background: linear-gradient(135deg, #0b5c3b 0%, #0f6b49 100%); color: white;">
                <div class="card-header" style="border-color: rgba(255,255,255,0.2);">
                    <h3 style="color: white;">📊 Итоги смены</h3>
                </div>
                <div class="grid grid-4" style="font-size: 1.1rem;">
                    <div>
                        <p style="opacity: 0.9;">Выручка:</p>
                        <p style="font-size: 1.5rem; font-weight: bold;">₽ ${this.report.total_sales.toLocaleString()}</p>
                    </div>
                    <div>
                        <p style="opacity: 0.9;">Расходы:</p>
                        <p style="font-size: 1.5rem; font-weight: bold; color: #ff6b6b;">₽ ${this.report.total_expenses.toLocaleString()}</p>
                    </div>
                    <div>
                        <p style="opacity: 0.9;">Наличные:</p>
                        <p style="font-size: 1.5rem; font-weight: bold;">₽ ${this.report.cash_total.toFixed(2)}</p>
                    </div>
                    <div>
                        <p style="opacity: 0.9;">Безналичные:</p>
                        <p style="font-size: 1.5rem; font-weight: bold;">₽ ${(this.report.card_total + this.report.aggregators_total).toFixed(2)}</p>
                    </div>
                </div>
            </div>

            <!-- Orders list -->
            <div class="card" style="margin-top: 1rem;">
                <div class="card-header">
                    <h3>🧾 Заказы смены</h3>
                    <div style="opacity: 0.75;">Показаны за период текущей смены</div>
                </div>
                ${this.renderShiftOrders()}
            </div>
        `;
    }

    renderShiftOrders() {
        const orders = Array.isArray(this.shiftOrders) ? this.shiftOrders : [];
        if (!orders.length) {
            return '<p style="text-align: center; padding: 1.5rem; opacity: 0.7;">Заказов в смене пока нет</p>';
        }

        const rows = orders.slice(0, 200).map((o) => {
            const dtRaw = o.created_at;
            const dt = dtRaw ? new Date(dtRaw) : null;
            const dtText = dt && !isNaN(dt.getTime()) ? dt.toLocaleString('ru-RU') : (dtRaw || '');

            const payment = (o.payment_method || '-');
            const delivery = (o.delivery_type || '-');
            const source = (o.source || '-');
            const items = Array.isArray(o.items) ? o.items : [];
            const itemsText = items
                .map((it) => {
                    const qty = Number(it?.qty ?? it?.quantity ?? 1) || 1;
                    const variantId = it?.variantId ?? it?.variant_id ?? '';
                    const label = this.buildOrderItemLabel(it);
                    return `${label} x${qty}${variantId ? ` [${variantId}]` : ''}`;
                })
                .filter(Boolean)
                .join('; ');

            return `
                <tr>
                    <td>${o.id}</td>
                    <td>${dtText}</td>
                    <td style="text-align:right;">₽ ${Number(o.total || 0).toFixed(2)}</td>
                    <td>${payment}</td>
                    <td>${delivery}</td>
                    <td>${source}</td>
                    <td style="max-width: 420px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${String(itemsText).replace(/"/g, '&quot;')}">${itemsText || '-'}</td>
                </tr>
            `;
        }).join('');

        return `
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Дата</th>
                            <th style="text-align:right;">Сумма</th>
                            <th>Оплата</th>
                            <th>Доставка</th>
                            <th>Источник</th>
                            <th>Состав</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    }

    renderExpenses() {
        if (this.report.expenses_count === 0) {
            return '<p style="text-align: center; padding: 2rem; opacity: 0.6;">Расходов пока нет</p>';
        }

        const categories = {
            supplier_payment: '🏪 Оплата поставщику',
            courier_salary: '🚚 Выплата курьеру',
            utilities: '⚡ Коммунальные услуги',
            rent: '🏢 Аренда',
            office_supplies: '📎 Офисные расходы',
            repairs: '🔧 Ремонт',
            other: '📌 Прочее'
        };

        let html = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">';
        
        for (const [category, amount] of Object.entries(this.report.expenses_by_category)) {
            html += `
                <div class="expense-card" style="padding: 1rem; background: #fff3cd; border-radius: 8px; border: 2px solid #ffc107;">
                    <p style="font-weight: bold; margin-bottom: 0.5rem;">${categories[category] || category}</p>
                    <p style="font-size: 1.3rem; color: #dc3545;">₽ ${amount.toFixed(2)}</p>
                </div>
            `;
        }
        
        html += '</div>';
        return html;
    }

    showOpenShift() {
        const modal = this.createModal('🔓 Открыть смену', `
            <form id="openShiftForm">
                <div class="form-group">
                    <label class="form-label">Начальная касса (наличные) *</label>
                    <input type="number" name="cash_initial" class="form-input" step="0.01" min="0" required value="0">
                </div>
                <div class="form-group">
                    <label class="form-label">Примечание</label>
                    <textarea name="notes" class="form-input" rows="2"></textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="cashierReportModule.closeModal()">Отмена</button>
                    <button type="submit" class="btn btn-success">🔓 Открыть смену</button>
                </div>
            </form>
        `);

        document.getElementById('openShiftForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.openShift(new FormData(e.target));
        });
    }

    async openShift(formData) {
        try {
            const data = {
                cash_initial: parseFloat(formData.get('cash_initial')),
                notes: formData.get('notes') || null
            };

            const response = await fetch(`${this.API_BASE}/shift/open`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (result.success) {
                alert('✅ Смена открыта!');
                this.closeModal();
                await this.loadCurrentShift();
                this.render();
            } else {
                alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
            }
        } catch (error) {
            console.error('Error opening shift:', error);
            alert('❌ Ошибка соединения с сервером');
        }
    }

    showCloseShift() {
        const modal = this.createModal('🔒 Закрыть смену', `
            <form id="closeShiftForm">
                <div class="form-group">
                    <label class="form-label">Ожидаемая касса (наличные)</label>
                    <input type="text" class="form-input" disabled value="₽ ${this.report.cash_total.toFixed(2)}">
                </div>
                <div class="form-group">
                    <label class="form-label">Фактическая касса (наличные) *</label>
                    <input type="number" name="cash_actual" class="form-input" step="0.01" min="0" required value="${this.report.cash_total.toFixed(2)}">
                </div>
                <div class="form-group">
                    <label class="form-label">Примечание</label>
                    <textarea name="notes" class="form-input" rows="2"></textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="cashierReportModule.closeModal()">Отмена</button>
                    <button type="submit" class="btn btn-danger">🔒 Закрыть смену</button>
                </div>
            </form>
        `);

        document.getElementById('closeShiftForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.closeShift(new FormData(e.target));
        });
    }

    async closeShift(formData) {
        if (!confirm('Вы уверены, что хотите закрыть смену? Это действие нельзя отменить.')) {
            return;
        }

        try {
            const data = {
                cash_actual: parseFloat(formData.get('cash_actual')),
                notes: formData.get('notes') || null
            };

            const response = await fetch(`${this.API_BASE}/shift/close`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (result.success) {
                alert(`✅ Смена закрыта!\n\nВыручка: ₽ ${result.data.report.total_sales.toFixed(2)}\nРасходы: ₽ ${result.data.report.total_expenses.toFixed(2)}\nРазница по кассе: ₽ ${result.data.shift.cash_difference.toFixed(2)}`);
                this.closeModal();
                this.currentShift = null;
                this.report = null;
                this.render();
            } else {
                alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
            }
        } catch (error) {
            console.error('Error closing shift:', error);
            alert('❌ Ошибка соединения с сервером');
        }
    }

    async showXReport() {
        try {
            const response = await fetch(`${this.API_BASE}/x-report`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const result = await response.json();
            if (result.success) {
                alert(`📄 X-ОТЧЁТ\n\nЗаказов: ${result.data.total_orders}\nВыручка: ₽ ${result.data.total_sales.toFixed(2)}\nНаличные: ₽ ${result.data.cash_total.toFixed(2)}\nБезналичные: ₽ ${(result.data.card_total + result.data.aggregators_total).toFixed(2)}\nРасходы: ₽ ${result.data.total_expenses.toFixed(2)}`);
            }
        } catch (error) {
            console.error('Error generating X-report:', error);
            alert('❌ Ошибка генерации отчёта');
        }
    }

    showAddExpense() {
        const modal = this.createModal('➕ Добавить расход', `
            <form id="addExpenseForm">
                <div class="form-group">
                    <label class="form-label">Категория *</label>
                    <select name="category" class="form-input" required>
                        <option value="supplier_payment">🏪 Оплата поставщику</option>
                        <option value="courier_salary">🚚 Выплата курьеру</option>
                        <option value="utilities">⚡ Коммунальные услуги</option>
                        <option value="rent">🏢 Аренда</option>
                        <option value="office_supplies">📎 Офисные расходы</option>
                        <option value="repairs">🔧 Ремонт</option>
                        <option value="other">📌 Прочее</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Сумма *</label>
                    <input type="number" name="amount" class="form-input" step="0.01" min="0.01" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Описание *</label>
                    <textarea name="description" class="form-input" rows="2" required></textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="cashierReportModule.closeModal()">Отмена</button>
                    <button type="submit" class="btn btn-primary">💾 Сохранить</button>
                </div>
            </form>
        `);

        document.getElementById('addExpenseForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addExpense(new FormData(e.target));
        });
    }

    async addExpense(formData) {
        try {
            const data = {
                category: formData.get('category'),
                amount: parseFloat(formData.get('amount')),
                description: formData.get('description'),
                shift_id: this.currentShift?.id || null
            };

            const response = await fetch(`${this.API_BASE}/expense`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (result.success) {
                alert('✅ Расход добавлен!');
                this.closeModal();
                await this.loadCurrentShift();
                this.render();
            } else {
                alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
            }
        } catch (error) {
            console.error('Error adding expense:', error);
            alert('❌ Ошибка соединения с сервером');
        }
    }

    calculateShiftDuration() {
        if (!this.currentShift) return '-';
        const start = new Date(this.currentShift.opened_at);
        const now = new Date();
        const diff = now - start;
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        return `${hours}ч ${minutes}м`;
    }

    showShiftsHistory() {
        this.loadShiftsHistory()
            .then(() => this.renderShiftsHistory())
            .catch((e) => {
                console.error('Error loading shifts history:', e);
                alert('❌ Не удалось загрузить историю смен');
            });
    }

    async loadShiftsHistory() {
        const response = await fetch(`${this.API_BASE}/shift/history`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        const data = await response.json();
        if (data.success) {
            this.shiftsHistory = Array.isArray(data.data) ? data.data : [];
        } else {
            throw new Error(data.error || 'Не удалось загрузить историю');
        }
    }

    renderShiftsHistory() {
        const list = Array.isArray(this.shiftsHistory) ? this.shiftsHistory : [];
        if (!list.length) {
            this.createModal('📊 История смен', '<p style="padding: 1rem;">История смен пуста</p>');
            return;
        }

        const rows = list.slice(0, 50).map((entry) => {
            const shift = entry.shift || {};
            const report = entry.report || {};
            const opened = shift.opened_at ? new Date(shift.opened_at) : null;
            const closed = shift.closed_at ? new Date(shift.closed_at) : null;
            const openedText = opened && !isNaN(opened.getTime()) ? opened.toLocaleString('ru-RU') : (shift.opened_at || '');
            const closedText = closed && !isNaN(closed.getTime()) ? closed.toLocaleString('ru-RU') : (shift.closed_at || '-');

            return `
                <tr>
                    <td>${shift.id || '-'}</td>
                    <td>${openedText}</td>
                    <td>${closedText}</td>
                    <td style="text-align:right;">₽ ${Number(report.total_sales || 0).toFixed(2)}</td>
                    <td style="text-align:right;">₽ ${Number(report.total_expenses || 0).toFixed(2)}</td>
                    <td style="text-align:right;">₽ ${Number(shift.cash_difference || 0).toFixed(2)}</td>
                </tr>
            `;
        }).join('');

        const content = `
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID смены</th>
                            <th>Открыта</th>
                            <th>Закрыта</th>
                            <th style="text-align:right;">Выручка</th>
                            <th style="text-align:right;">Расходы</th>
                            <th style="text-align:right;">Разница</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;

        this.createModal('📊 История смен', content, '', 'large');
    }

    createModal(title, content, footer = '', size = 'normal') {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="${size === 'large' ? 'max-width: 900px;' : 'max-width: 600px;'}">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="cashierReportModule.closeModal()">×</button>
                </div>
                <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                    ${content}
                </div>
                ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
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
    window.CashierReportModule = CashierReportModule;
    window.cashierReportModule = new CashierReportModule();
}

