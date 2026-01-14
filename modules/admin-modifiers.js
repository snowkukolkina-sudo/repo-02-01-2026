// Модуль управления модификаторами (раздел 3.1 ТЗ)
// CRUD операции для модификаторов, привязка к блюдам и категориям

class ModifiersManager {
    constructor() {
        this.modifiers = [];
        this.groups = [];
        this.products = [];
        this.categories = []; // ✅ Добавлено: список категорий
        this.catalogGroups = [];
        this.apiMode = 'unknown';
        this._modifierIngredientsDraft = [];
        this._modifierIngredientsModifierId = null;
    }

    getAuthHeaders(extra = {}) {
        const token = localStorage.getItem('token') || '';
        return Object.assign(
            {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            extra
        );
    }

    async detectApiMode() {
        if (this.apiMode !== 'unknown') return this.apiMode;

        // ✅ ВАЖНО: на проде может быть активен catalog API (Node), поэтому всегда пытаемся его определить через health.
        // Если endpoint отсутствует (PHP окружение) — вернём legacy.
        try {
            const response = await fetch('/api/catalog/health', {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
            });
            if (response.ok) {
                this.apiMode = 'catalog';
                return this.apiMode;
            }
            if (response.status === 404) {
                this.apiMode = 'legacy';
                return this.apiMode;
            }

            // Если health существует, но требует авторизацию/права (401/403) — catalog API всё равно доступен.
            if (response.status === 401 || response.status === 403) {
                this.apiMode = 'catalog';
                return this.apiMode;
            }
        } catch (_) {}

        this.apiMode = 'legacy';
        return this.apiMode;
    }

    mapCatalogGroupsToLegacy(groups) {
        if (!Array.isArray(groups)) return [];
        const rows = [];
        groups.forEach((g) => {
            const groupName = g.group_name || g.name || '—';
            const opts = Array.isArray(g.options) ? g.options : [];
            opts.forEach((opt) => {
                rows.push({
                    id: opt.id,
                    option_name: opt.name,
                    group_name: groupName,
                    type: opt.type || 'checkbox',
                    price_value: typeof opt.price === 'number' ? opt.price : (parseFloat(opt.price) || 0),
                    image_url: opt.image_url || '',
                    price_mode: 'fixed',
                    item_id: null,
                    max_qty: null,
                    default_on: opt.default_active ? 1 : 0,
                    is_visible: (opt.is_visible === false || opt.is_visible === 0) ? 0 : 1,
                    show_in_product_card: (opt.show_in_product_card === false || opt.show_in_product_card === 0) ? 0 : 1,
                    category_ids: Array.isArray(opt.category_ids) ? opt.category_ids : [],
                    _group_id: g.group_id,
                    _raw_group: g
                });
            });
        });
        return rows;
    }

    async init() {
        await this.loadModifiers();
        await this.loadProducts();
        await this.loadCategories(); // ✅ Добавлено: загрузка категорий
        this.render();
    }

    // ✅ НОВЫЙ МЕТОД: Загрузка категорий
    async loadCategories() {
        try {
            console.log('🔄 Загрузка категорий...');
            const response = await fetch('/api/categories');
            if (response.ok) {
                const result = await response.json();
                this.categories = (result.ok && Array.isArray(result.data)) ? result.data : 
                                 (result.success && Array.isArray(result.data)) ? result.data : [];
                console.log('✅ Загружено категорий:', this.categories.length);
                if (this.categories.length > 0) {
                    console.log('📋 Категории:', this.categories.map(c => c.name).join(', '));
                } else {
                    console.warn('⚠️ Список категорий пуст!');
                }
            } else {
                console.warn('⚠️ Не удалось загрузить категории, статус:', response.status);
                const text = await response.text().catch(() => '');
                console.warn('Ответ сервера:', text);
                this.categories = [];
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки категорий:', error);
            this.categories = [];
        }
    }

    async loadModifiers() {
        try {
            const mode = await this.detectApiMode();
            if (mode === 'catalog') {
                const response = await fetch('/api/catalog/modifiers', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
                });
                if (response.ok) {
                    const result = await response.json();
                    const data = (result.success && Array.isArray(result.data)) ? result.data : [];
                    this.catalogGroups = data;
                    this.modifiers = this.mapCatalogGroupsToLegacy(data);
                } else if (response.status === 404) {
                    this.apiMode = 'legacy';
                    return this.loadModifiers();
                } else {
                    this.modifiers = [];
                    this.catalogGroups = [];
                }
            } else {
                const response = await fetch('/api/modifiers');
                if (response.ok) {
                    const result = await response.json();
                    this.modifiers = (result.ok && Array.isArray(result.data)) ? result.data : [];
                } else {
                    this.modifiers = [];
                }
                this.catalogGroups = [];
            }
        } catch (error) {
            console.warn('Modifiers API not available, using empty array');
            this.modifiers = [];
            this.catalogGroups = [];
        }
    }

    async loadProducts() {
        try {
            const mode = await this.detectApiMode();
            if (mode === 'catalog') {
                const response = await fetch('/api/catalog/products?limit=10000', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
                });
                if (response.ok) {
                    const result = await response.json();
                    this.products = (result.success && Array.isArray(result.data)) ? result.data : [];
                } else if (response.status === 404) {
                    this.apiMode = 'legacy';
                    return this.loadProducts();
                }
            } else {
                const response = await fetch('/api/products?for_modifiers=1');
                if (response.ok) {
                    const result = await response.json();
                    // Поддерживаем оба формата: {ok: true, data: []} (PHP) и {success: true, data: []} (Node catalog)
                    const ok = result.ok || result.success;
                    const data = result.data || (result.items || []);
                    this.products = (ok && Array.isArray(data)) ? data : [];
console.log('[МОДИФИКАТОРЫ] Загружено продуктов для ингредиентов:', this.products.length, this.products);
if(!this.products.length){console.warn('[МОДИФИКАТОРЫ] Список продуктов для ингредиентов пуст.')}
                } else {
                    this.products = [];
                }
            }
        } catch (error) {
            console.warn('Products API not available');
            this.products = [];
        }
    }

    render() {
        const container = document.getElementById('modifiersContent');
        if (!container) {
            console.warn('Container #modifiersContent not found');
            return;
        }

        container.innerHTML = `
            <div class="modifiers-management">
                <div class="modifiers-header" style="margin-bottom: 2rem;">
                    <h2>⚙️ Управление модификаторами</h2>
                    <p style="color: #666; margin-top: 0.5rem;">
                        Модификаторы — дополнительные параметры блюд (соусы, опции приготовления, доп. ингредиенты)
                    </p>
                </div>

                <div style="margin-bottom: 1.5rem;">
                    <button class="btn btn-primary" onclick="modifiersManager.showCreateModifierForm()">
                        ➕ Создать модификатор
                    </button>
                    <button class="btn btn-secondary" onclick="modifiersManager.showImportModal()" style="margin-left: 0.5rem;">
                        📥 Импорт модификаторов
                    </button>
                    <button class="btn btn-secondary" onclick="modifiersManager.exportModifiers()" style="margin-left: 0.5rem;">
                        📤 Экспорт модификаторов
                    </button>
                </div>

                <div class="card">
                    <h3 style="margin-bottom: 1rem;">📋 Список модификаторов</h3>
                    ${this.renderModifiersTable()}
                </div>
            </div>
        `;
    }

    renderModifiersTable() {
        if (this.modifiers.length === 0) {
            return '<p style="color: #999; padding: 2rem; text-align: center;">Модификаторы не найдены. Создайте первый модификатор.</p>';
        }

        return `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Название</th>
                        <th>Группа</th>
                        <th>Тип</th>
                        <th>Цена</th>
                        <th>Применяется к</th>
                        <th>Статус</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.modifiers.map(modifier => `
                        <tr>
                            <td>
                                ${modifier.image_url ? `<img src="${this.escapeHtml(modifier.image_url)}" alt="${this.escapeHtml(modifier.option_name || modifier.name || '')}" style="width: 28px; height: 28px; object-fit: cover; border-radius: 8px; margin-right: 8px; vertical-align: middle;" onerror="this.style.display='none'">` : ''}
                                <strong>${this.escapeHtml(modifier.option_name || modifier.name || '—')}</strong>
                            </td>
                            <td>${this.escapeHtml(modifier.group_name || '—')}</td>
                            <td>${this.escapeHtml(modifier.type || 'switch')}</td>
                            <td>${modifier.price_value || 0} ₽</td>
                            <td>${this.getAppliedToText(modifier)}</td>
                            <td>${modifier.is_visible ? '✅ Активен' : '❌ Скрыт'}</td>
                            <td>
                                <button class="btn btn-small" onclick="modifiersManager.editModifier(${modifier.id})">✏️</button>
                                <button class="btn btn-small" onclick="modifiersManager.editModifierIngredients(${modifier.id})">🥗 43_MOD</button>
                                <button class="btn btn-small btn-danger" onclick="modifiersManager.deleteModifier(${modifier.id})">🗑️</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    getProductNameById(productId) {
        const pid = String(productId);
        const p = (this.products || []).find(x => String(x.id) === pid);
        return p ? (p.name || p.product_name || p.title || pid) : pid;
    }

    async editModifierIngredients(modifierId) {
        const mode = await this.detectApiMode();
        if (mode === 'catalog') {
            alert('⚠️ Режим catalog API: правила 43_MOD доступны только в legacy/PHP API.');
            return;
        }

        await this.loadProducts();

        this._modifierIngredientsModifierId = modifierId;
        this._modifierIngredientsDraft = [];

        let loaded = [];
        try {
            const resp = await fetch(`/api/modifiers/${modifierId}/ingredients`);
            const data = await resp.json().catch(() => null);
            if (!resp.ok || !data || !data.ok) {
                throw new Error((data && (data.error || data.message)) ? (data.error || data.message) : `HTTP ${resp.status}`);
            }
            loaded = Array.isArray(data.ingredients) ? data.ingredients : [];
        } catch (e) {
            loaded = [];
        }

        this._modifierIngredientsDraft = loaded.map((row) => ({
            ingredient_product_id: row.ingredient_product_id ?? row.product_id ?? row.id ?? null,
            quantity: row.quantity ?? row.qty ?? 0,
            unit: row.unit ?? 'шт'
        }));

        if (this._modifierIngredientsDraft.length === 0) {
            this._modifierIngredientsDraft.push({ ingredient_product_id: null, quantity: 1, unit: 'шт' });
        }

        const modifier = this.modifiers.find(m => m.id === modifierId);
        const titleName = modifier ? (modifier.option_name || modifier.name || `#${modifierId}`) : `#${modifierId}`;

        const modal = this.createModal(`Ингредиенты модификатора (43_MOD): ${this.escapeHtml(titleName)}`, `
            <div style="margin-bottom: 1rem; color:#666;">
                Здесь задаются ингредиенты, которые будут дополнительно списываться при продаже блюда с выбранным модификатором.
            </div>
            <div class="table-responsive">
                <table class="data-table" style="margin-bottom: 1rem;">
                    <thead>
                        <tr>
                            <th>Ингредиент</th>
                            <th>Кол-во</th>
                            <th>Ед.</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody id="modifierIngredientsBody">
                        ${this.renderModifierIngredientsRows()}
                    </tbody>
                </table>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button class="btn btn-secondary" type="button" onclick="modifiersManager.addModifierIngredientRow()">➕ Добавить строку</button>
                <button class="btn btn-primary" type="button" onclick="modifiersManager.saveModifierIngredients()">💾 Сохранить</button>
                <button class="btn btn-secondary" type="button" onclick="modifiersManager.closeModal()">Отмена</button>
            </div>
        `);
    }

    renderModifierIngredientsRows() {
        const options = ['<option value="">— выберите —</option>'].concat(
            (this.products || []).map(p => {
                const name = this.escapeHtml(p.name || p.product_name || p.title || String(p.id));
                return `<option value="${p.id}">${name}</option>`;
            })
        );

        return (this._modifierIngredientsDraft || []).map((row, idx) => {
            const selected = row.ingredient_product_id !== null && row.ingredient_product_id !== undefined
                ? String(row.ingredient_product_id)
                : '';
            const qty = row.quantity !== null && row.quantity !== undefined ? row.quantity : '';
            const unit = row.unit || 'шт';

            const opts = options.map(o => {
                if (selected && o.includes(`value=\"${this.escapeHtml(selected)}\"`)) {
                    return o.replace('>', ' selected>');
                }
                return o;
            }).join('');

            return `
                <tr>
                    <td>
                        <select class="form-input" style="min-width: 280px;" onchange="modifiersManager.updateModifierIngredientField(${idx}, 'ingredient_product_id', this.value)">
                            ${opts}
                        </select>
                    </td>
                    <td>
                        <input class="form-input" style="width: 120px;" value="${this.escapeHtml(String(qty))}" oninput="modifiersManager.updateModifierIngredientField(${idx}, 'quantity', this.value)">
                    </td>
                    <td>
                        <input class="form-input" style="width: 80px;" value="${this.escapeHtml(String(unit))}" oninput="modifiersManager.updateModifierIngredientField(${idx}, 'unit', this.value)">
                    </td>
                    <td>
                        <button class="btn btn-small btn-danger" type="button" onclick="modifiersManager.removeModifierIngredientRow(${idx})">🗑️</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    updateModifierIngredientField(index, field, value) {
        if (!Array.isArray(this._modifierIngredientsDraft)) {
            this._modifierIngredientsDraft = [];
        }
        if (!this._modifierIngredientsDraft[index]) {
            return;
        }

        if (field === 'ingredient_product_id') {
            const v = parseInt(value || '0', 10);
            this._modifierIngredientsDraft[index].ingredient_product_id = v > 0 ? v : null;
            this.rerenderModifierIngredientsBody();
            return;
        }

        if (field === 'quantity') {
            const num = parseFloat(String(value).replace(',', '.'));
            this._modifierIngredientsDraft[index].quantity = Number.isFinite(num) ? num : 0;
            return;
        }

        if (field === 'unit') {
            this._modifierIngredientsDraft[index].unit = String(value || '').trim() || 'шт';
            return;
        }
    }

    rerenderModifierIngredientsBody() {
        const body = document.getElementById('modifierIngredientsBody');
        if (!body) return;
        body.innerHTML = this.renderModifierIngredientsRows();
    }

    addModifierIngredientRow() {
        if (!Array.isArray(this._modifierIngredientsDraft)) {
            this._modifierIngredientsDraft = [];
        }
        this._modifierIngredientsDraft.push({ ingredient_product_id: null, quantity: 1, unit: 'шт' });
        this.rerenderModifierIngredientsBody();
    }

    removeModifierIngredientRow(index) {
        if (!Array.isArray(this._modifierIngredientsDraft)) return;
        this._modifierIngredientsDraft.splice(index, 1);
        if (this._modifierIngredientsDraft.length === 0) {
            this._modifierIngredientsDraft.push({ ingredient_product_id: null, quantity: 1, unit: 'шт' });
        }
        this.rerenderModifierIngredientsBody();
    }

    async saveModifierIngredients() {
        const modifierId = this._modifierIngredientsModifierId;
        if (!modifierId) {
            alert('❌ Не выбран модификатор');
            return;
        }

        const rows = Array.isArray(this._modifierIngredientsDraft) ? this._modifierIngredientsDraft : [];
        const payload = {
            ingredients: rows
                .map(r => ({
                    ingredient_product_id: r.ingredient_product_id,
                    quantity: r.quantity,
                    unit: r.unit
                }))
                .filter(r => r.ingredient_product_id && Number(r.quantity) > 0)
        };

        try {
            const resp = await fetch(`/api/modifiers/${modifierId}/ingredients`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await resp.json().catch(() => null);
            if (!resp.ok || !data || !data.ok) {
                throw new Error((data && (data.error || data.message)) ? (data.error || data.message) : `HTTP ${resp.status}`);
            }
            alert('✅ Сохранено');
            this.closeModal();
        } catch (e) {
            alert('❌ Ошибка: ' + (e.message || String(e)));
        }
    }

    getAppliedToText(modifier) {
        if (modifier.item_id) {
            const product = this.products.find(p => p.id === modifier.item_id);
            return product ? product.name : `Товар #${modifier.item_id}`;
        }
        // ✅ Проверяем категории
        if (modifier.category_ids && Array.isArray(modifier.category_ids) && modifier.category_ids.length > 0) {
            const categoryNames = modifier.category_ids
                .map(catId => {
                    const cat = this.categories.find(c => c.id == catId);
                    return cat ? cat.name : `Категория #${catId}`;
                })
                .filter(Boolean);
            return categoryNames.length > 0 ? categoryNames.join(', ') : 'Все блюда';
        }
        return 'Все блюда';
    }

    async showCreateModifierForm(modifier = null) {
        // ✅ Убеждаемся, что категории загружены перед открытием формы
        if (this.categories.length === 0) {
            await this.loadCategories();
        }
        
        const isEdit = modifier !== null;
        const modal = this.createModal(
            isEdit ? 'Редактировать модификатор' : 'Создать модификатор',
            `
            <form id="modifierForm">
                <div class="form-group">
                    <label class="form-label">Название модификатора *</label>
                    <input type="text" id="modifierName" class="form-input" 
                           value="${isEdit ? this.escapeHtml(modifier.option_name || '') : ''}" 
                           placeholder="Например: Острый соус" required>
                </div>

                <div class="form-group">
                    <label class="form-label">Группа модификаторов</label>
                    <input type="text" id="modifierGroup" class="form-input" 
                           value="${isEdit ? this.escapeHtml(modifier.group_name || '') : ''}" 
                           placeholder="Например: Соусы">
                </div>

                <div class="form-group">
                    <label class="form-label">Тип модификатора</label>
                    <select id="modifierType" class="form-input">
                        <option value="switch" ${isEdit && modifier.type === 'switch' ? 'selected' : ''}>Переключатель (switch)</option>
                        <option value="checkbox" ${isEdit && modifier.type === 'checkbox' ? 'selected' : ''}>Чекбокс (checkbox)</option>
                        <option value="quantity" ${isEdit && modifier.type === 'quantity' ? 'selected' : ''}>Количество (quantity)</option>
                        <option value="group" ${isEdit && modifier.type === 'group' ? 'selected' : ''}>Группа (group)</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Цена (₽)</label>
                    <input type="number" id="modifierPrice" class="form-input" 
                           value="${isEdit ? (modifier.price_value || 0) : 0}" 
                           step="0.01" min="0">
                </div>

                <div class="form-group">
                    <label class="form-label">Картинка (URL)</label>
                    <input type="text" id="modifierImageUrl" class="form-input" 
                           value="${isEdit ? this.escapeHtml(modifier.image_url || '') : ''}" 
                           placeholder="/uploads/products/... или https://...">
                </div>

                <div class="form-group">
                    <label class="form-label">Или загрузить картинку файлом</label>
                    <input type="file" id="modifierImageFile" class="form-input" accept="image/*">
                </div>

                <div class="form-group">
                    <label class="form-label">Режим цены</label>
                    <select id="modifierPriceMode" class="form-input">
                        <option value="fixed" ${isEdit && modifier.price_mode === 'fixed' ? 'selected' : 'selected'}>Фиксированная</option>
                        <option value="percent" ${isEdit && modifier.price_mode === 'percent' ? 'selected' : ''}>Процент от цены</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Применить к блюду (опционально)</label>
                    <select id="modifierItemId" class="form-input" multiple style="min-height: 120px;">
                        ${this.categories.length > 0 ? this.categories.map(cat => {
                            const isSelected = isEdit && modifier.category_ids && Array.isArray(modifier.category_ids) 
                                ? modifier.category_ids.includes(String(cat.id)) || modifier.category_ids.includes(parseInt(cat.id))
                                : false;
                            return `<option value="${cat.id}" ${isSelected ? 'selected' : ''}>${this.escapeHtml(cat.name)}</option>`;
                        }).join('') : '<option disabled>Загрузка категорий... (если список пуст, проверьте консоль)</option>'}
                    </select>
                    <small style="color: #666; font-size: 0.85rem; margin-top: 0.25rem; display: block;">
                        💡 Удерживайте Ctrl/Cmd для выбора нескольких категорий (пицца, суши и т.д.). Если ничего не выбрано — применяется ко всем блюдам.
                    </small>
                    ${this.categories.length === 0 ? '<div style="color: #dc2626; font-size: 0.85rem; margin-top: 0.5rem;">⚠️ Категории не загружены. Проверьте консоль браузера (F12).</div>' : ''}
                </div>

                <div class="form-group">
                    <label class="form-label">Максимальное количество</label>
                    <input type="number" id="modifierMaxQty" class="form-input" 
                           value="${isEdit ? (modifier.max_qty || '') : ''}" 
                           placeholder="Оставьте пустым для неограниченного">
                </div>

                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 0.5rem;">
                        <input type="checkbox" id="modifierDefaultOn" ${isEdit && modifier.default_on ? 'checked' : ''}>
                        Включен по умолчанию
                    </label>
                </div>

                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 0.5rem;">
                        <input type="checkbox" id="modifierVisible" ${isEdit && modifier.is_visible !== false ? 'checked' : ''}>
                        Видимый на сайте
                    </label>
                </div>

                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 0.5rem;">
                        <input type="checkbox" id="modifierShowInProductCard" ${isEdit && modifier.show_in_product_card !== false ? 'checked' : ''}>
                        Показывать в карточке товара
                    </label>
                </div>

                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">💾 ${isEdit ? 'Сохранить' : 'Создать'}</button>
                    <button type="button" class="btn btn-secondary" onclick="modifiersManager.closeModal()">Отмена</button>
                </div>
            </form>
        `);

        modal.querySelector('#modifierForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (isEdit) {
                await this.updateModifier(modifier.id);
            } else {
                await this.createModifier();
            }
        });
    }

    async uploadModifierImageIfNeeded() {
        const mode = await this.detectApiMode();
        const fileInput = document.getElementById('modifierImageFile');
        const file = fileInput && fileInput.files && fileInput.files[0];
        if (!file) return null;

        const formData = new FormData();
        formData.append('file', file);

        if (mode === 'catalog') {
            const response = await fetch('/api/catalog/modifiers/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
                },
                body: formData
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.success || !result.data?.url) {
                throw new Error(result.error || 'Ошибка загрузки изображения');
            }
            return result.data.url;
        }

        const response = await fetch('/api/modifiers/upload', {
            method: 'POST',
            body: formData
        });
        const result = await response.json().catch(() => ({}));
        const url = result?.data?.url || result?.url || null;
        if (!response.ok || !(result.ok || result.success) || !url) {
            throw new Error(result.error || 'Ошибка загрузки изображения');
        }
        return url;
    }

    async createModifier() {
        const mode = await this.detectApiMode();
        const optionName = document.getElementById('modifierName').value.trim();
        const groupName = document.getElementById('modifierGroup').value.trim() || 'Допы';
        const type = document.getElementById('modifierType').value;
        const price = parseFloat(document.getElementById('modifierPrice').value) || 0;
        const defaultActive = document.getElementById('modifierDefaultOn').checked;
        const isVisible = document.getElementById('modifierVisible').checked ? 1 : 0;
        const showInProductCard = document.getElementById('modifierShowInProductCard')?.checked ? 1 : 0;

        if (!optionName) {
            alert('❌ Заполните название модификатора');
            return;
        }

        const uploadedUrl = await this.uploadModifierImageIfNeeded().catch(() => null);
        const imageUrl = uploadedUrl || document.getElementById('modifierImageUrl')?.value?.trim() || '';

        try {
            if (mode === 'catalog') {
                const categorySelect = document.getElementById('modifierItemId');
                const selectedCategories = categorySelect ? Array.from(categorySelect.selectedOptions)
                    .map(opt => opt.value)
                    .filter(v => v && v !== '') : [];

                const groupId = `mods-${groupName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-а-яё]/gi, '').slice(0, 32)}`;
                const existingGroup = (this.catalogGroups || []).find(g => String(g.group_id) === String(groupId));
                const nextOptions = Array.isArray(existingGroup?.options) ? existingGroup.options.slice() : [];
                nextOptions.push({
                    id: `opt-${Date.now()}`,
                    name: optionName,
                    type: type || 'checkbox',
                    price,
                    default_active: Boolean(defaultActive),
                    image_url: imageUrl,
                    is_visible: Boolean(isVisible),
                    show_in_product_card: Boolean(showInProductCard),
                    category_ids: selectedCategories,
                    description: null
                });
                const payload = {
                    group_id: groupId,
                    group_name: groupName,
                    multi_select: existingGroup ? Boolean(existingGroup.multi_select) : true,
                    min_select: existingGroup ? (existingGroup.min_select ?? 0) : 0,
                    max_select: existingGroup ? (existingGroup.max_select ?? null) : null,
                    is_visible: existingGroup ? Boolean(existingGroup.is_visible ?? true) : true,
                    show_in_product_card: existingGroup ? Boolean(existingGroup.show_in_product_card ?? true) : true,
                    category_ids: existingGroup && Array.isArray(existingGroup.category_ids) ? existingGroup.category_ids : [],
                    options: nextOptions
                };
                const response = await fetch('/api/catalog/modifiers', {
                    method: 'POST',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify(payload)
                });

                const result = await response.json();
                if (result.success) {
                    alert('✅ Модификатор создан');
                    this.closeModal();
                    await this.loadModifiers();
                    this.render();
                } else {
                    throw new Error(result.error || 'Ошибка создания');
                }
            } else {
                // Получаем выбранные категории из поля "Применить к блюду"
                const categorySelect = document.getElementById('modifierItemId');
                const selectedCategories = categorySelect ? Array.from(categorySelect.selectedOptions)
                    .map(opt => opt.value)
                    .filter(v => v && v !== '') : [];
                
                const data = {
                    option_name: optionName,
                    group_name: groupName || null,
                    type,
                    price_value: price,
                    image_url: imageUrl || null,
                    price_mode: document.getElementById('modifierPriceMode').value,
                    item_id: null, // Теперь используем только категории
                    category_ids: selectedCategories.length > 0 ? selectedCategories : null, // ✅ Категории из поля "Применить к блюду"
                    max_qty: document.getElementById('modifierMaxQty').value ? parseInt(document.getElementById('modifierMaxQty').value) : null,
                    default_on: defaultActive ? 1 : 0,
                    is_visible: isVisible,
                    show_in_product_card: showInProductCard
                };
                const response = await fetch('/api/modifiers', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                if (result.ok || result.success) {
                    alert('✅ Модификатор создан');
                    this.closeModal();
                    await this.loadModifiers();
                    this.render();
                } else {
                    throw new Error(result.error || 'Ошибка создания');
                }
            }
        } catch (error) {
            console.error('Create modifier error:', error);
            alert('❌ Ошибка: ' + error.message);
        }
    }

    async updateModifier(modifierId) {
        const mode = await this.detectApiMode();
        const optionName = document.getElementById('modifierName').value.trim();
        const groupName = document.getElementById('modifierGroup').value.trim() || 'Допы';
        const type = document.getElementById('modifierType').value;
        const price = parseFloat(document.getElementById('modifierPrice').value) || 0;
        const defaultActive = document.getElementById('modifierDefaultOn').checked;
        const isVisible = document.getElementById('modifierVisible').checked ? 1 : 0;
        const showInProductCard = document.getElementById('modifierShowInProductCard')?.checked ? 1 : 0;

        if (!optionName) {
            alert('❌ Заполните название модификатора');
            return;
        }

        const uploadedUrl = await this.uploadModifierImageIfNeeded().catch(() => null);
        const imageUrl = uploadedUrl || document.getElementById('modifierImageUrl')?.value?.trim() || '';

        try {
            if (mode === 'catalog') {
                const categorySelect = document.getElementById('modifierItemId');
                const selectedCategories = categorySelect ? Array.from(categorySelect.selectedOptions)
                    .map(opt => opt.value)
                    .filter(v => v && v !== '') : [];

                const existing = this.modifiers.find(m => m.id === modifierId);
                const groupId = existing?._group_id || `mods-${groupName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-а-яё]/gi, '').slice(0, 32)}`;
                const baseGroup = (existing && existing._raw_group && typeof existing._raw_group === 'object') ? existing._raw_group : {};
                const payload = {
                    group_id: groupId,
                    group_name: groupName,
                    multi_select: Boolean(baseGroup.multi_select),
                    min_select: baseGroup.min_select ?? 0,
                    max_select: baseGroup.max_select ?? null,
                    is_visible: Boolean(baseGroup.is_visible ?? true),
                    show_in_product_card: Boolean(baseGroup.show_in_product_card ?? true),
                    category_ids: Array.isArray(baseGroup.category_ids) ? baseGroup.category_ids : [],
                    options: (Array.isArray(baseGroup.options) ? baseGroup.options : []).map((opt) => ({
                        ...opt,
                        price: typeof opt.price === 'number' ? opt.price : (parseFloat(opt.price) || 0)
                    }))
                };

                const idx = payload.options.findIndex((opt) => opt.id === modifierId);
                if (idx !== -1) {
                    payload.options[idx] = {
                        ...payload.options[idx],
                        name: optionName,
                        type: type || payload.options[idx].type || 'checkbox',
                        price,
                        default_active: Boolean(defaultActive),
                        image_url: imageUrl,
                        is_visible: Boolean(isVisible),
                        show_in_product_card: Boolean(showInProductCard),
                        category_ids: selectedCategories
                    };
                } else {
                    payload.options.push({
                        id: modifierId,
                        name: optionName,
                        type: type || 'checkbox',
                        price,
                        default_active: Boolean(defaultActive),
                        image_url: imageUrl,
                        is_visible: Boolean(isVisible),
                        show_in_product_card: Boolean(showInProductCard),
                        category_ids: selectedCategories,
                        description: null
                    });
                }

                const response = await fetch('/api/catalog/modifiers', {
                    method: 'POST',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify(payload)
                });

                const result = await response.json();
                if (result.success) {
                    alert('✅ Модификатор обновлён');
                    this.closeModal();
                    await this.loadModifiers();
                    this.render();
                } else {
                    throw new Error(result.error || 'Ошибка обновления');
                }
            } else {
                // Получаем выбранные категории из поля "Применить к блюду"
                const categorySelect = document.getElementById('modifierItemId');
                const selectedCategories = categorySelect ? Array.from(categorySelect.selectedOptions)
                    .map(opt => opt.value)
                    .filter(v => v && v !== '') : [];
                
                const data = {
                    option_name: optionName,
                    group_name: groupName || null,
                    type,
                    price_value: price,
                    image_url: imageUrl || null,
                    price_mode: document.getElementById('modifierPriceMode').value,
                    item_id: null, // Теперь используем только категории
                    category_ids: selectedCategories.length > 0 ? selectedCategories : null, // ✅ Категории из поля "Применить к блюду"
                    max_qty: document.getElementById('modifierMaxQty').value ? parseInt(document.getElementById('modifierMaxQty').value) : null,
                    default_on: defaultActive ? 1 : 0,
                    is_visible: isVisible,
                    show_in_product_card: showInProductCard
                };
                const response = await fetch(`/api/modifiers/${modifierId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                if (result.ok || result.success) {
                    alert('✅ Модификатор обновлён');
                    this.closeModal();
                    await this.loadModifiers();
                    this.render();
                } else {
                    throw new Error(result.error || 'Ошибка обновления');
                }
            }
        } catch (error) {
            console.error('Update modifier error:', error);
            alert('❌ Ошибка: ' + error.message);
        }
    }

    async deleteModifier(modifierId) {
        if (!confirm('Удалить модификатор?')) return;
        const mode = await this.detectApiMode();

        try {
            if (mode === 'catalog') {
                const existing = this.modifiers.find(m => m.id === modifierId);
                if (!existing?._raw_group) {
                    alert('❌ Не удалось найти группу модификатора');
                    return;
                }

                const nextGroup = {
                    ...existing._raw_group,
                    options: (existing._raw_group.options || []).filter((opt) => opt.id !== modifierId)
                };

                const response = await fetch('/api/catalog/modifiers', {
                    method: 'POST',
                    headers: this.getAuthHeaders(),
                    body: JSON.stringify(nextGroup)
                });

                const result = await response.json();
                if (result.success) {
                    alert('✅ Модификатор удалён');
                    await this.loadModifiers();
                    this.render();
                } else {
                    throw new Error(result.error || 'Ошибка удаления');
                }
            } else {
                const response = await fetch(`/api/modifiers/${modifierId}`, {
                    method: 'DELETE'
                });
                const result = await response.json();
                if (result.ok || result.success) {
                    alert('✅ Модификатор удалён');
                    await this.loadModifiers();
                    this.render();
                } else {
                    throw new Error(result.error || 'Ошибка удаления');
                }
            }
        } catch (error) {
            console.error('Delete modifier error:', error);
            alert('❌ Ошибка: ' + error.message);
        }
    }

    editModifier(modifierId) {
        const modifier = this.modifiers.find(m => m.id === modifierId);
        if (!modifier) {
            alert('Модификатор не найден');
            return;
        }
        this.showCreateModifierForm(modifier);
    }

    showImportModal() {
        const modal = this.createModal('Импорт модификаторов', `
            <p style="margin-bottom: 1rem;">Выберите CSV файл для импорта модификаторов</p>
            <input type="file" id="modifiersImportFile" accept=".csv" class="form-input" style="margin-bottom: 1rem;">
            <div class="form-actions">
                <button class="btn btn-primary" onclick="modifiersManager.importModifiers()">📥 Импортировать</button>
                <button class="btn btn-secondary" onclick="modifiersManager.closeModal()">Отмена</button>
            </div>
        `);
    }

    async importModifiers() {
        const fileInput = document.getElementById('modifiersImportFile');
        if (!fileInput || !fileInput.files[0]) {
            alert('Выберите файл');
            return;
        }

        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/importModifiers', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.success || result.ok) {
                alert(`✅ Импортировано модификаторов: ${result.imported || 0}`);
                this.closeModal();
                await this.loadModifiers();
                this.render();
            } else {
                throw new Error(result.error || 'Ошибка импорта');
            }
        } catch (error) {
            console.error('Import modifiers error:', error);
            alert('❌ Ошибка: ' + error.message);
        }
    }

    async exportModifiers() {
        try {
            const csv = this.modifiersToCSV();
            const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `modifiers_export_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export modifiers error:', error);
            alert('❌ Ошибка экспорта');
        }
    }

    modifiersToCSV() {
        const headers = ['Название', 'Группа', 'Тип', 'Цена', 'Режим цены', 'Товар ID', 'Макс. количество', 'По умолчанию', 'Видимый'];
        const rows = this.modifiers.map(m => [
            m.option_name || '',
            m.group_name || '',
            m.type || 'switch',
            m.price_value || 0,
            m.price_mode || 'fixed',
            m.item_id || '',
            m.max_qty || '',
            m.default_on ? 'Да' : 'Нет',
            m.is_visible ? 'Да' : 'Нет'
        ]);

        return [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    }

    createModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="modifiersManager.closeModal()">×</button>
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

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Инициализация
if (typeof window !== 'undefined') {
    window.ModifiersManager = ModifiersManager;
    window.modifiersManager = new ModifiersManager();
}

