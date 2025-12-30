// ===== Reports Module - Отчётность =====

class ReportsModule {
    constructor() {
        this.currentReport = 'financial';
        this.dateRange = null;
        this.orders = [];
        this.reports = [];
        this.ready = this.init();
    }

    async init() {
        console.log('📊 Initializing Reports Module...');
        await Promise.all([this.loadOrders(), this.loadReports()]);
        this.render();
    }

    async loadOrders() {
        try {
            const response = await fetch('/api/orders');
            if (response.ok) {
                const result = await response.json();
                this.orders = this.normalizeOrders(result.data || result || []);
                console.log('📊 Orders loaded:', this.orders.length);
            }
        } catch (error) {
            console.error('Error loading orders:', error);
            // Fallback data
            this.orders = this.normalizeOrders([
                { id: 1, total: 1200, createdAt: '2024-01-15T10:00:00Z', status: 'delivered' },
                { id: 2, total: 850, createdAt: '2024-01-15T11:30:00Z', status: 'delivered' },
                { id: 3, total: 2100, createdAt: '2024-01-15T12:15:00Z', status: 'delivered' }
            ]);
        }
    }

    async loadReports() {
        try {
            const data = await this.fetchStateKey('reports', []);
            this.reports = Array.isArray(data) ? data : [];
            console.log('✅ Отчёты загружены из API:', this.reports.length);
        } catch (error) {
            console.warn('⚠️ Ошибка загрузки отчётов, используем пустой массив:', error);
            this.reports = [];
        }
    }

    async saveReports() {
        try {
            await this.saveStateKey('reports', this.reports);
            console.log('✅ Отчёты сохранены через API:', this.reports.length);
        } catch (error) {
            console.warn('⚠️ Не удалось сохранить отчёты', error);
            // Показываем пользователю ошибку только если это критично
            if (error.message && !error.message.includes('HTTP 404')) {
                console.error('[Reports] Критическая ошибка сохранения:', error);
            }
        }
    }

    filterOrdersByDate(orders, startDate, endDate) {
        if (!startDate || !endDate) {
            return orders;
        }
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                console.warn('⚠️ Некорректные даты фильтра:', startDate, endDate);
                return orders;
            }
            return orders.filter(o => {
                const orderDate = new Date(o.createdAt || o.created_at);
                if (isNaN(orderDate.getTime())) {
                    return false;
                }
                return orderDate >= start && orderDate <= end;
            });
        } catch (error) {
            console.warn('⚠️ Ошибка фильтрации по датам:', error);
            return orders;
        }
    }

    normalizeOrders(orders) {
        const list = Array.isArray(orders) ? orders : [];
        return list
            .map((o) => {
                if (!o || typeof o !== 'object') return null;
                let items = o.items;
                try {
                    if (typeof items === 'string') {
                        items = JSON.parse(items);
                    }
                } catch (_) {
                    items = [];
                }
                if (!Array.isArray(items)) items = [];

                return {
                    ...o,
                    id: o.id,
                    total: Number(o.total) || 0,
                    created_at: o.created_at || o.createdAt || null,
                    createdAt: o.createdAt || o.created_at || null,
                    customer_name: o.customer_name || o.customerName || '',
                    phone: o.phone || o.customerPhone || '',
                    address: o.address || '',
                    status: o.status || 'pending',
                    items
                };
            })
            .filter(Boolean);
    }

    getDefaultDateRange() {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 30);
        const toInput = (d) => {
            try {
                const off = d.getTimezoneOffset();
                const local = new Date(d.getTime() - off * 60000);
                return local.toISOString().slice(0, 10);
            } catch (_) {
                return '2024-01-01';
            }
        };
        return { startDate: toInput(start), endDate: toInput(end) };
    }

    getActiveDateRange() {
        if (this.dateRange && this.dateRange.startDate && this.dateRange.endDate) {
            return this.dateRange;
        }
        return this.getDefaultDateRange();
    }

    formatSizeLabel(size) {
        if (!size && size !== 0) return '';
        const raw = String(size).trim();
        if (!raw) return '';
        return raw.toLowerCase().includes('см') ? raw : `${raw} см`;
    }

    buildOrderItemLabel(item) {
        const name = (item?.name || '').trim();
        const size = this.formatSizeLabel(item?.size);
        return size ? `${name} (${size})` : name;
    }

    collectProductStats(orders) {
        const rows = [];
        const byKey = new Map();

        (Array.isArray(orders) ? orders : []).forEach((order) => {
            const items = Array.isArray(order?.items) ? order.items : [];
            items.forEach((item) => {
                if (!item) return;
                const qty = Number(item.qty ?? item.quantity ?? 1) || 1;
                const price = Number(item.price) || 0;
                const productId = item.productId ?? item.id ?? null;
                const variantId = item.variantId ?? item.variant_id ?? null;
                const name = (item.name || '').trim();
                const size = this.formatSizeLabel(item.size);
                const key = `${String(productId ?? name)}|${String(variantId ?? '')}|${String(size ?? '')}`;

                const prev = byKey.get(key) || {
                    productId,
                    variantId,
                    name,
                    size,
                    qty: 0,
                    revenue: 0
                };

                prev.qty += qty;
                prev.revenue += price * qty;

                byKey.set(key, prev);
            });
        });

        byKey.forEach((v) => rows.push(v));
        rows.sort((a, b) => (b.revenue - a.revenue) || (b.qty - a.qty));
        return rows;
    }

    renderOrdersTable(orders) {
        const list = Array.isArray(orders) ? orders : [];
        if (!list.length) {
            return '<div class="card"><p style="padding: 1.5rem; text-align: center; color: var(--text-light);">Нет заказов за период</p></div>';
        }

        const rows = list
            .slice(0, 50)
            .map((o) => {
                const dateValue = o.createdAt || o.created_at;
                const date = dateValue ? new Date(dateValue) : null;
                const dateText = date && !isNaN(date.getTime()) ? date.toLocaleString('ru-RU') : (dateValue || '');
                const itemsCount = Array.isArray(o.items) ? o.items.reduce((s, it) => s + (Number(it?.qty ?? it?.quantity ?? 1) || 1), 0) : 0;
                const customer = (o.customer_name || '').trim() || '-';
                const phone = (o.phone || '').trim() || '-';
                const status = (o.status || 'pending');
                return `
                    <tr>
                        <td>${o.id}</td>
                        <td>${this.escapeHtml(dateText)}</td>
                        <td>${this.escapeHtml(customer)}</td>
                        <td>${this.escapeHtml(phone)}</td>
                        <td style="text-align:right;">${Number(o.total || 0).toLocaleString('ru-RU')} ₽</td>
                        <td style="text-align:right;">${itemsCount}</td>
                        <td>${this.escapeHtml(status)}</td>
                        <td style="text-align:center;">
                            <button class="btn btn-secondary" style="padding: 0.35rem 0.6rem;" onclick="reportsModule.showOrderDetails('${String(o.id).replace(/'/g, "\\'")}')">👁</button>
                        </td>
                    </tr>
                `;
            })
            .join('');

        return `
            <div class="card">
                <h4 style="margin-bottom: 1rem;">📋 Заказы (последние 50)</h4>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Дата</th>
                                <th>Клиент</th>
                                <th>Телефон</th>
                                <th style="text-align:right;">Сумма</th>
                                <th style="text-align:right;">Позиций</th>
                                <th>Статус</th>
                                <th style="text-align:center;">Детали</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    escapeHtml(text) {
        return String(text || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    render() {
        const container = document.getElementById('reportsContent');
        if (!container) return;

        const range = this.getActiveDateRange();
        const orders = this.filterOrdersByDate(this.orders, range.startDate, range.endDate);
        const totalRevenue = orders.reduce((sum, o) => sum + (Number(o?.total) || 0), 0);
        const totalOrders = orders.length;
        const avgCheck = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        
        container.innerHTML = `
            <div class="card">
                <h3 class="card-title">📊 Отчётность</h3>
                
                <!-- Фильтры -->
                <div class="form-row" style="margin-bottom: 2rem;">
                    <div class="form-group">
                        <label class="form-label">Дата начала</label>
                        <input type="date" id="reportStartDate" class="form-input" value="${range.startDate}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Дата окончания</label>
                        <input type="date" id="reportEndDate" class="form-input" value="${range.endDate}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">&nbsp;</label>
                        <button class="btn btn-primary" onclick="reportsModule.generateReport()">📊 Сформировать отчёт</button>
                    </div>
                </div>

                <!-- Статистика -->
                <div class="grid grid-3" style="margin-bottom: 2rem;">
                    <div class="card">
                        <h4>💰 Выручка</h4>
                        <div class="stat-value text-success">${totalRevenue.toLocaleString()} ₽</div>
                    </div>
                    <div class="card">
                        <h4>📦 Заказов</h4>
                        <div class="stat-value text-primary">${totalOrders}</div>
                    </div>
                    <div class="card">
                        <h4>📊 Средний чек</h4>
                        <div class="stat-value text-warning">${avgCheck.toFixed(0)} ₽</div>
                    </div>
                </div>

                <!-- Вкладки отчётов -->
                <div class="tabs-container">
                    <div class="tabs-nav">
                        <button class="tab-button active" onclick="reportsModule.switchTab('financial')">💰 Финансовый</button>
                        <button class="tab-button" onclick="reportsModule.switchTab('sales')">📈 Продажи</button>
                        <button class="tab-button" onclick="reportsModule.switchTab('products')">🍕 Товары</button>
                        <button class="tab-button" onclick="reportsModule.switchTab('customers')">👥 Клиенты</button>
                    </div>

                    <div id="financial-tab" class="tab-content active">
                        ${this.renderFinancialReport(orders)}
                    </div>

                    <div id="sales-tab" class="tab-content">
                        ${this.renderSalesReport(orders)}
                    </div>

                    <div id="products-tab" class="tab-content">
                        ${this.renderProductsReport(orders)}
                    </div>

                    <div id="customers-tab" class="tab-content">
                        ${this.renderCustomersReport(orders)}
                    </div>
                </div>
            </div>
        `;
    }

    renderFinancialReport(orders) {
        const list = Array.isArray(orders) ? orders : [];
        const totalRevenue = list.reduce((sum, o) => sum + (Number(o?.total) || 0), 0);
        const totalOrders = list.length;
        const avgCheck = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;
        const statuses = {};
        list.forEach((o) => {
            const s = o?.status || 'pending';
            statuses[s] = (statuses[s] || 0) + 1;
        });

        const vatAmount = totalRevenue * 0.2;
        const netProfit = totalRevenue * 0.3;

        const statusRows = Object.entries(statuses)
            .sort((a, b) => b[1] - a[1])
            .map(([s, c]) => `<p><strong>${this.escapeHtml(s)}:</strong> ${c}</p>`)
            .join('') || '<p style="color: var(--text-light);">Нет данных</p>';
        
        return `
            <div class="grid grid-2">
                <div class="card">
                    <h4>📌 По статусам</h4>
                    ${statusRows}
                </div>
                <div class="card">
                    <h4>📊 Финансовые показатели</h4>
                    <p><strong>Общая выручка:</strong> ${Number(totalRevenue).toLocaleString('ru-RU')} ₽</p>
                    <p><strong>Заказов:</strong> ${totalOrders}</p>
                    <p><strong>Средний чек:</strong> ${Number(avgCheck).toLocaleString('ru-RU')} ₽</p>
                    <p><strong>НДС (20%):</strong> ${Number(vatAmount).toLocaleString('ru-RU')} ₽</p>
                    <p><strong>Чистая прибыль:</strong> ${Number(netProfit).toLocaleString('ru-RU')} ₽</p>
                </div>
            </div>
            <div style="margin-top: 1rem;">
                <button class="btn btn-success" onclick="reportsModule.exportReport('financial')">📄 Экспорт в Excel</button>
                <button class="btn btn-secondary" onclick="reportsModule.printReport()">🖨️ Печать</button>
            </div>
        `;
    }

    renderSalesReport(orders) {
        try {
            const list = Array.isArray(orders) ? orders : [];

            // Группируем по дням
            const dailySales = {};
            list.forEach(order => {
                if (!order) return;
                const createdAt = order.createdAt || order.created_at;
                if (!createdAt) return;
                
                try {
                    const dateObj = new Date(createdAt);
                    if (isNaN(dateObj.getTime())) return;
                    const date = dateObj.toDateString();
                    if (!dailySales[date]) {
                        dailySales[date] = { orders: 0, revenue: 0 };
                    }
                    dailySales[date].orders++;
                    dailySales[date].revenue += Number(order.total) || 0;
                } catch (error) {
                    console.warn('⚠️ Ошибка обработки заказа:', order, error);
                }
            });

            const dailyData = Object.entries(dailySales)
                .sort((a, b) => new Date(a[0]) - new Date(b[0]))
                .slice(-14);

            if (dailyData.length === 0) {
                return `
                    <div class="card">
                        <h4>📈 Динамика продаж (последние 7 дней)</h4>
                        <p style="padding: 2rem; text-align: center; color: var(--text-light);">
                            Нет данных за выбранный период
                        </p>
                    </div>
                `;
            }

            return `
                <div class="card">
                    <h4>📈 Динамика продаж (последние 14 дней)</h4>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Дата</th>
                                    <th>Заказов</th>
                                    <th>Выручка</th>
                                    <th>Средний чек</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${dailyData.map(([date, data]) => {
                                    const avgCheck = data.orders > 0 ? (data.revenue / data.orders).toFixed(0) : '0';
                                    try {
                                        const dateObj = new Date(date);
                                        const formattedDate = isNaN(dateObj.getTime()) ? date : dateObj.toLocaleDateString('ru-RU');
                                        return `
                                            <tr>
                                                <td>${formattedDate}</td>
                                                <td>${data.orders}</td>
                                                <td>${Number(data.revenue).toLocaleString('ru-RU')} ₽</td>
                                                <td>${avgCheck} ₽</td>
                                            </tr>
                                        `;
                                    } catch (error) {
                                        return '';
                                    }
                                }).filter(row => row).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                ${this.renderOrdersTable(list)}
            `;
        } catch (error) {
            console.error('❌ Ошибка рендеринга отчёта по продажам:', error);
            return `
                <div class="card">
                    <h4>📈 Динамика продаж</h4>
                    <p style="padding: 2rem; text-align: center; color: #dc2626;">
                        Ошибка загрузки данных: ${error.message || 'Неизвестная ошибка'}
                    </p>
                </div>
            `;
        }
    }

    renderProductsReport(orders) {
        const list = Array.isArray(orders) ? orders : [];
        const stats = this.collectProductStats(list);
        const totalRevenue = stats.reduce((s, r) => s + (Number(r.revenue) || 0), 0);

        if (!stats.length) {
            return `
                <div class="card">
                    <h4>🍕 Популярные товары</h4>
                    <p style="padding: 2rem; text-align: center; color: var(--text-light);">Нет данных за выбранный период</p>
                </div>
            `;
        }

        const rows = stats.slice(0, 30).map((r, idx) => {
            const share = totalRevenue > 0 ? ((r.revenue / totalRevenue) * 100).toFixed(1) : '0.0';
            const label = this.escapeHtml(this.buildOrderItemLabel({ name: r.name, size: r.size }));
            const variantText = r.variantId ? this.escapeHtml(String(r.variantId)) : '';
            return `
                <tr>
                    <td style="text-align:right;">${idx + 1}</td>
                    <td>${label}</td>
                    <td>${variantText}</td>
                    <td style="text-align:right;">${Number(r.qty || 0).toLocaleString('ru-RU')}</td>
                    <td style="text-align:right;">${Number(r.revenue || 0).toLocaleString('ru-RU')} ₽</td>
                    <td style="text-align:right;">${share}%</td>
                </tr>
            `;
        }).join('');

        return `
            <div class="card">
                <h4>🍕 Популярные товары</h4>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th style="text-align:right;">#</th>
                                <th>Товар</th>
                                <th>Variant ID</th>
                                <th style="text-align:right;">Кол-во</th>
                                <th style="text-align:right;">Выручка</th>
                                <th style="text-align:right;">Доля</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    renderCustomersReport(orders) {
        const list = Array.isArray(orders) ? orders : [];
        const byPhone = new Map();
        list.forEach((o) => {
            const phone = String(o.phone || '').trim();
            if (!phone) return;
            const prev = byPhone.get(phone) || {
                phone,
                name: (o.customer_name || '').trim(),
                orders: 0,
                revenue: 0,
                last: null
            };
            prev.orders += 1;
            prev.revenue += Number(o.total) || 0;
            const dtRaw = o.createdAt || o.created_at;
            const dt = dtRaw ? new Date(dtRaw) : null;
            if (dt && !isNaN(dt.getTime())) {
                if (!prev.last || dt > prev.last) prev.last = dt;
            }
            if (!prev.name && o.customer_name) prev.name = String(o.customer_name).trim();
            byPhone.set(phone, prev);
        });

        const customers = Array.from(byPhone.values()).sort((a, b) => (b.revenue - a.revenue) || (b.orders - a.orders));
        if (!customers.length) {
            return `
                <div class="card">
                    <h4>👥 Анализ клиентов</h4>
                    <p style="padding: 2rem; text-align: center; color: var(--text-light);">Нет данных за выбранный период</p>
                </div>
            `;
        }

        const rows = customers.slice(0, 50).map((c) => {
            const last = c.last ? c.last.toLocaleString('ru-RU') : '';
            return `
                <tr>
                    <td>${this.escapeHtml(c.name || '-') }</td>
                    <td>${this.escapeHtml(c.phone)}</td>
                    <td style="text-align:right;">${c.orders}</td>
                    <td style="text-align:right;">${Number(c.revenue).toLocaleString('ru-RU')} ₽</td>
                    <td>${this.escapeHtml(last)}</td>
                </tr>
            `;
        }).join('');

        return `
            <div class="card">
                <h4>👥 Анализ клиентов</h4>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Клиент</th>
                                <th>Телефон</th>
                                <th style="text-align:right;">Заказов</th>
                                <th style="text-align:right;">Сумма</th>
                                <th>Последний заказ</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    switchTab(tabName) {
        try {
            // Обновляем кнопки
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('active');
            });
            const activeButton = document.querySelector(`[onclick*="${tabName}"]`);
            if (activeButton) {
                activeButton.classList.add('active');
            }

            // Обновляем контент
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            const activeTab = document.getElementById(`${tabName}-tab`);
            if (activeTab) {
                activeTab.classList.add('active');
            } else {
                console.warn(`⚠️ Вкладка ${tabName}-tab не найдена`);
            }

            this.currentReport = tabName;
        } catch (error) {
            console.error('❌ Ошибка переключения вкладки:', error);
        }
    }

    async generateReport() {
        try {
            const startDateEl = document.getElementById('reportStartDate');
            const endDateEl = document.getElementById('reportEndDate');
            
            if (!startDateEl || !endDateEl) {
                console.error('❌ Элементы фильтра дат не найдены');
                alert('⚠️ Ошибка: элементы фильтра не найдены');
                return;
            }
            
            const startDate = startDateEl.value;
            const endDate = endDateEl.value;
            
            if (!startDate || !endDate) {
                alert('⚠️ Выберите даты для отчёта');
                return;
            }

            this.dateRange = { startDate, endDate };

            const rangeOrders = this.filterOrdersByDate(this.orders, startDate, endDate);

            // Создаём новый отчёт и сохраняем его
            const newReport = {
                id: Date.now(),
                type: this.currentReport,
                startDate: startDate,
                endDate: endDate,
                createdAt: new Date().toISOString(),
                orders: rangeOrders
            };
            
            // Добавляем в список отчётов
            this.reports.unshift(newReport);
            
            // Ограничиваем количество сохранённых отчётов (последние 50)
            if (this.reports.length > 50) {
                this.reports = this.reports.slice(0, 50);
            }
            
            // Сохраняем через API
            await this.saveReports();
            
            // Обновляем отчёт
            this.render();
            alert('✅ Отчёт сформирован и сохранён!');
        } catch (error) {
            console.error('❌ Ошибка генерации отчёта:', error);
            alert('❌ Ошибка при генерации отчёта: ' + (error.message || 'Неизвестная ошибка'));
        }
    }

    async exportReport(type) {
        try {
            // Загружаем xlsx библиотеку, если нужно
            if (typeof window.loadXLSX === 'function') {
                const XLSX = await window.loadXLSX();
                if (!XLSX) {
                    alert('⚠️ Библиотека Excel недоступна. Экспорт невозможен.');
                    return;
                }
                
                // Формируем данные для экспорта
                const range = {
                    startDate: document.getElementById('reportStartDate')?.value,
                    endDate: document.getElementById('reportEndDate')?.value
                };
                const startDate = range.startDate || this.getActiveDateRange().startDate;
                const endDate = range.endDate || this.getActiveDateRange().endDate;
                const orders = this.filterOrdersByDate(this.orders, startDate, endDate);
                
                // Создаём рабочую книгу
                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.json_to_sheet(orders.map(o => {
                    const dtRaw = o.createdAt || o.created_at;
                    const dt = dtRaw ? new Date(dtRaw) : null;
                    const dtText = dt && !isNaN(dt.getTime()) ? dt.toLocaleString('ru-RU') : (dtRaw || '');
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
                    return {
                        'ID заказа': o.id,
                        'Дата': dtText,
                        'Клиент': o.customer_name || '',
                        'Телефон': o.phone || '',
                        'Адрес': o.address || '',
                        'Сумма': o.total || 0,
                        'Статус': o.status || 'unknown',
                        'Состав': itemsText
                    };
                }));
                
                XLSX.utils.book_append_sheet(wb, ws, 'Отчёт');
                XLSX.writeFile(wb, `report_${type}_${Date.now()}.xlsx`);
                
                alert('✅ Отчёт экспортирован в Excel!');
            } else {
                alert('⚠️ Функция экспорта в Excel недоступна');
            }
        } catch (error) {
            console.error('❌ Ошибка экспорта отчёта:', error);
            alert('❌ Ошибка при экспорте: ' + (error.message || 'Неизвестная ошибка'));
        }
    }

    showOrderDetails(orderId) {
        const id = String(orderId);
        const order = (Array.isArray(this.orders) ? this.orders : []).find((o) => String(o?.id) === id);
        if (!order) {
            alert('Заказ не найден');
            return;
        }
        const items = Array.isArray(order.items) ? order.items : [];
        const rows = items.map((it) => {
            const qty = Number(it?.qty ?? it?.quantity ?? 1) || 1;
            const price = Number(it?.price) || 0;
            const total = price * qty;
            const variantId = it?.variantId ?? it?.variant_id ?? '';
            return `
                <tr>
                    <td>${this.escapeHtml(this.buildOrderItemLabel(it))}</td>
                    <td>${this.escapeHtml(String(variantId || ''))}</td>
                    <td style="text-align:right;">${qty}</td>
                    <td style="text-align:right;">${Number(price).toLocaleString('ru-RU')} ₽</td>
                    <td style="text-align:right;">${Number(total).toLocaleString('ru-RU')} ₽</td>
                </tr>
            `;
        }).join('');

        const headerDateRaw = order.createdAt || order.created_at;
        const headerDateObj = headerDateRaw ? new Date(headerDateRaw) : null;
        const headerDate = headerDateObj && !isNaN(headerDateObj.getTime()) ? headerDateObj.toLocaleString('ru-RU') : (headerDateRaw || '');

        const content = `
            <div style="display:grid; gap: 0.5rem; margin-bottom: 1rem;">
                <div><strong>ID:</strong> ${this.escapeHtml(order.id)}</div>
                <div><strong>Дата:</strong> ${this.escapeHtml(headerDate)}</div>
                <div><strong>Клиент:</strong> ${this.escapeHtml(order.customer_name || '')}</div>
                <div><strong>Телефон:</strong> ${this.escapeHtml(order.phone || '')}</div>
                <div><strong>Адрес:</strong> ${this.escapeHtml(order.address || '')}</div>
                <div><strong>Статус:</strong> ${this.escapeHtml(order.status || '')}</div>
                <div><strong>Сумма:</strong> ${Number(order.total || 0).toLocaleString('ru-RU')} ₽</div>
            </div>
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Позиция</th>
                            <th>Variant ID</th>
                            <th style="text-align:right;">Кол-во</th>
                            <th style="text-align:right;">Цена</th>
                            <th style="text-align:right;">Сумма</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="5" style="text-align:center; padding: 1rem; color: var(--text-light);">Пусто</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;

        this.createModal('🧾 Заказ', content);
    }

    createModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.65); display:flex; align-items:center; justify-content:center; z-index: 10001;';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px; width: 92%; background: #fff; border-radius: 14px; overflow: hidden;">
                <div class="modal-header" style="display:flex; align-items:center; justify-content: space-between; padding: 1rem 1.25rem; border-bottom: 1px solid rgba(0,0,0,0.08);">
                    <h3 style="margin:0;">${this.escapeHtml(title)}</h3>
                    <button class="modal-close" style="border:none; background: transparent; font-size: 22px; cursor:pointer;" aria-label="close">×</button>
                </div>
                <div class="modal-body" style="padding: 1.25rem; max-height: 75vh; overflow:auto;">
                    ${content}
                </div>
            </div>
        `;

        const close = () => {
            try { modal.remove(); } catch (_) {}
        };
        modal.addEventListener('click', (e) => {
            if (e.target === modal) close();
        });
        modal.querySelector('.modal-close')?.addEventListener('click', close);
        document.body.appendChild(modal);
    }

    printReport() {
        window.print();
    }

    async fetchStateKey(key, fallback) {
        try {
            const response = await fetch(`/api/admin-state/keys/${encodeURIComponent(key)}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const payload = await response.json();
            if (payload && Object.prototype.hasOwnProperty.call(payload, 'data')) {
                return payload.data;
            }
        } catch (error) {
            console.warn(`[Reports] Не удалось загрузить ключ ${key}:`, error.message || error);
        }
        return fallback;
    }

    async saveStateKey(key, data) {
        try {
            const response = await fetch(`/api/admin-state/keys/${encodeURIComponent(key)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data })
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.warn(`[Reports] Не удалось сохранить ключ ${key}:`, error.message || error);
            throw error;
        }
    }
}

// Глобальная функция для инициализации
window.initReports = function() {
    if (window.reportsModule) {
        window.reportsModule = null;
    }
    window.reportsModule = new ReportsModule();
};

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReportsModule;
}





