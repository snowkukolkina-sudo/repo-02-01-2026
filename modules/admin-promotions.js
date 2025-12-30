/**
 * DANDY Promotions Management Module  
 * Управление акциями, бонусами и программой лояльности
 */

class PromotionsManagementModule {
    constructor() {
        this.promotions = [];
        this.loyaltyStats = null;
        this.API_BASE = '/api/admin-state/keys/promotions';
        this.LOYALTY_BASE = '/api/loyalty';
    }

    async init() {
        console.log('🎁 Promotions Management Module initialized');
        await this.loadPromotions();
        await this.loadLoyaltyStats();
        this.render();
    }

    async loadPromotions() {
        try {
            console.log('🔄 Загружаем акции из:', this.API_BASE);
            const response = await fetch(this.API_BASE);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const payload = await response.json();
            console.log('📦 Ответ сервера:', payload);
            if (payload && Object.prototype.hasOwnProperty.call(payload, 'data')) {
                this.promotions = Array.isArray(payload.data) ? payload.data : [];
                console.log('✅ Акции загружены:', this.promotions.length);
                if (this.promotions.length > 0) {
                    console.log('📋 Список акций:', this.promotions.map(p => ({
                        id: p.id,
                        name: p.name || p.title,
                        status: p.status || (p.isActive ? 'active' : 'disabled'),
                        startDate: p.start_date || p.startDate,
                        endDate: p.end_date || p.endDate
                    })));
                }
            } else {
                console.warn('⚠️ Неожиданный формат ответа:', payload);
                this.promotions = [];
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки акций:', error);
            this.promotions = [];
        }
    }

    async savePromotions() {
        try {
            console.log('💾 Сохранение акций, всего:', this.promotions.length);
            const response = await fetch(this.API_BASE, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: this.promotions })
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ HTTP ошибка:', response.status, errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            const payload = await response.json();
            console.log('📦 Ответ сервера при сохранении:', payload);
            if (payload && payload.ok) {
                console.log('✅ Акции сохранены успешно');
                return true;
            }
            throw new Error(payload?.error || 'Не удалось сохранить акции');
        } catch (error) {
            console.error('❌ Ошибка сохранения акций:', error);
            throw error;
        }
    }

    async loadLoyaltyStats() {
        try {
            const response = await fetch(`${this.LOYALTY_BASE}/stats`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            if (data.success) {
                this.loyaltyStats = data.data;
            }
        } catch (error) {
            console.error('Error loading loyalty stats:', error);
        }
    }

    render() {
        const container = document.getElementById('promotionsContent') || document.getElementById('promotions');
        if (!container) {
            console.warn('⚠️ Контейнер для промо не найден (promotionsContent или promotions)');
            return;
        }
        console.log('🎨 Рендерим промо модуль, акций:', this.promotions.length);

        container.innerHTML = `
            <div class="promotions-management">
                <!-- Header -->
                <div class="promotions-header">
                    <h2>🎁 Акции и бонусы</h2>
                    <div class="promotions-actions">
                        <button class="btn btn-success" onclick="promotionsModule.showCreatePromotion()">
                            ➕ Создать акцию
                        </button>
                        <button class="btn btn-secondary" onclick="promotionsModule.showLoyaltySettings()">
                            ⚙️ Настройки бонусов
                        </button>
                    </div>
                </div>

                <!-- Stats -->
                <div class="promotions-stats grid grid-4" style="margin-top: 1rem;">
                    <div class="card">
                        <h4>Активных акций</h4>
                        <div class="stat-value text-success">${this.promotions.filter(p => {
                            const status = p.status || (p.isActive ? 'active' : 'disabled');
                            return status === 'active';
                        }).length}</div>
                    </div>
                    <div class="card">
                        <h4>Всего акций</h4>
                        <div class="stat-value">${this.promotions.length}</div>
                    </div>
                    <div class="card">
                        <h4>Начислено баллов</h4>
                        <div class="stat-value text-success">${this.loyaltyStats?.total_earned || 0}</div>
                    </div>
                    <div class="card">
                        <h4>Списано баллов</h4>
                        <div class="stat-value text-warning">${this.loyaltyStats?.total_redeemed || 0}</div>
                    </div>
                </div>

                <!-- Tabs -->
                <div class="tabs-container" style="margin-top: 1.5rem;">
                    <div class="tabs-nav">
                        <button class="tab-button active" onclick="promotionsModule.switchTab('promotions')">📋 Акции</button>
                        <button class="tab-button" onclick="promotionsModule.switchTab('loyalty')">💎 Программа лояльности</button>
                        <button class="tab-button" onclick="promotionsModule.switchTab('promo-codes')">🎟️ Промо-коды</button>
                    </div>

                    <div id="promotions-tab" class="tab-content active">
                        ${this.renderPromotionsTab()}
                    </div>

                    <div id="loyalty-tab" class="tab-content">
                        ${this.renderLoyaltyTab()}
                    </div>

                    <div id="promo-codes-tab" class="tab-content">
                        ${this.renderPromoCodesTab()}
                    </div>
                </div>
            </div>
        `;
    }

    renderPromotionsTab() {
        return `
            <div class="card">
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Название</th>
                                <th>Тип</th>
                                <th>Скидка</th>
                                <th>Период</th>
                                <th>Использовано</th>
                                <th>Статус</th>
                                <th>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.renderPromotionsRows()}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    renderPromotionsRows() {
        console.log('🎨 Рендерим строки акций, всего:', this.promotions.length);
        if (this.promotions.length === 0) {
            console.log('⚠️ Список акций пуст');
            return '<tr><td colspan="7" style="text-align: center;">Нет акций</td></tr>';
        }

        const typeNames = {
            discount: '💰 Скидка',
            bogo: '🎉 2 по цене 1',
            gift: '🎁 Подарок',
            combo: '📦 Комбо',
            freebie: '🆓 За 1₽'
        };

        const statusNames = {
            active: '✅ Активна',
            scheduled: '⏰ Запланирована',
            expired: '⏹️ Истекла',
            disabled: '❌ Отключена'
        };

        return this.promotions.map(promo => {
            // Поддержка обоих форматов: нового (title, discount, startDate, endDate, isActive) и старого (name, discount_value, start_date, end_date, status)
            const name = promo.name || promo.title || 'Без названия';
            const description = promo.description || '';
            const discountValue = promo.discount_value || promo.discount || 0;
            const discountType = promo.discount_type || 'percentage';
            const startDateRaw = promo.start_date || promo.startDate;
            const endDateRaw = promo.end_date || promo.endDate;
            const status = promo.status || (promo.isActive ? 'active' : 'disabled');
            const type = promo.type || 'discount';
            
            let startDate = '—';
            let endDate = '∞';
            try {
                if (startDateRaw) {
                    const start = new Date(startDateRaw);
                    if (!isNaN(start.getTime())) {
                        startDate = start.toLocaleDateString('ru-RU');
                    }
                }
                if (endDateRaw) {
                    const end = new Date(endDateRaw);
                    if (!isNaN(end.getTime())) {
                        endDate = end.toLocaleDateString('ru-RU');
                    }
                }
            } catch (error) {
                console.warn('Ошибка парсинга дат:', error);
            }
            
            let discount = '-';
            if (discountType === 'percentage') {
                discount = `${discountValue}%`;
            } else if (discountType === 'fixed') {
                discount = `₽ ${discountValue}`;
            } else if (discountValue > 0) {
                discount = `${discountValue}%`; // Fallback для старого формата
            }

            const statusClass = status === 'active' ? 'success' : status === 'scheduled' ? 'warning' : 'secondary';

            return `
                <tr>
                    <td><strong>${name}</strong></td>
                    <td>${typeNames[type] || type}</td>
                    <td>${discount}</td>
                    <td>${startDate} - ${endDate}</td>
                    <td>${promo.current_uses || 0} / ${promo.max_uses || '∞'}</td>
                    <td><span class="badge badge-${statusClass}">${statusNames[status] || 'Неизвестно'}</span></td>
                    <td>
                        <button class="btn btn-small" onclick="promotionsModule.showPromotionDetails('${promo.id}')">👁️</button>
                        <button class="btn btn-small" onclick="promotionsModule.editPromotion('${promo.id}')">✏️</button>
                        <button class="btn btn-small ${status === 'active' ? 'btn-warning' : 'btn-success'}" onclick="promotionsModule.togglePromotionStatus('${promo.id}')">
                            ${status === 'active' ? '👁️‍🗨️ Скрыть' : '👁️ Показать'}
                        </button>
                        <button class="btn btn-small btn-danger" onclick="promotionsModule.deletePromotion('${promo.id}')">🗑️</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    renderLoyaltyTab() {
        const tiers = [
            { name: 'bronze', label: '🥉 Бронзовый', minSpent: 0, multiplier: 1 },
            { name: 'silver', label: '🥈 Серебряный', minSpent: 10000, multiplier: 1.5 },
            { name: 'gold', label: '🥇 Золотой', minSpent: 50000, multiplier: 2 },
            { name: 'platinum', label: '💎 Платиновый', minSpent: 100000, multiplier: 3 }
        ];

        return `
            <div class="card">
                <div class="card-header">
                    <h3>💎 Уровни лояльности</h3>
                </div>
                <div class="loyalty-tiers" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
                    ${tiers.map(tier => {
                        const count = this.loyaltyStats?.customers_by_tier?.find(c => c.tier === tier.name)?.count || 0;
                        return `
                            <div class="tier-card card" style="background: linear-gradient(135deg, #0b5c3b 0%, #0f6b49 100%); color: white;">
                                <h3>${tier.label}</h3>
                                <p style="opacity: 0.9;">От ₽ ${tier.minSpent.toLocaleString()}</p>
                                <p style="font-size: 1.2rem; font-weight: bold;">${tier.multiplier}x кэшбэк</p>
                                <p style="margin-top: 1rem; opacity: 0.8;">👥 ${count} клиентов</p>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <div class="card" style="margin-top: 1rem;">
                <div class="card-header">
                    <h3>🔍 Поиск клиента</h3>
                </div>
                <div style="display: flex; gap: 1rem;">
                    <input type="text" id="customerPhone" placeholder="+7 (___) ___-__-__" class="form-input" style="flex: 1;">
                    <button class="btn btn-primary" onclick="promotionsModule.searchCustomer()">🔍 Найти</button>
                </div>
                <div id="customerLoyaltyInfo" style="margin-top: 1rem;"></div>
            </div>

            <div class="card" style="margin-top: 1rem;">
                <div class="card-header">
                    <h3>📊 Статистика бонусной программы</h3>
                </div>
                <div class="grid grid-3">
                    <div>
                        <p class="info-label">Начислено баллов:</p>
                        <p class="info-value text-success">${this.loyaltyStats?.total_earned || 0}</p>
                    </div>
                    <div>
                        <p class="info-label">Списано баллов:</p>
                        <p class="info-value text-warning">${this.loyaltyStats?.total_redeemed || 0}</p>
                    </div>
                    <div>
                        <p class="info-label">Баланс:</p>
                        <p class="info-value">${(this.loyaltyStats?.total_earned || 0) - (this.loyaltyStats?.total_redeemed || 0)}</p>
                    </div>
                </div>
            </div>
        `;
    }

    renderPromoCodesTab() {
        return `
            <div class="card">
                <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <h3>🎟️ Промо-коды</h3>
                    <button class="btn btn-primary" onclick="promotionsModule.showGeneratePromoCode()">➕ Сгенерировать промо-код</button>
                </div>
                <div id="promoCodesContent" style="margin-top: 1rem;">
                    <p style="text-align: center; color: #666;">Загрузка промо-кодов...</p>
                </div>
            </div>
        `;
    }

    switchTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });

        // Show selected tab
        document.getElementById(`${tabName}-tab`).classList.add('active');
        event.target.classList.add('active');

        // Load data for specific tabs
        if (tabName === 'promo-codes') {
            this.loadPromoCodes();
        }
    }

    showCreatePromotion() {
        // Устанавливаем текущую дату и время по умолчанию
        const now = new Date();
        // Начало акции - сегодня
        const startDate = now.toISOString().slice(0, 16);
        // Конец акции - через год (не через неделю, как было раньше)
        const endDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
        console.log('📅 Даты по умолчанию для новой акции:', startDate, 'до', endDate);

        const modal = this.createModal('Создать акцию', `
            <form id="promotionForm">
                <div class="form-group">
                    <label class="form-label">Название акции *</label>
                    <input type="text" name="name" class="form-input" required placeholder="Например: Скидка 20% на пиццу">
                </div>
                <div class="form-group">
                    <label class="form-label">Описание</label>
                    <textarea name="description" class="form-input" rows="2" placeholder="Описание акции для клиентов"></textarea>
                </div>
                <div class="grid grid-2">
                    <div class="form-group">
                        <label class="form-label">Тип акции *</label>
                        <select name="type" class="form-input" required>
                            <option value="discount">💰 Скидка</option>
                            <option value="bogo">🎉 2 по цене 1</option>
                            <option value="gift">🎁 Подарок</option>
                            <option value="combo">📦 Комбо-набор</option>
                            <option value="freebie">🆓 Товар за 1₽</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Тип скидки</label>
                        <select name="discount_type" class="form-input">
                            <option value="none">Без скидки</option>
                            <option value="percentage">Процент %</option>
                            <option value="fixed">Фиксированная ₽</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Размер скидки</label>
                    <input type="number" name="discount_value" class="form-input" step="0.01" min="0" placeholder="0">
                </div>
                <div class="grid grid-2">
                    <div class="form-group">
                        <label class="form-label">Начало акции *</label>
                        <input type="datetime-local" name="start_date" class="form-input" required value="${startDate}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Конец акции</label>
                        <input type="datetime-local" name="end_date" class="form-input" value="${endDate}">
                    </div>
                </div>
                <div class="grid grid-2">
                    <div class="form-group">
                        <label class="form-label">Мин. сумма заказа</label>
                        <input type="number" name="min_order_amount" class="form-input" step="0.01" min="0" placeholder="0">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Макс. использований</label>
                        <input type="number" name="max_uses" class="form-input" min="1" placeholder="Без ограничений">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Промо-код (опционально)</label>
                    <input type="text" name="promo_code" class="form-input" placeholder="SALE2024">
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="promotionsModule.closeModal()">Отмена</button>
                    <button type="submit" class="btn btn-primary">💾 Сохранить</button>
                </div>
            </form>
        `, '', 'large');

        document.getElementById('promotionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitPromotion(new FormData(e.target));
        });
    }

    async submitPromotion(formData) {
        try {
            const data = {};
            for (const [key, value] of formData.entries()) {
                data[key] = value || null;
            }

            // Создаём новую акцию (поддержка обоих форматов для совместимости)
            // Конвертируем datetime-local в ISO формат
            let startDateRaw = data.start_date || new Date().toISOString();
            let endDateRaw = data.end_date || null;
            
            // Если формат datetime-local (YYYY-MM-DDTHH:mm), конвертируем в ISO
            if (startDateRaw && !startDateRaw.includes('T') && startDateRaw.includes(' ')) {
                startDateRaw = startDateRaw.replace(' ', 'T');
            }
            if (endDateRaw && !endDateRaw.includes('T') && endDateRaw.includes(' ')) {
                endDateRaw = endDateRaw.replace(' ', 'T');
            }
            
            // Если только дата без времени, добавляем время
            if (/^\d{4}-\d{2}-\d{2}$/.test(startDateRaw)) {
                startDateRaw = startDateRaw + 'T00:00:00';
            }
            if (endDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(endDateRaw)) {
                endDateRaw = endDateRaw + 'T23:59:59';
            }
            
            const newPromotion = {
                id: Date.now(), // Временный ID
                // Старый формат (для совместимости с админкой)
                name: data.name || '',
                description: data.description || '',
                type: data.type || 'discount',
                discount_type: data.discount_type || 'percentage',
                discount_value: data.discount_value ? parseFloat(data.discount_value) : 0,
                min_order_amount: data.min_order_amount ? parseFloat(data.min_order_amount) : null,
                max_uses: data.max_uses ? parseInt(data.max_uses) : null,
                promo_code: data.promo_code || null,
                status: 'active', // Всегда активна при создании
                start_date: startDateRaw,
                end_date: endDateRaw,
                current_uses: 0,
                created_at: new Date().toISOString(),
                // Новый формат (для витрины)
                title: data.name || '',
                discount: data.discount_value ? parseFloat(data.discount_value) : 0,
                startDate: startDateRaw,
                endDate: endDateRaw,
                isActive: true, // Всегда активна при создании
                photo: '',
                products: []
            };
            
            console.log('📝 Создана новая акция:', {
                id: newPromotion.id,
                name: newPromotion.name,
                title: newPromotion.title,
                status: newPromotion.status,
                isActive: newPromotion.isActive,
                startDate: newPromotion.startDate,
                endDate: newPromotion.endDate,
                start_date: newPromotion.start_date,
                end_date: newPromotion.end_date
            });

            // Добавляем в массив
            this.promotions.push(newPromotion);
            console.log('➕ Акция добавлена в массив, ID:', newPromotion.id, 'Всего акций:', this.promotions.length);

            // Сохраняем на сервер
            await this.savePromotions();
            console.log('💾 Акции сохранены на сервер');
            
            alert('✅ Акция успешно создана!');
            this.closeModal();
            await this.loadPromotions();
            console.log('🔄 Акции перезагружены после создания');
            this.render();
        } catch (error) {
            console.error('Error creating promotion:', error);
            alert('❌ Ошибка: ' + (error.message || 'Неизвестная ошибка'));
        }
    }

    async searchCustomer() {
        const phone = document.getElementById('customerPhone').value;
        if (!phone) {
            alert('Введите номер телефона');
            return;
        }

        try {
            const response = await fetch(`${this.LOYALTY_BASE}/customer/phone/${encodeURIComponent(phone)}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const result = await response.json();
            if (result.success) {
                const { customer, loyalty } = result.data;
                document.getElementById('customerLoyaltyInfo').innerHTML = `
                    <div class="card" style="background: #f8f9fa;">
                        <h4>👤 ${customer.name || 'Клиент'}</h4>
                        <div class="grid grid-3">
                            <div>
                                <p class="info-label">Баллы:</p>
                                <p class="info-value text-success">${loyalty.points}</p>
                            </div>
                            <div>
                                <p class="info-label">Уровень:</p>
                                <p class="info-value">${loyalty.tier}</p>
                            </div>
                            <div>
                                <p class="info-label">Потрачено:</p>
                                <p class="info-value">₽ ${loyalty.lifetime_spent.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                alert('Клиент не найден');
            }
        } catch (error) {
            console.error('Error searching customer:', error);
            alert('❌ Ошибка поиска');
        }
    }

    async togglePromotionStatus(promotionId) {
        try {
            console.log('🔄 Переключение статуса акции, ID:', promotionId, 'Тип:', typeof promotionId);
            console.log('📋 Всего акций:', this.promotions.length);
            console.log('📋 ID акций:', this.promotions.map(p => ({ id: p.id, type: typeof p.id, name: p.name || p.title })));
            
            const promotionIndex = this.promotions.findIndex(p => {
                // Сравниваем по разным форматам ID
                const pId = p.id;
                const searchId = promotionId;
                return pId == searchId || String(pId) === String(searchId) || parseInt(pId) === parseInt(searchId);
            });
            
            if (promotionIndex === -1) {
                console.error('❌ Акция не найдена, ID:', promotionId);
                alert('❌ Акция не найдена (ID: ' + promotionId + ')');
                return;
            }
            
            console.log('✅ Акция найдена на индексе:', promotionIndex);

            const promotion = this.promotions[promotionIndex];
            const currentStatus = promotion.status || (promotion.isActive ? 'active' : 'disabled');
            const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
            
            // Обновляем статус в обоих форматах
            promotion.status = newStatus;
            promotion.isActive = newStatus === 'active';
            
            // Сохраняем обновлённый массив
            await this.savePromotions();
            
            alert(`✅ Акция ${newStatus === 'active' ? 'активирована' : 'деактивирована'}!`);
            await this.loadPromotions();
            this.render();
        } catch (error) {
            console.error('Error toggling promotion status:', error);
            alert('❌ Ошибка: ' + (error.message || 'Неизвестная ошибка'));
        }
    }

    async deletePromotion(promotionId) {
        if (!confirm('Вы уверены, что хотите удалить эту акцию?')) {
            return;
        }

        try {
            console.log('🗑️ Удаление акции, ID:', promotionId, 'Тип:', typeof promotionId);
            console.log('📋 Всего акций:', this.promotions.length);
            console.log('📋 ID акций:', this.promotions.map(p => ({ id: p.id, type: typeof p.id, name: p.name || p.title })));
            
            const promotionIndex = this.promotions.findIndex(p => {
                // Сравниваем по разным форматам ID
                const pId = p.id;
                const searchId = promotionId;
                return pId == searchId || String(pId) === String(searchId) || parseInt(pId) === parseInt(searchId);
            });
            
            if (promotionIndex === -1) {
                console.error('❌ Акция не найдена, ID:', promotionId);
                alert('❌ Акция не найдена (ID: ' + promotionId + ')');
                return;
            }
            
            console.log('✅ Акция найдена на индексе:', promotionIndex, this.promotions[promotionIndex]);

            // Удаляем акцию из массива
            this.promotions.splice(promotionIndex, 1);

            // Сохраняем обновлённый массив
            await this.savePromotions();
            
            alert('✅ Акция удалена!');
            await this.loadPromotions();
            this.render();
        } catch (error) {
            console.error('Error deleting promotion:', error);
            alert('❌ Ошибка: ' + (error.message || 'Неизвестная ошибка'));
        }
    }

    showPromotionDetails(promotionId) {
        console.log('👁️ Просмотр деталей акции, ID:', promotionId);
        const promotion = this.promotions.find(p => {
            const pId = p.id;
            const searchId = promotionId;
            return pId == searchId || String(pId) === String(searchId) || parseInt(pId) === parseInt(searchId);
        });
        if (!promotion) {
            console.error('❌ Акция не найдена, ID:', promotionId);
            alert('Акция не найдена (ID: ' + promotionId + ')');
            return;
        }

        // Поддержка обоих форматов
        const name = promotion.name || promotion.title || 'Без названия';
        const startDateRaw = promotion.start_date || promotion.startDate;
        const endDateRaw = promotion.end_date || promotion.endDate;
        const discountValue = promotion.discount_value || promotion.discount || 0;
        const discountType = promotion.discount_type || 'percentage';
        
        let startDate = '—';
        let endDate = 'Без ограничений';
        try {
            if (startDateRaw) {
                const start = new Date(startDateRaw);
                if (!isNaN(start.getTime())) {
                    startDate = start.toLocaleString('ru-RU');
                }
            }
            if (endDateRaw) {
                const end = new Date(endDateRaw);
                if (!isNaN(end.getTime())) {
                    endDate = end.toLocaleString('ru-RU');
                }
            }
        } catch (error) {
            console.warn('Ошибка парсинга дат:', error);
        }
        
        let discount = '-';
        if (discountType === 'percentage') {
            discount = `${discountValue}%`;
        } else if (discountType === 'fixed') {
            discount = `₽ ${discountValue}`;
        } else if (discountValue > 0) {
            discount = `${discountValue}%`; // Fallback
        }

        const status = promotion.status || (promotion.isActive ? 'active' : 'disabled');
        const statusNames = {
            active: '✅ Активна',
            scheduled: '⏰ Запланирована',
            expired: '⏹️ Истекла',
            disabled: '❌ Отключена'
        };

        this.createModal(`Детали акции: ${name}`, `
            <div class="promotion-details">
                <div class="grid grid-2">
                    <div>
                        <p><strong>Название:</strong> ${name}</p>
                        <p><strong>Тип:</strong> ${promotion.type || 'discount'}</p>
                        <p><strong>Скидка:</strong> ${discount}</p>
                        <p><strong>Статус:</strong> ${statusNames[status] || 'Неизвестно'}</p>
                    </div>
                    <div>
                        <p><strong>Начало:</strong> ${startDate}</p>
                        <p><strong>Конец:</strong> ${endDate}</p>
                        <p><strong>Использовано:</strong> ${promotion.current_uses || 0} / ${promotion.max_uses || '∞'}</p>
                        <p><strong>Мин. сумма:</strong> ${promotion.min_order_amount ? '₽' + promotion.min_order_amount : 'Нет'}</p>
                    </div>
                </div>
                
                ${promotion.description ? `<p><strong>Описание:</strong> ${promotion.description}</p>` : ''}
                
                ${promotion.promo_code ? `<p><strong>Промо-код:</strong> <code style="background: #f0f0f0; padding: 0.25rem 0.5rem; border-radius: 4px;">${promotion.promo_code}</code></p>` : ''}
            </div>
            <div class="form-actions">
                <button class="btn btn-secondary" onclick="promotionsModule.closeModal()">Закрыть</button>
                <button class="btn btn-primary" onclick="promotionsModule.editPromotion('${promotion.id}')">✏️ Редактировать</button>
            </div>
        `, '', 'large');
    }

    editPromotion(promotionId) {
        console.log('✏️ Редактирование акции, ID:', promotionId);
        const promotion = this.promotions.find(p => {
            const pId = p.id;
            const searchId = promotionId;
            return pId == searchId || String(pId) === String(searchId) || parseInt(pId) === parseInt(searchId);
        });
        if (!promotion) {
            console.error('❌ Акция не найдена, ID:', promotionId);
            alert('Акция не найдена (ID: ' + promotionId + ')');
            return;
        }
        
        console.log('✅ Акция найдена:', promotion);

        // Поддержка обоих форматов
        const name = promotion.name || promotion.title || '';
        const startDateRaw = promotion.start_date || promotion.startDate;
        const endDateRaw = promotion.end_date || promotion.endDate;
        
        // Устанавливаем даты в правильном формате
        let startDate = '';
        let endDate = '';
        try {
            if (startDateRaw) {
                const start = new Date(startDateRaw);
                if (!isNaN(start.getTime())) {
                    startDate = start.toISOString().slice(0, 16);
                }
            }
            if (endDateRaw) {
                const end = new Date(endDateRaw);
                if (!isNaN(end.getTime())) {
                    endDate = end.toISOString().slice(0, 16);
                }
            }
        } catch (error) {
            console.warn('Ошибка парсинга дат:', error);
        }

        const modal = this.createModal('Редактировать акцию', `
            <form id="editPromotionForm">
                <input type="hidden" name="id" value="${promotion.id}">
                <div class="form-group">
                    <label class="form-label">Название акции *</label>
                    <input type="text" name="name" class="form-input" required value="${name}">
                </div>
                <div class="form-group">
                    <label class="form-label">Описание</label>
                    <textarea name="description" class="form-input" rows="2">${promotion.description || ''}</textarea>
                </div>
                <div class="grid grid-2">
                    <div class="form-group">
                        <label class="form-label">Тип акции *</label>
                        <select name="type" class="form-input" required>
                            <option value="discount" ${promotion.type === 'discount' ? 'selected' : ''}>💰 Скидка</option>
                            <option value="bogo" ${promotion.type === 'bogo' ? 'selected' : ''}>🎉 2 по цене 1</option>
                            <option value="gift" ${promotion.type === 'gift' ? 'selected' : ''}>🎁 Подарок</option>
                            <option value="combo" ${promotion.type === 'combo' ? 'selected' : ''}>📦 Комбо-набор</option>
                            <option value="freebie" ${promotion.type === 'freebie' ? 'selected' : ''}>🆓 Товар за 1₽</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Тип скидки</label>
                        <select name="discount_type" class="form-input">
                            <option value="none" ${promotion.discount_type === 'none' ? 'selected' : ''}>Без скидки</option>
                            <option value="percentage" ${promotion.discount_type === 'percentage' ? 'selected' : ''}>Процент %</option>
                            <option value="fixed" ${promotion.discount_type === 'fixed' ? 'selected' : ''}>Фиксированная ₽</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Размер скидки</label>
                    <input type="number" name="discount_value" class="form-input" step="0.01" min="0" value="${promotion.discount_value || ''}">
                </div>
                <div class="grid grid-2">
                    <div class="form-group">
                        <label class="form-label">Начало акции *</label>
                        <input type="datetime-local" name="start_date" class="form-input" required value="${startDate}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Конец акции</label>
                        <input type="datetime-local" name="end_date" class="form-input" value="${endDate}">
                    </div>
                </div>
                <div class="grid grid-2">
                    <div class="form-group">
                        <label class="form-label">Мин. сумма заказа</label>
                        <input type="number" name="min_order_amount" class="form-input" step="0.01" min="0" value="${promotion.min_order_amount || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Макс. использований</label>
                        <input type="number" name="max_uses" class="form-input" min="1" value="${promotion.max_uses || ''}">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Промо-код (опционально)</label>
                    <input type="text" name="promo_code" class="form-input" value="${promotion.promo_code || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Статус</label>
                    <select name="status" class="form-input">
                        <option value="active" ${promotion.status === 'active' ? 'selected' : ''}>Активна</option>
                        <option value="scheduled" ${promotion.status === 'scheduled' ? 'selected' : ''}>Запланирована</option>
                        <option value="disabled" ${promotion.status === 'disabled' ? 'selected' : ''}>Отключена</option>
                    </select>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="promotionsModule.closeModal()">Отмена</button>
                    <button type="submit" class="btn btn-primary">💾 Сохранить изменения</button>
                </div>
            </form>
        `, '', 'large');

        document.getElementById('editPromotionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updatePromotion(new FormData(e.target));
        });
    }

    async updatePromotion(formData) {
        try {
            const data = {};
            for (const [key, value] of formData.entries()) {
                data[key] = value || null;
            }

            const promotionId = data.id;
            if (!promotionId) {
                alert('❌ Ошибка: ID акции не указан');
                return;
            }

            console.log('🔄 Обновление акции, ID:', promotionId);
            const promotionIndex = this.promotions.findIndex(p => {
                const pId = p.id;
                const searchId = promotionId;
                return pId == searchId || String(pId) === String(searchId) || parseInt(pId) === parseInt(searchId);
            });
            if (promotionIndex === -1) {
                console.error('❌ Акция не найдена, ID:', promotionId);
                alert('❌ Акция не найдена (ID: ' + promotionId + ')');
                return;
            }
            
            console.log('✅ Акция найдена на индексе:', promotionIndex);

            // Обновляем данные акции
            const promotion = this.promotions[promotionIndex];
            promotion.name = data.name || promotion.name || promotion.title || '';
            promotion.title = promotion.name; // Синхронизируем оба поля
            promotion.description = data.description !== null && data.description !== undefined ? data.description : (promotion.description || '');
            promotion.type = data.type || promotion.type || 'discount';
            promotion.discount_type = data.discount_type || promotion.discount_type || 'percentage';
            promotion.discount_value = data.discount_value ? parseFloat(data.discount_value) : (promotion.discount_value || promotion.discount || 0);
            promotion.discount = promotion.discount_value; // Синхронизируем оба поля
            promotion.min_order_amount = data.min_order_amount ? parseFloat(data.min_order_amount) : (promotion.min_order_amount || null);
            promotion.max_uses = data.max_uses ? parseInt(data.max_uses) : (promotion.max_uses || null);
            promotion.promo_code = data.promo_code !== null && data.promo_code !== undefined ? data.promo_code : (promotion.promo_code || null);
            promotion.status = data.status || promotion.status || (promotion.isActive ? 'active' : 'disabled');
            promotion.isActive = promotion.status === 'active'; // Синхронизируем оба поля
            // Обновляем даты в обоих форматах
            // Конвертируем datetime-local в ISO формат
            let startDateRaw = data.start_date || promotion.start_date || promotion.startDate || new Date().toISOString();
            let endDateRaw = data.end_date !== null && data.end_date !== undefined ? data.end_date : (promotion.end_date || promotion.endDate || null);
            
            // Если формат datetime-local (YYYY-MM-DDTHH:mm), конвертируем в ISO
            if (startDateRaw && !startDateRaw.includes('T') && startDateRaw.includes(' ')) {
                startDateRaw = startDateRaw.replace(' ', 'T');
            }
            if (endDateRaw && !endDateRaw.includes('T') && endDateRaw.includes(' ')) {
                endDateRaw = endDateRaw.replace(' ', 'T');
            }
            
            // Если только дата без времени, добавляем время
            if (/^\d{4}-\d{2}-\d{2}$/.test(startDateRaw)) {
                startDateRaw = startDateRaw + 'T00:00:00';
            }
            if (endDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(endDateRaw)) {
                endDateRaw = endDateRaw + 'T23:59:59';
            }
            
            promotion.start_date = startDateRaw;
            promotion.startDate = startDateRaw; // Синхронизируем оба поля
            promotion.end_date = endDateRaw;
            promotion.endDate = endDateRaw; // Синхронизируем оба поля

            // Сохраняем обновлённый массив
            await this.savePromotions();
            
            alert('✅ Акция успешно обновлена!');
            this.closeModal();
            await this.loadPromotions();
            this.render();
        } catch (error) {
            console.error('Error updating promotion:', error);
            alert('❌ Ошибка: ' + (error.message || 'Неизвестная ошибка'));
        }
    }

    showLoyaltySettings() {
        const modal = this.createModal('Настройки программы лояльности', `
            <div class="loyalty-settings">
                <div class="form-group">
                    <label class="form-label">Процент кэшбэка</label>
                    <input type="number" id="cashbackPercent" class="form-input" step="0.1" min="0" max="100" value="5">
                    <small>Процент от суммы заказа, который начисляется в виде баллов</small>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Минимальная сумма для начисления</label>
                    <input type="number" id="minOrderForCashback" class="form-input" step="0.01" min="0" value="500">
                    <small>Минимальная сумма заказа для начисления баллов</small>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Срок действия баллов (дни)</label>
                    <input type="number" id="pointsExpiryDays" class="form-input" min="1" value="365">
                    <small>Через сколько дней баллы сгорают</small>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Минимальная сумма для списания</label>
                    <input type="number" id="minPointsToRedeem" class="form-input" step="0.01" min="0" value="100">
                    <small>Минимальная сумма баллов для списания</small>
                </div>
                
                <h4>Уровни лояльности</h4>
                <div class="grid grid-2">
                    <div class="form-group">
                        <label class="form-label">Серебряный уровень (₽)</label>
                        <input type="number" id="silverThreshold" class="form-input" step="0.01" min="0" value="10000">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Золотой уровень (₽)</label>
                        <input type="number" id="goldThreshold" class="form-input" step="0.01" min="0" value="50000">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Платиновый уровень (₽)</label>
                        <input type="number" id="platinumThreshold" class="form-input" step="0.01" min="0" value="100000">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Множитель для платиновых</label>
                        <input type="number" id="platinumMultiplier" class="form-input" step="0.1" min="1" value="3">
                    </div>
                </div>
                
                <div class="form-actions">
                    <button class="btn btn-secondary" onclick="promotionsModule.closeModal()">Отмена</button>
                    <button class="btn btn-primary" onclick="promotionsModule.saveLoyaltySettings()">💾 Сохранить настройки</button>
                </div>
            </div>
        `, '', 'large');
    }

    async saveLoyaltySettings() {
        try {
            const settings = {
                cashback_percent: parseFloat(document.getElementById('cashbackPercent').value),
                min_order_for_cashback: parseFloat(document.getElementById('minOrderForCashback').value),
                points_expiry_days: parseInt(document.getElementById('pointsExpiryDays').value),
                min_points_to_redeem: parseFloat(document.getElementById('minPointsToRedeem').value),
                silver_threshold: parseFloat(document.getElementById('silverThreshold').value),
                gold_threshold: parseFloat(document.getElementById('goldThreshold').value),
                platinum_threshold: parseFloat(document.getElementById('platinumThreshold').value),
                platinum_multiplier: parseFloat(document.getElementById('platinumMultiplier').value)
            };

            const response = await fetch(`${this.LOYALTY_BASE}/settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(settings)
            });

            const result = await response.json();
            if (result.success) {
                alert('✅ Настройки программы лояльности сохранены!');
                this.closeModal();
            } else {
                alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
            }
        } catch (error) {
            console.error('Error saving loyalty settings:', error);
            alert('❌ Ошибка соединения с сервером');
        }
    }

    async showGeneratePromoCode() {
        // Сначала загружаем список акций
        await this.loadPromotions();
        
        const modal = this.createModal('Генерация промо-кода', `
            <form id="promoCodeForm">
                <div class="form-group">
                    <label class="form-label">Привязать к акции *</label>
                    <select name="promotion_id" class="form-input" required>
                        <option value="">Выберите акцию</option>
                        ${this.promotions.filter(p => p.status !== 'expired').map(promo => `
                            <option value="${promo.id}">${promo.name}</option>
                        `).join('')}
                    </select>
                </div>
                
                <div class="form-group">
                    <label class="form-label">Количество кодов</label>
                    <input type="number" name="count" class="form-input" min="1" max="1000" value="1">
                    <small>От 1 до 1000 промокодов</small>
                </div>
                
                <div class="form-group">
                    <label>
                        <input type="checkbox" name="custom_code" id="customCodeCheckbox" onchange="document.getElementById('customCodeInput').style.display = this.checked ? 'block' : 'none'">
                        Свой промокод (иначе - автогенерация)
                    </label>
                </div>
                
                <div class="form-group" id="customCodeInput" style="display: none;">
                    <label class="form-label">Промокод</label>
                    <input type="text" name="custom_code_text" class="form-input" placeholder="SUMMER2024">
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="promotionsModule.closeModal()">Отмена</button>
                    <button type="submit" class="btn btn-primary">🎟️ Сгенерировать</button>
                </div>
            </form>
        `, '', 'large');

        document.getElementById('promoCodeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitPromoCode(new FormData(e.target));
        });
    }

    async submitPromoCode(formData) {
        try {
            const promotion_id = formData.get('promotion_id');
            const count = parseInt(formData.get('count')) || 1;
            
            if (!promotion_id) {
                alert('❌ Выберите акцию');
                return;
            }

            const response = await fetch(`${this.API_BASE}/promo-code/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ promotion_id, count })
            });

            const result = await response.json();
            
            if (result.success) {
                alert(`✅ Сгенерировано промокодов: ${result.data.length}`);
                this.closeModal();
                this.loadPromoCodes();
            } else {
                alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
            }
        } catch (error) {
            console.error('Error generating promo code:', error);
            alert('❌ Ошибка соединения с сервером');
        }
    }

    async loadPromoCodes() {
        try {
            const response = await fetch(`${this.API_BASE}/promo-codes`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const result = await response.json();
            
            if (result.success) {
                this.renderPromoCodes(result.data);
            }
        } catch (error) {
            console.error('Error loading promo codes:', error);
            document.getElementById('promoCodesContent').innerHTML = 
                '<p style="color: #f44336;">Ошибка загрузки промокодов</p>';
        }
    }

    renderPromoCodes(promoCodes) {
        if (!promoCodes || promoCodes.length === 0) {
            document.getElementById('promoCodesContent').innerHTML = 
                '<p style="text-align: center; color: #666;">Нет промокодов. Создайте первый!</p>';
            return;
        }

        let html = `
            <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
                <button class="btn btn-secondary btn-small" onclick="promotionsModule.filterPromoCodes('all')">Все (${promoCodes.length})</button>
                <button class="btn btn-secondary btn-small" onclick="promotionsModule.filterPromoCodes('active')">Активные</button>
                <button class="btn btn-secondary btn-small" onclick="promotionsModule.filterPromoCodes('used')">Использованные</button>
                <button class="btn btn-secondary btn-small" onclick="promotionsModule.filterPromoCodes('expired')">Истекшие</button>
            </div>
            <div class="table-responsive">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Код</th>
                            <th>Акция</th>
                            <th>Статус</th>
                            <th>Использован</th>
                            <th>Создан</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody id="promoCodesTableBody">
        `;

        promoCodes.forEach(code => {
            const statusBadge = code.status === 'active' ? 
                '<span class="badge badge-success">Активен</span>' :
                code.status === 'used' ? 
                '<span class="badge badge-secondary">Использован</span>' :
                '<span class="badge badge-warning">Истёк</span>';

            const usedInfo = code.used_by ? 
                `Да (${new Date(code.used_at).toLocaleDateString()})` : 
                'Нет';

            html += `
                <tr data-status="${code.status}">
                    <td><code style="font-weight: bold;">${code.code}</code></td>
                    <td>${code.promotion_name || code.promotion_id}</td>
                    <td>${statusBadge}</td>
                    <td>${usedInfo}</td>
                    <td>${new Date(code.created_at).toLocaleDateString()}</td>
                    <td>
                        <button class="btn btn-small" onclick="promotionsModule.copyPromoCode('${code.code}')" title="Копировать">📋</button>
                        ${code.status === 'active' ? 
                            `<button class="btn btn-small btn-danger" onclick="promotionsModule.deactivatePromoCode('${code.id}')" title="Деактивировать">❌</button>` : 
                            ''}
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('promoCodesContent').innerHTML = html;
    }

    filterPromoCodes(status) {
        const rows = document.querySelectorAll('#promoCodesTableBody tr');
        rows.forEach(row => {
            if (status === 'all') {
                row.style.display = '';
            } else {
                row.style.display = row.getAttribute('data-status') === status ? '' : 'none';
            }
        });
    }

    copyPromoCode(code) {
        navigator.clipboard.writeText(code).then(() => {
            alert(`✅ Промокод скопирован: ${code}`);
        });
    }

    async deactivatePromoCode(codeId) {
        if (!confirm('Деактивировать этот промокод?')) return;

        try {
            const response = await fetch(`${this.API_BASE}/promo-code/${codeId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const result = await response.json();
            
            if (result.success) {
                alert('✅ Промокод деактивирован');
                this.loadPromoCodes();
            } else {
                alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
            }
        } catch (error) {
            console.error('Error deactivating promo code:', error);
            alert('❌ Ошибка соединения');
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
                    <button class="modal-close" onclick="promotionsModule.closeModal()">×</button>
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
    window.PromotionsManagementModule = PromotionsManagementModule;
    window.promotionsModule = new PromotionsManagementModule();
}

