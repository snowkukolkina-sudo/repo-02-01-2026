// Модуль управления карточками товаров с групповыми операциями (как в LPmotor)
// ====================================================================================
// ВЕРСИЯ: 32 (с загрузкой изображений через проводник и автоудалением фона) - ОБНОВЛЕНО 2025-11-07
// ФАЙЛ ДОЛЖЕН СОДЕРЖАТЬ ФУНКЦИЮ smartCut ДЛЯ АВТОУДАЛЕНИЯ ФОНА
// ====================================================================================
(function checkVersion() {
    console.log('%c📦 admin-product-cards.js ВЕРСИЯ 32 ЗАГРУЖЕНА', 'color: green; font-weight: bold; font-size: 16px; background: #0a6b66; padding: 10px; border-radius: 8px;');
    console.log('🔍 Проверка: Если этого сообщения НЕТ - файл на сервере СТАРЫЙ!');
    console.log('✅ Функция smartCut присутствует в этой версии');
    console.log('✅ Загрузка изображений через проводник включена');
    window._adminProductCardsVersion = '32-with-file-upload-and-smartcut-2025-11-07';
})();
(function() {
    'use strict';

    const COLORS = {
        bgFrom: '#0a6b66',
        bgVia: '#0a615c',
        bgTo: '#074d47',
        accentBtn: '#f2bd62',
        accentBtnHover: '#e5a94a',
        pink: '#ff69b4',
        textMuted: '#dbe8e1'
    };

    const CHECKER_CSS = 'background-image: linear-gradient(45deg, #eeeeee 25%, transparent 25%), linear-gradient(-45deg, #eeeeee 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #eeeeee 75%), linear-gradient(-45deg, transparent 75%, #eeeeee 75%); background-size: 16px 16px; background-position: 0 0, 0 8px, 8px -8px, -8px 0px;';

    const FIELD_ALIASES = {
        title: ['title', 'name', 'наименование', 'название'],
        description: ['description', 'desc', 'описание'],
        price: ['price', 'cost', 'цена', 'стоимость'],
        image: ['image', 'img', 'imageUrl', 'картинка', 'изображение', 'фото'],
        category: ['category', 'категория', 'раздел'],
        weight: ['weight', 'вес'],
        calories: ['calories', 'ккал', 'энергетическая ценность'],
        ingredients: ['ingredients', 'ингредиенты', 'состав'],
        allergens: ['allergens', 'аллергены'],
        id: ['id', 'sku', 'код']
    };

    const REAL_DISHES = [
        {
            id: 'demo-1',
            name: 'Пицца Маргарита',
            description: 'Соус San Marzano, моцарелла, базилик.',
            price: 450,
            image_url: 'https://images.unsplash.com/photo-1548365328-9f547fb0953e?w=900&q=80',
            category: 'Пицца',
            categories: ['Пицца'],
            weight: '550г',
            calories: '850 ккал',
            ingredients: ['соус', 'моцарелла', 'базилик'],
            allergens: ['глютен', 'лактоза'],
            visible_on_site: true,
            hidden_for_promo: false,
            sku: 'SKU-DEMO-1'
        },
        {
            id: 'demo-2',
            name: 'Бургер Классик',
            description: 'Говядина, бриошь, томат, соус.',
            price: 380,
            image_url: 'https://images.unsplash.com/photo-1550317138-10000687a72b?w=900&q=80',
            category: 'Бургеры',
            categories: ['Бургеры'],
            weight: '280г',
            calories: '650 ккал',
            ingredients: ['говядина', 'булочка', 'соус'],
            allergens: ['глютен', 'яйца'],
            visible_on_site: true,
            hidden_for_promo: false,
            sku: 'SKU-DEMO-2'
        },
        {
            id: 'demo-3',
            name: 'Ролл Лосось',
            description: 'Лосось, рис, нори, соус унаги.',
            price: 320,
            image_url: 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=900&q=80',
            category: 'Роллы',
            categories: ['Роллы'],
            weight: '210г',
            calories: '420 ккал',
            ingredients: ['лосось', 'рис', 'нори'],
            allergens: ['рыба', 'соевый соус'],
            visible_on_site: true,
            hidden_for_promo: false,
            sku: 'SKU-DEMO-3'
        },
        {
            id: 'demo-4',
            name: 'Лимонад',
            description: 'Домашний лимонад с мятой.',
            price: 160,
            image_url: 'https://images.unsplash.com/photo-1497534446932-c925b458314e?w=900&q=80',
            category: 'Напитки',
            categories: ['Напитки'],
            weight: '400мл',
            calories: '120 ккал',
            ingredients: ['лимон', 'сахар', 'мята'],
            allergens: [],
            visible_on_site: true,
            hidden_for_promo: false,
            sku: 'SKU-DEMO-4'
        }
    ];

    const ProductCardsManager = {
        products: [],
        drafts: [],
        modifiers: [],  // ✅ Группы модификаторов
        categories: [],
        groups: [],
        currentTab: 'products', // Текущая активная вкладка
        selectedProducts: new Set(),
        currentFilters: {
            category: null,
            visible: null,
            search: '',
            showcase_only: false
        },
        currentPage: 1,
        rowsPerPage: 10,
        _productsExplicitlyDeleted: false, // Флаг явного удаления товаров
        bgRemovalEnabled: true,
        isProcessing: false,
        menuMeta: null,
        editorOpen: false,
        editingDraft: null,
        addProductModalRoot: null,
        addProductModalOverlay: null,
        lastAttrs: { category: '', weight: '', calories: '' },
        designPanelOverlay: null,
        designPanelRoot: null,
        designPanelDraftId: null,
        designPanelImage: null,
        designPanelImageSrc: null,
        designPanelOptions: null,
        designPanelBusy: false,
        designPanelStatusTimer: null,
        segmentationOverlay: null,
        segmentationRoot: null,
        segmentationDraftId: null,
        segmentationCutout: null,
        segmentationHistory: [],
        segmentationRedo: [],
        segmentationAlgo: 'smart',
        segmentationTh: 240,
        segmentationSat: 18,
        segmentationFeather: 2,
        segmentationWorking: false,
        segmentationServerMulti: null,
        segmentationStatusTimer: null,

        async fetchJson(url, options = {}) {
            const config = { ...options };
            config.headers = {
                Accept: 'application/json',
                ...(options.headers || {})
            };

            try {
                const response = await fetch(url, config);
                const text = await response.text();
                let data = {};

                if (text) {
                    try {
                        data = JSON.parse(text);
                    } catch (parseError) {
                        console.warn('fetchJson: failed to parse JSON response', parseError, text);
                        data = { raw: text };
                    }
                }

                return {
                    ok: response.ok,
                    status: response.status,
                    data,
                    response
                };
            } catch (error) {
                console.error('fetchJson: network error', error);
                throw error;
            }
        },

        fetchWithTimeout: async (url, options = {}, timeoutMs = 15000) => {
            const controller = new AbortController();
            const t = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const response = await fetch(url, { ...options, signal: controller.signal });
                return response;
            } finally {
                clearTimeout(t);
            }
        },

        getFilteredProductsForList() {
            const allProducts = Array.isArray(this.products) ? this.products : [];
            const showcaseOnly = Boolean(this.currentFilters && this.currentFilters.showcase_only);
            return showcaseOnly
                ? allProducts.filter((p) => Boolean(p?.is_showcase_parent))
                : allProducts;
        },

        // Варианты / Виды (по ТЗ)
        renderProductVariantsEditor(product) {
            const isShowcase = Boolean(product?.is_showcase_parent);
            if (!isShowcase) {
                return '<p style="color: #999; text-align: center; padding: 1.5rem;">Это не витринная карточка. Варианты доступны только для родителя.</p>';
            }
            return '<p style="color: #999; text-align: center; padding: 1.5rem;">Загрузка вариантов...</p>';
        },

        async loadAndRenderProductVariants(parentId) {
            const container = document.getElementById('productVariantsContainer');
            if (!container) return;

            try {
                const response = await fetch(`/api/products/${encodeURIComponent(parentId)}/variants`);
                const result = await response.json();
                const variants = (result && (result.success || result.ok) && Array.isArray(result.data)) ? result.data : [];

                if (!variants.length) {
                    container.innerHTML = '<p style="color: #999; text-align: center; padding: 1.5rem;">Вариантов пока нет. Нажмите «➕ Добавить вариант».</p>';
                } else {
                    const rows = variants.map((v, idx) => {
                        const name = this.escapeHtml(String(v.name || ''));
                        const sku = this.escapeHtml(String(v.sku || ''));
                        const price = (v.price ?? 0);
                        const cost = (v.cost ?? 0);
                        const stock = (v.stock_quantity ?? 0);
                        const weight = this.escapeHtml(String(v.weight || ''));

                        return `
                            <tr>
                                <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${idx + 1}</td>
                                <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${name}</td>
                                <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${sku || '—'}</td>
                                <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${price} ₽</td>
                                <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${cost} ₽</td>
                                <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${stock}</td>
                                <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">${weight || '—'}</td>
                                <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">
                                    <button onclick="ProductCardsManager.showEditVariantModal('${parentId}', '${v.id}')" style="padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(33,128,141,0.35); background: rgba(33,128,141,0.08); color: rgba(33,128,141,1); cursor: pointer; font-weight: 700;">✏️</button>
                                    <button onclick="ProductCardsManager.deleteVariant('${parentId}', '${v.id}')" style="padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(220,38,38,0.35); background: rgba(220,38,38,0.08); color: rgba(220,38,38,1); cursor: pointer; font-weight: 700; margin-left: 6px;">🗑️</button>
                                </td>
                            </tr>
                        `;
                    }).join('');

                    container.innerHTML = `
                        <div style="overflow-x: auto; border: 1px solid #e5e7eb; border-radius: 10px;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead>
                                    <tr style="background: #f9fafb;">
                                        <th style="padding: 10px 12px; text-align: left; border-bottom: 1px solid #e5e7eb;">#</th>
                                        <th style="padding: 10px 12px; text-align: left; border-bottom: 1px solid #e5e7eb;">Название/размер</th>
                                        <th style="padding: 10px 12px; text-align: left; border-bottom: 1px solid #e5e7eb;">SKU</th>
                                        <th style="padding: 10px 12px; text-align: left; border-bottom: 1px solid #e5e7eb;">Цена</th>
                                        <th style="padding: 10px 12px; text-align: left; border-bottom: 1px solid #e5e7eb;">Себест.</th>
                                        <th style="padding: 10px 12px; text-align: left; border-bottom: 1px solid #e5e7eb;">Остаток</th>
                                        <th style="padding: 10px 12px; text-align: left; border-bottom: 1px solid #e5e7eb;">Вес/Диаметр</th>
                                        <th style="padding: 10px 12px; text-align: left; border-bottom: 1px solid #e5e7eb;">Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rows}
                                </tbody>
                            </table>
                        </div>
                    `;
                }

                const prices = variants
                    .map(v => parseFloat(v.price))
                    .filter(n => Number.isFinite(n) && n > 0);
                const minPrice = prices.length ? Math.min(...prices) : null;
                const minEl = document.getElementById('productVariantsMinPrice');
                if (minEl) {
                    minEl.textContent = minPrice !== null ? `Минимальная цена варианта: ${minPrice} ₽` : '';
                }
            } catch (e) {
                console.error('loadAndRenderProductVariants failed', e);
                container.innerHTML = '<p style="color: #dc2626; text-align: center; padding: 1.5rem;">Ошибка загрузки вариантов</p>';
            }
        },

        showAddVariantModal(parentId) {
            this.showVariantModal({ parentId, mode: 'create' });
        },

        async showEditVariantModal(parentId, variantId) {
            try {
                const response = await fetch(`/api/products/${encodeURIComponent(parentId)}/variants/${encodeURIComponent(variantId)}`);
                const result = await response.json();
                const variant = (result && (result.success || result.ok)) ? (result.data || null) : null;
                if (!variant) {
                    alert('❌ Вариант не найден');
                    return;
                }
                this.showVariantModal({ parentId, mode: 'edit', variant });
            } catch (e) {
                console.error('showEditVariantModal failed', e);
                alert('❌ Ошибка загрузки варианта');
            }
        },

        showVariantModal({ parentId, mode, variant } = {}) {
            const v = variant || {};
            const isEdit = mode === 'edit';

            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index: 10001; padding: 1rem;';

            overlay.innerHTML = `
                <div style="background: white; border-radius: 14px; padding: 1.25rem; width: 95%; max-width: 560px;">
                    <div style="display:flex; align-items:center; justify-content:space-between; gap: 12px; margin-bottom: 1rem;">
                        <h3 style="margin:0; color: var(--dandy-green);">${isEdit ? '✏️ Редактировать вариант' : '➕ Добавить вариант'}</h3>
                        <button style="border:none; background:transparent; font-size: 22px; cursor:pointer;" onclick="this.closest('.modal-overlay').remove()">×</button>
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div style="grid-column: 1 / -1;">
                            <label style="display:block; font-weight: 600; margin-bottom: 6px;">Размер/наименование *</label>
                            <input id="variantName" value="${this.escapeHtml(String(v.name || ''))}" style="width: 100%; padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 10px;" placeholder="Пицца Дэнди 25 см">
                        </div>
                        <div>
                            <label style="display:block; font-weight: 600; margin-bottom: 6px;">SKU</label>
                            <input id="variantSku" value="${this.escapeHtml(String(v.sku || ''))}" style="width: 100%; padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 10px;" placeholder="MENU-001-25">
                        </div>
                        <div>
                            <label style="display:block; font-weight: 600; margin-bottom: 6px;">Цена продажи (₽)</label>
                            <input id="variantPrice" type="number" step="0.01" value="${Number(v.price ?? 0)}" style="width: 100%; padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 10px;">
                        </div>
                        <div>
                            <label style="display:block; font-weight: 600; margin-bottom: 6px;">Себестоимость (₽)</label>
                            <input id="variantCost" type="number" step="0.01" value="${Number(v.cost ?? 0)}" style="width: 100%; padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 10px;">
                        </div>
                        <div>
                            <label style="display:block; font-weight: 600; margin-bottom: 6px;">Остаток</label>
                            <input id="variantStock" type="number" step="1" value="${Number(v.stock_quantity ?? 0)}" style="width: 100%; padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 10px;">
                        </div>
                        <div style="grid-column: 1 / -1;">
                            <label style="display:block; font-weight: 600; margin-bottom: 6px;">Вес / Диаметр</label>
                            <input id="variantWeight" value="${this.escapeHtml(String(v.weight || ''))}" style="width: 100%; padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 10px;" placeholder="25 см / 480г">
                        </div>
                    </div>
                    <div style="display:flex; gap: 10px; margin-top: 1rem;">
                        <button id="variantSaveBtn" style="flex:1; padding: 10px 14px; border-radius: 12px; border:none; background: var(--dandy-green); color: white; font-weight: 800; cursor:pointer;">💾 Сохранить</button>
                        <button style="padding: 10px 14px; border-radius: 12px; border:1px solid #e5e7eb; background: white; color:#111; font-weight: 800; cursor:pointer;" onclick="this.closest('.modal-overlay').remove()">Отмена</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);
            overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

            const saveBtn = overlay.querySelector('#variantSaveBtn');
            saveBtn.addEventListener('click', async () => {
                const payload = {
                    name: overlay.querySelector('#variantName')?.value?.trim() || '',
                    sku: overlay.querySelector('#variantSku')?.value?.trim() || '',
                    price: parseFloat(overlay.querySelector('#variantPrice')?.value || '0') || 0,
                    cost: parseFloat(overlay.querySelector('#variantCost')?.value || '0') || 0,
                    stock_quantity: parseInt(overlay.querySelector('#variantStock')?.value || '0') || 0,
                    weight: overlay.querySelector('#variantWeight')?.value?.trim() || ''
                };
                if (!payload.name) {
                    alert('❌ Укажите название варианта');
                    return;
                }

                try {
                    saveBtn.disabled = true;
                    saveBtn.textContent = '⏳ Сохранение...';

                    let response;
                    if (isEdit) {
                        response = await fetch(`/api/products/${encodeURIComponent(parentId)}/variants/${encodeURIComponent(v.id)}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                    } else {
                        response = await fetch(`/api/products/${encodeURIComponent(parentId)}/variants`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                    }
                    const result = await response.json().catch(() => ({}));
                    if (!response.ok || !(result.success || result.ok)) {
                        throw new Error(result.error || result.message || 'Ошибка');
                    }

                    overlay.remove();
                    await this.loadAndRenderProductVariants(parentId);
                    await this.loadProducts();
                } catch (e) {
                    console.error('save variant failed', e);
                    alert(`❌ Ошибка сохранения варианта: ${e.message}`);
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.textContent = '💾 Сохранить';
                }
            });
        },

        async deleteVariant(parentId, variantId) {
            if (!confirm('Удалить вариант?')) return;
            try {
                const response = await fetch(`/api/products/${encodeURIComponent(parentId)}/variants/${encodeURIComponent(variantId)}`, {
                    method: 'DELETE'
                });
                const result = await response.json().catch(() => ({}));
                if (!response.ok || !(result.success || result.ok)) {
                    throw new Error(result.error || result.message || 'Ошибка');
                }
                await this.loadAndRenderProductVariants(parentId);
                await this.loadProducts();
            } catch (e) {
                console.error('deleteVariant failed', e);
                alert(`❌ Ошибка удаления варианта: ${e.message}`);
            }
        },

        escapeHtml(value) {
            const div = document.createElement('div');
            div.textContent = value ?? '';
            return div.innerHTML;
        },
        
        // Инициализация модуля
        init() {
            console.log('🛍️ Product Cards Manager: Initializing...');
            this.loadCategories();
            this.loadProducts();
            this.setupEventListeners();
        },

        // Загрузка категорий
        async loadCategories() {
            try {
                const response = await this.fetchWithTimeout('/api/categories', {}, 15000);
                if (response.ok) {
                    const result = await response.json();
                    if (result.success && Array.isArray(result.data)) {
                        this.categories = result.data;
                        console.log(`✅ Загружено категорий: ${this.categories.length}`);
                    } else {
                        console.warn('⚠️ API вернул неверный формат данных:', result);
                        this.categories = [];
                    }
                } else {
                    const errorText = await response.text();
                    console.error('❌ Ошибка загрузки категорий:', response.status, errorText);
                    this.categories = [];
                }
            } catch (error) {
                console.error('❌ Ошибка загрузки категорий:', error);
                this.categories = [];
            }
            return this.categories;
        },
        
        async loadGroups() {
            try {
                const response = await fetch('/api/product-groups');
                if (response.ok) {
                    const result = await response.json();
                    if (result.ok && Array.isArray(result.data)) {
                        this.groups = result.data;
                        console.log(`✅ Загружено групп: ${this.groups.length}`);
                    } else {
                        this.groups = [];
                    }
                } else {
                    this.groups = [];
                }
            } catch (error) {
                console.warn('⚠️ Ошибка загрузки групп:', error);
                this.groups = [];
            }
            return this.groups;
        },
        
        renderGroupOptionsForSelect(selectedGroupId) {
            if (!this.groups || this.groups.length === 0) {
                return '<option value="">Загрузите группы</option>';
            }
            
            const buildTree = (groups, parentId = null, level = 0) => {
                const children = groups.filter(g => g.parent_id == parentId);
                let html = '';
                children.forEach(group => {
                    const indent = '— '.repeat(level);
                    const selected = selectedGroupId == group.id ? 'selected' : '';
                    html += `<option value="${group.id}" ${selected}>${indent}${this.escapeHtml(group.name)}</option>`;
                    html += buildTree(groups, group.id, level + 1);
                });
                return html;
            };
            
            return buildTree(this.groups);
        },
        
        // ✅ Загрузка модификаторов
        async loadModifiers() {
            try {
                const shouldTryCatalog = await (async () => {
                    try {
                        const health = await fetch('/api/catalog/health', {
                            headers: { 'Authorization': `Bearer ${localStorage.getItem('dandy_auth_token') || localStorage.getItem('token') || ''}` }
                        });
                        return health.ok;
                    } catch (_) {
                        return false;
                    }
                })();

                let response = null;
                if (shouldTryCatalog) {
                try {
                    response = await fetch('/api/catalog/modifiers', {
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('dandy_auth_token') || localStorage.getItem('token') || ''}`
                        }
                    });
                    if (response.ok) {
                        const result = await response.json();
                        if (result.success && Array.isArray(result.data)) {
                            this.modifiers = result.data;
                            console.log(`✅ Загружено групп модификаторов (catalog): ${this.modifiers.length}`);
                            return this.modifiers;
                        }
                        } else if (response.status === 404) {
                            // На проде (PHP) /api/catalog/* обычно отсутствует — отключаем forced флаг, чтобы не шуметь 404.
                            try { localStorage.setItem('USE_CATALOG_API', '0'); } catch (_) {}
                    }
                } catch (_) {}
                }

                if (response && response.status !== 404) {
                    this.modifiers = [];
                    return this.modifiers;
                }

                // legacy /api/modifiers
                const legacyResponse = await fetch('/api/modifiers');
                if (legacyResponse.ok) {
                    const result = await legacyResponse.json();
                    if (result.ok && Array.isArray(result.data)) {
                        const groupsMap = new Map();
                        result.data.forEach(modifier => {
                            const groupId = modifier.group_id || modifier.group_code || 'default';
                            const groupName = modifier.group_name || 'Без группы';
                            if (!groupsMap.has(groupId)) {
                                groupsMap.set(groupId, {
                                    group_id: groupId,
                                    group_name: groupName,
                                    options: []
                                });
                            }
                            groupsMap.get(groupId).options.push({
                                id: modifier.id,
                                name: modifier.option_name || modifier.name || '',
                                price: modifier.price_value || 0,
                                type: modifier.type || 'switch',
                                image_url: modifier.image_url || '',
                                // ✅ важно для фильтрации допов по категориям/товару
                                category_ids: Array.isArray(modifier.category_ids) ? modifier.category_ids : [],
                                item_id: modifier.item_id ?? null,
                                is_visible: modifier.is_visible ?? 1,
                                max_qty: modifier.max_qty ?? null,
                                default_on: modifier.default_on ?? 0
                            });
                        });
                        this.modifiers = Array.from(groupsMap.values());
                        console.log(`✅ Загружено групп модификаторов: ${this.modifiers.length}`);
                    } else {
                        this.modifiers = [];
                    }
                } else {
                    this.modifiers = [];
                }
            } catch (error) {
                console.warn('⚠️ Ошибка загрузки модификаторов:', error);
                this.modifiers = [];
            }
            return this.modifiers;
        },
        
        // ✅ Отображение модификаторов в форме редактирования
        renderModifiersForEdit(product, opts = {}) {
            const options = opts && typeof opts === 'object' ? opts : {};
            const selectedCategoryIds = Array.isArray(options.selectedCategoryIds) ? options.selectedCategoryIds.map(String) : [];
            const showAll = Boolean(options.showAll);

            // Получаем выбранные модификаторы из товара (группы)
            const productModifiers = product?.modifiers || product?.mods || [];
            const selectedGroupIds = Array.isArray(options.selectedGroupIdsOverride)
                ? options.selectedGroupIdsOverride.map(String)
                : (Array.isArray(productModifiers)
                    ? productModifiers.map(m => (m && typeof m === 'object') ? (m.group_id || m.id) : m).filter(Boolean).map(String)
                    : []);
            const productId = product?.id ?? null;
            
            if (!this.modifiers || this.modifiers.length === 0) {
                return '<p style="color: #9ca3af; padding: 1rem; text-align: center;">Нет доступных групп модификаторов. Создайте модификаторы в разделе "Модификаторы".</p>';
            }

            const catSet = new Set(selectedCategoryIds);
            const isGroupApplicable = (group) => {
                if (!group) return false;
                const gid = String(group.group_id ?? group.id ?? '');
                if (gid && selectedGroupIds.includes(gid)) return true; // всегда показываем уже выбранные
                if (showAll) return true;

                const optionsArr = Array.isArray(group.options) ? group.options : [];
                if (!optionsArr.length) return false;

                // группа применима, если есть:
                // - модификатор, привязанный к этому товару
                // - или к одной из выбранных категорий
                // - или глобальный (без item_id и без category_ids)
                return optionsArr.some((opt) => {
                    const itemId = opt?.item_id ?? null;
                    const catIds = Array.isArray(opt?.category_ids) ? opt.category_ids : [];
                    const hasCats = catIds.length > 0;
                    if (productId !== null && productId !== undefined && itemId !== null && itemId !== undefined && itemId !== '') {
                        if (String(itemId) === String(productId)) return true;
                    }
                    if (hasCats) {
                        return catIds.some((c) => catSet.has(String(c)));
                    }
                    return (itemId === null || itemId === undefined || itemId === '') && !hasCats;
                });
            };
            const groupsToShow = this.modifiers.filter(isGroupApplicable);

            if (!groupsToShow.length) {
                return '<p style="color: #9ca3af; padding: 1rem; text-align: center;">Нет допов, подходящих под выбранные категории. Включите «Показывать все группы» или создайте модификаторы для этих категорий.</p>';
            }
            
            return `
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem;">
                    ${groupsToShow.map(group => {
                        const gid = String(group.group_id ?? group.id ?? '');
                        const isChecked = selectedGroupIds.includes(gid);
                        return `
                            <label style="display: flex; align-items: flex-start; gap: 0.75rem; padding: 1rem; border: 2px solid ${isChecked ? 'var(--dandy-green)' : '#e5e7eb'}; border-radius: 8px; background: ${isChecked ? '#f0fdf4' : 'white'}; cursor: pointer; transition: all 0.2s;">
                                <input type="checkbox" 
                                       class="edit-modifier-checkbox" 
                                       value="${this.escapeHtml(gid)}" 
                                       ${isChecked ? 'checked' : ''}
                                       style="width: 20px; height: 20px; margin-top: 2px; cursor: pointer; flex-shrink: 0;">
                                <div style="flex: 1;">
                                    <div style="font-weight: 600; color: var(--dandy-green); margin-bottom: 0.25rem;">${this.escapeHtml(group.group_name)}</div>
                                    <div style="font-size: 0.85rem; color: #6b7280;">
                                        Опций: ${group.options?.length || 0}
                                        ${group.options && group.options.length > 0 ? `
                                            <div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #e5e7eb; max-height: 200px; overflow: auto;">
                                                ${group.options.map(opt => {
                                                    const imgHtml = opt.image_url ? 
                                                        `<img src="${this.escapeHtml(opt.image_url)}" alt="${this.escapeHtml(opt.name)}" style="width: 24px; height: 24px; object-fit: cover; border-radius: 6px; margin-right: 6px; vertical-align: middle;" onerror="this.style.display='none'">` : 
                                                        '';
                                                    return `<div style="font-size: 0.78rem; display: flex; align-items: center; margin-bottom: 6px;">${imgHtml}<span style="flex:1;">${this.escapeHtml(opt.name)}</span><span style="white-space:nowrap; color:#111827; font-weight:600;">${opt.price > 0 ? `+${opt.price}₽` : ''}</span></div>`;
                                                }).join('')}
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            </label>
                        `;
                    }).join('')}
                </div>
            `;
        },
        
        // Загрузка товаров
        async loadProducts() {
            // НЕ сбрасываем флаг явного удаления - он нужен для предотвращения перезагрузки удаленных товаров
            
            try {
                let loaded = [];
                try {
                    const params = new URLSearchParams();
                    const categoryFilterRaw = this.currentFilters.category;
                    if (categoryFilterRaw) {
                        if (String(categoryFilterRaw) === 'none') {
                            params.append('no_category', '1');
                        } else {
                            const maybeNum = Number(categoryFilterRaw);
                            if (!Number.isNaN(maybeNum)) {
                                params.append('category_id', String(maybeNum));
                            } else {
                                // fallback для старых данных, где category хранится как строка/slug
                                params.append('category', String(categoryFilterRaw));
                            }
                        }
                    }
                    if (this.currentFilters.visible !== null) params.append('visible', this.currentFilters.visible);
                    if (this.currentFilters.search) params.append('search', this.currentFilters.search);
                    // В админке нам нужны и варианты (дочерние товары), чтобы считать variants_count и показывать типы
                    params.append('include_subgroups', '1');
                    params.append('limit', '10000');
                    const catalogUrl = `/api/catalog/products?${params.toString()}`;
                    const legacyUrl = `/api/products?${params.toString()}`;

                    const host = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : '';
                    const localHost = host === 'localhost' || host === '127.0.0.1';
                    const forcedCatalog = (typeof window !== 'undefined' && window.USE_CATALOG_API === true) || localStorage.getItem('USE_CATALOG_API') === '1';
                    const tryCatalog = forcedCatalog;
                    if (localHost && tryCatalog) {
                        const token = localStorage.getItem('dandy_auth_token') || localStorage.getItem('token');
                        if (!token) {
                            try {
                                const resp = await fetch('/api/auth/login', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ email: 'admin@dandy.local', password: 'admin123' })
                                });
                                const payload = await resp.json().catch(() => ({}));
                                const newToken = payload && payload.data ? payload.data.token : null;
                                if (newToken) {
                                    localStorage.setItem('dandy_auth_token', newToken);
                                    localStorage.setItem('token', newToken);
                                }
                            } catch (_) {}
                        }
                    }

                    let response = null;
                    if (tryCatalog) {
                        try {
                            response = await this.fetchWithTimeout(catalogUrl, {
                                headers: { 'Authorization': `Bearer ${localStorage.getItem('dandy_auth_token') || localStorage.getItem('token') || ''}` }
                            }, 15000);
                            if (response.status === 401 && localHost) {
                                try {
                                    localStorage.removeItem('dandy_auth_token');
                                    localStorage.removeItem('token');
                                    const resp = await fetch('/api/auth/login', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ email: 'admin@dandy.local', password: 'admin123' })
                                    });
                                    const payload = await resp.json().catch(() => ({}));
                                    const newToken = payload && payload.data ? payload.data.token : null;
                                    if (newToken) {
                                        localStorage.setItem('dandy_auth_token', newToken);
                                        localStorage.setItem('token', newToken);
                                        response = await this.fetchWithTimeout(catalogUrl, {
                                            headers: { 'Authorization': `Bearer ${newToken}` }
                                        }, 15000);
                                    }
                                } catch (_) {}
                            }

                            if (response.ok) {
                                const result = await response.json();
                                loaded = Array.isArray(result?.data) ? result.data : [];
                                console.log(`📦 API (catalog) вернул ${loaded.length} товаров`);
                            } else if (response.status === 404) {
                                // На проде (PHP) /api/catalog/* обычно отсутствует — отключаем forced флаг, чтобы не шуметь 404.
                                try { localStorage.setItem('USE_CATALOG_API', '0'); } catch (_) {}
                            }
                        } catch (_) {}
                    }

                    if (!loaded.length) {
                        response = await this.fetchWithTimeout(legacyUrl, {}, 15000);
                        if (response.ok) {
                            const result = await response.json();
                            loaded = Array.isArray(result?.data) ? result.data : [];
                            console.log(`📦 API (legacy) вернул ${loaded.length} товаров`);
                        }
                    }
                } catch(error) {
                    console.warn('⚠️ Ошибка загрузки товаров из API:', error);
                }

                // 2) Если API вернул пустой список и не было явного удаления - показываем пустой список
                //    Больше НЕ загружаем из локальных JSON файлов - все только через API на сервере
                if (!loaded.length && !this._productsExplicitlyDeleted) {
                    console.log('ℹ️ API вернул пустой список товаров (это нормально для новой БД)');
                }
                
                // 3) Если товары были явно удалены, используем ТОЛЬКО данные из API
                //    Даже если это пустой массив - это правильно, товары удалены!
                if (this._productsExplicitlyDeleted) {
                    if (loaded.length === 0) {
                        console.log('ℹ️ Товары были удалены, список пуст (как и должно быть)');
                    } else {
                        console.log(`ℹ️ После удаления загружено товаров из API: ${loaded.length}`);
                        // Сбрасываем флаг, т.к. товары снова появились
                        this._productsExplicitlyDeleted = false;
                    }
                }

                // 4) Используем ТОЛЬКО данные из API (без fallback на JSON)

                console.log(`🔄 Нормализуем ${loaded.length} товаров...`);
                this.products = (loaded || []).map(p => {
                    // Обрабатываем категории правильно
                    let categories = [];
                    let categoryName = '';
                    
                    if (Array.isArray(p.categories) && p.categories.length > 0) {
                        // Если это массив объектов с id и name
                        if (typeof p.categories[0] === 'object' && p.categories[0].id) {
                            categories = p.categories;
                            categoryName = p.categories[0].name || '';
                        } else if (typeof p.categories[0] === 'string') {
                            // Если это массив строк
                            categories = p.categories.map(cat => ({ name: cat }));
                            categoryName = p.categories[0] || '';
                        } else {
                            // Если это массив ID
                            categories = p.categories;
                        }
                    } else if (p.category) {
                        // Старый формат - одна категория
                        categoryName = typeof p.category === 'string' ? p.category : '';
                        categories = [{ name: categoryName }];
                    } else if (p.category_name) {
                        categoryName = p.category_name;
                        categories = [{ name: categoryName }];
                    }
                    
                    // Обрабатываем cost (может быть purchase_price)
                    let cost = null;
                    if (p.cost !== undefined && p.cost !== null && p.cost !== '') {
                        cost = parseFloat(p.cost);
                    } else if (p.purchase_price !== undefined && p.purchase_price !== null && p.purchase_price !== '') {
                        cost = parseFloat(p.purchase_price);
                    }
                    
                    return {
                        id: p.id || p.internal_id || p.sku || p.code || p.name,
                        internal_id: p.internal_id || p.id || null,
                        name: p.name,
                        description: p.description || p.desc || '',
                        price: parseFloat(p.price) || 0,
                        cost: cost,
                        parent_product_id: (p.parent_product_id !== undefined && p.parent_product_id !== null && p.parent_product_id !== '') ? p.parent_product_id : null,
                        is_showcase_parent: !!(p.is_showcase_parent || p.display_only),
                        display_only: !!p.display_only,
                        group_id: (p.group_id !== undefined && p.group_id !== null && p.group_id !== '') ? p.group_id : null,
                        type: p.type || 'product',
                        image_url: (p.image_url || p.picture || p.photo || p.image || (Array.isArray(p.images) ? (p.images.find(i => i.role === 'primary')?.url || p.images[0]?.url) : '') || ''),
                        category: categoryName,
                        categories: categories,
                        category_ids: Array.isArray(p.category_ids) ? p.category_ids : (p.category_id ? [p.category_id] : []),
                        weight: p.weight !== null && p.weight !== undefined && p.weight !== '' ? String(p.weight) : null,
                        calories: p.calories !== null && p.calories !== undefined && p.calories !== '' ? (typeof p.calories === 'number' ? p.calories : parseInt(p.calories) || null) : null,
                        stock_quantity: p.stock_quantity || 0,
                        visible_on_site: p.visible_on_site !== false && p.available !== false && p.is_visible !== false,
                        hidden_for_promo: p.hidden_for_promo || false,
                        // ✅ КРИТИЧНО: Загружаем модификаторы и вариации из API
                        modifiers: Array.isArray(p.modifiers) ? p.modifiers : (Array.isArray(p.mods) ? p.mods : []),
                        variations: Array.isArray(p.variations) ? p.variations : (Array.isArray(p.variants) ? p.variants : []),
                        variants: Array.isArray(p.variants) ? p.variants : (Array.isArray(p.variations) ? p.variations : []),
                        related_products: Array.isArray(p.related_products) ? p.related_products : (Array.isArray(p.recommended_products) ? p.recommended_products : []),
                        sku: p.sku !== null && p.sku !== undefined && p.sku !== '' ? String(p.sku) : null,
                        short_description: p.short_description || '',
                        full_description: p.full_description || p.description || '',
                        ingredients: p.ingredients || p.composition || '',
                        allergens: p.allergens || '',
                        images: Array.isArray(p.images) ? p.images : []
                    };
                });

                console.log('✅ Загружено товаров:', this.products.length);
                
                // Отладка: проверяем нормализованные данные
                if (this.products.length > 0) {
                    const sample = this.products[0];
                    console.log('🔍 Пример нормализованного товара (ПЕРВЫЙ):', {
                        id: sample.id,
                        name: sample.name,
                        sku: sample.sku,
                        cost: sample.cost,
                        weight: sample.weight,
                        calories: sample.calories,
                        categories: sample.categories,
                        category: sample.category,
                        category_ids: sample.category_ids
                    });
                }

                // Синхронизируем с сайтом после загрузки (используем актуальный список)
                // НО только если не было явного удаления (иначе используем уже синхронизированные данные)
                if (!this._productsExplicitlyDeleted) {
                    await Promise.race([
                        this.syncToWebsite(false, this.products),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('sync timeout')), 15000))
                    ]).catch((e) => {
                        console.warn('⚠️ syncToWebsite failed:', e);
                    });
                } else {
                    console.log('ℹ️ Пропускаем синхронизацию после явного удаления');
                }
            } catch (error) {
                console.error('❌ Ошибка загрузки товаров:', error);
                // При ошибке не трогаем текущий список товаров
            }
        },

        // Синхронизация товаров с сайтом через API (без localStorage)
        async syncToWebsite(showNotification = false, productsOverride = null) {
            try {
                const isExplicitOverride = Array.isArray(productsOverride);

                let sourceProducts;
                if (isExplicitOverride) {
                    // Явно переданный массив (даже пустой) — используем как есть
                    sourceProducts = productsOverride.slice();
                } else {
                    // Используем текущее состояние товаров
                    sourceProducts = Array.isArray(this.products) ? this.products.slice() : [];
                }

                const parseSizeFromText = (text) => {
                    const s = String(text || '').trim();
                    if (!s) return null;
                    const m = s.match(/(\d+)\s*(см|cm|см\.?)/i);
                    if (m) {
                        const n = parseInt(m[1], 10);
                        return Number.isFinite(n) ? n : null;
                    }
                    const m2 = s.match(/^\s*(\d+)\s*$/);
                    if (m2) {
                        const n = parseInt(m2[1], 10);
                        return Number.isFinite(n) ? n : null;
                    }
                    return null;
                };

                const childrenByParentId = new Map();
                sourceProducts.forEach((p) => {
                    const pid = p?.parent_product_id;
                    if (pid !== null && pid !== undefined && pid !== '') {
                        const key = String(pid);
                        if (!childrenByParentId.has(key)) childrenByParentId.set(key, []);
                        childrenByParentId.get(key).push(p);
                    }
                });

                const buildVariationsFromChildren = (parent, children) => {
                    const baseName = String(parent?.name || '').trim();
                    return (Array.isArray(children) ? children : [])
                        .filter(Boolean)
                        .sort((a, b) => {
                            const as = parseSizeFromText(a?.name) ?? 9999;
                            const bs = parseSizeFromText(b?.name) ?? 9999;
                            if (as !== bs) return as - bs;
                            return String(a?.name || '').localeCompare(String(b?.name || ''), 'ru');
                        })
                        .map((child, idx) => {
                            const sizeValue = parseSizeFromText(child?.name) ?? parseSizeFromText(child?.weight) ?? null;
                            const sizeLabel = sizeValue ? `${sizeValue} см` : '';
                            const price = parseFloat(child?.price) || 0;
                            const qty = parseInt(child?.stock_quantity ?? child?.quantity ?? 0) || 0;
                            const variantName = String(child?.name || '').trim() || (sizeLabel ? sizeLabel : `Вариант ${idx + 1}`);
                            return {
                                variant_id: String(child?.id || child?.sku || `var-${Date.now()}-${idx}`),
                                price,
                                quantity: qty,
                                size: sizeValue || undefined,
                                parameters: [
                                    ...(sizeLabel ? [{ name: 'Размер', value: sizeLabel, display: 'list' }] : []),
                                    { name: 'Вариант', value: variantName, display: 'list' },
                                    ...(baseName && variantName && baseName !== variantName
                                        ? [{ name: 'Родитель', value: baseName, display: 'hidden' }]
                                        : [])
                                ]
                            };
                        });
                };

                const computeParentMinPrice = (parent, children) => {
                    const list = Array.isArray(children) ? children : [];
                    const prices = list
                        .map((c) => parseFloat(c?.price))
                        .filter((v) => Number.isFinite(v) && v > 0);
                    if (prices.length) return Math.min(...prices);
                    return parseFloat(parent?.price) || 0;
                };

                // Дети (позиции размеров) НЕ публикуются как отдельные карточки.
                // Публикуем только родителей, а варианты строим по parent_product_id.
                const parentsOnly = sourceProducts.filter((p) => !(p?.parent_product_id !== null && p?.parent_product_id !== undefined && p?.parent_product_id !== ''));

                const websiteProducts = parentsOnly.map((product) => {
                    const children = childrenByParentId.get(String(product.id)) || [];
                    const mergedVariations = children.length
                        ? buildVariationsFromChildren(product, children)
                        : (product.variations || product.variants || []);
                    const price = children.length ? computeParentMinPrice(product, children) : (parseFloat(product.price) || 0);

                    return {
                        id: product.id,
                        name: product.name,
                        description: product.description || product.desc || '',
                        price,
                        picture: product.image_url || product.picture || product.photo || product.image || '',
                        category: product.category || product.category_name || (Array.isArray(product.categories) ? product.categories[0] : ''),
                        weight: product.weight || null,
                        calories: product.calories || null,
                        available: product.available !== false && product.visible_on_site !== false,
                        sku: product.sku || null,
                        // ✅ КРИТИЧНО: Добавлены поля модификаторов, аллергенов и питательности
                        mods: product.mods || product.modifiers || [],
                        variations: mergedVariations,
                        alrg: product.alrg || product.allergens || '',
                        nutrition: product.nutrition || product.nutritional_info || ''
                    };
                });

                // Сохраняем на сервер через API (только через API, без localStorage)
                try {
                    const response = await fetch('/api/products/sync', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            products: websiteProducts
                        })
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const result = await response.json();
                    if (result.success) {
                        console.log('✅ Синхронизировано товаров с сайтом через API:', websiteProducts.length);

                        // Вызываем событие для обновления главной страницы
                        window.dispatchEvent(new CustomEvent('productsSynced', {
                            detail: {
                                products: websiteProducts,
                                count: websiteProducts.length,
                                synced_at: result.synced_at
                            }
                        }));

                        if (showNotification) {
                            const notification = document.createElement('div');
                            notification.style.cssText = `
                                position: fixed;
                                top: 20px;
                                right: 20px;
                                background: linear-gradient(135deg, #10b981, #059669);
                                color: white;
                                padding: 16px 24px;
                                border-radius: 12px;
                                box-shadow: 0 6px 20px rgba(0,0,0,0.3);
                                z-index: 10000;
                                font-weight: 700;
                                font-size: 15px;
                                animation: slideInRight 0.4s ease-out;
                            `;
                            notification.innerHTML = `
                                <div>✅ Синхронизация завершена!</div>
                                <div style="font-size: 13px; margin-top: 4px; opacity: 0.9;">
                                    ${websiteProducts.length} товаров обновлено на витрине
                                </div>
                            `;
                            document.body.appendChild(notification);

                            setTimeout(() => {
                                notification.style.animation = 'slideOutRight 0.3s ease-in';
                                setTimeout(() => notification.remove(), 300);
                            }, 4000);

                            if (!document.getElementById('syncNotificationStyles')) {
                                const style = document.createElement('style');
                                style.id = 'syncNotificationStyles';
                                style.textContent = `
                                    @keyframes slideInRight {
                                        from { transform: translateX(100%); opacity: 0; }
                                        to { transform: translateX(0); opacity: 1; }
                                    }
                                    @keyframes slideOutRight {
                                        from { transform: translateX(0); opacity: 1; }
                                        to { transform: translateX(100%); opacity: 0; }
                                    }
                                `;
                                document.head.appendChild(style);
                            }
                        }

                        return true;
                    }
                    throw new Error(result.error || 'Unknown error');
                } catch (apiError) {
                    console.error('❌ Ошибка синхронизации с сервером:', apiError);
                    console.error('❌ URL запроса:', '/api/products/sync');
                    console.error('❌ Метод:', 'POST');

                    if (showNotification) {
                        const notification = document.createElement('div');
                        notification.style.cssText = `
                            position: fixed;
                            top: 20px;
                            right: 20px;
                            background: linear-gradient(135deg, #ef4444, #dc2626);
                            color: white;
                            padding: 16px 24px;
                            border-radius: 12px;
                            box-shadow: 0 6px 20px rgba(0,0,0,0.3);
                            z-index: 10000;
                            font-weight: 700;
                            font-size: 15px;
                        `;
                        notification.innerHTML = `
                            <div>❌ Ошибка синхронизации с сервером</div>
                            <div style="font-size: 12px; margin-top: 4px; opacity: 0.9;">${apiError.message}</div>
                        `;
                        document.body.appendChild(notification);
                        setTimeout(() => notification.remove(), 5000);
                    }

                    if (!isExplicitOverride) {
                        console.warn('⚠️ API недоступен для синхронизации');
                    }
                    return false;
                }
            } catch (error) {
                console.error('Ошибка синхронизации с сайтом:', error);
                return false;
            }
        },
        // Отрисовка таблицы товаров
        renderProductsTable() {
            const container = document.getElementById('productCardsTable');
            if (!container) return;

            const hasSelected = this.selectedProducts.size > 0;

            const showcaseOnly = Boolean(this.currentFilters && this.currentFilters.showcase_only);

            const variantsCountByParentId = new Map();
            (Array.isArray(this.products) ? this.products : []).forEach((p) => {
                const pid = p?.parent_product_id;
                if (pid !== null && pid !== undefined && pid !== '') {
                    const key = String(pid);
                    variantsCountByParentId.set(key, (variantsCountByParentId.get(key) || 0) + 1);
                }
            });

            const normalizeType = (p) => {
                if (p?.parent_product_id !== null && p?.parent_product_id !== undefined && p?.parent_product_id !== '') return 'variant';
                if (p?.is_showcase_parent) return 'showcase';
                return 'regular';
            };

            const typeLabel = (p) => {
                const t = normalizeType(p);
                if (t === 'showcase') return 'Витрина';
                if (t === 'variant') return 'Вариант';
                return 'Обычный';
            };

            const filteredAll = this.getFilteredProductsForList();

            const startIndex = (this.currentPage - 1) * this.rowsPerPage;
            const endIndex = startIndex + this.rowsPerPage;
            const visibleProducts = filteredAll.slice(startIndex, endIndex);
            const allOnPageSelected = visibleProducts.length > 0
                && visibleProducts.every((p) => this.selectedProducts.has(String(p.id)));

            const hasCategoryFilter = this.currentFilters && this.currentFilters.category;

            let html = `
                <div style="margin-bottom: 12px; padding: 12px 14px; background: rgba(252, 252, 249, 1); border: 1px solid rgba(94, 82, 64, 0.12); border-radius: 12px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
                    <label style="display:flex; align-items:center; gap: 8px; cursor: pointer; font-size: 13px; color: rgba(19, 52, 59, 1); font-weight: 600;">
                        <input id="filterShowcaseOnly" type="checkbox" ${showcaseOnly ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer;">
                        Только витринные
                    </label>
                </div>
                ${hasSelected ? `
                <div class="bulk-actions" style="margin-bottom: 16px; padding: 16px; background: rgba(252, 252, 249, 1); border: 1px solid rgba(94, 82, 64, 0.12); border-radius: 12px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);">
                    <span style="font-weight: 600; color: rgba(19, 52, 59, 1);">Выбрано товаров: <strong id="selectedCount" style="color: rgba(33, 128, 141, 1);">${this.selectedProducts.size}</strong></span>
                    <select id="bulkCategorySelect" style="padding: 6px 12px; border: 1px solid rgba(94, 82, 64, 0.2); border-radius: 8px; background: rgba(252, 252, 249, 1); color: rgba(19, 52, 59, 1); font-size: 12px;">
                        <option value="">Изменить категорию...</option>
                        ${this.categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('')}
                    </select>
                    <button class="btn btn--secondary btn--sm" onclick="ProductCardsManager.bulkToggleVisibility()" style="display: inline-flex; align-items: center; justify-content: center; padding: 4px 12px; border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid rgba(94, 82, 64, 0.2); background: rgba(94, 82, 64, 0.12); color: rgba(19, 52, 59, 1);">
                        👁️ Переключить видимость
                    </button>
                    <button class="btn btn--secondary btn--sm" onclick="ProductCardsManager.showMoveToCategoryModal()" style="display: inline-flex; align-items: center; justify-content: center; padding: 4px 12px; border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid rgba(94, 82, 64, 0.2); background: rgba(94, 82, 64, 0.12); color: rgba(19, 52, 59, 1);">
                        📂 Перенести в категорию
                    </button>
                    <button class="btn btn--secondary btn--sm" onclick="ProductCardsManager.bulkChangeCategory()" style="display: inline-flex; align-items: center; justify-content: center; padding: 4px 12px; border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid rgba(94, 82, 64, 0.2); background: rgba(94, 82, 64, 0.12); color: rgba(19, 52, 59, 1);">
                        🏷️ Изменить категорию
                    </button>
                    ${hasCategoryFilter ? `
                    <button class="btn btn--secondary btn--sm" onclick="ProductCardsManager.selectAllInCurrentCategory()" style="display: inline-flex; align-items: center; justify-content: center; padding: 4px 12px; border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid rgba(94, 82, 64, 0.2); background: rgba(94, 82, 64, 0.12); color: rgba(19, 52, 59, 1);">
                        ✅ Выделить все в категории
                    </button>
                    ` : ''}
                    <button class="btn btn--danger btn--sm" onclick="ProductCardsManager.bulkDelete()" style="display: inline-flex; align-items: center; justify-content: center; padding: 4px 12px; border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1); border: none; background: rgba(192, 21, 47, 1); color: rgba(255, 255, 255, 1);">
                        🗑️ Удалить выбранные
                    </button>
                </div>
                ` : ''}

                <div style="overflow-x: auto; background: rgba(252, 252, 249, 1); border: 1px solid rgba(94, 82, 64, 0.12); border-radius: 12px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);">
                    <table style="width: 100%; border-collapse: collapse; margin: 0;">
                        <thead>
                            <tr>
                                <th style="width: 40px; padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); background: rgba(94, 82, 64, 0.12); font-weight: 550; font-size: 12px; color: rgba(19, 52, 59, 1);">
                                    <input type="checkbox" 
                                           id="selectAllProducts" 
                                           ${allOnPageSelected ? 'checked' : ''}
                                           onchange="ProductCardsManager.toggleSelectAll(this.checked, 'page')"
                                           style="cursor: pointer; width: 16px; height: 16px;">
                                </th>
                                <th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); background: rgba(94, 82, 64, 0.12); font-weight: 550; font-size: 12px; color: rgba(19, 52, 59, 1);">Изображение</th>
                                <th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); background: rgba(94, 82, 64, 0.12); font-weight: 550; font-size: 12px; color: rgba(19, 52, 59, 1);">Название</th>
                                <th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); background: rgba(94, 82, 64, 0.12); font-weight: 550; font-size: 12px; color: rgba(19, 52, 59, 1);">Тип</th>
                                <th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); background: rgba(94, 82, 64, 0.12); font-weight: 550; font-size: 12px; color: rgba(19, 52, 59, 1);">Варианты</th>
                                <th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); background: rgba(94, 82, 64, 0.12); font-weight: 550; font-size: 12px; color: rgba(19, 52, 59, 1);">Артикул</th>
                                <th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); background: rgba(94, 82, 64, 0.12); font-weight: 550; font-size: 12px; color: rgba(19, 52, 59, 1);">Цена</th>
                                <th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); background: rgba(94, 82, 64, 0.12); font-weight: 550; font-size: 12px; color: rgba(19, 52, 59, 1);">Себест.</th>
                                <th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); background: rgba(94, 82, 64, 0.12); font-weight: 550; font-size: 12px; color: rgba(19, 52, 59, 1);">Вес</th>
                                <th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); background: rgba(94, 82, 64, 0.12); font-weight: 550; font-size: 12px; color: rgba(19, 52, 59, 1);">Ккал</th>
                                <th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); background: rgba(94, 82, 64, 0.12); font-weight: 550; font-size: 12px; color: rgba(19, 52, 59, 1);">Категория</th>
                                <th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); background: rgba(94, 82, 64, 0.12); font-weight: 550; font-size: 12px; color: rgba(19, 52, 59, 1);">Статус</th>
                                <th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); background: rgba(94, 82, 64, 0.12); font-weight: 550; font-size: 12px; color: rgba(19, 52, 59, 1);">Действия</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            if (filteredAll.length === 0) {
                html += `
                    <tr>
                        <td colspan="13" style="text-align: center; padding: 3rem; color: rgba(119, 124, 124, 1); border-bottom: 1px solid rgba(94, 82, 64, 0.12);">
                            <div style="font-size: 3rem; margin-bottom: 1rem;">📦</div>
                            <div style="font-size: 1.2rem; font-weight: 600; margin-bottom: 0.5rem;">Товары не найдены</div>
                            <div>Измените фильтры или добавьте новый товар</div>
                        </td>
                    </tr>
                `;
            } else {
                // If current page is empty after a delete, go back one page
                if (visibleProducts.length === 0 && this.currentPage > 1) {
                    this.currentPage--;
                    return this.renderProductsTable();
                }
                
                visibleProducts.forEach(product => {
                    const productId = String(product.id);
                    const isSelected = this.selectedProducts.has(productId);
                    // Получаем категории правильно
                    let categoryNames = [];
                    if (Array.isArray(product.categories) && product.categories.length > 0) {
                        categoryNames = product.categories.map(cat => {
                            if (typeof cat === 'object' && cat.name) {
                                return cat.name;
                            } else if (typeof cat === 'string') {
                                return cat;
                            }
                            return null;
                        }).filter(Boolean);
                    } else if (product.category) {
                        categoryNames = [product.category];
                    }
                    const visibleIcon = product.visible_on_site ? '✅' : '❌';
                    const visibleText = product.visible_on_site ? 'Виден' : 'Скрыт';
                    const hiddenForPromo = product.hidden_for_promo ? '🎁 Только для акций' : '';

                    const t = normalizeType(product);
                    const isShowcase = t === 'showcase';
                    const isVariant = t === 'variant';
                    const variantsCount = (product.variants_count !== undefined && product.variants_count !== null)
                        ? Number(product.variants_count) || 0
                        : (variantsCountByParentId.get(productId) || 0);

                    const typeBadgeStyle = isShowcase
                        ? 'background: rgba(33,128,141,0.12); color: rgba(33,128,141,1); border: 1px solid rgba(33,128,141,0.25);'
                        : isVariant
                            ? 'background: rgba(94,82,64,0.10); color: rgba(19,52,59,1); border: 1px solid rgba(94,82,64,0.22);'
                            : 'background: rgba(17,24,39,0.06); color: rgba(17,24,39,0.9); border: 1px solid rgba(17,24,39,0.10);';

                    html += `
                        <tr style="padding: 12px 16px; ${isSelected ? 'background: rgba(94, 82, 64, 0.08);' : (isShowcase ? 'background: rgba(33,128,141,0.06);' : '')} cursor: pointer;" class="product-row" data-product-id="${productId}" ${isSelected ? 'data-selected=\"true\"' : ''} onclick="ProductCardsManager.toggleProductFromRow(event, '${productId}')">
                            <td style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12);">
                                <input type="checkbox" 
                                       class="product-checkbox"
                                       data-product-id="${productId}"
                                       ${isSelected ? 'checked' : ''}
                                       onchange="ProductCardsManager.toggleProduct('${productId}', this.checked)"
                                       onclick="event.stopPropagation()"
                                       style="cursor: pointer; width: 18px; height: 18px; accent-color: var(--dandy-green);">
                            </td>
                            <td style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12);">
                                ${product.image_url ? 
                                    `<div style="width: 60px; height: 60px; border-radius: 6px; overflow: hidden; border: 1px solid rgba(94, 82, 64, 0.12); background: #f5f5f5; display: flex; align-items: center; justify-content: center;">
                                        <img src="${product.image_url}" 
                                          alt="${product.name}" 
                                             style="max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; display: block;"
                                             onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\'width: 60px; height: 60px; background: rgba(245, 245, 245, 1); border-radius: 6px; display: flex; align-items: center; justify-content: center; color: rgba(119, 124, 124, 1); font-size: 11px; border: 1px solid rgba(94, 82, 64, 0.12);\\'>Нет фото</div>'">
                                    </div>` 
                                    : '<div style="width: 60px; height: 60px; background: rgba(245, 245, 245, 1); border-radius: 6px; display: flex; align-items: center; justify-content: center; color: rgba(119, 124, 124, 1); font-size: 11px; border: 1px solid rgba(94, 82, 64, 0.12);">Нет фото</div>'
                                }
                            </td>
                            <td style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12);">${product.name || '—'}</td>
                            <td style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12);">
                                <span style="display:inline-flex; align-items:center; padding: 4px 10px; border-radius: 9999px; font-weight: 700; font-size: 11px; ${typeBadgeStyle}">
                                    ${typeLabel(product)}
                                </span>
                            </td>
                            <td style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12);">
                                ${isVariant ? '—' : (isShowcase ? `<strong>${variantsCount}</strong>` : (variantsCount ? String(variantsCount) : '—'))}
                            </td>
                            <td style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12);">${product.sku !== null && product.sku !== undefined && product.sku !== '' ? product.sku : '—'}</td>
                            <td style="padding: 12px 16px; text-align: left; border-bottom: 1px solid
 rgba(94, 82, 64, 0.12);">${product.price ? product.price.toLocaleString('ru-RU') + ' ₽' : '—'}</td>
                            <td style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12);">${product.cost !== null && product.cost !== undefined ? product.cost.toLocaleString('ru-RU') + ' ₽' : '—'}</td>
                            <td style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12);">${product.weight !== null && product.weight !== undefined && product.weight !== '' ? product.weight : '—'}</td>
                            <td style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12);">${product.calories !== null && product.calories !== undefined ? product.calories : '—'}</td>
                            <td style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12);">${categoryNames.length > 0 ? categoryNames.join(', ') : '—'}</td>
                            <td style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12);">
                                <span class="status ${product.visible_on_site ? 'status--active' : 'status--inactive'}" style="display: inline-flex; align-items: center; padding: 4px 8px; border-radius: 9999px; font-weight: 500; font-size: 11px; ${product.visible_on_site ? 'background-color: rgba(33, 128, 141, 0.15); color: rgba(33, 128, 141, 1); border: 1px solid rgba(33, 128, 141, 0.25);' : 'background-color: rgba(192, 21, 47, 0.15); color: rgba(192, 21, 47, 1); border: 1px solid rgba(192, 21, 47, 0.25);'}">
                                    ${product.visible_on_site ? '✅ Активен' : '❌ Скрыт'}
                                    </span>
                            </td>
                            <td style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12);">
                                <div style="display: flex; gap: 0.5rem; justify-content: flex-start; flex-wrap: wrap;">
                                    <button class="btn btn--secondary btn--sm" 
                                            onclick="ProductCardsManager.editProduct('${product.id}')"
                                            style="display: inline-flex; align-items: center; justify-content: center; padding: 4px 12px; border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid rgba(94, 82, 64, 0.2); background: rgba(94, 82, 64, 0.12); color: rgba(19, 52, 59, 1);">
                                        ✏️ Изменить
                                    </button>
                                    <button class="btn btn--danger btn--sm" 
                                            onclick="ProductCardsManager.deleteProduct('${product.id}')"
                                            style="display: inline-flex; align-items: center; justify-content: center; padding: 4px 12px; border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1); border: none; background: rgba(192, 21, 47, 1); color: rgba(255, 255, 255, 1); min-width: auto; white-space: nowrap;">
                                        🗑️ Удалить
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                });
            }
            html += `
                        </tbody>
                    </table>
                </div>

                <!-- Pagination Controls -->
                <div class="pagination-controls" style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px; padding: 12px; border-top: 1px solid rgba(94, 82, 64, 0.12); background: rgba(252, 252, 249, 1); border-radius: 0 0 12px 12px;">
                    <!-- Left side: Items per page and range info -->
                    <div style="display: flex; align-items: center; gap: 12px; font-size: 12px; color: rgba(119, 124, 124, 1);">
                        <span>Строк на странице:</span>
                        <select class="pagination-select" id="rowsPerPageSelect" onchange="ProductCardsManager.changeRowsPerPage(this.value)" style="padding: 4px 12px; border: 1px solid rgba(94, 82, 64, 0.2); border-radius: 8px; background: rgba(252, 252, 249, 1); color: rgba(19, 52, 59, 1); font-size: 12px;">
                            <option value="10" ${this.rowsPerPage === 10 ? 'selected' : ''}>10</option>
                            <option value="25" ${this.rowsPerPage === 25 ? 'selected' : ''}>25</option>
                            <option value="50" ${this.rowsPerPage === 50 ? 'selected' : ''}>50</option>
                            <option value="100" ${this.rowsPerPage === 100 ? 'selected' : ''}>100</option>
                        </select>
                        <span id="pageRangeInfo"></span>
                    </div>

                    <!-- Right side: Page navigation -->
                    <div id="paginationPages" style="display: flex; gap: 4px; align-items: center;"></div>
                </div>
            `;

            container.innerHTML = html;
            this.renderPaginationControls();

            // bind filter: only showcase
            const showcaseCb = document.getElementById('filterShowcaseOnly');
            if (showcaseCb) {
                showcaseCb.addEventListener('change', () => {
                    this.currentFilters.showcase_only = Boolean(showcaseCb.checked);
                    this.currentPage = 1;
                    this.renderProductsTable();
                });
            }
        },

        // Изменить количество строк на странице
        changeRowsPerPage(value) {
            this.rowsPerPage = parseInt(value, 10);
            this.currentPage = 1;
            this.renderProductsTable();
        },

        // Перейти на страницу
        goToPage(page) {
            const maxPage = Math.ceil(this.getFilteredProductsForList().length / this.rowsPerPage);
            if (page < 1) page = 1;
            if (page > maxPage) page = maxPage;
            
            this.currentPage = page;
            this.renderProductsTable();
        },
        // Отрисовка элементов пагинации
        renderPaginationControls() {
            const totalProducts = this.getFilteredProductsForList().length;
            const totalPages = Math.ceil(totalProducts / this.rowsPerPage);
            const paginationPages = document.getElementById('paginationPages');
            const pageRangeInfo = document.getElementById('pageRangeInfo');
            
            if (!paginationPages || !pageRangeInfo) return;
            
            paginationPages.innerHTML = '';
            
            if (totalProducts === 0) {
                pageRangeInfo.textContent = 'Нет данных';
                return;
            }

            // Calculate range info (e.g., "1 – 10 из 12")
            const startRange = (this.currentPage - 1) * this.rowsPerPage + 1;
            const endRange = Math.min(this.currentPage * this.rowsPerPage, totalProducts);
            pageRangeInfo.textContent = `${startRange} – ${endRange} из ${totalProducts} товаров`;

            // Prev Button
            const prevBtn = document.createElement('button');
            prevBtn.className = 'pagination-page-btn';
            prevBtn.textContent = '<';
            prevBtn.disabled = this.currentPage === 1;
            prevBtn.onclick = () => this.goToPage(this.currentPage - 1);
            prevBtn.style.cssText = 'background: rgba(252, 252, 249, 1); color: rgba(19, 52, 59, 1); border: 1px solid rgba(94, 82, 64, 0.2); border-radius: 8px; padding: 4px 8px; min-width: 32px; text-align: center; cursor: pointer; font-weight: 500; transition: background 150ms;';
            prevBtn.disabled ? prevBtn.style.opacity = '0.5' : '';
            paginationPages.appendChild(prevBtn);
            
            // Determine which pages to show
            const pagesToShow = [];
            
            if (totalPages <= 5) {
                for (let i = 1; i <= totalPages; i++) pagesToShow.push(i);
            } else {
                pagesToShow.push(1);
                if (this.currentPage > 3) pagesToShow.push('...');
                
                let start = Math.max(2, this.currentPage - 1);
                let end = Math.min(totalPages - 1, this.currentPage + 1);
                
                if (this.currentPage <= 3) end = 3;
                if (this.currentPage >= totalPages - 2) start = totalPages - 3;
                
                for (let i = start; i <= end; i++) {
                    if (!pagesToShow.includes(i)) pagesToShow.push(i);
                }

                if (this.currentPage < totalPages - 2) pagesToShow.push('...');
                if (totalPages !== 1) pagesToShow.push(totalPages);
            }
            
            pagesToShow.forEach(page => {
                if (page === '...') {
                    const span = document.createElement('span');
                    span.textContent = '...';
                    span.style.padding = '0 8px';
                    paginationPages.appendChild(span);
                } else {
                    const pageBtn = document.createElement('button');
                    pageBtn.className = 'pagination-page-btn';
                    if (page === this.currentPage) pageBtn.className += ' active';
                    pageBtn.textContent = page;
                    pageBtn.onclick = () => this.goToPage(page);
                    pageBtn.style.cssText = `background: ${page === this.currentPage ? 'rgba(33, 128, 141, 1)' : 'rgba(252, 252, 249, 1)'}; color: ${page === this.currentPage ? 'rgba(252, 252, 249, 1)' : 'rgba(19, 52, 59, 1)'}; border: 1px solid ${page === this.currentPage ? 'rgba(33, 128, 141, 1)' : 'rgba(94, 82, 64, 0.2)'}; border-radius: 8px; padding: 4px 8px; min-width: 32px; text-align: center; cursor: pointer; font-weight: 500; transition: background 150ms;`;
                    paginationPages.appendChild(pageBtn);
                }
            });
            // Next Button
            const nextBtn = document.createElement('button');
            nextBtn.className = 'pagination-page-btn';
            nextBtn.textContent = '>';
            nextBtn.disabled = this.currentPage === totalPages || totalPages === 0;
            nextBtn.onclick = () => this.goToPage(this.currentPage + 1);
            nextBtn.style.cssText = 'background: rgba(252, 252, 249, 1); color: rgba(19, 52, 59, 1); border: 1px solid rgba(94, 82, 64, 0.2); border-radius: 8px; padding: 4px 8px; min-width: 32px; text-align: center; cursor: pointer; font-weight: 500; transition: background 150ms;';
            nextBtn.disabled ? nextBtn.style.opacity = '0.5' : '';
            paginationPages.appendChild(nextBtn);
        },

        // Получить категории товара
        getProductCategories(product) {
            if (!product) return [];
            
            // Собираем все возможные ID категорий из разных источников
            let categoryIds = [];
            
            // 1. Из category_ids (массив ID)
            if (Array.isArray(product.category_ids) && product.category_ids.length > 0) {
                categoryIds = product.category_ids;
            }
            // 2. Из categories (может быть массив объектов или массив ID)
            else if (Array.isArray(product.categories) && product.categories.length > 0) {
                categoryIds = product.categories.map(c => {
                    if (typeof c === 'object' && c.id) return c.id;
                    if (typeof c === 'number' || typeof c === 'string') return c;
                    return null;
                }).filter(Boolean);
            }
            // 3. Из строки categories (JSON)
            else if (typeof product.categories === 'string' && product.categories.trim()) {
                try {
                    const parsed = JSON.parse(product.categories);
                    if (Array.isArray(parsed)) {
                        categoryIds = parsed.map(c => {
                            if (typeof c === 'object' && c.id) return c.id;
                            return c;
                        }).filter(Boolean);
                    }
                } catch (e) {
                    // Игнорируем ошибки парсинга
                }
            }
            // 4. Из одиночного category (старый формат)
            else if (product.category) {
                // Если это ID, добавляем его
                if (typeof product.category === 'number' || (typeof product.category === 'string' && /^\d+$/.test(product.category))) {
                    categoryIds = [product.category];
                }
            }
            
            // Если нет ID, но есть category_name, пытаемся найти категорию по имени
            if (categoryIds.length === 0 && product.category_name) {
                const catByName = this.categories.find(c => c.name === product.category_name);
                if (catByName) {
                    categoryIds = [catByName.id];
                }
            }
            
            // Преобразуем ID в названия категорий
            const categoryNames = categoryIds
                .map(id => {
                    const cat = this.categories.find(c => String(c.id) === String(id));
                    return cat ? cat.name : null;
                })
                .filter(Boolean);
            
            // Если не нашли категории по ID, но есть category_name, используем его
            if (categoryNames.length === 0 && product.category_name) {
                return [product.category_name];
            }
            
            return categoryNames;
        },

        // Переключить выбор одного товара
        toggleProduct(productId, checked) {
            const normalizedId = String(productId);
            if (checked) {
                this.selectedProducts.add(normalizedId);
            } else {
                this.selectedProducts.delete(normalizedId);
            }
            this.renderProductsTable();
        },

        toggleProductFromRow(event, productId) {
            try {
                const target = event && event.target;
                if (target) {
                    const tag = (target.tagName || '').toLowerCase();
                    if (tag === 'input' || tag === 'button' || tag === 'a' || tag === 'select' || tag === 'textarea' || tag === 'label') {
                        return;
                    }
                    if (target.closest && target.closest('button, a, input, select, textarea, label, .btn')) {
                        return;
                    }
                }

                const normalizedId = String(productId);
                const nextChecked = !this.selectedProducts.has(normalizedId);
                this.toggleProduct(normalizedId, nextChecked);
            } catch (e) {
                console.warn('toggleProductFromRow failed:', e);
            }
        },
        // Переключить выбор всех товаров
        toggleSelectAll(checked, scope = 'page') {
            const mode = scope || 'page';
            if (!checked) {
                if (mode === 'page') {
                    const startIndex = (this.currentPage - 1) * this.rowsPerPage;
                    const endIndex = startIndex + this.rowsPerPage;
                    const visibleProducts = this.products.slice(startIndex, endIndex);
                    visibleProducts.forEach((p) => this.selectedProducts.delete(String(p.id)));
                } else {
                    this.selectedProducts.clear();
                }
                this.renderProductsTable();
                return;
            }

            if (mode === 'page') {
                const startIndex = (this.currentPage - 1) * this.rowsPerPage;
                const endIndex = startIndex + this.rowsPerPage;
                const visibleProducts = this.products.slice(startIndex, endIndex);
                visibleProducts.forEach((p) => this.selectedProducts.add(String(p.id)));
            } else {
                this.products.forEach((p) => this.selectedProducts.add(String(p.id)));
            }
            this.renderProductsTable();
        },

        selectAllInCurrentCategory() {
            this.toggleSelectAll(true, 'all');
        },

        buildCategorySelectOptions() {
            const tree = this.buildCategoryTree();
            const walk = (nodes, depth) => {
                return (nodes || []).map((n) => {
                    const pad = depth > 0 ? '&nbsp;'.repeat(depth * 4) + '↳ ' : '';
                    const option = `<option value="${this.escapeHtml(String(n.id))}">${pad}${this.escapeHtml(String(n.name || '—'))}</option>`;
                    return option + walk(n.children || [], depth + 1);
                }).join('');
            };
            return walk(tree, 0);
        },

        buildCategoryTree() {
            const categories = Array.isArray(this.categories) ? this.categories : [];
            const map = new Map();
            categories.forEach((c) => {
                if (!c) return;
                const id = c.id;
                if (id === null || id === undefined) return;
                map.set(String(id), { ...c, children: [] });
            });

            const roots = [];
            map.forEach((node) => {
                const pid = node.parent_id;
                if (pid !== null && pid !== undefined && pid !== '' && map.has(String(pid))) {
                    map.get(String(pid)).children.push(node);
                } else {
                    roots.push(node);
                }
            });

            const sortNodes = (nodes) => {
                nodes.sort((a, b) => {
                    const pa = (a.position ?? 0);
                    const pb = (b.position ?? 0);
                    if (pa !== pb) return pa - pb;
                    return String(a.name || '').localeCompare(String(b.name || ''), 'ru');
                });
                nodes.forEach((n) => sortNodes(n.children || []));
            };
            sortNodes(roots);
            return roots;
        },

        renderCategoryTree(nodes, selectedId, level = 0) {
            if (!Array.isArray(nodes) || nodes.length === 0) return '';
            return nodes.map((n) => {
                const nid = String(n.id);
                const checked = selectedId !== null && selectedId !== undefined && String(selectedId) === nid;
                const pad = level * 14;
                return `
                    <div style="padding-left:${pad}px; display:flex; flex-direction:column; gap:6px;">
                        <label style="display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:10px; border:1px solid rgba(94, 82, 64, 0.12); background: rgba(252, 252, 249, 1); cursor:pointer;">
                            <input type="radio" name="moveCategoryId" value="${this.escapeHtml(nid)}" ${checked ? 'checked' : ''} style="width: 16px; height: 16px; cursor:pointer;">
                            <span style="font-size: 13px; color: rgba(19, 52, 59, 1); font-weight: 600;">${this.escapeHtml(n.name || '—')}</span>
                        </label>
                        ${this.renderCategoryTree(n.children || [], selectedId, level + 1)}
                    </div>
                `;
            }).join('');
        },

        showMoveToCategoryModal() {
            if (this.selectedProducts.size === 0) {
                alert('Выберите товары для переноса');
                return;
            }

            const tree = this.buildCategoryTree();
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background: rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:10000;';

            modal.innerHTML = `
                <div style="background: white; border-radius: 16px; padding: 2rem; max-width: 720px; width: 92%; max-height: 90vh; overflow-y: auto;">
                    <h2 style="margin: 0 0 0.75rem 0; color: var(--dandy-green);">📂 Перенести товары в категорию</h2>
                    <div style="color:#6b7280; margin-bottom: 1rem;">Выбрано товаров: <strong>${this.selectedProducts.size}</strong></div>
                    <label style="display:flex; align-items:center; gap:10px; margin-bottom: 1rem; padding: 10px 12px; border-radius: 12px; border:1px solid rgba(94, 82, 64, 0.12); background: rgba(252, 252, 249, 1);">
                        <input type="checkbox" id="moveKeepExisting" style="width:16px; height:16px; cursor:pointer;">
                        <span style="font-size: 13px; color: rgba(19, 52, 59, 1);">Оставить в текущей категории (добавить ещё одну)</span>
                    </label>
                    <div style="margin-bottom: 1.25rem;">
                        <div style="font-weight: 700; margin-bottom: 0.5rem; color: rgba(19, 52, 59, 1);">Выберите целевую категорию / подкатегорию:</div>
                        <div style="max-height: 360px; overflow-y: auto; border: 1px solid rgba(94, 82, 64, 0.12); border-radius: 12px; padding: 12px; background: rgba(255,255,255,0.95);">
                            ${this.renderCategoryTree(tree, null, 0)}
                        </div>
                    </div>
                    <div style="display:flex; gap: 12px;">
                        <button id="confirmMoveCategory" style="flex:1; padding: 12px 16px; border-radius: 12px; border:none; background: rgba(33, 128, 141, 1); color: rgba(252, 252, 249, 1); font-weight: 700; cursor:pointer;">✅ Перенести</button>
                        <button id="cancelMoveCategory" style="flex:1; padding: 12px 16px; border-radius: 12px; border: 1px solid rgba(94, 82, 64, 0.2); background: rgba(252, 252, 249, 1); color: rgba(19, 52, 59, 1); font-weight: 700; cursor:pointer;">❌ Отмена</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            const close = () => modal.remove();
            modal.addEventListener('click', (e) => {
                if (e.target === modal) close();
            });
            const cancelBtn = modal.querySelector('#cancelMoveCategory');
            if (cancelBtn) cancelBtn.addEventListener('click', close);

            const confirmBtn = modal.querySelector('#confirmMoveCategory');
            if (confirmBtn) {
                confirmBtn.addEventListener('click', async () => {
                    await this.applyMoveToCategory(modal).catch((err) => {
                        console.error('applyMoveToCategory failed:', err);
                        alert('❌ Ошибка при переносе: ' + (err.message || 'неизвестная ошибка'));
                    });
                });
            }
        },

        async applyMoveToCategory(modalRoot) {
            const root = modalRoot || document;
            const picked = root.querySelector('input[name="moveCategoryId"]:checked');
            const targetCategoryId = picked ? picked.value : '';
            if (!targetCategoryId) {
                alert('Выберите категорию');
                return;
            }

            const keepExisting = Boolean(root.querySelector('#moveKeepExisting')?.checked);
            const productIds = Array.from(this.selectedProducts).map(String);
            const numId = Number(targetCategoryId);
            const resolvedTargetId = Number.isNaN(numId) ? targetCategoryId : numId;
            const action = keepExisting ? 'add' : 'replace';

            if (!confirm(`${keepExisting ? 'Добавить категорию' : 'Перенести'} для ${productIds.length} товаров?`)) {
                return;
            }

            try {
                const response = await fetch('/api/products/bulk/categories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        product_ids: productIds,
                        category_ids: [resolvedTargetId],
                        action
                    })
                });
                const result = await response.json().catch(() => ({}));
                if (!response.ok || result.success === false) {
                    throw new Error(result.error || 'Не удалось выполнить перенос');
                }
            } catch (e) {
                console.warn('bulk categories API failed, applying locally:', e.message);
            }

            this.products.forEach((product) => {
                if (!productIds.includes(String(product.id))) return;

                let current = [];
                if (Array.isArray(product.category_ids) && product.category_ids.length > 0) {
                    current = [...product.category_ids];
                } else if (Array.isArray(product.categories) && product.categories.length > 0) {
                    current = product.categories.map((c) => (typeof c === 'object' ? c.id : c)).filter((v) => v !== null && v !== undefined);
                } else if (product.category !== null && product.category !== undefined && product.category !== '') {
                    current = [product.category];
                }

                if (keepExisting) {
                    if (!current.some((c) => String(c) === String(resolvedTargetId))) {
                        current.push(resolvedTargetId);
                    }
                } else {
                    current = [resolvedTargetId];
                }

                product.category_ids = current;
                product.categories = current;
                product.category = current[0] || null;
            });

            if (modalRoot && modalRoot.remove) modalRoot.remove();

            const category = this.categories.find((c) => String(c.id) === String(resolvedTargetId));
            const categoryLabel = category ? category.name : String(resolvedTargetId);

            this.clearSelection();
            await this.syncToWebsite(false, this.products);
            await this.loadProducts();
            alert(`✅ Товары ${keepExisting ? 'добавлены в категорию' : 'перенесены в категорию'}: ${categoryLabel}`);
        },

        // Снять выбор
        clearSelection() {
            this.selectedProducts.clear();
            this.renderProductsTable();
        },
        // Массовое изменение видимости
        // Массовое переключение видимости
        async bulkToggleVisibility() {
            if (this.selectedProducts.size === 0) {
                alert('Выберите товары для изменения видимости');
                return;
            }

            try {
                const productIds = Array.from(this.selectedProducts).map(String);
                const products = this.products.filter(p => productIds.includes(String(p.id)));
                
                // Переключаем видимость: если все видны - скрываем, иначе показываем
                const allVisible = products.every(p => p.visible_on_site);
                const newVisibility = !allVisible;

                try {
                    const response = await fetch('/api/products/bulk', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            productIds,
                            updates: { visible_on_site: newVisibility }
                        })
                    });

                    if (!response.ok) {
                        await response.json().catch(() => ({}));
                    }
                } catch (_) {
                    // API недоступен — работаем только с локальными данными
                }

                // Локально применяем новое состояние видимости
                products.forEach(product => {
                    product.visible_on_site = newVisibility;
                });

                this.clearSelection();
                await this.syncToWebsite(false, this.products);
                alert(`✅ Видимость ${newVisibility ? 'включена' : 'выключена'} для ${productIds.length} товаров`);
            } catch (error) {
                console.error('Bulk toggle visibility error:', error);
                alert('❌ Ошибка при изменении видимости');
            }
        },

        async bulkSetVisibility(visible) {
            if (this.selectedProducts.size === 0) {
                alert('Выберите товары для изменения видимости');
                return;
            }

            if (!confirm(`${visible ? 'Показать' : 'Скрыть'} ${this.selectedProducts.size} товаров на сайте?`)) {
                return;
            }

            try {
                const productIds = Array.from(this.selectedProducts);

                try {
                    const response = await fetch('/api/products/bulk/visibility', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            productIds,
                            visible_on_site: visible
                        })
                    });

                    if (!response.ok) {
                        await response.json().catch(() => ({}));
                    }
                } catch (_) {
                    // API недоступен — работаем только локально
                }

                // Обновляем локальные данные
                this.products.forEach(product => {
                    if (productIds.includes(product.id)) {
                        product.visible_on_site = !!visible;
                    }
                });

                this.clearSelection();
                await this.syncToWebsite(false, this.products);
                alert(`✅ ${visible ? 'Показали' : 'Скрыли'} ${productIds.length} товаров на витрине`);
            } catch (error) {
                console.error('Bulk visibility error:', error);
                alert('❌ Ошибка при изменении видимости');
            }
        },

        // Массовое изменение категории (через select в bulk actions)
        async bulkChangeCategory() {
            if (this.selectedProducts.size === 0) {
                alert('Выберите товары для изменения категории');
                return;
            }

            const select = document.getElementById('bulkCategorySelect');
            if (!select) {
                this.showBulkCategoryModal();
                return;
            }

            const categoryId = select.value;
            if (!categoryId) {
                alert('Выберите категорию');
                return;
            }

            if (!confirm(`Изменить категорию для ${this.selectedProducts.size} товаров?`)) {
                return;
            }

            try {
                const productIds = Array.from(this.selectedProducts).map(String);
                const numericId = Number(categoryId);
                const resolvedCategoryId = Number.isNaN(numericId) ? categoryId : numericId;

                try {
                    const response = await fetch('/api/products/bulk', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            productIds,
                            updates: { categories: [resolvedCategoryId] }
                        })
                    });

                    if (!response.ok) {
                        await response.json().catch(() => ({}));
                    }
                } catch (_) {
                    // API недоступен — применяем изменения только локально
                }

                // Обновляем категории для выбранных товаров
                this.products.forEach(product => {
                    if (productIds.includes(String(product.id))) {
                        // Сохраняем старые категории, если они есть, и добавляем новую
                        const existingCategories = Array.isArray(product.category_ids) ? product.category_ids : 
                            (Array.isArray(product.categories) ? product.categories.map(c => typeof c === 'object' ? c.id : c) : []);
                        
                        // Добавляем новую категорию, если её ещё нет
                        if (!existingCategories.includes(resolvedCategoryId)) {
                            existingCategories.push(resolvedCategoryId);
                        }
                        
                        product.category_ids = existingCategories;
                        product.categories = existingCategories;
                        // Для обратной совместимости оставляем первую категорию
                        product.category = existingCategories[0];
                    }
                });

                const category = this.categories.find(c => String(c.id) === String(resolvedCategoryId));
                this.clearSelection();
                await this.syncToWebsite(false, this.products);
                alert(`✅ Категория изменена для ${productIds.length} товаров на "${category ? category.name : 'неизвестная'}"`);
            } catch (error) {
                console.error('Bulk change category error:', error);
                alert('❌ Ошибка при изменении категории');
            }
        },
        // Показать модальное окно для массового изменения категорий
        showBulkCategoryModal() {
            if (this.selectedProducts.size === 0) {
                alert('Выберите товары для изменения категорий');
                return;
            }

            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.7); display: flex; align-items: center;
                justify-content: center; z-index: 10000;
            `;

            const categoriesOptions = this.categories.map(cat => 
                `<label style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; border-radius: 6px; background: #f9fafb; cursor: pointer;">
                    <input type="checkbox" value="${cat.id}" class="category-checkbox" style="width: 18px; height: 18px;">
                    <span>${cat.name}</span>
                </label>`
            ).join('');

            modal.innerHTML = `
                <div style="background: white; border-radius: 16px; padding: 2rem; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto;">
                    <h2 style="margin: 0 0 1.5rem 0; color: var(--dandy-green);">📂 Изменение категорий</h2>
                    <p style="margin-bottom: 1rem;">Выбрано товаров: <strong>${this.selectedProducts.size}</strong></p>
                    
                    <div style="margin-bottom: 1.5rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Действие:</label>
                        <select id="bulkCategoryAction" style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px;">
                            <option value="replace">Заменить категории</option>
                            <option value="add">Добавить к существующим</option>
                            <option value="remove">Удалить выбранные</option>
                        </select>
                    </div>

                    <div style="margin-bottom: 1.5rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Выберите категории:</label>
                        <div style="max-height: 300px; overflow-y: auto; border: 2px solid #e5e7eb; border-radius: 8px; padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem;">
                            ${categoriesOptions}
                        </div>
                    </div>

                    <div style="display: flex; gap: 1rem;">
                        <button onclick="ProductCardsManager.applyBulkCategories()" 
                                style="flex: 1; padding: 1rem; background: var(--dandy-green); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 16px;">
                            ✅ Применить
                        </button>
                        <button onclick="this.closest('.modal-overlay').remove()" 
                                style="flex: 1; padding: 1rem; background: #6b7280; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                            ❌ Отмена
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.remove();
            });
        },

        // Применить массовое изменение категорий
        async applyBulkCategories() {
            const action = document.getElementById('bulkCategoryAction').value;
            const checkboxes = document.querySelectorAll('.category-checkbox:checked');
            const selectedCategoryIds = Array.from(checkboxes).map(cb => {
                const id = cb.value;
                const numId = Number(id);
                return Number.isNaN(numId) ? id : numId;
            });

            if (selectedCategoryIds.length === 0) {
                alert('Выберите хотя бы одну категорию');
                return;
            }

            const productIds = Array.from(this.selectedProducts).map(String);
            const actionText = action === 'replace' ? 'заменить' : action === 'add' ? 'добавить' : 'удалить';
            
            if (!confirm(`Вы уверены, что хотите ${actionText} категории для ${productIds.length} товаров?`)) {
                return;
            }

            try {
                // Пытаемся отправить на сервер
                try {
                    const response = await fetch('/api/products/bulk', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            productIds,
                            updates: { 
                                category_ids: selectedCategoryIds,
                                category_action: action // replace, add, remove
                            }
                        })
                    });

                    if (!response.ok) {
                        await response.json().catch(() => ({}));
                    }
                } catch (_) {
                    // API недоступен — применяем изменения только локально
                    console.warn('API недоступен, применяем изменения локально');
                }

                // Применяем изменения локально
                this.products.forEach(product => {
                    if (productIds.includes(String(product.id))) {
                        let currentCategories = [];
                        
                        // Получаем текущие категории
                        if (Array.isArray(product.category_ids) && product.category_ids.length > 0) {
                            currentCategories = [...product.category_ids];
                        } else if (Array.isArray(product.categories) && product.categories.length > 0) {
                            currentCategories = product.categories.map(c => typeof c === 'object' ? c.id : c);
                        } else if (product.category) {
                            const catId = typeof product.category === 'number' ? product.category : Number(product.category);
                            if (!Number.isNaN(catId)) {
                                currentCategories = [catId];
                            }
                        }

                        // Применяем действие
                        if (action === 'replace') {
                            currentCategories = selectedCategoryIds;
                        } else if (action === 'add') {
                            selectedCategoryIds.forEach(catId => {
                                if (!currentCategories.includes(catId)) {
                                    currentCategories.push(catId);
                                }
                            });
                        } else if (action === 'remove') {
                            currentCategories = currentCategories.filter(catId => !selectedCategoryIds.includes(catId));
                        }

                        // Обновляем товар
                        product.category_ids = currentCategories;
                        product.categories = currentCategories;
                        product.category = currentCategories[0] || null;
                    }
                });

                const categoryNames = selectedCategoryIds
                    .map(id => {
                        const cat = this.categories.find(c => String(c.id) === String(id));
                        return cat ? cat.name : null;
                    })
                    .filter(Boolean)
                    .join(', ');

                document.querySelector('.modal-overlay')?.remove();
                this.clearSelection();
                await this.syncToWebsite(false, this.products);
                await this.loadProducts();
                alert(`✅ Категории ${actionText} для ${productIds.length} товаров${categoryNames ? `: ${categoryNames}` : ''}`);
            } catch (error) {
                console.error('Bulk categories error:', error);
                alert('❌ Ошибка при изменении категорий: ' + (error.message || 'Неизвестная ошибка'));
            }
        },
        // Показать модальное окно для массового изменения цен
        showBulkPriceModal() {
            if (this.selectedProducts.size === 0) {
                alert('Выберите товары для изменения цен');
                return;
            }

            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.7); display: flex; align-items: center;
                justify-content: center; z-index: 10000;
            `;

            modal.innerHTML = `
                <div style="background: white; border-radius: 16px; padding: 2rem; max-width: 500px; width: 90%;">
                    <h2 style="margin: 0 0 1.5rem 0; color: var(--dandy-green);">💰 Изменение цен</h2>
                    <p style="margin-bottom: 1rem;">Выбрано товаров: <strong>${this.selectedProducts.size}</strong></p>
                    
                    <div style="margin-bottom: 1.5rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Тип изменения:</label>
                        <select id="bulkPriceType" style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px;">
                            <option value="percent">Процентное изменение (%)</option>
                            <option value="fixed">Фиксированное изменение (₽)</option>
                        </select>
                    </div>

                    <div style="margin-bottom: 1.5rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Значение:</label>
                        <input type="number" id="bulkPriceValue" step="0.01" 
                               placeholder="Например: 10 или -10"
                               style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px;">
                        <div style="font-size: 0.85em; color: #666; margin-top: 0.5rem;">
                            💡 Используйте отрицательные значения для уменьшения цен
                        </div>
                    </div>

                    <div style="display: flex; gap: 1rem;">
                        <button onclick="ProductCardsManager.applyBulkPrices()" 
                                style="flex: 1; padding: 1rem; background: var(--dandy-green); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 16px;">
                            ✅ Применить
                        </button>
                        <button onclick="this.closest('.modal-overlay').remove()" 
                                style="flex: 1; padding: 1rem; background: #6b7280; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                            ❌ Отмена
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.remove();
            });
        },

        // Применить массовое изменение цен
        async applyBulkPrices() {
            const type = document.getElementById('bulkPriceType').value;
            const value = parseFloat(document.getElementById('bulkPriceValue').value);

            if (isNaN(value)) {
                alert('Введите корректное числовое значение');
                return;
            }

            const typeText = type === 'percent' ? `${value}%` : `${value} ₽`;
            if (!confirm(`Изменить цены у ${this.selectedProducts.size} товаров на ${typeText}?`)) {
                return;
            }

            try {
                const response = await fetch('/api/products/bulk/prices', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        productIds: Array.from(this.selectedProducts).map(String),
                        priceChange: { type, value }
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    alert(`✅ ${result.message}`);
                    document.querySelector('.modal-overlay').remove();
                    this.clearSelection();
                    await this.loadProducts();
                } else {
                    const error = await response.json();
                    alert(`❌ Ошибка: ${error.error}`);
                }
            } catch (error) {
                console.error('Bulk prices error:', error);
                alert('❌ Ошибка при изменении цен');
            }
        },
        // Массовое удаление
        async bulkDelete() {
            if (this.selectedProducts.size === 0) {
                alert('Выберите товары для удаления');
                return;
            }

            const productIds = Array.from(this.selectedProducts).map(String);
            const productNames = productIds
                .map(id => this.products.find(p => String(p.id) === id)?.name || id)
                .slice(0, 5)
                .join(', ');
            const moreText = productIds.length > 5 ? ` и еще ${productIds.length - 5}` : '';

            if (!confirm(`⚠️ ВНИМАНИЕ!\n\nВы действительно хотите удалить ${productIds.length} товаров?\n\n${productNames}${moreText}\n\nЭто действие нельзя отменить!`)) {
                return;
            }

            try {
                const beforeCount = this.products.length;
                let apiDeleted = 0;
                let apiErrors = [];
                
                // Пытаемся удалить через API
                for (const productId of productIds) {
                    try {
                        const encodedId = encodeURIComponent(productId);
                        const response = await fetch(`/api/products/${encodedId}`, {
                            method: 'DELETE',
                            headers: { 
                                'Content-Type': 'application/json'
                            }
                        });
                        
                        if (response.ok) {
                            const result = await response.json().catch(() => ({}));
                            if (result.success !== false) {
                                apiDeleted++;
                                console.log(`✅ Товар ${productId} удален через API`);
                            } else {
                                apiErrors.push(`ID ${productId}: ${result.error || 'Ошибка API'}`);
                            }
                        } else {
                            // Если 404 - товар может быть только локально, это нормально
                            if (response.status !== 404) {
                                apiErrors.push(`ID ${productId}: HTTP ${response.status}`);
                            }
                        }
                    } catch (error) {
                        apiErrors.push(`ID ${productId}: ${error.message}`);
                        // Продолжаем удаление даже при ошибках API
                    }
                }

                // Удаляем товары из локального списка
                this.products = this.products.filter(product => !productIds.includes(String(product.id)));
                this.selectedProducts.clear();
                const afterCount = this.products.length;
                const deletedCount = beforeCount - afterCount;

                if (deletedCount > 0) {
                    console.log(`🗑️ Удалено товаров локально: ${deletedCount} из ${productIds.length}`);

                    // Устанавливаем флаг явного удаления
                    this._productsExplicitlyDeleted = true;

                    // Синхронизируем с сайтом
                    const syncSuccess = await this.syncToWebsite(false, this.products);
                    
                    if (syncSuccess) {
                        console.log('✅ Товары удалены с сайта');
                    } else {
                        console.warn('⚠️ Не удалось синхронизировать с сайтом');
                    }
                    
                    // Обновляем таблицу
                    this.renderProductsTable();
                    
                    // Формируем сообщение
                    let message = `✅ Удалено товаров: ${deletedCount}`;
                    if (apiDeleted > 0) {
                        message += `\nЧерез API удалено: ${apiDeleted}`;
                    }
                    if (apiErrors.length > 0 && apiDeleted < productIds.length) {
                        message += `\n⚠️ Ошибок API: ${apiErrors.length}`;
                        if (apiErrors.length <= 3) {
                            message += '\n' + apiErrors.join('\n');
                        }
                    }
                    if (!syncSuccess) {
                        message += '\n⚠️ Синхронизация с сайтом не выполнена';
                    }
                    
                    alert(message);
                } else {
                    alert('❌ Не удалось удалить товары из локального списка');
                }
            } catch (error) {
                console.error('❌ Ошибка при групповом удалении:', error);
                alert('❌ Ошибка при удалении товаров: ' + (error.message || 'Неизвестная ошибка'));
            }
        },
        // Удалить все товары
        async deleteAllProducts() {
            if (!this.products.length) {
                alert('❌ Нет товаров для удаления');
                return;
            }

            const totalCount = this.products.length;
            if (!confirm(`⚠️ КРИТИЧЕСКОЕ ВНИМАНИЕ!\n\nУдалить ВСЕ ${totalCount} товаров?\n\nЭто действие нельзя отменить!`)) {
                return;
            }

            const confirmation = prompt(`Для подтверждения введите "УДАЛИТЬ" (будет удалено ${totalCount} товаров):`);
            if (!confirmation || confirmation.toUpperCase() !== 'УДАЛИТЬ') {
                alert('❌ Удаление отменено. Введите "УДАЛИТЬ" для подтверждения.');
                return;
            }

            try {
                let apiDeleted = 0;
                let apiErrors = [];
                const productIds = this.products.map(product => product.id);
                
                // Пытаемся удалить через API
                for (const productId of productIds) {
                    try {
                        const encodedId = encodeURIComponent(productId);
                        const response = await fetch(`/api/products/${encodedId}`, {
                            method: 'DELETE',
                            headers: { 
                                'Content-Type': 'application/json' 
                            }
                        });
                        
                        if (response.ok) {
                            const result = await response.json().catch(() => ({}));
                            if (result.success !== false) {
                                apiDeleted++;
                            } else {
                                apiErrors.push(`ID ${productId}: ${result.error || 'Ошибка API'}`);
                            }
                        } else {
                            if (response.status !== 404) {
                                apiErrors.push(`ID ${productId}: HTTP ${response.status}`);
                            }
                        }
                    } catch (error) {
                        apiErrors.push(`ID ${productId}: ${error.message}`);
                        // Продолжаем даже при ошибках API
                    }
                }

                // Очищаем локальный список
                this.products = [];
                this.selectedProducts.clear();
                this._productsExplicitlyDeleted = true; // Флаг, что товары были явно удалены
                
                // Синхронизируем с сайтом (пустой массив = очистить витрину)
                const syncSuccess = await this.syncToWebsite(false, []);
                
                if (syncSuccess) {
                    console.log('✅ Все товары удалены с сайта');
                } else {
                    console.warn('⚠️ Не удалось синхронизировать с сайтом');
                }
                
                this.renderProductsTable();
                
                // Формируем сообщение
                let message = `✅ Все товары удалены: ${totalCount}`;
                if (apiDeleted > 0) {
                    message += `\nЧерез API удалено: ${apiDeleted}`;
                }
                if (apiErrors.length > 0 && apiDeleted < totalCount) {
                    message += `\n⚠️ Ошибок API: ${apiErrors.length}`;
                }
                if (!syncSuccess) {
                    message += '\n⚠️ Синхронизация с сайтом не выполнена';
                }
                
                alert(message);
            } catch (error) {
                console.error('❌ Ошибка при удалении всех товаров:', error);
                alert('❌ Ошибка при удалении всех товаров: ' + (error.message || 'Неизвестная ошибка'));
            }
        },
        // Переключить видимость одного товара
        async toggleVisibility(productId, visible) {
            // Сначала пробуем API, при 404 или ошибке — тихо меняем локально
            let updatedViaApi = false;
            try {
                const response = await fetch(`/api/products/${productId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ visible_on_site: visible })
                });
                if (response.ok) {
                    updatedViaApi = true;
                }
            } catch (_) {}

            // Локальное обновление состояния (для оффлайна и для синхронизации)
                const idx = this.products.findIndex(p => String(p.id) === String(productId));
                if (idx >= 0) {
                    this.products[idx].visible_on_site = !!visible;
            }

            // Обновим витрину и таблицу без перезагрузки
            await this.syncToWebsite(false, this.products);
            this.renderProductsTable();
        },
        // Редактировать товар
        async editProduct(productId) {
            console.log('🔍 Поиск товара для редактирования, ID:', productId);
            
            // Нормализуем ID для сравнения (приводим к строке, удаляем пробелы)
            const normalizedId = String(productId).trim();
            
            // Ищем товар в локальном массиве по разным полям (расширенный поиск)
            let product = this.products.find(p => {
                const pId = String(p.id || '').trim();
                const pInternalId = String(p.internal_id || '').trim();
                const pSku = String(p.sku || '').trim();
                const pCode = String(p.code || '').trim();
                const pName = String(p.name || '').trim().toLowerCase();
                
                return pId === normalizedId || 
                       pInternalId === normalizedId ||
                       pSku === normalizedId ||
                       pCode === normalizedId ||
                       (normalizedId.length > 3 && pName === normalizedId.toLowerCase()); // Поиск по имени, если ID похож на название
            });
            
            console.log('🔍 Товар в локальном массиве:', product ? `найден (${product.name})` : 'не найден');

            // ✅ Даже если нашли локально — подтянем свежие детальные поля (modifiers/variants/variations),
            // чтобы редактор всегда видел сохранённую структуру после перезагрузки.
            if (product) {
                try {
                    const encodedId = encodeURIComponent(productId);
                    const resp = await fetch(`/api/products/${encodedId}`);
                    if (resp.ok) {
                        const result = await resp.json().catch(() => ({}));
                        const apiProduct = (result && result.data) ? result.data : result;
                        if (apiProduct && typeof apiProduct === 'object') {
                            // Мержим поверх локального, но сохраняем локально-нормализованные поля если их нет в API
                            product = { ...product, ...apiProduct };
                        }
                    }
                } catch (_) {}
            }
            
            // Если товар не найден локально, пытаемся загрузить из API
            if (!product) {
                console.log(`⚠️ Товар с ID ${productId} не найден в локальном массиве, загружаю из API...`);
                
                // Сначала перезагружаем список товаров - возможно товар был недавно добавлен/обновлён
                try {
                    await this.loadProducts();
                    // Пробуем найти ещё раз после перезагрузки
                    product = this.products.find(p => {
                        const pId = String(p.id || '').trim();
                        const pInternalId = String(p.internal_id || '').trim();
                        const pSku = String(p.sku || '').trim();
                        const pCode = String(p.code || '').trim();
                        return pId === normalizedId || 
                               pInternalId === normalizedId ||
                               pSku === normalizedId ||
                               pCode === normalizedId;
                    });
                    if (product) {
                        console.log('✅ Товар найден после перезагрузки списка');
                    }
                } catch (reloadError) {
                    console.warn('⚠️ Ошибка перезагрузки списка товаров:', reloadError);
                }
                
                // Если всё ещё не найден, пробуем API endpoints
                if (!product) {
                    try {
                        const encodedId = encodeURIComponent(productId);
                        
                        // Пробуем разные API endpoints
                        let apiEndpoints = [
                            `/api/products/${encodedId}`,
                            `/api/catalog/products/${encodedId}`,
                            `/api/v1/products/${encodedId}`,
                            `/api/products?sku=${encodedId}`, // Поиск по SKU
                            `/api/products?code=${encodedId}` // Поиск по коду
                        ];
                        
                        let apiProduct = null;
                        let lastError = null;
                        
                        for (const endpoint of apiEndpoints) {
                            try {
                                console.log(`🔍 Пробую endpoint: ${endpoint}`);
                                const response = await fetch(endpoint);
                                if (response.ok) {
                                    const result = await response.json();
                                    // Обрабатываем разные форматы ответа
                                    if (result.success !== false && result.data) {
                                        apiProduct = Array.isArray(result.data) ? result.data[0] : result.data;
                                        if (apiProduct) {
                                            console.log(`✅ Товар найден через ${endpoint}`);
                                            break;
                                        }
                                    } else if (result.ok && result.data) {
                                        apiProduct = Array.isArray(result.data) ? result.data[0] : result.data;
                                        if (apiProduct) {
                                            console.log(`✅ Товар найден через ${endpoint} (формат result.ok)`);
                                            break;
                                        }
                                    } else if (Array.isArray(result) && result.length > 0) {
                                        apiProduct = result[0];
                                        console.log(`✅ Товар найден через ${endpoint} (массив)`);
                                        break;
                                    }
                                } else if (response.status !== 404) {
                                    lastError = `HTTP ${response.status}`;
                                }
                            } catch (e) {
                                console.warn(`⚠️ Ошибка при запросе ${endpoint}:`, e);
                                lastError = e.message;
                            }
                        }
                        
                        if (apiProduct) {
                            // Преобразуем формат API в формат локального массива
                            product = {
                                id: apiProduct.id || apiProduct.internal_id || apiProduct.sku || apiProduct.code || productId,
                                internal_id: apiProduct.internal_id || apiProduct.id,
                                name: apiProduct.name || '',
                                description: apiProduct.description || apiProduct.desc || '',
                                price: parseFloat(apiProduct.price) || 0,
                                image_url: apiProduct.image_url || apiProduct.picture || apiProduct.photo || apiProduct.image || '',
                                category: apiProduct.category || apiProduct.category_name || (Array.isArray(apiProduct.categories) ? (apiProduct.categories[0]?.name || apiProduct.categories[0]) : ''),
                                categories: Array.isArray(apiProduct.categories) ? apiProduct.categories : (apiProduct.category ? [apiProduct.category] : []),
                                category_ids: apiProduct.category_ids || (Array.isArray(apiProduct.categories) ? apiProduct.categories.map(c => c.id || c) : []),
                                weight: apiProduct.weight || null,
                                calories: apiProduct.calories || null,
                                stock_quantity: apiProduct.stock_quantity || apiProduct.quantity || 0,
                                visible_on_site: apiProduct.visible_on_site !== false && apiProduct.available !== false && apiProduct.is_visible !== false,
                                hidden_for_promo: apiProduct.hidden_for_promo || false,
                                sku: apiProduct.sku || null,
                                code: apiProduct.code || apiProduct.sku || null,
                                cost: parseFloat(apiProduct.cost) || parseFloat(apiProduct.purchase_price) || 0,
                                old_price: apiProduct.old_price || null,
                                short_description: apiProduct.short_description || '',
                                full_description: apiProduct.full_description || apiProduct.description || '',
                                ingredients: apiProduct.ingredients || apiProduct.composition || '',
                                allergens: apiProduct.allergens || '',
                                photo_mode: apiProduct.photo_mode || 'with_background',
                                product_page_type: apiProduct.product_page_type || 'default',
                                product_page_url: apiProduct.product_page_url || '',
                                type: apiProduct.type || 'product',
                                // ✅ КРИТИЧНО: Загружаем модификаторы и вариации из API
                                modifiers: apiProduct.modifiers || apiProduct.mods || [],
                                variations: apiProduct.variations || apiProduct.variants || [],
                                related_products: apiProduct.related_products || apiProduct.recommended_products || []
                            };
                            
                            // Добавляем товар в локальный массив для будущих операций
                            const existingIndex = this.products.findIndex(p => 
                                String(p.id || '').trim() === String(product.id || '').trim() ||
                                String(p.internal_id || '').trim() === String(product.internal_id || '').trim() ||
                                (product.sku && p.sku && String(p.sku || '').trim() === String(product.sku || '').trim())
                            );
                            if (existingIndex >= 0) {
                                this.products[existingIndex] = product;
                            } else {
                                this.products.push(product);
                            }
                            console.log(`✅ Товар загружен из API: ${product.name} (ID: ${product.id})`);
                        } else {
                            throw new Error(lastError || 'Товар не найден в API');
                        }
                    } catch (error) {
                        console.error('❌ Ошибка загрузки товара из API:', error);
                        console.error('❌ Детали ошибки:', {
                            productId,
                            normalizedId,
                            productsCount: this.products.length,
                            productIds: this.products.slice(0, 5).map(p => ({ id: p.id, internal_id: p.internal_id, sku: p.sku, name: p.name }))
                        });
                        alert(`❌ Товар не найден: ${error.message || 'Неизвестная ошибка'}\n\nID: ${productId}\n\nПроверьте:\n1. Правильность ID товара\n2. Загружены ли товары в разделе (найдено ${this.products.length} товаров)\n3. Доступность API\n4. Консоль браузера для деталей\n\nПопробуйте:\n- Перезагрузить список товаров\n- Проверить фильтры\n- Обновить страницу`);
                        return;
                    }
                }
            }
            
            if (!product) {
                console.error('❌ Товар не найден после всех попыток');
                alert('❌ Товар не найден\n\nПроверьте консоль браузера для деталей\n\nПопробуйте:\n- Перезагрузить список товаров\n- Обновить страницу');
                return;
            }
            
            console.log('✅ Товар найден, открываю редактор:', product.name);

            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.7); display: flex; align-items: center;
                justify-content: center; z-index: 10000; padding: 1rem;
            `;

            // Загружаем группы, если еще не загружены
            if (this.groups.length === 0) {
                await this.loadGroups();
            }
            
            // ✅ Загружаем модификаторы, если еще не загружены
            if (!this.modifiers || this.modifiers.length === 0) {
                await this.loadModifiers();
            }
            
            // Получаем категории товара (из API или из старого формата)
            const productCategoryIds = product.category_ids || 
                (product.categories ? (Array.isArray(product.categories) ? product.categories.map(c => c.id || c) : []) : []) ||
                (product.category ? [product.category] : []);
            
            const categoriesCheckboxes = this.categories.map(cat => {
                const isChecked = productCategoryIds.includes(cat.id) || productCategoryIds.includes(String(cat.id));
                
                return `
                    <label style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; border-radius: 6px; background: #f9fafb; cursor: pointer;">
                        <input type="checkbox" class="edit-category-checkbox" value="${cat.id}" ${isChecked ? 'checked' : ''} style="width: 18px; height: 18px;">
                        <span>${this.escapeHtml(cat.name)}</span>
                    </label>
                `;
            }).join('');

            modal.innerHTML = `
                <div style="background: white; border-radius: 16px; padding: 2rem; max-width: 900px; width: 95%; max-height: 90vh; overflow-y: auto;">
                    <h2 style="margin: 0 0 1.5rem 0; color: var(--dandy-green); display: flex; align-items: center; gap: 0.5rem;">
                        ✏️ Редактирование карточки товара
                    </h2>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
                        <!-- Левая колонка -->
                        <div>
                            <h3 style="color: var(--dandy-green); margin-bottom: 1rem; font-size: 1.1rem;">📝 Основная информация</h3>
                            
                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Название товара: <span style="color: red;">*</span></label>
                                <input type="text" id="editProductName" value="${product.name || ''}" 
                                       style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px;">
                            </div>

                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">SKU (артикул): <span style="color: red;">*</span></label>
                                <input type="text" id="editProductSku" value="${product.sku || ''}" 
                                       style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px;">
                            </div>

                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Тип номенклатуры *:</label>
                                <select id="editProductType" 
                                        style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; background: white;"
                                        required>
                                    <option value="product" ${(product.type || 'product') === 'product' ? 'selected' : ''}>🛍️ Товар (готовая продукция)</option>
                                    <option value="ingredient" ${product.type === 'ingredient' ? 'selected' : ''}>🥘 Ингредиент (материал)</option>
                                    <option value="dish" ${product.type === 'dish' ? 'selected' : ''}>🍽️ Блюдо (техкарта)</option>
                                    <option value="semi_product" ${product.type === 'semi_product' ? 'selected' : ''}>🔧 Заготовка (полуфабрикат)</option>
                                    <option value="modifier" ${product.type === 'modifier' ? 'selected' : ''}>⚙️ Модификатор</option>
                                </select>
                                <div style="font-size: 0.85em; color: #666; margin-top: 0.5rem;">
                                    💡 <strong>Товар</strong> — готовая к продаже позиция (напитки, десерты).<br>
                                    💡 <strong>Ингредиент</strong> — сырьё для приготовления (не отображается на витрине).<br>
                                    💡 <strong>Блюдо</strong> — позиция меню с техкартой и рецептом.<br>
                                    💡 <strong>Заготовка</strong> — полуфабрикат, используемый в других техкартах.<br>
                                    💡 <strong>Модификатор</strong> — доп. параметр блюда (соус, опции).
                                </div>
                            </div>

                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Краткое описание (для каталога):</label>
                                <textarea id="editProductShortDesc" rows="2" 
                                          style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px;">${product.short_description || ''}</textarea>
                            </div>

                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Полное описание (для карточки товара):</label>
                                <textarea id="editProductFullDesc" rows="4" 
                                          style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px;">${product.full_description || product.description || ''}</textarea>
                            </div>

                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Артикул (SKU):</label>
                                <input type="text" id="editProductSku2" value="${product.sku || ''}" 
                                       placeholder="Например: PIZZA-001"
                                       style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                            </div>

                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                                <div>
                                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Цена (₽): <span style="color: red;">*</span></label>
                                    <input type="number" id="editProductPrice" value="${product.price || 0}" step="0.01"
                                           style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                                </div>
                                <div>
                                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Старая цена (₽):</label>
                                    <input type="text" id="editProductOldPrice" value="${product.old_price || ''}"
                                           style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                                </div>
                            </div>

                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                                <div>
                                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Себестоимость (₽):</label>
                                    <input type="number" id="editProductCost" value="${product.cost || 0}" step="0.01"
                                           style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                                </div>
                                <div>
                                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Остаток на складе:</label>
                                    <input type="number" id="editProductStock" value="${product.stock_quantity || 0}"
                                           style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                                </div>
                            </div>

                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Вес/Размер/Граммы:</label>
                                <input type="text" id="editProductWeight" value="${product.weight || ''}" 
                                       placeholder="Например: 500г, 30см, 350мл"
                                       style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                            </div>

                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Калории:</label>
                                <input type="text" id="editProductCalories" value="${product.calories || ''}" 
                                       placeholder="Например: 450 ккал"
                                       style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                            </div>

                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                                <div>
                                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Ставка НДС:</label>
                                    <select id="editProductVatRate" 
                                            style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; background: white;">
                                        <option value="">— Не указано —</option>
                                        <option value="10%" ${product.vat_rate === '10%' ? 'selected' : ''}>10%</option>
                                        <option value="20%" ${product.vat_rate === '20%' ? 'selected' : ''}>20%</option>
                                        <option value="Без НДС" ${product.vat_rate === 'Без НДС' ? 'selected' : ''}>Без НДС</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Тип налогообложения:</label>
                                    <select id="editProductTaxType" 
                                            style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; background: white;">
                                        <option value="none" ${(product.tax_type || 'none') === 'none' ? 'selected' : ''}>Обычный товар</option>
                                        <option value="alcohol" ${product.tax_type === 'alcohol' ? 'selected' : ''}>Алкоголь</option>
                                        <option value="excise" ${product.tax_type === 'excise' ? 'selected' : ''}>Подакцизный</option>
                                    </select>
                                </div>
                            </div>

                            ${(product.type || 'product') === 'ingredient' ? `
                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Процент потерь при обработке (%):</label>
                                <input type="number" id="editProductLossPercent" value="${product.loss_percentage || 0}" 
                                       step="0.01" min="0" max="100"
                                       placeholder="Например: 5.5"
                                       style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                                <small style="color: #666; font-size: 0.85em;">Процент потерь при обработке ингредиента (например, при чистке овощей)</small>
                            </div>
                            ` : ''}

                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Коэффициент пересчёта (для весовых товаров):</label>
                                <input type="number" id="editProductConversionFactor" value="${product.conversion_factor || 1.0}" 
                                       step="0.0001" min="0.0001"
                                       placeholder="1.0"
                                       style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                                <small style="color: #666; font-size: 0.85em;">Коэффициент для пересчёта веса (например, 1 кг = 1000 г, коэффициент = 1000)</small>
                            </div>

                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Состав (ингредиенты):</label>
                                <textarea id="editProductIngredients" rows="3" 
                                          placeholder="Например: тесто, томатный соус, моцарелла, грибы, базилик"
                                          style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px;">${product.ingredients || ''}</textarea>
                            </div>

                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Аллергены:</label>
                                <textarea id="editProductAllergens" rows="2" 
                                          placeholder="Например: глютен, лактоза, яйца"
                                          style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px;">${product.allergens || ''}</textarea>
                            </div>
                        </div>
                        <!-- Правая колонка -->
                        <div>
                            <h3 style="color: var(--dandy-green); margin-bottom: 1rem; font-size: 1.1rem;">👁️ Видимость и отображение</h3>
                            
                            <div style="margin-bottom: 1.5rem; padding: 1rem; background: #f9fafb; border-radius: 8px;">
                                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin-bottom: 0.75rem;">
                                    <input type="checkbox" id="editProductVisible" ${product.visible_on_site ? 'checked' : ''} 
                                           style="width: 20px; height: 20px; cursor: pointer;">
                                    <span style="font-weight: 600;">✅ Видимый на сайте</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                    <input type="checkbox" id="editProductHiddenPromo" ${product.hidden_for_promo ? 'checked' : ''} 
                                           style="width: 20px; height: 20px; cursor: pointer;">
                                    <span style="font-weight: 600;">🎁 Скрытый (только для акций)</span>
                                </label>
                                <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #e5e7eb;">
                                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin-bottom: 0.5rem;">
                                        <input type="checkbox" id="editProductShowcaseParent" ${product.is_showcase_parent ? 'checked' : ''}
                                               style="width: 20px; height: 20px; cursor: pointer;">
                                        <span style="font-weight: 600;">🧩 Витринный образец / родитель</span>
                                    </label>
                                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                        <input type="checkbox" id="editProductSkipInventory" ${product.skip_inventory ? 'checked' : ''}
                                               style="width: 20px; height: 20px; cursor: pointer;">
                                        <span style="font-weight: 600;">🚫 Не учитывать в товароучёте (не списывать)</span>
                                    </label>
                                    <div style="font-size: 0.85em; color: #666; margin-top: 0.5rem; line-height: 1.25;">
                                        💡 Родительская карточка нужна для витрины и выбора размера. Учётные позиции (25/32/42) создавайте отдельными товарами и привязывайте как подгруппы.
                                    </div>
                                </div>
                                <div style="font-size: 0.85em; color: #666; margin-top: 0.5rem;">
                                    💡 Скрытые товары не отображаются в каталоге, но доступны для акций
                                </div>
                            </div>

                            <div style="margin-bottom: 1rem;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                    <h3 style="color: var(--dandy-green); margin: 0; font-size: 1.1rem;">📂 Категории меню</h3>
                                    <button type="button" id="createCategoryFromEditBtn" style="padding: 4px 10px; border-radius: 6px; background: rgba(33, 128, 141, 0.1); border: 1px solid rgba(33, 128, 141, 0.3); color: var(--dandy-green); font-size: 11px; cursor: pointer; font-weight: 600;">➕ Новая</button>
                                </div>
                                <div style="margin-bottom: 1rem; max-height: 150px; overflow-y: auto; border: 2px solid #e5e7eb; border-radius: 8px; padding: 1rem;">
                                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                        ${categoriesCheckboxes || '<p style="color: #999; font-size: 0.9rem;">Нет категорий меню. Создайте категории в разделе управления.</p>'}
                                    </div>
                                </div>
                                <div style="font-size: 0.85em; color: #666; margin-bottom: 1rem;">
                                    💡 Категории меню отображаются на сайте в навигации
                                </div>
                            </div>

                            <div style="margin-bottom: 1.5rem;">
                                <h3 style="color: var(--dandy-green); margin: 0 0 0.5rem 0; font-size: 1.1rem;">🏭 Категория номенклатуры (склад)</h3>
                                <select id="editProductCategoryStock" 
                                        style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; background: white;">
                                    <option value="">— Не выбрана —</option>
                                    ${this.categories.map(cat => `
                                        <option value="${cat.id}" ${product.category_stock == cat.id ? 'selected' : ''}>${this.escapeHtml(cat.name)}</option>
                                    `).join('')}
                                </select>
                                <div style="font-size: 0.85em; color: #666; margin-top: 0.5rem;">
                                    💡 Категория номенклатуры используется для склада и бухучёта (молочные продукты, мясо, упаковка)
                                </div>
                            </div>

                            <div style="margin-bottom: 1.5rem;">
                                <h3 style="color: var(--dandy-green); margin: 0 0 0.5rem 0; font-size: 1.1rem;">📁 Группа товаров</h3>
                                <select id="editProductGroupId" 
                                        style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px; background: white;">
                                    <option value="">— Без группы —</option>
                                    ${this.renderGroupOptionsForSelect(product.group_id)}
                                </select>
                                <div style="font-size: 0.85em; color: #666; margin-top: 0.5rem;">
                                    💡 Группа — иерархическая структура для складского учёта. Товар может быть только в одной группе.
                                    <button type="button" onclick="productGroupsManager.init(); productGroupsManager.render();" 
                                            style="margin-left: 0.5rem; padding: 2px 8px; font-size: 0.85em; background: rgba(33, 128, 141, 0.1); border: 1px solid rgba(33, 128, 141, 0.3); color: var(--dandy-green); border-radius: 4px; cursor: pointer;">
                                        Управление группами
                                    </button>
                                </div>
                            </div>

                            <h3 style="color: var(--dandy-green); margin-bottom: 1rem; font-size: 1.1rem;">📷 Изображения</h3>
                            
                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Основное фото (URL):</label>
                                <input type="text" id="editProductImage" value="${product.image_url || ''}" 
                                       placeholder="https://example.com/photo.jpg"
                                       style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                                ${product.image_url ? `
                                    <div style="margin-top: 0.5rem;">
                                        <img src="${product.image_url}" alt="preview" 
                                             style="width: 100px; height: 100px; object-fit: contain; border-radius: 8px; border: 2px solid #e5e7eb;">
                                    </div>
                                ` : ''}
                            </div>

                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Режим фото:</label>
                                <select id="editProductPhotoMode" 
                                        style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px;">
                                    <option value="with_background" ${product.photo_mode === 'with_background' ? 'selected' : ''}>С фоном</option>
                                    <option value="no_background" ${product.photo_mode === 'no_background' ? 'selected' : ''}>Без фона (PNG)</option>
                                </select>
                            </div>

                            <h3 style="color: var(--dandy-green); margin-bottom: 1rem; font-size: 1.1rem;">🔗 Дополнительно</h3>
                            
                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Тип страницы товара:</label>
                                <select id="editProductPageType" 
                                        style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px;">
                                    <option value="default" ${product.product_page_type === 'default' ? 'selected' : ''}>По умолчанию</option>
                                    <option value="custom" ${product.product_page_type === 'custom' ? 'selected' : ''}>Кастомная страница</option>
                                    <option value="external" ${product.product_page_type === 'external' ? 'selected' : ''}>Внешняя ссылка</option>
                                </select>
                            </div>

                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">URL страницы товара:</label>
                                <input type="text" id="editProductPageUrl" value="${product.product_page_url || ''}" 
                                       placeholder="https://example.com/product"
                                       style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                            </div>
                        </div>
                    </div>

                    <!-- Варианты товара -->
                    <div style="margin-top: 2rem; padding-top: 2rem; border-top: 2px solid #e5e7eb;">
                        <h3 style="color: var(--dandy-green); margin-bottom: 1rem; font-size: 1.1rem;">📐 Варианты товара (размеры, вкусы)</h3>
                        <p style="color: #666; font-size: 0.9rem; margin-bottom: 1rem;">
                            Добавьте варианты товара с разными размерами и ценами (например: 25см, 30см, 42см для пиццы)
                        </p>
                        
                        <div id="variantsContainer" style="margin-bottom: 1rem;">
                            ${this.renderVariantsEditor(product)}
                        </div>

                        <div style="display:flex; gap: 0.5rem; flex-wrap: wrap;">
                            <button onclick="ProductCardsManager.addVariant()" 
                                    style="padding: 0.75rem 1.5rem; background: #f3f4f6; color: var(--dandy-green); border: 2px dashed var(--dandy-green); border-radius: 8px; font-weight: 600; cursor: pointer;">
                                ➕ Добавить вариант
                            </button>
                            <button onclick="ProductCardsManager.addPizzaSizePresets()" 
                                    style="padding: 0.75rem 1.5rem; background: rgba(33, 128, 141, 0.08); color: rgba(33, 128, 141, 1); border: 1px solid rgba(33, 128, 141, 0.25); border-radius: 8px; font-weight: 600; cursor: pointer;">
                                🍕 25/32/42
                            </button>
                            <button onclick="ProductCardsManager.sortVariantsBySize()" 
                                    style="padding: 0.75rem 1.5rem; background: rgba(94, 82, 64, 0.08); color: rgba(19, 52, 59, 1); border: 1px solid rgba(94, 82, 64, 0.25); border-radius: 8px; font-weight: 600; cursor: pointer;">
                                ↕️ Сортировать по размеру
                            </button>
                        </div>
                    </div>

                    <!-- Рекомендуемые товары -->
                    <div style="margin-top: 2rem; padding-top: 2rem; border-top: 2px solid #e5e7eb;">
                        <h3 style="color: var(--dandy-green); margin-bottom: 1rem; font-size: 1.1rem;">🎯 Рекомендуемые товары (для upsell)</h3>
                        <p style="color: #666; font-size: 0.9rem; margin-bottom: 1rem;">
                            Выберите товары, которые будут рекомендованы вместе с этим товаром
                        </p>
                        
                        <div id="recommendedContainer" style="margin-bottom: 1rem;">
                            ${this.renderRecommendedEditor(product)}
                        </div>

                        <button onclick="ProductCardsManager.addRecommended()" 
                                style="padding: 0.75rem 1.5rem; background: #f3f4f6; color: var(--dandy-green); border: 2px dashed var(--dandy-green); border-radius: 8px; font-weight: 600; cursor: pointer;">
                            ➕ Добавить рекомендуемый товар
                        </button>
                    </div>

                    <!-- ✅ МОДИФИКАТОРЫ/ДОПЫ -->
                    <div style="margin-top: 2rem; padding-top: 2rem; border-top: 2px solid #e5e7eb;">
                        <h3 style="color: var(--dandy-green); margin-bottom: 1rem; font-size: 1.1rem;">🎯 Модификаторы и допы</h3>
                        <p style="color: #666; font-size: 0.9rem; margin-bottom: 1rem;">
                            Выберите группы модификаторов (соусы, доп. ингредиенты), которые будут доступны при оформлении заказа этого товара
                        </p>

                        <div style="display:flex; align-items:center; justify-content:space-between; gap: 12px; margin-bottom: 0.75rem; flex-wrap: wrap;">
                            <label style="display:flex; align-items:center; gap: 8px; cursor:pointer; user-select:none; color:#374151; font-size: 0.9rem;">
                                <input type="checkbox" id="editShowAllModifierGroups" style="width: 18px; height: 18px;">
                                Показывать все группы (не фильтровать по категориям)
                            </label>
                            <div style="font-size: 0.85rem; color:#6b7280;">
                                💡 Если выключено — показываем только допы, подходящие под выбранные категории товара
                            </div>
                        </div>
                        
                        <div id="modifiersContainer" style="margin-bottom: 1rem; padding: 1rem; background: #f9fafb; border-radius: 8px; border: 2px solid #e5e7eb;">
                            ${this.renderModifiersForEdit(product, { selectedCategoryIds: productCategoryIds, showAll: false })}
                        </div>
                        
                        <div style="font-size: 0.85em; color: #666; margin-top: 0.5rem;">
                            💡 Модификаторы создаются в разделе "Модификаторы". Здесь вы только привязываете их к товару.
                            <button type="button" onclick="window.location.hash = '#modifiers'; this.closest('.modal-overlay').remove();" 
                                    style="margin-left: 0.5rem; padding: 2px 8px; font-size: 0.85em; background: rgba(33, 128, 141, 0.1); border: 1px solid rgba(33, 128, 141, 0.3); color: var(--dandy-green); border-radius: 4px; cursor: pointer;">
                                Управление модификаторами
                            </button>
                        </div>
                    </div>

                    <!-- Варианты / Виды (по ТЗ) -->
                    <div style="margin-top: 2rem; padding-top: 2rem; border-top: 2px solid #e5e7eb;">
                        <h3 style="color: var(--dandy-green); margin-bottom: 1rem; font-size: 1.1rem;">🧩 Варианты / Виды</h3>
                        <p style="color: #666; font-size: 0.9rem; margin-bottom: 1rem;">
                            Для витринной карточки добавьте реальные размеры (варианты). Они являются отдельными учётными позициями.
                        </p>

                        <div id="productVariantsContainer" style="margin-bottom: 1rem;">
                            ${this.renderProductVariantsEditor(product)}
                        </div>

                        <div style="display:flex; gap: 0.5rem; flex-wrap: wrap;">
                            <button onclick="ProductCardsManager.showAddVariantModal('${product.id}')" 
                                    style="padding: 0.75rem 1.5rem; background: #f3f4f6; color: var(--dandy-green); border: 2px dashed var(--dandy-green); border-radius: 8px; font-weight: 600; cursor: pointer;">
                                ➕ Добавить вариант
                            </button>
                            <button onclick="ProductCardsManager.loadAndRenderProductVariants('${product.id}')" 
                                    style="padding: 0.75rem 1.5rem; background: rgba(33, 128, 141, 0.08); color: rgba(33, 128, 141, 1); border: 1px solid rgba(33, 128, 141, 0.25); border-radius: 8px; font-weight: 600; cursor: pointer;">
                                🔄 Обновить
                            </button>
                        </div>

                        <div id="productVariantsMinPrice" style="margin-top: 0.75rem; color: #6b7280; font-size: 0.95rem;"></div>
                    </div>

                    <div style="display: flex; gap: 1rem; margin-top: 2rem; padding-top: 2rem; border-top: 2px solid #e5e7eb;">
                        <button onclick="ProductCardsManager.saveEditedProduct('${product.id}')" 
                                style="flex: 1; padding: 1rem; background: var(--dandy-green); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 16px;">
                            💾 Сохранить изменения
                        </button>
                        <button onclick="this.closest('.modal-overlay').remove()" 
                                style="flex: 1; padding: 1rem; background: #6b7280; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                            ❌ Отмена
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.remove();
            });

            // ✅ Скрытие/отключение складских полей для витринной карточки
            const applySkipInventoryState = () => {
                try {
                    const skip = Boolean(modal.querySelector('#editProductSkipInventory')?.checked);
                    const costEl = modal.querySelector('#editProductCost');
                    const stockEl = modal.querySelector('#editProductStock');
                    if (costEl) {
                        costEl.disabled = skip;
                        costEl.style.opacity = skip ? '0.6' : '';
                    }
                    if (stockEl) {
                        stockEl.disabled = skip;
                        stockEl.style.opacity = skip ? '0.6' : '';
                    }
                } catch (_) {}
            };
            const skipInvEl = modal.querySelector('#editProductSkipInventory');
            if (skipInvEl) {
                skipInvEl.addEventListener('change', applySkipInventoryState);
            }
            applySkipInventoryState();

            // ✅ Автообновление списка допов при смене категорий / переключателя "показать все"
            const refreshModifiersByCategory = () => {
                try {
                    const root = modal;
                    const container = root.querySelector('#modifiersContainer');
                    if (!container) return;

                    const showAll = Boolean(root.querySelector('#editShowAllModifierGroups')?.checked);
                    const selectedCategoryIdsNow = Array.from(root.querySelectorAll('.edit-category-checkbox:checked'))
                        .map(cb => String(cb.value))
                        .filter(Boolean);

                    // сохраняем текущие выбранные группы, чтобы не терялись при перерисовке
                    const selectedGroupIdsNow = Array.from(root.querySelectorAll('.edit-modifier-checkbox:checked'))
                        .map(cb => String(cb.value))
                        .filter(Boolean);

                    container.innerHTML = this.renderModifiersForEdit(product, {
                        selectedCategoryIds: selectedCategoryIdsNow,
                        showAll,
                        selectedGroupIdsOverride: selectedGroupIdsNow
                    });
                } catch (e) {
                    console.warn('refreshModifiersByCategory failed', e);
                }
            };

            const showAllEl = modal.querySelector('#editShowAllModifierGroups');
            if (showAllEl) {
                showAllEl.addEventListener('change', refreshModifiersByCategory);
            }
            modal.querySelectorAll('.edit-category-checkbox').forEach(cb => {
                cb.addEventListener('change', refreshModifiersByCategory);
            });
            
            // Загружаем варианты после открытия формы
            this.loadAndRenderProductVariants(product.id).catch(err => {
                console.error('Ошибка загрузки вариантов:', err);
            });
            
            // Обработчик кнопки создания категории из формы редактирования
            const createCategoryBtn = modal.querySelector('#createCategoryFromEditBtn');
            if (createCategoryBtn) {
                createCategoryBtn.addEventListener('click', async () => {
                    const categoryName = prompt('Введите название новой категории:');
                    if (!categoryName || !categoryName.trim()) return;
                    
                    try {
                        const response = await fetch('/api/categories', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                name: categoryName.trim(),
                                show_on_site: true,
                                show_in_nav: true
                            })
                        });
                        
                        const result = await response.json();
                        if (result.success) {
                            await this.loadCategories();
                            // Переоткрываем форму редактирования с обновленными категориями
                            modal.remove();
                            await this.editProduct(productId);
                            alert(`✅ Категория "${categoryName}" создана!`);
                        } else {
                            throw new Error(result.error || 'Ошибка создания категории');
                        }
                    } catch (error) {
                        console.error('Ошибка создания категории:', error);
                        alert(`❌ Ошибка создания категории: ${error.message}`);
                    }
                });
            }
        },

        // Сохранить отредактированный товар
        async saveEditedProduct(productId) {
            // Найдём модальное окно конкретного товара и будем искать элементы внутри него
            const modal = Array.from(document.querySelectorAll('.modal-overlay')).find(m => {
                try {
                    return m.querySelector(`button[onclick*="saveEditedProduct('${productId}')"]`);
                } catch (e) { return false; }
            });
            const root = modal || document;

            const name = (root.querySelector('#editProductName') || { value: '' }).value.trim();
            const sku = (root.querySelector('#editProductSku') || { value: '' }).value.trim();
            const productType = (root.querySelector('#editProductType')?.value) || 'product';
            const cost = parseFloat((root.querySelector('#editProductCost') || { value: 0 }).value) || 0;
            const weight = (root.querySelector('#editProductWeight') || { value: '' }).value.trim();
            const calories = (root.querySelector('#editProductCalories') || { value: '' }).value.trim();

            // Валидация обязательных полей
            const errors = [];
            if (!name) errors.push('Название');
            // SKU, вес, калории, себестоимость - необязательные поля, но если заполнены - сохраняются

            if (errors.length > 0) {
                alert(`❌ Заполните обязательные поля:\n${errors.map(e => `• ${e}`).join('\n')}`);
                return;
            }

            // Собираем выбранные категории меню
            const selectedCategoryIds = Array.from(root.querySelectorAll('.edit-category-checkbox:checked'))
                .map(cb => {
                    const raw = cb.value;
                    const num = Number(raw);
                    return Number.isNaN(num) ? raw : num;
                });
            
            // Собираем категорию номенклатуры
            const categoryStockId = (root.querySelector('#editProductCategoryStock')?.value) || null;
            
            // Собираем группу товара
            const groupId = (root.querySelector('#editProductGroupId')?.value) || null;

            // Всегда сортируем варианты по размеру перед сохранением (для стабильного порядка 25/32/42 и т.п.)
            try {
                if (typeof this.sortVariantsBySize === 'function') {
                    this.sortVariantsBySize();
                }
            } catch (_) {}

            // Собираем варианты товара
            const variantItems = root.querySelectorAll('.variant-item');
            const variants = Array.from(variantItems)
                .map(item => ({
                    variant_id: (item.querySelector('.variant-id')?.value || '').trim(),
                    name: item.querySelector('.variant-name').value.trim(),
                    price: parseFloat(item.querySelector('.variant-price').value) || 0,
                    stock: parseInt(item.querySelector('.variant-stock').value) || 0
                }))
                .filter(v => v.name)
                .map(v => ({
                    ...v,
                    variant_id: v.variant_id || (typeof this.generateVariantId === 'function' ? this.generateVariantId() : (`var-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`))
                }));

            if (!this.validateVariants(variants)) {
                return;
            }

            // ✅ ИСПРАВЛЕНО: Создаем вариации с правильной структурой для размеров пиццы
            const variations = variants.map(v => {
                // Извлекаем размер из имени (например, "25 см" -> 25)
                let sizeValue = 25;
                const sizeMatch = String(v.name).match(/(\d+)\s*(см|cm|см\.?)/i);
                if (sizeMatch) {
                    sizeValue = parseInt(sizeMatch[1]);
                } else {
                    const simpleMatch = String(v.name).match(/^(\d+)$/);
                    if (simpleMatch) {
                        sizeValue = parseInt(simpleMatch[1]);
                    }
                }
                
                return {
                    variant_id: v.variant_id,
                    price: v.price,
                    quantity: v.stock,
                    parameters: [
                        { name: 'Размер', value: `${sizeValue} см`, display: 'list' },
                        { name: 'Вариант', value: v.name, display: 'list' }
                    ],
                    // ✅ Добавляем размер напрямую для упрощения извлечения
                    size: sizeValue
                };
            });

            // Собираем рекомендуемые товары
            const recommendedItems = root.querySelectorAll('.recommended-item');
            const recommended = Array.from(recommendedItems)
                .map(item => item.getAttribute('data-product-id'))
                .filter(Boolean);

            // Получаем процент потерь и коэффициент пересчёта
            const lossPercentEl = root.querySelector('#editProductLossPercent');
            const lossPercent = lossPercentEl ? (parseFloat(lossPercentEl.value) || 0) : 0;
            const conversionFactorEl = root.querySelector('#editProductConversionFactor');
            const conversionFactor = conversionFactorEl ? (parseFloat(conversionFactorEl.value) || 1.0) : 1.0;

            const imageUrl = (root.querySelector('#editProductImage') || { value: '' }).value.trim();
            const images = imageUrl
                ? [{ id: `img-${Date.now()}`, url: imageUrl, role: 'primary', alt_text: name }]
                : [];

            const descriptionFull = (root.querySelector('#editProductFullDesc') || { value: '' }).value.trim();
            const descriptionShort = (root.querySelector('#editProductShortDesc') || { value: '' }).value.trim();

            const selectedModifierGroups = Array.from(root.querySelectorAll('.edit-modifier-checkbox:checked'))
                .map(cb => {
                    const groupId = cb.value;
                    const group = this.modifiers.find(m => m.group_id == groupId || String(m.group_id) === String(groupId));
                    return group ? {
                        group_id: group.group_id,
                        group_name: group.group_name,
                        multi_select: Boolean(group.multi_select),
                        min_select: group.min_select ?? 0,
                        max_select: group.max_select ?? null,
                        options: group.options || []
                    } : null;
                })
                .filter(Boolean);

            const productData = {
                name: name,
                type: productType,
                sku: sku,
                short_description: descriptionShort,
                full_description: descriptionFull,
                // для совместимости: catalog_store использует поле description
                description: descriptionFull,
                price: parseFloat((root.querySelector('#editProductPrice') || { value: 0 }).value) || 0,
                old_price: (root.querySelector('#editProductOldPrice') || { value: '' }).value.trim() || null,
                cost: parseFloat((root.querySelector('#editProductCost') || { value: 0 }).value) || 0,
                stock_quantity: parseInt((root.querySelector('#editProductStock') || { value: 0 }).value) || 0,
                weight: (root.querySelector('#editProductWeight') || { value: '' }).value.trim(),
                calories: (root.querySelector('#editProductCalories') || { value: '' }).value.trim(),
                ingredients: (root.querySelector('#editProductIngredients') || { value: '' }).value.trim(),
                allergens: (root.querySelector('#editProductAllergens') || { value: '' }).value.trim(),
                visible_on_site: !!root.querySelector('#editProductVisible')?.checked,
                hidden_for_promo: !!root.querySelector('#editProductHiddenPromo')?.checked,
                is_showcase_parent: !!root.querySelector('#editProductShowcaseParent')?.checked,
                skip_inventory: !!root.querySelector('#editProductSkipInventory')?.checked,
                category_ids: selectedCategoryIds,
                // catalog_store использует categories
                categories: selectedCategoryIds,
                category_stock: categoryStockId ? parseInt(categoryStockId) : null,
                group_id: groupId ? parseInt(groupId) : null,
                image_url: imageUrl,
                images,
                photo_mode: document.getElementById('editProductPhotoMode').value,
                product_page_type: document.getElementById('editProductPageType').value,
                product_page_url: document.getElementById('editProductPageUrl').value.trim(),
                // legacy expects variants, catalog expects variations
                variants,
                variations,
                recommended_products: recommended,
                related_products: recommended,
                modifiers: selectedModifierGroups,
                loss_percentage: lossPercent,
                conversion_factor: conversionFactor,
                vat_rate: (root.querySelector('#editProductVatRate') || { value: '' }).value || null,
                tax_type: (root.querySelector('#editProductTaxType') || { value: 'none' }).value || 'none'
            };

            try {
                const host = (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : '';
                const localHost = host === 'localhost' || host === '127.0.0.1';
                const forcedCatalog = (typeof window !== 'undefined' && window.USE_CATALOG_API === true) || localStorage.getItem('USE_CATALOG_API') === '1';
                const tryCatalog = forcedCatalog;

                let response = null;

                if (tryCatalog) {
                    try {
                        response = await fetch(`/api/catalog/products/${encodeURIComponent(productId)}`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${localStorage.getItem('dandy_auth_token') || localStorage.getItem('token') || ''}`
                            },
                            body: JSON.stringify(productData)
                        });
                        if (response && response.status === 404) {
                            try { localStorage.setItem('USE_CATALOG_API', '0'); } catch (_) {}
                            response = null;
                        }
                    } catch (_) {
                        response = null;
                    }
                }

                if (!response || !response.ok) {
                    response = await fetch(`/api/products/${encodeURIComponent(productId)}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(productData)
                    });
                }

                if (response.ok) {
                    alert('✅ Товар успешно обновлён!');
                    if (modal) modal.remove(); else document.querySelector('.modal-overlay')?.remove();
                    await this.loadProducts();
                    // Синхронизируем с витриной с уведомлением
                    await this.syncToWebsite(true);
                } else {
                    const error = await response.json();
                    alert(`❌ Ошибка: ${error.error}`);
                }
            } catch (error) {
                console.error('Save product error:', error);
                alert('❌ Ошибка при сохранении товара');
            }
        },
        // Дублировать товар
        async duplicateProduct(productId) {
            const product = this.products.find(p => p.id === productId);
            if (!product) return;

            if (!confirm(`Создать копию товара "${product.name}"?`)) {
                return;
            }

            try {
                const newProduct = {
                    ...product,
                    id: undefined,
                    name: `${product.name} (копия)`,
                    sku: `${product.sku}-copy-${Date.now()}`
                };

                const response = await fetch('/api/products', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newProduct)
                });

                if (response.ok) {
                    alert('✅ Товар успешно скопирован');
                    await this.loadProducts();
                } else {
                    const error = await response.json();
                    alert(`❌ Ошибка: ${error.error}`);
                }
            } catch (error) {
                console.error('Duplicate product error:', error);
                alert('❌ Ошибка при копировании товара');
            }
        },

        // Удалить товар
        async deleteProduct(productId) {
            // Используем сравнение через String для корректной работы с разными типами ID
            const productIdStr = String(productId);
            const product = this.products.find(p => String(p.id) === productIdStr);
            const productName = product ? product.name : `ID: ${productId}`;

            if (!confirm(`⚠️ ВНИМАНИЕ!\n\nВы действительно хотите удалить товар "${productName}"?\n\nЭто действие нельзя отменить!`)) {
                return;
            }

            try {
                // Сначала пробуем API
                let deletedViaApi = false;
                let apiError = null;
                let responseStatus = null;
                
                try {
                    // Правильно кодируем ID для URL
                    const encodedId = encodeURIComponent(productId);
                    const response = await fetch(`/api/products/${encodedId}`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });

                    responseStatus = response.status;
                    console.log(`🔍 API ответ: status=${response.status}, ok=${response.ok}`);

                    if (response.ok && response.status === 200) {
                        const result = await response.json().catch(() => ({}));
                        console.log(`🔍 API результат:`, result);
                        if (result.success === true) {
                            deletedViaApi = true;
                            console.log('✅ Товар удален через API');
                        } else {
                            apiError = result.error || result.message || 'Неизвестная ошибка API';
                            console.warn('⚠️ API вернул ошибку:', apiError);
                        }
                    } else {
                        // response.ok = false или status !== 200
                        const errorText = await response.text().catch(() => response.statusText);
                        let errorData = {};
                        try {
                            errorData = JSON.parse(errorText);
                        } catch (e) {
                            // Не JSON ответ
                        }
                        apiError = errorData.message || errorData.error || `HTTP ${response.status}: ${errorText}`;
                        console.warn(`⚠️ API вернул ошибку: ${response.status} ${apiError}`);
                        
                        // Если товар не найден в БД (404), это не критично - удалим локально
                        if (response.status === 404) {
                            console.log('ℹ️ Товар не найден в БД, но будет удален локально');
                            // НЕ устанавливаем deletedViaApi = true для 404
                        }
                    }
                } catch (error) {
                    apiError = error.message;
                    console.warn('⚠️ Ошибка при удалении через API:', error);
                }

                // Удаляем товар локально в любом случае
                // Используем сравнение через String для корректной работы с разными типами ID
                const productIdStr = String(productId);
                const prevLength = this.products.length;
                this.products = this.products.filter(p => String(p.id) !== productIdStr);
                this.selectedProducts.delete(productId);
                this.selectedProducts.delete(productIdStr); // На всякий случай удаляем и строковый вариант
                const newLength = this.products.length;

                // Если товар был найден и удален из локального массива
                if (prevLength !== newLength) {
                    console.log(`🗑️ Товар удален локально (было: ${prevLength}, стало: ${newLength})`);

                    // Устанавливаем флаг явного удаления
                    this._productsExplicitlyDeleted = true;

                    // Синхронизируем с сайтом (передаем обновленный список товаров)
                    const syncSuccess = await this.syncToWebsite(false, this.products);
                    
                    if (syncSuccess) {
                        console.log('✅ Товар удален с сайта');
                    } else {
                        console.warn('⚠️ Не удалось синхронизировать с сайтом, но товар удален локально');
                    }
                    
                    // Обновляем таблицу без повторной загрузки товаров
                    this.renderProductsTable();
                    
                    // Показываем результат
                    let message;
                    if (deletedViaApi) {
                        message = '✅ Товар успешно удален с сайта и из админки';
                    } else if (responseStatus === 404) {
                        // Товар не найден в БД, но удален локально - это нормально
                        message = syncSuccess 
                            ? '✅ Товар удален из админки (не найден в базе данных)'
                            : '✅ Товар удален из админки (не найден в базе данных, синхронизация пропущена)';
                    } else if (syncSuccess) {
                        message = '✅ Товар удален (API недоступен, но синхронизация выполнена)';
                    } else {
                        message = '⚠️ Товар удален локально, но синхронизация не выполнена';
                    }
                    
                    alert(message);
                } else {
                    // Товар не найден в локальном массиве
                    // Если API вернул 404 - это нормально, товар уже удален из БД
                    if (responseStatus === 404) {
                        console.log('ℹ️ Товар не найден в локальном массиве и в БД - возможно уже был удален ранее');
                        // Просто обновляем таблицу на случай если товар был удален ранее
                        this.renderProductsTable();
                        alert('✅ Товар не найден в базе данных (возможно уже был удален ранее)');
                    } else {
                        // Товар не найден в локальном массиве, но API не вернул 404
                        // Это может быть ошибка, но не критично - просто обновляем таблицу
                        console.warn(`⚠️ Товар с ID ${productId} не найден в локальном массиве`);
                        this.renderProductsTable();
                        alert('⚠️ Товар не найден в локальном списке. Таблица обновлена.');
                    }
                }
            } catch (error) {
                console.error('❌ Ошибка при удалении товара:', error);
                alert('❌ Ошибка при удалении товара: ' + (error.message || 'Неизвестная ошибка'));
            }
        },
        // Отрисовка редактора вариантов
        renderVariantsEditor(product) {
            let variants = [];
            try {
                // Предпочитаем простой формат variants (name/price/stock) для редактора,
                // но умеем отображать и богатый формат variations (parameters/quantity).
                const source =
                    (product.variants && (Array.isArray(product.variants) ? product.variants.length : true))
                        ? product.variants
                        : product.variations;
                const raw = source
                    ? (typeof source === 'string' ? JSON.parse(source) : source)
                    : [];

                variants = Array.isArray(raw)
                    ? raw.map((v) => {
                        if (!v || typeof v !== 'object') return null;
                        // Если это rich variation — вытаскиваем имя из parameters
                        if (Array.isArray(v.parameters) && v.parameters.length) {
                            const p =
                                v.parameters.find((x) => (x?.name || '').toLowerCase() === 'вариант') ||
                                v.parameters[0];
                            return {
                                variant_id: v.variant_id || v.variantId || '',
                                name: p?.value || v.name || '',
                                price: v.price ?? 0,
                                stock: v.stock ?? v.quantity ?? 0
                            };
                        }
                        // Простой формат
                        return {
                            variant_id: v.variant_id || v.variantId || '',
                            name: v.name || '',
                            price: v.price ?? 0,
                            stock: v.stock ?? 0
                        };
                    }).filter(Boolean)
                    : [];
            } catch (e) {
                variants = [];
            }

            if (variants.length === 0) {
                return '<p style="color: #999; text-align: center; padding: 2rem;">Нет вариантов. Нажмите "➕ Добавить вариант"</p>';
            }

            return variants.map((variant, index) => `
                <div class="variant-item" data-index="${index}" style="background: #f9fafb; padding: 1rem; border-radius: 8px; margin-bottom: 0.75rem; border: 2px solid #e5e7eb;">
                    <input type="hidden" class="variant-id" value="${this.escapeHtml(String(variant.variant_id || ''))}">
                    <div style="display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 1rem; align-items: center;">
                        <div>
                            <label style="display: block; margin-bottom: 0.25rem; font-size: 0.85rem; font-weight: 600; color: #666;">Название варианта:</label>
                            <input type="text" class="variant-name" value="${variant.name || ''}" 
                                   placeholder="Например: 25 см"
                                   style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 0.25rem; font-size: 0.85rem; font-weight: 600; color: #666;">Цена (₽):</label>
                            <input type="number" class="variant-price" value="${variant.price || 0}" step="0.01"
                                   style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 0.25rem; font-size: 0.85rem; font-weight: 600; color: #666;">Остаток:</label>
                            <input type="number" class="variant-stock" value="${variant.stock || 0}"
                                   style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px;">
                        </div>
                        <div style="padding-top: 1.5rem;">
                            <button onclick="ProductCardsManager.removeVariant(this)"
                                    style="padding: 0.5rem 0.75rem; background: #dc2626; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">
                                🗑️
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        },
        // Отрисовка редактора рекомендуемых товаров
        renderRecommendedEditor(product) {
            let recommended = [];
            try {
                recommended = product.recommended_products ? 
                    (typeof product.recommended_products === 'string' ? JSON.parse(product.recommended_products) : product.recommended_products) 
                    : [];
            } catch (e) {
                recommended = [];
            }

            if (recommended.length === 0) {
                return '<p style="color: #999; text-align: center; padding: 2rem;">Нет рекомендуемых товаров. Нажмите "➕ Добавить"</p>';
            }

            return recommended.map((productId, index) => {
                const recommendedProduct = this.products.find(p => p.id === productId);
                const productName = recommendedProduct ? recommendedProduct.name : 'Товар не найден';
                const productImage = recommendedProduct?.image_url || '';

                return `
                    <div class="recommended-item" data-index="${index}" style="background: #f9fafb; padding: 1rem; border-radius: 8px; margin-bottom: 0.75rem; border: 2px solid #e5e7eb; display: flex; align-items: center; gap: 1rem;">
                        ${productImage ? `<img src="${productImage}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px;">` : '<div style="width: 50px; height: 50px; background: #e5e7eb; border-radius: 6px;"></div>'}
                        <div style="flex: 1;">
                            <div style="font-weight: 600;">${productName}</div>
                            <div style="font-size: 0.85rem; color: #666;">ID: ${productId}</div>
                        </div>
                        <button onclick="ProductCardsManager.removeRecommended(${index})"
                                style="padding: 0.5rem 0.75rem; background: #dc2626; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">
                            🗑️ Удалить
                        </button>
                    </div>
                `;
            }).join('');
        },
        generateVariantId() {
            return `var-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        },
        getVariantSizeFromName(name) {
            const str = String(name || '').trim();
            if (!str) return null;
            const m = str.match(/(\d+)\s*(см|cm|см\.?)/i);
            if (m) {
                const n = parseInt(m[1], 10);
                return Number.isFinite(n) ? n : null;
            }
            const m2 = str.match(/^(\d+)$/);
            if (m2) {
                const n = parseInt(m2[1], 10);
                return Number.isFinite(n) ? n : null;
            }
            return null;
        },
        validateVariants(variants) {
            const list = Array.isArray(variants) ? variants : [];
            const nameSet = new Set();
            const sizeSet = new Set();

            for (const v of list) {
                const name = String(v?.name || '').trim();
                if (!name) continue;
                const key = name.toLowerCase();
                if (nameSet.has(key)) {
                    alert('❌ Дубли вариантов по названию. Переименуйте или удалите повтор.');
                    return false;
                }
                nameSet.add(key);

                const size = this.getVariantSizeFromName(name);
                if (size !== null) {
                    if (sizeSet.has(size)) {
                        alert('❌ Дубли вариантов по размеру. Оставьте один вариант для каждого размера.');
                        return false;
                    }
                    sizeSet.add(size);
                }

                const price = Number(v?.price);
                if (!Number.isFinite(price) || price < 0) {
                    alert('❌ Цена варианта должна быть числом и не меньше 0');
                    return false;
                }
            }

            return true;
        },
        getVariantsContainer() {
            return document.getElementById('variantsContainer');
        },
        reindexVariantsContainer(container) {
            const root = container || this.getVariantsContainer();
            if (!root) return;
            const items = Array.from(root.querySelectorAll('.variant-item'));
            items.forEach((el, idx) => {
                try {
                    el.dataset.index = String(idx);
                } catch (_) {}
            });
        },
        insertVariantRow({ variant_id, name, price, stock } = {}) {
            const container = this.getVariantsContainer();
            if (!container) return;

            const current = container.querySelectorAll('.variant-item');
            const newIndex = current.length;
            const id = String(variant_id || '').trim() || this.generateVariantId();
            const safeName = String(name || '').replace(/"/g, '&quot;');
            const safePrice = Number.isFinite(Number(price)) ? Number(price) : 0;
            const safeStock = Number.isFinite(Number(stock)) ? parseInt(stock, 10) : 0;

            const html = `
                <div class="variant-item" data-index="${newIndex}" style="background: #f9fafb; padding: 1rem; border-radius: 8px; margin-bottom: 0.75rem; border: 2px solid #e5e7eb;">
                    <input type="hidden" class="variant-id" value="${id}">
                    <div style="display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 1rem; align-items: center;">
                        <div>
                            <label style="display: block; margin-bottom: 0.25rem; font-size: 0.85rem; font-weight: 600; color: #666;">Название варианта:</label>
                            <input type="text" class="variant-name" value="${safeName}" placeholder="Например: 25 см" style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 0.25rem; font-size: 0.85rem; font-weight: 600; color: #666;">Цена (₽):</label>
                            <input type="number" class="variant-price" value="${safePrice}" step="0.01" style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 0.25rem; font-size: 0.85rem; font-weight: 600; color: #666;">Остаток:</label>
                            <input type="number" class="variant-stock" value="${safeStock}" style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px;">
                        </div>
                        <div style="padding-top: 1.5rem;">
                            <button onclick="ProductCardsManager.removeVariant(this)" style="padding: 0.5rem 0.75rem; background: #dc2626; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">🗑️</button>
                        </div>
                    </div>
                </div>
            `;

            if (container.querySelector('p')) {
                container.innerHTML = html;
            } else {
                container.insertAdjacentHTML('beforeend', html);
            }

            this.reindexVariantsContainer(container);
        },
        addPizzaSizePresets() {
            const container = this.getVariantsContainer();
            if (!container) return;

            const basePrice = parseFloat(document.getElementById('editProductPrice')?.value || '0') || 0;
            const existingNames = new Set(
                Array.from(container.querySelectorAll('.variant-name'))
                    .map((el) => String(el?.value || '').trim().toLowerCase())
                    .filter(Boolean)
            );
            const existingSizes = new Set(
                Array.from(container.querySelectorAll('.variant-name'))
                    .map((el) => this.getVariantSizeFromName(el?.value))
                    .filter((v) => v !== null)
            );

            const presets = [
                { size: 25, price: basePrice },
                { size: 32, price: basePrice + 100 },
                { size: 42, price: basePrice + 200 }
            ];

            presets.forEach((p) => {
                const name = `${p.size} см`;
                if (existingNames.has(name.toLowerCase())) return;
                if (existingSizes.has(p.size)) return;
                this.insertVariantRow({ name, price: p.price, stock: 0 });
            });

            this.sortVariantsBySize();
        },
        sortVariantsBySize() {
            const container = this.getVariantsContainer();
            if (!container) return;
            const items = Array.from(container.querySelectorAll('.variant-item'));
            if (!items.length) return;

            items.sort((a, b) => {
                const aName = a.querySelector('.variant-name')?.value || '';
                const bName = b.querySelector('.variant-name')?.value || '';
                const aSize = this.getVariantSizeFromName(aName);
                const bSize = this.getVariantSizeFromName(bName);
                if (aSize === null && bSize === null) {
                    return String(aName).localeCompare(String(bName), 'ru');
                }
                if (aSize === null) return 1;
                if (bSize === null) return -1;
                return aSize - bSize;
            });

            items.forEach((el) => container.appendChild(el));

            this.reindexVariantsContainer(container);
        },
        // Добавить вариант товара
        addVariant() {
            this.insertVariantRow({ name: '', price: 0, stock: 0 });
        },

        // Удалить вариант товара
        removeVariant(indexOrEl) {
            const container = this.getVariantsContainer();
            if (!container) return;

            if (indexOrEl && typeof indexOrEl === 'object') {
                const item = indexOrEl.closest ? indexOrEl.closest('.variant-item') : null;
                if (item) {
                    item.remove();
                }
            } else {
                const index = Number(indexOrEl);
                const variants = container.querySelectorAll('.variant-item');
                if (variants[index]) {
                    variants[index].remove();
                }
            }

            // Если вариантов не осталось, показываем заглушку
            if (container.querySelectorAll('.variant-item').length === 0) {
                container.innerHTML = '<p style="color: #999; text-align: center; padding: 2rem;">Нет вариантов. Нажмите "➕ Добавить вариант"</p>';
                return;
            }

            this.reindexVariantsContainer(container);
        },

        // Добавить рекомендуемый товар
        addRecommended() {
            // Создаём модальное окно выбора товара
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.7); display: flex; align-items: center;
                justify-content: center; z-index: 10001;
            `;

            const productsOptions = this.products.map(p => `
                <div onclick="ProductCardsManager.selectRecommendedProduct('${p.id}')" 
                     style="display: flex; align-items: center; gap: 1rem; padding: 0.75rem; background: white; border-radius: 8px; cursor: pointer; border: 2px solid #e5e7eb; margin-bottom: 0.5rem; transition: all 0.2s;"
                     onmouseover="this.style.borderColor='var(--dandy-green)'; this.style.background='#f0f9ff';"
                     onmouseout="this.style.borderColor='#e5e7eb'; this.style.background='white';">
                    ${p.image_url ? `<img src="${p.image_url}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px;">` : '<div style="width: 50px; height: 50px; background: #f3f4f6; border-radius: 6px;"></div>'}
                    <div style="flex: 1;">
                        <div style="font-weight: 600;">${p.name}</div>
                        <div style="font-size: 0.85rem; color: #666;">${p.price} ₽</div>
                    </div>
                </div>
            `).join('');

            modal.innerHTML = `
                <div style="background: white; border-radius: 16px; padding: 2rem; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
                    <h2 style="margin: 0 0 1.5rem 0; color: var(--dandy-green);">🎯 Выбор рекомендуемого товара</h2>
                    
                    <div style="margin-bottom: 1rem;">
                        <input type="text" id="searchRecommended" placeholder="🔍 Поиск товара..." 
                               oninput="ProductCardsManager.filterRecommendedProducts(this.value)"
                               style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px;">
                    </div>

                    <div id="recommendedProductsList" style="max-height: 400px; overflow-y: auto;">
                        ${productsOptions}
                    </div>

                    <button onclick="this.closest('.modal-overlay').remove()" 
                            style="width: 100%; margin-top: 1rem; padding: 1rem; background: #6b7280; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                        ❌ Отмена
                    </button>
                </div>
            `;

            document.body.appendChild(modal);
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.remove();
            });
        },
        // Фильтрация рекомендуемых товаров при поиске
        filterRecommendedProducts(searchTerm) {
            const list = document.getElementById('recommendedProductsList');
            const items = list.querySelectorAll('div[onclick]');
            
            items.forEach(item => {
                const text = item.textContent.toLowerCase();
                if (text.includes(searchTerm.toLowerCase())) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        },

        readFileAsArrayBuffer(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsArrayBuffer(file);
            });
        },

        async convertExcelToCsv(file, delimiter = ',') {
            if (!window.XLSX && typeof window.loadXLSX === 'function') {
                await window.loadXLSX();
            }
            if (!window.XLSX) {
                throw new Error('Библиотека XLSX не загружена');
            }

            const arrayBuffer = await this.readFileAsArrayBuffer(file);
            const data = new Uint8Array(arrayBuffer);
            const workbook = window.XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook?.SheetNames?.[0];
            if (!firstSheetName) {
                throw new Error('Excel файл не содержит листов');
            }
            const worksheet = workbook.Sheets[firstSheetName];
            if (!worksheet) {
                throw new Error('Не удалось прочитать первый лист Excel');
            }
            const fs = (delimiter === '\t' || delimiter === ',' || delimiter === ';' || delimiter === '|') ? delimiter : ',';
            return window.XLSX.utils.sheet_to_csv(worksheet, { FS: fs });
        },
        // Выбрать рекомендуемый товар
        selectRecommendedProduct(productId) {
            const container = document.getElementById('recommendedContainer');
            const product = this.products.find(p => p.id === productId);
            
            if (!product) return;

            const newRecommendedHtml = `
                <div class="recommended-item" data-product-id="${productId}" style="background: #f9fafb; padding: 1rem; border-radius: 8px; margin-bottom: 0.75rem; border: 2px solid #e5e7eb; display: flex; align-items: center; gap: 1rem;">
                    ${product.image_url ? `<img src="${product.image_url}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px;">` : '<div style="width: 50px; height: 50px; background: #e5e7eb; border-radius: 6px;"></div>'}
                    <div style="flex: 1;">
                        <div style="font-weight: 600;">${product.name}</div>
                        <div style="font-size: 0.85rem; color: #666;">ID: ${productId}</div>
                    </div>
                    <button onclick="ProductCardsManager.removeRecommendedByElement(this)"
                            style="padding: 0.5rem 0.75rem; background: #dc2626; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">
                        🗑️ Удалить
                    </button>
                </div>
            `;

            if (container.querySelector('p')) {
                container.innerHTML = newRecommendedHtml;
            } else {
                container.insertAdjacentHTML('beforeend', newRecommendedHtml);
            }

            // Закрываем модальное окно
            document.querySelector('.modal-overlay').remove();
        },
        // Удалить рекомендуемый товар по индексу
        removeRecommended(index) {
            const container = document.getElementById('recommendedContainer');
            const items = container.querySelectorAll('.recommended-item');
            
            if (items[index]) {
                items[index].remove();
            }

            // Если товаров не осталось, показываем заглушку
            if (container.querySelectorAll('.recommended-item').length === 0) {
                container.innerHTML = '<p style="color: #999; text-align: center; padding: 2rem;">Нет рекомендуемых товаров. Нажмите "➕ Добавить"</p>';
            }
        },

        // Отрисовка редактора подгрупп
        renderSubgroupsEditor(product) {
            // Подгруппы загружаются асинхронно после открытия формы
            return '<p style="color: #999; text-align: center; padding: 2rem;">Загрузка подгрупп...</p>';
        },

        // Загрузка и отрисовка подгрупп
        async loadAndRenderSubgroups(productId) {
            try {
                const response = await fetch(`/api/products?parent_product_id=${productId}`);
                const result = await response.json();
                const subgroups = (result.ok && Array.isArray(result.data)) ? result.data : 
                                 (result.success && Array.isArray(result.data)) ? result.data : [];

                const container = document.getElementById('subgroupsContainer');
                if (!container) return;

                if (subgroups.length === 0) {
                    container.innerHTML = '<p style="color: #999; text-align: center; padding: 2rem;">Нет подгрупп. Нажмите "➕ Добавить подгруппу"</p>';
                    return;
                }

                container.innerHTML = subgroups.map((subgroup, index) => `
                    <div class="subgroup-item" data-subgroup-id="${subgroup.id}" style="background: #f9fafb; padding: 1rem; border-radius: 8px; margin-bottom: 0.75rem; border: 2px solid #e5e7eb;">
                        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 1rem; align-items: center;">
                            <div>
                                <label style="display: block; margin-bottom: 0.25rem; font-size: 0.85rem; font-weight: 600; color: #666;">Название подгруппы:</label>
                                <input type="text" class="subgroup-name" value="${this.escapeHtml(subgroup.name || '')}" 
                                       placeholder="Например: Пицца 25см"
                                       style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px;">
                            </div>
                            <div>
                                <label style="display: block; margin-bottom: 0.25rem; font-size: 0.85rem; font-weight: 600; color: #666;">Цена (₽):</label>
                                <input type="number" class="subgroup-price" value="${subgroup.price || 0}" step="0.01"
                                       style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px;">
                            </div>
                            <div>
                                <label style="display: block; margin-bottom: 0.25rem; font-size: 0.85rem; font-weight: 600; color: #666;">SKU:</label>
                                <input type="text" class="subgroup-sku" value="${this.escapeHtml(subgroup.sku || '')}" 
                                       placeholder="Артикул"
                                       style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px;">
                            </div>
                            <div style="padding-top: 1.5rem; display: flex; gap: 0.5rem;">
                                <button onclick="ProductCardsManager.editSubgroup(${subgroup.id})"
                                        style="padding: 0.5rem 0.75rem; background: var(--dandy-green); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">
                                    ✏️
                                </button>
                                <button onclick="ProductCardsManager.removeSubgroup(${subgroup.id})"
                                        style="padding: 0.5rem 0.75rem; background: #dc2626; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">
                                    🗑️
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('');
            } catch (error) {
                console.error('Ошибка загрузки подгрупп:', error);
                container.innerHTML = '<p style="color: #dc2626; text-align: center; padding: 2rem;">Ошибка загрузки подгрупп</p>';
            }
        },

        // Добавить подгруппу
        async addSubgroup(parentProductId) {
            const name = prompt('Введите название подгруппы:');
            if (!name || !name.trim()) return;

            const priceInput = prompt('Введите цену подгруппы (₽):', '0');
            const price = parseFloat(priceInput) || 0;

            const skuInput = prompt('Введите SKU (артикул) подгруппы (опционально):', '');
            const sku = skuInput ? skuInput.trim() : '';

            try {
                const response = await fetch('/api/products', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: name.trim(),
                        price: price,
                        sku: sku || `SUB-${Date.now()}`,
                        parent_product_id: parentProductId,
                        type: 'product',
                        visible_on_site: true,
                        available: true
                    })
                });

                const result = await response.json();
                if (result.ok || result.success) {
                    // Обновляем список подгрупп
                    await this.loadAndRenderSubgroups(parentProductId);
                    alert('✅ Подгруппа создана');
                } else {
                    throw new Error(result.error || 'Ошибка создания подгруппы');
                }
            } catch (error) {
                console.error('Ошибка создания подгруппы:', error);
                alert('❌ Ошибка создания подгруппы: ' + error.message);
            }
        },

        // Редактировать подгруппу
        async editSubgroup(subgroupId) {
            const container = document.querySelector(`[data-subgroup-id="${subgroupId}"]`);
            if (!container) return;

            const nameInput = container.querySelector('.subgroup-name');
            const priceInput = container.querySelector('.subgroup-price');
            const skuInput = container.querySelector('.subgroup-sku');

            const name = nameInput.value.trim();
            const price = parseFloat(priceInput.value) || 0;
            const sku = skuInput.value.trim();

            if (!name) {
                alert('❌ Заполните название подгруппы');
                return;
            }

            try {
                const response = await fetch(`/api/products/${subgroupId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: name,
                        price: price,
                        sku: sku
                    })
                });

                const result = await response.json();
                if (result.ok || result.success) {
                    alert('✅ Подгруппа обновлена');
                    // Обновляем список товаров
                    await this.loadProducts();
                } else {
                    throw new Error(result.error || 'Ошибка обновления подгруппы');
                }
            } catch (error) {
                console.error('Ошибка обновления подгруппы:', error);
                alert('❌ Ошибка обновления подгруппы: ' + error.message);
            }
        },

        // Удалить подгруппу
        async removeSubgroup(subgroupId) {
            if (!confirm('Удалить подгруппу? Это действие нельзя отменить.')) return;

            try {
                const response = await fetch(`/api/products/${subgroupId}`, {
                    method: 'DELETE'
                });

                const result = await response.json();
                if (result.ok || result.success) {
                    // Удаляем элемент из DOM
                    const container = document.querySelector(`[data-subgroup-id="${subgroupId}"]`);
                    if (container) {
                        container.remove();
                    }

                    // Если подгрупп не осталось, показываем заглушку
                    const subgroupsContainer = document.getElementById('subgroupsContainer');
                    if (subgroupsContainer && subgroupsContainer.querySelectorAll('.subgroup-item').length === 0) {
                        subgroupsContainer.innerHTML = '<p style="color: #999; text-align: center; padding: 2rem;">Нет подгрупп. Нажмите "➕ Добавить подгруппу"</p>';
                    }

                    alert('✅ Подгруппа удалена');
                    // Обновляем список товаров
                    await this.loadProducts();
                    // Обновляем список подгрупп в модальном окне
                    const parentItem = container.closest('.modal-overlay');
                    if (parentItem) {
                        const saveBtn = parentItem.querySelector('button[onclick*="saveEditedProduct"]');
                        if (saveBtn) {
                            const match = saveBtn.getAttribute('onclick').match(/saveEditedProduct\('(\d+)'\)/);
                            if (match) {
                                await this.loadAndRenderSubgroups(match[1]);
                            }
                        }
                    }
                } else {
                    throw new Error(result.error || 'Ошибка удаления подгруппы');
                }
            } catch (error) {
                console.error('Ошибка удаления подгруппы:', error);
                alert('❌ Ошибка удаления подгруппы: ' + error.message);
            }
        },

        // Удалить рекомендуемый товар по элементу
        removeRecommendedByElement(button) {
            const item = button.closest('.recommended-item');
            const container = document.getElementById('recommendedContainer');
            
            if (item) {
                item.remove();
            }

            // Если товаров не осталось, показываем заглушку
            if (container.querySelectorAll('.recommended-item').length === 0) {
                container.innerHTML = '<p style="color: #999; text-align: center; padding: 2rem;">Нет рекомендуемых товаров. Нажмите "➕ Добавить"</p>';
            }
        },

        // Показать окно массовой загрузки фото
        showBulkPhotoUpload() {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.7); display: flex; align-items: center;
                justify-content: center; z-index: 10000; padding: 1rem;
            `;

            modal.innerHTML = `
                <div style="background: white; border-radius: 16px; padding: 2rem; max-width: 800px; width: 95%; max-height: 90vh; overflow-y: auto;">
                    <h2 style="margin: 0 0 1.5rem 0; color: var(--dandy-green); display: flex; align-items: center; gap: 0.5rem;">
                        📸 Массовая загрузка фото
                    </h2>

                    <div style="margin-bottom: 1.5rem;">
                        <h3 style="color: var(--dandy-green); margin-bottom: 1rem; font-size: 1.1rem;">Выберите режим фото:</h3>
                        <div style="display: flex; gap: 1rem;">
                            <label style="flex: 1; display: flex; align-items: center; gap: 0.5rem; padding: 1rem; background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 8px; cursor: pointer;">
                                <input type="radio" name="photoMode" value="with_background" checked style="width: 20px; height: 20px;">
                                <div>
                                    <div style="font-weight: 600;">С фоном</div>
                                    <div style="font-size: 0.85rem; color: #666;">Обычные фото товаров</div>
                                </div>
                            </label>
                            <label style="flex: 1; display: flex; align-items: center; gap: 0.5rem; padding: 1rem; background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 8px; cursor: pointer;">
                                <input type="radio" name="photoMode" value="no_background" style="width: 20px; height: 20px;">
                                <div>
                                    <div style="font-weight: 600;">Без фона (PNG)</div>
                                    <div style="font-size: 0.85rem; color: #666;">Прозрачный фон для каталога</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div style="margin-bottom: 1.5rem;">
                        <h3 style="color: var(--dandy-green); margin-bottom: 1rem; font-size: 1.1rem;">Выберите файлы:</h3>
                        <div id="dropZone" style="border: 3px dashed var(--dandy-green); border-radius: 12px; padding: 3rem; text-align: center; cursor: pointer; background: #f9fafb; transition: all 0.3s;"
                             onclick="document.getElementById('bulkPhotoInput').click()"
                             ondragover="event.preventDefault(); this.style.background='#e0f2f1'; this.style.borderColor='var(--dandy-pink)';"
                             ondragleave="this.style.background='#f9fafb'; this.style.borderColor='var(--dandy-green)';"
                             ondrop="ProductCardsManager.handlePhotoDrop(event)">
                            <div style="font-size: 3rem; margin-bottom: 1rem;">📷</div>
                            <div style="font-size: 1.2rem; font-weight: 600; margin-bottom: 0.5rem;">Перетащите файлы сюда</div>
                            <div style="color: #666; margin-bottom: 1rem;">или нажмите для выбора</div>
                            <div style="font-size: 0.85rem; color: #999;">
                                Поддерживаются форматы: JPG, PNG, WEBP<br>
                                Имена файлов должны совпадать с SKU товаров
                            </div>
                        </div>
                        <input type="file" id="bulkPhotoInput" multiple accept="image/*" 
                               onchange="ProductCardsManager.handlePhotoSelect(event)"
                               style="display: none;">
                    </div>

                    <div id="photoPreviewList" style="margin-bottom: 1.5rem; max-height: 300px; overflow-y: auto;"></div>

                    <div style="display: flex; gap: 1rem;">
                        <button onclick="ProductCardsManager.uploadBulkPhotos()" 
                                id="uploadPhotosBtn"
                                style="flex: 1; padding: 1rem; background: var(--dandy-green); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 16px;"
                                disabled>
                            📤 Загрузить фото
                        </button>
                        <button onclick="this.closest('.modal-overlay').remove()" 
                                style="flex: 1; padding: 1rem; background: #6b7280; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                            ❌ Отмена
                        </button>
                    </div>

                    <div style="margin-top: 1rem; padding: 1rem; background: #fef3c7; border-radius: 8px;">
                        <div style="font-weight: 600; margin-bottom: 0.5rem;">💡 Инструкция:</div>
                        <ol style="margin: 0; padding-left: 1.5rem; font-size: 0.9rem;">
                            <li>Назовите файлы по SKU товаров (например: <code>SKU-001.jpg</code>)</li>
                            <li>Выберите режим фото (с фоном или без)</li>
                            <li>Загрузите файлы (drag & drop или выбор)</li>
                            <li>Проверьте соответствие и нажмите "Загрузить"</li>
                        </ol>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.remove();
            });

            // Инициализируем переменные для хранения файлов
            this.selectedPhotos = [];
        },

        // Обработка drag & drop
        handlePhotoDrop(event) {
            event.preventDefault();
            const dropZone = event.currentTarget;
            dropZone.style.background = '#f9fafb';
            dropZone.style.borderColor = 'var(--dandy-green)';
            
            const files = Array.from(event.dataTransfer.files).filter(file => 
                file.type.startsWith('image/')
            );
            
            this.processPhotoFiles(files);
        },

        // Обработка выбора файлов
        handlePhotoSelect(event) {
            const files = Array.from(event.target.files);
            this.processPhotoFiles(files);
        },

        // Обработка файлов фото
        processPhotoFiles(files) {
            this.selectedPhotos = files;
            
            const previewList = document.getElementById('photoPreviewList');
            const uploadBtn = document.getElementById('uploadPhotosBtn');
            
            if (files.length === 0) {
                previewList.innerHTML = '';
                uploadBtn.disabled = true;
                return;
            }

            uploadBtn.disabled = false;

            let html = '<h3 style="color: var(--dandy-green); margin-bottom: 1rem;">Выбранные файлы:</h3>';
            
            files.forEach((file, index) => {
                // Извлекаем SKU из имени файла
                const fileName = file.name.split('.')[0];
                const matchingProduct = this.products.find(p => 
                    p.sku && p.sku.toLowerCase() === fileName.toLowerCase()
                );

                html += `
                    <div style="display: flex; align-items: center; gap: 1rem; padding: 0.75rem; background: ${matchingProduct ? '#d1fae5' : '#fef2f2'}; border-radius: 8px; margin-bottom: 0.5rem; border: 2px solid ${matchingProduct ? '#10b981' : '#ef4444'};">
                        <div style="font-size: 2rem;">${matchingProduct ? '✅' : '❌'}</div>
                        <div style="flex: 1;">
                            <div style="font-weight: 600;">${file.name}</div>
                            <div style="font-size: 0.85rem; color: #666;">
                                ${matchingProduct ? `Товар: ${matchingProduct.name}` : 'Товар не найден! Проверьте SKU'}
                            </div>
                        </div>
                        <div style="font-size: 0.85rem; color: #666;">
                            ${(file.size / 1024).toFixed(2)} KB
                        </div>
                    </div>
                `;
            });

            previewList.innerHTML = html;
        },
        // Загрузить фото
        async uploadBulkPhotos() {
            if (!this.selectedPhotos || this.selectedPhotos.length === 0) {
                alert('Выберите файлы для загрузки');
                return;
            }

            const photoMode = document.querySelector('input[name="photoMode"]:checked').value;
            const uploadBtn = document.getElementById('uploadPhotosBtn');
            
            uploadBtn.disabled = true;
            uploadBtn.textContent = '⏳ Загрузка...';

            try {
                let uploaded = 0;
                let failed = 0;

                for (const file of this.selectedPhotos) {
                    const fileName = file.name.split('.')[0];
                    const product = this.products.find(p => 
                        p.sku && p.sku.toLowerCase() === fileName.toLowerCase()
                    );

                    if (!product) {
                        failed++;
                        continue;
                    }

                    // В реальной реализации здесь был бы FormData и загрузка на сервер
                    // Для демонстрации просто создаём URL и обновляем товар
                    const imageUrl = URL.createObjectURL(file);

                    const response = await fetch(`/api/products/${product.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            image_url: imageUrl, // В реальности здесь был бы URL загруженного файла
                            photo_mode: photoMode
                        })
                    });

                    if (response.ok) {
                        uploaded++;
                    } else {
                        failed++;
                    }
                }

                alert(`✅ Загрузка завершена!\n\n` +
                      `Успешно: ${uploaded}\n` +
                      `Ошибок: ${failed}\n\n` +
                      `💡 В продакшн-версии фото будут загружаться на сервер`);

                document.querySelector('.modal-overlay').remove();
                await this.loadProducts();

            } catch (error) {
                console.error('Bulk photo upload error:', error);
                alert('❌ Ошибка при загрузке фото');
                uploadBtn.disabled = false;
                uploadBtn.textContent = '📤 Загрузить фото';
            }
        },

        // Модальное окно добавления товара (интерфейс из import react.txt)
        showAddProductModal() {
            if (this.addProductModalOverlay) {
                this.closeAddProductModal();
            }

            this.addProductModalOverlay = document.createElement('div');
            this.addProductModalOverlay.className = 'modal-overlay';
            this.addProductModalOverlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 2rem;';

            const modal = document.createElement('div');
            modal.className = 'pcm-modal';
            modal.style.cssText = 'width: min(1200px, 100%); max-height: 95vh; background: rgba(255,255,255,0.95); border-radius: 24px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 30px 80px rgba(0,0,0,0.35);';

            modal.innerHTML = `
                <div class="pcm-modal-header" style="padding: 20px 28px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(0,0,0,0.08);">
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        <h2 style="margin: 0; font-size: 24px; font-weight: 700; color: var(--dandy-green);">➕ Добавить товары</h2>
                        <p style="margin: 0; font-size: 14px; color: #6b7280;">Загрузите фото, импортируйте меню или создайте товары вручную</p>
                    </div>
                    <button type="button" class="pcm-close" style="background: rgba(15,118,110,0.08); border: none; color: var(--dandy-green); width: 42px; height: 42px; border-radius: 50%; font-size: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">&times;</button>
                </div>
                <div class="pcm-modal-body" style="overflow-y: auto; padding: 0; background: linear-gradient(180deg, ${COLORS.bgFrom} 0%, ${COLORS.bgVia} 40%, ${COLORS.bgTo} 100%);"></div>
            `;

            this.addProductModalOverlay.appendChild(modal);
            document.body.appendChild(this.addProductModalOverlay);

            this.addProductModalRoot = modal.querySelector('.pcm-modal-body');

            modal.querySelector('.pcm-close').addEventListener('click', () => this.closeAddProductModal());
            this.addProductModalOverlay.addEventListener('click', (event) => {
                if (event.target === this.addProductModalOverlay) {
                    this.closeAddProductModal();
                }
            });

            this.renderAddProductModal();
        },

        closeAddProductModal() {
            if (this.addProductModalOverlay) {
                this.addProductModalOverlay.remove();
                this.addProductModalOverlay = null;
                this.addProductModalRoot = null;
            }
            this.closeSegmentationEditor();
        },

        renderAddProductModal() {
            if (!this.addProductModalRoot) return;

            this.ensureAddProductStyles();

            this.addProductModalRoot.innerHTML = `
                <div style="padding: 32px 32px 48px 32px; min-height: 70vh;">
                    <div style="max-width: 1100px; margin: 0 auto;">
                        ${this.renderModalHeader()}
                        ${this.renderModalControls()}
                        ${this.renderManualForm()}
                        ${this.renderUploadPanel()}
                        ${this.renderDraftsGrid()}
                        ${this.renderGrid()}
                                </div>
                </div>
            `;

            this.attachAddProductHandlers();
        },

        renderModalHeader() {
            return `
                <div style="text-align: center; margin-bottom: 32px;">
                    <h1 style="font-size: 36px; font-weight: 800; color: white; margin-bottom: 12px;">DANDY Полная Витрина</h1>
                    <p style="margin: 0; font-size: 16px; color: rgba(255,255,255,0.75);">Импортируйте меню, создавайте карточки и очищайте фон одним кликом</p>
                                    </div>
            `;
        },

        renderModalControls() {
            return `
                <div style="margin-bottom: 28px; padding: 16px 20px; border-radius: 16px; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.15); display: flex; flex-wrap: wrap; gap: 16px; align-items: center; justify-content: space-between;">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <span style="color: rgba(255,255,255,0.9); font-weight: 600;">Товаров в каталоге: ${this.products.length}</span>
                        ${this.menuMeta ? `<span style="color: rgba(255,255,255,0.65); font-size: 13px;">Последний импорт: ${this.menuMeta.file} (${this.menuMeta.count})</span>` : ''}
                                    </div>
                    <label style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 999px; background: rgba(255,255,255,0.14); color: rgba(255,255,255,0.85); font-size: 14px; cursor: pointer;">
                        <input type="checkbox" id="pcmBgRemovalToggle" ${this.bgRemovalEnabled ? 'checked' : ''} style="width: 18px; height: 18px;">
                        Автоудаление фона (smartCut)
                                    </label>
                    <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                        <button id="pcmUploadImagesBtn" style="padding: 10px 20px; border-radius: 12px; font-weight: 600; background: ${COLORS.accentBtn}; border: none; color: #09342f; cursor: pointer; transition: all 0.2s;">📷 Фото (до 64)</button>
                        <input type="file" id="pcmImageInput" accept="image/jpeg,image/png,image/webp" multiple hidden>
                        <button id="pcmUploadMenuBtn" style="padding: 10px 20px; border-radius: 12px; font-weight: 600; background: ${COLORS.accentBtn}; border: none; color: #09342f; cursor: pointer; transition: all 0.2s;">📄 Импорт (CSV/YML)</button>
                        <input type="file" id="pcmMenuInput" accept=".yml,.yaml,.json,.csv,application/json,text/yaml,text/csv" hidden>
                                </div>
                            </div>
            `;
        },

        renderManualForm() {
            const categoriesMarkup = this.categories.length
                ? this.categories.map(cat => `
                        <label style="display: flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 10px; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.18); cursor: pointer;">
                            <input type="checkbox" value="${cat.id}" class="manual-category-checkbox" style="width: 16px; height: 16px;">
                            <span style="font-size: 13px; color: rgba(255,255,255,0.9);">${this.escapeHtml(cat.name)}</span>
                        </label>
                    `).join('')
                : '<div style="font-size: 13px; color: rgba(255,255,255,0.7);">Категории не загружены. Можно указать позже в таблице.</div>';

            return `
                <div style="margin-bottom: 32px; padding: 24px; border-radius: 20px; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.15);">
                    <h3 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: white; display: flex; align-items: center; gap: 8px;">
                        <span>📝 Ручное добавление товара</span>
                        <small style="font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.65);">(быстрое создание без импорта)</small>
                    </h3>
                    <form id="manualProductForm" style="display: grid; gap: 16px;">
                        <div style="display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
                            <label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: rgba(255,255,255,0.8);">
                                Название *
                                <input type="text" id="manualName" name="manualName" required placeholder="Например, Пицца Карбонара"
                                    style="padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.08); color: white;">
                            </label>
                            <label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: rgba(255,255,255,0.8);">
                                SKU / Артикул *
                                <input type="text" id="manualSku" name="manualSku" required placeholder="SKU-001"
                                    style="padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.08); color: white;">
                            </label>
                            <label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: rgba(255,255,255,0.8);">
                                Цена (₽)
                                <input type="number" id="manualPrice" name="manualPrice" min="0" step="0.01" placeholder="450"
                                    style="padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.08); color: white;">
                            </label>
                            <label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: rgba(255,255,255,0.8);">
                                Себестоимость (₽)
                                <input type="number" id="manualCost" name="manualCost" min="0" step="0.01" placeholder="220"
                                    style="padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.08); color: white;">
                            </label>
                            <label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: rgba(255,255,255,0.8);">
                                Вес / Размер
                                <input type="text" id="manualWeight" name="manualWeight" placeholder="550 г"
                                    style="padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.08); color: white;">
                            </label>
                            <label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: rgba(255,255,255,0.8);">
                                Калории
                                <input type="text" id="manualCalories" name="manualCalories" placeholder="850 ккал"
                                    style="padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.08); color: white;">
                            </label>
                            <label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: rgba(255,255,255,0.8);">
                                Остаток на складе
                                <input type="number" id="manualStock" name="manualStock" min="0" step="1" placeholder="0"
                                    style="padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.08); color: white;">
                            </label>
                        </div>
                        
                        <label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: rgba(255,255,255,0.8);">
                            Краткое описание
                            <textarea id="manualShortDesc" name="manualShortDesc" rows="2" placeholder="Короткий тизер блюда"
                                style="padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.08); color: white; font-family: inherit;"></textarea>
                                    </label>

                        <label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: rgba(255,255,255,0.8);">
                            Полное описание
                            <textarea id="manualFullDesc" name="manualFullDesc" rows="3" placeholder="Подробное описание блюда"
                                style="padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.08); color: white; font-family: inherit;"></textarea>
                        </label>

                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <span style="font-size: 13px; color: rgba(255,255,255,0.8);">Изображение товара</span>
                            <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
                                <label style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: 10px; background: ${COLORS.accentBtn}; color: #09342f; font-weight: 600; cursor: pointer; transition: all 0.2s;">
                                    📷 Выбрать файл (PNG/JPG)
                                    <input type="file" id="manualImageFile" accept="image/png,image/jpeg,image/jpg,image/webp" hidden style="display: none;">
                                </label>
                                <span id="manualImageFileName" style="font-size: 12px; color: rgba(255,255,255,0.7);">Файл не выбран</span>
                                <img id="manualImagePreview" src="" alt="Превью" style="max-width: 100px; max-height: 100px; border-radius: 8px; display: none; object-fit: contain; background: rgba(255,255,255,0.1);">
                            </div>
                            <label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: rgba(255,255,255,0.8);">
                                Или URL изображения
                                <input type="url" id="manualImage" name="manualImage" placeholder="https://example.com/pizza.jpg"
                                    style="padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.18); background: rgba(255,255,255,0.08); color: white;">
                            </label>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-size: 13px; color: rgba(255,255,255,0.8);">Категории</span>
                                <button type="button" id="createCategoryFromProductBtn" style="padding: 6px 12px; border-radius: 8px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; font-size: 12px; cursor: pointer; font-weight: 600;">➕ Новая категория</button>
                            </div>
                            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                ${categoriesMarkup}
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 16px; flex-wrap: wrap;">
                            <label style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 999px; background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.85); font-size: 13px;">
                                <input type="checkbox" id="manualVisible" name="manualVisible" checked style="width: 16px; height: 16px;">
                                Видимый на сайте
                            </label>
                            <label style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 999px; background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.85); font-size: 13px;">
                                <input type="checkbox" id="manualHiddenPromo" name="manualHiddenPromo" style="width: 16px; height: 16px;">
                                Скрыт для акций
                            </label>
                                </div>

                        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                            <button type="submit" id="manualSubmitBtn" style="padding: 10px 22px; border-radius: 12px; border: none; background: #10b981; color: white; font-weight: 700; cursor: pointer;">💾 Сохранить товар</button>
                            <button type="reset" style="padding: 10px 22px; border-radius: 12px; border: none; background: rgba(255,255,255,0.15); color: rgba(255,255,255,0.9); font-weight: 600; cursor: pointer;">Очистить форму</button>
                                </div>
                        <div id="manualFormStatus" style="font-size: 13px; color: rgba(255,255,255,0.75);"></div>
                    </form>
                            </div>
            `;
        },

        renderUploadPanel() {
            if (!this.drafts.length && !this.isProcessing) return '';

            return `
                <div style="margin-bottom: 32px; padding: 24px; border-radius: 20px; background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.2);">
                    ${this.isProcessing ? `
                        <div style="margin-bottom: 18px; padding: 14px 16px; border-radius: 12px; background: rgba(59,130,246,0.18); border: 1px solid rgba(59,130,246,0.35); display: flex; align-items: center; gap: 12px; color: white;">
                            <span class="pcm-spinner" style="width: 22px; height: 22px; border: 3px solid rgba(255,255,255,0.35); border-top-color: white; border-radius: 50%; display: inline-block; animation: pcm-spin 0.7s linear infinite;"></span>
                            Обработка изображений / Импорт меню...
                                </div>
                    ` : ''}
                    ${this.drafts.length ? `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px;">
                            <h3 style="margin: 0; color: rgba(255,255,255,0.9); font-size: 18px; font-weight: 600;">Черновики (${this.drafts.length})</h3>
                            <div style="display: flex; gap: 10px;">
                                <button id="pcmPublishDraftsBtn" style="padding: 10px 18px; border-radius: 10px; border: none; background: #10b981; color: white; font-weight: 600; cursor: pointer;">🚀 Опубликовать всё</button>
                                <button id="pcmClearDraftsBtn" style="padding: 10px 18px; border-radius: 10px; border: none; background: rgba(239,68,68,0.9); color: white; font-weight: 600; cursor: pointer;">🗑️ Очистить</button>
                                </div>
                            </div>
                    ` : ''}
                        </div>
            `;
        },

        renderDraftsGrid() {
            if (!this.drafts.length) {
                return `
                    <div style="padding: 40px 24px; text-align: center; border-radius: 16px; background: rgba(255,255,255,0.12); border: 1px dashed rgba(255,255,255,0.25); color: rgba(255,255,255,0.7);">
                        Загрузите фото или импортируйте меню, чтобы создать черновики товаров.
                                    </div>
                `;
            }

            return `
                <div style="display: grid; gap: 18px; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));">
                    ${this.drafts.map(draft => this.renderDraftCard(draft)).join('')}
                                    </div>
            `;
        },

        renderGrid() {
            if (!this.products.length) {
                return `
                    <div style="margin-top: 32px; padding: 36px 24px; border-radius: 18px; background: rgba(255,255,255,0.08); border: 1px dashed rgba(255,255,255,0.2); text-align: center; color: rgba(255,255,255,0.75);">
                        <svg style="width: 72px; height: 72px; margin-bottom: 12px; color: rgba(255,255,255,0.4);" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        <h3 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 600;">Каталог пуст</h3>
                        <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.6);">Добавьте товары через загрузку фото или импорт меню.</p>
                                </div>
                `;
            }

            return `
                <div style="margin-top: 36px;">
                    <h2 style="font-size: 30px; font-weight: 700; color: white; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.18); padding-bottom: 12px;">Основной каталог</h2>
                    <div style="display: grid; gap: 22px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));">
                        ${this.products.map(product => this.renderVitrinaCard(product)).join('')}
                                </div>
                            </div>
            `;
        },

        renderVitrinaCard(product) {
            const safe = (value) => {
                const div = document.createElement('div');
                div.textContent = value ?? '';
                return div.innerHTML;
            };

            const description = safe(product.description || product.short_description);
            const title = safe(product.name || product.title || 'Товар без названия');
            const ingredients = Array.isArray(product.ingredients) ? product.ingredients.filter(Boolean) : [];
            const allergens = Array.isArray(product.allergens) ? product.allergens.filter(Boolean) : [];

            return `
                <div style="padding: 18px; border-radius: 18px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); backdrop-filter: blur(6px); display: flex; flex-direction: column; gap: 12px; transition: transform 0.2s ease, box-shadow 0.2s ease;">
                    <div style="position: relative; width: 100%; aspect-ratio: 4 / 3; border-radius: 14px; overflow: hidden; background: #f5f5f5; display: flex; align-items: center; justify-content: center;">
                        ${product.image_url ? `<img src="${product.image_url}" alt="${title}" style="max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; display: block;">` : `<div style="color: #999; font-size: 14px;">нет изображения</div>`}
                            </div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <h3 style="margin: 0; font-size: 20px; font-weight: 700; color: white; line-height: 1.2;">${title}</h3>
                        ${description ? `<p style="margin: 0; font-size: 14px; color: ${COLORS.textMuted};">${description}</p>` : ''}
                        <div style="display: flex; gap: 12px; font-size: 13px; color: rgba(255,255,255,0.75);">
                            ${product.weight ? `<span>${safe(product.weight)}</span>` : ''}
                            ${product.calories ? `<span>${safe(product.calories)}</span>` : ''}
                        </div>
                        ${ingredients.length ? `<div style="font-size: 12px; color: rgba(255,255,255,0.65);">Состав: ${ingredients.map(safe).join(', ')}</div>` : ''}
                        ${allergens.length ? `<div style="font-size: 12px; color: #fca5a5;">Может содержать: ${allergens.map(safe).join(', ')}</div>` : ''}
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <span style="font-size: 26px; font-weight: 800; color: transparent; background-image: linear-gradient(135deg, #fb7185, #ec4899); -webkit-background-clip: text;">от ${Number(product.price || 0).toLocaleString('ru-RU')} ₽</span>
                        <button type="button" style="padding: 10px 18px; border-radius: 14px; border: none; background: ${COLORS.accentBtn}; color: #0f172a; font-weight: 700; cursor: pointer;">В корзину</button>
                    </div>
                </div>
            `;
        },

        renderDraftCard(draft) {
            const safe = (value) => {
                const div = document.createElement('div');
                div.textContent = value ?? '';
                return div.innerHTML;
            };

            return `
                <div style="padding: 16px; border-radius: 18px; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.18);">
                    <div style="position: relative; aspect-ratio: 1; margin-bottom: 12px; border-radius: 14px; overflow: hidden; background: ${draft.hasBgRemoved ? 'transparent' : '#f5f5f5'}; ${draft.hasBgRemoved ? CHECKER_CSS : ''} display: flex; align-items: center; justify-content: center;">
                        ${draft.image ? `<img src="${draft.image}" alt="${safe(draft.title)}" style="max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; display: block;">` : `<div style="color: #999; font-size: 14px;">нет изображения</div>`}
                        ${draft.isProcessing ? `<div style="position: absolute; inset: 0; display: grid; place-items: center; background: rgba(0,0,0,0.45);"><span class="pcm-spinner" style="width: 26px; height: 26px; border: 3px solid rgba(255,255,255,0.45); border-top-color: white; border-radius: 50%; display: inline-block; animation: pcm-spin 0.7s linear infinite;"></span></div>` : ''}
                        ${draft.hasBgRemoved && !draft.isProcessing ? `<div style="position: absolute; top: 10px; right: 10px; background: ${COLORS.pink}; color: white; font-size: 11px; padding: 4px 8px; border-radius: 999px; font-weight: 600;">Фон удалён</div>` : ''}
                        </div>
                    <input value="${safe(draft.title)}" placeholder="Название" onchange="window.ProductCardsManager.updateDraft('${draft.id}', { title: this.value })" style="width: 100%; border: none; border-bottom: 1px solid rgba(255,255,255,0.2); background: transparent; padding: 6px 0; color: white; font-weight: 600; margin-bottom: 6px;">
                    <textarea rows="2" placeholder="Описание" onchange="window.ProductCardsManager.updateDraft('${draft.id}', { description: this.value })" style="width: 100%; border: none; border-bottom: 1px solid rgba(255,255,255,0.2); background: transparent; padding: 6px 0; color: rgba(255,255,255,0.8); font-size: 13px; resize: vertical; margin-bottom: 8px;">${safe(draft.description)}</textarea>
                    <div style="display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 6px; margin-bottom: 10px;">
                        <input value="${safe(draft.category)}" placeholder="Категория" onchange="window.ProductCardsManager.updateDraft('${draft.id}', { category: this.value })" style="padding: 6px 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.08); color: white; font-size: 13px;">
                        <input value="${draft.price || ''}" placeholder="Цена" onchange="window.ProductCardsManager.updateDraft('${draft.id}', { price: Number(this.value) || 0 })" style="padding: 6px 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.08); color: white; font-size: 13px;">
                        <input value="${safe(draft.weight)}" placeholder="Вес" onchange="window.ProductCardsManager.updateDraft('${draft.id}', { weight: this.value })" style="padding: 6px 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.08); color: white; font-size: 13px;">
                        <input value="${safe(draft.calories)}" placeholder="Ккал" onchange="window.ProductCardsManager.updateDraft('${draft.id}', { calories: this.value })" style="padding: 6px 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.08); color: white; font-size: 13px;">
                        </div>
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        <button type="button" onclick="window.ProductCardsManager.openSegmentationEditor('${draft.id}')" ${draft.isProcessing ? 'disabled' : ''} style="padding: 8px 12px; border-radius: 10px; border: none; background: rgba(79,70,229,0.85); color: white; font-weight: 600; cursor: pointer;">✂️ Выделить объект</button>
                        <button type="button" onclick="window.ProductCardsManager.openDesignPanel('${draft.id}')" ${draft.isProcessing ? 'disabled' : ''} style="padding: 8px 12px; border-radius: 10px; border: none; background: rgba(251, 191, 36, 0.9); color: #1f2937; font-weight: 600; cursor: pointer;">🎨 Дизайн‑панель</button>
                        <button type="button" onclick="window.ProductCardsManager.removeDraft('${draft.id}')" style="padding: 8px 12px; border-radius: 10px; border: none; background: rgba(55,65,81,0.85); color: rgba(255,255,255,0.85); font-weight: 600; cursor: pointer;">🗑️ Удалить</button>
                        </div>
                </div>
            `;
        },

        attachAddProductHandlers() {
            if (!this.addProductModalRoot) return;

            const uploadImagesBtn = this.addProductModalRoot.querySelector('#pcmUploadImagesBtn');
            const imageInput = this.addProductModalRoot.querySelector('#pcmImageInput');
            const uploadMenuBtn = this.addProductModalRoot.querySelector('#pcmUploadMenuBtn');
            const menuInput = this.addProductModalRoot.querySelector('#pcmMenuInput');
            const bgRemovalToggle = this.addProductModalRoot.querySelector('#pcmBgRemovalToggle');
            const publishDraftsBtn = this.addProductModalRoot.querySelector('#pcmPublishDraftsBtn');
            const clearDraftsBtn = this.addProductModalRoot.querySelector('#pcmClearDraftsBtn');

            if (uploadImagesBtn && imageInput) {
                uploadImagesBtn.onclick = () => imageInput.click();
                imageInput.onchange = (event) => {
                    if (event.target.files && event.target.files.length) {
                        this.onImagesSelected(event.target.files);
                        event.target.value = '';
                    }
                };
            }

            if (uploadMenuBtn && menuInput) {
                uploadMenuBtn.onclick = () => menuInput.click();
                menuInput.onchange = async (event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                        await this.onMenuSelected(file);
                        event.target.value = '';
                    }
                };
            }

            if (bgRemovalToggle) {
                bgRemovalToggle.onchange = (event) => {
                    this.bgRemovalEnabled = event.target.checked;
                    console.log('🔘 Автоудаление фона:', this.bgRemovalEnabled ? 'ВКЛЮЧЕНО' : 'ВЫКЛЮЧЕНО');
                };
                console.log('✅ Обработчик чекбокса автоудаления фона подключен');
            } else {
                console.warn('⚠️ Чекбокс автоудаления фона не найден!');
            }

            if (publishDraftsBtn) {
                publishDraftsBtn.onclick = () => this.publishDrafts();
            }

            if (clearDraftsBtn) {
                clearDraftsBtn.onclick = () => this.clearDrafts();
            }

            const manualForm = this.addProductModalRoot.querySelector('#manualProductForm');
            if (manualForm) {
                manualForm.addEventListener('submit', async (event) => {
                    event.preventDefault();
                    await this.handleManualFormSubmit(event);
                });
            }

            // Обработчик загрузки изображения для формы
            const manualImageFile = this.addProductModalRoot.querySelector('#manualImageFile');
            const manualImageFileName = this.addProductModalRoot.querySelector('#manualImageFileName');
            const manualImagePreview = this.addProductModalRoot.querySelector('#manualImagePreview');
            
            if (manualImageFile) {
                manualImageFile.addEventListener('change', async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    
                    manualImageFileName.textContent = file.name;
                    
                    // Показываем превью
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        manualImagePreview.src = e.target.result;
                        manualImagePreview.style.display = 'block';
                    };
                    reader.readAsDataURL(file);
                    
                    // Очищаем URL поле если выбрали файл
                    const manualImageUrl = this.addProductModalRoot.querySelector('#manualImage');
                    if (manualImageUrl) {
                        manualImageUrl.value = '';
                    }
                });
            }
            
            // Обработчик кнопки создания категории из формы товара
            const createCategoryBtn = this.addProductModalRoot.querySelector('#createCategoryFromProductBtn');
            if (createCategoryBtn) {
                createCategoryBtn.addEventListener('click', async () => {
                    const categoryName = prompt('Введите название новой категории:');
                    if (!categoryName || !categoryName.trim()) return;
                    
                    try {
                        const response = await fetch('/api/categories', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                name: categoryName.trim(),
                                show_on_site: true,
                                show_in_nav: true
                            })
                        });
                        
                        const result = await response.json();
                        if (result.success) {
                            await this.loadCategories();
                            // Перерисовываем форму с обновленными категориями
                            this.renderAddProductModal();
                            // Выбираем новую категорию
                            setTimeout(() => {
                                const newCategoryCheckbox = this.addProductModalRoot.querySelector(`.manual-category-checkbox[value="${result.id}"]`);
                                if (newCategoryCheckbox) {
                                    newCategoryCheckbox.checked = true;
                                }
                            }, 100);
                            alert(`✅ Категория "${categoryName}" создана и выбрана!`);
                        } else {
                            throw new Error(result.error || 'Ошибка создания категории');
                        }
                    } catch (error) {
                        console.error('Ошибка создания категории:', error);
                        alert(`❌ Ошибка создания категории: ${error.message}`);
                    }
                });
            }
        },

        async handleManualFormSubmit(event) {
            event.preventDefault();
            const statusEl = this.addProductModalRoot.querySelector('#manualFormStatus');
            const submitBtn = this.addProductModalRoot.querySelector('#manualSubmitBtn');
            
            if (!submitBtn) return;
            
            const name = this.addProductModalRoot.querySelector('#manualName')?.value?.trim();
            const sku = this.addProductModalRoot.querySelector('#manualSku')?.value?.trim();
            
            if (!name || !sku) {
                if (statusEl) {
                    statusEl.textContent = '❌ Заполните название и SKU';
                    statusEl.style.color = '#fecaca';
                }
                return;
            }
            
            submitBtn.disabled = true;
            submitBtn.textContent = '⏳ Сохранение...';
            
            try {
                let imageUrl = '';
                
                // Проверяем загружен ли файл
                const imageFile = this.addProductModalRoot.querySelector('#manualImageFile')?.files?.[0];
                if (imageFile) {
                    // Обрабатываем изображение (автоудаление фона если включено)
                    let imageBlob = imageFile;
                    
                    if (this.bgRemovalEnabled && (imageFile.type === 'image/png' || imageFile.type === 'image/jpeg')) {
                        if (statusEl) {
                            statusEl.textContent = '🔧 Удаление фона...';
                            statusEl.style.color = '#fbbf24';
                        }
                        
                        try {
                            const { cutoutDataUrl } = await this.smartCut(imageFile, { 
                                bgThreshold: 240, 
                                satTol: 18, 
                                feather: 2 
                            });
                            
                            if (cutoutDataUrl) {
                                // Конвертируем data URL в blob
                                const response = await fetch(cutoutDataUrl);
                                imageBlob = await response.blob();
                                
                                // Обновляем превью
                                const preview = this.addProductModalRoot.querySelector('#manualImagePreview');
                                if (preview) {
                                    preview.src = cutoutDataUrl;
                                }
                                
                                if (statusEl) {
                                    statusEl.textContent = '✅ Фон удален';
                                    statusEl.style.color = '#10b981';
                                }
                            }
                        } catch (error) {
                            console.warn('Ошибка автоудаления фона:', error);
                            if (statusEl) {
                                statusEl.textContent = '⚠️ Не удалось удалить фон, используем оригинал';
                                statusEl.style.color = '#fbbf24';
                            }
                        }
                    }
                    
                    // Конвертируем blob в base64 для сохранения
                    const reader = new FileReader();
                    imageUrl = await new Promise((resolve) => {
                        reader.onload = (e) => resolve(e.target.result);
                        reader.readAsDataURL(imageBlob);
                    });
                } else {
                    // Используем URL если файл не выбран
                    imageUrl = this.addProductModalRoot.querySelector('#manualImage')?.value?.trim() || '';
                }
                
                const selectedCategories = Array.from(
                    this.addProductModalRoot.querySelectorAll('.manual-category-checkbox:checked')
                ).map(cb => cb.value);
                
                const productData = {
                    name: name,
                    sku: sku,
                    price: parseFloat(this.addProductModalRoot.querySelector('#manualPrice')?.value || 0),
                    cost: parseFloat(this.addProductModalRoot.querySelector('#manualCost')?.value || 0),
                    weight: this.addProductModalRoot.querySelector('#manualWeight')?.value?.trim() || '',
                    calories: this.addProductModalRoot.querySelector('#manualCalories')?.value?.trim() || '',
                    description: this.addProductModalRoot.querySelector('#manualFullDesc')?.value?.trim() || this.addProductModalRoot.querySelector('#manualShortDesc')?.value?.trim() || '',
                    short_description: this.addProductModalRoot.querySelector('#manualShortDesc')?.value?.trim() || '',
                    full_description: this.addProductModalRoot.querySelector('#manualFullDesc')?.value?.trim() || '',
                    image_url: imageUrl,
                    category_ids: selectedCategories.map(id => parseInt(id)),
                    visible_on_site: this.addProductModalRoot.querySelector('#manualVisible')?.checked ?? true,
                    hidden_for_promo: this.addProductModalRoot.querySelector('#manualHiddenPromo')?.checked ?? false,
                    stock_quantity: parseInt(this.addProductModalRoot.querySelector('#manualStock')?.value || 0)
                };
                
                if (statusEl) {
                    statusEl.textContent = '💾 Сохранение товара...';
                    statusEl.style.color = '#60a5fa';
                }
                
                const result = await this.createProduct(productData);
                
                if (result.success) {
                    if (statusEl) {
                        statusEl.textContent = '✅ Товар успешно создан!';
                        statusEl.style.color = '#10b981';
                    }
                    
                    // Очищаем форму
                    const form = this.addProductModalRoot.querySelector('#manualProductForm');
                    if (form) form.reset();
                    
                    // Сбрасываем превью
                    const preview = this.addProductModalRoot.querySelector('#manualImagePreview');
                    if (preview) {
                        preview.src = '';
                        preview.style.display = 'none';
                    }
                    const fileName = this.addProductModalRoot.querySelector('#manualImageFileName');
                    if (fileName) fileName.textContent = 'Файл не выбран';
                    
                    await this.loadProducts();
                    await this.syncToWebsite(true);
                    
                    setTimeout(() => {
                        if (statusEl) statusEl.textContent = '';
                    }, 3000);
                } else {
                    throw new Error(result.error || 'Ошибка создания товара');
                }
            } catch (error) {
                console.error('Ошибка создания товара:', error);
                if (statusEl) {
                    statusEl.textContent = `❌ Ошибка: ${error.message}`;
                    statusEl.style.color = '#fecaca';
                }
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = '💾 Сохранить товар';
            }
        },
        // Модальное окно импорта CSV/YML
        showImportModal() {
            // Удаляем существующие модальные окна
            const existingModals = document.querySelectorAll('.modal-overlay');
            existingModals.forEach(modal => modal.remove());
            
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content large">
                    <div class="modal-header">
                        <h3>📥 Импорт товаров</h3>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                    </div>
                    <div class="modal-body">
                    <!-- Выбор файла -->
                    <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem;">
                        <h3 style="margin-bottom: 1rem; font-size: 1.1rem; color: var(--dandy-green);">📂 Выбор файла</h3>
                        <input type="file" id="importFile" accept=".csv,.yml,.yaml,.xml,.xlsx,.xls" style="display: none;">
                            <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
                            <button onclick="document.getElementById('importFile').click()" 
                                        class="btn btn-primary" 
                                        style="background: var(--dandy-green); color: #fff; border: none; padding: 0.75rem 1.5rem; border-radius: 10px; cursor: pointer; font-size: 1rem; font-weight: 600; transition: all 0.3s; box-shadow: 0 2px 8px rgba(4, 116, 108, 0.3);" 
                                        onmouseover="this.style.transform='translateY(-2px)'" 
                                        onmouseout="this.style.transform=''">
                                🗂️ Выберите файл
                            </button>
                            <span id="fileName" style="color: #666; font-size: 0.95rem; font-weight: 500;">Файл не выбран</span>
                        </div>
                        <div style="margin-top: 1rem; padding: 0.75rem; background: #e8f5f3; border-radius: 8px; border-left: 3px solid var(--dandy-green);">
                            <p style="margin: 0; font-size: 0.9rem; color: #333;">
                                💡 Поддерживаемые форматы: CSV, YML, XML (до 100 МБ, до 50 000 строк)
                            </p>
                        </div>
                        <div style="margin-top: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            <button onclick="ProductCardsManager.downloadImportTemplate('products')" 
                                    class="btn btn-secondary btn-small" 
                                    style="padding: 0.5rem 1rem; font-size: 0.9rem;">
                                📥 Шаблон товаров
                            </button>
                            <button onclick="ProductCardsManager.downloadImportTemplate('dishes')" 
                                    class="btn btn-secondary btn-small" 
                                    style="padding: 0.5rem 1rem; font-size: 0.9rem;">
                                📥 Шаблон блюд
                            </button>
                            <button onclick="ProductCardsManager.downloadImportTemplate('categories')" 
                                    class="btn btn-secondary btn-small" 
                                    style="padding: 0.5rem 1rem; font-size: 0.9rem;">
                                📥 Шаблон категорий
                            </button>
                            <button onclick="ProductCardsManager.downloadImportTemplate('stock')" 
                                    class="btn btn-secondary btn-small" 
                                    style="padding: 0.5rem 1rem; font-size: 0.9rem;">
                                📥 Шаблон остатков
                            </button>
                        </div>
                        <div style="margin-top: 0.75rem; display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
                            <div style="min-width: 220px;">
                                <label style="display: block; margin-bottom: 0.35rem; font-weight: 600; font-size: 0.9rem;">Счёт учёта</label>
                                <select id="importAccountCode" class="form-input" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 6px;">
                                    <option value="" selected>Авто (из файла)</option>
                                    <option value="10.1">10.1 — Сырьё</option>
                                    <option value="41.1">41.1 — Товары</option>
                                    <option value="43">43 — Блюда</option>
                                    <option value="43_mod">43_mod — Модификаторы</option>
                                </select>
                            </div>
                            <div style="color: #666; font-size: 0.85rem; line-height: 1.2;">
                                Если в файле нет колонки «Тип (Счет)», будет применён выбранный счёт.
                            </div>
                        </div>
                        <div id="importInvoicePanel" style="display: none; margin-top: 1rem; padding: 1rem; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px;">
                            <h4 style="margin: 0 0 0.75rem 0; font-size: 1rem; color: #333;">🧾 Данные накладной (10.1 / 41.1)</h4>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                                <div>
                                    <label style="display: block; margin-bottom: 0.35rem; font-weight: 600; font-size: 0.9rem;">Поставщик</label>
                                    <input id="importSupplierName" class="form-input" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 6px;" placeholder="ИП Иванов" />
                                </div>
                                <div>
                                    <label style="display: block; margin-bottom: 0.35rem; font-weight: 600; font-size: 0.9rem;">Договор</label>
                                    <input id="importContractNumber" class="form-input" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 6px;" placeholder="№3" />
                                </div>
                                <div>
                                    <label style="display: block; margin-bottom: 0.35rem; font-weight: 600; font-size: 0.9rem;">Отсрочка (дней)</label>
                                    <input id="importPaymentTermDays" type="number" min="0" class="form-input" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 6px;" placeholder="7" />
                                </div>
                                <div>
                                    <label style="display: block; margin-bottom: 0.35rem; font-weight: 600; font-size: 0.9rem;">Склад</label>
                                    <select id="importWarehouseId" class="form-input" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 6px;">
                                        <option value="1" selected>Основной склад</option>
                                        <option value="2">Склад №2</option>
                                    </select>
                                </div>
                            </div>
                            <div style="margin-top: 0.5rem; color: #666; font-size: 0.85rem; line-height: 1.2;">
                                Эти значения будут использованы, если в файле нет колонок «Контрагент» / «Договор / Отсрочка».
                            </div>
                        </div>
                        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #dee2e6;">
                            <h4 style="margin-bottom: 0.75rem; font-size: 1rem; color: #333;">📋 Дополнительные формы импорта:</h4>
                            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                                <button onclick="ProductCardsManager.showSpecialImportModal('modifiers')" 
                                        class="btn btn-secondary btn-small" 
                                        style="padding: 0.5rem 1rem; font-size: 0.9rem;">
                                    🎯 Модификаторы
                                </button>
                                <button onclick="ProductCardsManager.showSpecialImportModal('units')" 
                                        class="btn btn-secondary btn-small" 
                                        style="padding: 0.5rem 1rem; font-size: 0.9rem;">
                                    📏 Единицы измерения
                                </button>
                                <button onclick="ProductCardsManager.showSpecialImportModal('prices')" 
                                        class="btn btn-secondary btn-small" 
                                        style="padding: 0.5rem 1rem; font-size: 0.9rem;">
                                    💰 Обновление цен
                                </button>
                                <button onclick="ProductCardsManager.showSpecialImportModal('nutrition')" 
                                        class="btn btn-secondary btn-small" 
                                        style="padding: 0.5rem 1rem; font-size: 0.9rem;">
                                    🥗 Нутриенты
                                </button>
                            </div>
                        </div>
                    </div>
                        
                        <!-- Опции импорта -->
                        <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem;">
                            <h3 style="margin-bottom: 1rem; font-size: 1.1rem; color: var(--dandy-green);">⚙️ Настройки импорта</h3>
                            
                            <!-- Гибкие настройки формата -->
                            <div id="importFormatSettings" style="display: none; margin-bottom: 1rem; padding: 1rem; background: white; border-radius: 8px; border: 1px solid #e5e7eb;">
                                <h4 style="margin-bottom: 0.75rem; font-size: 1rem; color: #333;">📋 Настройки формата файла</h4>
                                
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                                    <div>
                                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; font-size: 0.9rem;">Кодировка</label>
                                        <select id="importEncoding" class="form-input" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 6px;">
                                            <option value="UTF-8" selected>UTF-8 (рекомендуется)</option>
                                            <option value="Windows-1251">Windows-1251 (кириллица)</option>
                                            <option value="CP866">CP866 (DOS)</option>
                                            <option value="ISO-8859-1">ISO-8859-1 (Latin-1)</option>
                                        </select>
                                    </div>
                                    
                                    <div>
                                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; font-size: 0.9rem;">Разделитель</label>
                                        <select id="importDelimiter" class="form-input" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 6px;">
                                            <option value="," selected>Запятая (,)</option>
                                            <option value=";">Точка с запятой (;)</option>
                                            <option value="\t">Табуляция</option>
                                            <option value="|">Вертикальная черта (|)</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div>
                                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; font-size: 0.9rem;">Первая строка данных</label>
                                    <input type="number" id="importStartRow" min="1" value="2" 
                                           style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 6px;"
                                           placeholder="Номер строки, с которой начинаются данные (обычно 2, если первая - заголовки)">
                                    <small style="color: #666; font-size: 0.85rem; display: block; margin-top: 0.25rem;">
                                        💡 Укажите номер строки, с которой начинаются данные. Обычно это 2, если первая строка содержит заголовки.
                                    </small>
                                </div>
                                
                                <button onclick="ProductCardsManager.detectImportSettings()" 
                                        style="margin-top: 0.75rem; padding: 0.5rem 1rem; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem;">
                                    🔍 Автоопределение настроек
                                </button>
                            </div>
                            
                            <div style="margin-bottom: 1rem;">
                                <button onclick="ProductCardsManager.toggleFormatSettings()" 
                                        style="padding: 0.5rem 1rem; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem;">
                                    ⚙️ Дополнительные настройки формата
                                </button>
                            </div>
                            
                            <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; cursor: pointer;">
                                <input type="checkbox" id="updateExisting" style="width: 18px; height: 18px; cursor: pointer;">
                                <span>Обновлять существующие товары (по названию)</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="importHidden" style="width: 18px; height: 18px; cursor: pointer;">
                                <span>Импортировать как скрытые (недоступные для заказа)</span>
                            </label>
                        </div>
                        
                        <!-- Превью -->
                        <div id="importPreview" class="hidden" style="display: none;">
                            <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; color: var(--dandy-green);">Предпросмотр данных:</h3>
                            <div id="importPreviewContent"></div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Отмена</button>
                        <button class="btn btn-primary" id="importBtn" onclick="ProductCardsManager.startImport()" disabled>Импортировать</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Настраиваем обработчик файла
            const importFileInput = document.getElementById('importFile');
            if (importFileInput) {
                importFileInput.addEventListener('click', () => {
                    importFileInput.value = '';
                });
                importFileInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        this.handleFileSelect(file);
                    }
                });
            }
            const updateExistingCheckbox = document.getElementById('updateExisting');
            if (updateExistingCheckbox) {
                updateExistingCheckbox.addEventListener('change', () => {
                    updateExistingCheckbox.dataset.userChanged = '1';
                });
            }

            const accountSelect = document.getElementById('importAccountCode');
            if (accountSelect) {
                const updatePanels = () => {
                    const invoicePanel = document.getElementById('importInvoicePanel');
                    const val = accountSelect.value || '';
                    const showInvoice = (val === '10.1' || val === '41.1');
                    if (invoicePanel) invoicePanel.style.display = showInvoice ? 'block' : 'none';

                    const importBtn = document.getElementById('importBtn');
                    if (importBtn && showInvoice) {
                        const supplierName = document.getElementById('importSupplierName')?.value?.trim() || '';
                        const contractNumber = document.getElementById('importContractNumber')?.value?.trim() || '';
                        const hasRequired = supplierName !== '' && contractNumber !== '';
                        importBtn.disabled = !hasRequired;
                    }
                };
                accountSelect.addEventListener('change', updatePanels);
                updatePanels();
            }

            const invoiceFields = ['importSupplierName', 'importContractNumber', 'importPaymentTermDays', 'importWarehouseId'];
            invoiceFields.forEach((id) => {
                const el = document.getElementById(id);
                if (!el) return;
                el.addEventListener('input', () => {
                    const accountCode = document.getElementById('importAccountCode')?.value || '';
                    if (accountCode !== '10.1' && accountCode !== '41.1') return;
                    const supplierName = document.getElementById('importSupplierName')?.value?.trim() || '';
                    const contractNumber = document.getElementById('importContractNumber')?.value?.trim() || '';
                    const importBtn = document.getElementById('importBtn');
                    if (importBtn) {
                        importBtn.disabled = !(supplierName !== '' && contractNumber !== '');
                    }
                });
            });
            
            // Закрытие по клику вне модала
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
            
            // Фокус на первое поле
            setTimeout(() => {
                const firstInput = modal.querySelector('input, select, textarea, button');
                if (firstInput) {
                    firstInput.focus();
                }
            }, 100);
        },
        // Обработка выбранного файла
        async handleFileSelect(file) {
            if (!file) return;
            
            const fileName = document.getElementById('fileName');
            const importPreview = document.getElementById('importPreview');
            const importPreviewContent = document.getElementById('importPreviewContent');
            const importBtn = document.getElementById('importBtn');
            
            if (fileName) fileName.textContent = file.name;
            
            // Валидация размера файла (до 10 МБ согласно ТЗ)
            const maxSize = 100 * 1024 * 1024; // 100 МБ
            if (file.size > maxSize) {
                alert(`❌ Файл слишком большой (${(file.size / 1024 / 1024).toFixed(2)} МБ). Максимальный размер: 100 МБ`);
                if (importBtn) importBtn.disabled = true;
                return;
            }
            
            // Сохраняем файл для последующего импорта
            this.selectedImportFile = file;
            this.originalImportFile = file;
            
            try {
                // Получаем настройки импорта
                const encoding = document.getElementById('importEncoding')?.value || 'UTF-8';
                const delimiter = document.getElementById('importDelimiter')?.value || ',';
                const startRow = parseInt(document.getElementById('importStartRow')?.value || '2');
                
                // Сохраняем настройки для использования при парсинге
                this.importSettings = { encoding, delimiter, startRow };
                
                const lowerName = (file.name || '').toLowerCase();
                const isExcel = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls');

                let text = '';
                let fileType = lowerName.endsWith('.csv')
                    ? 'csv'
                    : (lowerName.endsWith('.yml') || lowerName.endsWith('.yaml'))
                      ? 'yml'
                      : 'xml';

                const updateExistingToggle = document.getElementById('updateExisting');
                if (updateExistingToggle && !updateExistingToggle.dataset.userChanged) {
                    if (fileType === 'yml' || fileType === 'xml') {
                        updateExistingToggle.checked = true;
                    }
                }

                if (isExcel) {
                    const csvText = await this.convertExcelToCsv(file, delimiter);
                    const csvName = file.name.replace(/\.(xlsx|xls)$/i, '.csv');
                    this.selectedImportFile = new File([csvText], csvName, { type: 'text/csv' });
                    if (fileName) fileName.textContent = csvName;
                    text = csvText;
                    fileType = 'csv';
                } else {
                    text = await this.readFileAsText(file, encoding);
                }
                
                // Валидация количества строк (до 10 000 согласно ТЗ)
                const lineCount = text.split('\n').filter(line => line.trim()).length;
                if (lineCount > 50000) {
                    alert(`⚠️ Файл содержит ${lineCount} строк. Будут обработаны первые 50 000 строк.`);
                }
                
                if (fileType === 'csv') {
                    await this.parseCSVFile(text, delimiter, startRow);
                    // Валидация данных после парсинга
                    this.validateImportData();
                } else if (fileType === 'yml' || fileType === 'xml') {
                    await this.parseYMLFile(text);
                    // Валидация данных после парсинга
                    this.validateImportData();
                } else {
                    alert('❌ Неподдерживаемый формат файла. Используйте CSV, YML или XML');
                    if (importBtn) importBtn.disabled = true;
                    return;
                }
                
                // Показываем превью
                if (importPreview) {
                    importPreview.style.display = 'block';
                    if (importPreviewContent && this.importData) {
                        const previewCount = this.importData.products ? this.importData.products.length : 
                                            this.importData.rows ? this.importData.rows.length : 
                                            this.importData.offers ? this.importData.offers.length : 0;
                        const errors = this.importData.errors || [];
                        
                        importPreviewContent.innerHTML = `
                            <div style="padding: 12px; background: rgba(252, 252, 249, 1); border: 1px solid rgba(94, 82, 64, 0.12); border-radius: 8px; font-size: 14px; color: rgba(19, 52, 59, 1);">
                                Найдено записей: <strong>${previewCount}</strong>
                                ${errors.length > 0 ? `
                                    <div style="margin-top: 8px; padding: 8px; background: #fee2e2; border-radius: 6px; color: #991b1b; font-size: 12px;">
                                        ⚠️ Ошибок валидации: ${errors.length}
                                        <div style="margin-top: 4px; max-height: 100px; overflow-y: auto;">
                                            ${errors.slice(0, 5).map(err => `<div>• ${err}</div>`).join('')}
                                            ${errors.length > 5 ? `<div>... и ещё ${errors.length - 5}</div>` : ''}
                                        </div>
                                    </div>
                                ` : ''}
                                ${this.importData.products && this.importData.products.length > 0 ? `
                                    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(94, 82, 64, 0.12);">
                                        Примеры:
                                        ${this.importData.products.slice(0, 3).map((p, i) => `
                                            <div style="margin-top: 4px; color: rgba(98, 108, 113, 1); font-size: 12px;">${i + 1}. ${p.name || p.sku || 'Без названия'}</div>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    }
                }
                
                // Активируем кнопку импорта только если нет критических ошибок
                if (importBtn) {
                    const criticalErrors = (this.importData.errors || []).filter(e => e.includes('обязательное') || e.includes('пустое'));
                    importBtn.disabled = criticalErrors.length > 0;
                }
                
            } catch (error) {
                console.error('File parsing error:', error);
                alert(`❌ Ошибка при чтении файла: ${error.message || 'Неизвестная ошибка'}`);
                if (importBtn) importBtn.disabled = true;
            }
        },

        // Переключение видимости настроек формата
        toggleFormatSettings() {
            const settingsDiv = document.getElementById('importFormatSettings');
            const button = event?.target || document.querySelector('button[onclick*="toggleFormatSettings"]');
            
            if (settingsDiv) {
                const isVisible = settingsDiv.style.display !== 'none';
                settingsDiv.style.display = isVisible ? 'none' : 'block';
                if (button) {
                    button.textContent = isVisible ? '⚙️ Дополнительные настройки формата' : '❌ Скрыть настройки формата';
                }
            }
        },
        
        // Автоопределение настроек импорта
        async detectImportSettings() {
            if (!this.selectedImportFile) {
                alert('❌ Сначала выберите файл');
                return;
            }
            
            try {
                // Читаем первые несколько строк файла
                const text = await this.readFileAsText(this.selectedImportFile, 'UTF-8');
                const lines = text.split('\n').slice(0, 5).filter(line => line.trim());
                
                if (lines.length === 0) {
                    alert('❌ Файл пуст');
                    return;
                }
                
                // Определяем разделитель
                const firstLine = lines[0];
                let delimiter = ',';
                const delimiterCounts = {
                    ',': (firstLine.match(/,/g) || []).length,
                    ';': (firstLine.match(/;/g) || []).length,
                    '\t': (firstLine.match(/\t/g) || []).length,
                    '|': (firstLine.match(/\|/g) || []).length
                };
                
                const maxCount = Math.max(...Object.values(delimiterCounts));
                if (maxCount > 0) {
                    delimiter = Object.keys(delimiterCounts).find(key => delimiterCounts[key] === maxCount);
                }
                
                // Определяем кодировку (проверяем наличие кириллицы)
                let encoding = 'UTF-8';
                const hasCyrillic = /[а-яё]/i.test(firstLine);
                if (hasCyrillic && !/[^\x00-\x7F]/.test(firstLine.replace(/[а-яё]/gi, ''))) {
                    // Если есть кириллица, но нет других UTF-8 символов, возможно Windows-1251
                    encoding = 'Windows-1251';
                }
                
                // Определяем первую строку данных (ищем строку с данными, не заголовками)
                let startRow = 2; // По умолчанию заголовки в первой строке
                if (lines.length > 1) {
                    const secondLine = lines[1];
                    // Если вторая строка похожа на данные (содержит числа), начинаем с неё
                    if (/\d+/.test(secondLine)) {
                        startRow = 2;
                    } else {
                        // Ищем первую строку с данными
                        for (let i = 1; i < lines.length; i++) {
                            if (/\d+/.test(lines[i])) {
                                startRow = i + 1;
                                break;
                            }
                        }
                    }
                }
                
                // Применяем настройки
                const delimiterSelect = document.getElementById('importDelimiter');
                const encodingSelect = document.getElementById('importEncoding');
                const startRowInput = document.getElementById('importStartRow');
                
                if (delimiterSelect) delimiterSelect.value = delimiter;
                if (encodingSelect) encodingSelect.value = encoding;
                if (startRowInput) startRowInput.value = startRow;
                
                alert(`✅ Настройки определены:\n• Разделитель: ${delimiter === ',' ? 'Запятая' : delimiter === ';' ? 'Точка с запятой' : delimiter === '\t' ? 'Табуляция' : 'Вертикальная черта'}\n• Кодировка: ${encoding}\n• Первая строка данных: ${startRow}`);
                
                // Перечитываем файл с новыми настройками
                if (this.selectedImportFile) {
                    await this.handleFileSelect(this.selectedImportFile);
                }
            } catch (error) {
                console.error('Ошибка автоопределения настроек:', error);
                alert(`❌ Ошибка: ${error.message}`);
            }
        },
        
        // Чтение файла как текст с поддержкой разных кодировок
        readFileAsText(file, encoding = 'UTF-8') {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    let text = e.target.result;
                    
                    // Если кодировка не UTF-8, пытаемся конвертировать
                    if (encoding !== 'UTF-8') {
                        try {
                            // Для Windows-1251 используем TextDecoder если доступен
                            if (typeof TextDecoder !== 'undefined') {
                                const bytes = new Uint8Array(e.target.result.split('').map(c => c.charCodeAt(0)));
                                const decoder = new TextDecoder(encoding);
                                text = decoder.decode(bytes);
                            } else {
                                // Fallback: используем как есть (браузер может автоматически определить)
                                text = e.target.result;
                            }
                        } catch (err) {
                            console.warn('Не удалось конвертировать кодировку, используем как есть:', err);
                        }
                    }
                    
                    resolve(text);
                };
                reader.onerror = reject;
                
                // Читаем как ArrayBuffer для правильной обработки кодировок
                if (encoding !== 'UTF-8' && typeof FileReader.prototype.readAsArrayBuffer !== 'undefined') {
                    const arrayBufferReader = new FileReader();
                    arrayBufferReader.onload = (e) => {
                        try {
                            const bytes = new Uint8Array(e.target.result);
                            // Простая конвертация для Windows-1251 (базовая)
                            let text = '';
                            for (let i = 0; i < bytes.length; i++) {
                                const byte = bytes[i];
                                if (encoding === 'Windows-1251') {
                                    // Базовая таблица Windows-1251 для кириллицы
                                    if (byte >= 0xC0 && byte <= 0xFF) {
                                        text += String.fromCharCode(0x0400 + byte - 0xC0);
                                    } else {
                                        text += String.fromCharCode(byte);
                                    }
                                } else {
                                    text += String.fromCharCode(byte);
                                }
                            }
                            resolve(text);
                        } catch (err) {
                            // Fallback: читаем как текст
                            reader.readAsText(file, encoding);
                        }
                    };
                    arrayBufferReader.onerror = () => reader.readAsText(file, encoding);
                    arrayBufferReader.readAsArrayBuffer(file);
                } else {
                    reader.readAsText(file, encoding);
                }
            });
        },

        // Парсинг CSV файла с валидацией и поддержкой настроек
        async parseCSVFile(text, delimiter = null, startRow = null) {
            const lines = text.split('\n').filter(line => line.trim());
            if (lines.length < 2) {
                alert('❌ CSV файл должен содержать заголовки и хотя бы одну строку данных');
                return;
            }
            
            // Используем настройки из importSettings или параметры
            const settings = this.importSettings || {};
            const usedDelimiter = delimiter || settings.delimiter || ',';
            const usedStartRow = startRow || settings.startRow || 2;
            
            // Определяем строку с заголовками (обычно startRow - 1)
            const headerRowIndex = Math.max(0, usedStartRow - 2); // -2 потому что нумерация с 1, и массив с 0
            const headerLine = lines[headerRowIndex] || lines[0];
            
            // Автоопределение разделителя, если не указан явно
            let finalDelimiter = usedDelimiter;
            if (!delimiter && !settings.delimiter) {
                const delimiterCounts = {
                    ',': (headerLine.match(/,/g) || []).length,
                    ';': (headerLine.match(/;/g) || []).length,
                    '\t': (headerLine.match(/\t/g) || []).length,
                    '|': (headerLine.match(/\|/g) || []).length
                };
                const maxCount = Math.max(...Object.values(delimiterCounts));
                if (maxCount > 0) {
                    finalDelimiter = Object.keys(delimiterCounts).find(key => delimiterCounts[key] === maxCount);
                }
            }
            
            const headers = this.parseCSVLine(headerLine, finalDelimiter).map(h => h.trim().replace(/^"|"$/g, ''));
            
            // Определяем строки данных (начинаем с startRow)
            const dataStartIndex = Math.max(headerRowIndex + 1, usedStartRow - 1);
            const maxRows = 50000;
            const dataLines = lines.slice(dataStartIndex, dataStartIndex + maxRows);
            
            // Парсим строки данных
            const rows = dataLines.map(line => this.parseCSVLine(line, finalDelimiter));
            const errors = [];
            
            // Валидация данных
            rows.forEach((row, index) => {
                const rowNum = index + 2; // +2 потому что первая строка - заголовки, нумерация с 1
                
                // Проверка обязательных полей
                const nameIndex = headers.findIndex(h => ['name', 'название', 'наименование'].includes(h.toLowerCase()));
                const skuIndex = headers.findIndex(h => ['sku', 'артикул', 'код'].includes(h.toLowerCase()));
                
                if (nameIndex >= 0 && (!row[nameIndex] || !row[nameIndex].trim())) {
                    errors.push(`Строка ${rowNum}: пустое название товара`);
                }
                
                if (skuIndex >= 0 && (!row[skuIndex] || !row[skuIndex].trim())) {
                    errors.push(`Строка ${rowNum}: пустой SKU/артикул`);
                }
                
                // Проверка цен
                const priceIndex = headers.findIndex(h => ['price', 'цена'].includes(h.toLowerCase()));
                if (priceIndex >= 0 && row[priceIndex]) {
                    const price = parseFloat(row[priceIndex]);
                    if (isNaN(price) || price < 0) {
                        errors.push(`Строка ${rowNum}: некорректная цена "${row[priceIndex]}"`);
                    }
                }
            });
            
            this.importData = {
                type: 'csv',
                headers: headers,
                rows: rows,
                delimiter: delimiter,
                errors: errors,
                totalRows: rows.length,
                validRows: rows.length - errors.length
            };
            
            if (errors.length > 0) {
                console.warn('Ошибки валидации:', errors);
            }
            
            this.renderFieldMapping();
            this.renderPreview();
        },
        
        // Парсинг CSV строки с учетом кавычек
        parseCSVLine(line, delimiter = ',') {
            const result = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                const nextChar = line[i + 1];
                
                if (char === '"') {
                    if (inQuotes && nextChar === '"') {
                        current += '"';
                        i++; // Пропускаем следующую кавычку
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === delimiter && !inQuotes) {
                    result.push(current);
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current);
            return result;
        },
        // Парсинг YML файла
        async parseYMLFile(text) {
            try {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(text, 'text/xml');
                
                const offers = xmlDoc.querySelectorAll('offer');
                if (offers.length === 0) {
                    alert('❌ YML файл не содержит товаров (теги <offer>)');
                    return;
                }
                
                // Собираем все возможные поля из первого товара
                const firstOffer = offers[0];
                const availableFields = [];
                
                Array.from(firstOffer.children).forEach(child => {
                    if (!availableFields.includes(child.tagName)) {
                        availableFields.push(child.tagName);
                    }
                });
                
                this.importData = {
                    type: 'yml',
                    fields: availableFields,
                    offers: Array.from(offers).map(offer => {
                        const data = {};
                        Array.from(offer.children).forEach(child => {
                            data[child.tagName] = child.textContent;
                        });
                        return data;
                    })
                };
                
                this.renderFieldMapping();
                this.renderPreview();
                
            } catch (error) {
                console.error('YML parsing error:', error);
                alert('❌ Ошибка при парсинге YML файла');
            }
        },

        // Отрисовка сопоставления полей (улучшенная версия)
        renderFieldMapping() {
            const mappingContainer = document.getElementById('fieldMappingContainer');
            if (!mappingContainer) {
                // Создаём контейнер для сопоставления, если его нет
                const previewDiv = document.getElementById('importPreview');
                if (previewDiv && previewDiv.parentNode) {
                    const mappingDiv = document.createElement('div');
                    mappingDiv.id = 'fieldMappingContainer';
                    mappingDiv.style.cssText = 'background: #f8f9fa; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; display: none;';
                    mappingDiv.innerHTML = `
                        <h3 style="margin-bottom: 1rem; font-size: 1.1rem; color: var(--dandy-green);">🔗 Сопоставление полей</h3>
                        <div id="mappingTable" style="overflow-x: auto;"></div>
                        <div style="margin-top: 1rem; padding: 0.75rem; background: #e8f5f3; border-radius: 8px; font-size: 0.9rem; color: #333;">
                            💡 Система автоматически сопоставила поля. Проверьте и при необходимости измените сопоставление вручную.
                        </div>
                    `;
                    previewDiv.parentNode.insertBefore(mappingDiv, previewDiv);
                } else {
                    return; // Не можем создать контейнер
                }
            }
            
            const systemFields = [
                { key: 'name', label: 'Название', required: true, description: 'Обязательное поле' },
                { key: 'type', label: 'Тип', required: false, description: 'product/dish/ingredient' },
                { key: 'sku', label: 'SKU/Артикул', required: false, description: 'Уникальный код товара' },
                { key: 'barcode', label: 'Штрихкод', required: false, description: 'Штрихкод товара' },
                { key: 'price', label: 'Цена продажи', required: false, description: 'Цена в рублях' },
                { key: 'cost', label: 'Себестоимость', required: false, description: 'Себестоимость в рублях' },
                { key: 'description', label: 'Описание', required: false, description: 'Описание товара/блюда' },
                { key: 'category_menu', label: 'Категория меню', required: false, description: 'Категория для сайта' },
                { key: 'category_stock', label: 'Категория номенклатуры', required: false, description: 'Складская категория' },
                { key: 'weight', label: 'Вес/объём', required: false, description: 'Например: 100г, 0.5л' },
                { key: 'calories', label: 'Калорийность', required: false, description: 'Ккал на 100г/порцию' },
                { key: 'image_url', label: 'URL изображения', required: false, description: 'Ссылка на фото' },
                { key: 'status', label: 'Статус', required: false, description: 'active/inactive' },
                { key: 'ingredients', label: 'Ингредиенты (для блюд)', required: false, description: 'Список ингредиентов' },
                { key: 'prep_time', label: 'Время приготовления', required: false, description: 'Минуты' }
            ];
            
            const options = this.importData.type === 'csv' ? this.importData.headers : this.importData.fields;
            if (!options || options.length === 0) return;
            
            let tableHtml = `
                <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden;">
                    <thead>
                        <tr style="background: var(--dandy-green); color: white;">
                            <th style="padding: 12px; text-align: left; font-weight: 600;">Системное поле</th>
                            <th style="padding: 12px; text-align: left; font-weight: 600;">Поле из файла</th>
                            <th style="padding: 12px; text-align: left; font-weight: 600;">Описание</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            systemFields.forEach(field => {
                const autoMapped = options.find(opt => this.autoMapField(field.key, opt));
                const selectedValue = autoMapped || '';
                
                tableHtml += `
                    <tr style="border-bottom: 1px solid #e5e7eb;">
                        <td style="padding: 12px;">
                            <strong>${field.label}</strong>
                            ${field.required ? '<span style="color: #dc3545; margin-left: 4px;">*</span>' : ''}
                        </td>
                        <td style="padding: 12px;">
                            <select id="mapping_${field.key}" data-field="${field.key}" 
                                    class="form-input mapping-select" 
                                    style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 6px; font-size: 0.95rem;">
                                <option value="">-- Не сопоставлять --</option>
                                ${options.map(option => `
                                    <option value="${option}" ${option === selectedValue ? 'selected' : ''}>
                                        ${option}
                                    </option>
                                `).join('')}
                            </select>
                        </td>
                        <td style="padding: 12px; color: #666; font-size: 0.9rem;">
                            ${field.description}
                        </td>
                    </tr>
                `;
            });
            
            tableHtml += '</tbody></table>';
            
            const mappingTable = document.getElementById('mappingTable');
            if (mappingTable) {
                mappingTable.innerHTML = tableHtml;
            }
            
            // Показываем контейнер
            const container = document.getElementById('fieldMappingContainer');
            if (container) {
                container.style.display = 'block';
            }
        },

        // Скачивание шаблона импорта
        downloadImportTemplate(type) {
            let headers = [];
            let filename = '';
            let description = '';
            
            switch(type) {
                case 'products':
                    headers = ['type', 'name', 'description', 'price', 'cost', 'weight', 'calories', 'category_menu', 'category_stock', 'slug', 'image_url', 'status', 'sku', 'barcode'];
                    filename = 'template_products.csv';
                    description = 'Шаблон для импорта товаров (готовой продукции)';
                    break;
                case 'dishes':
                    headers = ['type', 'name', 'description', 'price', 'cost', 'weight', 'calories', 'category_menu', 'category_stock', 'slug', 'image_url', 'status', 'ingredients', 'prep_time', 'yield'];
                    filename = 'template_dishes.csv';
                    description = 'Шаблон для импорта блюд (техкарт)';
                    break;
                case 'categories':
                    headers = ['slug', 'parent_slug', 'category_name', 'type', 'display_on_site', 'display_in_nav', 'sort_order'];
                    filename = 'template_categories.csv';
                    description = 'Шаблон для импорта категорий меню и номенклатуры';
                    break;
                case 'stock':
                    headers = ['Наименование', 'Штрихкод', 'Ед. изм.', 'Закупочная цена', 'Ставка НДС', 'Категория', 'Тип', 'Остаток'];
                    filename = 'template_stock.csv';
                    description = 'Шаблон для импорта остатков товаров';
                    break;
                case 'modifiers':
                    headers = ['category_menu', 'name', 'price', 'applied_to', 'type'];
                    filename = 'template_modifiers.csv';
                    description = 'Шаблон для импорта модификаторов (соусы, доп. ингредиенты)';
                    break;
                case 'units':
                    headers = ['unit_code', 'unit_name', 'conversion_factor_to_base_unit'];
                    filename = 'template_units.csv';
                    description = 'Шаблон для импорта единиц измерения';
                    break;
                case 'prices':
                    headers = ['product_code', 'barcode', 'new_price', 'effective_date'];
                    filename = 'template_prices.csv';
                    description = 'Шаблон для массового обновления цен';
                    break;
                case 'nutrition':
                    headers = ['name', 'sku', 'energy_kcal', 'energy_kj', 'proteins', 'fats', 'carbohydrates'];
                    filename = 'template_nutrition.csv';
                    description = 'Шаблон для импорта энергетической ценности и нутриентов';
                    break;
                default:
                    alert('❌ Неизвестный тип шаблона');
                    return;
            }
            
            // Создаём CSV с заголовками и примерами
            let csvContent = headers.join(',') + '\n';
            
            // Добавляем примеры строк
            if (type === 'products') {
                csvContent += 'product,Соус фирменный,Вкусный соус для пиццы,49,15,100г,120,Соусы,Соусы,sauce-firmenny,https://example.com/sauce.jpg,active,SAUCE-001,1234567890123\n';
            } else if (type === 'dishes') {
                csvContent += 'dish,Пицца Маргарита,Классическая пицца с томатами и моцареллой,330,150,500г,280,Пицца,Пицца,margarita,https://example.com/margarita.jpg,active,"мука:200г,томаты:100г,моцарелла:150г",15,500г\n';
            } else if (type === 'categories') {
                csvContent += 'pizza,,Пицца,menu,1,1,0\n';
                csvContent += 'pizza-25cm,pizza,Пицца 25 см,menu,1,1,1\n';
            } else if (type === 'stock') {
                csvContent += 'Соус фирменный,1234567890123,шт,15,20,Соусы,товар,100\n';
            } else if (type === 'modifiers') {
                csvContent += 'Соусы,Острый соус,49,Пицца,modifier\n';
                csvContent += 'Допы,Доп. сыр,79,Пицца|Роллы,modifier\n';
            } else if (type === 'units') {
                csvContent += 'kg,Килограмм,1\n';
                csvContent += 'g,Грамм,0.001\n';
                csvContent += 'l,Литр,1\n';
                csvContent += 'ml,Миллилитр,0.001\n';
                csvContent += 'pcs,Штука,1\n';
            } else if (type === 'prices') {
                csvContent += 'SAUCE-001,1234567890123,59,2025-01-27\n';
                csvContent += 'DRINK-001,,120,2025-01-27\n';
            } else if (type === 'nutrition') {
                csvContent += 'Пицца Маргарита,MARG-001,280,1172,12,15,30\n';
                csvContent += 'Ролл Филадельфия,PHIL-001,320,1340,18,12,35\n';
            }
            
            // Создаём blob и скачиваем
            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
            window.URL.revokeObjectURL(url);
            
            // Показываем описание полей
            this.showTemplateFieldsDescription(type);
        },
        
        // Показ описания полей шаблона
        showTemplateFieldsDescription(type) {
            const descriptions = {
                'products': {
                    'type': 'Тип номенклатуры: product (товар), ingredient (ингредиент), dish (блюдо)',
                    'name': 'Название товара (обязательно)',
                    'description': 'Описание товара',
                    'price': 'Цена продажи (₽)',
                    'cost': 'Себестоимость (₽)',
                    'weight': 'Вес/объём (например: 100г, 0.5л)',
                    'calories': 'Калорийность на 100г/порцию',
                    'category_menu': 'Категория меню (для отображения на сайте)',
                    'category_stock': 'Категория номенклатуры (складская)',
                    'slug': 'URL-адрес (автоматически, если не указан)',
                    'image_url': 'URL изображения',
                    'status': 'Статус: active (активен), inactive (неактивен)',
                    'sku': 'Артикул/SKU товара',
                    'barcode': 'Штрихкод'
                },
                'dishes': {
                    'type': 'Тип: dish (блюдо)',
                    'name': 'Название блюда (обязательно)',
                    'description': 'Описание блюда',
                    'price': 'Цена продажи (₽)',
                    'cost': 'Себестоимость (₽, рассчитывается автоматически по техкарте)',
                    'weight': 'Выход блюда (г/шт)',
                    'calories': 'Калорийность',
                    'category_menu': 'Категория меню (обязательно)',
                    'category_stock': 'Категория номенклатуры',
                    'slug': 'URL-адрес',
                    'image_url': 'URL изображения',
                    'status': 'Статус: active, inactive',
                    'ingredients': 'Список ингредиентов (формат: ингредиент1:количество1, ингредиент2:количество2)',
                    'prep_time': 'Время приготовления (минуты)',
                    'yield': 'Выход блюда (г/шт)'
                },
                'categories': {
                    'slug': 'Уникальный идентификатор категории (латиница)',
                    'parent_slug': 'Slug родительской категории (для подкатегорий)',
                    'category_name': 'Название категории (обязательно)',
                    'type': 'Тип: menu (категория меню), stock (складская категория)',
                    'display_on_site': 'Отображать на сайте: 1 (да), 0 (нет)',
                    'display_in_nav': 'Отображать в навигации: 1 (да), 0 (нет)',
                    'sort_order': 'Порядок сортировки (число)'
                },
                'stock': {
                    'Наименование': 'Название товара (обязательно)',
                    'Штрихкод': 'Штрихкод товара',
                    'Ед. изм.': 'Единица измерения: шт, кг, л',
                    'Закупочная цена': 'Цена закупки (₽)',
                    'Ставка НДС': 'НДС: 0, 10, 20 или "Без НДС"',
                    'Категория': 'Категория товара',
                    'Тип': 'Тип: товар, материал',
                    'Остаток': 'Количество на складе'
                },
                'modifiers': {
                    'category_menu': 'Категория меню, к которой относится модификатор',
                    'name': 'Название модификатора (обязательно)',
                    'price': 'Цена модификатора (₽)',
                    'applied_to': 'Список блюд/категорий, к которым применяется (через |)',
                    'type': 'Тип: modifier (модификатор), service (услуга)'
                },
                'units': {
                    'unit_code': 'Код единицы измерения (например: kg, g, l, ml, pcs)',
                    'unit_name': 'Название единицы (например: Килограмм, Грамм)',
                    'conversion_factor_to_base_unit': 'Коэффициент пересчёта к базовой единице'
                },
                'prices': {
                    'product_code': 'Код товара (SKU) или название',
                    'barcode': 'Штрихкод товара (альтернатива коду)',
                    'new_price': 'Новая цена (₽)',
                    'effective_date': 'Дата вступления в силу (YYYY-MM-DD)'
                },
                'nutrition': {
                    'name': 'Название товара/блюда (обязательно)',
                    'sku': 'SKU товара (для поиска)',
                    'energy_kcal': 'Энергетическая ценность (ккал)',
                    'energy_kj': 'Энергетическая ценность (кДж)',
                    'proteins': 'Белки (г)',
                    'fats': 'Жиры (г)',
                    'carbohydrates': 'Углеводы (г)'
                }
            };
            
            const fields = descriptions[type];
            if (!fields) return;
            
            let html = '<div style="max-height: 400px; overflow-y: auto; padding: 1rem; background: #f8f9fa; border-radius: 8px; margin-top: 1rem;">';
            html += `<h4 style="margin-bottom: 1rem; color: var(--dandy-green);">📋 Описание полей шаблона "${type}":</h4>`;
            html += '<table style="width: 100%; border-collapse: collapse;">';
            html += '<thead><tr style="background: #e5e7eb;"><th style="padding: 8px; text-align: left; border: 1px solid #d1d5db;">Поле</th><th style="padding: 8px; text-align: left; border: 1px solid #d1d5db;">Описание</th></tr></thead><tbody>';
            
            Object.entries(fields).forEach(([field, desc]) => {
                html += `<tr><td style="padding: 8px; border: 1px solid #d1d5db; font-weight: 600;">${field}</td><td style="padding: 8px; border: 1px solid #d1d5db;">${desc}</td></tr>`;
            });
            
            html += '</tbody></table></div>';
            
            // Показываем в модальном окне или alert
            const modal = document.querySelector('.modal-overlay');
            if (modal) {
                const body = modal.querySelector('.modal-body');
                if (body) {
                    // Удаляем старое описание, если есть
                    const oldDesc = body.querySelector('#templateDescription');
                    if (oldDesc) oldDesc.remove();
                    
                    const descDiv = document.createElement('div');
                    descDiv.id = 'templateDescription';
                    descDiv.innerHTML = html;
                    body.appendChild(descDiv);
                    
                    // Прокручиваем к описанию
                    descDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            } else {
                // Если модального окна нет, показываем в отдельном окне
                alert(html.replace(/<[^>]*>/g, '\n').replace(/\n+/g, '\n'));
            }
        },
        
        // Автоматическое сопоставление полей
        autoMapField(systemField, fileField) {
            const mappings = {
                'name': ['name', 'title', 'product_name', 'название', 'наименование'],
                'sku': ['sku', 'vendor_code', 'артикул', 'код', 'article'],
                'price': ['price', 'cost', 'цена', 'стоимость', 'price_sale'],
                'cost': ['cost', 'cost_price', 'себестоимость', 'закупочная цена'],
                'category': ['category', 'category_name', 'cat', 'категория', 'category_menu'],
                'description': ['description', 'desc', 'описание', 'description_full'],
                'image_url': ['image_url', 'image', 'photo', 'picture', 'изображение', 'фото', 'url'],
                'weight': ['weight', 'size', 'вес', 'размер', 'weight_volume'],
                'calories': ['calories', 'калории', 'energy_kcal'],
                'stock_quantity': ['stock', 'quantity', 'остаток', 'количество', 'stock_quantity'],
                'type': ['type', 'тип', 'item_type', 'product_type'],
                'status': ['status', 'статус', 'active', 'visible', 'available'],
                'barcode': ['barcode', 'штрихкод', 'code', 'ean']
            };
            
            const fieldLower = fileField.toLowerCase().trim();
            return mappings[systemField]?.some(map => fieldLower === map || fieldLower.includes(map)) || false;
        },

        // Валидация данных импорта
        validateImportData() {
            if (!this.importData) return;
            
            const rows = this.importData.type === 'csv' ? this.importData.rows : this.importData.offers;
            if (!rows || rows.length === 0) return;
            
            const errors = [];
            const warnings = [];
            
            rows.forEach((row, index) => {
                const rowNum = index + 2; // +2 потому что первая строка - заголовки
                
                // Проверка обязательных полей
                let name = '';
                if (this.importData.type === 'csv') {
                    const nameIndex = this.importData.headers.findIndex(h => 
                        this.autoMapField('name', h) || h.toLowerCase().includes('name') || h.toLowerCase().includes('название')
                    );
                    if (nameIndex >= 0 && row[nameIndex]) {
                        name = row[nameIndex].trim();
                    }
                } else {
                    name = row.name || row.title || '';
                }
                
                if (!name || name.length === 0) {
                    errors.push(`Строка ${rowNum}: отсутствует название товара (обязательное поле)`);
                }
                
                // Проверка цены
                let price = 0;
                if (this.importData.type === 'csv') {
                    const priceIndex = this.importData.headers.findIndex(h => 
                        this.autoMapField('price', h) || h.toLowerCase().includes('price') || h.toLowerCase().includes('цена')
                    );
                    if (priceIndex >= 0 && row[priceIndex]) {
                        price = parseFloat(row[priceIndex]) || 0;
                    }
                } else {
                    price = parseFloat(row.price) || 0;
                }
                
                if (price < 0) {
                    errors.push(`Строка ${rowNum}: отрицательная цена (${price})`);
                } else if (price === 0 && name) {
                    warnings.push(`Строка ${rowNum} (${name}): цена равна нулю`);
                }
                
                // Проверка категории (рекомендуется)
                let category = '';
                if (this.importData.type === 'csv') {
                    const catIndex = this.importData.headers.findIndex(h => 
                        this.autoMapField('category', h) || h.toLowerCase().includes('category') || h.toLowerCase().includes('категория')
                    );
                    if (catIndex >= 0 && row[catIndex]) {
                        category = row[catIndex].trim();
                    }
                } else {
                    category = row.category || row.categoryId || '';
                }
                
                if (!category && name) {
                    warnings.push(`Строка ${rowNum} (${name}): не указана категория`);
                }
            });
            
            this.importData.errors = errors;
            this.importData.warnings = warnings;
            
            // Отображаем результаты валидации
            this.renderValidationResults();
        },
        
        // Отображение результатов валидации
        renderValidationResults() {
            const previewContent = document.getElementById('importPreviewContent');
            if (!previewContent) return;
            
            const totalCount = this.importData.type === 'csv' ? 
                this.importData.rows.length : 
                this.importData.offers.length;
            
            const errors = this.importData.errors || [];
            const warnings = this.importData.warnings || [];
            
            let html = `
                <div style="padding: 1rem; background: white; border-radius: 8px;">
                    <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                        <div style="flex: 1;">
                            <div style="color: #10b981; font-weight: 600; font-size: 1.1rem; margin-bottom: 0.25rem;">
                                ✓ Найдено товаров: ${totalCount}
                            </div>
                            <div style="color: #9ca3af; font-size: 0.9rem;">
                                Готово к импорту
                            </div>
                        </div>
                    </div>
            `;
            
            if (errors.length > 0) {
                html += `
                    <div style="padding: 0.75rem; background: #fee2e2; border-left: 4px solid #dc3545; border-radius: 4px; margin-bottom: 0.75rem;">
                        <div style="color: #dc3545; font-weight: 600; margin-bottom: 0.5rem;">
                            ❌ Критические ошибки (${errors.length}):
                        </div>
                        <div style="color: #991b1b; font-size: 0.9rem; max-height: 150px; overflow-y: auto;">
                            ${errors.slice(0, 10).map(e => `<div>• ${e}</div>`).join('')}
                            ${errors.length > 10 ? `<div style="color: #666; font-style: italic;">...и еще ${errors.length - 10} ошибок</div>` : ''}
                        </div>
                    </div>
                `;
            }
            
            if (warnings.length > 0) {
                html += `
                    <div style="padding: 0.75rem; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
                        <div style="color: #f59e0b; font-weight: 600; margin-bottom: 0.5rem;">
                            ⚠️ Предупреждения (${warnings.length}):
                        </div>
                        <div style="color: #92400e; font-size: 0.9rem; max-height: 150px; overflow-y: auto;">
                            ${warnings.slice(0, 10).map(w => `<div>• ${w}</div>`).join('')}
                            ${warnings.length > 10 ? `<div style="color: #666; font-style: italic;">...и еще ${warnings.length - 10} предупреждений</div>` : ''}
                        </div>
                    </div>
                `;
            }
            
            if (errors.length === 0 && warnings.length === 0) {
                html += `
                    <div style="padding: 0.75rem; background: #d1fae5; border-left: 4px solid #10b981; border-radius: 4px;">
                        <div style="color: #10b981; font-weight: 600;">
                            ✅ Все данные валидны, готово к импорту
                        </div>
                    </div>
                `;
            }
            
            html += '</div>';
            previewContent.innerHTML = html;
            
            // Показываем превью
            const previewDiv = document.getElementById('importPreview');
            if (previewDiv) {
                previewDiv.style.display = 'block';
            }
        },
        
        // Отрисовка предпросмотра
        renderPreview() {
            // Используем renderValidationResults вместо простого сообщения
            this.renderValidationResults();
        },
        // Начать импорт
        async startImport() {
            const importBtn = document.getElementById('importBtn');
            if (!importBtn) return;
            
            // Check if file is selected
            if (!this.selectedImportFile) {
                alert('❌ Пожалуйста, выберите файл для импорта');
                return;
            }
            
            // Проверяем наличие данных для импорта
            if (!this.importData || (!this.importData.rows && !this.importData.offers)) {
                alert('❌ Нет данных для импорта. Проверьте файл');
                return;
            }
            
            // Проверяем критические ошибки валидации
            const criticalErrors = (this.importData.errors || []).filter(e => 
                e.includes('обязательное') || e.includes('пустое') || e.includes('некорректная')
            );
            if (criticalErrors.length > 0) {
                const proceed = confirm(`⚠️ Найдено ${criticalErrors.length} критических ошибок валидации.\n\nПродолжить импорт? (Ошибочные строки будут пропущены)`);
                if (!proceed) return;
            }
            
            importBtn.disabled = true;
            importBtn.textContent = '⏳ Импортируем...';
            
            try {
                const importHidden = document.getElementById('importHidden')?.checked || false;
                const updateExisting = document.getElementById('updateExisting')?.checked || false;
                const accountCode = document.getElementById('importAccountCode')?.value || '';
                const supplierName = document.getElementById('importSupplierName')?.value?.trim() || '';
                const contractNumber = document.getElementById('importContractNumber')?.value?.trim() || '';
                const paymentTermDays = document.getElementById('importPaymentTermDays')?.value?.trim() || '';
                const warehouseId = document.getElementById('importWarehouseId')?.value?.trim() || '1';
                const csvDelimiter = document.getElementById('importDelimiter')?.value || ',';
                const csvStartRow = document.getElementById('importStartRow')?.value || '2';
                const csvEncoding = document.getElementById('importEncoding')?.value || 'UTF-8';

                if (accountCode === '10.1' || accountCode === '41.1') {
                    if (!supplierName || !contractNumber) {
                        alert('❌ Для счета 10.1/41.1 нужно заполнить «Поставщик» и «Договор»');
                        return;
                    }
                }
                
                const translateSystemFieldForBackend = (key) => {
                    const k = String(key || '').trim();
                    if (!k) return '';
                    const map = {
                        // admin import keys -> backend import keys
                        category_menu: 'category_path',
                        category_stock: 'category_path',
                        stock_quantity: 'stock_qty',
                        status: 'available',
                        visible_on_site: 'available'
                    };
                    return map[k] || k;
                };

                const buildMappingFromUI = () => {
                    const mapping = {};
                    const selects = Array.from(document.querySelectorAll('.mapping-select'));
                    selects.forEach((sel) => {
                        const sys = sel?.dataset?.field;
                        const val = sel?.value;
                        if (!sys || !val) return;
                        const backendKey = translateSystemFieldForBackend(sys);
                        if (!backendKey) return;
                        mapping[backendKey] = val;
                    });
                    return mapping;
                };

                const buildAutoMapping = () => {
                    const mapping = {};
                    if (this.importData.type === 'csv' && this.importData.headers) {
                        this.importData.headers.forEach(header => {
                            const sys = this.autoMapFieldToSystem(header);
                            if (sys) {
                                const backendKey = translateSystemFieldForBackend(sys);
                                if (backendKey) mapping[backendKey] = header;
                            }
                        });
                    } else if (this.importData.type === 'yml' && Array.isArray(this.importData.offers) && this.importData.offers.length > 0) {
                        const sample = this.importData.offers[0] || {};
                        const keys = Object.keys(sample);
                        keys.forEach((k) => {
                            const sys = this.autoMapFieldToSystem(k);
                            if (sys) {
                                const backendKey = translateSystemFieldForBackend(sys);
                                if (backendKey) mapping[backendKey] = k;
                            }
                        });
                    }
                    return mapping;
                };

                // Собираем сопоставление полей: приоритет ручной настройке, иначе авто
                const manualMapping = buildMappingFromUI();
                const autoMapping = buildAutoMapping();
                const fieldMapping = Object.keys(manualMapping).length ? manualMapping : autoMapping;
                
                // Create FormData with file
                const formData = new FormData();
                formData.append('file', this.selectedImportFile);
                formData.append('importHidden', importHidden.toString());
                formData.append('updateExisting', updateExisting.toString());
                formData.append('account_code', accountCode);
                formData.append('supplier_name', supplierName);
                formData.append('contract_number', contractNumber);
                formData.append('payment_term_days', paymentTermDays);
                formData.append('warehouse_id', warehouseId);
                if ((this.importData?.type || '') === 'csv') {
                    formData.append('csv_delimiter', String(csvDelimiter || ','));
                    formData.append('start_row', String(csvStartRow || '2'));
                    formData.append('encoding', String(csvEncoding || 'UTF-8'));
                }
                if (Object.keys(fieldMapping).length > 0) {
                    formData.append('fieldMapping', JSON.stringify(fieldMapping));
                }
                
                // Send file to server
                const response = await fetch('/api/importProducts', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (!response.ok || !result.success) {
                    throw new Error(result.message || result.error || 'Ошибка импорта');
                }
                
                // Show success message
                let message = result.message || `Импорт завершен. Создано: ${result.created || 0}, Обновлено: ${result.updated || 0}, Ошибок: ${result.errors || 0}`;
                if (result.receipt && (result.receipt.tx_id || result.receipt.lines_count)) {
                    const txId = result.receipt.tx_id || '—';
                    const whId = result.receipt.warehouse_id || '—';
                    const linesCount = (result.receipt.lines_count ?? '—');
                    message += `\n\n🧾 Приход: ${txId}\nСклад: ${whId}\nСтрок: ${linesCount}`;
                }
                alert(`✅ ${message}`);
                
                // Show error details if any
                if (result.errorMessages && result.errorMessages.length > 0) {
                    console.warn('Ошибки импорта:', result.errorMessages);
                    const errorDetails = result.errorMessages.slice(0, 5).join('\n');
                    if (result.errorMessages.length > 5) {
                        alert(`⚠️ Предупреждение: Найдено ${result.errors} ошибок. Первые 5:\n\n${errorDetails}\n\n...и еще ${result.errors - 5}`);
                    } else {
                        alert(`⚠️ Предупреждение: Найдено ${result.errors} ошибок:\n\n${errorDetails}`);
                    }
                }
                
                // Close modal and refresh products
                const modalOverlay = document.querySelector('.modal-overlay');
                if (modalOverlay) {
                    modalOverlay.remove();
                }
                
                await this.loadProducts();
                
                // Sync to website if syncToWebsite exists
                if (typeof this.syncToWebsite === 'function') {
                    await this.syncToWebsite(true);
                }
                
            } catch (error) {
                console.error('Import error:', error);
                alert(`❌ Ошибка при импорте: ${error.message || 'Неизвестная ошибка'}`);
            } finally {
                importBtn.disabled = false;
                importBtn.textContent = '📥 Импортировать';
            }
        },
        
        // Автоматическое сопоставление заголовка файла с системным полем
        autoMapFieldToSystem(fileHeader) {
            const headerLower = fileHeader.toLowerCase().trim();
            const mappings = {
                'name': ['name', 'title', 'product_name', 'название', 'наименование'],
                'sku': ['sku', 'vendor_code', 'артикул', 'код', 'code'],
                'price': ['price', 'cost', 'цена', 'стоимость'],
                'cost': ['cost', 'себестоимость', 'purchase_price'],
                'category_menu': ['category', 'category_name', 'cat', 'категория', 'category_menu'],
                'category_stock': ['category_stock', 'складская_категория', 'stock_category'],
                'description': ['description', 'desc', 'описание'],
                'short_description': ['short_description', 'краткое_описание'],
                'image_url': ['image_url', 'image', 'photo', 'picture', 'изображение', 'фото'],
                'weight': ['weight', 'size', 'вес', 'размер'],
                'calories': ['calories', 'калории', 'ккал'],
                'ingredients': ['ingredients', 'состав', 'ингредиенты'],
                'allergens': ['allergens', 'аллергены'],
                'stock_quantity': ['stock', 'quantity', 'остаток', 'количество'],
                'barcode': ['barcode', 'штрихкод', 'ean'],
                'status': ['status', 'статус'],
                'visible_on_site': ['visible', 'visible_on_site', 'видим', 'отображать']
            };
            
            for (const [systemField, aliases] of Object.entries(mappings)) {
                if (aliases.some(alias => headerLower.includes(alias))) {
                    return systemField;
                }
            }
            return null;
        },
        // Сопоставление строки CSV с товаром
        mapCSVRowToProduct(row, mapping, importHidden) {
            const productData = {
                visible_on_site: !importHidden,
                hidden_for_promo: false,
                categories: []
            };
            
            Object.entries(mapping).forEach(([systemField, csvField]) => {
                const index = this.importData.headers.indexOf(csvField);
                if (index >= 0 && row[index]) {
                    const value = row[index].trim();
                    
                    switch (systemField) {
                        case 'name':
                            productData.name = value;
                            break;
                        case 'sku':
                            productData.sku = value;
                            break;
                        case 'price':
                            productData.price = parseFloat(value) || 0;
                            break;
                        case 'category':
                            const category = this.findCategoryByName(value);
                            if (category) {
                                productData.categories = [category.id];
                            }
                            break;
                        case 'description':
                            productData.short_description = value;
                            break;
                        case 'image_url':
                            productData.image_url = value;
                            break;
                        case 'weight':
                            productData.weight = value;
                            break;
                        case 'calories':
                            productData.calories = parseInt(value) || 0;
                            break;
                        case 'stock_quantity':
                            productData.stock_quantity = parseInt(value) || 0;
                            break;
                    }
                }
            });
            
            if (!productData.name || !productData.sku) {
                return null;
            }
            
            return productData;
        },

        // Сопоставление предложения YML с товаром
        mapYMLOfferToProduct(offer, mapping, importHidden) {
            const productData = {
                visible_on_site: !importHidden,
                hidden_for_promo: false,
                categories: []
            };
            
            Object.entries(mapping).forEach(([systemField, ymlField]) => {
                const value = offer[ymlField]?.trim();
                if (value) {
                    switch (systemField) {
                        case 'name':
                            productData.name = value;
                            break;
                        case 'sku':
                            productData.sku = value;
                            break;
                        case 'price':
                            productData.price = parseFloat(value) || 0;
                            break;
                        case 'category':
                            const category = this.findCategoryByName(value);
                            if (category) {
                                productData.categories = [category.id];
                            }
                            break;
                        case 'description':
                            productData.short_description = value;
                            break;
                        case 'image_url':
                            productData.image_url = value;
                            break;
                        case 'weight':
                            productData.weight = value;
                            break;
                        case 'calories':
                            productData.calories = parseInt(value) || 0;
                            break;
                        case 'stock_quantity':
                            productData.stock_quantity = parseInt(value) || 0;
                            break;
                    }
                }
            });
            
            if (!productData.name || !productData.sku) {
                return null;
            }
            
            return productData;
        },

        // Поиск товара по SKU
        findProductBySku(sku) {
            return this.products.find(p => p.sku === sku);
        },

        // Поиск категории по названию
        findCategoryByName(name) {
            return this.categories.find(c => c.name.toLowerCase() === name.toLowerCase());
        },

        // Создание товара
        async createProduct(productData) {
            const response = await fetch('/api/products', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(productData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            
            // Сбрасываем флаг явного удаления при создании нового товара
            this._productsExplicitlyDeleted = false;
            
            // Синхронизируем с сайтом после создания (с уведомлением если создан один товар)
            await this.syncToWebsite(false); // Не показываем уведомление - оно будет при завершении импорта
            
            return result;
        },
        // Обновление товара
        async updateProduct(productData) {
            const existingProduct = this.findProductBySku(productData.sku);
            if (!existingProduct) {
                throw new Error('Товар для обновления не найден');
            }
            
            const response = await fetch(`/api/products/${existingProduct.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(productData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            
            // Синхронизируем с сайтом после обновления
            await this.syncToWebsite();
            
            return result;
        },

        // Открыть добавление товара из импорта (просто закрывает импорт и открывает добавление)
        showAddProductFromImport() {
            document.querySelectorAll('.modal-overlay').forEach((overlay) => overlay.remove());
            this.addProductModalOverlay = null;
            this.addProductModalRoot = null;
            this.showAddProductModal();
        },

        // Модальное окно управления категориями
        async showCategoriesModal() {
            // Удаляем существующие модальные окна
            const existingModals = document.querySelectorAll('.modal-overlay');
            existingModals.forEach(modal => modal.remove());
            
            // Загружаем категории
            await this.loadCategories();
            
            const bulkParentOptions = (Array.isArray(this.categories) ? this.categories : [])
                .map(c => `<option value="${c.id}">${this.escapeHtml(c.name || '')}</option>`)
                .join('');

            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content large">
                    <div class="modal-header">
                        <h3>📁 Управление категориями</h3>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                    </div>
                    <div class="modal-body">
                        <style>
                            .category-row.dragging {
                                opacity: 0.5;
                                background: #f0f0f0 !important;
                            }
                            .category-row.drop-target {
                                border-top: 3px solid #007bff !important;
                                background: #e3f2fd !important;
                            }
                            .category-row.drop-inside {
                                background: #c8e6c9 !important;
                                border: 2px dashed #4caf50 !important;
                            }
                            .category-row.has-children {
                                font-weight: 600;
                            }
                        </style>
                        <div style="margin-bottom: 1.5rem; display: flex; gap: 1rem; flex-wrap: wrap; align-items: center;">
                            <button id="addCategoryBtn" class="btn btn-primary" style="background: var(--dandy-green); color: #fff; border: none; padding: 0.75rem 1.5rem; border-radius: 10px; cursor: pointer; font-size: 1rem; font-weight: 600;">
                                ➕ Добавить категорию
                            </button>
                            <button id="restoreCategoriesBtn" class="btn btn-secondary" style="background: #17a2b8; color: #fff; border: none; padding: 0.75rem 1.5rem; border-radius: 10px; cursor: pointer; font-size: 1rem; font-weight: 600;">
                                🔄 Восстановить категории
                            </button>
                            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                                <button id="exportCategoriesBtn" class="btn btn-secondary" style="background: #6c757d; color: #fff; border: none; padding: 0.75rem 1.5rem; border-radius: 10px; cursor: pointer; font-size: 1rem; font-weight: 600;">
                                    📥 Экспорт CSV
                                </button>
                                <button onclick="ProductCardsManager.showExportModal('categories')" class="btn btn-secondary" style="background: #6c757d; color: #fff; border: none; padding: 0.75rem 1.5rem; border-radius: 10px; cursor: pointer; font-size: 1rem; font-weight: 600;">
                                    📤 Экспорт справочников
                                </button>
                            </div>
                            <button id="importCategoriesBtn" class="btn btn-secondary" style="background: #6c757d; color: #fff; border: none; padding: 0.75rem 1.5rem; border-radius: 10px; cursor: pointer; font-size: 1rem; font-weight: 600;">
                                📤 Импорт CSV
                            </button>
                            <input type="file" id="importCategoriesFile" accept=".csv" style="display: none;">
                            <div id="bulkCategoryActions" style="display: none; gap: 0.5rem; align-items: center;">
                                <span id="selectedCategoriesCount" style="font-weight: 600; color: var(--dandy-green);"></span>
                                <button id="bulkShowOnSiteBtn" class="btn btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.9rem;">Показать на сайте</button>
                                <button id="bulkHideOnSiteBtn" class="btn btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.9rem;">Скрыть на сайте</button>
                                <select id="bulkMoveParentSelect" class="form-input" style="padding: 0.5rem 0.75rem; font-size: 0.9rem; border-radius: 8px; border: 1px solid #ddd; background: #fff; min-width: 220px;">
                                    <option value="">Сделать корневой</option>
                                    ${bulkParentOptions}
                                </select>
                                <button id="bulkMoveParentBtn" class="btn btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.9rem;">Изменить группу</button>
                                <button id="bulkDeleteCategoriesBtn" class="btn btn-danger" style="padding: 0.5rem 1rem; font-size: 0.9rem; background: #dc3545;">Удалить</button>
                            </div>
                        </div>
                        <div id="categoriesList" style="max-height: 500px; overflow-y: auto;">
                            ${this.renderCategoriesList()}
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Обработчики
            const addCategoryBtn = document.getElementById('addCategoryBtn');
            if (addCategoryBtn) {
                addCategoryBtn.addEventListener('click', () => this.showAddCategoryForm(modal));
            }
            
            const restoreCategoriesBtn = document.getElementById('restoreCategoriesBtn');
            if (restoreCategoriesBtn) {
                restoreCategoriesBtn.addEventListener('click', async () => {
                    if (!confirm('Восстановить базовые категории (Пицца, Суши, Напитки, Десерты)? Существующие категории не будут удалены.')) {
                        return;
                    }
                    
                    try {
                        const response = await fetch('/api/categories/restore', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' }
                        });
                        
                        const result = await response.json();
                        if (result.success) {
                            await this.loadCategories();
                            const categoriesList = modal.querySelector('#categoriesList');
                            if (categoriesList) {
                                categoriesList.innerHTML = this.renderCategoriesList();
                                this.attachCategoryHandlers(modal);
                                this.initCategoryDragDrop(modal);
                                this.setupBulkCategoryHandlers(modal);
                            }
                            alert(`✅ ${result.message}`);
                        } else {
                            throw new Error(result.error || 'Ошибка восстановления');
                        }
                    } catch (error) {
                        console.error('Ошибка восстановления категорий:', error);
                        alert(`❌ Ошибка: ${error.message}`);
                    }
                });
            }
            
            // Обработчики для кнопок редактирования и удаления
            modal.querySelectorAll('.editCategoryBtn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const categoryId = e.target.closest('tr').dataset.categoryId;
                    this.showEditCategoryForm(modal, categoryId);
                });
            });
            
            modal.querySelectorAll('.deleteCategoryBtn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const categoryId = e.target.closest('tr').dataset.categoryId;
                    await this.deleteCategory(categoryId, modal);
                });
            });
            
            // Обработчики для просмотра товаров категории
            modal.querySelectorAll('.viewCategoryProducts').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const categoryId = e.target.closest('a').dataset.categoryId;
                    this.viewCategoryProducts(categoryId);
                });
            });
            
            // Инициализация drag & drop для сортировки
            this.initCategoryDragDrop(modal);
            
            // Настройка обработчиков массовых операций
            this.setupBulkCategoryHandlers(modal);
        },
        
        setupBulkCategoryHandlers(modal) {
            // Обработчики массовых операций
            const selectAllCheckbox = modal.querySelector('#selectAllCategories');
            const categoryCheckboxes = modal.querySelectorAll('.category-checkbox');
            const bulkActions = modal.querySelector('#bulkCategoryActions');
            const selectedCount = modal.querySelector('#selectedCategoriesCount');
            
            if (selectAllCheckbox) {
                // Удаляем старые обработчики
                const newSelectAll = selectAllCheckbox.cloneNode(true);
                selectAllCheckbox.parentNode.replaceChild(newSelectAll, selectAllCheckbox);
                
                newSelectAll.addEventListener('change', (e) => {
                    modal.querySelectorAll('.category-checkbox').forEach(cb => cb.checked = e.target.checked);
                    this.updateBulkActions(modal);
                });
            }
            
            categoryCheckboxes.forEach(cb => {
                // Удаляем старые обработчики
                const newCb = cb.cloneNode(true);
                cb.parentNode.replaceChild(newCb, cb);
                
                newCb.addEventListener('change', () => {
                    this.updateBulkActions(modal);
                    // Обновляем состояние "выбрать все"
                    const allCheckboxes = modal.querySelectorAll('.category-checkbox');
                    const allChecked = Array.from(allCheckboxes).every(c => c.checked);
                    const someChecked = Array.from(allCheckboxes).some(c => c.checked);
                    const selectAll = modal.querySelector('#selectAllCategories');
                    if (selectAll) {
                        selectAll.checked = allChecked;
                        selectAll.indeterminate = someChecked && !allChecked;
                    }
                });
            });
            
            // Обработчики кнопок массовых операций
            const bulkShowBtn = modal.querySelector('#bulkShowOnSiteBtn');
            const bulkHideBtn = modal.querySelector('#bulkHideOnSiteBtn');
            const bulkDeleteBtn = modal.querySelector('#bulkDeleteCategoriesBtn');
            const bulkMoveParentSelect = modal.querySelector('#bulkMoveParentSelect');
            const bulkMoveParentBtn = modal.querySelector('#bulkMoveParentBtn');
            
            if (bulkShowBtn) {
                bulkShowBtn.onclick = () => this.handleBulkCategoryAction(modal, 'show_on_site');
            }
            if (bulkHideBtn) {
                bulkHideBtn.onclick = () => this.handleBulkCategoryAction(modal, 'hide_on_site');
            }
            if (bulkDeleteBtn) {
                bulkDeleteBtn.onclick = () => this.handleBulkCategoryAction(modal, 'delete');
            }
            if (bulkMoveParentBtn && bulkMoveParentSelect) {
                bulkMoveParentBtn.onclick = () => this.handleBulkCategoryChangeParent(modal, bulkMoveParentSelect.value);
            }
            
            // Обработчики импорта/экспорта
            const exportBtn = modal.querySelector('#exportCategoriesBtn');
            const importBtn = modal.querySelector('#importCategoriesBtn');
            const importFile = modal.querySelector('#importCategoriesFile');
            
            if (exportBtn) {
                exportBtn.onclick = () => this.exportCategories();
            }
            if (importBtn && importFile) {
                importBtn.onclick = () => importFile.click();
                importFile.onchange = (e) => this.importCategories(e.target.files[0], modal);
            }
        },
        
        updateBulkActions(modal) {
            const selected = Array.from(modal.querySelectorAll('.category-checkbox:checked')).map(cb => cb.value);
            const bulkActions = modal.querySelector('#bulkCategoryActions');
            const selectedCount = modal.querySelector('#selectedCategoriesCount');
            
            if (selected.length > 0) {
                bulkActions.style.display = 'flex';
                selectedCount.textContent = `Выбрано: ${selected.length}`;
            } else {
                bulkActions.style.display = 'none';
            }
        },
        
        async handleBulkCategoryAction(modal, action) {
            const selected = Array.from(modal.querySelectorAll('.category-checkbox:checked')).map(cb => parseInt(cb.value));
            
            if (selected.length === 0) {
                alert('Выберите категории для выполнения действия');
                return;
            }
            
            if (action === 'delete' && !confirm(`Вы уверены, что хотите удалить ${selected.length} категорий?`)) {
                return;
            }
            
            try {
                const apiAction = action === 'show_on_site' ? 'show_on_site' : 
                                 action === 'hide_on_site' ? 'hide_on_site' : 'delete';
                
                const response = await fetch('/api/categories/bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: apiAction,
                        category_ids: selected
                    })
                });
                
                const result = await response.json();
                if (result.success) {
                    await this.loadCategories();
                    const categoriesList = modal.querySelector('#categoriesList');
                    categoriesList.innerHTML = this.renderCategoriesList();
                    this.attachCategoryHandlers(modal);
                    this.initCategoryDragDrop(modal);
                    this.updateBulkActions(modal);
                    alert(`✅ Операция выполнена для ${selected.length} категорий`);
                } else {
                    throw new Error(result.error || 'Ошибка выполнения операции');
                }
            } catch (error) {
                console.error('Ошибка массовой операции:', error);
                alert(`❌ Ошибка: ${error.message}`);
            }
        },

        async handleBulkCategoryChangeParent(modal, parentIdValue) {
            const selected = Array.from(modal.querySelectorAll('.category-checkbox:checked')).map(cb => parseInt(cb.value));
            if (selected.length === 0) {
                alert('Выберите категории для выполнения действия');
                return;
            }

            const parentId = (parentIdValue === '' || parentIdValue === null || parentIdValue === undefined) ? null : parseInt(parentIdValue);
            if (parentId !== null && selected.includes(parentId)) {
                alert('Нельзя назначить родителем выбранную категорию');
                return;
            }

            try {
                const errors = [];
                for (const id of selected) {
                    const response = await fetch(`/api/categories/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ parent_id: parentId })
                    });
                    const result = await response.json().catch(() => ({}));
                    if (!response.ok || !result.success) {
                        errors.push(result.error || result.message || `Ошибка обновления категории ${id}`);
                    }
                }

                await this.loadCategories();
                const categoriesList = modal.querySelector('#categoriesList');
                if (categoriesList) {
                    categoriesList.innerHTML = this.renderCategoriesList();
                    this.attachCategoryHandlers(modal);
                    this.initCategoryDragDrop(modal);
                    this.setupBulkCategoryHandlers(modal);
                }

                if (errors.length) {
                    alert(`⚠️ Обновлено с ошибками: ${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... и ещё ${errors.length - 5}` : ''}`);
                } else {
                    alert(`✅ Группа обновлена для ${selected.length} категорий`);
                }
            } catch (error) {
                console.error('Ошибка изменения родителя категорий:', error);
                alert(`❌ Ошибка: ${error.message}`);
            }
        },
        
        // Модальное окно экспорта справочников и документов
        showExportModal(type = 'all') {
            const existingModals = document.querySelectorAll('.modal-overlay');
            existingModals.forEach(modal => modal.remove());
            
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content large">
                    <div class="modal-header">
                        <h3>📤 Экспорт справочников и документов</h3>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                    </div>
                    <div class="modal-body">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
                            <!-- Справочники -->
                            <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 12px;">
                                <h4 style="margin-bottom: 1rem; color: var(--dandy-green);">📋 Справочники</h4>
                                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                    <button onclick="ProductCardsManager.exportDirectory('categories')" class="btn btn-secondary" style="text-align: left; padding: 0.75rem;">
                                        📁 Категории меню и номенклатуры
                                    </button>
                                    <button onclick="ProductCardsManager.exportDirectory('ingredients')" class="btn btn-secondary" style="text-align: left; padding: 0.75rem;">
                                        🥘 Ингредиенты и полуфабрикаты
                                    </button>
                                    <button onclick="ProductCardsManager.exportDirectory('modifiers')" class="btn btn-secondary" style="text-align: left; padding: 0.75rem;">
                                        🎯 Модификаторы
                                    </button>
                                    <button onclick="ProductCardsManager.exportDirectory('units')" class="btn btn-secondary" style="text-align: left; padding: 0.75rem;">
                                        📏 Единицы измерения
                                    </button>
                                    <button onclick="ProductCardsManager.exportDirectory('groups')" class="btn btn-secondary" style="text-align: left; padding: 0.75rem;">
                                        📦 Группы товаров
                                    </button>
                                </div>
                            </div>
                            
                            <!-- Рецептуры -->
                            <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 12px;">
                                <h4 style="margin-bottom: 1rem; color: var(--dandy-green);">🍳 Рецептуры</h4>
                                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                    <button onclick="ProductCardsManager.exportDirectory('recipes')" class="btn btn-secondary" style="text-align: left; padding: 0.75rem;">
                                        📝 Техкарты с нутриентами
                                    </button>
                                    <button onclick="ProductCardsManager.exportDirectory('recipes_simple')" class="btn btn-secondary" style="text-align: left; padding: 0.75rem;">
                                        📄 Техкарты (упрощённый)
                                    </button>
                                </div>
                            </div>
                            
                            <!-- Прайс-листы -->
                            <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 12px;">
                                <h4 style="margin-bottom: 1rem; color: var(--dandy-green);">💰 Прайс-листы</h4>
                                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                    <button onclick="ProductCardsManager.exportDirectory('pricelist')" class="btn btn-secondary" style="text-align: left; padding: 0.75rem;">
                                        💵 Прайс-лист для магазинов
                                    </button>
                                    <button onclick="ProductCardsManager.exportDirectory('labels')" class="btn btn-secondary" style="text-align: left; padding: 0.75rem;">
                                        🏷️ Этикетки с QR-кодами
                                    </button>
                                </div>
                            </div>
                            
                            <!-- Складские документы -->
                            <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 12px;">
                                <h4 style="margin-bottom: 1rem; color: var(--dandy-green);">📦 Складские документы</h4>
                                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                    <button onclick="ProductCardsManager.exportDirectory('receipts')" class="btn btn-secondary" style="text-align: left; padding: 0.75rem;">
                                        ➕ Приходные накладные
                                    </button>
                                    <button onclick="ProductCardsManager.exportDirectory('writeoffs')" class="btn btn-secondary" style="text-align: left; padding: 0.75rem;">
                                        ➖ Акт списания
                                    </button>
                                    <button onclick="ProductCardsManager.exportDirectory('transfers')" class="btn btn-secondary" style="text-align: left; padding: 0.75rem;">
                                        🔄 Перемещения
                                    </button>
                                    <button onclick="ProductCardsManager.exportDirectory('inventory')" class="btn btn-secondary" style="text-align: left; padding: 0.75rem;">
                                        📊 Инвентаризационные ведомости
                                    </button>
                                    <button onclick="ProductCardsManager.exportDirectory('movements')" class="btn btn-secondary" style="text-align: left; padding: 0.75rem;">
                                        📈 Отчёт о движении товаров
                                    </button>
                                </div>
                            </div>
                            
                            <!-- Финансовые данные -->
                            <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 12px;">
                                <h4 style="margin-bottom: 1rem; color: var(--dandy-green);">💼 Финансовые данные</h4>
                                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                    <button onclick="ProductCardsManager.exportDirectory('sales')" class="btn btn-secondary" style="text-align: left; padding: 0.75rem;">
                                        💰 Отчёт о продажах
                                    </button>
                                    <button onclick="ProductCardsManager.exportDirectory('profit')" class="btn btn-secondary" style="text-align: left; padding: 0.75rem;">
                                        📊 Валовая прибыль
                                    </button>
                                </div>
                            </div>
                            
                            <!-- Полное меню -->
                            <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 12px;">
                                <h4 style="margin-bottom: 1rem; color: var(--dandy-green);">🌐 Полное меню</h4>
                                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                    <button onclick="ProductCardsManager.exportDirectory('full_menu_json')" class="btn btn-secondary" style="text-align: left; padding: 0.75rem;">
                                        📄 Меню (JSON)
                                    </button>
                                    <button onclick="ProductCardsManager.exportDirectory('full_menu_yml')" class="btn btn-secondary" style="text-align: left; padding: 0.75rem;">
                                        📄 Меню (YML)
                                    </button>
                                    <button onclick="ProductCardsManager.exportDirectory('full_menu_csv')" class="btn btn-secondary" style="text-align: left; padding: 0.75rem;">
                                        📄 Меню (CSV)
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Закрыть</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
        },
        
        // Экспорт справочника
        async exportDirectory(type) {
            try {
                let data = [];
                let filename = '';
                let format = 'csv';
                
                switch(type) {
                    case 'categories':
                        await this.loadCategories();
                        data = this.categories.map(cat => ({
                            slug: cat.slug || '',
                            parent_slug: cat.parent_id ? (this.categories.find(c => c.id === cat.parent_id)?.slug || '') : '',
                            category_name: cat.name || '',
                            type: cat.type || 'menu',
                            display_on_site: cat.show_on_site ? 1 : 0,
                            display_in_nav: cat.show_in_nav ? 1 : 0,
                            sort_order: cat.position || 0
                        }));
                        filename = `categories_${new Date().toISOString().split('T')[0]}.csv`;
                        break;
                        
                    case 'ingredients':
                        // Загружаем ингредиенты (если есть API)
                        try {
                            const response = await fetch('/api/ingredients');
                            if (response.ok) {
                                const result = await response.json();
                                data = (result.data || []).map(ing => ({
                                    name: ing.name || '',
                                    unit: ing.unit || '',
                                    purchase_price: ing.purchase_price || 0,
                                    category_stock: ing.category_stock || '',
                                    loss_percentage: ing.loss_percentage || 0
                                }));
                            }
                        } catch (e) {
                            console.warn('API ингредиентов не доступен');
                        }
                        filename = `ingredients_${new Date().toISOString().split('T')[0]}.csv`;
                        break;
                        
                    case 'modifiers':
                        // Экспорт модификаторов
                        try {
                            const response = await fetch('/api/catalog/modifiers', {
                                headers: {
                                    'Authorization': `Bearer ${localStorage.getItem('dandy_auth_token') || localStorage.getItem('token') || ''}`
                                }
                            });
                            if (response.ok) {
                                const result = await response.json();
                                data = (result.data || []).map(group => ({
                                    group_id: group.group_id,
                                    group_name: group.group_name,
                                    options: JSON.stringify(group.options || [])
                                }));
                            }
                        } catch (error) {
                            console.warn('Ошибка экспорта модификаторов:', error);
                            data = [];
                        }
                        filename = `modifiers_${new Date().toISOString().split('T')[0]}.csv`;
                        break;
                        
                    case 'units':
                        // Экспорт единиц измерения (если есть в БД)
                        data = [
                            { unit_code: 'kg', unit_name: 'Килограмм', conversion_factor: 1 },
                            { unit_code: 'g', unit_name: 'Грамм', conversion_factor: 0.001 },
                            { unit_code: 'l', unit_name: 'Литр', conversion_factor: 1 },
                            { unit_code: 'ml', unit_name: 'Миллилитр', conversion_factor: 0.001 },
                            { unit_code: 'pcs', unit_name: 'Штука', conversion_factor: 1 }
                        ];
                        filename = `units_${new Date().toISOString().split('T')[0]}.csv`;
                        break;
                        
                    case 'recipes':
                        // Экспорт техкарт с нутриентами
                        try {
                            const response = await fetch('/api/recipes');
                            if (response.ok) {
                                const result = await response.json();
                                data = (result.data || []).map(recipe => ({
                                    name: recipe.name || '',
                                    output: recipe.output_quantity || 0,
                                    unit: recipe.output_unit || '',
                                    ingredients: JSON.stringify(recipe.ingredients || []),
                                    cost: recipe.cost || 0,
                                    prep_time: recipe.cooking_time || 0,
                                    energy_kcal: recipe.energy_kcal || '',
                                    proteins: recipe.proteins || '',
                                    fats: recipe.fats || '',
                                    carbohydrates: recipe.carbohydrates || ''
                                }));
                            }
                        } catch (e) {
                            console.warn('API рецептов не доступен');
                        }
                        filename = `recipes_${new Date().toISOString().split('T')[0]}.csv`;
                        break;
                        
                    case 'full_menu_json':
                        await this.loadProducts();
                        await this.loadCategories();
                        const menuData = {
                            categories: this.categories,
                            products: this.products.map(p => ({
                                name: p.name,
                                description: p.description,
                                price: p.price,
                                category: this.getProductCategories(p),
                                image: p.image_url,
                                modifiers: [],
                                weight: p.weight,
                                calories: p.calories
                            }))
                        };
                        this.downloadJSON(menuData, `full_menu_${new Date().toISOString().split('T')[0]}.json`);
                        return;
                        
                    case 'full_menu_yml':
                        await this.exportProducts('yml');
                        return;
                        
                    case 'full_menu_csv':
                        await this.exportProducts('csv');
                        return;
                        
                    default:
                        alert('❌ Неизвестный тип экспорта');
                        return;
                }
                
                if (data.length === 0) {
                    alert('❌ Нет данных для экспорта');
                    return;
                }
                
                // Формируем CSV
                const headers = Object.keys(data[0]);
                let csvContent = '\ufeff' + headers.join(',') + '\n';
                
                data.forEach(item => {
                    const row = headers.map(header => {
                        const value = item[header];
                        if (value === null || value === undefined) return '';
                        if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
                        return `"${String(value).replace(/"/g, '""')}"`;
                    });
                    csvContent += row.join(',') + '\n';
                });
                
                // Скачиваем файл
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                link.click();
                window.URL.revokeObjectURL(url);
                
                alert(`✅ Экспорт завершен: ${data.length} записей`);
                
            } catch (error) {
                console.error('Ошибка экспорта:', error);
                alert(`❌ Ошибка экспорта: ${error.message}`);
            }
        },
        
        // Скачивание JSON
        downloadJSON(data, filename) {
            const jsonContent = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
            window.URL.revokeObjectURL(url);
        },
        
        async exportCategories() {
            try {
                const response = await fetch('/api/categories');
                const result = await response.json();
                
                if (!result.success) {
                    throw new Error('Ошибка загрузки категорий');
                }
                
                const categories = result.data;
                const csv = this.categoriesToCSV(categories);
                
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `categories_${new Date().toISOString().split('T')[0]}.csv`;
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                
                alert(`✅ Экспортировано ${categories.length} категорий`);
            } catch (error) {
                console.error('Ошибка экспорта категорий:', error);
                alert(`❌ Ошибка экспорта: ${error.message}`);
            }
        },
        
        categoriesToCSV(categories) {
            const headers = ['id', 'parent_id', 'name', 'slug', 'type', 'description', 'position', 'show_on_site', 'show_in_nav', 'seo_title', 'seo_description', 'seo_keywords'];
            const rows = categories.map(cat => [
                cat.id,
                cat.parent_id || '',
                `"${(cat.name || '').replace(/"/g, '""')}"`,
                cat.slug || '',
                cat.type || 'menu',
                `"${(cat.description || '').replace(/"/g, '""')}"`,
                cat.position ?? cat.sort_order ?? 0,
                cat.show_on_site ? 1 : 0,
                cat.show_in_nav ? 1 : 0,
                `"${(cat.seo_title || '').replace(/"/g, '""')}"`,
                `"${(cat.seo_description || '').replace(/"/g, '""')}"`,
                `"${(cat.seo_keywords || '').replace(/"/g, '""')}"`
            ]);
            
            return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        },
        
        async importCategories(file, modal) {
            if (!file) return;
            
            try {
                const text = await file.text();
                const lines = text.split('\n').filter(l => l.trim());
                if (lines.length < 2) {
                    throw new Error('Файл должен содержать заголовки и данные');
                }
                
                const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
                const categories = [];
                
                for (let i = 1; i < lines.length; i++) {
                    const values = this.parseCSVLine(lines[i]);
                    if (values.length < headers.length) continue;
                    
                    const category = {};
                    headers.forEach((header, idx) => {
                        let value = values[idx] || '';
                        value = value.replace(/^"|"$/g, '').replace(/""/g, '"');
                        
                        if (header === 'id') return; // Пропускаем ID при импорте
                        if (header === 'parent_id' || header === 'position') {
                            category[header] = value ? parseInt(value) : null;
                        } else if (header === 'show_on_site' || header === 'show_in_nav') {
                            category[header] = value === '1' || value === 'true';
                        } else if (header === 'type') {
                            category[header] = (value === 'stock' || value === 'menu') ? value : 'menu';
                        } else {
                            category[header] = value || null;
                        }
                    });
                    
                    if (category.name) {
                        categories.push(category);
                    }
                }
                
                let successCount = 0;
                let errorCount = 0;
                
                for (const cat of categories) {
                    try {
                        const response = await fetch('/api/categories', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(cat)
                        });
                        
                        const result = await response.json();
                        if (result.success) {
                            successCount++;
                        } else {
                            errorCount++;
                        }
                    } catch (e) {
                        errorCount++;
                    }
                }
                
                await this.loadCategories();
                
                // Обновляем интерфейс в зависимости от того, где открыт импорт
                if (modal) {
                    // Модальное окно
                    const categoriesList = modal.querySelector('#categoriesList');
                    if (categoriesList) {
                        categoriesList.innerHTML = this.renderCategoriesList();
                        this.attachCategoryHandlers(modal);
                        this.initCategoryDragDrop(modal);
                        this.setupBulkCategoryHandlers(modal);
                    }
                } else if (this.currentTab === 'categories') {
                    // Вкладка категорий
                    this.renderCategoriesTab();
                }
                
                alert(`✅ Импорт завершен: ${successCount} создано, ${errorCount} ошибок`);
            } catch (error) {
                console.error('Ошибка импорта категорий:', error);
                alert(`❌ Ошибка импорта: ${error.message}`);
            }
        },
        
        parseCSVLine(line) {
            const result = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    if (inQuotes && line[i + 1] === '"') {
                        current += '"';
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    result.push(current);
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current);
            return result;
        },
        
        initCategoryDragDrop(modal) {
            const tbody = modal.querySelector('#categoriesTableBody');
            if (!tbody) return;
            
            let draggedElement = null;
            let draggedCategoryId = null;
            let dropTarget = null;
            
            // Удаляем старые обработчики
            tbody.querySelectorAll('tr').forEach(row => {
                const newRow = row.cloneNode(true);
                row.parentNode.replaceChild(newRow, row);
            });
            
            tbody.querySelectorAll('tr').forEach(row => {
                row.addEventListener('dragstart', (e) => {
                    draggedElement = row;
                    draggedCategoryId = Number(row.dataset.categoryId);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', draggedCategoryId.toString());
                    row.style.opacity = '0.5';
                    row.classList.add('dragging');
                    
                    // Убираем подсветку со всех строк
                    tbody.querySelectorAll('tr').forEach(r => {
                        r.classList.remove('drop-target', 'drop-inside');
                    });
                });
                
                row.addEventListener('dragend', (e) => {
                    row.style.opacity = '1';
                    row.classList.remove('dragging');
                    draggedElement = null;
                    draggedCategoryId = null;
                    dropTarget = null;
                    
                    // Убираем подсветку
                    tbody.querySelectorAll('tr').forEach(r => {
                        r.classList.remove('drop-target', 'drop-inside');
                    });
                });
                
                row.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    
                    if (!draggedElement || row === draggedElement) return;
                    
                    const targetCategoryId = Number(row.dataset.categoryId);
                    const targetLevel = Number(row.dataset.level || 0);
                    const draggedLevel = Number(draggedElement.dataset.level || 0);
                    
                    // Нельзя перемещать категорию в саму себя или в свою подкатегорию
                    if (targetCategoryId === draggedCategoryId) {
                        e.dataTransfer.dropEffect = 'none';
                        return;
                    }
                    
                    // Проверяем, не является ли целевая категория потомком перетаскиваемой
                    let isDescendant = false;
                    let currentRow = row;
                    while (currentRow && currentRow.dataset.parentId) {
                        const parentId = Number(currentRow.dataset.parentId);
                        if (parentId === draggedCategoryId) {
                            isDescendant = true;
                            break;
                        }
                        currentRow = currentRow.previousElementSibling;
                    }
                    
                    if (isDescendant) {
                        e.dataTransfer.dropEffect = 'none';
                        row.classList.remove('drop-target', 'drop-inside');
                        return;
                    }
                    
                    // Определяем, куда перемещаем: внутрь категории или после неё
                    const rect = row.getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    const threshold = rect.height / 3;
                    
                    // Убираем подсветку со всех строк
                    tbody.querySelectorAll('tr').forEach(r => {
                        r.classList.remove('drop-target', 'drop-inside');
                    });
                    
                    if (y < threshold) {
                        // Перемещаем перед категорией (на тот же уровень)
                        row.classList.add('drop-target');
                        dropTarget = { type: 'before', categoryId: targetCategoryId, row };
                    } else if (y > rect.height - threshold) {
                        // Перемещаем после категории (на тот же уровень)
                        row.classList.add('drop-target');
                        dropTarget = { type: 'after', categoryId: targetCategoryId, row };
                    } else {
                        // Перемещаем внутрь категории (делаем подкатегорией)
                        row.classList.add('drop-inside');
                        dropTarget = { type: 'inside', categoryId: targetCategoryId, row };
                    }
                });
                
                row.addEventListener('dragleave', (e) => {
                    row.classList.remove('drop-target', 'drop-inside');
                });
            });
            
            // Сохранение иерархии при отпускании
            tbody.addEventListener('drop', async (e) => {
                e.preventDefault();
                
                if (!draggedElement || !dropTarget) return;
                
                const targetCategoryId = dropTarget.categoryId;
                let newParentId = null;
                let newPosition = 0;
                
                try {
                    if (dropTarget.type === 'inside') {
                        // Перемещаем внутрь категории (делаем подкатегорией)
                        newParentId = targetCategoryId;
                        
                        // Находим позицию среди подкатегорий целевой категории
                        const targetRow = dropTarget.row;
                        const targetLevel = Number(targetRow.dataset.level || 0);
                        let nextSibling = targetRow.nextElementSibling;
                        let position = 0;
                        
                        // Ищем следующую категорию того же или меньшего уровня
                        while (nextSibling) {
                            const nextLevel = Number(nextSibling.dataset.level || 0);
                            if (nextLevel <= targetLevel) break;
                            if (nextLevel === targetLevel + 1 && Number(nextSibling.dataset.parentId) === targetCategoryId) {
                                const cat = this.categories.find(c => c.id === Number(nextSibling.dataset.categoryId));
                                if (cat) {
                                    position = Math.max(position, (cat.position ?? cat.sort_order ?? 0) + 1);
                                }
                            }
                            nextSibling = nextSibling.nextElementSibling;
                        }
                        newPosition = position;
                    } else {
                        // Перемещаем на тот же уровень (до или после)
                        const targetRow = dropTarget.row;
                        const targetParentId = targetRow.dataset.parentId ? Number(targetRow.dataset.parentId) : null;
                        newParentId = targetParentId;
                        
                        const targetCat = this.categories.find(c => c.id === targetCategoryId);
                        if (targetCat) {
                            const basePosition = targetCat.position ?? targetCat.sort_order ?? 0;
                            newPosition = dropTarget.type === 'before' ? basePosition : basePosition + 1;
                        }
                    }
                    
                    // Обновляем категорию через API
                    const response = await fetch(`/api/categories/${draggedCategoryId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            parent_id: newParentId,
                            position: newPosition
                        })
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    
                    const result = await response.json();
                    if (!result.success) {
                        throw new Error(result.error || 'Ошибка обновления категории');
                    }
                    
                    // Перезагружаем категории
                    await this.loadCategories();

                    const categoriesList = modal.querySelector('#categoriesList');
                    if (categoriesList) {
                        categoriesList.innerHTML = this.renderCategoriesList();
                        this.attachCategoryHandlers(modal);
                        this.initCategoryDragDrop(modal);
                        this.setupBulkCategoryHandlers(modal);
                    }
                    
                    console.log(`✅ Категория перемещена: parent_id=${newParentId}, position=${newPosition}`);
                } catch (error) {
                    console.error('Ошибка при сохранении иерархии:', error);
                    alert(`❌ Ошибка при перемещении категории: ${error.message}`);
                } finally {
                    dropTarget = null;
                }
            });
        },
        
        getDragAfterElement(container, y) {
            const draggableElements = [...container.querySelectorAll('tr:not(.dragging)')];
            
            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        },

        async persistCategoryOrder(order) {
            if (!Array.isArray(order) || order.length === 0) {
                return true;
            }

            const normalized = order
                .map((item, index) => {
                    const id = typeof item === 'object' ? Number(item.id) : Number(item);
                    if (!Number.isFinite(id)) {
                        return null;
                    }
                    return { id, position: index };
                })
                .filter(Boolean);

            if (!normalized.length) {
                return true;
            }

            let primaryResult;
            try {
                primaryResult = await this.fetchJson('/api/categories/reorder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ categories: normalized })
                });
            } catch (error) {
                primaryResult = { ok: false, status: 0, data: { error: error.message } };
            }

            if (primaryResult.ok && primaryResult.data?.success) {
                return true;
            }

            const primaryError = primaryResult?.data?.message || primaryResult?.data?.error || `HTTP ${primaryResult?.status}`;
            console.warn('Primary category reorder failed, attempting fallback updates:', primaryError);

            try {
                for (const item of normalized) {
                    const updateResult = await this.fetchJson(`/api/categories/${item.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ position: item.position, sort_order: item.position })
                    });

                    if (!updateResult.ok || updateResult.data?.success !== true) {
                        const fallbackError = updateResult.data?.message || updateResult.data?.error || `HTTP ${updateResult.status}`;
                        throw new Error(fallbackError);
                    }
                }
            } catch (fallbackError) {
                const combinedMessage = fallbackError?.message
                    ? `${primaryError}. Fallback error: ${fallbackError.message}`
                    : primaryError;
                throw new Error(combinedMessage);
            }

            return true;
        },

        validateCategoryDeletion(categoryId) {
            const id = Number(categoryId);
            if (!Number.isFinite(id)) {
                return {
                    ok: false,
                    message: 'Некорректный идентификатор категории'
                };
            }

            const category = this.categories.find(cat => Number(cat.id) === id);
            if (!category) {
                return {
                    ok: false,
                    message: 'Категория не найдена или уже удалена'
                };
            }

            // Подсчитываем реальное количество товаров в категории
            const productCount = this.getCategoryProductCount(id);
            const childCategories = this.categories.filter(cat => Number(cat.parent_id) === id);
            const childCount = childCategories.length;

            if (productCount > 0 || childCount > 0) {
                const parts = [];
                if (productCount > 0) {
                    parts.push(`товаров: ${productCount}`);
                }
                if (childCount > 0) {
                    parts.push(`подкатегорий: ${childCount}`);
                }

                return {
                    ok: false,
                    message: `Нельзя удалить категорию «${category.name}», пока в ней есть ${parts.join(' и ')}.`,
                    productCount,
                    childCount,
                    category
                };
            }

            return {
                ok: true,
                category
            };
        },
        
        attachCategoryHandlers(modal) {
            modal.querySelectorAll('.editCategoryBtn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const categoryId = e.target.closest('tr').dataset.categoryId;
                    this.showEditCategoryForm(modal, categoryId);
                });
            });

            modal.querySelectorAll('.changeCategoryParentBtn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const categoryId = e.target.closest('tr').dataset.categoryId;
                    this.showChangeCategoryParentDialog(categoryId, async () => {
                        await this.loadCategories();
                        const categoriesList = modal.querySelector('#categoriesList');
                        if (categoriesList) {
                            categoriesList.innerHTML = this.renderCategoriesList();
                            this.attachCategoryHandlers(modal);
                            this.initCategoryDragDrop(modal);
                            this.setupBulkCategoryHandlers(modal);
                        }
                    });
                });
            });
            
            modal.querySelectorAll('.deleteCategoryBtn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const categoryId = e.target.closest('tr').dataset.categoryId;
                    await this.deleteCategory(categoryId, modal);
                });
            });
            
            modal.querySelectorAll('.viewCategoryProducts').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const categoryId = e.target.closest('a').dataset.categoryId;
                    this.viewCategoryProducts(categoryId);
                });
            });
        },
        
        async viewCategoryProducts(categoryId) {
            try {
                const response = await fetch(`/api/categories/${categoryId}/products`);
                const result = await response.json();
                
                if (result.success) {
                    const products = result.data;
                    const category = this.categories.find(c => c.id == categoryId);
                    const categoryName = category ? category.name : 'Категория';
                    
                    alert(`Товары в категории "${categoryName}": ${products.length}\n\n${products.map(p => `- ${p.name}`).join('\n')}`);
                }
            } catch (error) {
                console.error('Ошибка при загрузке товаров категории:', error);
                alert('Ошибка при загрузке товаров категории');
            }
        },

        // Подсчет количества товаров в категории
        getCategoryProductCount(categoryId) {
            if (!categoryId || !this.products || this.products.length === 0) {
                return 0;
            }
            
            const catIdStr = String(categoryId);
            let count = 0;
            
            this.products.forEach(product => {
                // Проверяем category_ids
                if (Array.isArray(product.category_ids) && product.category_ids.length > 0) {
                    if (product.category_ids.some(id => String(id) === catIdStr)) {
                        count++;
                        return;
                    }
                }
                
                // Проверяем categories (массив объектов или ID)
                if (Array.isArray(product.categories) && product.categories.length > 0) {
                    if (product.categories.some(c => {
                        const cId = typeof c === 'object' ? c.id : c;
                        return String(cId) === catIdStr;
                    })) {
                        count++;
                        return;
                    }
                }
                
                // Проверяем одиночное поле category
                if (product.category && String(product.category) === catIdStr) {
                    count++;
                    return;
                }
                
                // Проверяем category_name (если совпадает с названием категории)
                if (product.category_name) {
                    const category = this.categories.find(c => String(c.id) === catIdStr);
                    if (category && product.category_name === category.name) {
                        count++;
                    }
                }
            });
            
            return count;
        },
        
        // Построение дерева категорий
        buildCategoryTree(categories) {
            const list = Array.isArray(categories)
                ? categories
                : (Array.isArray(this.categories) ? this.categories : []);
            const categoryMap = new Map();
            const rootCategories = [];
            
            // Создаём карту категорий
            list.forEach(cat => {
                if (!cat) return;
                categoryMap.set(cat.id, { ...cat, children: [] });
            });
            
            // Строим дерево
            list.forEach(cat => {
                if (!cat) return;
                const category = categoryMap.get(cat.id);
                if (cat.parent_id !== null && cat.parent_id !== undefined && cat.parent_id !== '' && categoryMap.has(cat.parent_id)) {
                    const parent = categoryMap.get(cat.parent_id);
                    parent.children.push(category);
                } else {
                    rootCategories.push(category);
                }
            });
            
            // Сортируем по position
            const sortCategories = (cats) => {
                cats.sort((a, b) => {
                    const posA = a.position ?? a.sort_order ?? 0;
                    const posB = b.position ?? b.sort_order ?? 0;
                    return posA - posB;
                });
                cats.forEach(cat => {
                    if (cat.children.length > 0) {
                        sortCategories(cat.children);
                    }
                });
            };
            
            sortCategories(rootCategories);
            return rootCategories;
        },
        
        // Рендер строки категории с поддержкой вложенности
        renderCategoryRow(category, level = 0) {
            const indent = level * 24;
            const productCount = this.getCategoryProductCount(category.id);
            const hasChildren = category.children && category.children.length > 0;
            const showInProductCard = category.show_in_product_card !== false && category.show_in_product_card !== 0;
            
            return `
                <tr data-category-id="${category.id}" 
                    data-parent-id="${category.parent_id || ''}" 
                    data-level="${level}"
                    draggable="true" 
                    class="category-row ${hasChildren ? 'has-children' : ''}"
                    style="border-bottom: 1px solid #dee2e6; cursor: move; ${level > 0 ? 'background: #f8f9fa;' : ''}">
                    <td style="padding: 12px; text-align: center;">
                        <input type="checkbox" class="category-checkbox" value="${category.id}" style="width: 18px; height: 18px; cursor: pointer;">
                    </td>
                    <td style="padding: 12px; text-align: center; color: #999; position: relative;">
                        <span style="display: inline-block; width: ${indent}px;"></span>
                        ${hasChildren ? '📁' : '📄'}
                    </td>
                    <td style="padding: 12px;">
                        <div style="display: flex; align-items: center; padding-left: ${indent}px;">
                            ${level > 0 ? '<span style="color: #999; margin-right: 8px;">└─</span>' : ''}
                            <strong>${this.escapeHtml(category.name || '')}</strong>
                            ${hasChildren ? `<span style="color: #666; font-size: 0.85rem; margin-left: 8px;">(${category.children.length} подкатегорий)</span>` : ''}
                        </div>
                    </td>
                    <td style="padding: 12px;">
                        <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem; font-weight: 500; 
                            background: ${(category.type || 'menu') === 'menu' ? '#e3f2fd' : '#fff3e0'}; 
                            color: ${(category.type || 'menu') === 'menu' ? '#1976d2' : '#f57c00'};">
                            ${(category.type || 'menu') === 'menu' ? '📋 Меню' : '📦 Номенклатура'}
                        </span>
                    </td>
                    <td style="padding: 12px; color: #666; font-size: 0.9rem;">${this.escapeHtml(category.slug || '')}</td>
                    <td style="padding: 12px; text-align: center;">
                        <a href="#" class="viewCategoryProducts" data-category-id="${category.id}" style="color: #007bff; text-decoration: none; font-weight: 600;">
                            ${productCount}
                        </a>
                    </td>
                    <td style="padding: 12px; text-align: center;">
                        <span style="color: ${category.show_on_site ? '#28a745' : '#dc3545'};">
                            ${category.show_on_site ? '✓' : '✗'}
                        </span>
                    </td>
                    <td style="padding: 12px; text-align: center;">
                        <span style="color: ${category.show_in_nav ? '#28a745' : '#dc3545'};">
                            ${category.show_in_nav ? '✓' : '✗'}
                        </span>
                    </td>
                    <td style="padding: 12px; text-align: center;">
                        <span style="color: ${showInProductCard ? '#28a745' : '#dc3545'};">
                            ${showInProductCard ? '✓' : '✗'}
                        </span>
                    </td>
                    <td style="padding: 12px; text-align: center;">
                        <button class="editCategoryBtn" style="padding: 6px 12px; margin: 0 4px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem;">✏️</button>
                        <button class="changeCategoryParentBtn" title="Изменить категорию" style="padding: 6px 12px; margin: 0 4px; background: #17a2b8; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem;">↕️</button>
                        <button class="deleteCategoryBtn" style="padding: 6px 12px; margin: 0 4px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem;">🗑️</button>
                    </td>
                </tr>
                ${hasChildren ? category.children.map(child => this.renderCategoryRow(child, level + 1)).join('') : ''}
            `;
        },

        getCategoryDescendantIds(categoryId) {
            const id = Number(categoryId);
            if (!Number.isFinite(id)) return new Set();

            const categories = Array.isArray(this.categories) ? this.categories : [];
            const childrenByParent = new Map();

            categories.forEach((c) => {
                const cid = Number(c?.id);
                if (!Number.isFinite(cid)) return;

                const pidRaw = c?.parent_id;
                const pid = (pidRaw === null || pidRaw === undefined || pidRaw === '') ? null : Number(pidRaw);
                if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
                childrenByParent.get(pid).push(cid);
            });

            const descendants = new Set();
            const stack = [...(childrenByParent.get(id) || [])];
            while (stack.length) {
                const cur = stack.pop();
                if (!Number.isFinite(cur) || descendants.has(cur)) continue;
                descendants.add(cur);
                const kids = childrenByParent.get(cur) || [];
                kids.forEach((k) => stack.push(k));
            }

            return descendants;
        },

        showChangeCategoryParentDialog(categoryId, onSaved) {
            const id = Number(categoryId);
            const category = this.categories.find(c => Number(c.id) === id);
            if (!category) return;

            const blocked = new Set([id]);
            const descendants = this.getCategoryDescendantIds(id);
            descendants.forEach((d) => blocked.add(d));

            const dialogId = 'changeCatParent-' + Date.now();
            const selectId = dialogId + '-select';

            const options = (Array.isArray(this.categories) ? this.categories : [])
                .filter(c => !blocked.has(Number(c.id)))
                .map(c => `<option value="${c.id}">${this.escapeHtml(c.name || '')}</option>`)
                .join('');

            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.innerHTML = `
                <div class="modal-content" style="max-width: 520px;">
                    <div class="modal-header">
                        <h3>Изменить группу</h3>
                        <button class="modal-close" type="button">×</button>
                    </div>
                    <div class="modal-body">
                        <div style="margin-bottom: 1rem; color: #6b7280; font-size: 0.95rem;">${this.escapeHtml(category.name || '')}</div>
                        <label style="display:block; font-weight:600; margin-bottom:0.5rem;">Родительская категория</label>
                        <select id="${selectId}" class="form-input" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                            <option value="">Сделать корневой</option>
                            ${options}
                        </select>
                        <div style="display:flex; gap: 0.75rem; justify-content:flex-end; margin-top: 1.25rem;">
                            <button type="button" class="btn btn-secondary" data-cancel style="background:#6c757d; color:#fff; border:none; padding:0.6rem 1rem; border-radius:10px; cursor:pointer;">Отмена</button>
                            <button type="button" class="btn btn-primary" data-save style="background: var(--dandy-green); color:#fff; border:none; padding:0.6rem 1rem; border-radius:10px; cursor:pointer;">Сохранить</button>
                        </div>
                    </div>
                </div>
            `;

            const close = () => {
                try { overlay.remove(); } catch (_) {}
            };

            overlay.querySelector('.modal-close')?.addEventListener('click', close);
            overlay.querySelector('[data-cancel]')?.addEventListener('click', close);
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close();
            });

            overlay.querySelector('[data-save]')?.addEventListener('click', async () => {
                const parentValue = overlay.querySelector('#' + selectId)?.value ?? '';
                const parentId = parentValue ? Number(parentValue) : null;
                if (parentId !== null && parentId === id) {
                    alert('Нельзя назначить родителем саму категорию');
                    return;
                }
                if (parentId !== null && blocked.has(parentId)) {
                    alert('Нельзя назначить родителем дочернюю категорию');
                    return;
                }
                try {
                    const response = await fetch(`/api/categories/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ parent_id: parentId })
                    });
                    const result = await response.json().catch(() => ({}));
                    if (!response.ok || !result.success) {
                        throw new Error(result.error || result.message || 'Ошибка обновления категории');
                    }
                    close();
                    if (typeof onSaved === 'function') {
                        await onSaved();
                    }
                } catch (error) {
                    console.error('Ошибка обновления родителя категории:', error);
                    alert(`❌ Ошибка: ${error.message}`);
                }
            });

            document.body.appendChild(overlay);
        },
        
        renderCategoriesList() {
            if (!this.categories || this.categories.length === 0) {
                return '<p style="text-align: center; color: #999; padding: 2rem;">Нет категорий. Добавьте первую категорию.</p>';
            }
            
            // Строим дерево категорий
            const tree = this.buildCategoryTree(this.categories);
            
            return `
                <div style="margin-bottom: 1rem; padding: 0.75rem; background: #e3f2fd; border-radius: 8px; font-size: 0.9rem;">
                    💡 <strong>Иерархия категорий:</strong> Перетащите категорию на другую, чтобы сделать её подкатегорией. 
                    Перетащите на пустое место, чтобы сделать основной категорией.
                </div>
                <table style="width: 100%; border-collapse: collapse;" id="categoriesTable">
                    <thead>
                        <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                            <th style="padding: 12px; text-align: center; font-weight: 600; width: 40px;">
                                <input type="checkbox" id="selectAllCategories" style="width: 18px; height: 18px; cursor: pointer;">
                            </th>
                            <th style="padding: 12px; text-align: left; font-weight: 600; width: 30px;">☰</th>
                            <th style="padding: 12px; text-align: left; font-weight: 600;">Название</th>
                            <th style="padding: 12px; text-align: left; font-weight: 600;">Тип</th>
                            <th style="padding: 12px; text-align: left; font-weight: 600;">ДОПЫ</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600;">Товаров</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600;">На сайте</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600;">В навигации</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600;">В карточке</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600;">Действия</th>
                        </tr>
                    </thead>
                    <tbody id="categoriesTableBody">
                        ${tree.map(cat => this.renderCategoryRow(cat, 0)).join('')}
                    </tbody>
                </table>
            `;
        },

        showAddCategoryForm(modal) {
            const parentOptions = this.categories
                .filter(c => !c.parent_id)
                .map(c => `<option value="${c.id}">${this.escapeHtml(c.name)}</option>`)
                .join('');
            
            const formHtml = `
                <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 12px; margin-top: 1.5rem;">
                    <h4 style="margin-bottom: 1rem;">Добавить категорию</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div>
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Название *</label>
                            <input type="text" id="newCategoryName" class="form-input" placeholder="Например: Пицца" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Тип категории *</label>
                            <select id="newCategoryType" class="form-input" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                                <option value="menu" selected>📋 Категория меню (для отображения на сайте)</option>
                                <option value="stock">📦 Категория номенклатуры (складская, для учёта)</option>
                            </select>
                            <small style="color: #666; font-size: 0.85em; margin-top: 0.25rem; display: block;">
                                💡 <strong>Меню</strong> — отображается на сайте для клиентов<br>
                                💡 <strong>Номенклатура</strong> — используется для складского учёта и отчётов
                            </small>
                        </div>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Родительская категория</label>
                        <select id="newCategoryParentId" class="form-input" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                            <option value="">Нет (основная категория)</option>
                            ${parentOptions}
                        </select>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Slug (автоматически)</label>
                        <input type="text" id="newCategorySlug" class="form-input" placeholder="pizza" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Описание</label>
                        <textarea id="newCategoryDescription" class="form-input" rows="3" placeholder="Краткое описание категории" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px; resize: vertical;"></textarea>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div>
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Порядок сортировки</label>
                            <input type="number" id="newCategoryPosition" class="form-input" value="0" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Изображение (URL)</label>
                            <input type="text" id="newCategoryImageUrl" class="form-input" placeholder="https://..." style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                        </div>
                    </div>
                    <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="checkbox" id="newCategoryShowOnSite" checked style="width: 18px; height: 18px;">
                            <span>Показывать на сайте</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="checkbox" id="newCategoryShowInNav" checked style="width: 18px; height: 18px;">
                            <span>Показывать в навигации</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="checkbox" id="newCategoryShowInProductCard" checked style="width: 18px; height: 18px;">
                            <span>Показывать в карточке товара</span>
                        </label>
                    </div>
                    <details style="margin-bottom: 1rem;">
                        <summary style="cursor: pointer; font-weight: 600; padding: 0.5rem; background: #e9ecef; border-radius: 4px;">SEO настройки (опционально)</summary>
                        <div style="margin-top: 1rem; padding: 1rem; background: white; border-radius: 8px;">
                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">SEO Title</label>
                                <input type="text" id="newCategorySeoTitle" class="form-input" placeholder="Мета-заголовок" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                            </div>
                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">SEO Description</label>
                                <textarea id="newCategorySeoDescription" class="form-input" rows="2" placeholder="Мета-описание" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;"></textarea>
                            </div>
                            <div>
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">SEO Keywords</label>
                                <input type="text" id="newCategorySeoKeywords" class="form-input" placeholder="ключевые, слова, через, запятую" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                            </div>
                        </div>
                    </details>
                    <div style="display: flex; gap: 1rem;">
                        <button id="saveCategoryBtn" class="btn btn-primary" style="background: var(--dandy-green); color: #fff; border: none; padding: 0.75rem 1.5rem; border-radius: 10px; cursor: pointer;">💾 Сохранить</button>
                        <button onclick="this.closest('.modal-body').querySelector('[style*=\"background: #f8f9fa\"]').remove()" class="btn btn-secondary" style="background: #6c757d; color: #fff; border: none; padding: 0.75rem 1.5rem; border-radius: 10px; cursor: pointer;">Отмена</button>
                    </div>
                </div>
            `;
            
            const categoriesList = modal.querySelector('#categoriesList');
            const existingForm = categoriesList.nextElementSibling;
            if (existingForm && existingForm.style.background === 'rgb(248, 249, 250)') {
                existingForm.remove();
            }
            categoriesList.insertAdjacentHTML('afterend', formHtml);
            
            const saveBtn = document.getElementById('saveCategoryBtn');
            const nameInput = document.getElementById('newCategoryName');
            const slugInput = document.getElementById('newCategorySlug');
            
            if (saveBtn) {
                saveBtn.addEventListener('click', async () => {
                    await this.saveCategory(modal, null);
                });
            }
            
            // Автогенерация slug из названия
            if (nameInput && slugInput) {
                nameInput.addEventListener('input', (e) => {
                    if (!slugInput.value || slugInput.dataset.autoGenerated === 'true') {
                        const slug = e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9а-яё]+/g, '-')
                            .replace(/^-+|-+$/g, '');
                        slugInput.value = slug;
                        slugInput.dataset.autoGenerated = 'true';
                    }
                });
                slugInput.addEventListener('input', () => {
                    slugInput.dataset.autoGenerated = 'false';
                });
            }
        },

        showEditCategoryForm(modal, categoryId) {
            const category = this.categories.find(c => c.id == categoryId);
            if (!category) return;
            
            const parentOptions = this.categories
                .filter(c => !c.parent_id && c.id != categoryId)
                .map(c => `<option value="${c.id}" ${c.id == category.parent_id ? 'selected' : ''}>${this.escapeHtml(c.name)}</option>`)
                .join('');
            
            const formHtml = `
                <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 12px; margin-top: 1.5rem;">
                    <h4 style="margin-bottom: 1rem;">Редактировать категорию</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div>
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Название *</label>
                            <input type="text" id="editCategoryName" class="form-input" value="${this.escapeHtml(category.name || '')}" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Тип категории *</label>
                            <select id="editCategoryType" class="form-input" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                                <option value="menu" ${(category.type || 'menu') === 'menu' ? 'selected' : ''}>📋 Категория меню (для отображения на сайте)</option>
                                <option value="stock" ${category.type === 'stock' ? 'selected' : ''}>📦 Категория номенклатуры (складская, для учёта)</option>
                            </select>
                            <small style="color: #666; font-size: 0.85em; margin-top: 0.25rem; display: block;">
                                💡 <strong>Меню</strong> — отображается на сайте для клиентов<br>
                                💡 <strong>Номенклатура</strong> — используется для складского учёта и отчётов
                            </small>
                        </div>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Родительская категория</label>
                        <select id="editCategoryParentId" class="form-input" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                            <option value="">Нет (основная категория)</option>
                            ${parentOptions}
                        </select>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Slug</label>
                        <input type="text" id="editCategorySlug" class="form-input" value="${this.escapeHtml(category.slug || '')}" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Описание</label>
                        <textarea id="editCategoryDescription" class="form-input" rows="3" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px; resize: vertical;">${this.escapeHtml(category.description || '')}</textarea>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div>
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Порядок сортировки</label>
                            <input type="number" id="editCategoryPosition" class="form-input" value="${category.position ?? category.sort_order ?? 0}" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Изображение (URL)</label>
                            <input type="text" id="editCategoryImageUrl" class="form-input" value="${this.escapeHtml(category.image_url || '')}" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                        </div>
                    </div>
                    <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="checkbox" id="editCategoryShowOnSite" ${category.show_on_site ? 'checked' : ''} style="width: 18px; height: 18px;">
                            <span>Показывать на сайте</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="checkbox" id="editCategoryShowInNav" ${category.show_in_nav ? 'checked' : ''} style="width: 18px; height: 18px;">
                            <span>Показывать в навигации</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="checkbox" id="editCategoryShowInProductCard" ${(category.show_in_product_card !== false && category.show_in_product_card !== 0) ? 'checked' : ''} style="width: 18px; height: 18px;">
                            <span>Показывать в карточке товара</span>
                        </label>
                    </div>
                    <details style="margin-bottom: 1rem;">
                        <summary style="cursor: pointer; font-weight: 600; padding: 0.5rem; background: #e9ecef; border-radius: 4px;">SEO настройки</summary>
                        <div style="margin-top: 1rem; padding: 1rem; background: white; border-radius: 8px;">
                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">SEO Title</label>
                                <input type="text" id="editCategorySeoTitle" class="form-input" value="${this.escapeHtml(category.seo_title || '')}" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                            </div>
                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">SEO Description</label>
                                <textarea id="editCategorySeoDescription" class="form-input" rows="2" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">${this.escapeHtml(category.seo_description || '')}</textarea>
                            </div>
                            <div>
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">SEO Keywords</label>
                                <input type="text" id="editCategorySeoKeywords" class="form-input" value="${this.escapeHtml(category.seo_keywords || '')}" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                            </div>
                        </div>
                    </details>
                    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                        <button id="updateCategoryBtn" class="btn btn-primary" data-category-id="${categoryId}" style="background: var(--dandy-green); color: #fff; border: none; padding: 0.75rem 1.5rem; border-radius: 10px; cursor: pointer;">💾 Сохранить</button>
                        <button id="changeCategoryParentFromEditBtn-${categoryId}" type="button" class="btn btn-secondary" style="background: #17a2b8; color: #fff; border: none; padding: 0.75rem 1.5rem; border-radius: 10px; cursor: pointer;">Изменить категорию</button>
                        <button onclick="this.closest('.modal-body').querySelector('[style*=\"background: #f8f9fa\"]').remove()" class="btn btn-secondary" style="background: #6c757d; color: #fff; border: none; padding: 0.75rem 1.5rem; border-radius: 10px; cursor: pointer;">Отмена</button>
                    </div>
                </div>
            `;
            
            const categoriesList = modal.querySelector('#categoriesList');
            const existingForm = categoriesList.nextElementSibling;
            if (existingForm && existingForm.style.background === 'rgb(248, 249, 250)') {
                existingForm.remove();
            }
            categoriesList.insertAdjacentHTML('afterend', formHtml);
            
            const updateBtn = document.getElementById('updateCategoryBtn');
            if (updateBtn) {
                updateBtn.addEventListener('click', async () => {
                    await this.saveCategory(modal, categoryId);
                });
            }

            const changeParentBtn = document.getElementById(`changeCategoryParentFromEditBtn-${categoryId}`);
            if (changeParentBtn) {
                changeParentBtn.addEventListener('click', () => {
                    this.showChangeCategoryParentDialog(categoryId, async () => {
                        await this.loadCategories();
                        const categoriesList = modal.querySelector('#categoriesList');
                        if (categoriesList) {
                            categoriesList.innerHTML = this.renderCategoriesList();
                            this.attachCategoryHandlers(modal);
                            this.initCategoryDragDrop(modal);
                            this.setupBulkCategoryHandlers(modal);
                        }
                    });
                });
            }
        },

        async saveCategory(modal, categoryId) {
            const prefix = categoryId ? 'edit' : 'new';
            const nameInput = document.getElementById(`${prefix}CategoryName`);
            const slugInput = document.getElementById(`${prefix}CategorySlug`);
            const typeInput = document.getElementById(`${prefix}CategoryType`);
            const positionInput = document.getElementById(`${prefix}CategoryPosition`) || document.getElementById(`${prefix}CategorySortOrder`);
            const parentIdInput = document.getElementById(`${prefix}CategoryParentId`);
            const descriptionInput = document.getElementById(`${prefix}CategoryDescription`);
            const imageUrlInput = document.getElementById(`${prefix}CategoryImageUrl`);
            const showOnSiteInput = document.getElementById(`${prefix}CategoryShowOnSite`);
            const showInNavInput = document.getElementById(`${prefix}CategoryShowInNav`);
            const showInProductCardInput = document.getElementById(`${prefix}CategoryShowInProductCard`);
            const seoTitleInput = document.getElementById(`${prefix}CategorySeoTitle`);
            const seoDescriptionInput = document.getElementById(`${prefix}CategorySeoDescription`);
            const seoKeywordsInput = document.getElementById(`${prefix}CategorySeoKeywords`);
            
            if (!nameInput || !nameInput.value.trim()) {
                alert('❌ Введите название категории');
                return;
            }
            
            const data = {
                name: nameInput.value.trim(),
                slug: slugInput ? slugInput.value.trim() : '',
                type: typeInput && typeInput.value ? typeInput.value : 'menu',
                position: positionInput ? parseInt(positionInput.value) || 0 : 0,
                parent_id: parentIdInput && parentIdInput.value ? parseInt(parentIdInput.value) : null,
                description: descriptionInput ? descriptionInput.value.trim() : null,
                image_url: imageUrlInput ? imageUrlInput.value.trim() : null,
                show_on_site: showOnSiteInput ? showOnSiteInput.checked : true,
                show_in_nav: showInNavInput ? showInNavInput.checked : true,
                show_in_product_card: showInProductCardInput ? showInProductCardInput.checked : true,
                seo_title: seoTitleInput ? seoTitleInput.value.trim() : null,
                seo_description: seoDescriptionInput ? seoDescriptionInput.value.trim() : null,
                seo_keywords: seoKeywordsInput ? seoKeywordsInput.value.trim() : null
            };
            
            try {
                const url = categoryId ? `/api/categories/${categoryId}` : '/api/categories';
                const method = categoryId ? 'PUT' : 'POST';
                
                const response = await fetch(url, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    // Перезагружаем категории
                    await this.loadCategories();
                    
                    const categoriesList = modal.querySelector('#categoriesList');
                    if (categoriesList) {
                        categoriesList.innerHTML = this.renderCategoriesList();
                        
                        // Удаляем форму
                        const form = categoriesList.nextElementSibling;
                        if (form && form.style && form.style.background === 'rgb(248, 249, 250)') {
                            form.remove();
                        }
                        
                        // Перепривязываем обработчики
                        this.attachCategoryHandlers(modal);
                        this.initCategoryDragDrop(modal);
                        this.setupBulkCategoryHandlers(modal);
                    }
                    
                    alert(`✅ Категория ${categoryId ? 'обновлена' : 'создана'} успешно!`);
                } else {
                    const errorMsg = result.error || result.message || 'Ошибка сохранения';
                    console.error('Ошибка сохранения категории:', result);
                    throw new Error(errorMsg);
                }
            } catch (error) {
                console.error('Ошибка сохранения категории:', error);
                alert(`❌ Ошибка: ${error.message}`);
            }
        },

        async deleteCategory(categoryId, modal) {
            if (!confirm('Вы уверены, что хотите удалить эту категорию?')) {
                return;
            }
            
            const validation = this.validateCategoryDeletion(categoryId);
            if (!validation.ok) {
                alert(`❌ ${validation.message}`);
                return;
            }

            try {
                const result = await this.fetchJson(`/api/categories/${categoryId}`, {
                    method: 'DELETE'
                });

                if (result.ok && result.data?.success) {
                    await this.loadCategories();
                    const categoriesList = modal.querySelector('#categoriesList');
                    if (categoriesList) {
                        categoriesList.innerHTML = this.renderCategoriesList();
                        this.attachCategoryHandlers(modal);
                        this.initCategoryDragDrop(modal);
                        this.setupBulkCategoryHandlers(modal);
                    }

                    alert('✅ Категория удалена успешно!');
                } else {
                    const message = result.data?.message || result.data?.error || `HTTP ${result.status}`;
                    throw new Error(message);
                }
            } catch (error) {
                console.error('Ошибка удаления категории:', error);
                alert(`❌ Ошибка: ${error.message}`);
            }
        },

        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },
        
        // Модальное окно для специальных форм импорта
        showSpecialImportModal(type) {
            const existingModals = document.querySelectorAll('.modal-overlay');
            existingModals.forEach(modal => modal.remove());
            
            const titles = {
                'modifiers': '🎯 Импорт модификаторов',
                'units': '📏 Импорт единиц измерения',
                'prices': '💰 Массовое обновление цен',
                'nutrition': '🥗 Импорт нутриентов'
            };
            
            const descriptions = {
                'modifiers': 'Импорт модификаторов (соусы, доп. ингредиенты, услуги)',
                'units': 'Импорт справочника единиц измерения',
                'prices': 'Массовое обновление цен товаров и блюд',
                'nutrition': 'Импорт энергетической ценности и нутриентов для товаров и блюд'
            };
            
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content large">
                    <div class="modal-header">
                        <h3>${titles[type] || 'Импорт'}</h3>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                    </div>
                    <div class="modal-body">
                        <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem;">
                            <p style="margin: 0; color: #666;">${descriptions[type] || ''}</p>
                        </div>
                        
                        <div style="margin-bottom: 1.5rem;">
                            <button onclick="ProductCardsManager.downloadImportTemplate('${type}')" 
                                    class="btn btn-secondary" 
                                    style="padding: 0.75rem 1.5rem; background: #6c757d; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                                📥 Скачать шаблон
                            </button>
                        </div>
                        
                        <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem;">
                            <h3 style="margin-bottom: 1rem; font-size: 1.1rem; color: var(--dandy-green);">📂 Выбор файла</h3>
                            <input type="file" id="specialImportFile" accept=".csv,.xlsx,.xls" style="display: none;">
                            <div style="display: flex; align-items: center; gap: 1rem;">
                                <button onclick="document.getElementById('specialImportFile').click()" 
                                        class="btn btn-primary" 
                                        style="background: var(--dandy-green); color: #fff; border: none; padding: 0.75rem 1.5rem; border-radius: 10px; cursor: pointer; font-weight: 600;">
                                    🗂️ Выберите файл
                                </button>
                                <span id="specialFileName" style="color: #666; font-weight: 500;">Файл не выбран</span>
                            </div>
                        </div>
                        
                        <div id="specialImportPreview" style="display: none; margin-bottom: 1.5rem;">
                            <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; color: var(--dandy-green);">Предпросмотр:</h3>
                            <div id="specialImportPreviewContent"></div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Отмена</button>
                        <button class="btn btn-primary" id="specialImportBtn" onclick="ProductCardsManager.processSpecialImport('${type}')" disabled>Импортировать</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Обработчик выбора файла
            const fileInput = document.getElementById('specialImportFile');
            if (fileInput) {
                fileInput.addEventListener('change', async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const fileName = document.getElementById('specialFileName');
                        if (fileName) fileName.textContent = file.name;
                        
                        try {
                            const text = await this.readFileAsText(file, 'UTF-8');
                            await this.previewSpecialImport(type, text);
                            
                            const importBtn = document.getElementById('specialImportBtn');
                            if (importBtn) importBtn.disabled = false;
                            
                            this.specialImportFile = file;
                        } catch (error) {
                            console.error('Ошибка чтения файла:', error);
                            alert(`❌ Ошибка: ${error.message}`);
                        }
                    }
                });
            }
        },
        
        // Предпросмотр специального импорта
        async previewSpecialImport(type, text) {
            const lines = text.split('\n').filter(line => line.trim());
            if (lines.length < 2) {
                alert('❌ Файл должен содержать заголовки и данные');
                return;
            }
            
            const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            const previewRows = lines.slice(1, 6); // Первые 5 строк для предпросмотра
            
            const previewContent = document.getElementById('specialImportPreviewContent');
            const previewDiv = document.getElementById('specialImportPreview');
            
            if (previewContent && previewDiv) {
                let html = `
                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px;">
                            <thead>
                                <tr style="background: var(--dandy-green); color: white;">
                                    ${headers.map(h => `<th style="padding: 8px; text-align: left;">${this.escapeHtml(h)}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                `;
                
                previewRows.forEach(row => {
                    const values = row.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                    html += '<tr>';
                    headers.forEach((_, i) => {
                        html += `<td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${this.escapeHtml(values[i] || '')}</td>`;
                    });
                    html += '</tr>';
                });
                
                html += `
                            </tbody>
                        </table>
                        <div style="margin-top: 0.5rem; color: #666; font-size: 0.9rem;">
                            Всего строк: ${lines.length - 1} (показано первых 5)
                        </div>
                    </div>
                `;
                
                previewContent.innerHTML = html;
                previewDiv.style.display = 'block';
            }
        },
        
        // Обработка специального импорта
        async processSpecialImport(type) {
            if (!this.specialImportFile) {
                alert('❌ Выберите файл для импорта');
                return;
            }
            
            const importBtn = document.getElementById('specialImportBtn');
            if (importBtn) {
                importBtn.disabled = true;
                importBtn.textContent = '⏳ Импортируем...';
            }
            
            try {
                const formData = new FormData();
                formData.append('file', this.specialImportFile);
                formData.append('importType', type);
                
                const response = await fetch(`/api/import/${type}`, {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (!response.ok || !result.success) {
                    throw new Error(result.error || result.message || 'Ошибка импорта');
                }
                
                alert(`✅ Импорт завершен!\n\nСоздано: ${result.created || 0}\nОбновлено: ${result.updated || 0}\nОшибок: ${result.errors || 0}`);
                
                // Закрываем модальное окно
                const modal = document.querySelector('.modal-overlay');
                if (modal) modal.remove();
                
                // Обновляем данные
                await this.loadProducts();
                
            } catch (error) {
                console.error('Ошибка специального импорта:', error);
                alert(`❌ Ошибка импорта: ${error.message}`);
            } finally {
                if (importBtn) {
                    importBtn.disabled = false;
                    importBtn.textContent = 'Импортировать';
                }
            }
        },
        // Экспорт товаров в CSV, Excel или YML
        async exportProducts(format = 'csv') {
            if (format === 'yml') {
                // Используем серверный endpoint для экспорта YML (Яндекс.Маркет)
                try {
                    // Проверяем наличие товаров
                    if (!this.products || this.products.length === 0) {
                        throw new Error('Нет товаров для экспорта. Сначала загрузите товары.');
                    }
                    
                    const response = await fetch('/api/products/export/yml');
                    if (!response.ok) {
                        if (response.status === 404) {
                            throw new Error('Endpoint экспорта YML не найден. Убедитесь, что товары загружены в систему.');
                        }
                        const error = await response.json().catch(() => ({ error: 'Ошибка экспорта' }));
                        throw new Error(error.error || error.message || 'Ошибка экспорта YML');
                    }
                    
                    // Получаем файл как blob
                    const blob = await response.blob();
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    
                    // Получаем имя файла из заголовков или используем по умолчанию
                    const contentDisposition = response.headers.get('Content-Disposition');
                    let filename = `dandy_products_${new Date().toISOString().split('T')[0]}.yml`;
                    if (contentDisposition) {
                        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
                        if (filenameMatch) {
                            filename = filenameMatch[1];
                        }
                    }
                    
                    link.download = filename;
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    
                    // Получаем количество товаров для сообщения
                    const productCount = this.products.length || 'все';
                    alert(`✅ Экспорт YML для Яндекс.Маркета завершен (${productCount} товаров)`);
                } catch (error) {
                    console.error('Ошибка экспорта YML:', error);
                    alert(`❌ Ошибка экспорта YML: ${error.message}`);
                }
                return;
            }
            
            // CSV/Excel экспорт (локальный)
            if (this.products.length === 0) {
                alert('❌ Нет товаров для экспорта');
                return;
            }

            // Расширенные заголовки согласно ТЗ
            const headers = [
                'type',           // product/dish/ingredient
                'name',           // Название
                'sku',            // SKU/Артикул
                'description',    // Описание
                'short_description', // Краткое описание
                'price',          // Цена продажи
                'cost',           // Себестоимость
                'old_price',      // Старая цена
                'weight',         // Вес/объём
                'calories',       // Ккал
                'ingredients',    // Состав
                'allergens',      // Аллергены
                'category_menu',  // Категория меню
                'category_stock', // Категория номенклатуры
                'slug',           // URL slug
                'image_url',      // URL изображения
                'status',         // active/inactive
                'visible_on_site', // Отображать на сайте
                'stock_quantity', // Остаток на складе
                'barcode'         // Штрих-код
            ];
            
            let csvContent = headers.join(',') + '\n';
            
            this.products.forEach(product => {
                const categories = this.getProductCategories(product);
                const categoryMenu = categories.length > 0 ? categories[0] : '';
                const categoryStock = product.category_stock || '';
                
                const row = [
                    'product', // Тип по умолчанию
                    `"${(product.name || '').replace(/"/g, '""')}"`,
                    `"${(product.sku || '').replace(/"/g, '""')}"`,
                    `"${(product.description || product.full_description || '').replace(/"/g, '""')}"`,
                    `"${(product.short_description || '').replace(/"/g, '""')}"`,
                    product.price || 0,
                    product.cost || 0,
                    product.old_price || '',
                    `"${(product.weight || '').replace(/"/g, '""')}"`,
                    product.calories || '',
                    `"${(product.ingredients || '').replace(/"/g, '""')}"`,
                    `"${(product.allergens || '').replace(/"/g, '""')}"`,
                    `"${categoryMenu.replace(/"/g, '""')}"`,
                    `"${categoryStock.replace(/"/g, '""')}"`,
                    `"${(product.slug || '').replace(/"/g, '""')}"`,
                    `"${(product.image_url || '').replace(/"/g, '""')}"`,
                    product.visible_on_site ? 'active' : 'inactive',
                    product.visible_on_site ? 'Да' : 'Нет',
                    product.stock_quantity || 0,
                    `"${(product.barcode || '').replace(/"/g, '""')}"`
                ];
                csvContent += row.join(',') + '\n';
            });
            
            // Создаем и скачиваем файл
            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' }); // BOM для Excel
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            const extension = format === 'excel' ? 'xlsx' : 'csv';
            link.setAttribute('href', url);
            link.setAttribute('download', `dandy_products_${new Date().toISOString().split('T')[0]}.${extension}`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            alert(`✅ Экспорт завершен (${this.products.length} товаров)`);
        },

        // Скачать шаблон для импорта
        async downloadImportTemplate(type = 'products') {
            let headers = [];
            let filename = '';
            let exampleRows = [];

            switch(type) {
                case 'products':
                    headers = [
                        'type', 'name', 'sku', 'description', 'short_description', 
                        'price', 'cost', 'old_price', 'weight', 'calories', 
                        'ingredients', 'allergens', 'category_menu', 'category_stock', 
                        'slug', 'image_url', 'status'
                    ];
                    exampleRows = [
                        ['product', 'Пицца Маргарита', 'PIZZA-001', 'Классическая пицца с томатами и моцареллой', 'Пицца Маргарита', '599', '240', '', '550г', '850 ккал', 'тесто, томатный соус, моцарелла, базилик', 'глютен, лактоза', 'Пицца', 'Готовая продукция', 'pizza-margarita', 'https://example.com/pizza.jpg', 'active']
                    ];
                    filename = 'template_products.csv';
                    break;
                case 'dishes':
                    headers = [
                        'type', 'name', 'description', 'price', 'cost', 'weight', 
                        'calories', 'ingredients', 'category_menu', 'yield', 
                        'prep_time', 'ingredient:quantity'
                    ];
                    exampleRows = [
                        ['dish', 'Пицца Пепперони', 'Пицца с колбасой пепперони', '699', '280', '600г', '950 ккал', 'тесто, соус, пепперони, сыр', 'Пицца', '1 порция', '15', 'тесто:300г;соус:50г;пепперони:100г;сыр:150г']
                    ];
                    filename = 'template_dishes.csv';
                    break;
                case 'categories':
                    headers = ['slug', 'parent_slug', 'category_name', 'type', 'display_on_site', 'display_in_nav', 'sort_order'];
                    exampleRows = [
                        ['pizza', '', 'Пицца', 'menu', 'Да', 'Да', '1'],
                        ['pizza-25cm', 'pizza', 'Пицца 25 см', 'menu', 'Да', 'Да', '1'],
                        ['pizza-32cm', 'pizza', 'Пицца 32 см', 'menu', 'Да', 'Да', '2']
                    ];
                    filename = 'template_categories.csv';
                    break;
                case 'stock':
                    headers = ['Наименование', 'Штрихкод', 'Остаток', 'Ед. изм.', 'Закупочная цена', 'Ставка НДС', 'Категория', 'Тип'];
                    exampleRows = [
                        ['Моцарелла', '4601234567890', '10', 'кг', '450', '20', 'Молочные продукты', 'материал'],
                        ['Томатный соус', '4601234567891', '25', 'л', '120', '20', 'Соусы', 'материал']
                    ];
                    filename = 'template_stock.csv';
                    break;
                default:
                    headers = ['name', 'sku', 'price'];
                    exampleRows = [['Товар 1', 'SKU-001', '100']];
                    filename = 'template.csv';
            }

            // Формируем CSV с заголовками и примерами
            let csvContent = headers.join(',') + '\n';
            
            exampleRows.forEach(row => {
                csvContent += row.map(cell => {
                    const str = String(cell || '');
                    // Экранируем кавычки и оборачиваем в кавычки если есть запятые или кавычки
                    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                        return `"${str.replace(/"/g, '""')}"`;
                    }
                    return str;
                }).join(',') + '\n';
            });

            // Добавляем описание полей
            csvContent += '\n# Описание полей:\n';
            const fieldDescriptions = {
                'type': 'Тип: product (товар), dish (блюдо), ingredient (ингредиент), semi_product (полуфабрикат), modifier (модификатор)',
                'name': 'Название товара/блюда (обязательно)',
                'sku': 'SKU/Артикул (обязательно, уникальный)',
                'price': 'Цена продажи (число)',
                'cost': 'Себестоимость (число)',
                'weight': 'Вес/объём (например: 500г, 30см, 350мл)',
                'calories': 'Калорийность (например: 450 ккал)',
                'category_menu': 'Категория меню (название)',
                'category_stock': 'Категория номенклатуры для склада',
                'status': 'Статус: active (активен) или inactive (неактивен)'
            };

            Object.entries(fieldDescriptions).forEach(([field, desc]) => {
                if (headers.includes(field)) {
                    csvContent += `# ${field}: ${desc}\n`;
                }
            });

            // Создаем и скачиваем файл
            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            alert(`✅ Шаблон "${filename}" скачан!`);
        },

        // Экранирование XML символов
        escapeXml(text) {
            if (!text) return '';
            return String(text)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        },
        // Настроить event listeners
        setupEventListeners() {
            // Будут добавлены по мере необходимости
        },
        // Отрисовать интерфейс управления карточками
        async render() {
            const container = document.getElementById('productCardsContent');
            if (!container) return;

            // Инициализируем текущую вкладку, если её нет
            if (!this.currentTab) {
                this.currentTab = 'products';
            }

            container.innerHTML = `
                <div style="max-width: 1400px; margin: 0 auto; padding: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 1px solid rgba(94, 82, 64, 0.2);">
                        <h1 style="font-size: 24px; font-weight: 600; color: rgba(19, 52, 59, 1); margin: 0;">🛍️ Dandy Витрина - Панель управления</h1>
                        <div style="display: flex; gap: 12px;" id="productCardsActions">
                            ${this.currentTab === 'products' ? `
                            <button class="btn btn--secondary" id="exportCsvBtn" style="display: inline-flex; align-items: center; justify-content: center; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid rgba(94, 82, 64, 0.2); background: rgba(94, 82, 64, 0.12); color: rgba(19, 52, 59, 1);">
                                📊 Экспорт CSV
                            </button>
                            <button class="btn btn--secondary" id="exportYmlBtn" style="display: inline-flex; align-items: center; justify-content: center; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid rgba(94, 82, 64, 0.2); background: rgba(94, 82, 64, 0.12); color: rgba(19, 52, 59, 1);">
                                📄 Экспорт YML
                            </button>
                            <button class="btn btn--secondary" id="showImportBtn" style="display: inline-flex; align-items: center; justify-content: center; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid rgba(94, 82, 64, 0.2); background: rgba(94, 82, 64, 0.12); color: rgba(19, 52, 59, 1);">
                                📥 Импорт
                            </button>
                            <button class="btn btn--danger" id="deleteAllProductsBtn" style="display: inline-flex; align-items: center; justify-content: center; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1); border: none; background: rgba(192, 21, 47, 1); color: rgba(255, 255, 255, 1);">
                                🗑️ Удалить всё
                            </button>
                            <button class="btn btn--primary" id="addProductBtn" style="display: inline-flex; align-items: center; justify-content: center; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1); border: none; background: rgba(33, 128, 141, 1); color: rgba(252, 252, 249, 1);">
                                ➕ Добавить товар
                            </button>
                            ` : ''}
                            ${this.currentTab === 'categories' ? `
                            <button class="btn btn--primary" id="addCategoryBtn" style="display: inline-flex; align-items: center; justify-content: center; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1); border: none; background: rgba(33, 128, 141, 1); color: rgba(252, 252, 249, 1);">
                                ➕ Добавить категорию
                            </button>
                            <button class="btn btn--secondary" id="restoreCategoriesBtn" style="display: inline-flex; align-items: center; justify-content: center; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid rgba(94, 82, 64, 0.2); background: rgba(94, 82, 64, 0.12); color: rgba(19, 52, 59, 1);">
                                🔄 Восстановить категории
                            </button>
                            <button class="btn btn--secondary" id="exportCategoriesBtn" style="display: inline-flex; align-items: center; justify-content: center; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid rgba(94, 82, 64, 0.2); background: rgba(94, 82, 64, 0.12); color: rgba(19, 52, 59, 1);">
                                📥 Экспорт CSV
                            </button>
                            <button class="btn btn--secondary" id="importCategoriesBtn" style="display: inline-flex; align-items: center; justify-content: center; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid rgba(94, 82, 64, 0.2); background: rgba(94, 82, 64, 0.12); color: rgba(19, 52, 59, 1);">
                                📤 Импорт CSV
                            </button>
                            <input type="file" id="importCategoriesFile" accept=".csv" style="display: none;">
                            ` : ''}
                        </div>
                    </div>

                    <!-- Вкладки согласно ТЗ -->
                    <div class="tabs-container" style="margin-bottom: 24px;">
                        <div class="tabs-nav" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 2px solid #e5e5e5;">
                            <button class="tab-button ${this.currentTab === 'products' ? 'active' : ''}" data-tab="products" style="padding: 0.75rem 1.5rem; border: none; background: transparent; color: ${this.currentTab === 'products' ? 'rgba(33, 128, 141, 1)' : '#666'}; font-weight: ${this.currentTab === 'products' ? '700' : '600'}; cursor: pointer; border-bottom: 3px solid ${this.currentTab === 'products' ? 'rgba(33, 128, 141, 1)' : 'transparent'}; transition: all 0.3s ease;">
                                🛍️ Товары
                            </button>
                            <button class="tab-button ${this.currentTab === 'categories' ? 'active' : ''}" data-tab="categories" style="padding: 0.75rem 1.5rem; border: none; background: transparent; color: ${this.currentTab === 'categories' ? 'rgba(33, 128, 141, 1)' : '#666'}; font-weight: ${this.currentTab === 'categories' ? '700' : '600'}; cursor: pointer; border-bottom: 3px solid ${this.currentTab === 'categories' ? 'rgba(33, 128, 141, 1)' : 'transparent'}; transition: all 0.3s ease;">
                                📁 Категории
                            </button>
                            <button class="tab-button ${this.currentTab === 'promo-codes' ? 'active' : ''}" data-tab="promo-codes" style="padding: 0.75rem 1.5rem; border: none; background: transparent; color: ${this.currentTab === 'promo-codes' ? 'rgba(33, 128, 141, 1)' : '#666'}; font-weight: ${this.currentTab === 'promo-codes' ? '700' : '600'}; cursor: pointer; border-bottom: 3px solid ${this.currentTab === 'promo-codes' ? 'rgba(33, 128, 141, 1)' : 'transparent'}; transition: all 0.3s ease;">
                                🎟️ Промокоды
                            </button>
                            <button class="tab-button ${this.currentTab === 'promotions' ? 'active' : ''}" data-tab="promotions" style="padding: 0.75rem 1.5rem; border: none; background: transparent; color: ${this.currentTab === 'promotions' ? 'rgba(33, 128, 141, 1)' : '#666'}; font-weight: ${this.currentTab === 'promotions' ? '700' : '600'}; cursor: pointer; border-bottom: 3px solid ${this.currentTab === 'promotions' ? 'rgba(33, 128, 141, 1)' : 'transparent'}; transition: all 0.3s ease;">
                                🎁 Акции
                            </button>
                        </div>
                    </div>

                    <!-- Контент вкладок -->
                    <div id="productsTabContent" class="tab-content" style="display: ${this.currentTab === 'products' ? 'block' : 'none'};">
                        <div style="display: flex; justify-content: flex-end; align-items: center; gap: 10px; margin: 0 0 12px 0; flex-wrap: wrap;">
                            <button class="btn btn--secondary" id="toggleCategoryFilterBtn" style="display: inline-flex; align-items: center; justify-content: center; padding: 8px 14px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid rgba(94, 82, 64, 0.2); background: rgba(94, 82, 64, 0.12); color: rgba(19, 52, 59, 1);">
                                📂 Категории
                            </button>
                            <div id="categoryFilterPanel" style="display:none; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(94, 82, 64, 0.12); background: rgba(252, 252, 249, 1);">
                                <select id="categoryFilterSelect" style="min-width: 260px; padding: 8px 10px; border: 1px solid rgba(94, 82, 64, 0.2); border-radius: 10px; background: white;">
                                    <option value="">Все категории</option>
                                    <option value="none">Без категории</option>
                                    ${this.buildCategorySelectOptions()}
                                </select>
                                <button class="btn btn-primary" id="applyCategoryFilterBtn" style="display: inline-flex; align-items: center; justify-content: center; padding: 8px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; background: rgba(33, 128, 141, 1); color: rgba(252, 252, 249, 1);">
                                    ✅ Применить
                                </button>
                                <button class="btn btn-secondary" id="resetCategoryFilterBtn" style="display: inline-flex; align-items: center; justify-content: center; padding: 8px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid rgba(94, 82, 64, 0.2); background: rgba(94, 82, 64, 0.12); color: rgba(19, 52, 59, 1);">
                                    ♻️ Сброс
                                </button>
                            </div>
                        </div>
                        <div id="productCardsTable"></div>
                    </div>
                    <div id="categoriesTabContent" class="tab-content" style="display: ${this.currentTab === 'categories' ? 'block' : 'none'};">
                        <div id="categoriesListContainer"></div>
                    </div>
                    <div id="promoCodesTabContent" class="tab-content" style="display: ${this.currentTab === 'promo-codes' ? 'block' : 'none'};">
                        <div style="padding: 2rem; text-align: center; color: #666;">
                            <p>🎟️ Управление промокодами будет реализовано в разделе "Акции"</p>
                        </div>
                    </div>
                    <div id="promotionsTabContent" class="tab-content" style="display: ${this.currentTab === 'promotions' ? 'block' : 'none'};">
                        <div style="padding: 2rem; text-align: center; color: #666;">
                            <p>🎁 Управление акциями доступно в разделе "Акции" в главном меню</p>
                        </div>
                    </div>
                </div>
            `;

            // Загружаем данные перед отрисовкой, если их еще нет
            // НЕ загружаем товары, если они были явно удалены (products.length === 0 после удаления)
            if (!this.products.length && !this._productsExplicitlyDeleted) {
                try {
                    await this.loadCategories();
                    await this.loadProducts();
                } catch (e) {
                    console.error('❌ render preload failed:', e);
                }
            }
            
            // Рендерим контент в зависимости от активной вкладки
            if (this.currentTab === 'products') {
                this.renderProductsTable();
            } else if (this.currentTab === 'categories') {
                this.renderCategoriesTab();
            }
            
            this.attachButtonHandlers();
            this.attachTabHandlers();
            if (this.designPanelOverlay) {
                this.renderDesignPreview();
            }
        },

        // Привязка обработчиков к кнопкам
        attachButtonHandlers() {
            const addProductBtn = document.getElementById('addProductBtn');
            const bulkPhotoBtn = document.getElementById('bulkPhotoBtn');
            const showImportBtn = document.getElementById('showImportBtn');
            const exportCsvBtn = document.getElementById('exportCsvBtn');
            const exportYmlBtn = document.getElementById('exportYmlBtn');
            const deleteAllBtn = document.getElementById('deleteAllProductsBtn');
            const manageCategoriesBtn = document.getElementById('manageCategoriesBtn');

            const toggleCategoryFilterBtn = document.getElementById('toggleCategoryFilterBtn');
            const categoryFilterPanel = document.getElementById('categoryFilterPanel');
            const categoryFilterSelect = document.getElementById('categoryFilterSelect');
            const applyCategoryFilterBtn = document.getElementById('applyCategoryFilterBtn');
            const resetCategoryFilterBtn = document.getElementById('resetCategoryFilterBtn');

            if (addProductBtn) {
                addProductBtn.addEventListener('click', () => this.showAddProductModal());
            }
            if (showImportBtn) {
                showImportBtn.addEventListener('click', () => this.showImportModal());
            }
            if (exportCsvBtn) {
                exportCsvBtn.addEventListener('click', () => this.exportProducts('csv'));
            }
            if (exportYmlBtn) {
                exportYmlBtn.addEventListener('click', () => this.exportProducts('yml'));
            }
            if (deleteAllBtn) {
                deleteAllBtn.addEventListener('click', () => this.deleteAllProducts());
            }
            if (manageCategoriesBtn) {
                manageCategoriesBtn.addEventListener('click', () => this.showCategoriesModal());
            }

            if (toggleCategoryFilterBtn && categoryFilterPanel) {
                toggleCategoryFilterBtn.addEventListener('click', () => {
                    const isHidden = categoryFilterPanel.style.display === 'none' || !categoryFilterPanel.style.display;
                    categoryFilterPanel.style.display = isHidden ? 'flex' : 'none';
                    if (isHidden && categoryFilterSelect) {
                        const current = this.currentFilters.category ?? '';
                        categoryFilterSelect.value = current === null ? '' : String(current);
                    }
                });
            }

            const applyFilter = async () => {
                if (!categoryFilterSelect) return;
                const value = categoryFilterSelect.value;
                this.currentFilters.category = value ? value : null;
                this.currentPage = 1;
                await this.loadProducts();
                this.renderProductsTable();
            };

            if (applyCategoryFilterBtn) {
                applyCategoryFilterBtn.addEventListener('click', () => {
                    applyFilter().catch((e) => {
                        console.error('apply category filter failed', e);
                        alert('❌ Ошибка применения фильтра категорий');
                    });
                });
            }

            if (resetCategoryFilterBtn) {
                resetCategoryFilterBtn.addEventListener('click', async () => {
                    this.currentFilters.category = null;
                    if (categoryFilterSelect) categoryFilterSelect.value = '';
                    this.currentPage = 1;
                    await this.loadProducts();
                    this.renderProductsTable();
                });
            }
            const addCategoryBtn = document.getElementById('addCategoryBtn');
            const restoreCategoriesBtn = document.getElementById('restoreCategoriesBtn');
            const exportCategoriesBtn = document.getElementById('exportCategoriesBtn');
            const importCategoriesBtn = document.getElementById('importCategoriesBtn');
            const importCategoriesFile = document.getElementById('importCategoriesFile');

            if (addCategoryBtn) {
                addCategoryBtn.addEventListener('click', () => {
                    const container = document.getElementById('categoriesListContainer');
                    if (container) {
                        this.showAddCategoryFormInline(container);
                    }
                });
            }
            if (restoreCategoriesBtn) {
                restoreCategoriesBtn.addEventListener('click', async () => {
                    if (!confirm('Восстановить базовые категории (Пицца, Суши, Напитки, Десерты)? Существующие категории не будут удалены.')) {
                        return;
                    }
                    try {
                        const response = await fetch('/api/categories/restore', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' }
                        });
                        const result = await response.json();
                        if (result.success) {
                            await this.loadCategories();
                            this.renderCategoriesTab();
                            alert(`✅ ${result.message}`);
                        } else {
                            throw new Error(result.error || 'Ошибка восстановления');
                        }
                    } catch (error) {
                        console.error('Ошибка восстановления категорий:', error);
                        alert(`❌ Ошибка: ${error.message}`);
                    }
                });
            }
            if (exportCategoriesBtn) {
                exportCategoriesBtn.addEventListener('click', () => this.exportCategories());
            }
            if (importCategoriesBtn && importCategoriesFile) {
                importCategoriesBtn.addEventListener('click', () => importCategoriesFile.click());
                importCategoriesFile.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        this.importCategories(file, null); // null означает, что используется вкладка, а не модальное окно
                    }
                });
            }
        },

        // Привязка обработчиков к вкладкам
        attachTabHandlers() {
            const tabButtons = document.querySelectorAll('.tab-button[data-tab]');
            tabButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const tab = e.target.dataset.tab;
                    this.switchTab(tab);
                });
            });
        },

        // Переключение вкладок
        switchTab(tab) {
            this.currentTab = tab;
            this.render();
        },

        // Рендеринг вкладки категорий
        renderCategoriesTab() {
            const container = document.getElementById('categoriesListContainer');
            if (!container) return;

            const bulkParentOptions = (Array.isArray(this.categories) ? this.categories : [])
                .map(c => `<option value="${c.id}">${this.escapeHtml(c.name || '')}</option>`)
                .join('');

            container.innerHTML = `
                <div style="background: white; border-radius: 12px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <div id="bulkCategoryActions" style="display: none; gap: 0.5rem; align-items: center; margin-bottom: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 8px;">
                        <span id="selectedCategoriesCount" style="font-weight: 600; color: var(--dandy-green);"></span>
                        <button id="bulkShowOnSiteBtn" class="btn btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.9rem;">Показывать на сайте</button>
                        <button id="bulkHideOnSiteBtn" class="btn btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.9rem;">Скрыть на сайте</button>
                        <select id="bulkMoveParentSelect" class="form-input" style="padding: 0.5rem 0.75rem; font-size: 0.9rem; border-radius: 8px; border: 1px solid #ddd; background: #fff; min-width: 220px;">
                            <option value="">Сделать корневой</option>
                            ${bulkParentOptions}
                        </select>
                        <button id="bulkMoveParentBtn" class="btn btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.9rem;">Изменить группу</button>
                        <button id="bulkDeleteCategoriesBtn" class="btn btn-danger" style="padding: 0.5rem 1rem; font-size: 0.9rem; background: #dc3545;">Удалить</button>
                    </div>
                    <div id="categoriesList" style="max-height: 600px; overflow-y: auto;">
                        ${this.renderCategoriesList()}
                    </div>
                </div>
            `;

            // Привязываем обработчики для категорий
            this.attachCategoryHandlersInline(container);
            this.initCategoryDragDropInline(container);
            this.setupBulkCategoryHandlersInline(container);
        },

        // Inline версии функций для работы с категориями во вкладке
        attachCategoryHandlersInline(container) {
            container.querySelectorAll('.editCategoryBtn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const categoryId = e.target.closest('tr').dataset.categoryId;
                    this.showEditCategoryFormInline(container, categoryId);
                });
            });

            container.querySelectorAll('.changeCategoryParentBtn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const categoryId = e.target.closest('tr').dataset.categoryId;
                    this.showChangeCategoryParentDialog(categoryId, async () => {
                        await this.loadCategories();
                        this.renderCategoriesTab();
                    });
                });
            });
            
            container.querySelectorAll('.deleteCategoryBtn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const categoryId = e.target.closest('tr').dataset.categoryId;
                    await this.deleteCategoryInline(container, categoryId);
                });
            });
            
            container.querySelectorAll('.viewCategoryProducts').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const categoryId = e.target.closest('a').dataset.categoryId;
                    this.viewCategoryProducts(categoryId);
                });
            });
        },

        initCategoryDragDropInline(container) {
            const tbody = container.querySelector('#categoriesTableBody');
            if (!tbody) return;
            
            let draggedElement = null;
            
            tbody.querySelectorAll('tr').forEach(row => {
                row.addEventListener('dragstart', (e) => {
                    draggedElement = row;
                    e.dataTransfer.effectAllowed = 'move';
                    row.style.opacity = '0.5';
                });
                
                row.addEventListener('dragend', (e) => {
                    row.style.opacity = '1';
                    draggedElement = null;
                });
                
                row.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    
                    const afterElement = this.getDragAfterElement(tbody, e.clientY);
                    if (afterElement == null) {
                        tbody.appendChild(draggedElement);
                    } else {
                        tbody.insertBefore(draggedElement, afterElement);
                    }
                });
            });
            
            // Сохранение порядка при отпускании
            tbody.addEventListener('drop', async (e) => {
                e.preventDefault();
                const rows = Array.from(tbody.querySelectorAll('tr'));
                const order = rows
                    .map((row, index) => ({ id: Number(row.dataset.categoryId), position: index }))
                    .filter(item => Number.isFinite(item.id));

                try {
                    await this.persistCategoryOrder(order);
                    await this.loadCategories();
                    this.renderCategoriesTab();
                } catch (error) {
                    console.error('Ошибка при сохранении порядка:', error);
                    const message = error?.message ? `Ошибка при сохранении порядка категорий: ${error.message}` : 'Ошибка при сохранении порядка категорий';
                    alert(message);
                }
            });
        },

        setupBulkCategoryHandlersInline(container) {
            const selectAllCheckbox = container.querySelector('#selectAllCategories');
            const categoryCheckboxes = container.querySelectorAll('.category-checkbox');
            const bulkActions = container.querySelector('#bulkCategoryActions');
            const selectedCount = container.querySelector('#selectedCategoriesCount');
            
            if (selectAllCheckbox) {
                selectAllCheckbox.addEventListener('change', (e) => {
                    container.querySelectorAll('.category-checkbox').forEach(cb => cb.checked = e.target.checked);
                    this.updateBulkActionsInline(container);
                });
            }
            
            categoryCheckboxes.forEach(cb => {
                cb.addEventListener('change', () => {
                    this.updateBulkActionsInline(container);
                    const allCheckboxes = container.querySelectorAll('.category-checkbox');
                    const allChecked = Array.from(allCheckboxes).every(c => c.checked);
                    const someChecked = Array.from(allCheckboxes).some(c => c.checked);
                    const selectAll = container.querySelector('#selectAllCategories');
                    if (selectAll) {
                        selectAll.checked = allChecked;
                        selectAll.indeterminate = someChecked && !allChecked;
                    }
                });
            });
            
            const bulkShowBtn = container.querySelector('#bulkShowOnSiteBtn');
            const bulkHideBtn = container.querySelector('#bulkHideOnSiteBtn');
            const bulkDeleteBtn = container.querySelector('#bulkDeleteCategoriesBtn');
            const bulkMoveParentSelect = container.querySelector('#bulkMoveParentSelect');
            const bulkMoveParentBtn = container.querySelector('#bulkMoveParentBtn');
            
            if (bulkShowBtn) {
                bulkShowBtn.onclick = () => this.handleBulkCategoryActionInline(container, 'show_on_site');
            }
            if (bulkHideBtn) {
                bulkHideBtn.onclick = () => this.handleBulkCategoryActionInline(container, 'hide_on_site');
            }
            if (bulkDeleteBtn) {
                bulkDeleteBtn.onclick = () => this.handleBulkCategoryActionInline(container, 'delete');
            }
            if (bulkMoveParentBtn && bulkMoveParentSelect) {
                bulkMoveParentBtn.onclick = () => this.handleBulkCategoryChangeParentInline(container, bulkMoveParentSelect.value);
            }
        },

        updateBulkActionsInline(container) {
            const selected = Array.from(container.querySelectorAll('.category-checkbox:checked')).map(cb => cb.value);
            const bulkActions = container.querySelector('#bulkCategoryActions');
            const selectedCount = container.querySelector('#selectedCategoriesCount');
            
            if (selected.length > 0) {
                bulkActions.style.display = 'flex';
                selectedCount.textContent = `Выбрано: ${selected.length}`;
            } else {
                bulkActions.style.display = 'none';
            }
        },

        async handleBulkCategoryActionInline(container, action) {
            const selected = Array.from(container.querySelectorAll('.category-checkbox:checked')).map(cb => parseInt(cb.value));
            
            if (selected.length === 0) {
                alert('Выберите категории для выполнения действия');
                return;
            }
            
            if (action === 'delete' && !confirm(`Вы уверены, что хотите удалить ${selected.length} категорий?`)) {
                return;
            }
            
            try {
                const apiAction = action === 'show_on_site' ? 'show_on_site' : 
                                 action === 'hide_on_site' ? 'hide_on_site' : 'delete';
                const response = await fetch('/api/categories/bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        category_ids: selected,
                        action: apiAction
                    })
                });
                
                const result = await response.json();
                if (result.success) {
                    await this.loadCategories();
                    this.renderCategoriesTab();
                    alert(`✅ ${result.message || 'Операция выполнена успешно'}`);
                } else {
                    throw new Error(result.error || 'Ошибка выполнения операции');
                }
            } catch (error) {
                console.error('Ошибка массовой операции:', error);
                alert(`❌ Ошибка: ${error.message}`);
            }
        },

        async handleBulkCategoryChangeParentInline(container, parentIdValue) {
            const selected = Array.from(container.querySelectorAll('.category-checkbox:checked')).map(cb => parseInt(cb.value));
            if (selected.length === 0) {
                alert('Выберите категории для выполнения действия');
                return;
            }

            const parentId = (parentIdValue === '' || parentIdValue === null || parentIdValue === undefined) ? null : parseInt(parentIdValue);
            if (parentId !== null && selected.includes(parentId)) {
                alert('Нельзя назначить родителем выбранную категорию');
                return;
            }

            try {
                const errors = [];
                for (const id of selected) {
                    const response = await fetch(`/api/categories/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ parent_id: parentId })
                    });
                    const result = await response.json().catch(() => ({}));
                    if (!response.ok || !result.success) {
                        errors.push(result.error || result.message || `Ошибка обновления категории ${id}`);
                    }
                }

                await this.loadCategories();
                this.renderCategoriesTab();

                if (errors.length) {
                    alert(`⚠️ Обновлено с ошибками: ${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... и ещё ${errors.length - 5}` : ''}`);
                } else {
                    alert(`✅ Группа обновлена для ${selected.length} категорий`);
                }
            } catch (error) {
                console.error('Ошибка изменения родителя категорий:', error);
                alert(`❌ Ошибка: ${error.message}`);
            }
        },

        showAddCategoryFormInline(container) {
            const parentOptions = this.categories
                .filter(c => !c.parent_id)
                .map(c => `<option value="${c.id}">${this.escapeHtml(c.name)}</option>`)
                .join('');
            
            const formHtml = `
                <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem;">
                    <h4 style="margin-bottom: 1rem;">Добавить категорию</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div>
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Название *</label>
                            <input type="text" id="newCategoryName" class="form-input" placeholder="Например: Пицца" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Родительская категория</label>
                            <select id="newCategoryParentId" class="form-input" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                                <option value="">Нет (основная категория)</option>
                                ${parentOptions}
                            </select>
                        </div>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Slug (автоматически)</label>
                        <input type="text" id="newCategorySlug" class="form-input" placeholder="pizza" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Описание</label>
                        <textarea id="newCategoryDescription" class="form-input" rows="3" placeholder="Краткое описание категории" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px; resize: vertical;"></textarea>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div>
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Порядок сортировки</label>
                            <input type="number" id="newCategoryPosition" class="form-input" value="0" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Изображение (URL)</label>
                            <input type="text" id="newCategoryImageUrl" class="form-input" placeholder="https://..." style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                        </div>
                    </div>
                    <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="checkbox" id="newCategoryShowOnSite" checked style="width: 18px; height: 18px;">
                            <span>Показывать на сайте</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="checkbox" id="newCategoryShowInNav" checked style="width: 18px; height: 18px;">
                            <span>Показывать в навигации</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="checkbox" id="newCategoryShowInProductCard" checked style="width: 18px; height: 18px;">
                            <span>Показывать в карточке товара</span>
                        </label>
                    </div>
                    <details style="margin-bottom: 1rem;">
                        <summary style="cursor: pointer; font-weight: 600; padding: 0.5rem; background: #e9ecef; border-radius: 4px;">SEO настройки (опционально)</summary>
                        <div style="margin-top: 1rem; padding: 1rem; background: white; border-radius: 8px;">
                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">SEO Title</label>
                                <input type="text" id="newCategorySeoTitle" class="form-input" placeholder="Мета-заголовок" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                            </div>
                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">SEO Description</label>
                                <textarea id="newCategorySeoDescription" class="form-input" rows="2" placeholder="Мета-описание" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;"></textarea>
                            </div>
                            <div>
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">SEO Keywords</label>
                                <input type="text" id="newCategorySeoKeywords" class="form-input" placeholder="ключевые, слова, через, запятую" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                            </div>
                        </div>
                    </details>
                    <div style="display: flex; gap: 1rem;">
                        <button id="saveNewCategoryBtn" class="btn btn-primary" style="background: var(--dandy-green); color: #fff; border: none; padding: 0.75rem 1.5rem; border-radius: 10px; cursor: pointer;">💾 Сохранить</button>
                        <button onclick="this.closest('[style*=\"background: #f8f9fa\"]').remove()" class="btn btn-secondary" style="background: #6c757d; color: #fff; border: none; padding: 0.75rem 1.5rem; border-radius: 10px; cursor: pointer;">Отмена</button>
                    </div>
                </div>
            `;
            
            const categoriesList = container.querySelector('#categoriesList');
            if (categoriesList) {
                const existingForm = categoriesList.previousElementSibling;
                if (existingForm && existingForm.style && existingForm.style.background === 'rgb(248, 249, 250)') {
                    existingForm.remove();
                }
                categoriesList.insertAdjacentHTML('beforebegin', formHtml);
                
                const saveBtn = document.getElementById('saveNewCategoryBtn');
                if (saveBtn) {
                    saveBtn.addEventListener('click', async () => {
                        await this.saveCategoryInline(container, null);
                    });
                }
                
                // Автогенерация slug из названия
                const nameInput = document.getElementById('newCategoryName');
                const slugInput = document.getElementById('newCategorySlug');
                if (nameInput && slugInput) {
                    nameInput.addEventListener('input', (e) => {
                        if (!slugInput.value || slugInput.dataset.autoGenerated === 'true') {
                            const slug = e.target.value
                                .toLowerCase()
                                .replace(/[^a-z0-9а-яё]+/g, '-')
                                .replace(/^-+|-+$/g, '');
                            slugInput.value = slug;
                            slugInput.dataset.autoGenerated = 'true';
                        }
                    });
                    slugInput.addEventListener('input', () => {
                        slugInput.dataset.autoGenerated = 'false';
                    });
                }
            }
        },

        showEditCategoryFormInline(container, categoryId) {
            const category = this.categories.find(c => c.id == categoryId);
            if (!category) return;
            
            const parentOptions = this.categories
                .filter(c => !c.parent_id && c.id != categoryId)
                .map(c => `<option value="${c.id}" ${c.id == category.parent_id ? 'selected' : ''}>${this.escapeHtml(c.name)}</option>`)
                .join('');
            
            const formHtml = `
                <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem;">
                    <h4 style="margin-bottom: 1rem;">Редактировать категорию</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div>
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Название *</label>
                            <input type="text" id="editCategoryName" class="form-input" value="${this.escapeHtml(category.name || '')}" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Родительская категория</label>
                            <select id="editCategoryParentId" class="form-input" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                                <option value="">Нет (основная категория)</option>
                                ${parentOptions}
                            </select>
                        </div>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Slug</label>
                        <input type="text" id="editCategorySlug" class="form-input" value="${this.escapeHtml(category.slug || '')}" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Описание</label>
                        <textarea id="editCategoryDescription" class="form-input" rows="3" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px; resize: vertical;">${this.escapeHtml(category.description || '')}</textarea>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                        <div>
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Порядок сортировки</label>
                            <input type="number" id="editCategoryPosition" class="form-input" value="${category.position ?? category.sort_order ?? 0}" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Изображение (URL)</label>
                            <input type="text" id="editCategoryImageUrl" class="form-input" value="${this.escapeHtml(category.image_url || '')}" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                        </div>
                    </div>
                    <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="checkbox" id="editCategoryShowOnSite" ${category.show_on_site ? 'checked' : ''} style="width: 18px; height: 18px;">
                            <span>Показывать на сайте</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="checkbox" id="editCategoryShowInNav" ${category.show_in_nav ? 'checked' : ''} style="width: 18px; height: 18px;">
                            <span>Показывать в навигации</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="checkbox" id="editCategoryShowInProductCard" ${(category.show_in_product_card !== false && category.show_in_product_card !== 0) ? 'checked' : ''} style="width: 18px; height: 18px;">
                            <span>Показывать в карточке товара</span>
                        </label>
                    </div>
                    <details style="margin-bottom: 1rem;">
                        <summary style="cursor: pointer; font-weight: 600; padding: 0.5rem; background: #e9ecef; border-radius: 4px;">SEO настройки</summary>
                        <div style="margin-top: 1rem; padding: 1rem; background: white; border-radius: 8px;">
                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">SEO Title</label>
                                <input type="text" id="editCategorySeoTitle" class="form-input" value="${this.escapeHtml(category.seo_title || '')}" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                            </div>
                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">SEO Description</label>
                                <textarea id="editCategorySeoDescription" class="form-input" rows="2" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">${this.escapeHtml(category.seo_description || '')}</textarea>
                            </div>
                            <div>
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">SEO Keywords</label>
                                <input type="text" id="editCategorySeoKeywords" class="form-input" value="${this.escapeHtml(category.seo_keywords || '')}" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                            </div>
                        </div>
                    </details>
                    <div style="display: flex; flex-wrap: wrap; gap: 1rem;">
                        <button id="updateCategoryBtn" class="btn btn-primary" data-category-id="${categoryId}" style="background: var(--dandy-green); color: #fff; border: none; padding: 0.75rem 1.5rem; border-radius: 10px; cursor: pointer;">💾 Сохранить</button>
                        <button id="changeCategoryParentFromEditBtn-${categoryId}" type="button" class="btn btn-secondary" style="background: #17a2b8; color: #fff; border: none; padding: 0.75rem 1.5rem; border-radius: 10px; cursor: pointer;">Изменить категорию</button>
                        <button onclick="this.closest('[style*=\"background: #f8f9fa\"]').remove()" class="btn btn-secondary" style="background: #6c757d; color: #fff; border: none; padding: 0.75rem 1.5rem; border-radius: 10px; cursor: pointer;">Отмена</button>
                    </div>
                </div>
            `;
            
            const categoriesList = container.querySelector('#categoriesList');
            if (categoriesList) {
                const existingForm = categoriesList.previousElementSibling;
                if (existingForm && existingForm.style && existingForm.style.background === 'rgb(248, 249, 250)') {
                    existingForm.remove();
                }
                categoriesList.insertAdjacentHTML('beforebegin', formHtml);
                
                const updateBtn = document.getElementById('updateCategoryBtn');
                if (updateBtn) {
                    updateBtn.addEventListener('click', async () => {
                        await this.saveCategoryInline(container, categoryId);
                    });
                }

                const changeParentBtn = document.getElementById(`changeCategoryParentFromEditBtn-${categoryId}`);
                if (changeParentBtn) {
                    changeParentBtn.addEventListener('click', () => {
                        this.showChangeCategoryParentDialog(categoryId, async () => {
                            await this.loadCategories();
                            this.renderCategoriesTab();
                        });
                    });
                }
            }
        },

        async saveCategoryInline(container, categoryId) {
            const prefix = categoryId ? 'edit' : 'new';
            const nameInput = document.getElementById(`${prefix}CategoryName`);
            const slugInput = document.getElementById(`${prefix}CategorySlug`);
            const positionInput = document.getElementById(`${prefix}CategoryPosition`) || document.getElementById(`${prefix}CategorySortOrder`);
            const parentIdInput = document.getElementById(`${prefix}CategoryParentId`);
            const descriptionInput = document.getElementById(`${prefix}CategoryDescription`);
            const imageUrlInput = document.getElementById(`${prefix}CategoryImageUrl`);
            const showOnSiteInput = document.getElementById(`${prefix}CategoryShowOnSite`);
            const showInNavInput = document.getElementById(`${prefix}CategoryShowInNav`);
            const showInProductCardInput = document.getElementById(`${prefix}CategoryShowInProductCard`);
            const seoTitleInput = document.getElementById(`${prefix}CategorySeoTitle`);
            const seoDescriptionInput = document.getElementById(`${prefix}CategorySeoDescription`);
            const seoKeywordsInput = document.getElementById(`${prefix}CategorySeoKeywords`);
            
            if (!nameInput || !nameInput.value.trim()) {
                alert('❌ Введите название категории');
                return;
            }
            
            const categoryData = {
                name: nameInput.value.trim(),
                slug: slugInput ? slugInput.value.trim() : '',
                position: positionInput ? parseInt(positionInput.value) || 0 : 0,
                parent_id: parentIdInput && parentIdInput.value ? parseInt(parentIdInput.value) : null,
                description: descriptionInput ? descriptionInput.value.trim() : null,
                image_url: imageUrlInput ? imageUrlInput.value.trim() : null,
                show_on_site: showOnSiteInput ? showOnSiteInput.checked : true,
                show_in_nav: showInNavInput ? showInNavInput.checked : true,
                show_in_product_card: showInProductCardInput ? showInProductCardInput.checked : true,
                seo_title: seoTitleInput ? seoTitleInput.value.trim() : null,
                seo_description: seoDescriptionInput ? seoDescriptionInput.value.trim() : null,
                seo_keywords: seoKeywordsInput ? seoKeywordsInput.value.trim() : null
            };
            
            try {
                const url = categoryId ? `/api/categories/${categoryId}` : '/api/categories';
                const method = categoryId ? 'PUT' : 'POST';
                
                const response = await fetch(url, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(categoryData)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    await this.loadCategories();
                    this.renderCategoriesTab();
                    alert(`✅ Категория ${categoryId ? 'обновлена' : 'создана'} успешно!`);
                } else {
                    const errorMsg = result.error || result.message || 'Ошибка сохранения';
                    console.error('Ошибка сохранения категории:', result);
                    throw new Error(errorMsg);
                }
            } catch (error) {
                console.error('Ошибка сохранения категории:', error);
                alert(`❌ Ошибка: ${error.message}`);
            }
        },

        async deleteCategoryInline(container, categoryId) {
            if (!confirm('Вы уверены, что хотите удалить эту категорию?')) {
                return;
            }
            
            const validation = this.validateCategoryDeletion(categoryId);
            if (!validation.ok) {
                alert(`❌ ${validation.message}`);
                return;
            }

            try {
                const result = await this.fetchJson(`/api/categories/${categoryId}`, {
                    method: 'DELETE'
                });

                if (result.ok && result.data?.success) {
                    await this.loadCategories();
                    this.renderCategoriesTab();
                    alert('✅ Категория удалена успешно!');
                } else {
                    const message = result.data?.message || result.data?.error || `HTTP ${result.status}`;
                    throw new Error(message);
                }
            } catch (error) {
                console.error('Ошибка удаления категории:', error);
                alert(`❌ Ошибка: ${error.message}`);
            }
        },

        ensureAddProductStyles() {
            if (document.getElementById('pcm-modal-styles')) return;
            const style = document.createElement('style');
            style.id = 'pcm-modal-styles';
            style.textContent = `@keyframes pcm-spin { to { transform: rotate(360deg); } }`;
            document.head.appendChild(style);
        },

        async onImagesSelected(fileList) {
            const files = Array.from(fileList || []).filter((file) => /image\/(jpeg|jpg|png|webp)/.test(file.type));
            if (!files.length) {
                alert('❌ Поддерживаются JPG/PNG/WebP до 25 МБ');
                return;
            }

            this.isProcessing = true;
            this.renderAddProductModal();

            for (const file of files.slice(0, 64)) {
                try {
                    const dataUrl = await this.fileToDataURL(file);
                    const draft = {
                        id: `${Date.now()}-${Math.random()}`,
                        title: this.inferTitleFromName(file.name),
                        description: '',
                        price: 0,
                        image: dataUrl,
                        original: dataUrl,
                        category: this.lastAttrs.category || 'Без категории',
                        weight: this.lastAttrs.weight || '',
                        calories: this.lastAttrs.calories || '',
                        ingredients: [],
                        allergens: [],
                        hasBgRemoved: false,
                        isProcessing: false,
                        sku: this.generateSku(file.name)
                    };

                    if (this.bgRemovalEnabled) {
                        try {
                            console.log('🔄 Автоудаление фона включено, начинаю обработку...');
                            draft.isProcessing = true;
                            this.renderAddProductModal();
                            const blob = this.dataURLToBlob(dataUrl);
                            console.log('📦 Blob создан, размер:', blob.size, 'тип:', blob.type);
                            if (!blob || blob.size === 0) {
                                throw new Error('Не удалось создать blob из изображения');
                            }
                            const { cutoutDataUrl } = await this.smartCut(blob, { bgThreshold: 240, satTol: 18, feather: 2 });
                            if (!cutoutDataUrl) {
                                throw new Error('smartCut не вернул результат');
                            }
                            draft.image = cutoutDataUrl;
                            draft.hasBgRemoved = true;
                            console.log('✅ Фон успешно удален');
                        } catch (error) {
                            console.error('❌ Ошибка при удалении фона:', error);
                            console.error('Stack:', error.stack);
                            // Оставляем оригинальное изображение если ошибка
                            draft.hasBgRemoved = false;
                        }
                    } else {
                        console.log('ℹ️ Автоудаление фона отключено');
                    }

                    draft.isProcessing = false;
                    this.drafts.push(draft);
                } catch (error) {
                    console.warn('onImagesSelected error', error);
                }
            }

            this.isProcessing = false;
            this.renderAddProductModal();
        },

        async onMenuSelected(file) {
            if (!file) return;

            this.isProcessing = true;
            this.renderAddProductModal();

            try {
                const parsed = await this.parseMenuFile(file);
                const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.products) ? parsed.products : []);
                const normalized = list.map((item, index) => this.normalizeProduct(item, index));

                this.menuMeta = { file: file.name, count: normalized.length };

                const draftMap = new Map(this.drafts.map((draft) => [draft.title?.toLowerCase() || '', draft]));

                normalized.forEach((norm) => {
                    const key = (norm.title || '').toLowerCase();
                    const existing = draftMap.get(key);
                    if (existing) {
                        Object.assign(existing, norm, { hasBgRemoved: existing.hasBgRemoved, image: norm.image || existing.image });
                    } else {
                        this.drafts.push({
                            id: `${Date.now()}-${Math.random()}`,
                            title: norm.title,
                            description: norm.description,
                            price: norm.price,
                            category: norm.category,
                            weight: norm.weight,
                            calories: norm.calories,
                            ingredients: norm.ingredients,
                            allergens: norm.allergens,
                            image: norm.image,
                            original: norm.image,
                            hasBgRemoved: false,
                            isProcessing: false,
                            sku: norm.id || this.generateSku(norm.title)
                        });
                    }
                });

                alert(`✅ Импорт завершен. Обработано ${normalized.length} записей.`);
            } catch (error) {
                console.error('onMenuSelected error', error);
                alert('❌ Ошибка при импорте файла. Проверьте формат.');
            }

            this.isProcessing = false;
            this.renderAddProductModal();
        },

        publishDrafts() {
            if (!this.drafts.length) {
                alert('Нет черновиков для публикации');
                return;
            }

            const confirmed = window.confirm(`Опубликовать ${this.drafts.length} товаров?`);
            if (!confirmed) return;

            const now = Date.now();
            const newProducts = this.drafts.map((draft, index) => ({
                id: draft.id || `${now}-${index}`,
                name: draft.title || `Товар #${index + 1}`,
                description: draft.description || '',
                price: Number(draft.price) || 0,
                image_url: draft.image || '',
                category: draft.category || '',
                categories: draft.category ? [draft.category] : [],
                weight: draft.weight || '',
                calories: draft.calories || '',
                stock_quantity: 0,
                visible_on_site: true,
                hidden_for_promo: false,
                sku: draft.sku || `${now}-${index}`
            }));

            this.products = [...this.products, ...newProducts];
            this.drafts = [];
            this.closeAddProductModal();
            this.closeSegmentationEditor();
            this.renderProductsTable();
            if (typeof this.syncToWebsite === 'function') {
                this.syncToWebsite(true, this.products);
            }

            alert('✅ Черновики перенесены в каталог.');
        },

        clearDrafts() {
            if (!this.drafts.length) return;
            const confirmed = window.confirm('Удалить все черновики?');
            if (!confirmed) return;
            this.drafts = [];
            this.closeSegmentationEditor();
            this.renderAddProductModal();
        },

        updateDraft(id, patch) {
            this.drafts = this.drafts.map((draft) => draft.id === id ? { ...draft, ...patch } : draft);
            this.lastAttrs = { ...this.lastAttrs, ...patch };
            if (this.addProductModalRoot) {
                this.renderAddProductModal();
            }
            if (this.segmentationDraftId === id) {
                this.segmentationCutout = (this.drafts.find((d) => d.id === id)?.image) || null;
                this.updateSegmentationControls();
            }
        },

        removeDraft(id) {
            this.drafts = this.drafts.filter((draft) => draft.id !== id);
            this.renderAddProductModal();
            if (this.segmentationDraftId === id) {
                this.closeSegmentationEditor();
            }
        },

        openSegmentationEditor(draftId) {
            alert('ℹ️ Редактор выделения объекта будет реализован позже.');
        },

        fileToDataURL(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        },

        inferTitleFromName(name) {
            return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
        },

        generateSku(name = '') {
            const base = this.inferTitleFromName(name).replace(/\s+/g, '-').toUpperCase();
            return (base || 'SKU') + '-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        },

        async parseMenuFile(file) {
            const text = await file.text();
            const name = file.name.toLowerCase();
            if (name.endsWith('.json')) return JSON.parse(text);
            if (name.endsWith('.csv')) return this.csvToMenu(text);
            try {
                const yamlLines = text.split(/\r?\n/);
                const items = [];
                let current = null;
                yamlLines.forEach((raw) => {
                    const line = raw.trim();
                    if (!line) return;
                    if (line.startsWith('- ')) {
                        if (current) items.push(current);
                        current = {};
                    } else if (line.includes(':')) {
                        const index = line.indexOf(':');
                        const key = line.slice(0, index).trim().toLowerCase();
                        const value = line.slice(index + 1).trim().replace(/^"|"$/g, '');
                        if (current) current[key] = value;
                    }
                });
                if (current) items.push(current);
                return { products: items };
            } catch (error) {
                console.warn('YAML fallback error', error);
                return { products: [] };
            }
        },

        csvToMenu(csv) {
            const rows = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < csv.length; i++) {
                const ch = csv[i];
                if (ch === '"') {
                    inQuotes = !inQuotes;
                    current += ch;
                    continue;
                }
                if (!inQuotes && (ch === '\n' || ch === '\r')) {
                    if (current.trim()) rows.push(current);
                    current = '';
                    continue;
                }
                current += ch;
            }
            if (current.trim()) rows.push(current);

            const header = this.splitCsvLine(rows.shift() || '').map((h) => h.trim().toLowerCase());
            const alias = (...names) => names.map((n) => header.indexOf(n.toLowerCase())).find((i) => i >= 0) ?? -1;
            const map = {
                title: alias('title', 'name', 'наименование', 'название'),
                description: alias('description', 'desc', 'описание'),
                price: alias('price', 'цена', 'стоимость'),
                weight: alias('weight', 'вес'),
                image: alias('image', 'img', 'imageurl', 'картинка', 'изображение', 'фото'),
                category: alias('category', 'категория', 'раздел'),
                calories: alias('calories', 'ккал'),
                sku: alias('sku', 'артикул', 'id')
            };

            const products = rows.map((row) => {
                const cells = this.splitCsvLine(row);
                const record = {};
                Object.entries(map).forEach(([key, index]) => {
                    if (index >= 0 && index < cells.length) record[key] = this.stripQuotes(cells[index]);
                });
                return record;
            });

            return { products };
        },

        splitCsvLine(line) {
            const out = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '"') {
                    if (inQuotes && line[i + 1] === '"') {
                        current += '"';
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                    continue;
                }
                if (!inQuotes && ch === ',') {
                    out.push(current);
                    current = '';
                    continue;
                }
                current += ch;
            }
            out.push(current);
            return out;
        },

        stripQuotes(value) {
            const trimmed = String(value ?? '').trim();
            if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
                return trimmed.slice(1, -1);
            }
            return trimmed;
        },

        pickFirst(obj, keys, fallback) {
            for (const key of keys) {
                if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
                    return obj[key];
                }
            }
            return fallback;
        },

        normalizeKeys(obj) {
            if (!obj || typeof obj !== 'object') return obj;
            const normalized = {};
            Object.keys(obj).forEach((key) => {
                normalized[String(key).trim().toLowerCase()] = obj[key];
            });
            return normalized;
        },

        synthesizeDescription(title, ingredients) {
            const parts = Array.isArray(ingredients)
                ? ingredients.filter(Boolean)
                : String(ingredients || '').split(/,|;|\r?\n/).map((item) => item.trim()).filter(Boolean);
            if (!parts.length) return '';
            const lead = ['Аппетитная', 'Сочная', 'Классическая', 'Ароматная', 'Нежная'][Math.floor(Math.random() * 5)];
            const core = parts.slice(0, 3).join(', ');
            const ending = ['идеальный баланс вкусов', 'настоящий хит меню', 'отличный выбор на каждый день'][Math.floor(Math.random() * 3)];
            return `${lead} ${title.toLowerCase()}: ${core}. ${ending}.`;
        },

        normalizeProduct(raw, index = 0) {
            const src = this.normalizeKeys(raw);
            const product = {};
            product.id = this.pickFirst(src, FIELD_ALIASES.id, `${Date.now()}-${index}`);
            product.title = this.pickFirst(src, FIELD_ALIASES.title, `Блюдо #${index + 1}`);
            const price = this.pickFirst(src, FIELD_ALIASES.price, 0);
            product.price = Number(String(price).replace(/[^0-9.]/g, '')) || 0;
            product.image = this.pickFirst(src, FIELD_ALIASES.image, '');
            product.category = this.pickFirst(src, FIELD_ALIASES.category, 'Без категории');
            product.weight = this.pickFirst(src, FIELD_ALIASES.weight, '');
            product.calories = this.pickFirst(src, FIELD_ALIASES.calories, '');
            const ing = this.pickFirst(src, FIELD_ALIASES.ingredients, []);
            product.ingredients = Array.isArray(ing) ? ing : String(ing).split(/,|;|\r?\n/).map((item) => item.trim()).filter(Boolean);
            const allergens = this.pickFirst(src, FIELD_ALIASES.allergens, []);
            product.allergens = Array.isArray(allergens) ? allergens : String(allergens).split(/,|;|\r?\n/).map((item) => item.trim()).filter(Boolean);
            const desc = this.pickFirst(src, FIELD_ALIASES.description, '');
            product.description = desc ? String(desc).trim() : this.synthesizeDescription(product.title, product.ingredients);
            return product;
        },

        dataURLToBlob(dataURL) {
            const [header, data] = dataURL.split(',');
            const mime = (header.match(/data:(.*?);base64/) || [])[1] || 'application/octet-stream';
            const binary = atob(data);
            const array = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                array[i] = binary.charCodeAt(i);
            }
            return new Blob([array], { type: mime });
        },

        async getImageBlob(src) {
            try {
                if (!src) return null;
                if (src.startsWith('data:')) return this.dataURLToBlob(src);
                const response = await fetch(src, { mode: 'cors' });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.blob();
            } catch (error) {
                console.warn('getImageBlob error', error);
                return null;
            }
        },

        clamp(value, min, max) {
            return value < min ? min : value > max ? max : value;
        },

        boxBlurAlpha(mask, width, height, radius, passes) {
            if (radius <= 0 || passes <= 0) return;
            const temp = new Uint8ClampedArray(mask.length);
            const area = 2 * radius + 1;
            for (let p = 0; p < passes; p++) {
                for (let y = 0; y < height; y++) {
                    let acc = 0;
                    let row = y * width;
                    for (let x = -radius; x <= radius; x++) {
                        acc += mask[row + this.clamp(x, 0, width - 1)];
                    }
                    for (let x = 0; x < width; x++) {
                        temp[row + x] = (acc / area) | 0;
                        const add = x + radius + 1;
                        const rem = x - radius;
                        if (add < width) acc += mask[row + add];
                        if (rem >= 1) acc -= mask[row + rem - 1];
                    }
                }
                for (let x = 0; x < width; x++) {
                    let acc = 0;
                    for (let y = -radius; y <= radius; y++) {
                        acc += temp[this.clamp(y, 0, height - 1) * width + x];
                    }
                    for (let y = 0; y < height; y++) {
                        mask[y * width + x] = (acc / area) | 0;
                        const add = y + radius + 1;
                        const rem = y - radius;
                        if (add < height) acc += temp[add * width + x];
                        if (rem >= 1) acc -= temp[(rem - 1) * width + x];
                    }
                }
            }
        },

        keepLargestComponent(mask, width, height) {
            const seen = new Uint8Array(width * height);
            const queueX = new Int32Array(width * height);
            const queueY = new Int32Array(width * height);
            const ids = new Int32Array(width * height);
            let bestArea = 0;
            let bestId = -1;
            let component = 1;

            const push = (x, y, queue) => {
                queueX[queue.end] = x;
                queueY[queue.end] = y;
                queue.end++;
            };

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const index = y * width + x;
                    if (mask[index] === 0 || seen[index]) continue;

                    let area = 0;
                    const queue = { start: 0, end: 0 };
                    push(x, y, queue);
                    seen[index] = 1;
                    ids[index] = component;

                    while (queue.start < queue.end) {
                        const cx = queueX[queue.start];
                        const cy = queueY[queue.start];
                        queue.start++;
                        area++;

                        const neighbours = [cx - 1, cy, cx + 1, cy, cx, cy - 1, cx, cy + 1];
                        for (let i = 0; i < neighbours.length; i += 2) {
                            const nx = neighbours[i];
                            const ny = neighbours[i + 1];
                            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                            const ni = ny * width + nx;
                            if (mask[ni] === 0 || seen[ni]) continue;
                            seen[ni] = 1;
                            ids[ni] = component;
                            push(nx, ny, queue);
                        }
                    }

                    if (area > bestArea) {
                        bestArea = area;
                        bestId = component;
                    }

                    component++;
                }
            }

            if (bestId < 0) return;
            for (let i = 0; i < mask.length; i++) {
                if (mask[i] && ids[i] !== bestId) mask[i] = 0;
            }
        },

        async smartCut(blob, options = {}) {
            const { bgThreshold = 240, satTol = 18, feather = 2 } = options;
            const bitmap = await createImageBitmap(blob);
            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(bitmap, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const { data } = imageData;
            const mask = new Uint8ClampedArray(canvas.width * canvas.height);

            let mr = 0, mg = 0, mb = 0, count = 0;
            for (let x = 0; x < canvas.width; x++) {
                const top = (0 * canvas.width + x) * 4;
                const bottom = ((canvas.height - 1) * canvas.width + x) * 4;
                mr += data[top]; mg += data[top + 1]; mb += data[top + 2]; count++;
                mr += data[bottom]; mg += data[bottom + 1]; mb += data[bottom + 2]; count++;
            }
            for (let y = 0; y < canvas.height; y++) {
                const left = (y * canvas.width + 0) * 4;
                const right = (y * canvas.width + (canvas.width - 1)) * 4;
                mr += data[left]; mg += data[left + 1]; mb += data[left + 2]; count++;
                mr += data[right]; mg += data[right + 1]; mb += data[right + 2]; count++;
            }
            mr /= count; mg /= count; mb /= count;

            for (let i = 0, p = 0; i < data.length; i += 4, p++) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const dr = r - mr;
                const dg = g - mg;
                const db = b - mb;
                const dist = Math.sqrt(dr * dr + dg * dg + db * db);
                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                const sat = max - min;
                const isBg = (max >= bgThreshold) || (sat <= satTol && dist < 40);
                mask[p] = isBg ? 0 : 255;
            }

            this.keepLargestComponent(mask, canvas.width, canvas.height);
            if (feather > 0) this.boxBlurAlpha(mask, canvas.width, canvas.height, feather, 2);

            for (let i = 0, p = 0; i < data.length; i += 4, p++) {
                data[i + 3] = mask[p];
            }
            ctx.putImageData(imageData, 0, 0);
            return { cutoutDataUrl: canvas.toDataURL('image/png') };
        },

        ensureDesignPanelOptions() {
            if (!this.designPanelOptions) {
                this.designPanelOptions = {
                    ratio: '1:1',
                    size: 1024,
                    padding: 8,
                    bgMode: 'transparent',
                    bg1: COLORS.bgTo,
                    bg2: COLORS.bgFrom,
                    angle: 0,
                    shadow: true,
                    shadowOffsetX: 0,
                    shadowOffsetY: 12,
                    shadowBlur: 24,
                    shadowAlpha: 0.35,
                    glow: false,
                    glowBlur: 14,
                    glowAlpha: 0.6
                };
            }
            return this.designPanelOptions;
        },

        getDesignDraft() {
            if (!this.designPanelDraftId) return null;
            return this.drafts.find((draft) => draft.id === this.designPanelDraftId) || null;
        },

        openDesignPanel(draftId) {
            const draft = this.drafts.find((item) => item.id === draftId);
            if (!draft) {
                alert('Черновик не найден.');
                return;
            }
            if (!draft.image) {
                alert('У черновика нет изображения.');
                return;
            }

            this.ensureAddProductStyles();
            this.ensureDesignPanelOptions();
            this.closeDesignPanel();

            this.designPanelDraftId = draftId;
            this.designPanelOverlay = document.createElement('div');
            this.designPanelOverlay.className = 'modal-overlay';
            this.designPanelOverlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 10005; padding: 2rem;';
            this.designPanelOverlay.innerHTML = `
                <div class="pcm-design-modal" style="width: min(1100px, 100%); max-height: 95vh; background: rgba(12,35,33,0.96); border-radius: 24px; overflow: hidden; box-shadow: 0 30px 80px rgba(0,0,0,0.4); display: flex; flex-direction: column;">
                    <div class="pcm-design-header" style="padding: 20px 28px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08);">
                        <div>
                            <h2 class="pcm-design-title" style="margin: 0; font-size: 22px; font-weight: 700; color: #f8fafc;">🎨 Дизайн‑панель — ${this.escapeHtml(draft.title || 'Черновик')}</h2>
                            <p style="margin: 4px 0 0 0; font-size: 13px; color: rgba(148,163,184,0.85);">Настройте фон, отступы, тени и экспортируйте изображение</p>
                        </div>
                        <button type="button" class="pcm-design-close" style="background: rgba(255,255,255,0.14); border: none; color: white; width: 40px; height: 40px; border-radius: 50%; font-size: 22px; cursor: pointer;">&times;</button>
                    </div>
                    <div class="pcm-design-body" style="overflow-y: auto; padding: 24px;"></div>
                </div>`;

            document.body.appendChild(this.designPanelOverlay);
            this.designPanelOverlay.querySelector('.pcm-design-close').addEventListener('click', () => this.closeDesignPanel());
            this.designPanelOverlay.addEventListener('click', (event) => {
                if (event.target === this.designPanelOverlay) this.closeDesignPanel();
            });

            this.designPanelRoot = this.designPanelOverlay.querySelector('.pcm-design-body');
            this.renderDesignPanel();
        },

        closeDesignPanel() {
            if (this.designPanelOverlay) {
                this.designPanelOverlay.remove();
                this.designPanelOverlay = null;
                this.designPanelRoot = null;
            }
            this.designPanelDraftId = null;
            this.designPanelImage = null;
            this.designPanelImageSrc = null;
            this.designPanelBusy = false;
            if (this.designPanelStatusTimer) {
                clearTimeout(this.designPanelStatusTimer);
                this.designPanelStatusTimer = null;
            }
        },

        renderDesignPanel() {
            if (!this.designPanelRoot) return;
            const draft = this.getDesignDraft();
            if (!draft) {
                this.closeDesignPanel();
                return;
            }

            const options = this.ensureDesignPanelOptions();
            const ratioCss = (options.ratio || '1:1').replace(':', ' / ');

            const headerTitle = this.designPanelOverlay?.querySelector('.pcm-design-title');
            if (headerTitle) {
                headerTitle.textContent = `🎨 Дизайн‑панель — ${draft.title || 'Черновик'}`;
            }

            this.designPanelRoot.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 24px; color: rgba(248,250,252,0.92);">
                    <div class="pcm-design-preview-block" style="position: relative; border-radius: 20px; border: 1px solid rgba(255,255,255,0.12); padding: 16px; background: rgba(15,46,42,0.7);">
                        <div class="pcm-design-preview" style="position: relative; width: 100%; border-radius: 16px; overflow: hidden; background: rgba(15,45,42,0.9);">
                            <div class="pcm-design-checker" style="${options.bgMode === 'transparent' ? '' : 'display:none;'}"></div>
                            <canvas class="pcm-design-canvas" style="width: 100%; height: auto; display: block; aspect-ratio: ${ratioCss};"></canvas>
                        </div>
                        <div id="pcmDesignStatus" style="margin-top: 12px; font-size: 13px; min-height: 16px; color: rgba(255,255,255,0.7);"></div>
                    </div>

                    <div class="pcm-design-controls" style="display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
                        <div class="pcm-design-card" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 16px; padding: 16px;">
                            <h3 style="margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255,255,255,0.75);">Геометрия</h3>
                            <label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px;">
                                <span>Соотношение сторон</span>
                                <select id="pcmDesignRatio" style="padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.08); color: white;">
                                    <option value="1:1" ${options.ratio === '1:1' ? 'selected' : ''}>1:1</option>
                                    <option value="4:3" ${options.ratio === '4:3' ? 'selected' : ''}>4:3</option>
                                    <option value="3:4" ${options.ratio === '3:4' ? 'selected' : ''}>3:4</option>
                                    <option value="16:9" ${options.ratio === '16:9' ? 'selected' : ''}>16:9</option>
                                    <option value="9:16" ${options.ratio === '9:16' ? 'selected' : ''}>9:16</option>
                                </select>
                            </label>
                            <label style="display: flex; flex-direction: column; gap: 6px; margin-top: 12px; font-size: 13px;">
                                <span>Размер экспорта (px)</span>
                                <select id="pcmDesignSize" style="padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.08); color: white;">
                                    <option value="1024" ${Number(options.size) === 1024 ? 'selected' : ''}>1024</option>
                                    <option value="1536" ${Number(options.size) === 1536 ? 'selected' : ''}>1536</option>
                                    <option value="2048" ${Number(options.size) === 2048 ? 'selected' : ''}>2048</option>
                                </select>
                            </label>
                            <label style="display: flex; flex-direction: column; gap: 6px; margin-top: 12px; font-size: 13px;">
                                <span>Отступ (padding): <strong id="pcmDesignPaddingValue">${Number(options.padding).toFixed(0)}%</strong></span>
                                <input type="range" id="pcmDesignPadding" min="0" max="25" value="${Number(options.padding).toFixed(0)}">
                            </label>
                        </div>

                        <div class="pcm-design-card" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 16px; padding: 16px;">
                            <h3 style="margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255,255,255,0.75);">Фон</h3>
                            <label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px;">
                                <span>Режим</span>
                                <select id="pcmDesignBgMode" style="padding: 8px 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.08); color: white;">
                                    <option value="transparent" ${options.bgMode === 'transparent' ? 'selected' : ''}>Прозрачный</option>
                                    <option value="solid" ${options.bgMode === 'solid' ? 'selected' : ''}>Однотонный</option>
                                    <option value="gradient" ${options.bgMode === 'gradient' ? 'selected' : ''}>Градиент</option>
                                </select>
                            </label>
                            <div style="margin-top: 12px; display: grid; gap: 8px;" data-design-background>
                                <label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px;">Цвет 1
                                    <input type="color" id="pcmDesignBg1" value="${options.bg1 || COLORS.bgTo}" style="width: 100%; height: 38px; border-radius: 10px; border: none;">
                                </label>
                                <label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px;">Цвет 2
                                    <input type="color" id="pcmDesignBg2" value="${options.bg2 || COLORS.bgFrom}" ${options.bgMode !== 'gradient' ? 'disabled' : ''} style="width: 100%; height: 38px; border-radius: 10px; border: none; opacity: ${options.bgMode !== 'gradient' ? '0.5' : '1'};">
                                </label>
                                <label id="pcmDesignAngleWrap" style="display: ${options.bgMode === 'gradient' ? 'block' : 'none'}; font-size: 13px;">Угол: <strong id="pcmDesignAngleValue">${Number(options.angle).toFixed(0)}°</strong>
                                    <input type="range" id="pcmDesignAngle" min="0" max="360" value="${Number(options.angle).toFixed(0)}">
                                </label>
                            </div>
                        </div>

                        <div class="pcm-design-card" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 16px; padding: 16px;">
                            <h3 style="margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255,255,255,0.75);">Тень</h3>
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
                                <input type="checkbox" id="pcmDesignShadow" ${options.shadow ? 'checked' : ''}>
                                Использовать тень
                            </label>
                            <div data-design-shadow style="margin-top: 12px; display: ${options.shadow ? 'grid' : 'none'}; gap: 8px;">
                                <label style="display: flex; flex-direction: column; gap: 4px; font-size: 13px;">Смещение X: <strong id="pcmDesignShadowXValue">${Number(options.shadowOffsetX).toFixed(0)}</strong>
                                    <input type="range" id="pcmDesignShadowX" min="-80" max="80" value="${Number(options.shadowOffsetX).toFixed(0)}">
                                </label>
                                <label style="display: flex; flex-direction: column; gap: 4px; font-size: 13px;">Смещение Y: <strong id="pcmDesignShadowYValue">${Number(options.shadowOffsetY).toFixed(0)}</strong>
                                    <input type="range" id="pcmDesignShadowY" min="-80" max="80" value="${Number(options.shadowOffsetY).toFixed(0)}">
                                </label>
                                <label style="display: flex; flex-direction: column; gap: 4px; font-size: 13px;">Размытие: <strong id="pcmDesignShadowBlurValue">${Number(options.shadowBlur).toFixed(0)}</strong>
                                    <input type="range" id="pcmDesignShadowBlur" min="0" max="80" value="${Number(options.shadowBlur).toFixed(0)}">
                                </label>
                                <label style="display: flex; flex-direction: column; gap: 4px; font-size: 13px;">Прозрачность: <strong id="pcmDesignShadowAlphaValue">${Number(options.shadowAlpha).toFixed(2)}</strong>
                                    <input type="range" id="pcmDesignShadowAlpha" min="0" max="1" step="0.05" value="${Number(options.shadowAlpha).toFixed(2)}">
                                </label>
                            </div>
                        </div>

                        <div class="pcm-design-card" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 16px; padding: 16px;">
                            <h3 style="margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255,255,255,0.75);">Ореол</h3>
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
                                <input type="checkbox" id="pcmDesignGlow" ${options.glow ? 'checked' : ''}>
                                Свечение вокруг объекта
                            </label>
                            <div data-design-glow style="margin-top: 12px; display: ${options.glow ? 'grid' : 'none'}; gap: 8px;">
                                <label style="display: flex; flex-direction: column; gap: 4px; font-size: 13px;">Размытие: <strong id="pcmDesignGlowBlurValue">${Number(options.glowBlur).toFixed(0)}</strong>
                                    <input type="range" id="pcmDesignGlowBlur" min="0" max="80" value="${Number(options.glowBlur).toFixed(0)}">
                                </label>
                                <label style="display: flex; flex-direction: column; gap: 4px; font-size: 13px;">Прозрачность: <strong id="pcmDesignGlowAlphaValue">${Number(options.glowAlpha).toFixed(2)}</strong>
                                    <input type="range" id="pcmDesignGlowAlpha" min="0" max="1" step="0.05" value="${Number(options.glowAlpha).toFixed(2)}">
                                </label>
                            </div>
                        </div>
                    </div>

                    <div class="pcm-design-actions" style="display: flex; flex-wrap: wrap; gap: 12px;">
                        <button type="button" class="pcm-design-action" id="pcmDesignDownloadPng" style="padding: 10px 18px; border: none; border-radius: 12px; background: #10b981; color: white; font-weight: 600; cursor: pointer;">💾 Экспорт PNG</button>
                        <button type="button" class="pcm-design-action" id="pcmDesignDownloadWebp" style="padding: 10px 18px; border: none; border-radius: 12px; background: #0d9488; color: white; font-weight: 600; cursor: pointer;">💾 Экспорт WebP</button>
                        <button type="button" class="pcm-design-action" id="pcmDesignCopy" style="padding: 10px 18px; border: none; border-radius: 12px; background: rgba(79,70,229,0.85); color: white; font-weight: 600; cursor: pointer;">📋 Копировать</button>
                        <button type="button" class="pcm-design-action" id="pcmDesignReplace" style="padding: 10px 18px; border: none; border-radius: 12px; background: rgba(250,204,21,0.95); color: #1f2937; font-weight: 600; cursor: pointer;">🔁 Заменить черновик</button>
                        <button type="button" class="pcm-design-action" id="pcmDesignClone" style="padding: 10px 18px; border: none; border-radius: 12px; background: rgba(236,72,153,0.9); color: white; font-weight: 600; cursor: pointer;">➕ Клонировать</button>
                    </div>
                </div>
            `;

            this.attachDesignPanelHandlers();
            this.updateDesignControlValues();
            this.updateDesignControlVisibility();
            this.renderDesignPreview();
        },

        attachDesignPanelHandlers() {
            if (!this.designPanelOverlay) return;
            const options = this.ensureDesignPanelOptions();
            const overlay = this.designPanelOverlay;

            const ratioEl = overlay.querySelector('#pcmDesignRatio');
            const sizeEl = overlay.querySelector('#pcmDesignSize');
            const paddingEl = overlay.querySelector('#pcmDesignPadding');
            const paddingValueEl = overlay.querySelector('#pcmDesignPaddingValue');
            const bgModeEl = overlay.querySelector('#pcmDesignBgMode');
            const bg1El = overlay.querySelector('#pcmDesignBg1');
            const bg2El = overlay.querySelector('#pcmDesignBg2');
            const angleEl = overlay.querySelector('#pcmDesignAngle');
            const angleValueEl = overlay.querySelector('#pcmDesignAngleValue');
            const shadowEl = overlay.querySelector('#pcmDesignShadow');
            const shadowXEl = overlay.querySelector('#pcmDesignShadowX');
            const shadowXValueEl = overlay.querySelector('#pcmDesignShadowXValue');
            const shadowYEl = overlay.querySelector('#pcmDesignShadowY');
            const shadowYValueEl = overlay.querySelector('#pcmDesignShadowYValue');
            const shadowBlurEl = overlay.querySelector('#pcmDesignShadowBlur');
            const shadowBlurValueEl = overlay.querySelector('#pcmDesignShadowBlurValue');
            const shadowAlphaEl = overlay.querySelector('#pcmDesignShadowAlpha');
            const shadowAlphaValueEl = overlay.querySelector('#pcmDesignShadowAlphaValue');
            const glowEl = overlay.querySelector('#pcmDesignGlow');
            const glowBlurEl = overlay.querySelector('#pcmDesignGlowBlur');
            const glowBlurValueEl = overlay.querySelector('#pcmDesignGlowBlurValue');
            const glowAlphaEl = overlay.querySelector('#pcmDesignGlowAlpha');
            const glowAlphaValueEl = overlay.querySelector('#pcmDesignGlowAlphaValue');

            const downloadPngBtn = overlay.querySelector('#pcmDesignDownloadPng');
            const downloadWebpBtn = overlay.querySelector('#pcmDesignDownloadWebp');
            const copyBtn = overlay.querySelector('#pcmDesignCopy');
            const replaceBtn = overlay.querySelector('#pcmDesignReplace');
            const cloneBtn = overlay.querySelector('#pcmDesignClone');

            if (ratioEl) ratioEl.value = options.ratio;
            if (sizeEl) sizeEl.value = options.size;
            if (paddingEl && paddingValueEl) {
                paddingEl.value = Number(options.padding).toFixed(0);
                paddingValueEl.textContent = `${Number(options.padding).toFixed(0)}%`;
            }
            if (bgModeEl) bgModeEl.value = options.bgMode;
            if (bg1El) bg1El.value = options.bg1 || COLORS.bgTo;
            if (bg2El) bg2El.value = options.bg2 || COLORS.bgFrom;
            if (angleEl && angleValueEl) {
                angleEl.value = Number(options.angle).toFixed(0);
                angleValueEl.textContent = `${Number(options.angle).toFixed(0)}°`;
            }

            if (shadowEl) shadowEl.checked = !!options.shadow;
            if (shadowXEl && shadowXValueEl) {
                shadowXEl.value = Number(options.shadowOffsetX).toFixed(0);
                shadowXValueEl.textContent = Number(options.shadowOffsetX).toFixed(0);
            }
            if (shadowYEl && shadowYValueEl) {
                shadowYEl.value = Number(options.shadowOffsetY).toFixed(0);
                shadowYValueEl.textContent = Number(options.shadowOffsetY).toFixed(0);
            }
            if (shadowBlurEl && shadowBlurValueEl) {
                shadowBlurEl.value = Number(options.shadowBlur).toFixed(0);
                shadowBlurValueEl.textContent = Number(options.shadowBlur).toFixed(0);
            }
            if (shadowAlphaEl && shadowAlphaValueEl) {
                shadowAlphaEl.value = Number(options.shadowAlpha).toFixed(2);
                shadowAlphaValueEl.textContent = Number(options.shadowAlpha).toFixed(2);
            }

            if (glowEl) glowEl.checked = !!options.glow;
            if (glowBlurEl && glowBlurValueEl) {
                glowBlurEl.value = Number(options.glowBlur).toFixed(0);
                glowBlurValueEl.textContent = Number(options.glowBlur).toFixed(0);
            }
            if (glowAlphaEl && glowAlphaValueEl) {
                glowAlphaEl.value = Number(options.glowAlpha).toFixed(2);
                glowAlphaValueEl.textContent = Number(options.glowAlpha).toFixed(2);
            }

            ratioEl?.addEventListener('change', (event) => {
                this.updateDesignOption('ratio', event.target.value);
            });
            sizeEl?.addEventListener('change', (event) => {
                this.updateDesignOption('size', Number(event.target.value));
            });
            paddingEl?.addEventListener('input', (event) => {
                const value = Number(event.target.value) || 0;
                if (paddingValueEl) paddingValueEl.textContent = `${value}%`;
                this.updateDesignOption('padding', value, false);
            });
            bgModeEl?.addEventListener('change', (event) => {
                this.updateDesignOption('bgMode', event.target.value, true);
            });
            bg1El?.addEventListener('input', (event) => {
                this.updateDesignOption('bg1', event.target.value, false);
            });
            bg2El?.addEventListener('input', (event) => {
                this.updateDesignOption('bg2', event.target.value, false);
            });
            angleEl?.addEventListener('input', (event) => {
                const value = Number(event.target.value) || 0;
                if (angleValueEl) angleValueEl.textContent = `${value}°`;
                this.updateDesignOption('angle', value, false);
            });

            shadowEl?.addEventListener('change', (event) => {
                this.updateDesignOption('shadow', event.target.checked, true);
            });
            shadowXEl?.addEventListener('input', (event) => {
                const value = Number(event.target.value) || 0;
                if (shadowXValueEl) shadowXValueEl.textContent = value.toFixed(0);
                this.updateDesignOption('shadowOffsetX', value, false);
            });
            shadowYEl?.addEventListener('input', (event) => {
                const value = Number(event.target.value) || 0;
                if (shadowYValueEl) shadowYValueEl.textContent = value.toFixed(0);
                this.updateDesignOption('shadowOffsetY', value, false);
            });
            shadowBlurEl?.addEventListener('input', (event) => {
                const value = Number(event.target.value) || 0;
                if (shadowBlurValueEl) shadowBlurValueEl.textContent = value.toFixed(0);
                this.updateDesignOption('shadowBlur', value, false);
            });
            shadowAlphaEl?.addEventListener('input', (event) => {
                const value = Number(event.target.value) || 0;
                if (shadowAlphaValueEl) shadowAlphaValueEl.textContent = value.toFixed(2);
                this.updateDesignOption('shadowAlpha', value, false);
            });

            glowEl?.addEventListener('change', (event) => {
                this.updateDesignOption('glow', event.target.checked, true);
            });
            glowBlurEl?.addEventListener('input', (event) => {
                const value = Number(event.target.value) || 0;
                if (glowBlurValueEl) glowBlurValueEl.textContent = value.toFixed(0);
                this.updateDesignOption('glowBlur', value, false);
            });
            glowAlphaEl?.addEventListener('input', (event) => {
                const value = Number(event.target.value) || 0;
                if (glowAlphaValueEl) glowAlphaValueEl.textContent = value.toFixed(2);
                this.updateDesignOption('glowAlpha', value, false);
            });

            downloadPngBtn?.addEventListener('click', () => this.designPanelDownload('png'));
            downloadWebpBtn?.addEventListener('click', () => this.designPanelDownload('webp'));
            copyBtn?.addEventListener('click', () => this.designPanelCopy());
            replaceBtn?.addEventListener('click', () => this.designPanelReplace());
            cloneBtn?.addEventListener('click', () => this.designPanelClone());
        },

        updateDesignOption(key, value, refreshControls = false) {
            const options = this.ensureDesignPanelOptions();
            const numericKeys = new Set(['size', 'padding', 'angle', 'shadowOffsetX', 'shadowOffsetY', 'shadowBlur', 'shadowAlpha', 'glowBlur', 'glowAlpha']);
            if (numericKeys.has(key)) {
                value = Number(value);
                if (!Number.isFinite(value)) value = 0;
                if (key === 'shadowAlpha' || key === 'glowAlpha') {
                    value = Math.min(1, Math.max(0, value));
                }
            }
            options[key] = value;
            if (refreshControls) this.updateDesignControlVisibility();
            this.renderDesignPreview();
        },

        updateDesignControlVisibility() {
            if (!this.designPanelOverlay) return;
            const options = this.ensureDesignPanelOptions();
            const gradientWrap = this.designPanelOverlay.querySelector('#pcmDesignAngleWrap');
            const bg2Input = this.designPanelOverlay.querySelector('#pcmDesignBg2');
            const shadowWrap = this.designPanelOverlay.querySelector('[data-design-shadow]');
            const glowWrap = this.designPanelOverlay.querySelector('[data-design-glow]');

            if (gradientWrap) gradientWrap.style.display = options.bgMode === 'gradient' ? 'block' : 'none';
            if (bg2Input) {
                bg2Input.disabled = options.bgMode !== 'gradient';
                bg2Input.style.opacity = options.bgMode === 'gradient' ? '1' : '0.5';
            }
            if (shadowWrap) shadowWrap.style.display = options.shadow ? 'grid' : 'none';
            if (glowWrap) glowWrap.style.display = options.glow ? 'grid' : 'none';
        },

        async renderDesignPreview() {
            if (!this.designPanelOverlay) return;
            const draft = this.getDesignDraft();
            if (!draft || !draft.image) {
                this.setDesignPanelStatus('⚠️ Черновик без изображения', 'warn');
                return;
            }

            const options = this.ensureDesignPanelOptions();
            const ratioParts = (options.ratio || '1:1').split(':');
            const rw = Number(ratioParts[0]) || 1;
            const rh = Number(ratioParts[1]) || 1;
            const previewWidth = 640;
            const previewHeight = Math.max(10, Math.round((previewWidth * rh) / rw));

            const canvas = this.designPanelOverlay.querySelector('.pcm-design-canvas');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            canvas.width = previewWidth;
            canvas.height = previewHeight;
            ctx.clearRect(0, 0, previewWidth, previewHeight);

            const renderToken = Date.now();
            this._designPreviewToken = renderToken;

            try {
                const renderCanvas = await this.createDesignCanvas(previewWidth, draft, options);
                if (this._designPreviewToken !== renderToken) return;
                ctx.drawImage(renderCanvas, 0, 0, previewWidth, previewHeight);
                const checker = this.designPanelOverlay.querySelector('.pcm-design-checker');
                if (checker) checker.style.display = options.bgMode === 'transparent' ? 'block' : 'none';
                this.setDesignPanelStatus('');
            } catch (error) {
                if (this._designPreviewToken !== renderToken) return;
                console.error('renderDesignPreview error', error);
                this.setDesignPanelStatus('⚠️ Не удалось отрисовать предпросмотр. Возможно, источник блокирует CORS.', 'error');
            }
        },

        async ensureDesignPanelImage(src) {
            if (this.designPanelImage && this.designPanelImageSrc === src) {
                return this.designPanelImage;
            }

            const img = new Image();
            if (src && !src.startsWith('data:') && !src.startsWith('blob:')) {
                img.crossOrigin = 'anonymous';
            }

            await new Promise((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = () => reject(new Error('Не удалось загрузить изображение для дизайн-панели'));
                img.src = src;
            });

            this.designPanelImage = img;
            this.designPanelImageSrc = src;
            return img;
        },

        async createDesignCanvas(targetWidth, draft, options = this.ensureDesignPanelOptions()) {
            const ratioParts = (options.ratio || '1:1').split(':');
            const rw = Number(ratioParts[0]) || 1;
            const rh = Number(ratioParts[1]) || 1;
            const targetHeight = Math.max(10, Math.round((targetWidth * rh) / rw));

            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas API недоступен');

            const img = await this.ensureDesignPanelImage(draft.image);
            if (!img || !img.naturalWidth) throw new Error('Источник изображения не загружен');

            if (options.bgMode === 'transparent') {
                ctx.clearRect(0, 0, targetWidth, targetHeight);
            } else if (options.bgMode === 'solid') {
                ctx.fillStyle = options.bg1 || COLORS.bgTo;
                ctx.fillRect(0, 0, targetWidth, targetHeight);
            } else {
                const angleRad = (Number(options.angle) || 0) * Math.PI / 180;
                const cx = targetWidth / 2;
                const cy = targetHeight / 2;
                const len = Math.sqrt(targetWidth * targetWidth + targetHeight * targetHeight) / 2;
                const x1 = cx + Math.cos(angleRad + Math.PI) * len;
                const y1 = cy + Math.sin(angleRad + Math.PI) * len;
                const x2 = cx + Math.cos(angleRad) * len;
                const y2 = cy + Math.sin(angleRad) * len;
                const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
                gradient.addColorStop(0, options.bg1 || COLORS.bgFrom);
                gradient.addColorStop(1, options.bg2 || COLORS.bgTo);
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, targetWidth, targetHeight);
            }

            const padding = Math.max(0, Number(options.padding) || 0);
            const padPx = (Math.min(targetWidth, targetHeight) * padding) / 100;
            const availW = targetWidth - padPx * 2;
            const availH = targetHeight - padPx * 2;
            const scale = Math.min(availW / img.naturalWidth, availH / img.naturalHeight);
            const drawW = img.naturalWidth * scale;
            const drawH = img.naturalHeight * scale;
            const dx = (targetWidth - drawW) / 2;
            const dy = (targetHeight - drawH) / 2;

            if (options.shadow) {
                ctx.save();
                ctx.shadowColor = `rgba(0,0,0,${Math.max(0, Math.min(1, Number(options.shadowAlpha) || 0))})`;
                ctx.shadowBlur = Math.max(0, Number(options.shadowBlur) || 0);
                ctx.shadowOffsetX = Number(options.shadowOffsetX) || 0;
                ctx.shadowOffsetY = Number(options.shadowOffsetY) || 0;
                ctx.drawImage(img, dx, dy, drawW, drawH);
                ctx.restore();
            }

            if (options.glow) {
                ctx.save();
                ctx.globalAlpha = Math.max(0, Math.min(1, Number(options.glowAlpha) || 0));
                ctx.filter = `blur(${Math.max(0, Number(options.glowBlur) || 0)}px)`;
                ctx.drawImage(img, dx, dy, drawW, drawH);
                ctx.restore();
            }

            ctx.drawImage(img, dx, dy, drawW, drawH);
            return canvas;
        },

        updateDesignControlValues() {
            if (!this.designPanelOverlay) return;
            const options = this.ensureDesignPanelOptions();
            const paddingValueEl = this.designPanelOverlay.querySelector('#pcmDesignPaddingValue');
            const angleValueEl = this.designPanelOverlay.querySelector('#pcmDesignAngleValue');
            const shadowXValueEl = this.designPanelOverlay.querySelector('#pcmDesignShadowXValue');
            const shadowYValueEl = this.designPanelOverlay.querySelector('#pcmDesignShadowYValue');
            const shadowBlurValueEl = this.designPanelOverlay.querySelector('#pcmDesignShadowBlurValue');
            const shadowAlphaValueEl = this.designPanelOverlay.querySelector('#pcmDesignShadowAlphaValue');
            const glowBlurValueEl = this.designPanelOverlay.querySelector('#pcmDesignGlowBlurValue');
            const glowAlphaValueEl = this.designPanelOverlay.querySelector('#pcmDesignGlowAlphaValue');

            if (paddingValueEl) paddingValueEl.textContent = `${Number(options.padding).toFixed(0)}%`;
            if (angleValueEl) angleValueEl.textContent = `${Number(options.angle).toFixed(0)}°`;
            if (shadowXValueEl) shadowXValueEl.textContent = Number(options.shadowOffsetX).toFixed(0);
            if (shadowYValueEl) shadowYValueEl.textContent = Number(options.shadowOffsetY).toFixed(0);
            if (shadowBlurValueEl) shadowBlurValueEl.textContent = Number(options.shadowBlur).toFixed(0);
            if (shadowAlphaValueEl) shadowAlphaValueEl.textContent = Number(options.shadowAlpha).toFixed(2);
            if (glowBlurValueEl) glowBlurValueEl.textContent = Number(options.glowBlur).toFixed(0);
            if (glowAlphaValueEl) glowAlphaValueEl.textContent = Number(options.glowAlpha).toFixed(2);
        },

        async designPanelDownload(format) {
            await this.withDesignPanelBusy(async () => {
                const draft = this.getDesignDraft();
                if (!draft) throw new Error('Черновик не найден.');
                const options = this.ensureDesignPanelOptions();
                const canvas = await this.createDesignCanvas(Number(options.size) || 1024, draft, options);
                const mime = format === 'png' ? 'image/png' : 'image/webp';
                const quality = format === 'png' ? undefined : 0.95;
                const blob = await new Promise((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Не удалось сформировать изображение')), mime, quality));
                const url = URL.createObjectURL(blob);
                const safeTitle = (draft.title || 'export').replace(/[\s]+/g, '_').replace(/[^a-zA-Z0-9_\-а-яА-Я]/g, '').substring(0, 60);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${safeTitle || 'export'}.${format}`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                this.setDesignPanelStatus('✅ Файл сохранён', 'success');
            }, '⏳ Подготавливаем изображение...');
        },

        async designPanelCopy() {
            if (!navigator.clipboard || typeof window.ClipboardItem === 'undefined') {
                this.setDesignPanelStatus('⚠️ Браузер не поддерживает копирование в буфер обмена', 'warn');
                return;
            }

            await this.withDesignPanelBusy(async () => {
                const draft = this.getDesignDraft();
                if (!draft) throw new Error('Черновик не найден.');
                const options = this.ensureDesignPanelOptions();
                const canvas = await this.createDesignCanvas(Number(options.size) || 1024, draft, options);
                const blob = await new Promise((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Не удалось сформировать изображение')), 'image/png'));
                await navigator.clipboard.write([new window.ClipboardItem({ [blob.type]: blob })]);
                this.setDesignPanelStatus('✅ Изображение скопировано в буфер обмена', 'success');
            }, '⏳ Копируем изображение...');
        },

        async designPanelReplace() {
            await this.withDesignPanelBusy(async () => {
                const draft = this.getDesignDraft();
                if (!draft) throw new Error('Черновик не найден.');
                const options = this.ensureDesignPanelOptions();
                const canvas = await this.createDesignCanvas(Number(options.size) || 1024, draft, options);
                const dataUrl = canvas.toDataURL('image/png');
                this.designPanelImage = null;
                this.updateDraft(draft.id, { image: dataUrl, hasBgRemoved: true });
                this.setDesignPanelStatus('✅ Черновик обновлён', 'success');
            }, '⏳ Обновляем черновик...');
        },

        async designPanelClone() {
            await this.withDesignPanelBusy(async () => {
                const draft = this.getDesignDraft();
                if (!draft) throw new Error('Черновик не найден.');
                const options = this.ensureDesignPanelOptions();
                const canvas = await this.createDesignCanvas(Number(options.size) || 1024, draft, options);
                const dataUrl = canvas.toDataURL('image/png');
                const clone = { ...draft, id: `${Date.now()}-${Math.random()}`, image: dataUrl, hasBgRemoved: true };
                this.drafts = [clone, ...this.drafts];
                this.lastAttrs = { category: clone.category, weight: clone.weight, calories: clone.calories };
                this.designPanelDraftId = clone.id;
                this.designPanelImage = null;
                this.renderAddProductModal();
                this.renderDesignPanel();
                this.setDesignPanelStatus('✅ Создан новый черновик', 'success');
            }, '⏳ Создаём дубликат...');
        },

        async withDesignPanelBusy(task, loadingMessage) {
            if (this.designPanelBusy) return;
            this.designPanelBusy = true;
            this.setDesignPanelLoading(true);
            if (loadingMessage) this.setDesignPanelStatus(loadingMessage, 'info');
            try {
                await task();
            } catch (error) {
                console.error('Design panel error', error);
                const message = error?.message ? `❌ ${error.message}` : '❌ Ошибка при обработке дизайн-панели';
                this.setDesignPanelStatus(message, 'error');
            } finally {
                this.designPanelBusy = false;
                this.setDesignPanelLoading(false);
            }
        },

        setDesignPanelLoading(isLoading) {
            if (!this.designPanelOverlay) return;
            const buttons = this.designPanelOverlay.querySelectorAll('.pcm-design-action');
            buttons.forEach((btn) => {
                if (isLoading) {
                    btn.setAttribute('disabled', 'disabled');
                    btn.style.opacity = '0.6';
                    btn.style.cursor = 'wait';
                } else {
                    btn.removeAttribute('disabled');
                    btn.style.opacity = '1';
                    btn.style.cursor = 'pointer';
                }
            });
        },

        setDesignPanelStatus(message, type = 'info') {
            if (!this.designPanelOverlay) return;
            const statusEl = this.designPanelOverlay.querySelector('#pcmDesignStatus');
            if (!statusEl) return;

            const colors = {
                info: 'rgba(255,255,255,0.75)',
                success: '#bbf7d0',
                warn: '#fde68a',
                error: '#fecaca'
            };

            statusEl.textContent = message || '';
            statusEl.style.color = colors[type] || colors.info;

            if (this.designPanelStatusTimer) {
                clearTimeout(this.designPanelStatusTimer);
                this.designPanelStatusTimer = null;
            }

            if (message) {
                this.designPanelStatusTimer = setTimeout(() => {
                    if (!this.designPanelOverlay) return;
                    const el = this.designPanelOverlay.querySelector('#pcmDesignStatus');
                    if (el) el.textContent = '';
                }, 5000);
            }
        },

        getSegmentationDraft() {
            if (!this.segmentationDraftId) return null;
            return this.drafts.find((draft) => draft.id === this.segmentationDraftId) || null;
        },

        openSegmentationEditor(draftId) {
            const draft = this.drafts.find((item) => item.id === draftId);
            if (!draft) {
                alert('Черновик не найден.');
                return;
            }
            if (!draft.image) {
                alert('У черновика нет изображения.');
                return;
            }

            this.ensureAddProductStyles();
            this.closeSegmentationEditor();

            this.segmentationDraftId = draftId;
            this.segmentationCutout = draft.image;
            this.segmentationHistory = draft.image ? [draft.image] : [];
            this.segmentationRedo = [];
            this.segmentationAlgo = 'smart';
            this.segmentationTh = 240;
            this.segmentationSat = 18;
            this.segmentationFeather = 2;
            this.segmentationServerMulti = null;
            this.segmentationWorking = false;

            this.segmentationOverlay = document.createElement('div');
            this.segmentationOverlay.className = 'modal-overlay';
            this.segmentationOverlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10010; padding: 2rem;';
            this.segmentationOverlay.innerHTML = `
                <div class="pcm-seg-modal" style="width: min(1100px, 100%); max-height: 95vh; background: rgba(12,35,33,0.96); border-radius: 24px; overflow: hidden; box-shadow: 0 30px 80px rgba(0,0,0,0.45); display: flex; flex-direction: column;">
                    <div style=\"padding: 20px 28px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(148, 163, 184, 0.2);\">
                        <div>
                            <h2 style=\"margin: 0; font-size: 22px; font-weight: 700; color: #f8fafc;\">✂️ Выделение объекта — ${this.escapeHtml(draft.title || 'Черновик')}</h2>
                            <p style=\"margin: 6px 0 0 0; font-size: 13px; color: rgba(148,163,184,0.85);\">Автоматическое удаление фона, ручные корректировки и экспорт</p>
                        </div>
                        <button type=\"button\" class=\"pcm-seg-close\" style=\"background: rgba(255,255,255,0.14); border: none; color: white; width: 40px; height: 40px; border-radius: 50%; font-size: 22px; cursor: pointer;\">&times;</button>
                    </div>
                    <div class=\"pcm-seg-body\" style=\"overflow-y: auto; padding: 24px;\"></div>
                </div>`;

            document.body.appendChild(this.segmentationOverlay);
            this.segmentationOverlay.querySelector('.pcm-seg-close').addEventListener('click', () => this.closeSegmentationEditor());
            this.segmentationOverlay.addEventListener('click', (event) => {
                if (event.target === this.segmentationOverlay) this.closeSegmentationEditor();
            });

            this.segmentationRoot = this.segmentationOverlay.querySelector('.pcm-seg-body');
            this.renderSegmentationEditor();
        },

        closeSegmentationEditor() {
            if (this.segmentationOverlay) {
                this.segmentationOverlay.remove();
                this.segmentationOverlay = null;
                this.segmentationRoot = null;
            }
            this.segmentationDraftId = null;
            this.segmentationCutout = null;
            this.segmentationHistory = [];
            this.segmentationRedo = [];
            this.segmentationServerMulti = null;
            this.segmentationWorking = false;
            this.segmentationAlgo = 'smart';
            if (this.segmentationStatusTimer) {
                clearTimeout(this.segmentationStatusTimer);
                this.segmentationStatusTimer = null;
            }
        },

        renderSegmentationEditor() {
            if (!this.segmentationRoot) return;
            const draft = this.getSegmentationDraft();
            if (!draft) {
                this.closeSegmentationEditor();
                return;
            }

            const cutout = this.segmentationCutout || draft.image;

            this.segmentationRoot.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 24px; color: rgba(248,250,252,0.92);">
                    <div class="pcm-seg-layout" style="display: flex; flex-wrap: wrap; gap: 20px;">
                        <div class="pcm-seg-preview-block" style="flex: 1 1 60%; min-width: 300px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 20px; padding: 18px;">
                            <div style="position: relative; border-radius: 16px; overflow: hidden; background: rgba(14,40,38,0.85);">
                                <div class="pcm-design-checker" style="opacity: 0.5;"></div>
                                <img id="pcmSegPreview" src="${cutout || ''}" alt="preview" style="position: relative; width: 100%; height: auto; display: block;">
                                ${this.segmentationWorking ? '<div class="pcm-design-checker" style="background: rgba(15,35,33,0.65);"></div><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;"><span class="pcm-spinner" style="width:28px;height:28px;border-width:4px;"></span></div>' : ''}
                            </div>
                            <div id="pcmSegStatus" style="margin-top: 12px; font-size: 13px; min-height: 16px; color: rgba(148,163,184,0.9);"></div>
                        </div>
                        <div class="pcm-seg-controls" style="flex: 1 1 35%; min-width: 240px; display: flex; flex-direction: column; gap: 16px;">
                            <div style="display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px;">
                                <button id="pcmSegAuto" class="pcm-design-action" style="padding: 10px 12px; border-radius: 10px; border: none; background: #10b981; color: white; font-weight: 600; cursor: pointer;">${this.segmentationAlgo === 'smart' ? 'SmartCut' : 'Сервер AI'}</button>
                                <button id="pcmSegUndo" class="pcm-design-action" style="padding: 10px 12px; border-radius: 10px; border: none; background: rgba(59,130,246,0.75); color: white; font-weight: 600; cursor: pointer;" ${this.segmentationHistory.length <= 1 ? 'disabled' : ''}>↩️ Отмена</button>
                                <button id="pcmSegGrow" class="pcm-design-action" style="padding: 10px 12px; border-radius: 10px; border: none; background: rgba(79,70,229,0.75); color: white; font-weight: 600; cursor: pointer;">➕ Расширить</button>
                                <button id="pcmSegShrink" class="pcm-design-action" style="padding: 10px 12px; border-radius: 10px; border: none; background: rgba(79,70,229,0.75); color: white; font-weight: 600; cursor: pointer;">➖ Сузить</button>
                                <button id="pcmSegRedo" class="pcm-design-action" style="padding: 10px 12px; border-radius: 10px; border: none; background: rgba(59,130,246,0.75); color: white; font-weight: 600; cursor: pointer;" ${!this.segmentationRedo.length ? 'disabled' : ''}>↪️ Повтор</button>
                                <select id="pcmSegAlgo" style="padding: 10px 12px; border-radius: 10px; border: none; background: rgba(15,118,110,0.85); color: white; font-weight: 600; cursor: pointer;">
                                    <option value="smart" ${this.segmentationAlgo === 'smart' ? 'selected' : ''}>SmartCut локально</option>
                                    <option value="server" ${this.segmentationAlgo === 'server' ? 'selected' : ''}>Сервер (SAM/DeepLab)</option>
                                </select>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 12px; font-size: 13px;">
                                <label>Порог белого: <strong id="pcmSegThValue">${this.segmentationTh}</strong>
                                    <input type="range" id="pcmSegTh" min="200" max="255" value="${this.segmentationTh}">
                                </label>
                                <label>Насыщенность: <strong id="pcmSegSatValue">${this.segmentationSat}</strong>
                                    <input type="range" id="pcmSegSat" min="0" max="64" value="${this.segmentationSat}">
                                </label>
                                <label>Мягкость края: <strong id="pcmSegFeatherValue">${this.segmentationFeather}</strong>
                                    <input type="range" id="pcmSegFeather" min="0" max="6" value="${this.segmentationFeather}">
                                </label>
                            </div>
                            <div id="pcmSegMulti" style="display: ${this.segmentationServerMulti?.length ? 'block' : 'none'}; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 14px; padding: 12px;">
                                <div style="font-size: 13px; margin-bottom: 8px; color: rgba(255,255,255,0.85);">Найдено объектов: ${this.segmentationServerMulti?.length || 0}</div>
                                <div id="pcmSegMultiList" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 8px;"></div>
                                <button id="pcmSegMultiCreate" style="margin-top: 10px; width: 100%; padding: 9px 12px; border-radius: 10px; border: none; background: rgba(16,185,129,0.9); color: white; font-weight: 600; cursor: pointer;">Создать отдельные черновики</button>
                            </div>
                            <div style="display: flex; gap: 10px;">
                                <button id="pcmSegApply" class="pcm-design-action" style="flex: 1; padding: 11px; border-radius: 12px; border: none; background: #10b981; color: white; font-weight: 700; cursor: pointer;">✅ Применить</button>
                                <button id="pcmSegCancel" class="pcm-design-action" style="flex: 1; padding: 11px; border-radius: 12px; border: none; background: rgba(148,163,184,0.35); color: white; font-weight: 700; cursor: pointer;">Отмена</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            this.attachSegmentationHandlers();
            this.renderSegmentationMulti();
            this.updateSegmentationControls();
            this.setSegmentationStatus('Готово к обработке', 'info');
        },

        attachSegmentationHandlers() {
            if (!this.segmentationOverlay) return;
            const overlay = this.segmentationOverlay;

            overlay.querySelector('#pcmSegAlgo')?.addEventListener('change', (event) => {
                this.segmentationAlgo = event.target.value;
                this.renderSegmentationEditor();
            });
            overlay.querySelector('#pcmSegTh')?.addEventListener('input', (event) => {
                this.segmentationTh = Number(event.target.value) || 240;
                const valueEl = overlay.querySelector('#pcmSegThValue');
                if (valueEl) valueEl.textContent = this.segmentationTh;
            });
            overlay.querySelector('#pcmSegSat')?.addEventListener('input', (event) => {
                this.segmentationSat = Number(event.target.value) || 18;
                const valueEl = overlay.querySelector('#pcmSegSatValue');
                if (valueEl) valueEl.textContent = this.segmentationSat;
            });
            overlay.querySelector('#pcmSegFeather')?.addEventListener('input', (event) => {
                this.segmentationFeather = Number(event.target.value) || 2;
                const valueEl = overlay.querySelector('#pcmSegFeatherValue');
                if (valueEl) valueEl.textContent = this.segmentationFeather;
            });

            overlay.querySelector('#pcmSegAuto')?.addEventListener('click', () => this.segmentationRunAuto());
            overlay.querySelector('#pcmSegGrow')?.addEventListener('click', () => this.segmentationGrow());
            overlay.querySelector('#pcmSegShrink')?.addEventListener('click', () => this.segmentationShrink());
            overlay.querySelector('#pcmSegUndo')?.addEventListener('click', () => this.segmentationUndo());
            overlay.querySelector('#pcmSegRedo')?.addEventListener('click', () => this.segmentationRedoAction());
            overlay.querySelector('#pcmSegApply')?.addEventListener('click', () => this.applySegmentation());
            overlay.querySelector('#pcmSegCancel')?.addEventListener('click', () => this.closeSegmentationEditor());
            overlay.querySelector('#pcmSegMultiCreate')?.addEventListener('click', () => this.segmentationCreateMulti());
        },

        updateSegmentationControls() {
            if (!this.segmentationOverlay) return;
            const draft = this.getSegmentationDraft();
            const preview = this.segmentationOverlay.querySelector('#pcmSegPreview');
            if (preview) {
                preview.src = this.segmentationCutout || draft?.image || '';
            }

            const undoBtn = this.segmentationOverlay.querySelector('#pcmSegUndo');
            const redoBtn = this.segmentationOverlay.querySelector('#pcmSegRedo');
            if (undoBtn) undoBtn.disabled = this.segmentationHistory.length <= 1 || this.segmentationWorking;
            if (redoBtn) redoBtn.disabled = !this.segmentationRedo.length || this.segmentationWorking;

            const autoBtn = this.segmentationOverlay.querySelector('#pcmSegAuto');
            if (autoBtn) autoBtn.textContent = this.segmentationAlgo === 'smart' ? 'SmartCut' : 'Сервер AI';

            const growBtn = this.segmentationOverlay.querySelector('#pcmSegGrow');
            const shrinkBtn = this.segmentationOverlay.querySelector('#pcmSegShrink');
            if (growBtn) growBtn.disabled = this.segmentationWorking;
            if (shrinkBtn) shrinkBtn.disabled = this.segmentationWorking;

            this.setSegmentationLoading(this.segmentationWorking);
        },

        async segmentationRunAuto() {
            if (this.segmentationWorking) return;
            const draft = this.getSegmentationDraft();
            if (!draft) return;

            await this.withSegmentationBusy(async () => {
                const source = this.segmentationCutout || draft.image;
                const blob = await this.getImageBlob(source);
                if (!blob) throw new Error('Источник изображения недоступен');

                if (this.segmentationAlgo === 'server') {
                    const result = await segmentObject({ imageBlob: blob, mode: 'server', params: { multi: true } });
                    this.segmentationServerMulti = Array.isArray(result.multiple) ? result.multiple : null;
                    if (result.cutoutDataUrl) {
                        this.applySegmentationCutout(result.cutoutDataUrl, true);
                    } else if (this.segmentationServerMulti && this.segmentationServerMulti.length) {
                        this.applySegmentationCutout(this.segmentationServerMulti[0], true);
                    } else {
                        throw new Error('Сервер не вернул результат');
                    }
                } else {
                    const { cutoutDataUrl } = await this.smartCut(blob, { bgThreshold: this.segmentationTh, satTol: this.segmentationSat, feather: this.segmentationFeather });
                    this.segmentationServerMulti = null;
                    this.applySegmentationCutout(cutoutDataUrl, true);
                }

                this.setSegmentationStatus('✅ Готово. Проверьте результат.', 'success');
            }, '⏳ Выделяем объект...');
        },

        async segmentationGrow() {
            if (this.segmentationWorking) return;
            const current = this.segmentationCutout;
            if (!current) return;
            await this.withSegmentationBusy(async () => {
                try {
                    const grown = await this.growOrShrink(current, 1.06);
                    this.applySegmentationCutout(grown, true);
                } catch (error) {
                    console.error('Segmentation grow error:', error);
                    this.setSegmentationStatus('❌ Ошибка расширения выделения', 'error');
                }
            }, '⏳ Расширяем выделение...');
        },

        async segmentationShrink() {
            if (this.segmentationWorking) return;
            const current = this.segmentationCutout;
            if (!current) return;
            await this.withSegmentationBusy(async () => {
                try {
                    const shrunk = await this.growOrShrink(current, 0.94);
                    this.applySegmentationCutout(shrunk, true);
                } catch (error) {
                    console.error('Segmentation shrink error:', error);
                    this.setSegmentationStatus('❌ Ошибка уменьшения выделения', 'error');
                }
            }, '⏳ Уменьшаем выделение...');
        },

        async growOrShrink(imageDataUrl, scale) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        const newWidth = Math.round(img.width * scale);
                        const newHeight = Math.round(img.height * scale);
                        canvas.width = newWidth;
                        canvas.height = newHeight;
                        ctx.drawImage(img, 0, 0, newWidth, newHeight);
                        resolve(canvas.toDataURL('image/png'));
                    } catch (error) {
                        reject(error);
                    }
                };
                img.onerror = () => reject(new Error('Не удалось загрузить изображение'));
                img.src = imageDataUrl;
            });
        },

        segmentationUndo() {
            if (this.segmentationHistory.length <= 1 || this.segmentationWorking) return;
            const last = this.segmentationHistory.pop();
            if (last) this.segmentationRedo.unshift(last);
            this.segmentationCutout = this.segmentationHistory[this.segmentationHistory.length - 1] || null;
            this.updateSegmentationControls();
        },

        segmentationRedoAction() {
            if (!this.segmentationRedo.length || this.segmentationWorking) return;
            const next = this.segmentationRedo.shift();
            if (next) {
                this.segmentationHistory.push(next);
                this.segmentationCutout = next;
                this.updateSegmentationControls();
            }
        },

        applySegmentationCutout(dataUrl, pushHistory) {
            this.segmentationCutout = dataUrl;
            if (pushHistory) {
                if (this.segmentationHistory.length >= 100) this.segmentationHistory.shift();
                this.segmentationHistory.push(dataUrl);
                this.segmentationRedo = [];
            }
            this.updateSegmentationControls();
            this.renderSegmentationMulti();
        },

        applySegmentation() {
            if (!this.segmentationCutout) {
                alert('Нет результата для применения. Выполните автоудаление фона.');
                return;
            }
            const draft = this.getSegmentationDraft();
            if (!draft) return;

            this.updateDraft(draft.id, { image: this.segmentationCutout, hasBgRemoved: true, original: draft.original || draft.image });
            const designId = draft.id;
            this.closeSegmentationEditor();
            setTimeout(() => this.openDesignPanel(designId), 50);
        },

        segmentationCreateMulti() {
            if (!this.segmentationServerMulti || !this.segmentationServerMulti.length) return;
            const draft = this.getSegmentationDraft();
            if (!draft) return;

            this.segmentationServerMulti.forEach((src, index) => {
                const clone = {
                    ...draft,
                    id: `${Date.now()}-${draft.id}-${index}`,
                    image: src,
                    hasBgRemoved: true
                };
                if (index === 0) {
                    this.updateDraft(draft.id, clone);
                } else {
                    this.drafts.push({ ...clone, id: `${clone.id}-clone` });
                }
            });

            this.segmentationServerMulti = null;
            this.renderSegmentationEditor();
            this.renderAddProductModal();
            this.setSegmentationStatus('✅ Созданы отдельные черновики.', 'success');
        },

        renderSegmentationMulti() {
            if (!this.segmentationOverlay) return;
            const wrap = this.segmentationOverlay.querySelector('#pcmSegMulti');
            const list = this.segmentationOverlay.querySelector('#pcmSegMultiList');
            if (!wrap || !list) return;

            const items = this.segmentationServerMulti || [];
            wrap.style.display = items.length ? 'block' : 'none';
            list.innerHTML = items.map((item, index) => `
                <button type="button" data-index="${index}" style="border: 1px solid rgba(255,255,255,0.2); border-radius: 10px; overflow: hidden; background: rgba(255,255,255,0.05); cursor: pointer;">
                    <img src="${item}" alt="multi-${index}" style="width: 100%; height: 100%; object-fit: contain; display: block;">
                </button>
            `).join('');

            list.querySelectorAll('button').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const idx = Number(btn.dataset.index) || 0;
                    const src = this.segmentationServerMulti?.[idx];
                    if (src) this.applySegmentationCutout(src, true);
                });
            });
        },

        async withSegmentationBusy(task, loadingMessage) {
            if (this.segmentationWorking) return;
            this.segmentationWorking = true;
            this.setSegmentationLoading(true);
            if (loadingMessage) this.setSegmentationStatus(loadingMessage, 'info');
            try {
                await task();
            } catch (error) {
                console.error('Segmentation error', error);
                const msg = error?.message ? `❌ ${error.message}` : '❌ Ошибка обработки изображения';
                this.setSegmentationStatus(msg, 'error');
            } finally {
                this.segmentationWorking = false;
                this.setSegmentationLoading(false);
                this.updateSegmentationControls();
            }
        },

        setSegmentationLoading(isLoading) {
            if (!this.segmentationOverlay) return;
            const buttons = this.segmentationOverlay.querySelectorAll('.pcm-design-action');
            buttons.forEach((btn) => {
                if (isLoading) {
                    btn.setAttribute('disabled', 'disabled');
                    btn.style.opacity = '0.6';
                    btn.style.cursor = 'wait';
                } else if (!(btn.id === 'pcmSegUndo' && this.segmentationHistory.length <= 1) && !(btn.id === 'pcmSegRedo' && !this.segmentationRedo.length)) {
                    btn.removeAttribute('disabled');
                    btn.style.opacity = '1';
                    btn.style.cursor = 'pointer';
                }
            });
        },

        setSegmentationStatus(message, type = 'info') {
            if (!this.segmentationOverlay) return;
            const statusEl = this.segmentationOverlay.querySelector('#pcmSegStatus');
            if (!statusEl) return;

            const colors = {
                info: 'rgba(148,163,184,0.9)',
                success: '#bbf7d0',
                warn: '#fde68a',
                error: '#fecaca'
            };
            statusEl.textContent = message || '';
            statusEl.style.color = colors[type] || colors.info;

            if (this.segmentationStatusTimer) {
                clearTimeout(this.segmentationStatusTimer);
                this.segmentationStatusTimer = null;
            }

            if (message) {
                this.segmentationStatusTimer = setTimeout(() => {
                    if (!this.segmentationOverlay) return;
                    const el = this.segmentationOverlay.querySelector('#pcmSegStatus');
                    if (el) el.textContent = '';
                }, 5000);
            }
        },
    };
    // Экспортируем глобально
    window.ProductCardsManager = ProductCardsManager;
    
    // Экспортируем версию для проверки на сервере
    window.ProductCardsManagerVersion = '32-with-file-upload-and-smartcut';
    console.log('%c✅ ProductCardsManager версия 32 (с автоудалением фона) загружен!', 'color: green; font-weight: bold;');
    console.log('💡 Проверка: введите в консоли window.ProductCardsManagerVersion - должно быть "32-with-file-upload-and-smartcut"');
    
    // ЯВНАЯ ПРОВЕРКА для диагностики на сервере
    console.log('🔍 ДИАГНОСТИКА МОДУЛЯ ProductCardsManager:');
    console.log('- smartCut тип:', typeof ProductCardsManager.smartCut);
    console.log('- dataURLToBlob тип:', typeof ProductCardsManager.dataURLToBlob);
    console.log('- keepLargestComponent тип:', typeof ProductCardsManager.keepLargestComponent);
    console.log('- boxBlurAlpha тип:', typeof ProductCardsManager.boxBlurAlpha);
    console.log('- bgRemovalEnabled значение:', ProductCardsManager.bgRemovalEnabled);
    
    // Проверка доступности функций
    if (typeof ProductCardsManager.smartCut !== 'function') {
        console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: Функция smartCut не найдена в ProductCardsManager!');
        console.error('❌ Это означает, что файл на сервере НЕ ОБНОВЛЕН!');
    } else {
        console.log('✅ Функция smartCut доступна - автоудаление фона работает');
    }
    
    if (typeof ProductCardsManager.dataURLToBlob !== 'function') {
        console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: Функция dataURLToBlob не найдена!');
    } else {
        console.log('✅ Функция dataURLToBlob доступна');
    }

    // Автоинициализация при загрузке
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('🛍️ Product Cards Manager: Ready (DOM loaded)');
            console.log('🔘 Автоудаление фона по умолчанию:', ProductCardsManager.bgRemovalEnabled ? 'ВКЛЮЧЕНО' : 'ВЫКЛЮЧЕНО');
        });
    } else {
        console.log('🛍️ Product Cards Manager: Ready (DOM already loaded)');
        console.log('🔘 Автоудаление фона по умолчанию:', ProductCardsManager.bgRemovalEnabled ? 'ВКЛЮЧЕНО' : 'ВЫКЛЮЧЕНО');
    }
})();
