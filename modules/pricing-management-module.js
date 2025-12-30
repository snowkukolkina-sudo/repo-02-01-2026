/**
 * DANDY Pricing Management Module
 * Управление пересчётом цен и себестоимости
 */

class PricingManagementModule {
    constructor() {
        this.products = [];
        this.recipes = [];
        this.pricingRules = [];
    }

    normalizeProduct(p) {
        if (!p || typeof p !== 'object') {
            return { id: null, name: '', category: '', current_price: 0, cost: 0 };
        }

        const currentPriceRaw = p.current_price ?? p.currentPrice ?? p.price ?? p.current ?? 0;
        const costRaw = p.cost ?? p.cost_price ?? p['себестоимость'] ?? 0;
        const current_price = Number.isFinite(Number(currentPriceRaw)) ? Number(currentPriceRaw) : 0;
        const cost = Number.isFinite(Number(costRaw)) ? Number(costRaw) : 0;
        return {
            ...p,
            id: p.id,
            name: p.name,
            category: p.category || p.category_name || '',
            current_price,
            cost,
        };
    }

    async saveProductUpdates(productId, updates) {
        if (!productId) throw new Error('Missing productId');
        const encodedId = encodeURIComponent(String(productId));

        const payload = {
            ...(updates || {})
        };

        // Backend expects canonical field names
        if (payload.current_price !== undefined && payload.price === undefined) {
            payload.price = payload.current_price;
            delete payload.current_price;
        }

        const resp = await fetch(`/api/products/${encodedId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const json = await resp.json().catch(() => ({}));
        if (!resp.ok || !json.success) {
            throw new Error(json.error || `HTTP ${resp.status}`);
        }

        return json.data || null;
    }

    async init() {
        console.log('💰 Pricing Management Module initialized');
        await this.loadProducts();
        await this.loadRecipes();
        await this.loadPricingRules();
        this.render();
    }

    async loadProducts() {
        try {
            const response = await fetch('/api/v1/products');
            const data = await response.json();
            if (data.success) {
                this.products = Array.isArray(data.data) ? data.data.map((p) => this.normalizeProduct(p)) : [];
            }
        } catch (error) {
            console.error('Error loading products:', error);
            // Fallback data
            this.products = [
                { id: 1, name: 'Пепперони 30 см', category: 'Пицца', current_price: 399, cost: 180, margin: 55 },
                { id: 2, name: 'Филадельфия', category: 'Роллы', current_price: 459, cost: 220, margin: 52 },
                { id: 3, name: 'Маргарита 25 см', category: 'Пицца', current_price: 330, cost: 150, margin: 55 }
            ];
        }
    }

    async loadRecipes() {
        try {
            const response = await fetch('/api/v1/recipes');
            if (!response.ok) {
                throw new Error('API not available');
            }
            const data = await response.json();
            if (data.success) {
                this.recipes = data.data;
            }
        } catch (error) {
            console.log('💰 Using demo pricing data (API not available)');
            this.recipes = [];
        }
    }

    async loadPricingRules() {
        // Заглушка для правил ценообразования
        this.pricingRules = [
            { id: 1, name: 'Минимальная наценка', value: 50, type: 'margin_percent' },
            { id: 2, name: 'Максимальная наценка', value: 80, type: 'margin_percent' },
            { id: 3, name: 'Коэффициент сложности', value: 1.2, type: 'complexity_multiplier' }
        ];
    }

    render() {
        const container = document.getElementById('pricingContent') || document.getElementById('pricing');
        if (!container) return;

        container.innerHTML = `
            <div class="pricing-management">
                <!-- Header -->
                <div class="pricing-header">
                    <h2>💰 Пересчёт цен</h2>
                    <div class="pricing-actions">
                        <button class="btn btn-primary" onclick="pricingModule.recalculateAllPrices()">
                            🔄 Пересчитать все цены
                        </button>
                        <button class="btn btn-secondary" onclick="pricingModule.showPricingRules()">
                            ⚙️ Правила ценообразования
                        </button>
                    </div>
                </div>

                <!-- Stats -->
                <div class="pricing-stats grid grid-4" style="margin-top: 1rem;">
                    <div class="card">
                        <h4>Всего товаров</h4>
                        <div class="stat-value">${this.products.length}</div>
                    </div>
                    <div class="card">
                        <h4>Средняя наценка</h4>
                        <div class="stat-value">${this.calculateAverageMargin()}%</div>
                    </div>
                    <div class="card">
                        <h4>Товары с низкой наценкой</h4>
                        <div class="stat-value text-warning">${this.getLowMarginProducts().length}</div>
                    </div>
                    <div class="card">
                        <h4>Общая стоимость</h4>
                        <div class="stat-value">₽ ${this.calculateTotalCost().toLocaleString()}</div>
                    </div>
                </div>

                <!-- Pricing Table -->
                <div class="card" style="margin-top: 1rem;">
                    <div class="card-header">
                        <h3>Текущие цены и себестоимость</h3>
                        <div style="display: flex; gap: 1rem; align-items: center;">
                            <select id="categoryFilter" class="form-input" style="width: 200px;">
                                <option value="">Все категории</option>
                                <option value="Пицца">Пицца</option>
                                <option value="Роллы">Роллы</option>
                                <option value="Салаты">Салаты</option>
                            </select>
                            <button class="btn btn-secondary btn-small" onclick="pricingModule.filterByCategory()">Фильтр</button>
                        </div>
                    </div>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Товар</th>
                                    <th>Категория</th>
                                    <th>Себестоимость</th>
                                    <th>Текущая цена</th>
                                    <th>Наценка</th>
                                    <th>Рекомендуемая цена</th>
                                    <th>Действия</th>
                                </tr>
                            </thead>
                            <tbody id="pricingTableBody">
                                ${this.renderPricingRows()}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        // Event listeners
        document.getElementById('categoryFilter').addEventListener('change', () => {
            this.filterByCategory();
        });
    }

    renderPricingRows() {
        if (this.products.length === 0) {
            return '<tr><td colspan="7" style="text-align: center;">Нет данных о товарах</td></tr>';
        }

        return this.products.map(product => {
            const recommendedPrice = this.calculateRecommendedPrice(product);
            const margin = product.cost > 0 ? Math.round(((product.current_price - product.cost) / product.cost) * 100) : 0;
            
            let marginClass = 'success';
            if (margin < 50) marginClass = 'warning';
            if (margin < 30) marginClass = 'danger';

            return `
                <tr data-category="${product.category}">
                    <td><strong>${product.name}</strong></td>
                    <td>${product.category}</td>
                    <td>₽ ${product.cost}</td>
                    <td>₽ ${product.current_price}</td>
                    <td><span class="badge badge-${marginClass}">${margin}%</span></td>
                    <td>₽ ${recommendedPrice}</td>
                    <td>
                        <button class="btn btn-small" onclick="pricingModule.editPrice('${product.id}')">✏️</button>
                        <button class="btn btn-small btn-primary" onclick="pricingModule.applyRecommendedPrice('${product.id}')">✅</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    calculateRecommendedPrice(product) {
        const baseMargin = 60; // Базовая наценка 60%
        const complexityMultiplier = this.pricingRules.find(r => r.type === 'complexity_multiplier')?.value || 1.2;
        
        let recommendedPrice = product.cost * (1 + baseMargin / 100);
        
        // Применяем коэффициент сложности для разных категорий
        if (product.category === 'Роллы') {
            recommendedPrice *= complexityMultiplier;
        } else if (product.category === 'Пицца') {
            recommendedPrice *= 1.1;
        }
        
        return Math.round(recommendedPrice);
    }

    calculateAverageMargin() {
        if (this.products.length === 0) return 0;
        
        const totalMargin = this.products.reduce((sum, product) => {
            const margin = product.cost > 0 ? ((product.current_price - product.cost) / product.cost) * 100 : 0;
            return sum + margin;
        }, 0);
        
        return Math.round(totalMargin / this.products.length);
    }

    getLowMarginProducts() {
        return this.products.filter(product => {
            const margin = product.cost > 0 ? ((product.current_price - product.cost) / product.cost) * 100 : 0;
            return margin < 50;
        });
    }

    calculateTotalCost() {
        return this.products.reduce((sum, product) => sum + (product.cost || 0), 0);
    }

    recalculateAllPrices() {
        const modal = this.createModal('Пересчёт всех цен', `
            <div class="recalculate-prices">
                <div class="form-group">
                    <label class="form-label">Базовая наценка (%)</label>
                    <input type="number" id="baseMargin" class="form-input" value="60" min="0" max="200">
                </div>
                <div class="form-group">
                    <label class="form-label">Коэффициент сложности</label>
                    <input type="number" id="complexityMultiplier" class="form-input" value="1.2" min="1" max="3" step="0.1">
                </div>
                <div class="form-group">
                    <label class="form-label">Применить к категориям</label>
                    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                        <label><input type="checkbox" checked> Пицца</label>
                        <label><input type="checkbox" checked> Роллы</label>
                        <label><input type="checkbox" checked> Салаты</label>
                        <label><input type="checkbox" checked> Напитки</label>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Округление</label>
                    <select id="rounding" class="form-input">
                        <option value="1">До рубля</option>
                        <option value="5">До 5 рублей</option>
                        <option value="10">До 10 рублей</option>
                    </select>
                </div>
                <div class="form-actions">
                    <button class="btn btn-secondary" onclick="pricingModule.closeModal()">Отмена</button>
                    <button class="btn btn-primary" onclick="pricingModule.processRecalculation()">🔄 Пересчитать</button>
                </div>
            </div>
        `);
    }

    async processRecalculation() {
        const baseMargin = parseFloat(document.getElementById('baseMargin').value);
        const complexityMultiplier = parseFloat(document.getElementById('complexityMultiplier').value);
        const rounding = parseInt(document.getElementById('rounding').value);

        try {
            // Симуляция пересчёта цен
            let updatedCount = 0;
            let savedCount = 0;
            const shouldSave = confirm('Применить пересчитанные цены на сервер (в БД)?');
            
            for (const product of this.products) {
                const recommendedPrice = this.calculateRecommendedPrice(product);
                const roundedPrice = Math.round(recommendedPrice / rounding) * rounding;
                
                if (roundedPrice !== product.current_price) {
                    product.current_price = roundedPrice;
                    updatedCount++;

                    if (shouldSave) {
                        try {
                            const updated = await this.saveProductUpdates(product.id, { price: roundedPrice });
                            if (updated) {
                                Object.assign(product, this.normalizeProduct(updated));
                            }
                            savedCount++;
                        } catch (e) {
                            console.warn('Failed to save recalculated price for product', product.id, e);
                        }
                    }
                }
            }

            alert(`✅ Пересчёт завершён! Обновлено цен: ${updatedCount}${shouldSave ? `, сохранено: ${savedCount}` : ''}`);
            this.closeModal();
            this.render();
        } catch (error) {
            console.error('Error recalculating prices:', error);
            alert('❌ Ошибка при пересчёте цен');
        }
    }

    showPricingRules() {
        const modal = this.createModal('Правила ценообразования', `
            <div class="pricing-rules">
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Правило</th>
                                <th>Тип</th>
                                <th>Значение</th>
                                <th>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.pricingRules.map(rule => `
                                <tr>
                                    <td><strong>${rule.name}</strong></td>
                                    <td>${rule.type}</td>
                                    <td>${rule.value}</td>
                                    <td>
                                        <button class="btn btn-small" onclick="pricingModule.editRule('${rule.id}')">✏️</button>
                                        <button class="btn btn-small btn-danger" onclick="pricingModule.deleteRule('${rule.id}')">🗑️</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="form-actions">
                    <button class="btn btn-secondary" onclick="pricingModule.closeModal()">Закрыть</button>
                    <button class="btn btn-primary" onclick="pricingModule.addRule()">➕ Добавить правило</button>
                </div>
            </div>
        `, '', 'large');
    }

    editPrice(productId) {
        const product = this.products.find(p => p.id == productId);
        if (!product) return;

        const modal = this.createModal(`Редактировать цену: ${product.name}`, `
            <form id="editPriceForm">
                <div class="form-group">
                    <label class="form-label">Текущая цена</label>
                    <input type="number" name="current_price" class="form-input" value="${product.current_price}" min="0" step="1">
                </div>
                <div class="form-group">
                    <label class="form-label">Себестоимость</label>
                    <input type="number" name="cost" class="form-input" value="${product.cost}" min="0" step="0.01">
                </div>
                <div class="form-group">
                    <label class="form-label">Рекомендуемая цена</label>
                    <input type="number" class="form-input" value="${this.calculateRecommendedPrice(product)}" readonly>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="pricingModule.closeModal()">Отмена</button>
                    <button type="submit" class="btn btn-primary">💾 Сохранить</button>
                </div>
            </form>
        `);

        document.getElementById('editPriceForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateProductPrice(productId, new FormData(e.target));
        });
    }

    async updateProductPrice(productId, formData) {
        try {
            const product = this.products.find(p => p.id == productId);
            const nextPrice = parseFloat(formData.get('current_price'));
            const nextCost = parseFloat(formData.get('cost'));

            if (product) {
                product.current_price = Number.isFinite(nextPrice) ? nextPrice : product.current_price;
                product.cost = Number.isFinite(nextCost) ? nextCost : product.cost;
            }

            const updated = await this.saveProductUpdates(productId, {
                price: Number.isFinite(nextPrice) ? nextPrice : undefined,
                cost: Number.isFinite(nextCost) ? nextCost : undefined
            });

            if (product && updated) {
                Object.assign(product, this.normalizeProduct(updated));
            }

            alert('✅ Цена обновлена!');
            this.closeModal();
            this.render();
        } catch (error) {
            console.error('Error updating price:', error);
            alert('❌ Ошибка при обновлении цены');
        }
    }

    applyRecommendedPrice(productId) {
        const product = this.products.find(p => p.id == productId);
        if (!product) return;

        const recommendedPrice = this.calculateRecommendedPrice(product);
        
        if (confirm(`Применить рекомендуемую цену ₽${recommendedPrice} для товара "${product.name}"?`)) {
            product.current_price = recommendedPrice;
            this.saveProductUpdates(productId, { price: recommendedPrice })
                .then((updated) => {
                    if (updated) {
                        Object.assign(product, this.normalizeProduct(updated));
                    }
                    alert('✅ Цена обновлена!');
                    this.render();
                })
                .catch((e) => {
                    console.error('Error applying recommended price:', e);
                    alert('❌ Не удалось сохранить цену на сервер');
                    this.render();
                });
        }
    }

    filterByCategory() {
        const categoryFilter = document.getElementById('categoryFilter').value;
        const rows = document.querySelectorAll('#pricingTableBody tr');
        
        rows.forEach(row => {
            if (!categoryFilter) {
                row.style.display = '';
            } else {
                row.style.display = row.getAttribute('data-category') === categoryFilter ? '' : 'none';
            }
        });
    }

    addRule() {
        alert('🚧 Добавление правила - в разработке');
    }

    editRule(ruleId) {
        alert('🚧 Редактирование правила - в разработке');
    }

    deleteRule(ruleId) {
        if (confirm('Вы уверены, что хотите удалить это правило?')) {
            alert('✅ Правило удалено');
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
                    <button class="modal-close" onclick="pricingModule.closeModal()">×</button>
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
    window.PricingManagementModule = PricingManagementModule;
    window.pricingModule = new PricingManagementModule();
}
