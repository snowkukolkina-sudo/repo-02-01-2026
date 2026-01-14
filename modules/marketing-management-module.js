/**
 * DANDY Marketing Management Module
 * Управление маркетинговыми кампаниями и аналитикой
 */

class MarketingManagementModule {
    constructor() {
        this.campaigns = [];
        this.analytics = {};
        this.segments = [];
        this.storageKey = 'marketing_campaigns';
    }

    async init() {
        console.log('📈 Marketing Management Module initialized');
        await this.loadCampaigns();
        await this.loadAnalytics();
        await this.loadSegments();
        this.render();
    }

    async loadCampaigns() {
        try {
            const response = await fetch(`/api/admin-state/keys/${encodeURIComponent(this.storageKey)}`);
            if (response.ok) {
                const data = await response.json().catch(() => ({}));
                if (data && data.ok && Array.isArray(data.data)) {
                    this.campaigns = data.data;
                    return;
                }
            }
        } catch (_) {}

        this.campaigns = [
            {
                id: 1,
                name: 'Новогодняя акция',
                type: 'discount',
                status: 'active',
                start_date: '2024-01-01',
                end_date: '2024-01-31',
                budget: 50000,
                spent: 25000,
                conversions: 150,
                roi: 300
            },
            {
                id: 2,
                name: 'Реклама в Instagram',
                type: 'social',
                status: 'paused',
                start_date: '2024-01-15',
                end_date: '2024-02-15',
                budget: 30000,
                spent: 15000,
                conversions: 80,
                roi: 180
            }
        ];
    }

    async saveCampaigns() {
        try {
            const response = await fetch(`/api/admin-state/keys/${encodeURIComponent(this.storageKey)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: this.campaigns })
            });
            if (response.ok) {
                const data = await response.json().catch(() => ({}));
                if (data && data.ok) {
                    return true;
                }
            }
        } catch (_) {}
        return false;
    }

    async loadAnalytics() {
        // Заглушка для аналитики
        this.analytics = {
            total_revenue: 1250000,
            total_orders: 2500,
            average_order_value: 500,
            customer_acquisition_cost: 150,
            customer_lifetime_value: 2500,
            conversion_rate: 3.2,
            retention_rate: 65
        };
    }

    async loadSegments() {
        // Заглушка для сегментов клиентов
        this.segments = [
            { id: 1, name: 'VIP клиенты', count: 150, avg_order: 1200 },
            { id: 2, name: 'Постоянные клиенты', count: 800, avg_order: 600 },
            { id: 3, name: 'Новые клиенты', count: 1200, avg_order: 300 },
            { id: 4, name: 'Неактивные клиенты', count: 500, avg_order: 200 }
        ];
    }

    render() {
        const container = document.getElementById('marketingContent') || document.getElementById('marketing');
        if (!container) return;

        container.innerHTML = `
            <div class="marketing-management">
                <!-- Header -->
                <div class="marketing-header">
                    <h2>📈 Маркетинг</h2>
                    <div class="marketing-actions">
                        <button class="btn btn-primary" onclick="marketingModule.createCampaign()">
                            ➕ Создать кампанию
                        </button>
                        <button class="btn btn-secondary" onclick="marketingModule.showAnalytics()">
                            📊 Аналитика
                        </button>
                    </div>
                </div>

                <!-- Stats -->
                <div class="marketing-stats grid grid-4" style="margin-top: 1rem;">
                    <div class="card">
                        <h4>Активные кампании</h4>
                        <div class="stat-value">${this.campaigns.filter(c => c.status === 'active').length}</div>
                    </div>
                    <div class="card">
                        <h4>Общий бюджет</h4>
                        <div class="stat-value">₽ ${this.campaigns.reduce((sum, c) => sum + c.budget, 0).toLocaleString()}</div>
                    </div>
                    <div class="card">
                        <h4>Потрачено</h4>
                        <div class="stat-value">₽ ${this.campaigns.reduce((sum, c) => sum + c.spent, 0).toLocaleString()}</div>
                    </div>
                    <div class="card">
                        <h4>Средний ROI</h4>
                        <div class="stat-value">${Math.round(this.campaigns.reduce((sum, c) => sum + c.roi, 0) / this.campaigns.length)}%</div>
                    </div>
                </div>

                <!-- Campaigns Table -->
                <div class="card" style="margin-top: 1rem;">
                    <div class="card-header">
                        <h3>Маркетинговые кампании</h3>
                        <div style="display: flex; gap: 1rem; align-items: center;">
                            <select id="statusFilter" class="form-input" style="width: 150px;">
                                <option value="">Все статусы</option>
                                <option value="active">Активные</option>
                                <option value="paused">Приостановленные</option>
                                <option value="completed">Завершённые</option>
                            </select>
                            <button class="btn btn-secondary btn-small" onclick="marketingModule.filterByStatus()">Фильтр</button>
                        </div>
                    </div>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Название</th>
                                    <th>Тип</th>
                                    <th>Статус</th>
                                    <th>Период</th>
                                    <th>Бюджет</th>
                                    <th>Потрачено</th>
                                    <th>Конверсии</th>
                                    <th>ROI</th>
                                    <th>Действия</th>
                                </tr>
                            </thead>
                            <tbody id="campaignsTableBody">
                                ${this.renderCampaignsRows()}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Customer Segments -->
                <div class="card" style="margin-top: 1rem;">
                    <div class="card-header">
                        <h3>Сегменты клиентов</h3>
                    </div>
                    <div class="segments-grid grid grid-4">
                        ${this.segments.map(segment => `
                            <div class="segment-card">
                                <h4>${segment.name}</h4>
                                <div class="segment-stats">
                                    <div class="stat-item">
                                        <span class="stat-label">Клиентов:</span>
                                        <span class="stat-value">${segment.count}</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="stat-label">Средний чек:</span>
                                        <span class="stat-value">₽ ${segment.avg_order}</span>
                                    </div>
                                </div>
                                <button class="btn btn-small" onclick="marketingModule.targetSegment('${segment.id}')">🎯 Таргетировать</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        // Event listeners
        document.getElementById('statusFilter').addEventListener('change', () => {
            this.filterByStatus();
        });
    }

    renderCampaignsRows() {
        if (this.campaigns.length === 0) {
            return '<tr><td colspan="9" style="text-align: center;">Нет кампаний</td></tr>';
        }

        return this.campaigns.map(campaign => {
            const startDate = new Date(campaign.start_date);
            const endDate = new Date(campaign.end_date);
            const period = `${startDate.toLocaleDateString('ru-RU')} - ${endDate.toLocaleDateString('ru-RU')}`;
            
            let statusClass = 'secondary';
            let statusText = 'Неизвестно';
            
            switch (campaign.status) {
                case 'active':
                    statusClass = 'success';
                    statusText = '✅ Активная';
                    break;
                case 'paused':
                    statusClass = 'warning';
                    statusText = '⏸️ Приостановлена';
                    break;
                case 'completed':
                    statusClass = 'secondary';
                    statusText = '✅ Завершена';
                    break;
            }

            const spentPercent = Math.round((campaign.spent / campaign.budget) * 100);

            return `
                <tr data-status="${campaign.status}">
                    <td><strong>${campaign.name}</strong></td>
                    <td>${campaign.type}</td>
                    <td><span class="badge badge-${statusClass}">${statusText}</span></td>
                    <td>${period}</td>
                    <td>₽ ${campaign.budget.toLocaleString()}</td>
                    <td>₽ ${campaign.spent.toLocaleString()} (${spentPercent}%)</td>
                    <td>${campaign.conversions}</td>
                    <td><span class="badge badge-success">${campaign.roi}%</span></td>
                    <td>
                        <button class="btn btn-small" onclick="marketingModule.viewCampaign('${campaign.id}')">👁️</button>
                        <button class="btn btn-small" onclick="marketingModule.editCampaign('${campaign.id}')">✏️</button>
                        ${campaign.status === 'active' ? 
                            `<button class="btn btn-small btn-warning" onclick="marketingModule.pauseCampaign('${campaign.id}')">⏸️</button>` : 
                            `<button class="btn btn-small btn-success" onclick="marketingModule.resumeCampaign('${campaign.id}')">▶️</button>`}
                    </td>
                </tr>
            `;
        }).join('');
    }

    createCampaign() {
        const modal = this.createModal('Создать кампанию', `
            <form id="createCampaignForm">
                <div class="form-group">
                    <label class="form-label">Название кампании *</label>
                    <input type="text" name="name" class="form-input" required placeholder="Новогодняя акция">
                </div>
                <div class="form-group">
                    <label class="form-label">Тип кампании *</label>
                    <select name="type" class="form-input" required>
                        <option value="">Выберите тип</option>
                        <option value="discount">Скидка</option>
                        <option value="social">Социальные сети</option>
                        <option value="email">Email рассылка</option>
                        <option value="sms">SMS рассылка</option>
                        <option value="google">Google Ads</option>
                        <option value="yandex">Яндекс.Директ</option>
                    </select>
                </div>
                <div class="grid grid-2">
                    <div class="form-group">
                        <label class="form-label">Дата начала *</label>
                        <input type="date" name="start_date" class="form-input" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Дата окончания *</label>
                        <input type="date" name="end_date" class="form-input" required>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Бюджет (₽) *</label>
                    <input type="number" name="budget" class="form-input" min="0" step="1000" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Описание</label>
                    <textarea name="description" class="form-input" rows="3" placeholder="Описание кампании"></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Целевая аудитория</label>
                    <select name="target_segment" class="form-input">
                        <option value="">Все клиенты</option>
                        ${this.segments.map(segment => `<option value="${segment.id}">${segment.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="marketingModule.closeModal()">Отмена</button>
                    <button type="submit" class="btn btn-primary">💾 Создать кампанию</button>
                </div>
            </form>
        `);

        // Устанавливаем текущую дату
        const today = new Date().toISOString().split('T')[0];
        document.querySelector('input[name="start_date"]').value = today;

        document.getElementById('createCampaignForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitCampaign(new FormData(e.target));
        });
    }

    async submitCampaign(formData) {
        try {
            const data = {};
            for (const [key, value] of formData.entries()) {
                data[key] = value;
            }
            data.status = 'active';
            data.spent = 0;
            data.conversions = 0;
            data.roi = 0;

            // Добавляем кампанию в список
            const newCampaign = {
                id: `mk_${Date.now()}`,
                ...data,
                budget: parseFloat(data.budget)
            };
            this.campaigns.unshift(newCampaign);

            await this.saveCampaigns();

            alert('✅ Кампания создана!');
            this.closeModal();
            this.render();
        } catch (error) {
            console.error('Error creating campaign:', error);
            alert('❌ Ошибка при создании кампании');
        }
    }

    showAnalytics() {
        const modal = this.createModal('Маркетинговая аналитика', `
            <div class="marketing-analytics">
                <div class="analytics-grid grid grid-2">
                    <div class="analytics-card">
                        <h4>Общая статистика</h4>
                        <div class="analytics-stats">
                            <div class="stat-item">
                                <span class="stat-label">Общая выручка:</span>
                                <span class="stat-value">₽ ${this.analytics.total_revenue.toLocaleString()}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Всего заказов:</span>
                                <span class="stat-value">${this.analytics.total_orders}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Средний чек:</span>
                                <span class="stat-value">₽ ${this.analytics.average_order_value}</span>
                            </div>
                        </div>
                    </div>
                    <div class="analytics-card">
                        <h4>Показатели эффективности</h4>
                        <div class="analytics-stats">
                            <div class="stat-item">
                                <span class="stat-label">CAC (стоимость привлечения):</span>
                                <span class="stat-value">₽ ${this.analytics.customer_acquisition_cost}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">LTV (жизненная ценность):</span>
                                <span class="stat-value">₽ ${this.analytics.customer_lifetime_value}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Конверсия:</span>
                                <span class="stat-value">${this.analytics.conversion_rate}%</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Удержание:</span>
                                <span class="stat-value">${this.analytics.retention_rate}%</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button class="btn btn-secondary" onclick="marketingModule.closeModal()">Закрыть</button>
                    <button class="btn btn-primary" onclick="marketingModule.exportAnalytics()">📊 Экспорт данных</button>
                </div>
            </div>
        `, '', 'large');
    }

    viewCampaign(campaignId) {
        const campaign = this.campaigns.find(c => c.id == campaignId);
        if (!campaign) return;

        const modal = this.createModal(`Кампания: ${campaign.name}`, `
            <div class="campaign-details">
                <div class="grid grid-2">
                    <div>
                        <p><strong>Название:</strong> ${campaign.name}</p>
                        <p><strong>Тип:</strong> ${campaign.type}</p>
                        <p><strong>Статус:</strong> ${campaign.status}</p>
                        <p><strong>Период:</strong> ${new Date(campaign.start_date).toLocaleDateString('ru-RU')} - ${new Date(campaign.end_date).toLocaleDateString('ru-RU')}</p>
                    </div>
                    <div>
                        <p><strong>Бюджет:</strong> ₽ ${campaign.budget.toLocaleString()}</p>
                        <p><strong>Потрачено:</strong> ₽ ${campaign.spent.toLocaleString()}</p>
                        <p><strong>Конверсии:</strong> ${campaign.conversions}</p>
                        <p><strong>ROI:</strong> ${campaign.roi}%</p>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button class="btn btn-secondary" onclick="marketingModule.closeModal()">Закрыть</button>
                    <button class="btn btn-primary" onclick="marketingModule.editCampaign('${campaign.id}')">✏️ Редактировать</button>
                </div>
            </div>
        `, '', 'large');
    }

    editCampaign(campaignId) {
        alert('🚧 Редактирование кампании - в разработке');
    }

    pauseCampaign(campaignId) {
        const campaign = this.campaigns.find(c => c.id == campaignId);
        if (!campaign) return;

        if (confirm(`Приостановить кампанию "${campaign.name}"?`)) {
            campaign.status = 'paused';
            alert('⏸️ Кампания приостановлена');
            this.saveCampaigns();
            this.render();
        }
    }

    resumeCampaign(campaignId) {
        const campaign = this.campaigns.find(c => c.id == campaignId);
        if (!campaign) return;

        if (confirm(`Возобновить кампанию "${campaign.name}"?`)) {
            campaign.status = 'active';
            alert('▶️ Кампания возобновлена');
            this.saveCampaigns();
            this.render();
        }
    }

    targetSegment(segmentId) {
        const segment = this.segments.find(s => s.id == segmentId);
        if (!segment) return;

        alert(`🎯 Таргетирование сегмента "${segment.name}" (${segment.count} клиентов)`);
    }

    filterByStatus() {
        const statusFilter = document.getElementById('statusFilter').value;
        const rows = document.querySelectorAll('#campaignsTableBody tr');
        
        rows.forEach(row => {
            if (!statusFilter) {
                row.style.display = '';
            } else {
                row.style.display = row.getAttribute('data-status') === statusFilter ? '' : 'none';
            }
        });
    }

    exportAnalytics() {
        alert('📊 Экспорт аналитических данных...');
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
                    <button class="modal-close" onclick="marketingModule.closeModal()">×</button>
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
    window.MarketingManagementModule = MarketingManagementModule;
    window.marketingModule = new MarketingManagementModule();
}
