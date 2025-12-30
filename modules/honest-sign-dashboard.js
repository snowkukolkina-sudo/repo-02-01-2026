class HonestSignDashboard {
    constructor(containerId = 'honestModuleRoot') {
        this.containerId = containerId;
        this.API_BASE = '/api/honest';
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
                    // Игнорируем все ошибки для /api/honest/* endpoints
                    // Они могут быть не реализованы, это нормально
                    return { success: true, data: null };
                }
            };

            const [statusResult, productsResult, marksResult, reportsResult] = await Promise.all([
                safeFetch(`${this.API_BASE}/status`),
                safeFetch(`${this.API_BASE}/products`),
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
                console.error('[HonestSignDashboard] load error', error);
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
        this.state = {
            ...this.state,
            ...patch
        };
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
            <div class=\"honest-dashboard\">
                ${this.renderHeader()}
                ${this.renderStats()}
                ${this.renderMarksSection()}
                ${this.renderActionsSection()}
                ${this.renderReportsSection()}
            </div>
        `;

        this.bindEvents();
    }

    renderLoading() {
        return `
            <div class=\"card\">
                <h3 class=\"card-title\">🏷️ Честный знак</h3>
                <p>Загружаем данные...</p>
            </div>
        `;
    }

    renderError(message) {
        return `
            <div class=\"card\" style=\"border-left: 4px solid #dc2626; background: #fee2e2;\">
                <h3 class=\"card-title\">🏷️ Честный знак</h3>
                <p style=\"color:#b91c1c;\">Ошибка: ${message}</p>
                <button class=\"btn btn-secondary\" onclick=\"honestSignDashboard.reload()\">Повторить</button>
            </div>
        `;
    }

    renderHeader() {
        const status = this.state.status;
        const connected = status?.connected;

        return `
            <div class=\"card\">
                <div class=\"card-header\">
                    <h3 class=\"card-title\">🏷️ Честный знак — маркировка</h3>
                    <span class=\"badge ${connected ? 'badge-success' : 'badge-warning'}\">
                        ${connected ? 'API не настроено (демо режим)' : 'Демонстрационный режим'}
                    </span>
                </div>
                <p style=\"margin-top:0.5rem; color:#444;\">Учет движения маркированной продукции, проверка кодов и формирование отчетов в демо-контуре без API-ключей.</p>
            </div>
        `;
    }

    renderStats() {
        const status = this.state.status || {};

        return `
            <div class=\"card\">
                <div class=\"card-header\">
                    <h3 class=\"card-title\">Показатели</h3>
                </div>
                <div class=\"grid grid-4\">
                    ${this.renderStatTile('🛒 Маркированных товаров', status.products || 0)}
                    ${this.renderStatTile('🏷️ Кодов маркировки', status.marks || 0)}
                    ${this.renderStatTile('📑 Отчетов', status.reports || 0)}
                    ${this.renderStatTile('🔄 Статус', status.connected ? 'Настроено' : 'Демо режим', status.connected ? 'success' : 'warning')}
                </div>
            </div>
        `;
    }

    renderStatTile(label, value, tone = 'neutral') {
        const toneMap = {
            neutral: { bg: '#f8fafc', color: '#1f2937' },
            success: { bg: '#dcfce7', color: '#166534' },
            warning: { bg: '#fef9c3', color: '#92400e' }
        }[tone] || { bg: '#f8fafc', color: '#1f2937' };

        return `
            <div class=\"card\" style=\"background:${toneMap.bg}; color:${toneMap.color};\">
                <p style=\"margin:0; opacity:0.8;\">${label}</p>
                <p style=\"margin:0; font-size:1.8rem; font-weight:700;\">${value}</p>
            </div>
        `;
    }

    renderMarksSection() {
        const marks = (this.state.marks || []).slice(0, 6);
        if (marks.length === 0) {
            return `
                <div class=\"card\">
                    <div class=\"card-header\">
                        <h3 class=\"card-title\">Последние коды маркировки</h3>
                    </div>
                    <p style=\"color:#666;\">Нет данных по кодам маркировки в демонстрационном режиме.</p>
                </div>
            `;
        }

        return `
            <div class=\"card\">
                <div class=\"card-header\">
                    <h3 class=\"card-title\">Последние коды маркировки</h3>
                </div>
                <div class=\"table-responsive\">\n
                    <table class=\"data-table\">\n
                        <thead>\n
                            <tr>\n
                                <th>Код</th>\n
                                <th>Статус</th>\n
                                <th>Товар</th>\n
                                <th>Обновлён</th>\n
                            </tr>\n
                        </thead>\n
                        <tbody>\n
                            ${marks.map(mark => this.renderMarkRow(mark)).join('')}\n
                        </tbody>\n
                    </table>\n
                </div>\n
            </div>
        `;
    }

    renderMarkRow(mark) {
        const product = (this.state.products || []).find(p => p.id === mark.productId);
        const statusMap = {
            available: { text: 'В обороте', cls: 'badge-success' },
            sold: { text: 'Реализован', cls: 'badge-secondary' },
            returned: { text: 'Возврат', cls: 'badge-warning' },
            revoked: { text: 'Отозван', cls: 'badge-danger' }
        };
        const status = statusMap[mark.status] || { text: mark.status, cls: 'badge-secondary' };
        const updatedAt = mark.updatedAt || mark.scannedAt;

        return `
            <tr>
                <td><code>${mark.code}</code></td>
                <td><span class=\"badge ${status.cls}\">${status.text}</span></td>
                <td>${product ? product.name : '—'}</td>
                <td>${updatedAt ? this.formatDate(updatedAt) : '—'}</td>
            </tr>
        `;
    }

    renderActionsSection() {
        return `
            <div class=\"card\">
                <div class=\"card-header\">
                    <h3 class=\"card-title\">Тестовые действия</h3>
                </div>
                <div class=\"grid grid-2\" style=\"gap:1.5rem;\">
                    <div>
                        <h4 style=\"margin-top:0;\">Проверить код маркировки</h4>
                        <form id=\"honestValidateForm\" class=\"form-group\" style=\"display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap;\">\n
                            <input type=\"text\" class=\"form-input\" name=\"markCode\" placeholder=\"Вставьте код маркировки\" style=\"flex:1; min-width:220px;\" required>\n
                            <button class=\"btn btn-primary\" type=\"submit\">Проверить</button>\n
                        </form>
                        <div id=\"honestValidateResult\" style=\"margin-top:0.75rem; font-size:0.9rem; color:#1f2937;\"></div>
                    </div>
                    <div>
                        <h4 style=\"margin-top:0;\">Обновить статус марки</h4>
                        <form id=\"honestStatusForm\" class=\"form-group\" style=\"display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap;\">\n
                            <input type=\"text\" class=\"form-input\" name=\"markCode\" placeholder=\"Код марки\" style=\"flex:2; min-width:220px;\" required>\n
                            <select class=\"form-input\" name=\"status\" style=\"flex:1; min-width:160px;\">\n
                                <option value=\"sold\">sold</option>\n
                                <option value=\"available\">available</option>\n
                                <option value=\"returned\">returned</option>\n
                                <option value=\"revoked\">revoked</option>\n
                            </select>\n
                            <button class=\"btn btn-secondary\" type=\"submit\">Сохранить</button>\n
                        </form>
                        <small style=\"color:#6b7280;\">Все операции выполняются в рамках демо-режима без отправки данных в Честный знак.</small>
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
                    <h3 class=\"card-title\">Отчёты</h3>
                    <button class=\"btn btn-small btn-secondary\" onclick=\"honestSignDashboard.generateReport()\">📄 Сформировать демо-отчёт</button>
                </div>
                ${reports.length === 0 ? '<p style=\"color:#666;\">Отчеты ещё не сформированы.</p>' : `
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
        const validateForm = document.getElementById('honestValidateForm');
        if (validateForm) {
            validateForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(validateForm);
                const markCode = formData.get('markCode');
                if (markCode) {
                    this.handleValidateMark(markCode);
                }
            });
        }

        const statusForm = document.getElementById('honestStatusForm');
        if (statusForm) {
            statusForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const formData = new FormData(statusForm);
                this.handleStatusUpdate(formData.get('markCode'), formData.get('status'));
            });
        }
    }

    async handleValidateMark(markCode) {
        const resultContainer = document.getElementById('honestValidateResult');
        if (!resultContainer) return;
        resultContainer.innerHTML = 'Проверяем...';
        try {
            const response = await fetch(`${this.API_BASE}/marks/${encodeURIComponent(markCode)}/validate`);
            const data = await response.json();
            resultContainer.innerHTML = data.isValid
                ? `<span class=\"badge badge-success\">Код действителен</span> ${data.product ? `• ${data.product.name}` : ''}`
                : `<span class=\"badge badge-danger\">Код недействителен</span> ${data.errors ? data.errors.join(', ') : ''}`;
        } catch (error) {
            console.error('Validate mark failed', error);
            resultContainer.innerHTML = `<span class=\"badge badge-danger\">Ошибка: ${error.message}</span>`;
        }
    }

    async handleStatusUpdate(markCode, status) {
        if (!markCode) return;
        try {
            const response = await fetch(`${this.API_BASE}/marks/${encodeURIComponent(markCode)}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Не удалось обновить статус');
            }
            alert('✅ Статус кода обновлён (демо режим)');
            await this.loadData();
            this.render();
        } catch (error) {
            console.error('Status update failed', error);
            alert('❌ ' + error.message);
        }
    }

    async generateReport() {
        try {
            const payload = {
                type: 'demo',
                createdBy: 'admin',
                generatedAt: new Date().toISOString()
            };
            const response = await fetch(`${this.API_BASE}/reports`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            alert('📄 Демо-отчёт сформирован');
            await this.loadData();
            this.render();
        } catch (error) {
            console.error('Report generation failed', error);
            alert('❌ Ошибка формирования отчёта');
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
    window.HonestSignDashboard = HonestSignDashboard;
    window.honestSignDashboard = new HonestSignDashboard();
}

