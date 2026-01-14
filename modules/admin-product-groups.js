// Модуль управления группами товаров (раздел 3.8 ТЗ)
// VERSION: v2 - showMoveGroupForm, showImportGroupsModal, showGroupReports added
console.log('📦 admin-product-groups.js VERSION 2 LOADED - all methods included');
// Группы - иерархическая структура для складского учёта
// Категории - плоские теги для меню на сайте

class ProductGroupsManager {
    constructor() {
        this.groups = [];
        this.products = [];
        this.selectedProducts = new Set();
        this.selectedGroups = new Set();
        this.API_BASE = '/api/product-groups';
    }

    async init() {
        await this.loadGroups();
        await this.loadProducts();
        this.render();
    }

    async loadGroups() {
        try {
            const response = await fetch(this.API_BASE);
            if (!response.ok) throw new Error('API not available');
            const data = await response.json();
            this.groups = (data.ok && Array.isArray(data.data)) ? data.data : [];
        } catch (error) {
            console.warn('Groups API not available, using empty array');
            this.groups = [];
        }
    }

    async loadProducts() {
        try {
            const response = await fetch('/api/products');
            if (!response.ok) throw new Error('Products API not available');
            const data = await response.json();
            this.products = (data.ok && Array.isArray(data.data)) ? data.data : [];
        } catch (error) {
            console.warn('Products API not available');
            this.products = [];
        }
    }

    render() {
        const container = document.getElementById('productGroupsContent');
        if (!container) {
            console.warn('Container #productGroupsContent not found');
            return;
        }

        container.innerHTML = `
            <div class="product-groups-management">
                <div class="groups-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h2>📁 Управление группами товаров</h2>
                    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                        <button class="btn btn-primary" onclick="productGroupsManager.showCreateGroupForm()">
                            ➕ Создать группу
                        </button>
                        <button class="btn btn-secondary" onclick="productGroupsManager.toggleTreeView()">
                            🌳 Показать/скрыть дерево
                        </button>
                        <button class="btn btn-secondary" onclick="productGroupsManager.exportGroups()">
                            📥 Экспорт групп
                        </button>
                        <button class="btn btn-secondary" onclick="productGroupsManager.showImportGroupsModal()">
                            📤 Импорт групп
                        </button>
                        <button class="btn btn-secondary" onclick="productGroupsManager.showGroupReports()">
                            📊 Отчёты по группам
                        </button>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 1.5rem;">
                    <!-- Левая панель: Дерево групп -->
                    <div class="card">
                        <h3 style="margin-bottom: 1rem;">Дерево групп</h3>
                        <div id="groupsTree" style="max-height: 600px; overflow-y: auto;" class="groups-tree-container">
                            ${this.renderGroupsTree()}
                        </div>
                        <div id="groupsTable" style="display: none; max-height: 600px; overflow-y: auto;">
                            ${this.renderGroupsTable()}
                        </div>
                    </div>

                    <!-- Правая панель: Товары в группе -->
                    <div class="card">
                        <h3 style="margin-bottom: 1rem;">Товары в группе</h3>
                        <div id="groupProducts" style="min-height: 400px;">
                            ${this.renderGroupProducts()}
                        </div>
                    </div>
                </div>

                <!-- Таблица товаров с фильтрацией по группам -->
                <div class="card" style="margin-top: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3>Все товары</h3>
                        <div style="display: flex; gap: 0.5rem;">
                            <select id="groupFilter" class="form-input" style="width: 200px;" onchange="productGroupsManager.filterByGroup(this.value)">
                                <option value="">Все группы</option>
                                ${this.renderGroupOptions()}
                            </select>
                            <button class="btn btn-secondary" onclick="productGroupsManager.showBulkMoveModal()" id="bulkMoveBtn" disabled>
                                📦 Переместить в группу
                            </button>
                        </div>
                    </div>
                    <div id="productsTableContainer">
                        ${this.renderProductsTable()}
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    renderGroupsTree() {
        if (this.groups.length === 0) {
            return '<p style="color: #999; padding: 1rem;">Нет групп. Создайте первую группу.</p>';
        }

        const tree = this.buildTree(this.groups);
        return `
            <div style="padding: 0.75rem; background: #e3f2fd; border-radius: 8px; font-size: 0.9rem; margin-bottom: 1rem;">
                💡 <strong>Иерархия групп:</strong> Перетащите группу на другую, чтобы сделать её подгруппой. 
                Перетащите на пустое место, чтобы сделать основной группой.
            </div>
            <div id="groupsTreeNodes">
                ${this.renderTreeNodes(tree)}
            </div>
        `;
    }
    
    renderGroupsTable() {
        if (this.groups.length === 0) {
            return '<p style="color: #999; padding: 1rem;">Нет групп. Создайте первую группу.</p>';
        }
        
        const allGroups = this.getAllGroupsFlat();
        
        return `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Название</th>
                        <th>Slug</th>
                        <th>Родитель</th>
                        <th>Товаров</th>
                        <th>Ед. изм.</th>
                        <th>Счёт учёта</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${allGroups.map(group => {
                        const productCount = this.products.filter(p => p.group_id == group.id).length;
                        const parent = group.parent_id ? this.groups.find(g => g.id == group.parent_id) : null;
                        return `
                            <tr>
                                <td><strong>${this.escapeHtml(group.name)}</strong></td>
                                <td>${this.escapeHtml(group.slug || '')}</td>
                                <td>${parent ? this.escapeHtml(parent.name) : '—'}</td>
                                <td>${productCount}</td>
                                <td>${group.default_unit || '—'}</td>
                                <td>${group.default_account || '—'}</td>
                                <td>
                                    <button class="btn btn-small" onclick="productGroupsManager.showEditGroupForm(${group.id})">✏️</button>
                                    <button class="btn btn-small btn-danger" onclick="productGroupsManager.deleteGroup(${group.id})">🗑️</button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }
    
    toggleTreeView() {
        const treeContainer = document.getElementById('groupsTree');
        const tableContainer = document.getElementById('groupsTable');
        
        if (treeContainer && tableContainer) {
            const isTreeVisible = treeContainer.style.display !== 'none';
            treeContainer.style.display = isTreeVisible ? 'none' : 'block';
            tableContainer.style.display = isTreeVisible ? 'block' : 'none';
        }
    }

    buildTree(groups) {
        const map = new Map();
        const roots = [];

        groups.forEach(group => {
            const node = {
                id: group.id,
                name: group.name,
                slug: group.slug,
                parent_id: group.parent_id,
                default_unit: group.default_unit,
                default_category_stock: group.default_category_stock,
                default_account: group.default_account,
                default_tax_group: group.default_tax_group,
                children: []
            };
            map.set(group.id, node);
        });

        map.forEach(node => {
            if (node.parent_id && map.has(node.parent_id)) {
                map.get(node.parent_id).children.push(node);
            } else {
                roots.push(node);
            }
        });

        return roots;
    }

    renderTreeNodes(nodes, level = 0) {
        return nodes.map(node => {
            const indent = level * 20;
            const productCount = this.products.filter(p => p.group_id == node.id).length;
            
            return `
                <div class="group-tree-item" data-group-id="${node.id}" 
                     style="padding: 0.5rem; margin-left: ${indent}px; cursor: pointer; border-radius: 4px; 
                            ${this.selectedGroupId === node.id ? 'background: #e8f5f3;' : ''}"
                     onclick="productGroupsManager.selectGroup(${node.id})">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span>📁</span>
                            <strong>${this.escapeHtml(node.name)}</strong>
                            <span style="color: #999; font-size: 0.9em;">(${productCount})</span>
                        </div>
                        <div style="display: flex; gap: 0.25rem;">
                            <button class="btn btn-small" onclick="event.stopPropagation(); productGroupsManager.showEditGroupForm(${node.id})" title="Редактировать">
                                ✏️
                            </button>
                            <button class="btn btn-small" onclick="event.stopPropagation(); productGroupsManager.showMoveGroupForm(${node.id})" title="Переместить">
                                📦
                            </button>
                            <button class="btn btn-small btn-danger" onclick="event.stopPropagation(); productGroupsManager.deleteGroup(${node.id})" title="Удалить">
                                🗑️
                            </button>
                        </div>
                    </div>
                    ${node.children.length > 0 ? this.renderTreeNodes(node.children, level + 1) : ''}
                </div>
            `;
        }).join('');
    }

    renderGroupOptions() {
        const allGroups = this.getAllGroupsFlat();
        return allGroups.map(group => {
            const indent = group.level > 0 ? '— '.repeat(group.level) : '';
            return `<option value="${group.id}">${indent}${this.escapeHtml(group.name)}</option>`;
        }).join('');
    }

    getAllGroupsFlat() {
        const result = [];
        const traverse = (nodes, level = 0) => {
            nodes.forEach(node => {
                result.push({ ...node, level });
                if (node.children) {
                    traverse(node.children, level + 1);
                }
            });
        };
        traverse(this.buildTree(this.groups));
        return result;
    }

    renderGroupProducts() {
        if (!this.selectedGroupId) {
            return '<p style="color: #999; padding: 1rem;">Выберите группу для просмотра товаров</p>';
        }

        const groupProducts = this.products.filter(p => p.group_id == this.selectedGroupId);
        
        if (groupProducts.length === 0) {
            return '<p style="color: #999; padding: 1rem;">В этой группе нет товаров</p>';
        }

        return `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>SKU</th>
                        <th>Название</th>
                        <th>Тип</th>
                        <th>Цена</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${groupProducts.map(product => `
                        <tr>
                            <td>${product.sku || '—'}</td>
                            <td><strong>${this.escapeHtml(product.name || 'Без названия')}</strong></td>
                            <td>${product.type || 'product'}</td>
                            <td>₽ ${product.price || 0}</td>
                            <td>
                                <button class="btn btn-small" onclick="productGroupsManager.removeProductFromGroup(${product.id})">
                                    Удалить из группы
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    renderProductsTable() {
        const filteredProducts = this.filteredProducts || this.products;
        
        return `
            <table class="data-table">
                <thead>
                    <tr>
                        <th><input type="checkbox" id="selectAllProducts" onchange="productGroupsManager.toggleSelectAll(this.checked)"></th>
                        <th>SKU</th>
                        <th>Название</th>
                        <th>Группа</th>
                        <th>Тип</th>
                        <th>Цена</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredProducts.map(product => {
                        const group = this.groups.find(g => g.id == product.group_id);
                        const isSelected = this.selectedProducts.has(product.id);
                        return `
                            <tr ${isSelected ? 'style="background: #e8f5f3;"' : ''}>
                                <td>
                                    <input type="checkbox" class="product-checkbox" 
                                           value="${product.id}" 
                                           ${isSelected ? 'checked' : ''}
                                           onchange="productGroupsManager.toggleProductSelection(${product.id})">
                                </td>
                                <td>${product.sku || '—'}</td>
                                <td><strong>${this.escapeHtml(product.name || 'Без названия')}</strong></td>
                                <td>${group ? this.escapeHtml(group.name) : '<span style="color: #999;">—</span>'}</td>
                                <td>${product.type || 'product'}</td>
                                <td>₽ ${product.price || 0}</td>
                                <td>
                                    <select class="form-input" style="width: 150px; font-size: 0.9em;" 
                                            onchange="productGroupsManager.moveProductToGroup(${product.id}, this.value)">
                                        <option value="">— Изменить группу —</option>
                                        ${this.renderGroupOptions()}
                                    </select>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    selectGroup(groupId) {
        this.selectedGroupId = groupId;
        this.render();
    }

    async showCreateGroupForm() {
        const modal = this.createModal('Создать группу', `
            <form id="createGroupForm">
                <div class="form-group">
                    <label class="form-label">Название группы *</label>
                    <input type="text" name="name" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Slug (автоматически)</label>
                    <input type="text" name="slug" class="form-input" placeholder="pizza-ingredients">
                </div>
                <div class="form-group">
                    <label class="form-label">Родительская группа</label>
                    <select name="parent_id" class="form-input">
                        <option value="">Корень (без родителя)</option>
                        ${this.renderGroupOptions()}
                    </select>
                </div>
                <details style="margin-top: 1rem;">
                    <summary style="cursor: pointer; font-weight: 600;">Настройки по умолчанию для товаров</summary>
                    <div style="margin-top: 1rem; padding: 1rem; background: #f9fafb; border-radius: 8px;">
                        <div class="form-group">
                            <label class="form-label">Единица измерения по умолчанию</label>
                            <select name="default_unit" class="form-input">
                                <option value="">—</option>
                                <option value="шт">шт</option>
                                <option value="кг">кг</option>
                                <option value="г">г</option>
                                <option value="л">л</option>
                                <option value="мл">мл</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Категория номенклатуры по умолчанию</label>
                            <input type="text" name="default_category_stock" class="form-input" placeholder="ID категории">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Счёт учёта по умолчанию</label>
                            <input type="text" name="default_account" class="form-input" placeholder="41.01">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Налоговая группа</label>
                            <select name="default_tax_group" class="form-input">
                                <option value="">—</option>
                                <option value="20">НДС 20%</option>
                                <option value="10">НДС 10%</option>
                                <option value="0">Без НДС</option>
                            </select>
                        </div>
                    </div>
                </details>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">💾 Создать</button>
                    <button type="button" class="btn btn-secondary" onclick="productGroupsManager.closeModal()">Отмена</button>
                </div>
            </form>
        `);

        modal.querySelector('#createGroupForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            
            // Автогенерация slug
            if (!data.slug && data.name) {
                data.slug = this.generateSlug(data.name);
            }

            await this.createGroup(data);
        });
    }

    async createGroup(data) {
        try {
            const response = await fetch(this.API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (result.ok || result.success) {
                await this.loadGroups();
                this.render();
                this.closeModal();
                alert('✅ Группа создана');
            } else {
                throw new Error(result.error || 'Ошибка создания группы');
            }
        } catch (error) {
            console.error('Error creating group:', error);
            alert('❌ Ошибка: ' + error.message);
        }
    }

    showMoveGroupForm(groupId) {
        const group = this.groups.find(g => g.id == groupId);
        if (!group) {
            alert('Группа не найдена');
            return;
        }

        const modal = this.createModal('Переместить группу', `
            <form id="moveGroupForm">
                <div class="form-group">
                    <label class="form-label">Новая родительская группа</label>
                    <select name="parent_id" class="form-input">
                        <option value="">Корень (без родителя)</option>
                        ${this.renderGroupOptions().replace(`value="${groupId}"`, `value="${groupId}" disabled`)}
                    </select>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">📦 Переместить</button>
                    <button type="button" class="btn btn-secondary" onclick="productGroupsManager.closeModal()">Отмена</button>
                </div>
            </form>
        `);

        modal.querySelector('#moveGroupForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            data.name = group.name; // Сохраняем имя
            data.slug = group.slug; // Сохраняем slug
            await this.updateGroup(groupId, data);
        });
    }

    async showEditGroupForm(groupId) {
        const group = this.groups.find(g => g.id == groupId);
        if (!group) {
            alert('Группа не найдена');
            return;
        }

        const modal = this.createModal('Редактировать группу', `
            <form id="editGroupForm">
                <div class="form-group">
                    <label class="form-label">Название группы *</label>
                    <input type="text" name="name" class="form-input" value="${this.escapeHtml(group.name || '')}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Slug</label>
                    <input type="text" name="slug" class="form-input" value="${this.escapeHtml(group.slug || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label">Родительская группа</label>
                    <select name="parent_id" class="form-input">
                        <option value="">Корень (без родителя)</option>
                        ${this.renderGroupOptions().replace(`value="${groupId}"`, `value="${groupId}" disabled`)}
                    </select>
                </div>
                <details style="margin-top: 1rem;" open>
                    <summary style="cursor: pointer; font-weight: 600;">Настройки по умолчанию</summary>
                    <div style="margin-top: 1rem; padding: 1rem; background: #f9fafb; border-radius: 8px;">
                        <div class="form-group">
                            <label class="form-label">Единица измерения по умолчанию</label>
                            <select name="default_unit" class="form-input">
                                <option value="">—</option>
                                <option value="шт" ${group.default_unit === 'шт' ? 'selected' : ''}>шт</option>
                                <option value="кг" ${group.default_unit === 'кг' ? 'selected' : ''}>кг</option>
                                <option value="г" ${group.default_unit === 'г' ? 'selected' : ''}>г</option>
                                <option value="л" ${group.default_unit === 'л' ? 'selected' : ''}>л</option>
                                <option value="мл" ${group.default_unit === 'мл' ? 'selected' : ''}>мл</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Категория номенклатуры по умолчанию</label>
                            <input type="text" name="default_category_stock" class="form-input" 
                                   value="${group.default_category_stock || ''}" placeholder="ID категории">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Счёт учёта по умолчанию</label>
                            <input type="text" name="default_account" class="form-input" 
                                   value="${group.default_account || ''}" placeholder="41.01">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Налоговая группа</label>
                            <select name="default_tax_group" class="form-input">
                                <option value="">—</option>
                                <option value="20" ${group.default_tax_group == 20 ? 'selected' : ''}>НДС 20%</option>
                                <option value="10" ${group.default_tax_group == 10 ? 'selected' : ''}>НДС 10%</option>
                                <option value="0" ${group.default_tax_group == 0 ? 'selected' : ''}>Без НДС</option>
                            </select>
                        </div>
                    </div>
                </details>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">💾 Сохранить</button>
                    <button type="button" class="btn btn-secondary" onclick="productGroupsManager.closeModal()">Отмена</button>
                </div>
            </form>
        `);

        modal.querySelector('#editGroupForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            await this.updateGroup(groupId, data);
        });
    }

    async updateGroup(groupId, data) {
        try {
            const response = await fetch(`${this.API_BASE}/${groupId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (result.ok || result.success) {
                await this.loadGroups();
                this.render();
                this.closeModal();
                alert('✅ Группа обновлена');
            } else {
                throw new Error(result.error || 'Ошибка обновления группы');
            }
        } catch (error) {
            console.error('Error updating group:', error);
            alert('❌ Ошибка: ' + error.message);
        }
    }

    async deleteGroup(groupId) {
        const group = this.groups.find(g => g.id == groupId);
        if (!group) return;

        const productCount = this.products.filter(p => p.group_id == groupId).length;
        const message = productCount > 0 
            ? `Группа "${group.name}" содержит ${productCount} товаров. Товары останутся без группы. Продолжить?`
            : `Удалить группу "${group.name}"?`;

        if (!confirm(message)) return;

        try {
            const response = await fetch(`${this.API_BASE}/${groupId}`, {
                method: 'DELETE'
            });

            const result = await response.json();
            if (result.ok || result.success) {
                await this.loadGroups();
                await this.loadProducts();
                this.render();
                alert('✅ Группа удалена');
            } else {
                throw new Error(result.error || 'Ошибка удаления группы');
            }
        } catch (error) {
            console.error('Error deleting group:', error);
            alert('❌ Ошибка: ' + error.message);
        }
    }

    async moveProductToGroup(productId, groupId) {
        try {
            const response = await fetch(`/api/products/${productId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ group_id: groupId ? parseInt(groupId) : null })
            });

            if (response.ok) {
                await this.loadProducts();
                this.render();
            } else {
                throw new Error('Ошибка перемещения товара');
            }
        } catch (error) {
            console.error('Error moving product:', error);
            alert('❌ Ошибка перемещения товара');
        }
    }

    async showBulkMoveModal() {
        if (this.selectedProducts.size === 0) {
            alert('Выберите товары для перемещения');
            return;
        }

        const modal = this.createModal('Массовое перемещение товаров', `
            <p>Переместить ${this.selectedProducts.size} товаров в группу:</p>
            <select id="targetGroup" class="form-input">
                <option value="">— Без группы —</option>
                ${this.renderGroupOptions()}
            </select>
            <div class="form-actions" style="margin-top: 1rem;">
                <button class="btn btn-primary" onclick="productGroupsManager.executeBulkMove()">Переместить</button>
                <button class="btn btn-secondary" onclick="productGroupsManager.closeModal()">Отмена</button>
            </div>
        `);
    }

    async executeBulkMove() {
        const targetGroupId = document.getElementById('targetGroup')?.value || null;
        const productIds = Array.from(this.selectedProducts);

        try {
            const response = await fetch('/api/products/bulk', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productIds,
                    updates: { group_id: targetGroupId ? parseInt(targetGroupId) : null }
                })
            });

            if (response.ok) {
                await this.loadProducts();
                this.selectedProducts.clear();
                this.render();
                this.closeModal();
                alert(`✅ Перемещено ${productIds.length} товаров`);
            } else {
                throw new Error('Ошибка массового перемещения');
            }
        } catch (error) {
            console.error('Error bulk moving:', error);
            alert('❌ Ошибка перемещения товаров');
        }
    }

    filterByGroup(groupId) {
        if (!groupId) {
            this.filteredProducts = null;
        } else {
            this.filteredProducts = this.products.filter(p => p.group_id == groupId);
        }
        this.render();
    }

    toggleProductSelection(productId) {
        if (this.selectedProducts.has(productId)) {
            this.selectedProducts.delete(productId);
        } else {
            this.selectedProducts.add(productId);
        }
        this.updateBulkMoveButton();
    }

    toggleSelectAll(checked) {
        const checkboxes = document.querySelectorAll('.product-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = checked;
            const productId = parseInt(cb.value);
            if (checked) {
                this.selectedProducts.add(productId);
            } else {
                this.selectedProducts.delete(productId);
            }
        });
        this.updateBulkMoveButton();
    }

    updateBulkMoveButton() {
        const btn = document.getElementById('bulkMoveBtn');
        if (btn) {
            btn.disabled = this.selectedProducts.size === 0;
        }
    }

    attachEventListeners() {
        const selectAll = document.getElementById('selectAllProducts');
        if (selectAll) {
            selectAll.addEventListener('change', (e) => this.toggleSelectAll(e.target.checked));
        }
    }

    generateSlug(name) {
        return name.toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
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
                    <button class="modal-close" onclick="productGroupsManager.closeModal()">×</button>
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

    async exportGroups() {
        const csv = this.groupsToCSV(this.groups);
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `product_groups_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }

    groupsToCSV(groups) {
        const headers = ['name', 'slug', 'parent_slug', 'default_unit', 'default_category_stock', 'default_account', 'default_tax_group'];
        let csv = '\ufeff' + headers.join(',') + '\n';
        groups.forEach(group => {
            const parent = group.parent_id ? groups.find(g => g.id === group.parent_id) : null;
            csv += [
                `"${(group.name || '').replace(/"/g, '""')}"`,
                `"${(group.slug || '').replace(/"/g, '""')}"`,
                parent ? `"${(parent.slug || '').replace(/"/g, '""')}"` : '',
                `"${(group.default_unit || '').replace(/"/g, '""')}"`,
                group.default_category_stock || '',
                `"${(group.default_account || '').replace(/"/g, '""')}"`,
                group.default_tax_group || ''
            ].join(',') + '\n';
        });
        return csv;
    }
    
    // Drag & Drop для групп
    handleDragStart(event, groupId) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', groupId.toString());
        event.currentTarget.style.opacity = '0.5';
        this.draggedGroupId = groupId;
    }
    
    handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }
    
    async handleDrop(event, targetGroupId) {
        event.preventDefault();
        event.stopPropagation();
        
        if (!this.draggedGroupId || this.draggedGroupId == targetGroupId) {
            return;
        }
        
        // Проверка на циклические ссылки
        if (this.wouldCreateCycle(this.draggedGroupId, targetGroupId)) {
            alert('❌ Нельзя переместить группу в её подгруппу');
            return;
        }
        
        try {
            const response = await fetch(`${this.API_BASE}/${this.draggedGroupId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ parent_id: targetGroupId ? parseInt(targetGroupId) : null })
            });
            
            if (response.ok) {
                await this.loadGroups();
                this.render();
            }
        } catch (error) {
            console.error('Error moving group:', error);
            alert('❌ Ошибка перемещения группы');
        }
    }
    
    handleDragEnd(event) {
        event.currentTarget.style.opacity = '1';
        this.draggedGroupId = null;
    }
    
    wouldCreateCycle(groupId, newParentId) {
        if (!newParentId) return false;
        
        // Проверяем, не является ли newParentId потомком groupId
        const checkParent = (parentId) => {
            if (parentId == groupId) return true;
            const parent = this.groups.find(g => g.id == parentId);
            if (!parent || !parent.parent_id) return false;
            return checkParent(parent.parent_id);
        };
        
        return checkParent(newParentId);
    }

    showImportGroupsModal() {
        const modal = this.createModal('Импорт групп товаров', `
            <form id="importGroupsForm">
                <div class="form-group">
                    <label class="form-label">Выберите CSV файл</label>
                    <input type="file" name="file" accept=".csv" class="form-input" required>
                    <small style="color: #666; display: block; margin-top: 0.5rem;">
                        Формат CSV: name,slug,parent_id,default_unit,default_category_stock,default_account,default_tax_group
                    </small>
                </div>
                <div class="form-group">
                    <label class="form-label">
                        <input type="checkbox" name="updateExisting" checked>
                        Обновлять существующие группы (по slug)
                    </label>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">📤 Импортировать</button>
                    <button type="button" class="btn btn-secondary" onclick="productGroupsManager.closeModal()">Отмена</button>
                </div>
            </form>
        `);

        modal.querySelector('#importGroupsForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const file = formData.get('file');
            const updateExisting = formData.get('updateExisting') === 'on';

            if (!file) {
                alert('Выберите файл');
                return;
            }

            try {
                const text = await file.text();
                const lines = text.split('\n').filter(line => line.trim());
                if (lines.length < 2) {
                    alert('Файл должен содержать заголовок и хотя бы одну строку данных');
                    return;
                }

                const headers = lines[0].split(',').map(h => h.trim());
                const nameIndex = headers.indexOf('name');
                if (nameIndex === -1) {
                    alert('В файле должна быть колонка "name"');
                    return;
                }

                let imported = 0;
                let updated = 0;
                let errors = 0;

                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',').map(v => v.trim());
                    if (values.length < headers.length) continue;

                    const groupData = {
                        name: values[nameIndex] || '',
                        slug: headers.includes('slug') ? values[headers.indexOf('slug')] : null,
                        parent_id: headers.includes('parent_id') && values[headers.indexOf('parent_id')] ? parseInt(values[headers.indexOf('parent_id')]) : null,
                        default_unit: headers.includes('default_unit') ? values[headers.indexOf('default_unit')] : null,
                        default_category_stock: headers.includes('default_category_stock') && values[headers.indexOf('default_category_stock')] ? parseInt(values[headers.indexOf('default_category_stock')]) : null,
                        default_account: headers.includes('default_account') ? values[headers.indexOf('default_account')] : null,
                        default_tax_group: headers.includes('default_tax_group') ? values[headers.indexOf('default_tax_group')] : null
                    };

                    if (!groupData.name) continue;

                    try {
                        if (updateExisting && groupData.slug) {
                            // Проверяем существование по slug
                            const existing = this.groups.find(g => g.slug === groupData.slug);
                            if (existing) {
                                const response = await fetch(`${this.API_BASE}/${existing.id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(groupData)
                                });
                                if (response.ok) updated++;
                                else errors++;
                            } else {
                                const response = await fetch(this.API_BASE, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(groupData)
                                });
                                if (response.ok) imported++;
                                else errors++;
                            }
                        } else {
                            const response = await fetch(this.API_BASE, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(groupData)
                            });
                            if (response.ok) imported++;
                            else errors++;
                        }
                    } catch (error) {
                        errors++;
                        console.error('Error importing group:', error);
                    }
                }

                await this.loadGroups();
                this.render();
                this.closeModal();
                alert(`✅ Импорт завершён: создано ${imported}, обновлено ${updated}, ошибок ${errors}`);
            } catch (error) {
                console.error('Error importing groups:', error);
                alert('❌ Ошибка импорта: ' + error.message);
            }
        });
    }

    showGroupReports() {
        // Подсчитываем статистику по группам
        const stats = this.groups.map(group => {
            const productsInGroup = this.products.filter(p => p.group_id == group.id);
            const totalValue = productsInGroup.reduce((sum, p) => {
                const price = parseFloat(p.price) || 0;
                const quantity = parseFloat(p.stock_quantity) || 0;
                return sum + (price * quantity);
            }, 0);

            return {
                group: group.name,
                productsCount: productsInGroup.length,
                totalValue: totalValue,
                avgPrice: productsInGroup.length > 0 
                    ? productsInGroup.reduce((sum, p) => sum + (parseFloat(p.price) || 0), 0) / productsInGroup.length 
                    : 0
            };
        });

        const modal = this.createModal('Отчёты по группам товаров', `
            <div style="max-height: 600px; overflow-y: auto;">
                <table class="table" style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f5f5f5;">
                            <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #ddd;">Группа</th>
                            <th style="padding: 0.75rem; text-align: right; border-bottom: 2px solid #ddd;">Товаров</th>
                            <th style="padding: 0.75rem; text-align: right; border-bottom: 2px solid #ddd;">Средняя цена</th>
                            <th style="padding: 0.75rem; text-align: right; border-bottom: 2px solid #ddd;">Общая стоимость</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${stats.map(stat => `
                            <tr>
                                <td style="padding: 0.75rem; border-bottom: 1px solid #eee;">${this.escapeHtml(stat.group)}</td>
                                <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #eee;">${stat.productsCount}</td>
                                <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #eee;">${stat.avgPrice.toFixed(2)} ₽</td>
                                <td style="padding: 0.75rem; text-align: right; border-bottom: 1px solid #eee;">${stat.totalValue.toFixed(2)} ₽</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="form-actions" style="margin-top: 1rem;">
                <button type="button" class="btn btn-secondary" onclick="productGroupsManager.closeModal()">Закрыть</button>
            </div>
        `);
    }
}

// Инициализация
if (typeof window !== 'undefined') {
    window.ProductGroupsManager = ProductGroupsManager;
    window.productGroupsManager = new ProductGroupsManager();
}

