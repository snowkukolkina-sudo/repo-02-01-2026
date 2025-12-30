/**
 * DANDY Inventory — Модуль настроек системы
 * Управление складами, единицами измерения, категориями, пользователями
 */

class SettingsModule {
    constructor(inventorySystem) {
        this.system = inventorySystem;
        
        // Настройки по умолчанию
        this.settings = this.loadSettings();
    }

    /**
     * Инициализация модуля
     */
    init() {
        console.log('⚙️ Settings module initialized');
        this.renderSettings();
    }

    /**
     * Загрузка настроек
     */
    loadSettings() {
        const saved = localStorage.getItem('dandy_inventory_settings');
        if (saved) {
            return JSON.parse(saved);
        }

        // Настройки по умолчанию
        return {
            organization: {
                name: 'ООО "ДЭНДИ"',
                inn: '7700123456',
                kpp: '770001001',
                ogrn: '1234567890123',
                address: 'Москва, ул. Примерная, д. 1',
                phone: '+7 (495) 123-45-67',
                email: 'info@dandy-cafe.ru'
            },
            tax: {
                system: 'usn_income_outcome', // usn_income_outcome, osn, psn
                vatRate: 'no_vat', // 20, 10, no_vat
                accountingMethod: 'fifo' // fifo, fefo, avg
            },
            warehouses: [
                { id: 1, name: 'Основной склад', type: 'main', isActive: true },
                { id: 2, name: 'Кухня', type: 'production', isActive: true },
                { id: 3, name: 'Бар', type: 'bar', isActive: true },
                { id: 4, name: 'Резервный склад', type: 'reserve', isActive: false }
            ],
            units: [
                { id: 'kg', name: 'кг', type: 'weight', factor: 1 },
                { id: 'g', name: 'г', type: 'weight', factor: 0.001 },
                { id: 'l', name: 'л', type: 'volume', factor: 1 },
                { id: 'ml', name: 'мл', type: 'volume', factor: 0.001 },
                { id: 'pcs', name: 'шт', type: 'piece', factor: 1 },
                { id: 'portion', name: 'порция', type: 'portion', factor: 1 }
            ],
            categories: [
                { id: 1, name: 'Рыба и морепродукты', type: 'ingredient', parent: null },
                { id: 2, name: 'Мясо и птица', type: 'ingredient', parent: null },
                { id: 3, name: 'Молочные продукты', type: 'ingredient', parent: null },
                { id: 4, name: 'Овощи и фрукты', type: 'ingredient', parent: null },
                { id: 5, name: 'Крупы и мука', type: 'ingredient', parent: null },
                { id: 6, name: 'Соусы и специи', type: 'ingredient', parent: null },
                { id: 7, name: 'Напитки безалкогольные', type: 'product', parent: null },
                { id: 8, name: 'Алкоголь крепкий', type: 'alcohol', parent: null },
                { id: 9, name: 'Вино', type: 'alcohol', parent: null },
                { id: 10, name: 'Пиво', type: 'alcohol', parent: null },
                { id: 11, name: 'Полуфабрикаты', type: 'semi_product', parent: null },
                { id: 12, name: 'Готовые блюда', type: 'dish', parent: null }
            ],
            users: [
                { id: 1, username: 'admin', name: 'Администратор', role: 'admin', isActive: true, password: 'admin123' },
                { id: 2, username: 'technologist', name: 'Елена Петрова', role: 'technologist', isActive: true, password: 'tech123' },
                { id: 3, username: 'warehouse', name: 'Иван Складской', role: 'warehouse_manager', isActive: true, password: 'wh123' },
                { id: 4, username: 'barman', name: 'Сергей Барменов', role: 'bar_manager', isActive: true, password: 'bar123' },
                { id: 5, username: 'chef', name: 'Михаил Поваров', role: 'chef', isActive: true, password: 'chef123' },
                { id: 6, username: 'accountant', name: 'Ольга Счетова', role: 'accountant', isActive: true, password: 'acc123' }
            ],
            roles: {
                admin: { name: 'Администратор', permissions: ['all'] },
                technologist: { name: 'Технолог', permissions: ['recipes', 'nomenclature_read'] },
                warehouse_manager: { name: 'Завсклад', permissions: ['warehouse', 'arrival', 'inventory'] },
                bar_manager: { name: 'Бар-менеджер', permissions: ['bar', 'alcohol'] },
                chef: { name: 'Шеф-повар', permissions: ['production', 'recipes_read'] },
                accountant: { name: 'Бухгалтер', permissions: ['reports', 'analytics'] },
                cashier: { name: 'Кассир', permissions: ['sales'] },
                auditor: { name: 'Аудитор', permissions: ['read_only'] }
            },
            notifications: {
                criticalStock: true,
                expiringProducts: true,
                inventoryReminder: true,
                syncErrors: true,
                email: 'admin@dandy-cafe.ru'
            }
        };
    }

    /**
     * Сохранение настроек
     */
    saveSettings() {
        localStorage.setItem('dandy_inventory_settings', JSON.stringify(this.settings));
        this.showNotification('✅ Настройки сохранены!', 'success');
    }

    /**
     * Отрисовка настроек
     */
    renderSettings() {
        // Обновляем формы на странице настроек
        this.updateOrganizationForm();
        this.updateTaxForm();
        this.renderWarehousesList();
        this.renderUnitsList();
        this.renderCategoriesList();
        this.renderUsersList();
    }

    /**
     * Обновление формы организации
     */
    updateOrganizationForm() {
        const org = this.settings.organization;
        const form = document.querySelector('#settings');
        if (!form) return;

        const fields = {
            'input[value="ООО \\"ДЭНДИ\\""]': org.name,
            'input[value="7700123456"]': org.inn,
            'input[value="770001001"]': org.kpp
        };

        Object.keys(fields).forEach(selector => {
            const input = form.querySelector(selector);
            if (input) input.value = fields[selector];
        });
    }

    /**
     * Обновление налоговых настроек
     */
    updateTaxForm() {
        // Будет обновлять select'ы с налоговыми настройками
    }

    /**
     * Управление складами
     */
    renderWarehousesList() {
        const container = document.getElementById('warehousesManagement');
        if (!container) return;

        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="margin: 0; color: #F3EADB;">Склады</h3>
                <button class="btn btn-primary btn-small" onclick="settingsModule.addWarehouse()">➕ Добавить склад</button>
            </div>
            <table class="table">
                <thead>
                    <tr>
                        <th>Название</th>
                        <th>Тип</th>
                        <th style="text-align: center;">Статус</th>
                        <th style="text-align: center;">Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.settings.warehouses.map(wh => `
                        <tr>
                            <td><strong>${wh.name}</strong></td>
                            <td>${this.getWarehouseTypeText(wh.type)}</td>
                            <td style="text-align: center;">
                                <span class="badge ${wh.isActive ? 'badge-success' : 'badge-danger'}">
                                    ${wh.isActive ? 'Активен' : 'Неактивен'}
                                </span>
                            </td>
                            <td style="text-align: center;">
                                <button class="btn btn-secondary btn-small" onclick="settingsModule.editWarehouse(${wh.id})">✏️</button>
                                <button class="btn btn-secondary btn-small" onclick="settingsModule.toggleWarehouse(${wh.id})">
                                    ${wh.isActive ? '🔒' : '🔓'}
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    getWarehouseTypeText(type) {
        const types = {
            'main': 'Основной',
            'production': 'Производство',
            'bar': 'Бар',
            'reserve': 'Резервный'
        };
        return types[type] || type;
    }

    addWarehouse() {
        const name = prompt('Название склада:');
        if (!name) return;

        const type = prompt('Тип (main/production/bar/reserve):') || 'main';
        
        const maxId = Math.max(...this.settings.warehouses.map(w => w.id), 0);
        this.settings.warehouses.push({
            id: maxId + 1,
            name: name,
            type: type,
            isActive: true
        });

        this.saveSettings();
        this.renderWarehousesList();
    }

    editWarehouse(id) {
        const wh = this.settings.warehouses.find(w => w.id === id);
        if (!wh) return;

        const newName = prompt('Новое название:', wh.name);
        if (newName) {
            wh.name = newName;
            this.saveSettings();
            this.renderWarehousesList();
        }
    }

    toggleWarehouse(id) {
        const wh = this.settings.warehouses.find(w => w.id === id);
        if (wh) {
            wh.isActive = !wh.isActive;
            this.saveSettings();
            this.renderWarehousesList();
        }
    }

    /**
     * Управление единицами измерения
     */
    renderUnitsList() {
        const container = document.getElementById('unitsManagement');
        if (!container) return;

        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="margin: 0; color: #F3EADB;">Единицы измерения</h3>
                <button class="btn btn-primary btn-small" onclick="settingsModule.addUnit()">➕ Добавить ЕИ</button>
            </div>
            <table class="table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Название</th>
                        <th>Тип</th>
                        <th style="text-align: right;">Коэффициент</th>
                        <th style="text-align: center;">Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.settings.units.map(unit => `
                        <tr>
                            <td><code>${unit.id}</code></td>
                            <td><strong>${unit.name}</strong></td>
                            <td>${this.getUnitTypeText(unit.type)}</td>
                            <td style="text-align: right;">${unit.factor}</td>
                            <td style="text-align: center;">
                                <button class="btn btn-secondary btn-small" onclick="settingsModule.editUnit('${unit.id}')">✏️</button>
                                <button class="btn btn-secondary btn-small" onclick="settingsModule.deleteUnit('${unit.id}')">🗑️</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    getUnitTypeText(type) {
        const types = {
            'weight': 'Вес',
            'volume': 'Объём',
            'piece': 'Штучный',
            'portion': 'Порционный'
        };
        return types[type] || type;
    }

    addUnit() {
        const id = prompt('ID единицы (латиница):');
        if (!id) return;

        const name = prompt('Название:');
        if (!name) return;

        const type = prompt('Тип (weight/volume/piece/portion):') || 'piece';
        const factor = parseFloat(prompt('Коэффициент (относительно базовой):') || '1');

        this.settings.units.push({ id, name, type, factor });
        this.saveSettings();
        this.renderUnitsList();
    }

    editUnit(id) {
        const unit = this.settings.units.find(u => u.id === id);
        if (!unit) return;

        const newName = prompt('Новое название:', unit.name);
        if (newName) {
            unit.name = newName;
            this.saveSettings();
            this.renderUnitsList();
        }
    }

    deleteUnit(id) {
        if (!confirm('Удалить единицу измерения?')) return;
        
        this.settings.units = this.settings.units.filter(u => u.id !== id);
        this.saveSettings();
        this.renderUnitsList();
    }

    /**
     * Управление категориями
     */
    renderCategoriesList() {
        const container = document.getElementById('categoriesManagement');
        if (!container) return;

        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="margin: 0; color: #F3EADB;">Категории товаров</h3>
                <button class="btn btn-primary btn-small" onclick="settingsModule.addCategory()">➕ Добавить категорию</button>
            </div>
            <table class="table">
                <thead>
                    <tr>
                        <th>Название</th>
                        <th>Тип</th>
                        <th style="text-align: center;">Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.settings.categories.map(cat => `
                        <tr>
                            <td><strong>${cat.name}</strong></td>
                            <td>
                                <span class="badge">${this.getCategoryTypeText(cat.type)}</span>
                            </td>
                            <td style="text-align: center;">
                                <button class="btn btn-secondary btn-small" onclick="settingsModule.editCategory(${cat.id})">✏️</button>
                                <button class="btn btn-secondary btn-small" onclick="settingsModule.deleteCategory(${cat.id})">🗑️</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    getCategoryTypeText(type) {
        const types = {
            'ingredient': 'Ингредиент',
            'semi_product': 'Полуфабрикат',
            'dish': 'Блюдо',
            'product': 'Товар',
            'alcohol': 'Алкоголь'
        };
        return types[type] || type;
    }

    addCategory() {
        const name = prompt('Название категории:');
        if (!name) return;

        const type = prompt('Тип (ingredient/semi_product/dish/product/alcohol):') || 'ingredient';

        const maxId = Math.max(...this.settings.categories.map(c => c.id), 0);
        this.settings.categories.push({
            id: maxId + 1,
            name: name,
            type: type,
            parent: null
        });

        this.saveSettings();
        this.renderCategoriesList();
    }

    editCategory(id) {
        const cat = this.settings.categories.find(c => c.id === id);
        if (!cat) return;

        const newName = prompt('Новое название:', cat.name);
        if (newName) {
            cat.name = newName;
            this.saveSettings();
            this.renderCategoriesList();
        }
    }

    deleteCategory(id) {
        if (!confirm('Удалить категорию?')) return;
        
        this.settings.categories = this.settings.categories.filter(c => c.id !== id);
        this.saveSettings();
        this.renderCategoriesList();
    }

    /**
     * Управление пользователями
     */
    renderUsersList() {
        const container = document.getElementById('usersManagement');
        if (!container) return;

        container.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="margin: 0; color: #F3EADB;">Пользователи и роли</h3>
                <button class="btn btn-primary btn-small" onclick="settingsModule.addUser()">➕ Добавить пользователя</button>
            </div>
            <table class="table">
                <thead>
                    <tr>
                        <th>Имя</th>
                        <th>Логин</th>
                        <th>Роль</th>
                        <th style="text-align: center;">Статус</th>
                        <th style="text-align: center;">Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.settings.users.map(user => `
                        <tr>
                            <td><strong>${user.name}</strong></td>
                            <td><code>${user.username}</code></td>
                            <td>${this.settings.roles[user.role]?.name || user.role}</td>
                            <td style="text-align: center;">
                                <span class="badge ${user.isActive ? 'badge-success' : 'badge-danger'}">
                                    ${user.isActive ? 'Активен' : 'Заблокирован'}
                                </span>
                            </td>
                            <td style="text-align: center;">
                                <button class="btn btn-secondary btn-small" onclick="settingsModule.editUser(${user.id})">✏️</button>
                                <button class="btn btn-secondary btn-small" onclick="settingsModule.toggleUser(${user.id})">
                                    ${user.isActive ? '🔒' : '🔓'}
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div style="margin-top: 2rem; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); padding: 1.5rem; border-radius: 8px;">
                <h3 style="margin: 0 0 1rem 0; color: #60a5fa;">👥 Роли и права доступа:</h3>
                ${Object.keys(this.settings.roles).map(roleKey => {
                    const role = this.settings.roles[roleKey];
                    return `
                        <div style="margin-bottom: 0.75rem; color: #F3EADB;">
                            <strong>${role.name}:</strong> ${role.permissions.join(', ')}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    addUser() {
        const username = prompt('Логин:');
        if (!username) return;

        const name = prompt('Полное имя:');
        if (!name) return;

        const role = prompt('Роль (admin/technologist/warehouse_manager/bar_manager/chef/accountant/cashier/auditor):') || 'cashier';
        const password = prompt('Пароль:') || 'password123';

        const maxId = Math.max(...this.settings.users.map(u => u.id), 0);
        this.settings.users.push({
            id: maxId + 1,
            username,
            name,
            role,
            password,
            isActive: true
        });

        this.saveSettings();
        this.renderUsersList();
    }

    editUser(id) {
        const user = this.settings.users.find(u => u.id === id);
        if (!user) return;

        const newName = prompt('Новое имя:', user.name);
        if (newName) {
            user.name = newName;
            this.saveSettings();
            this.renderUsersList();
        }
    }

    toggleUser(id) {
        const user = this.settings.users.find(u => u.id === id);
        if (user) {
            user.isActive = !user.isActive;
            this.saveSettings();
            this.renderUsersList();
        }
    }

    /**
     * Показ уведомления
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10001;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            animation: slideIn 0.3s ease-out;
            ${type === 'success' ? 'background: #16a34a;' : ''}
            ${type === 'error' ? 'background: #dc2626;' : ''}
            ${type === 'info' ? 'background: #2563eb;' : ''}
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsModule;
}

