// Модуль интеграции с 1С (раздел 3.6 ТЗ)
// Автонастройка счетов, импорт номенклатуры, экспорт для 1С

class OneCIntegrationManager {
    constructor() {
        this.API_BASE = '/api/onec';
        this.accountRules = [];
        this.products = [];
    }

    async init() {
        await this.loadAccountRules();
        await this.loadProducts();
        this.render();
    }

    async loadAccountRules() {
        try {
            const response = await fetch(`${this.API_BASE}/account-rules`);
            if (response.ok) {
                const result = await response.json();
                this.accountRules = (result.ok && Array.isArray(result.data)) ? result.data : [];
            } else {
                this.accountRules = [];
            }
        } catch (error) {
            console.warn('Account rules API not available');
            this.accountRules = [];
        }
    }

    async loadProducts() {
        try {
            const response = await fetch('/api/products');
            if (response.ok) {
                const result = await response.json();
                this.products = (result.ok && Array.isArray(result.data)) ? result.data : [];
            }
        } catch (error) {
            console.warn('Products API not available');
            this.products = [];
        }
    }

    render() {
        const container = document.getElementById('onecIntegrationContent');
        if (!container) {
            console.warn('Container #onecIntegrationContent not found');
            return;
        }

        container.innerHTML = `
            <div class="onec-integration-management">
                <div class="integration-header" style="margin-bottom: 2rem;">
                    <h2>🔗 Интеграция с 1С</h2>
                    <p style="color: #666; margin-top: 0.5rem;">
                        Импорт номенклатуры, автонастройка счетов учёта, экспорт данных
                    </p>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
                    <!-- Импорт из 1С -->
                    <div class="card">
                        <h3 style="margin-bottom: 1rem;">📥 Импорт из 1С</h3>
                        <p style="color: #666; font-size: 0.9em; margin-bottom: 1rem;">
                            Импорт справочника товаров и материалов, выгруженного из 1С
                        </p>
                        <button class="btn btn-primary" onclick="onecIntegrationManager.showImportForm()">
                            📥 Импортировать номенклатуру
                        </button>
                        <button class="btn btn-secondary btn-small" onclick="onecIntegrationManager.downloadTemplate('import')" style="margin-top: 0.5rem;">
                            📄 Скачать шаблон
                        </button>
                    </div>

                    <!-- Экспорт для 1С -->
                    <div class="card">
                        <h3 style="margin-bottom: 1rem;">📤 Экспорт для 1С</h3>
                        <p style="color: #666; font-size: 0.9em; margin-bottom: 1rem;">
                            Выгрузка данных о продажах и остатках для загрузки в 1С
                        </p>
                        <button class="btn btn-primary" onclick="onecIntegrationManager.showExportForm()">
                            📤 Экспортировать данные
                        </button>
                    </div>
                </div>

                <!-- Автонастройка счетов учёта -->
                <div class="card">
                    <h3 style="margin-bottom: 1rem;">📊 Автонастройка планов счетов</h3>
                    <p style="color: #666; font-size: 0.9em; margin-bottom: 1rem;">
                        Настройка правил автоматического назначения счетов учёта для номенклатуры
                    </p>
                    
                    <div style="margin-bottom: 1rem;">
                        <button class="btn btn-secondary" onclick="onecIntegrationManager.showAccountRulesForm()">
                            ⚙️ Управление правилами счетов
                        </button>
                        <button class="btn btn-secondary" onclick="onecIntegrationManager.applyAccountRules()" style="margin-left: 0.5rem;">
                            🔄 Применить правила ко всем товарам
                        </button>
                    </div>

                    <div id="accountRulesList">
                        ${this.renderAccountRules()}
                    </div>
                </div>

                <!-- Синхронизация товаров из synced_products -->
                <div class="card" style="margin-top: 1.5rem; background: #e7f3ff; border-left: 4px solid #2196F3;">
                    <h3 style="margin-bottom: 1rem;">🔄 Синхронизация товаров в основную таблицу</h3>
                    <p style="color: #666; font-size: 0.9em; margin-bottom: 1rem;">
                        Перенос товаров из таблицы synced_products (синхронизированные с сайта) в основную таблицу products для работы с категориями, техкартами и складом
                    </p>
                    <button class="btn btn-primary" onclick="onecIntegrationManager.syncProductsFromSynced()" id="syncProductsBtn">
                        🔄 Синхронизировать товары в products
                    </button>
                    <div id="syncProductsResults" style="margin-top: 1rem; display: none;"></div>
                </div>

                <!-- Исправление данных -->
                <div class="card" style="margin-top: 1.5rem; background: #fff3cd; border-left: 4px solid #ffc107;">
                    <h3 style="margin-bottom: 1rem;">🔧 Исправление проблем с данными</h3>
                    <p style="color: #666; font-size: 0.9em; margin-bottom: 1rem;">
                        Автоматическое исправление проблем: привязка товаров к категориям, создание техкарт для блюд, проверка данных в складе
                    </p>
                    <button class="btn btn-warning" onclick="onecIntegrationManager.fixDataIssues()" id="fixDataBtn">
                        🔧 Исправить проблемы с данными
                    </button>
                    <div id="fixDataResults" style="margin-top: 1rem; display: none;"></div>
                </div>

                <!-- Статистика -->
                <div class="card" style="margin-top: 1.5rem;">
                    <h3 style="margin-bottom: 1rem;">📈 Статистика</h3>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;">
                        <div>
                            <strong>Товаров с счётом 41.01:</strong>
                            <div style="font-size: 1.5em; color: var(--dandy-green);">
                                ${this.products.filter(p => p.account_code === '41.01').length}
                            </div>
                        </div>
                        <div>
                            <strong>Ингредиентов с счётом 10.01:</strong>
                            <div style="font-size: 1.5em; color: var(--dandy-green);">
                                ${this.products.filter(p => p.account_code === '10.01').length}
                            </div>
                        </div>
                        <div>
                            <strong>Без счёта учёта:</strong>
                            <div style="font-size: 1.5em; color: #f59e0b;">
                                ${this.products.filter(p => !p.account_code).length}
                            </div>
                        </div>
                        <div>
                            <strong>Всего товаров:</strong>
                            <div style="font-size: 1.5em;">
                                ${this.products.length}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderAccountRules() {
        const defaultRules = [
            { level: 'default', type: 'product', account: '41.01', description: 'Товары (готовая продукция) — счёт 41.01 «Товары на складах»' },
            { level: 'default', type: 'ingredient', account: '10.01', description: 'Ингредиенты/материалы — счёт 10.01 «Сырьё и материалы»' },
            { level: 'default', type: 'dish', account: '41.01', description: 'Блюда — счёт 41.01 «Товары на складах»' },
            { level: 'default', type: 'semi_product', account: '10.01', description: 'Заготовки — счёт 10.01 «Сырьё и материалы»' }
        ];

        const rules = this.accountRules.length > 0 ? this.accountRules : defaultRules;

        if (rules.length === 0) {
            return '<p style="color: #999;">Нет правил. Используются правила по умолчанию.</p>';
        }

        return `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Уровень</th>
                        <th>Тип/Группа</th>
                        <th>Счёт учёта</th>
                        <th>Описание</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${rules.map((rule, index) => `
                        <tr>
                            <td>${this.escapeHtml(rule.level || 'default')}</td>
                            <td>${this.escapeHtml(rule.type || rule.group_name || '—')}</td>
                            <td><code>${this.escapeHtml(rule.account || '—')}</code></td>
                            <td>${this.escapeHtml(rule.description || '—')}</td>
                            <td>
                                <button class="btn btn-small" onclick="onecIntegrationManager.editAccountRule(${index})">✏️</button>
                                <button class="btn btn-small btn-danger" onclick="onecIntegrationManager.deleteAccountRule(${index})">🗑️</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    showImportForm() {
        // Используем улучшенный UI импорта из модуля admin-1c-import.js
        if (window.onecImportManager) {
            // Создаём контейнер для импорта, если его нет
            const container = document.getElementById('onecIntegrationContent');
            if (container) {
                // Сохраняем оригинальное содержимое
                const originalContent = container.innerHTML;
                
                // Инициализируем модуль импорта
                window.onecImportManager.render();
                
                // Добавляем кнопку "Назад"
                const importContainer = container.querySelector('div[style*="max-width: 1200px"]');
                if (importContainer) {
                    const backButton = document.createElement('button');
                    backButton.className = 'btn btn-secondary';
                    backButton.style.cssText = 'margin-bottom: 1rem;';
                    backButton.textContent = '← Назад к интеграции';
                    backButton.onclick = () => {
                        container.innerHTML = originalContent;
                        this.render();
                    };
                    importContainer.insertBefore(backButton, importContainer.firstChild);
                }
            } else {
                // Если контейнер не найден, используем модальное окно
                this.showImportFormLegacy();
            }
        } else {
            // Если модуль не загружен, используем старую форму
            this.showImportFormLegacy();
        }
    }

    showImportFormLegacy() {
        const modal = this.createModal('Импорт номенклатуры из 1С', `
            <form id="onecImportForm">
                <div class="form-group">
                    <label class="form-label">Файл Excel/CSV из 1С</label>
                    <input type="file" id="onecImportFile" accept=".xlsx,.xls,.csv" class="form-input" required>
                    <small class="form-text">Выгрузите номенклатуру из 1С в Excel, затем загрузите файл</small>
                </div>
                <div class="form-group">
                    <label class="form-label">Опции импорта</label>
                    <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <input type="checkbox" id="updateExisting1C" checked>
                        Обновлять существующие товары
                    </label>
                    <label style="display: flex; align-items: center; gap: 0.5rem;">
                        <input type="checkbox" id="autoAssignAccounts" checked>
                        Автоматически назначать счета учёта
                    </label>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">📥 Импортировать</button>
                    <button type="button" class="btn btn-secondary" onclick="onecIntegrationManager.closeModal()">Отмена</button>
                </div>
            </form>
        `);

        modal.querySelector('#onecImportForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const file = document.getElementById('onecImportFile').files[0];
            const updateExisting = document.getElementById('updateExisting1C').checked;
            const autoAssignAccounts = document.getElementById('autoAssignAccounts').checked;
            
            if (!file) {
                alert('Выберите файл');
                return;
            }
            await this.importFrom1C(file, updateExisting, autoAssignAccounts);
        });
    }

    showExportForm() {
        const modal = this.createModal('Экспорт данных для 1С', `
            <form id="onecExportForm">
                <div class="form-group">
                    <label class="form-label">Тип экспорта</label>
                    <select id="exportType" class="form-input">
                        <option value="sales">Продажи</option>
                        <option value="stock">Остатки</option>
                        <option value="nomenclature">Номенклатура (расширенная)</option>
                        <option value="products">Номенклатура (базовая)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Период (для продаж)</label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                        <input type="date" id="exportDateFrom" class="form-input" value="${new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]}">
                        <input type="date" id="exportDateTo" class="form-input" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Формат</label>
                    <select id="exportFormat" class="form-input">
                        <option value="csv">CSV</option>
                        <option value="xlsx">Excel (XLSX)</option>
                    </select>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">📤 Экспортировать</button>
                    <button type="button" class="btn btn-secondary" onclick="onecIntegrationManager.closeModal()">Отмена</button>
                </div>
            </form>
        `);

        modal.querySelector('#onecExportForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const exportType = document.getElementById('exportType').value;
            const dateFrom = document.getElementById('exportDateFrom').value;
            const dateTo = document.getElementById('exportDateTo').value;
            const format = document.getElementById('exportFormat').value;
            
            await this.exportTo1C(exportType, dateFrom, dateTo, format);
        });
    }

    showAccountRulesForm() {
        const modal = this.createModal('Управление правилами счетов учёта', `
            <form id="accountRulesForm">
                <div class="form-group">
                    <label class="form-label">Уровень правила</label>
                    <select id="ruleLevel" class="form-input">
                        <option value="default">По умолчанию</option>
                        <option value="type">По типу номенклатуры</option>
                        <option value="group">По группе товаров</option>
                        <option value="warehouse">По складу</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Тип номенклатуры</label>
                    <select id="ruleType" class="form-input">
                        <option value="">— Все типы —</option>
                        <option value="product">Товар</option>
                        <option value="ingredient">Ингредиент</option>
                        <option value="dish">Блюдо</option>
                        <option value="semi_product">Заготовка</option>
                        <option value="modifier">Модификатор</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Счёт учёта *</label>
                    <input type="text" id="ruleAccount" class="form-input" placeholder="41.01" required>
                    <small class="form-text">Например: 41.01 (Товары на складах), 10.01 (Сырьё и материалы), 41.12 (Товары в рознице)</small>
                </div>
                <div class="form-group">
                    <label class="form-label">Описание</label>
                    <textarea id="ruleDescription" class="form-input" rows="2"></textarea>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">💾 Сохранить правило</button>
                    <button type="button" class="btn btn-secondary" onclick="onecIntegrationManager.closeModal()">Отмена</button>
                </div>
            </form>
        `);

        modal.querySelector('#accountRulesForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const accountCode = document.getElementById('ruleAccount').value.trim();
            if (!accountCode) {
                alert('❌ Заполните поле "Счёт учёта"');
                return;
            }
            
            const rule = {
                level: document.getElementById('ruleLevel').value,
                type: document.getElementById('ruleType').value || null,
                account_code: accountCode,
                description: document.getElementById('ruleDescription').value
            };
            await this.saveAccountRule(rule);
        });
    }

    async importFrom1C(file, updateExisting, autoAssignAccounts) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('updateExisting', updateExisting.toString());
        formData.append('autoAssignAccounts', autoAssignAccounts.toString());

        try {
            const response = await fetch(`${this.API_BASE}/import`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.success || result.ok) {
                alert(`✅ Импортировано: ${result.imported || 0}, Обновлено: ${result.updated || 0}`);
                this.closeModal();
                await this.loadProducts();
                this.render();
            } else {
                throw new Error(result.error || 'Ошибка импорта');
            }
        } catch (error) {
            console.error('1C import error:', error);
            alert('❌ Ошибка: ' + error.message);
        }
    }

    async exportTo1C(type, dateFrom, dateTo, format) {
        try {
            const typeNames = {
                'sales': 'продажи',
                'stock': 'остатки',
                'nomenclature': 'номенклатура',
                'products': 'номенклатура'
            };
            const typeName = typeNames[type] || type;

            if (format === 'xlsx') {
                // Backend экспортирует CSV. Для XLSX конвертируем на клиенте через SheetJS.
                const csvParams = new URLSearchParams({
                    type,
                    date_from: dateFrom,
                    date_to: dateTo,
                    format: 'csv'
                });
                const response = await fetch(`${this.API_BASE}/export?${csvParams.toString()}`);
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || 'Ошибка экспорта');
                }

                if (!window.XLSX) {
                    throw new Error('XLSX библиотека не загружена (SheetJS).');
                }

                const text = await response.text();
                const cleaned = text.replace(/^\uFEFF/, '');
                const wb = window.XLSX.read(cleaned, { type: 'string' });

                const out = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
                const blob = new Blob([out], {
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `onec_export_${typeName}_${new Date().toISOString().split('T')[0]}.xlsx`;
                link.click();
                URL.revokeObjectURL(url);

                alert(`✅ Экспорт завершен: ${typeName}`);
                this.closeModal();
                return;
            }

            const params = new URLSearchParams({
                type,
                date_from: dateFrom,
                date_to: dateTo,
                format
            });

            const response = await fetch(`${this.API_BASE}/export?${params.toString()}`);

            if (response.ok) {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;

                link.download = `onec_export_${typeName}_${new Date().toISOString().split('T')[0]}.csv`;
                link.click();
                URL.revokeObjectURL(url);

                alert(`✅ Экспорт завершен: ${typeName}`);
                this.closeModal();
            } else {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Ошибка экспорта');
            }
        } catch (error) {
            console.error('1C export error:', error);
            alert('❌ Ошибка: ' + error.message);
        }
    }

    async saveAccountRule(rule) {
        try {
            const response = await fetch(`${this.API_BASE}/account-rules`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rule)
            });

            const result = await response.json();
            if (result.success || result.ok) {
                await this.loadAccountRules();
                this.render();
                this.closeModal();
                alert('✅ Правило сохранено');
            } else {
                throw new Error(result.error || 'Ошибка сохранения');
            }
        } catch (error) {
            console.error('Save account rule error:', error);
            alert('❌ Ошибка: ' + error.message);
        }
    }

    async applyAccountRules() {
        if (!confirm('Применить правила счетов учёта ко всем товарам? Это может занять некоторое время.')) {
            return;
        }

        try {
            const response = await fetch(`${this.API_BASE}/apply-account-rules`, {
                method: 'POST'
            });

            const result = await response.json();
            if (result.success || result.ok) {
                alert(`✅ Правила применены. Обновлено товаров: ${result.updated || 0}`);
                await this.loadProducts();
                this.render();
            } else {
                throw new Error(result.error || 'Ошибка применения правил');
            }
        } catch (error) {
            console.error('Apply account rules error:', error);
            alert('❌ Ошибка: ' + error.message);
        }
    }

    editAccountRule(index) {
        const rule = this.accountRules[index];
        if (!rule) return;

        const modal = this.createModal('Редактировать правило', `
            <form id="editAccountRuleForm">
                <div class="form-group">
                    <label class="form-label">Уровень правила</label>
                    <select id="editRuleLevel" class="form-input">
                        <option value="default" ${rule.level === 'default' ? 'selected' : ''}>По умолчанию</option>
                        <option value="type" ${rule.level === 'type' ? 'selected' : ''}>По типу номенклатуры</option>
                        <option value="group" ${rule.level === 'group' ? 'selected' : ''}>По группе товаров</option>
                        <option value="warehouse" ${rule.level === 'warehouse' ? 'selected' : ''}>По складу</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Тип номенклатуры</label>
                    <select id="editRuleType" class="form-input">
                        <option value="">— Все типы —</option>
                        <option value="product" ${rule.type === 'product' ? 'selected' : ''}>Товар</option>
                        <option value="ingredient" ${rule.type === 'ingredient' ? 'selected' : ''}>Ингредиент</option>
                        <option value="dish" ${rule.type === 'dish' ? 'selected' : ''}>Блюдо</option>
                        <option value="semi_product" ${rule.type === 'semi_product' ? 'selected' : ''}>Заготовка</option>
                        <option value="modifier" ${rule.type === 'modifier' ? 'selected' : ''}>Модификатор</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Счёт учёта *</label>
                    <input type="text" id="editRuleAccount" class="form-input" value="${this.escapeHtml(rule.account_code || rule.account || '')}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Описание</label>
                    <textarea id="editRuleDescription" class="form-input" rows="2">${this.escapeHtml(rule.description || '')}</textarea>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">💾 Сохранить</button>
                    <button type="button" class="btn btn-secondary" onclick="onecIntegrationManager.closeModal()">Отмена</button>
                </div>
            </form>
        `);

        modal.querySelector('#editAccountRuleForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const accountCode = document.getElementById('editRuleAccount').value.trim();
            if (!accountCode) {
                alert('❌ Заполните поле "Счёт учёта"');
                return;
            }
            
            const updatedRule = {
                ...rule,
                level: document.getElementById('editRuleLevel').value,
                type: document.getElementById('editRuleType').value || null,
                account_code: accountCode,
                description: document.getElementById('editRuleDescription').value
            };
            await this.updateAccountRule(rule.id, updatedRule);
        });
    }

    async updateAccountRule(ruleId, rule) {
        try {
            const response = await fetch(`${this.API_BASE}/account-rules/${ruleId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(rule)
            });

            const result = await response.json();
            if (result.success || result.ok) {
                await this.loadAccountRules();
                this.render();
                this.closeModal();
                alert('✅ Правило обновлено');
            } else {
                throw new Error(result.error || 'Ошибка обновления');
            }
        } catch (error) {
            console.error('Update account rule error:', error);
            alert('❌ Ошибка: ' + error.message);
        }
    }

    async deleteAccountRule(index) {
        const rule = this.accountRules[index];
        if (!rule) return;

        if (!confirm(`Удалить правило "${rule.description || rule.account}"?`)) return;

        try {
            const response = await fetch(`${this.API_BASE}/account-rules/${rule.id}`, {
                method: 'DELETE'
            });

            const result = await response.json();
            if (result.success || result.ok) {
                await this.loadAccountRules();
                this.render();
                alert('✅ Правило удалено');
            } else {
                throw new Error(result.error || 'Ошибка удаления');
            }
        } catch (error) {
            console.error('Delete account rule error:', error);
            alert('❌ Ошибка: ' + error.message);
        }
    }

    async fixDataIssues() {
        const btn = document.getElementById('fixDataBtn');
        const resultsDiv = document.getElementById('fixDataResults');
        
        if (!confirm('Исправить проблемы с данными?\n\nЭто выполнит:\n1. Привязку товаров к категориям\n2. Создание техкарт для блюд без техкарт\n3. Проверку и исправление данных в складе\n\nПродолжить?')) {
            return;
        }
        
        if (btn) {
            btn.disabled = true;
            btn.textContent = '⏳ Исправление...';
        }
        
        if (resultsDiv) {
            resultsDiv.style.display = 'block';
            resultsDiv.style.marginTop = '1rem';
            resultsDiv.style.padding = '1.5rem';
            resultsDiv.style.background = '#fff3cd';
            resultsDiv.style.borderRadius = '8px';
            resultsDiv.style.borderLeft = '4px solid #ffc107';
            resultsDiv.style.minHeight = '100px';
            resultsDiv.innerHTML = '<p style="color: #856404; font-weight: 600; margin: 0; font-size: 1.2rem;">⏳ Выполняется исправление данных... Пожалуйста, подождите.</p>';
        }
        
        try {
            const response = await fetch('/api/fix-data-issues', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const result = await response.json();
            console.log('✅ Fix data issues result:', result);
            console.log('📊 Results details:', result.results);
            console.log('🔍 Diagnostics details:', result.diagnostics);
            
            if (result.success || result.ok) {
                const r = result.results || {};
                const d = result.diagnostics || {};
                const totalProducts = d.total_products || 0;
                const totalDishes = d.total_dishes || 0;
                const totalBalances = d.total_balances || 0;
                const categoriesFixed = r.categories?.fixed || 0;
                const categoriesTotal = r.categories?.total || 0;
                const recipesCreated = r.recipes?.created || 0;
                const recipesTotal = r.recipes?.total_dishes || 0;
                const warehouseFixed = r.warehouse?.fixed || 0;
                const warehouseChecked = r.warehouse?.checked || 0;
                
                if (resultsDiv) {
                    resultsDiv.style.background = '#d4edda';
                    resultsDiv.style.borderLeft = '4px solid #28a745';
                    resultsDiv.style.padding = '1.5rem';
                    resultsDiv.style.minHeight = '200px';
                    resultsDiv.style.display = 'block';
                    resultsDiv.style.marginTop = '1rem';
                    resultsDiv.innerHTML = `
                        <div style="padding: 0;">
                            <h3 style="margin: 0 0 1.5rem 0; color: #155724; font-size: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                                <span style="font-size: 2.5rem;">✅</span>
                                <span>Исправление завершено успешно!</span>
                            </h3>
                            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 1.5rem;">
                                <div style="padding: 1.5rem; background: white; border-radius: 12px; border: 3px solid #28a745; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center;">
                                    <div style="font-size: 1rem; color: #666; margin-bottom: 1rem; font-weight: 600;">📁 Категории</div>
                                    <div style="font-size: 3rem; font-weight: bold; color: #28a745; line-height: 1; margin-bottom: 0.5rem;">
                                        ${categoriesFixed}
                                    </div>
                                    <div style="font-size: 1rem; color: #666;">из ${categoriesTotal} товаров</div>
                                </div>
                                <div style="padding: 1.5rem; background: white; border-radius: 12px; border: 3px solid #28a745; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center;">
                                    <div style="font-size: 1rem; color: #666; margin-bottom: 1rem; font-weight: 600;">🍽️ Техкарты</div>
                                    <div style="font-size: 3rem; font-weight: bold; color: #28a745; line-height: 1; margin-bottom: 0.5rem;">
                                        ${recipesCreated}
                                    </div>
                                    <div style="font-size: 1rem; color: #666;">из ${recipesTotal} блюд</div>
                                </div>
                                <div style="padding: 1.5rem; background: white; border-radius: 12px; border: 3px solid #28a745; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center;">
                                    <div style="font-size: 1rem; color: #666; margin-bottom: 1rem; font-weight: 600;">📦 Склад</div>
                                    <div style="font-size: 3rem; font-weight: bold; color: #28a745; line-height: 1; margin-bottom: 0.5rem;">
                                        ${warehouseFixed}
                                    </div>
                                    <div style="font-size: 1rem; color: #666;">из ${warehouseChecked} записей</div>
                                </div>
                            </div>
                            <div style="padding: 1.25rem; background: #c3e6cb; border-radius: 10px; color: #155724; font-size: 1.2rem; font-weight: 700; text-align: center; border: 2px solid #28a745;">
                                🎯 Итого исправлено: <span style="font-size: 1.5rem;">${categoriesFixed + recipesCreated + warehouseFixed}</span> записей
                            </div>
                            ${(totalProducts === 0 && categoriesTotal === 0 && recipesTotal === 0 && totalBalances === 0) ? `
                            <div style="margin-top: 1rem; padding: 1rem; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
                                <p style="margin: 0; color: #856404; font-size: 0.95rem;">
                                    <strong>ℹ️ Информация:</strong> Все данные в порядке или база данных пуста. 
                                    ${totalProducts === 0 ? 'В базе нет товаров.' : ''}
                                    ${categoriesTotal === 0 && totalProducts > 0 ? 'Все товары уже привязаны к категориям.' : ''}
                                    ${recipesTotal === 0 && totalDishes > 0 ? 'Все блюда уже имеют техкарты.' : ''}
                                    ${totalBalances === 0 ? 'Нет записей на складе для проверки.' : ''}
                                </p>
                            </div>
                            ` : ''}
                        </div>
                    `;
                    
                    // Детальная диагностика из API
                    const productsTableExists = d.products_table_exists || false;
                    const syncedProductsCount = d.synced_products_count || 0;
                    const productsTableColumns = d.products_table_columns || [];
                    const hasTypeColumn = d.has_type_column || false;
                    const sampleProducts = d.sample_products || [];
                    
                    console.log('📊 Детальная диагностика:', {
                        'Таблица products существует': productsTableExists,
                        'Всего товаров в products': totalProducts,
                        'Товаров в synced_products': syncedProductsCount,
                        'Колонки в products': productsTableColumns,
                        'Есть колонка type': hasTypeColumn,
                        'Товаров без категорий': categoriesTotal,
                        'Всего блюд в БД': totalDishes,
                        'Блюд без техкарт': recipesTotal,
                        'Всего записей на складе': totalBalances,
                        'Проблемных записей': warehouseFixed,
                        'Примеры товаров': sampleProducts
                    });
                    
                    // Дополнительная информация
                    if (totalProducts === 0 && syncedProductsCount > 0) {
                        console.log('ℹ️ ВНИМАНИЕ: В таблице products нет товаров, но найдено', syncedProductsCount, 'товаров в таблице synced_products (синхронизированные с сайтом).');
                        console.log('💡 Товары могут храниться в другом месте или загружаться из другого источника.');
                    } else if (totalProducts === 0) {
                        console.log('⚠️ В базе данных нет товаров в таблице products.');
                        console.log('💡 Возможно, товары загружаются из другого источника (JSON файл, другой API, или хранятся в памяти JavaScript).');
                    }
                    
                    // Прокручиваем к результатам
                    setTimeout(() => {
                        resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 100);
                }
                
                // Показываем уведомление
                alert(`✅ Исправление завершено!\n\n📁 Категории: ${categoriesFixed} из ${categoriesTotal}\n🍽️ Техкарты: ${recipesCreated} из ${recipesTotal}\n📦 Склад: ${warehouseFixed} из ${warehouseChecked}\n\n🎯 Итого: ${categoriesFixed + recipesCreated + warehouseFixed} записей`);
                
                // Обновляем данные (но сохраняем результаты)
                await this.loadProducts();
                
                // Перерисовываем, но сохраняем результаты
                const savedResults = resultsDiv ? resultsDiv.innerHTML : null;
                this.render();
                
                // Восстанавливаем результаты после перерисовки
                if (savedResults && resultsDiv) {
                    setTimeout(() => {
                        const newResultsDiv = document.getElementById('fixDataResults');
                        if (newResultsDiv) {
                            newResultsDiv.innerHTML = savedResults;
                            newResultsDiv.style.display = 'block';
                            newResultsDiv.style.background = '#d4edda';
                            newResultsDiv.style.borderLeft = '4px solid #28a745';
                            newResultsDiv.style.padding = '1.5rem';
                            newResultsDiv.style.minHeight = '200px';
                            newResultsDiv.style.marginTop = '1rem';
                            newResultsDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }
                    }, 100);
                }
            } else {
                throw new Error(result.error || 'Ошибка исправления данных');
            }
        } catch (error) {
            console.error('❌ Fix data issues error:', error);
            if (resultsDiv) {
                resultsDiv.style.background = '#f8d7da';
                resultsDiv.style.borderLeft = '4px solid #dc3545';
                resultsDiv.style.padding = '1.5rem';
                resultsDiv.innerHTML = `
                    <div style="padding: 0;">
                        <h3 style="margin: 0 0 0.5rem 0; color: #721c24; font-size: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-size: 2.5rem;">❌</span>
                            <span>Ошибка исправления данных</span>
                        </h3>
                        <p style="margin: 0; color: #721c24; padding: 1rem; background: white; border-radius: 8px; font-size: 1.1rem;">
                            ${this.escapeHtml(error.message)}
                        </p>
                        <p style="margin: 0.75rem 0 0 0; color: #666; font-size: 0.95rem;">
                            Проверьте логи сервера для получения подробной информации.
                        </p>
                    </div>
                `;
            }
            alert('❌ Ошибка: ' + error.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = '🔧 Исправить проблемы с данными';
            }
        }
    }

    downloadTemplate(type) {
        const templates = {
            import: {
                headers: ['Наименование', 'Штрихкод', 'Ед. изм.', 'Закупочная цена', 'Ставка НДС', 'Категория', 'Тип', 'Счёт учёта'],
                example: ['Лосось', '4601234567890', 'кг', '1200', '20', 'Рыба', 'материал', '10.01']
            }
        };

        const template = templates[type];
        if (!template) {
            alert('Шаблон не найден');
            return;
        }

        let csv = template.headers.join(',') + '\n';
        csv += template.example.join(',') + '\n';

        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `template_1c_import_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }

    createModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="onecIntegrationManager.closeModal()">×</button>
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

    async syncProductsFromSynced() {
        const btn = document.getElementById('syncProductsBtn');
        const resultsDiv = document.getElementById('syncProductsResults');
        
        if (!confirm('Синхронизировать товары из synced_products в таблицу products?\n\nЭто перенесет товары из синхронизированных данных в основную таблицу для работы с категориями, техкартами и складом.\n\nПродолжить?')) {
            return;
        }
        
        if (btn) {
            btn.disabled = true;
            btn.textContent = '⏳ Синхронизация...';
        }
        
        if (resultsDiv) {
            resultsDiv.style.display = 'block';
            resultsDiv.style.marginTop = '1rem';
            resultsDiv.style.padding = '1.5rem';
            resultsDiv.style.background = '#fff3cd';
            resultsDiv.style.borderRadius = '8px';
            resultsDiv.style.borderLeft = '4px solid #2196F3';
            resultsDiv.style.minHeight = '100px';
            resultsDiv.innerHTML = '<p style="color: #856404; font-weight: 600; margin: 0; font-size: 1.2rem;">⏳ Выполняется синхронизация товаров... Пожалуйста, подождите.</p>';
        }
        
        try {
            const response = await fetch('/api/sync-products-from-synced', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const result = await response.json();
            console.log('✅ Sync products from synced result:', result);
            
            if (result.success || result.ok) {
                const r = result.results || {};
                const imported = r.products_imported || 0;
                const updated = r.products_updated || 0;
                const found = r.synced_products_found || 0;
                const errors = r.errors || [];
                
                if (resultsDiv) {
                    resultsDiv.style.background = '#d4edda';
                    resultsDiv.style.borderLeft = '4px solid #28a745';
                    resultsDiv.style.padding = '1.5rem';
                    resultsDiv.style.minHeight = '200px';
                    resultsDiv.style.display = 'block';
                    resultsDiv.style.marginTop = '1rem';
                    resultsDiv.innerHTML = `
                        <div style="padding: 0;">
                            <h3 style="margin: 0 0 1.5rem 0; color: #155724; font-size: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                                <span style="font-size: 2.5rem;">✅</span>
                                <span>Синхронизация завершена успешно!</span>
                            </h3>
                            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 1.5rem;">
                                <div style="padding: 1.5rem; background: white; border-radius: 12px; border: 3px solid #28a745; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center;">
                                    <div style="font-size: 1rem; color: #666; margin-bottom: 1rem; font-weight: 600;">📦 Найдено в synced</div>
                                    <div style="font-size: 3rem; font-weight: bold; color: #28a745; line-height: 1; margin-bottom: 0.5rem;">
                                        ${found}
                                    </div>
                                    <div style="font-size: 1rem; color: #666;">записей</div>
                                </div>
                                <div style="padding: 1.5rem; background: white; border-radius: 12px; border: 3px solid #28a745; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center;">
                                    <div style="font-size: 1rem; color: #666; margin-bottom: 1rem; font-weight: 600;">✨ Импортировано</div>
                                    <div style="font-size: 3rem; font-weight: bold; color: #28a745; line-height: 1; margin-bottom: 0.5rem;">
                                        ${imported}
                                    </div>
                                    <div style="font-size: 1rem; color: #666;">новых товаров</div>
                                </div>
                                <div style="padding: 1.5rem; background: white; border-radius: 12px; border: 3px solid #28a745; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center;">
                                    <div style="font-size: 1rem; color: #666; margin-bottom: 1rem; font-weight: 600;">🔄 Обновлено</div>
                                    <div style="font-size: 3rem; font-weight: bold; color: #28a745; line-height: 1; margin-bottom: 0.5rem;">
                                        ${updated}
                                    </div>
                                    <div style="font-size: 1rem; color: #666;">существующих</div>
                                </div>
                            </div>
                            ${errors.length > 0 ? `
                            <div style="margin-top: 1rem; padding: 1rem; background: #f8d7da; border-radius: 8px; border-left: 4px solid #dc3545;">
                                <p style="margin: 0; color: #721c24; font-size: 0.95rem;">
                                    <strong>⚠️ Ошибки:</strong> ${errors.length} ошибок при обработке
                                </p>
                            </div>
                            ` : ''}
                            <div style="padding: 1.25rem; background: #c3e6cb; border-radius: 10px; color: #155724; font-size: 1.2rem; font-weight: 700; text-align: center; border: 2px solid #28a745; margin-top: 1rem;">
                                🎯 Итого обработано: <span style="font-size: 1.5rem;">${imported + updated}</span> товаров
                            </div>
                        </div>
                    `;
                    
                    setTimeout(() => {
                        resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 100);
                }
                
                alert(`✅ Синхронизация завершена!\n\n📦 Найдено в synced_products: ${found}\n✨ Импортировано новых: ${imported}\n🔄 Обновлено существующих: ${updated}\n\n🎯 Итого: ${imported + updated} товаров`);
                
                // Обновляем данные
                await this.loadProducts();
                this.render();
            } else {
                throw new Error(result.error || 'Ошибка синхронизации');
            }
        } catch (error) {
            console.error('❌ Sync products from synced error:', error);
            if (resultsDiv) {
                resultsDiv.style.background = '#f8d7da';
                resultsDiv.style.borderLeft = '4px solid #dc3545';
                resultsDiv.style.padding = '1.5rem';
                resultsDiv.innerHTML = `
                    <div style="padding: 0;">
                        <h3 style="margin: 0 0 0.5rem 0; color: #721c24; font-size: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-size: 2.5rem;">❌</span>
                            <span>Ошибка синхронизации</span>
                        </h3>
                        <p style="margin: 0; color: #721c24; padding: 1rem; background: white; border-radius: 8px; font-size: 1.1rem;">
                            ${this.escapeHtml(error.message)}
                        </p>
                    </div>
                `;
            }
            alert('❌ Ошибка: ' + error.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = '🔄 Синхронизировать товары в products';
            }
        }
    }

    async fixDataIssues() {
        const btn = document.getElementById('fixDataBtn');
        const resultsDiv = document.getElementById('fixDataResults');
        
        if (!confirm('Исправить проблемы с данными?\n\nЭто выполнит:\n1. Привязку товаров к категориям\n2. Создание техкарт для блюд без техкарт\n3. Проверку и исправление данных в складе\n\nПродолжить?')) {
            return;
        }
        
        if (btn) {
            btn.disabled = true;
            btn.textContent = '⏳ Исправление...';
        }
        
        if (resultsDiv) {
            resultsDiv.style.display = 'block';
            resultsDiv.style.marginTop = '1rem';
            resultsDiv.style.padding = '1.5rem';
            resultsDiv.style.background = '#fff3cd';
            resultsDiv.style.borderRadius = '8px';
            resultsDiv.style.borderLeft = '4px solid #ffc107';
            resultsDiv.style.minHeight = '100px';
            resultsDiv.innerHTML = '<p style="color: #856404; font-weight: 600; margin: 0; font-size: 1.2rem;">⏳ Выполняется исправление данных... Пожалуйста, подождите.</p>';
        }
        
        try {
            const response = await fetch('/api/fix-data-issues', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const result = await response.json();
            console.log('✅ Fix data issues result:', result);
            console.log('📊 Results details:', result.results);
            console.log('🔍 Diagnostics details:', result.diagnostics);
            
            if (result.success || result.ok) {
                const r = result.results || {};
                const d = result.diagnostics || {};
                const totalProducts = d.total_products || 0;
                const totalDishes = d.total_dishes || 0;
                const totalBalances = d.total_balances || 0;
                const categoriesFixed = r.categories?.fixed || 0;
                const categoriesTotal = r.categories?.total || 0;
                const recipesCreated = r.recipes?.created || 0;
                const recipesTotal = r.recipes?.total_dishes || 0;
                const warehouseFixed = r.warehouse?.fixed || 0;
                const warehouseChecked = r.warehouse?.checked || 0;
                
                if (resultsDiv) {
                    resultsDiv.style.background = '#d4edda';
                    resultsDiv.style.borderLeft = '4px solid #28a745';
                    resultsDiv.style.padding = '1.5rem';
                    resultsDiv.style.minHeight = '200px';
                    resultsDiv.style.display = 'block';
                    resultsDiv.style.marginTop = '1rem';
                    resultsDiv.innerHTML = `
                        <div style="padding: 0;">
                            <h3 style="margin: 0 0 1.5rem 0; color: #155724; font-size: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                                <span style="font-size: 2.5rem;">✅</span>
                                <span>Исправление завершено успешно!</span>
                            </h3>
                            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 1.5rem;">
                                <div style="padding: 1.5rem; background: white; border-radius: 12px; border: 3px solid #28a745; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center;">
                                    <div style="font-size: 1rem; color: #666; margin-bottom: 1rem; font-weight: 600;">📁 Категории</div>
                                    <div style="font-size: 3rem; font-weight: bold; color: #28a745; line-height: 1; margin-bottom: 0.5rem;">
                                        ${categoriesFixed}
                                    </div>
                                    <div style="font-size: 1rem; color: #666;">из ${categoriesTotal} товаров</div>
                                </div>
                                <div style="padding: 1.5rem; background: white; border-radius: 12px; border: 3px solid #28a745; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center;">
                                    <div style="font-size: 1rem; color: #666; margin-bottom: 1rem; font-weight: 600;">🍽️ Техкарты</div>
                                    <div style="font-size: 3rem; font-weight: bold; color: #28a745; line-height: 1; margin-bottom: 0.5rem;">
                                        ${recipesCreated}
                                    </div>
                                    <div style="font-size: 1rem; color: #666;">из ${recipesTotal} блюд</div>
                                </div>
                                <div style="padding: 1.5rem; background: white; border-radius: 12px; border: 3px solid #28a745; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center;">
                                    <div style="font-size: 1rem; color: #666; margin-bottom: 1rem; font-weight: 600;">📦 Склад</div>
                                    <div style="font-size: 3rem; font-weight: bold; color: #28a745; line-height: 1; margin-bottom: 0.5rem;">
                                        ${warehouseFixed}
                                    </div>
                                    <div style="font-size: 1rem; color: #666;">из ${warehouseChecked} записей</div>
                                </div>
                            </div>
                            <div style="padding: 1.25rem; background: #c3e6cb; border-radius: 10px; color: #155724; font-size: 1.2rem; font-weight: 700; text-align: center; border: 2px solid #28a745;">
                                🎯 Итого исправлено: <span style="font-size: 1.5rem;">${categoriesFixed + recipesCreated + warehouseFixed}</span> записей
                            </div>
                            ${(totalProducts === 0 && categoriesTotal === 0 && recipesTotal === 0 && totalBalances === 0) ? `
                            <div style="margin-top: 1rem; padding: 1rem; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
                                <p style="margin: 0; color: #856404; font-size: 0.95rem;">
                                    <strong>ℹ️ Информация:</strong> Все данные в порядке или база данных пуста. 
                                    ${totalProducts === 0 ? 'В базе нет товаров.' : ''}
                                    ${categoriesTotal === 0 && totalProducts > 0 ? 'Все товары уже привязаны к категориям.' : ''}
                                    ${recipesTotal === 0 && totalDishes > 0 ? 'Все блюда уже имеют техкарты.' : ''}
                                    ${totalBalances === 0 ? 'Нет записей на складе для проверки.' : ''}
                                </p>
                            </div>
                            ` : ''}
                        </div>
                    `;
                    
                    // Детальная диагностика из API
                    const productsTableExists = d.products_table_exists || false;
                    const syncedProductsCount = d.synced_products_count || 0;
                    const productsTableColumns = d.products_table_columns || [];
                    const hasTypeColumn = d.has_type_column || false;
                    const sampleProducts = d.sample_products || [];
                    
                    console.log('📊 Детальная диагностика:', {
                        'Таблица products существует': productsTableExists,
                        'Всего товаров в products': totalProducts,
                        'Товаров в synced_products': syncedProductsCount,
                        'Колонки в products': productsTableColumns,
                        'Есть колонка type': hasTypeColumn,
                        'Товаров без категорий': categoriesTotal,
                        'Всего блюд в БД': totalDishes,
                        'Блюд без техкарт': recipesTotal,
                        'Всего записей на складе': totalBalances,
                        'Проблемных записей': warehouseFixed,
                        'Примеры товаров': sampleProducts
                    });
                    
                    // Дополнительная информация
                    if (totalProducts === 0 && syncedProductsCount > 0) {
                        console.log('ℹ️ ВНИМАНИЕ: В таблице products нет товаров, но найдено', syncedProductsCount, 'товаров в таблице synced_products (синхронизированные с сайтом).');
                        console.log('💡 Товары могут храниться в другом месте или загружаться из другого источника.');
                    } else if (totalProducts === 0) {
                        console.log('⚠️ В базе данных нет товаров в таблице products.');
                        console.log('💡 Возможно, товары загружаются из другого источника (JSON файл, другой API, или хранятся в памяти JavaScript).');
                    }
                    
                    // Прокручиваем к результатам
                    setTimeout(() => {
                        resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 100);
                }
                
                // Показываем уведомление
                alert(`✅ Исправление завершено!\n\n📁 Категории: ${categoriesFixed} из ${categoriesTotal}\n🍽️ Техкарты: ${recipesCreated} из ${recipesTotal}\n📦 Склад: ${warehouseFixed} из ${warehouseChecked}\n\n🎯 Итого: ${categoriesFixed + recipesCreated + warehouseFixed} записей`);
                
                // Обновляем данные (но сохраняем результаты)
                await this.loadProducts();
                
                // Перерисовываем, но сохраняем результаты
                const savedResults = resultsDiv ? resultsDiv.innerHTML : null;
                this.render();
                
                // Восстанавливаем результаты после перерисовки
                if (savedResults && resultsDiv) {
                    setTimeout(() => {
                        const newResultsDiv = document.getElementById('fixDataResults');
                        if (newResultsDiv) {
                            newResultsDiv.innerHTML = savedResults;
                            newResultsDiv.style.display = 'block';
                            newResultsDiv.style.background = '#d4edda';
                            newResultsDiv.style.borderLeft = '4px solid #28a745';
                            newResultsDiv.style.padding = '1.5rem';
                            newResultsDiv.style.minHeight = '200px';
                            newResultsDiv.style.marginTop = '1rem';
                            newResultsDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }
                    }, 100);
                }
            } else {
                throw new Error(result.error || 'Ошибка исправления данных');
            }
        } catch (error) {
            console.error('❌ Fix data issues error:', error);
            if (resultsDiv) {
                resultsDiv.style.background = '#f8d7da';
                resultsDiv.style.borderLeft = '4px solid #dc3545';
                resultsDiv.style.padding = '1.5rem';
                resultsDiv.innerHTML = `
                    <div style="padding: 0;">
                        <h3 style="margin: 0 0 0.5rem 0; color: #721c24; font-size: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-size: 2.5rem;">❌</span>
                            <span>Ошибка исправления данных</span>
                        </h3>
                        <p style="margin: 0; color: #721c24; padding: 1rem; background: white; border-radius: 8px; font-size: 1.1rem;">
                            ${this.escapeHtml(error.message)}
                        </p>
                        <p style="margin: 0.75rem 0 0 0; color: #666; font-size: 0.95rem;">
                            Проверьте логи сервера для получения подробной информации.
                        </p>
                    </div>
                `;
            }
            alert('❌ Ошибка: ' + error.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = '🔧 Исправить проблемы с данными';
            }
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Инициализация
if (typeof window !== 'undefined') {
    window.OneCIntegrationManager = OneCIntegrationManager;
    window.onecIntegrationManager = new OneCIntegrationManager();
}

