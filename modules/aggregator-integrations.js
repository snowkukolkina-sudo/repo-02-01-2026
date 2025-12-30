/**
 * Модуль интеграций с агрегаторами доставки (упрощенная версия)
 */

class AggregatorIntegrationsModule {
    constructor(containerId = 'aggregatorIntegrations') {
        this.containerId = containerId;
        this.API_BASE = '/api/aggregators';
        this.state = {
            isLoading: false,
            error: null,
            aggregators: []
        };
    }
    
    // Метод для установки ID контейнера (если нужно изменить)
    setContainer(containerId) {
        this.containerId = containerId;
    }

    async init() {
        await this.loadData();
        this.render();
    }

    async loadData() {
        this.setState({ isLoading: true, error: null });
        try {
            const response = await fetch(this.API_BASE);
            if (!response.ok) {
                // Не выбрасываем ошибку для 404 или других статусов - просто возвращаем пустой массив
                this.setState({ aggregators: [], error: null });
                return;
            }
            const payload = await response.json();
            // API возвращает {ok: true, data: []}, а не {success: true}
            if (payload?.ok && Array.isArray(payload?.data)) {
                this.setState({ aggregators: payload.data || [] });
            } else {
                // Если формат неожиданный, используем пустой массив
                this.setState({ aggregators: [] });
            }
        } catch (error) {
            // Полностью подавляем все ошибки - не логируем и не выбрасываем
            this.setState({ aggregators: [], error: null });
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
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">🍽️ Агрегаторы доставки</h3>
                    <p class="card-subtitle">Управление интеграциями с Яндекс.Еда, Delivery Club и ВкусВилл</p>
                </div>
                <div class="aggregator-grid">
                    ${this.state.aggregators.map(item => this.renderAggregatorCard(item)).join('')}
                </div>
            </div>
        `;

        this.bindEvents();
    }

    renderLoading() {
        return `
            <div class="card">
                <h3 class="card-title">🍽️ Агрегаторы доставки</h3>
                <p>Загружаем данные...</p>
            </div>
        `;
    }

    renderError(message) {
        return `
            <div class="card" style="border-left: 4px solid #dc2626; background: #fee2e2;">
                <h3 class="card-title">🍽️ Агрегаторы доставки</h3>
                <p style="color:#b91c1c;">Ошибка: ${message}</p>
                <button class="btn btn-secondary" onclick="aggregatorIntegrationsModule.reload()">Повторить</button>
            </div>
        `;
    }

    renderAggregatorCard(aggregator) {
        const badge = this.getStatusBadge(aggregator);
        return `
            <div class="aggregator-card" data-id="${aggregator.id}">
                <div class="aggregator-card__header">
                    <div>
                        <h4>${aggregator.name}</h4>
                        <p class="aggregator-card__description">${aggregator.description || 'Интеграция доставки'}</p>
                    </div>
                    <span class="badge ${badge.className}">${badge.text}</span>
                </div>
                <div class="aggregator-card__body">
                    ${this.renderRow('ID ресторана', aggregator.restaurant_id || '—')}
                    ${this.renderRow('API ключ', aggregator.api_key ? '••••••' : '—')}
                    ${this.renderRow('Webhook URL', aggregator.webhook_url || '—')}
                    ${this.renderRow('Заказы сегодня', aggregator.orders_today || 0)}
                    ${this.renderRow('Выручка (₽)', aggregator.revenue_today ? aggregator.revenue_today.toLocaleString('ru-RU') : 0)}
                    ${this.renderRow('Обновление меню', aggregator.menu_last_sync ? this.formatDate(aggregator.menu_last_sync) : '—')}
                </div>
                <div class="aggregator-card__actions">
                    <button class="btn btn-small ${aggregator.enabled ? 'btn-danger' : 'btn-success'}" data-action="toggle">
                        ${aggregator.enabled ? '⏸️ Выключить' : '▶️ Включить'}
                    </button>
                    <button class="btn btn-small btn-secondary" data-action="edit">⚙️ Настроить</button>
                    <button class="btn btn-small btn-secondary" data-action="sync">🔄 Обновить меню</button>
                    <button class="btn btn-small btn-secondary" data-action="events">📜 События</button>
                </div>
            </div>
        `;
    }

    renderRow(label, value) {
        return `
            <div class="aggregator-card__row">
                <span class="label">${label}</span>
                <span class="value">${value}</span>
            </div>
        `;
    }

    bindEvents() {
        const root = this.container;
        if (!root) return;

        root.querySelectorAll('[data-action="toggle"]').forEach(button => {
            button.addEventListener('click', async (event) => {
                const card = event.target.closest('.aggregator-card');
                const id = card?.dataset?.id;
                const aggregator = this.state.aggregators.find(a => a.id === id);
                if (id && aggregator) {
                    await this.toggleAggregator(id, !aggregator.enabled);
                }
            });
        });

        root.querySelectorAll('[data-action="edit"]').forEach(button => {
            button.addEventListener('click', (event) => {
                const card = event.target.closest('.aggregator-card');
                const id = card?.dataset?.id;
                const aggregator = this.state.aggregators.find(a => a.id === id);
                if (aggregator) {
                    this.showConfigModal(aggregator);
                }
            });
        });

        root.querySelectorAll('[data-action="sync"]').forEach(button => {
            button.addEventListener('click', async (event) => {
                const card = event.target.closest('.aggregator-card');
                const id = card?.dataset?.id;
                if (id) {
                    await this.recordSync(id);
                }
            });
        });

        root.querySelectorAll('[data-action="events"]').forEach(button => {
            button.addEventListener('click', async (event) => {
                const card = event.target.closest('.aggregator-card');
                const id = card?.dataset?.id;
                if (id) {
                    await this.showEvents(id);
                }
            });
        });
    }

    async toggleAggregator(id, enabled) {
        try {
            const response = await fetch(`${this.API_BASE}/${id}/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled })
            });
            const result = await response.json();
            if (!response.ok || !result.ok) {
                throw new Error(result.error || `HTTP ${response.status}`);
            }
            await this.loadData();
            this.render();
        } catch (error) {
            console.error('toggleAggregator failed', error);
            alert('❌ Ошибка при переключении агрегатора');
        }
    }

    async recordSync(id) {
        try {
            const response = await fetch(`${this.API_BASE}/${id}/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    menu: true,
                    status: 'active'
                })
            });
            const result = await response.json();
            if (!response.ok || !result.ok) {
                throw new Error(result.error || `HTTP ${response.status}`);
            }
            alert('✅ Обновление меню выполнено');
            await this.loadData();
            this.render();
        } catch (error) {
            console.error('recordSync failed', error);
            alert('❌ Ошибка при обновлении меню');
        }
    }

    showConfigModal(aggregator) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:520px;">
                <div class="modal-header">
                    <h3>⚙️ Настройка: ${aggregator.name}</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <form id="aggregatorConfigForm">
                        <div class="form-group">
                            <label class="form-label">ID ресторана</label>
                            <input type="text" class="form-input" name="restaurant_id" value="${aggregator.restaurant_id || ''}" placeholder="restaurant-id">
                        </div>
                        <div class="form-group">
                            <label class="form-label">API ключ</label>
                            <input type="text" class="form-input" name="api_key" value="${aggregator.api_key || ''}" placeholder="api-key">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Webhook URL</label>
                            <input type="text" class="form-input" name="webhook_url" value="${aggregator.webhook_url || ''}" placeholder="https://example.com/webhook">
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Отмена</button>
                    <button class="btn btn-primary" onclick="aggregatorIntegrationsModule.saveAggregator('${aggregator.id}')">💾 Сохранить</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.remove();
            }
        });
    }

    async saveAggregator(id) {
        const modal = document.querySelector('.modal-overlay');
        const form = modal?.querySelector('#aggregatorConfigForm');
        if (!form) return;
        const formData = new FormData(form);
        const payload = {
            restaurant_id: formData.get('restaurant_id'),
            api_key: formData.get('api_key'),
            webhook_url: formData.get('webhook_url'),
            status: 'configured'
        };

        try {
            const response = await fetch(`${this.API_BASE}/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok || !result.ok) {
                throw new Error(result.error || `HTTP ${response.status}`);
            }
            alert('✅ Настройки агрегатора сохранены');
            modal?.remove();
            await this.loadData();
            this.render();
        } catch (error) {
            console.error('saveAggregator failed', error);
            alert('❌ Ошибка сохранения настроек агрегатора');
        }
    }

    async showEvents(id) {
        try {
            const response = await fetch(`${this.API_BASE}/${id}/events?limit=50`);
            const result = await response.json();
            if (!response.ok || !result.ok) {
                throw new Error(result.error || `HTTP ${response.status}`);
            }
            const events = result?.data?.events || [];
            this.showEventsModal(id, events);
        } catch (error) {
            console.error('showEvents failed', error);
            alert('❌ Не удалось загрузить события');
        }
    }

    showEventsModal(id, events) {
        const rows = (Array.isArray(events) ? events : []).slice(-50).map((evt) => {
            const createdAt = evt?.createdAt ? this.formatDate(evt.createdAt) : '—';
            const total = evt?.total ? Number(evt.total).toLocaleString('ru-RU') : '0';
            const raw = evt?.payload ? JSON.stringify(evt.payload) : '';
            const preview = raw.length > 240 ? (raw.slice(0, 240) + '…') : raw;
            return `
                <tr>
                    <td style="white-space:nowrap;">${createdAt}</td>
                    <td style="white-space:nowrap;">₽ ${total}</td>
                    <td style="font-family:monospace;font-size:12px;word-break:break-word;">${preview.replace(/</g,'&lt;')}</td>
                </tr>
            `;
        }).join('');

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:980px;">
                <div class="modal-header">
                    <h3>📜 События webhook: ${id}</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    ${rows ? `
                        <div class="table-responsive">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Время</th>
                                        <th>Сумма</th>
                                        <th>Payload</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rows}
                                </tbody>
                            </table>
                        </div>
                    ` : '<p>Событий нет.</p>'}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Закрыть</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (event) => {
            if (event.target === modal) modal.remove();
        });
    }

    getStatusBadge(aggregator) {
        if (!aggregator.restaurant_id || !aggregator.api_key) {
            return { text: 'Не настроено', className: 'badge-warning' };
        }
        if (aggregator.enabled) {
            return { text: 'Активно', className: 'badge-success' };
        }
        return { text: 'Настроено', className: 'badge-secondary' };
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
    window.AggregatorIntegrationsModule = AggregatorIntegrationsModule;
    window.aggregatorIntegrationsModule = new AggregatorIntegrationsModule();
}
