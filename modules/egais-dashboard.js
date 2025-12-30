class EgaisDashboard {
    constructor(containerId = 'egaisModuleRoot') {
        this.containerId = containerId;
        this.API_BASE = '/api/egais';
        this.state = {
            isLoading: false,
            error: null,
            status: null,
            products: [],
            marks: [],
            reports: []
        };
    }

    async init() {
        await this.loadData();
        this.render();
    }

    async loadData() {
        this.setState({ isLoading: true, error: null });
        try {
            // Функция для безопасной загрузки данных с обработкой 404
            const safeFetch = async (url) => {
                try {
                    const response = await fetch(url);
                    // Если 404 - это нормально, endpoints могут быть не реализованы
                    // Не логируем ошибку в консоль для 404
                    if (response.status === 404) {
                        return { success: true, data: null };
                    }
                    if (!response.ok) {
                        // Для других ошибок тоже не показываем в консоли, если это не критично
                        return { success: false, data: null };
                    }
                    const data = await response.json();
                    return { success: true, data: data?.data || data || null };
                } catch (error) {
                    // Игнорируем все ошибки для /api/egais/* endpoints
                    // Они могут быть не реализованы, это нормально
                    return { success: true, data: null };
                }
            };

            const [statusResult, productsResult, marksResult, reportsResult] = await Promise.all([
                safeFetch(`${this.API_BASE}/status`),
                safeFetch(`${this.API_BASE}/products/alcohol`),
                safeFetch(`${this.API_BASE}/marks`),
                safeFetch(`${this.API_BASE}/reports`)
            ]);

            // Устанавливаем данные, даже если endpoints не реализованы (404)
            // В этом случае используем пустые значения по умолчанию
            this.setState({
                status: statusResult.data || { connected: false, products: 0, marks: 0, reports: 0 },
                products: productsResult.data || [],
                marks: marksResult.data || [],
                reports: reportsResult.data || []
            });
        } catch (error) {
            // Не показываем ошибку в консоли для 404, это нормально для нереализованных endpoints
            if (!error.message || !error.message.includes('404')) {
                console.error('[EgaisDashboard] load error', error);
            }
            // Устанавливаем значения по умолчанию вместо ошибки
            this.setState({
                status: { connected: false, products: 0, marks: 0, reports: 0 },
                products: [],
                marks: [],
                reports: []
            });
        } finally {
            this.setState({ isLoading: false });
        }
    }

    setState(patch) {
        this.state = { ...this.state, ...patch };
    }

    get container() {
        return document.getElementById(this.containerId);
    }

    render() {
        const root = this.container;
        if (!root) return;

        if (this.state.isLoading) {
            root.innerHTML = this.renderLoading();
            return;
        }

        if (this.state.error) {
            root.innerHTML = this.renderError(this.state.error);
            return;
        }

        root.innerHTML = `
            <div class=\"egais-dashboard\">
                ${this.renderHeader()}
                ${this.renderStats()}
                ${this.renderInventorySection()}
                ${this.renderActionsSection()}
                ${this.renderReportsSection()}
            </div>
        `;

        this.bindEvents();
    }

    renderLoading() {
        return `
            <div class=\"card\">
                <h3 class=\"card-title\">🍷 ЕГАИС</h3>
                <p>Загружаем данные...</p>
            </div>
        `;
    }

    renderError(message) {
        return `
            <div class=\"card\" style=\"border-left: 4px solid #dc2626; background: #fee2e2;\">
                <h3 class=\"card-title\">🍷 ЕГАИС</h3>
                <p style=\"color:#b91c1c;\">Ошибка: ${message}</p>
                <button class=\"btn btn-secondary\" onclick=\"egaisDashboard.reload()\">Повторить</button>
            </div>
        `;
    }

    renderHeader() {
        const status = this.state.status;
        return `
            <div class=\"card\">
                <div class=\"card-header\">
                    <h3 class=\"card-title\">🍷 ЕГАИС — оборот алкогольной продукции</h3>
                    <span class=\"badge ${status?.connected ? 'badge-success' : 'badge-warning'}\">
                        ${status?.connected ? 'Подключено' : 'Демо режим'}
                    </span>
                </div>
                <p style=\"margin-top:0.5rem; color:#444;\">Контроль остатков алкоголя, маркировка и отчётность выполняются в демонстрационном режиме без соединения с УТМ.</p>
            </div>
        `;
    }

    renderStats() {
        const status = this.state.status || {};
        const marksCount = (this.state.marks || []).length;
        const draftCount = (this.state.products || []).filter(p => p.isDraft).length;

        return `
            <div class=\"card\">
                <div class=\"card-header\">
                    <h3 class=\"card-title\">Показатели</h3>
                </div>
                <div class=\"grid grid-4\">
                    ${this.renderStatCard('🍾 Номенклатура', status.products || 0)}
                    ${this.renderStatCard('🏷️ Марки', status.marks || marksCount)}
                    ${this.renderStatCard('🛢️ Разливное', draftCount)}
                    ${this.renderStatCard('📑 Отчёты', status.reports || 0)}
                </div>
            </div>
        `;
    }

    renderStatCard(label, value) {
        return `
            <div class=\"card\" style=\"background:#f8fafc;\">
                <p style=\"margin:0; opacity:0.7;\">${label}</p>
                <p style=\"margin:0; font-size:1.8rem; font-weight:700;\">${value}</p>
            </div>
        `;
    }

    renderInventorySection() {
        const products = (this.state.products || []).slice(0, 6);
        if (products.length === 0) {
            return `
                <div class=\"card\">
                    <div class=\"card-header\">
                        <h3 class=\"card-title\">Остатки алкогольной продукции</h3>
                    </div>
                    <p style=\"color:#666;\">Нет данных по остаткам.</p>
                </div>
            `;
        }

        return `
            <div class=\"card\">
                <div class=\"card-header\">
                    <h3 class=\"card-title\">Остатки алкогольной продукции</h3>
                </div>
                <div class=\"table-responsive\">
                    <table class=\"data-table\">
                        <thead>
                            <tr>
                                <th>Товар</th>
                                <th>Объем (л)</th>
                                <th>Крепость (%)</th>
                                <th>Остаток</th>
                                <th>Тип</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${products.map(p => `
                                <tr>
                                    <td>${p.name}</td>
                                    <td>${p.alcVolumeL}</td>
                                    <td>${p.alcStrength}</td>
                                    <td>${p.quantity}</td>
                                    <td>${p.isDraft ? '<span class=\"badge badge-warning\">Разливное</span>' : '<span class=\"badge badge-success\">Бутылочное</span>'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    renderActionsSection() {
        return `
            <div class=\"card\">
                <div class=\"card-header\">
                    <h3 class=\"card-title\">Тестовые операции</h3>
                </div>
                <div class=\"grid grid-3\" style=\"gap:1.5rem;\">
                    <div class=\"card\" style=\"background:#ecfdf5; border:1px solid #bbf7d0;\">
                        <h4 style=\"margin-top:0;\">Продажа</h4>
                        <p style=\"margin-bottom:1rem;\">Смоделировать продажу алкогольной продукции в демо-среде.</p>
                        <button class=\"btn btn-success\" onclick=\"egaisDashboard.simulateSale()\">🔔 Продажа</button>
                    </div>
                    <div class=\"card\" style=\"background:#fef3c7; border:1px solid #fde68a;\">
                        <h4 style=\"margin-top:0;\">Возврат</h4>
                        <p style=\"margin-bottom:1rem;\">Смоделировать возврат товара поставщику.</p>
                        <button class=\"btn btn-secondary\" onclick=\"egaisDashboard.simulateReturn()\">↩️ Возврат</button>
                    </div>
                    <div class=\"card\" style=\"background:#e0f2fe; border:1px solid #bae6fd;\">
                        <h4 style=\"margin-top:0;\">Корректировка</h4>
                        <p style=\"margin-bottom:1rem;\">Обновить остатки (инвентаризация).</p>
                        <button class=\"btn btn-primary\" onclick=\"egaisDashboard.simulateInventory()\">🧮 Корректировка</button>
                    </div>
                </div>
            </div>
        `;
    }

    renderReportsSection() {
        const reports = (this.state.reports || []).slice(0, 5);
        return `
            <div class=\"card\">
                <div class=\"card-header\">
                    <h3 class=\"card-title\">Журнал отчётов</h3>
                    <button class=\"btn btn-small btn-secondary\" onclick=\"egaisDashboard.generateReport()\">📄 Создать демо-отчёт</button>
                </div>
                ${reports.length === 0 ? '<p style=\"color:#666;\">Нет сформированных отчётов.</p>' : `
                    <div class=\"table-responsive\">
                        <table class=\"data-table\">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Тип</th>
                                    <th>Статус</th>
                                    <th>Сформирован</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${reports.map(report => `
                                    <tr>
                                        <td><code>${report.id}</code></td>
                                        <td>${report.type || '—'}</td>
                                        <td><span class=\"badge badge-success\">${report.status || 'готов'}</span></td>
                                        <td>${report.generatedAt ? this.formatDate(report.generatedAt) : '—'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
        `;
    }

    bindEvents() {
        // No form bindings for now
    }

    async simulateSale() {
        try {
            const response = await fetch(`${this.API_BASE}/sales`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: `sale-${Date.now()}`,
                    timestamp: new Date().toISOString()
                })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            alert('✅ Продажа записана (демо режим)');
        } catch (error) {
            console.error('simulateSale failed', error);
            alert('❌ Ошибка при выполнении операции продажи');
        }
    }

    async simulateReturn() {
        try {
            const response = await fetch(`${this.API_BASE}/returns`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: `return-${Date.now()}`,
                    timestamp: new Date().toISOString()
                })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            alert('✅ Возврат зарегистрирован (демо режим)');
        } catch (error) {
            console.error('simulateReturn failed', error);
            alert('❌ Ошибка при выполнении операции возврата');
        }
    }

    async simulateInventory() {
        try {
            const response = await fetch(`${this.API_BASE}/inventory`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: `inventory-${Date.now()}`,
                    timestamp: new Date().toISOString()
                })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            alert('✅ Корректировка остатков выполнена (демо режим)');
        } catch (error) {
            console.error('simulateInventory failed', error);
            alert('❌ Ошибка при корректировке остатков');
        }
    }

    async generateReport() {
        try {
            const payload = {
                type: 'movement',
                generatedAt: new Date().toISOString()
            };
            const response = await fetch(`${this.API_BASE}/reports`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            alert('📄 Демо-отчёт по ЕГАИС сформирован');
            await this.loadData();
            this.render();
        } catch (error) {
            console.error('generateReport failed', error);
            alert('❌ Ошибка при формировании отчёта');
        }
    }

    async reload() {
        await this.loadData();
        this.render();
    }

    formatDate(date) {
        try {
            return new Date(date).toLocaleString('ru-RU');
        } catch (error) {
            return date;
        }
    }
}

if (typeof window !== 'undefined') {
    window.EgaisDashboard = EgaisDashboard;
    window.egaisDashboard = new EgaisDashboard();
}

