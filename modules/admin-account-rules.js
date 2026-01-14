// Модуль управления планами счетов (раздел 3.6 ТЗ)
// Автонастройка счетов учёта для товаров, ингредиентов, блюд

class AccountRulesManager {
    constructor() {
        this.rules = [];
        this.products = [];
        this.groups = [];
        this.warehouses = [];
        this.API_BASE = '/api/onec/account-rules';
    }

    async init() {
        try {
            console.log('📊 AccountRulesManager: Starting initialization...');
            console.log('🔍 Debug: Looking for container #accountRulesContent...');
            
            const container = document.getElementById('accountRulesContent');
            if (!container) {
                console.error('❌ AccountRulesManager: Container #accountRulesContent not found!');
                console.error('🔍 Debug: Available elements with "account" in id:', 
                    Array.from(document.querySelectorAll('[id*="account"]')).map(el => el.id));
                console.error('🔍 Debug: Page element #account-rules:', document.getElementById('account-rules'));
                return;
            }
            
            console.log('✅ Container found, setting loading indicator...');
            // Показываем индикатор загрузки
            container.innerHTML = '<div style="padding: 2rem; text-align: center;"><p>⏳ Загрузка планов счетов...</p></div>';
            
            console.log('📥 Loading rules...');
            await this.loadRules();
            console.log('📥 Loading products...');
            await this.loadProducts();
            console.log('📥 Loading groups...');
            await this.loadGroups();
            console.log('📥 Loading warehouses...');
            await this.loadWarehouses();
            console.log('🎨 Rendering...');
            this.render();
            console.log('✅ AccountRulesManager: Initialization complete');
        } catch (error) {
            console.error('❌ AccountRulesManager: Initialization error:', error);
            console.error('❌ Error stack:', error.stack);
            const container = document.getElementById('accountRulesContent');
            if (container) {
                container.innerHTML = `
                    <div style="padding: 2rem; text-align: center;">
                        <h3>❌ Ошибка загрузки модуля</h3>
                        <p>${error.message || 'Неизвестная ошибка'}</p>
                        <pre style="text-align: left; background: #f5f5f5; padding: 1rem; border-radius: 4px; font-size: 0.9rem; overflow: auto;">${error.stack || 'Нет стека ошибок'}</pre>
                        <button class="btn btn-primary" onclick="location.reload()" style="margin-top: 1rem;">Обновить страницу</button>
                    </div>
                `;
            }
        }
    }

    async loadRules() {
        try {
            const response = await fetch(this.API_BASE);
            if (!response.ok) throw new Error(`API not available: ${response.status}`);
            const data = await response.json();
            // Поддерживаем оба формата ответа
            this.rules = ((data.ok || data.success) && Array.isArray(data.data)) ? data.data : [];
            console.log(`✅ Загружено правил планов счетов: ${this.rules.length}`);
        } catch (error) {
            console.error('Error loading account rules:', error);
            this.rules = [];
        }
    }

    async loadProducts() {
        try {
            const response = await fetch('/api/products');
            if (!response.ok) throw new Error('Products API not available');
            const data = await response.json();
            // Поддерживаем оба формата ответа: {ok: true, data: [...]} и {success: true, data: [...]}
            this.products = ((data.ok || data.success) && Array.isArray(data.data)) ? data.data : [];
        } catch (error) {
            console.error('Error loading products for account rules:', error);
            this.products = [];
        }
    }

    async loadGroups() {
        try {
            const response = await fetch('/api/product-groups');
            if (!response.ok) throw new Error('Groups API not available');
            const data = await response.json();
            // Поддерживаем оба формата ответа
            this.groups = ((data.ok || data.success) && Array.isArray(data.data)) ? data.data : [];
        } catch (error) {
            console.error('Error loading groups for account rules:', error);
            this.groups = [];
        }
    }

    async loadWarehouses() {
        // Заглушка для складов
        this.warehouses = [
            { id: 1, name: 'Основной склад', type: 'main' },
            { id: 2, name: 'Кухня', type: 'production' }
        ];
    }

    render() {
        const container = document.getElementById('accountRulesContent');
        if (!container) {
            console.error('❌ AccountRulesManager: Container #accountRulesContent not found!');
            console.error('Available containers:', Array.from(document.querySelectorAll('[id*="account"]')).map(el => ({
                id: el.id,
                visible: el.offsetParent !== null,
                display: window.getComputedStyle(el).display
            })));
            return;
        }

        // Проверяем видимость контейнера
        const containerStyle = window.getComputedStyle(container);
        const parentPage = container.closest('.page-content');
        const parentStyle = parentPage ? window.getComputedStyle(parentPage) : null;
        
        console.log('📊 AccountRulesManager: Rendering...', {
            rules: this.rules.length,
            products: this.products.length,
            groups: this.groups.length,
            containerFound: !!container,
            containerVisible: container.offsetParent !== null,
            containerDisplay: containerStyle.display,
            parentPage: parentPage?.id,
            parentDisplay: parentStyle?.display,
            parentHasActive: parentPage?.classList.contains('active')
        });

        // Убеждаемся, что родительская страница видима
        if (parentPage && !parentPage.classList.contains('active')) {
            console.warn('⚠️ Parent page is not active, adding active class...');
            parentPage.classList.add('active');
        }
        
        container.innerHTML = `
            <div class="account-rules-management">
                <div class="rules-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h2>📊 Управление планами счетов</h2>
                    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                        <button class="btn btn-primary" onclick="accountRulesManager.showCreateRuleForm()">
                            ➕ Создать правило
                        </button>
                        <button class="btn btn-secondary" onclick="accountRulesManager.applyRulesToAll()">
                            🔄 Применить ко всем товарам
                        </button>
                        <button class="btn btn-secondary" onclick="accountRulesManager.initDefaultRules()">
                            ⚙️ Инициализировать правила по умолчанию
                        </button>
                    </div>
                </div>

                <div style="background: #e3f2fd; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                    <h3 style="margin-bottom: 0.5rem; font-size: 1.1rem;">💡 Приоритет правил (как в 1С):</h3>
                    <ol style="margin: 0; padding-left: 1.5rem;">
                        <li><strong>Отдельный элемент</strong> - индивидуальный счёт для конкретного товара</li>
                        <li><strong>Группа</strong> - счёт для всех товаров в группе</li>
                        <li><strong>Вид номенклатуры</strong> - счёт по типу (товар/ингредиент/блюдо)</li>
                        <li><strong>Склад</strong> - счёт для товаров на конкретном складе</li>
                        <li><strong>По умолчанию</strong> - базовые правила (41.01 для товаров, 10.01 для ингредиентов)</li>
                    </ol>
                </div>

                <div class="card">
                    <h3 style="margin-bottom: 1rem;">Правила назначения счетов</h3>
                    <div id="rulesTable">
                        ${this.renderRulesTable()}
                    </div>
                </div>

                <div class="card" style="margin-top: 1.5rem;">
                    <h3 style="margin-bottom: 1rem;">Статистика применения</h3>
                    <div id="rulesStats">
                        ${this.renderStats()}
                    </div>
                </div>
            </div>
        `;
        
        console.log('✅ AccountRulesManager: Render complete, container content length:', container.innerHTML.length);
        
        // Принудительно показываем контейнер и родительскую страницу
        container.style.display = 'block';
        if (parentPage) {
            parentPage.style.display = 'block';
            parentPage.classList.add('active');
            console.log('✅ Forced display of account-rules page');
        }
        
        // Проверяем видимость после рендера
        setTimeout(() => {
            const isVisible = container.offsetParent !== null;
            const computedDisplay = window.getComputedStyle(container).display;
            console.log('🔍 Post-render visibility check:', {
                isVisible,
                computedDisplay,
                containerHeight: container.offsetHeight,
                containerWidth: container.offsetWidth
            });
            
            if (!isVisible) {
                console.warn('⚠️ Container is still not visible after render!');
                console.warn('Container style:', {
                    display: container.style.display,
                    visibility: container.style.visibility,
                    opacity: container.style.opacity
                });
                console.warn('Parent page style:', parentPage ? {
                    display: parentPage.style.display,
                    classList: Array.from(parentPage.classList)
                } : 'No parent page');
            }
        }, 100);
    }

    renderRulesTable() {
        if (this.rules.length === 0) {
            return `
                <div style="padding: 2rem; text-align: center; background: #f9fafb; border-radius: 8px;">
                    <p style="color: #666; margin-bottom: 1rem; font-size: 1.1rem;">📋 Правила назначения счетов</p>
                    <p style="color: #999; margin-bottom: 1.5rem;">Нет правил. Создайте первое правило или инициализируйте правила по умолчанию.</p>
                    <div style="display: flex; gap: 1rem; justify-content: center;">
                        <button class="btn btn-primary" onclick="accountRulesManager.showCreateRuleForm()" style="padding: 0.75rem 1.5rem;">
                            ➕ Создать правило
                        </button>
                        <button class="btn btn-secondary" onclick="accountRulesManager.initDefaultRules()" style="padding: 0.75rem 1.5rem;">
                            ⚙️ Инициализировать правила по умолчанию
                        </button>
                    </div>
                </div>
            `;
        }

        // Группируем правила по уровню
        const grouped = {
            'default': [],
            'type': [],
            'group': [],
            'warehouse': [],
            'item': []
        };

        this.rules.forEach(rule => {
            const level = rule.level || 'default';
            if (grouped[level]) {
                grouped[level].push(rule);
            }
        });

        let html = '<table class="data-table">';
        html += '<thead><tr><th>Уровень</th><th>Условие</th><th>Счёт учёта</th><th>Описание</th><th>Действия</th></tr></thead><tbody>';

        // Отображаем по приоритету
        ['item', 'group', 'type', 'warehouse', 'default'].forEach(level => {
            if (grouped[level] && grouped[level].length > 0) {
                grouped[level].forEach(rule => {
                    const condition = this.getRuleCondition(rule);
                    html += `
                        <tr>
                            <td><strong>${this.getLevelName(rule.level)}</strong></td>
                            <td>${condition}</td>
                            <td><code style="background: #f0f0f0; padding: 0.25rem 0.5rem; border-radius: 4px;">${this.escapeHtml(rule.account_code)}</code></td>
                            <td>${this.escapeHtml(rule.description || '')}</td>
                            <td>
                                <button class="btn btn-small" onclick="accountRulesManager.showEditRuleForm(${rule.id})">✏️</button>
                                <button class="btn btn-small btn-danger" onclick="accountRulesManager.deleteRule(${rule.id})">🗑️</button>
                            </td>
                        </tr>
                    `;
                });
            }
        });

        html += '</tbody></table>';
        return html;
    }

    getLevelName(level) {
        const names = {
            'default': 'По умолчанию',
            'type': 'Вид номенклатуры',
            'group': 'Группа',
            'warehouse': 'Склад',
            'item': 'Отдельный элемент'
        };
        return names[level] || level;
    }

    getRuleCondition(rule) {
        if (rule.level === 'type') {
            const typeNames = {
                'product': 'Товар',
                'ingredient': 'Ингредиент',
                'dish': 'Блюдо',
                'semi_product': 'Полуфабрикат'
            };
            return typeNames[rule.type] || rule.type || '—';
        } else if (rule.level === 'group') {
            const group = this.groups.find(g => g.id == rule.group_id);
            return group ? this.escapeHtml(group.name) : `ID: ${rule.group_id}`;
        } else if (rule.level === 'warehouse') {
            const warehouse = this.warehouses.find(w => w.id == rule.warehouse_id);
            return warehouse ? this.escapeHtml(warehouse.name) : `ID: ${rule.warehouse_id}`;
        } else if (rule.level === 'item') {
            const product = this.products.find(p => p.id == rule.product_id);
            return product ? this.escapeHtml(product.name) : `ID: ${rule.product_id}`;
        }
        return '—';
    }

    renderStats() {
        const stats = this.calculateStats();
        return `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                <div style="background: #f0f9ff; padding: 1rem; border-radius: 8px;">
                    <div style="font-size: 0.9rem; color: #666; margin-bottom: 0.5rem;">Товары (41.01)</div>
                    <div style="font-size: 1.5rem; font-weight: 600; color: #0369a1;">${stats.products_41_01}</div>
                </div>
                <div style="background: #f0fdf4; padding: 1rem; border-radius: 8px;">
                    <div style="font-size: 0.9rem; color: #666; margin-bottom: 0.5rem;">Ингредиенты (10.01)</div>
                    <div style="font-size: 1.5rem; font-weight: 600; color: #15803d;">${stats.ingredients_10_01}</div>
                </div>
                <div style="background: #fef3c7; padding: 1rem; border-radius: 8px;">
                    <div style="font-size: 0.9rem; color: #666; margin-bottom: 0.5rem;">Без счёта</div>
                    <div style="font-size: 1.5rem; font-weight: 600; color: #d97706;">${stats.without_account}</div>
                </div>
                <div style="background: #f3f4f6; padding: 1rem; border-radius: 8px;">
                    <div style="font-size: 0.9rem; color: #666; margin-bottom: 0.5rem;">Всего товаров</div>
                    <div style="font-size: 1.5rem; font-weight: 600; color: #374151;">${stats.total}</div>
                </div>
            </div>
        `;
    }

    calculateStats() {
        let products_41_01 = 0;
        let ingredients_10_01 = 0;
        let without_account = 0;

        this.products.forEach(product => {
            const accountCode = product.account_code || this.getDefaultAccount(product);
            if (!accountCode) {
                without_account++;
            } else if (accountCode === '41.01') {
                products_41_01++;
            } else if (accountCode === '10.01') {
                ingredients_10_01++;
            }
        });

        return {
            products_41_01,
            ingredients_10_01,
            without_account,
            total: this.products.length
        };
    }

    getDefaultAccount(product) {
        // Логика определения счёта по умолчанию
        if (product.type === 'product' || product.type === 'dish') {
            return '41.01';
        } else if (product.type === 'ingredient' || product.type === 'semi_product') {
            return '10.01';
        }
        return null;
    }

    async showCreateRuleForm() {
        const modal = this.createModal('Создать правило назначения счёта', `
            <form id="createRuleForm">
                <div class="form-group">
                    <label class="form-label">Уровень правила *</label>
                    <select name="level" class="form-input" required onchange="accountRulesManager.updateRuleForm(this.value)">
                        <option value="default">По умолчанию</option>
                        <option value="type">Вид номенклатуры</option>
                        <option value="group">Группа товаров</option>
                        <option value="warehouse">Склад</option>
                        <option value="item">Отдельный элемент</option>
                    </select>
                </div>
                <div class="form-group" id="typeCondition" style="display: none;">
                    <label class="form-label">Тип номенклатуры</label>
                    <select name="type" class="form-input">
                        <option value="product">Товар</option>
                        <option value="ingredient">Ингредиент</option>
                        <option value="dish">Блюдо</option>
                        <option value="semi_product">Полуфабрикат</option>
                    </select>
                </div>
                <div class="form-group" id="groupCondition" style="display: none;">
                    <label class="form-label">Группа товаров</label>
                    <select name="group_id" class="form-input">
                        <option value="">— Выберите группу —</option>
                        ${this.groups.map(g => `<option value="${g.id}">${this.escapeHtml(g.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group" id="warehouseCondition" style="display: none;">
                    <label class="form-label">Склад</label>
                    <select name="warehouse_id" class="form-input">
                        <option value="">— Выберите склад —</option>
                        ${this.warehouses.map(w => `<option value="${w.id}">${this.escapeHtml(w.name)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group" id="itemCondition" style="display: none;">
                    <label class="form-label">Товар</label>
                    <select name="product_id" class="form-input">
                        <option value="">— Выберите товар —</option>
                        ${this.products.map(p => `<option value="${p.id}">${this.escapeHtml(p.name || 'Без названия')} (${p.type || 'product'})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Счёт учёта *</label>
                    <select name="account_code" class="form-input" required>
                        <option value="41.01">41.01 - Товары на складах</option>
                        <option value="41.12">41.12 - Товары в розничной торговле</option>
                        <option value="10.01">10.01 - Сырьё и материалы</option>
                        <option value="10.02">10.02 - Покупные полуфабрикаты</option>
                        <option value="10.03">10.03 - Топливо</option>
                        <option value="10.04">10.04 - Тара и тарные материалы</option>
                        <option value="10.05">10.05 - Запасные части</option>
                        <option value="10.06">10.06 - Прочие материалы</option>
                        <option value="10.07">10.07 - Материалы, переданные в переработку</option>
                        <option value="10.08">10.08 - Строительные материалы</option>
                        <option value="10.09">10.09 - Инвентарь и хозяйственные принадлежности</option>
                        <option value="10.10">10.10 - Специальная оснастка и специальная одежда</option>
                        <option value="10.11">10.11 - Специальная оснастка и специальная одежда в эксплуатации</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Описание</label>
                    <input type="text" name="description" class="form-input" placeholder="Описание правила">
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">💾 Создать</button>
                    <button type="button" class="btn btn-secondary" onclick="accountRulesManager.closeModal()">Отмена</button>
                </div>
            </form>
        `);

        modal.querySelector('#createRuleForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            
            // Очищаем неиспользуемые поля и конвертируем в числа
            if (data.level !== 'type') delete data.type;
            if (data.level !== 'group') {
                delete data.group_id;
            } else if (data.group_id) {
                data.group_id = parseInt(data.group_id);
            }
            if (data.level !== 'warehouse') {
                delete data.warehouse_id;
            } else if (data.warehouse_id) {
                data.warehouse_id = parseInt(data.warehouse_id);
            }
            if (data.level !== 'item') {
                delete data.product_id;
            } else if (data.product_id) {
                data.product_id = parseInt(data.product_id);
            }
            
            await this.createRule(data);
        });
    }

    updateRuleForm(level) {
        document.getElementById('typeCondition').style.display = level === 'type' ? 'block' : 'none';
        document.getElementById('groupCondition').style.display = level === 'group' ? 'block' : 'none';
        document.getElementById('warehouseCondition').style.display = level === 'warehouse' ? 'block' : 'none';
        document.getElementById('itemCondition').style.display = level === 'item' ? 'block' : 'none';
    }

    async createRule(data) {
        try {
            const response = await fetch(this.API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (result.ok || result.success) {
                await this.loadRules();
                this.render();
                this.closeModal();
                alert('✅ Правило создано');
            } else {
                throw new Error(result.error || 'Ошибка создания правила');
            }
        } catch (error) {
            console.error('Error creating rule:', error);
            alert('❌ Ошибка: ' + error.message);
        }
    }

    async showEditRuleForm(ruleId) {
        const rule = this.rules.find(r => r.id == ruleId);
        if (!rule) {
            alert('Правило не найдено');
            return;
        }

        const modal = this.createModal('Редактировать правило', `
            <form id="editRuleForm">
                <div class="form-group">
                    <label class="form-label">Уровень правила *</label>
                    <select name="level" class="form-input" required onchange="accountRulesManager.updateRuleForm(this.value)">
                        <option value="default" ${rule.level === 'default' ? 'selected' : ''}>По умолчанию</option>
                        <option value="type" ${rule.level === 'type' ? 'selected' : ''}>Вид номенклатуры</option>
                        <option value="group" ${rule.level === 'group' ? 'selected' : ''}>Группа товаров</option>
                        <option value="warehouse" ${rule.level === 'warehouse' ? 'selected' : ''}>Склад</option>
                        <option value="item" ${rule.level === 'item' ? 'selected' : ''}>Отдельный элемент</option>
                    </select>
                </div>
                <div class="form-group" id="typeCondition" style="display: ${rule.level === 'type' ? 'block' : 'none'};">
                    <label class="form-label">Тип номенклатуры</label>
                    <select name="type" class="form-input">
                        <option value="product" ${rule.type === 'product' ? 'selected' : ''}>Товар</option>
                        <option value="ingredient" ${rule.type === 'ingredient' ? 'selected' : ''}>Ингредиент</option>
                        <option value="dish" ${rule.type === 'dish' ? 'selected' : ''}>Блюдо</option>
                        <option value="semi_product" ${rule.type === 'semi_product' ? 'selected' : ''}>Полуфабрикат</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Счёт учёта *</label>
                    <input type="text" name="account_code" class="form-input" value="${this.escapeHtml(rule.account_code || '')}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Описание</label>
                    <input type="text" name="description" class="form-input" value="${this.escapeHtml(rule.description || '')}">
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">💾 Сохранить</button>
                    <button type="button" class="btn btn-secondary" onclick="accountRulesManager.closeModal()">Отмена</button>
                </div>
            </form>
        `);

        modal.querySelector('#editRuleForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            await this.updateRule(ruleId, data);
        });
    }

    async updateRule(ruleId, data) {
        try {
            const response = await fetch(`${this.API_BASE}/${ruleId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (result.ok || result.success) {
                await this.loadRules();
                this.render();
                this.closeModal();
                alert('✅ Правило обновлено');
            } else {
                throw new Error(result.error || 'Ошибка обновления правила');
            }
        } catch (error) {
            console.error('Error updating rule:', error);
            alert('❌ Ошибка: ' + error.message);
        }
    }

    async deleteRule(ruleId) {
        if (!confirm('Удалить это правило?')) return;

        try {
            const response = await fetch(`${this.API_BASE}/${ruleId}`, {
                method: 'DELETE'
            });

            const result = await response.json();
            if (result.ok || result.success) {
                await this.loadRules();
                this.render();
                alert('✅ Правило удалено');
            } else {
                throw new Error(result.error || 'Ошибка удаления правила');
            }
        } catch (error) {
            console.error('Error deleting rule:', error);
            alert('❌ Ошибка: ' + error.message);
        }
    }

    async applyRulesToAll() {
        if (!confirm('Применить правила ко всем товарам? Это обновит счета учёта для всех товаров.')) return;

        try {
            const response = await fetch('/api/onec/apply-account-rules', {
                method: 'POST'
            });

            const result = await response.json();
            if (result.ok || result.success) {
                await this.loadProducts();
                this.render();
                alert(`✅ Правила применены. Обновлено товаров: ${result.updated || 'неизвестно'}`);
            } else {
                throw new Error(result.error || 'Ошибка применения правил');
            }
        } catch (error) {
            console.error('Error applying rules:', error);
            alert('❌ Ошибка: ' + error.message);
        }
    }

    async initDefaultRules() {
        if (!confirm('Инициализировать правила по умолчанию? Существующие правила не будут удалены.')) return;

        try {
            // Правила по умолчанию уже создаются в handleApplyAccountRules
            await this.applyRulesToAll();
            await this.loadRules();
            this.render();
            alert('✅ Правила по умолчанию инициализированы');
        } catch (error) {
            console.error('Error initializing default rules:', error);
            alert('❌ Ошибка: ' + error.message);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    createModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="accountRulesManager.closeModal()">×</button>
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
        document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
    }
}

// Инициализация
(function() {
    'use strict';
    try {
        if (typeof window !== 'undefined') {
            console.log('📦 Loading AccountRulesManager module...');
            window.AccountRulesManager = AccountRulesManager;
            
            // Создаём экземпляр только если его ещё нет
            if (!window.accountRulesManager) {
                window.accountRulesManager = new AccountRulesManager();
                console.log('✅ AccountRulesManager instance created:', window.accountRulesManager);
            } else {
                console.log('ℹ️ AccountRulesManager instance already exists, reusing');
            }
        } else {
            console.error('❌ window is undefined, cannot initialize AccountRulesManager');
        }
    } catch (error) {
        console.error('❌ Error initializing AccountRulesManager:', error);
        // Пытаемся создать хотя бы класс
        if (typeof window !== 'undefined') {
            window.AccountRulesManager = AccountRulesManager;
        }
    }
})();

