/**
 * DANDY Inventory — Модуль номенклатуры
 * Управление товарами, ингредиентами, алкоголем
 */

class NomenclatureModule {
    constructor(inventorySystem) {
        this.system = inventorySystem;
        this.currentFilter = 'all';
        this.searchQuery = '';
        this.selectedProduct = null;
    }

    /**
     * Инициализация модуля
     */
    async init() {
        console.log('📦 Nomenclature module initialized');
        
        // Если товары еще не загружены, пробуем загрузить из API
        if (this.system.products.length === 0) {
            console.log('📡 Товары не загружены, пробуем загрузить из API...');
            try {
                const products = await this.system.loadProducts();
                this.system.products = products;
                console.log(`✅ Загружено товаров: ${products.length}`);
            } catch (error) {
                console.warn('⚠️ Ошибка загрузки товаров:', error);
            }
        }
        
        console.log('📦 Products available:', this.system.products.length);
        this.renderProductsList();
        this.setupEventListeners();
    }

    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        // Фильтры по типу товара
        document.querySelectorAll('[data-filter-type]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.filterByType(e.target.dataset.filterType);
            });
        });

        // Поиск
        const searchInput = document.getElementById('nomenclatureSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.renderProductsList();
            });
        }
    }

    /**
     * Фильтрация по типу
     */
    filterByType(type) {
        this.currentFilter = type;
        this.renderProductsList();

        // Обновляем активную кнопку
        document.querySelectorAll('[data-filter-type]').forEach(btn => {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-secondary');
        });
        const activeBtn = document.querySelector(`[data-filter-type="${type}"]`);
        if (activeBtn) {
            activeBtn.classList.remove('btn-secondary');
            activeBtn.classList.add('btn-primary');
        }
    }

    /**
     * Отрисовка списка товаров
     */
    renderProductsList() {
        const tbody = document.querySelector('#productsTableBody');
        if (!tbody) {
            console.error('❌ #productsTableBody not found!');
            return;
        }

        console.log('🔄 Rendering products table...');
        let products = this.system.products;

        // Фильтр по типу
        if (this.currentFilter !== 'all') {
            products = products.filter(p => p.type === this.currentFilter);
        }

        // Поиск
        if (this.searchQuery) {
            products = products.filter(p =>
                p.name.toLowerCase().includes(this.searchQuery) ||
                p.code.toLowerCase().includes(this.searchQuery) ||
                (p.category && p.category.toLowerCase().includes(this.searchQuery))
            );
        }

        if (products.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem; color: #F3EADB; opacity: 0.7;">
                        Товары не найдены
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = products.map(product => {
            const stockStatus = this.getStockStatus(product);
            const statusBadge = this.getStatusBadge(stockStatus);

            return `
                <tr style="cursor: pointer;" onclick="nomenclatureModule.selectProduct(${product.id})">
                    <td><code>${product.code}</code></td>
                    <td>
                        <strong>${product.name}</strong>
                        ${product.isAlcohol ? '<span class="badge badge-warning" style="margin-left: 0.5rem;">🍷 Алко</span>' : ''}
                    </td>
                    <td>${product.category || '—'}</td>
                    <td>${product.baseUnit}</td>
                    <td>${statusBadge}</td>
                    <td><strong>₽ ${product.price.toLocaleString()}</strong>/${product.baseUnit}</td>
                    <td>
                        <button class="btn btn-primary btn-small" onclick="event.stopPropagation(); nomenclatureModule.editProduct(${product.id})">
                            ✏️ Редактировать
                        </button>
                        <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); nomenclatureModule.deleteProduct(${product.id})">
                            🗑️ Удалить
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Определение статуса остатка
     */
    getStockStatus(product) {
        if (product.currentStock <= 0) return 'out';
        if (product.currentStock < product.minStock) return 'critical';
        if (product.currentStock < product.minStock * 1.5) return 'low';
        return 'ok';
    }

    /**
     * Получение бейджа статуса
     */
    getStatusBadge(status) {
        const badges = {
            out: '<span class="badge badge-danger">Нет в наличии</span>',
            critical: '<span class="badge badge-danger">Критический</span>',
            low: '<span class="badge badge-warning">Низкий</span>',
            ok: '<span class="badge badge-success">В наличии</span>'
        };
        return badges[status] || badges.ok;
    }

    /**
     * Выбор товара
     */
    selectProduct(productId) {
        this.selectedProduct = this.system.products.find(p => p.id === productId);
        if (this.selectedProduct) {
            this.showProductDetails(this.selectedProduct);
        }
    }

    /**
     * Показать детали товара
     */
    showProductDetails(product) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        // Получаем остатки по складам
        const stockByWarehouse = this.system.stockBalances
            .filter(b => b.productId === product.id)
            .map(b => {
                const warehouse = this.system.warehouses.find(w => w.id === b.warehouseId);
                return {
                    warehouse: warehouse ? warehouse.name : 'Неизвестный склад',
                    quantity: b.quantity,
                    batchNumber: b.batchNumber,
                    expiryDate: b.expiryDate
                };
            });

        const stockHTML = stockByWarehouse.length > 0
            ? stockByWarehouse.map(s => `
                <tr>
                    <td>${s.warehouse}</td>
                    <td>${s.quantity} ${product.baseUnit}</td>
                    <td>${s.batchNumber || '—'}</td>
                    <td>${s.expiryDate || '—'}</td>
                </tr>
            `).join('')
            : '<tr><td colspan="4" style="text-align: center; color: #F3EADB; opacity: 0.7;">Остатков нет</td></tr>';

        modal.innerHTML = `
            <div style="background: #094a45; border-radius: 16px; padding: 2rem; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h2 style="margin: 0; color: #eebc5c;">📦 ${product.name}</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" 
                            style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #F3EADB;">×</button>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                    <div>
                        <strong>Код:</strong> <code>${product.code}</code>
                    </div>
                    <div>
                        <strong>Тип:</strong> ${this.getProductTypeLabel(product.type)}
                    </div>
                    <div>
                        <strong>Категория:</strong> ${product.category || '—'}
                    </div>
                    <div>
                        <strong>Единица измерения:</strong> ${product.baseUnit}
                    </div>
                    <div>
                        <strong>Цена:</strong> ₽ ${product.price.toLocaleString()}/${product.baseUnit}
                    </div>
                    <div>
                        <strong>Минимальный остаток:</strong> ${product.minStock} ${product.baseUnit}
                    </div>
                    ${product.isAlcohol ? `
                        <div>
                            <strong>Крепость:</strong> ${product.alcoholStrength || 0}%
                        </div>
                        <div>
                            <strong>ЕГАИС:</strong> <span class="badge badge-warning">Подконтрольно</span>
                        </div>
                    ` : ''}
                </div>

                <h3 style="margin-top: 1.5rem; margin-bottom: 1rem; color: var(--dandy-green);">📊 Остатки по складам</h3>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Склад</th>
                            <th>Количество</th>
                            <th>Партия</th>
                            <th>Срок годности</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${stockHTML}
                    </tbody>
                </table>

                <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                    <button onclick="nomenclatureModule.editProduct(${product.id}); this.closest('.modal-overlay').remove();" 
                            class="btn btn-primary">
                        ✏️ Редактировать
                    </button>
                    <button onclick="nomenclatureModule.showMovementHistory(${product.id})" 
                            class="btn btn-secondary">
                        📜 История движения
                    </button>
                    <button onclick="this.closest('.modal-overlay').remove()" 
                            class="btn btn-secondary">
                        Закрыть
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Закрытие по клику на overlay
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    /**
     * Редактирование товара
     */
    editProduct(productId) {
        const product = this.system.products.find(p => p.id === productId);
        if (!product) return;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: #094a45; border-radius: 16px; padding: 2rem; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12);">
                <h2 style="margin: 0 0 1.5rem 0; color: #eebc5c;">✏️ Редактирование товара</h2>

                <div class="form-group">
                    <label class="form-label">Код товара</label>
                    <input type="text" class="form-input" id="editCode" value="${product.code}">
                </div>

                <div class="form-group">
                    <label class="form-label">Наименование</label>
                    <input type="text" class="form-input" id="editName" value="${product.name}">
                </div>

                <div class="form-group">
                    <label class="form-label">Тип</label>
                    <select class="form-select" id="editType">
                        <option value="ingredient" ${product.type === 'ingredient' ? 'selected' : ''}>Ингредиент</option>
                        <option value="semi_product" ${product.type === 'semi_product' ? 'selected' : ''}>Полуфабрикат</option>
                        <option value="alcohol" ${product.type === 'alcohol' ? 'selected' : ''}>Алкоголь</option>
                        <option value="packaging" ${product.type === 'packaging' ? 'selected' : ''}>Тара</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Категория</label>
                    <input type="text" class="form-input" id="editCategory" value="${product.category || ''}">
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label class="form-label">Единица измерения</label>
                        <select class="form-select" id="editUnit">
                            <option value="кг" ${product.baseUnit === 'кг' ? 'selected' : ''}>кг</option>
                            <option value="г" ${product.baseUnit === 'г' ? 'selected' : ''}>г</option>
                            <option value="л" ${product.baseUnit === 'л' ? 'selected' : ''}>л</option>
                            <option value="мл" ${product.baseUnit === 'мл' ? 'selected' : ''}>мл</option>
                            <option value="шт" ${product.baseUnit === 'шт' ? 'selected' : ''}>шт</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Цена (₽)</label>
                        <input type="number" class="form-input" id="editPrice" value="${product.price}" step="0.01">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Минимальный остаток</label>
                    <input type="number" class="form-input" id="editMinStock" value="${product.minStock || 0}" step="0.01">
                </div>

                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 0.5rem;">
                        <input type="checkbox" id="editIsAlcohol" ${product.isAlcohol ? 'checked' : ''}>
                        <span>Алкогольная продукция (ЕГАИС)</span>
                    </label>
                </div>

                <div id="alcoholFields" style="display: ${product.isAlcohol ? 'block' : 'none'};">
                    <div class="form-group">
                        <label class="form-label">Крепость (%)</label>
                        <input type="number" class="form-input" id="editStrength" value="${product.alcoholStrength || 0}" step="0.1">
                    </div>
                </div>

                <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                    <button onclick="nomenclatureModule.saveProduct(${product.id})" class="btn btn-primary">
                        💾 Сохранить
                    </button>
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">
                        Отмена
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Показ/скрытие полей алкоголя
        const alcoholCheckbox = modal.querySelector('#editIsAlcohol');
        const alcoholFields = modal.querySelector('#alcoholFields');
        alcoholCheckbox.addEventListener('change', (e) => {
            alcoholFields.style.display = e.target.checked ? 'block' : 'none';
        });
    }

    /**
     * Сохранение товара
     */
    saveProduct(productId) {
        const product = this.system.products.find(p => p.id === productId);
        if (!product) return;

        // Обновляем данные
        product.code = document.getElementById('editCode').value;
        product.name = document.getElementById('editName').value;
        product.type = document.getElementById('editType').value;
        product.category = document.getElementById('editCategory').value;
        product.baseUnit = document.getElementById('editUnit').value;
        product.price = parseFloat(document.getElementById('editPrice').value);
        product.minStock = parseFloat(document.getElementById('editMinStock').value);
        product.isAlcohol = document.getElementById('editIsAlcohol').checked;

        if (product.isAlcohol) {
            product.alcoholStrength = parseFloat(document.getElementById('editStrength').value);
        }

        // Сохраняем
        this.system.saveToLocalStorage('products', this.system.products);

        // Закрываем модалку
        document.querySelector('.modal-overlay').remove();

        // Обновляем список
        this.renderProductsList();

        // Уведомление
        this.showNotification('✅ Товар успешно обновлён!', 'success');
    }

    /**
     * Создание нового товара
     */
    createProduct() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: #094a45; border-radius: 16px; padding: 2rem; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12);">
                <h2 style="margin: 0 0 1.5rem 0; color: #eebc5c;">➕ Создание товара</h2>

                <div class="form-group">
                    <label class="form-label">Код товара</label>
                    <input type="text" class="form-input" id="newCode" placeholder="ING-001">
                </div>

                <div class="form-group">
                    <label class="form-label">Наименование*</label>
                    <input type="text" class="form-input" id="newName" placeholder="Например: Лосось филе">
                </div>

                <div class="form-group">
                    <label class="form-label">Тип*</label>
                    <select class="form-select" id="newType">
                        <option value="ingredient">Ингредиент</option>
                        <option value="semi_product">Полуфабрикат</option>
                        <option value="alcohol">Алкоголь</option>
                        <option value="packaging">Тара</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Категория</label>
                    <input type="text" class="form-input" id="newCategory" placeholder="Например: Рыба/Морепродукты">
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label class="form-label">Единица измерения*</label>
                        <select class="form-select" id="newUnit">
                            <option value="кг">кг</option>
                            <option value="г">г</option>
                            <option value="л">л</option>
                            <option value="мл">мл</option>
                            <option value="шт">шт</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Цена (₽)*</label>
                        <input type="number" class="form-input" id="newPrice" placeholder="Введите цену" step="0.01" min="0.01">
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Минимальный остаток*</label>
                    <input type="number" class="form-input" id="newMinStock" value="1" step="0.01" min="0.01">
                </div>

                <div class="form-group">
                    <label class="form-label">Описание</label>
                    <textarea class="form-input" id="newDescription" rows="3" placeholder="Краткое описание товара"></textarea>
                </div>

                <div class="form-group">
                    <label class="form-label">Вес/размер</label>
                    <input type="text" class="form-input" id="newWeight" placeholder="Например: 500г, 30см, 350мл">
                </div>

                <div class="form-group">
                    <label class="form-label">Калории</label>
                    <input type="text" class="form-input" id="newCalories" placeholder="Например: 450 ккал">
                </div>

                <div class="form-group">
                    <label class="form-label">Состав (ингредиенты)</label>
                    <textarea class="form-input" id="newIngredients" rows="3" placeholder="Например: тесто, томатный соус, моцарелла, грибы, базилик"></textarea>
                </div>

                <div class="form-group">
                    <label class="form-label">Аллергены</label>
                    <textarea class="form-input" id="newAllergens" rows="2" placeholder="Например: глютен, лактоза, яйца"></textarea>
                </div>

                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 0.5rem;">
                        <input type="checkbox" id="newIsAlcohol">
                        <span>Алкогольная продукция (ЕГАИС)</span>
                    </label>
                </div>

                <div id="newAlcoholFields" style="display: none;">
                    <div class="form-group">
                        <label class="form-label">Крепость (%)</label>
                        <input type="number" class="form-input" id="newStrength" value="0" step="0.1">
                    </div>
                </div>

                <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                    <button onclick="nomenclatureModule.saveNewProduct()" class="btn btn-primary">
                        ✅ Создать
                    </button>
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">
                        Отмена
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Показ/скрытие полей алкоголя
        const alcoholCheckbox = modal.querySelector('#newIsAlcohol');
        const alcoholFields = modal.querySelector('#newAlcoholFields');
        alcoholCheckbox.addEventListener('change', (e) => {
            alcoholFields.style.display = e.target.checked ? 'block' : 'none';
        });
    }

    /**
     * Сохранение нового товара
     */
    saveNewProduct() {
        const name = document.getElementById('newName').value.trim();
        if (!name) {
            alert('⚠️ Введите наименование товара');
            return;
        }

        const newProduct = {
            id: Date.now(),
            code: document.getElementById('newCode').value || `PRD-${Date.now()}`,
            name: name,
            type: document.getElementById('newType').value,
            category: document.getElementById('newCategory').value,
            baseUnit: document.getElementById('newUnit').value,
            price: parseFloat(document.getElementById('newPrice').value) || 0,
            minStock: parseFloat(document.getElementById('newMinStock').value) || 0,
            currentStock: 0,
            isAlcohol: document.getElementById('newIsAlcohol').checked,
            description: document.getElementById('newDescription').value.trim(),
            weight: document.getElementById('newWeight').value.trim(),
            calories: document.getElementById('newCalories').value.trim(),
            ingredients: document.getElementById('newIngredients').value.trim(),
            allergens: document.getElementById('newAllergens').value.trim(),
            createdAt: new Date().toISOString()
        };

        if (newProduct.isAlcohol) {
            newProduct.alcoholStrength = parseFloat(document.getElementById('newStrength').value) || 0;
        }

        // Добавляем товар
        this.system.products.push(newProduct);
        this.system.saveToLocalStorage('products', this.system.products);

        // Закрываем модалку
        document.querySelector('.modal-overlay').remove();

        // Обновляем список
        this.renderProductsList();

        // Уведомление
        this.showNotification('✅ Товар успешно создан!', 'success');
    }

    /**
     * Удаление товара
     */
    deleteProduct(productId) {
        const product = this.system.products.find(p => p.id === productId);
        if (!product) return;

        if (!confirm(`❌ Удалить товар "${product.name}"?\n\nЭто действие нельзя отменить!`)) {
            return;
        }

        // Удаляем
        this.system.products = this.system.products.filter(p => p.id !== productId);
        this.system.saveToLocalStorage('products', this.system.products);

        // Обновляем список
        this.renderProductsList();

        // Уведомление
        this.showNotification('✅ Товар удалён', 'success');
    }

    /**
     * История движения товара
     */
    showMovementHistory(productId) {
        alert('📜 История движения товара\n\nБудет реализовано в следующей итерации');
    }

    /**
     * Получение читаемого названия типа
     */
    getProductTypeLabel(type) {
        const labels = {
            ingredient: 'Ингредиент',
            semi_product: 'Полуфабрикат',
            alcohol: 'Алкоголь',
            packaging: 'Тара'
        };
        return labels[type] || type;
    }

    /**
     * Загрузка товаров из API (синхронизация с админкой и сайтом)
     */
    async loadProductsFromAPI() {
        try {
            this.showNotification('📡 Синхронизация товаров с API...', 'info');
            
            const response = await fetch('/api/products?limit=10000');
            if (!response.ok) {
                throw new Error('Не удалось загрузить товары из API');
            }
            
            const result = await response.json();
            const apiProducts = Array.isArray(result?.data) ? result.data : [];
            
            if (apiProducts.length === 0) {
                this.showNotification('⚠️ API вернул пустой список товаров', 'warning');
                return;
            }
            
            let addedCount = 0;
            let updatedCount = 0;
            let skippedCount = 0;
            
            // Получаем текущий максимальный ID
            let maxId = Math.max(...this.system.products.map(p => p.id), 0);
            
            apiProducts.forEach(item => {
                // Ищем существующий товар по ID или названию
                const existingIndex = this.system.products.findIndex(p => 
                    p.id === item.id || p.name.toLowerCase() === item.name.toLowerCase()
                );
                
                const productType = this.system.determineProductType ? 
                    this.system.determineProductType(item) : 'ingredient';
                const categoryName = item.category_name || 
                    (item.categories && item.categories.length > 0 ? item.categories[0].name : 'Другое');
                
                const productData = {
                    id: item.id || (++maxId),
                    code: item.code || `PROD-${item.id || maxId}`,
                    name: item.name,
                    type: productType,
                    category: categoryName,
                    baseUnit: item.unit || 'шт',
                    isAlcohol: false,
                    minStock: item.min_stock || 5.0,
                    currentStock: item.stock || 0,
                    price: parseFloat(item.price) || 0,
                    image_url: item.image_url || '',
                    description: item.description || '',
                    visible_on_site: item.visible_on_site !== false
                };
                
                if (existingIndex >= 0) {
                    // Обновляем существующий товар
                    this.system.products[existingIndex] = { ...this.system.products[existingIndex], ...productData };
                    updatedCount++;
                } else {
                    // Добавляем новый товар
                    this.system.products.push(productData);
                    addedCount++;
                }
            });
            
            // Сохраняем в LocalStorage
            this.system.saveToLocalStorage('products', this.system.products);
            
            // Обновляем список
            this.renderProductsList();
            
            this.showNotification(
                `✅ Синхронизация завершена: добавлено ${addedCount}, обновлено ${updatedCount}, пропущено ${skippedCount}`,
                'success'
            );
            
            console.log(`✅ Синхронизировано товаров: добавлено ${addedCount}, обновлено ${updatedCount}`);
        } catch (error) {
            console.error('❌ Ошибка синхронизации товаров:', error);
            this.showNotification('❌ Ошибка синхронизации: ' + error.message, 'error');
        }
    }
    
    /**
     * Загрузка меню из menu_data.json (fallback)
     */
    async loadMenuFromJSON() {
        try {
            this.showNotification('📥 Загрузка меню из menu_data.json...', 'info');
            
            const response = await fetch('menu_data.json');
            if (!response.ok) {
                throw new Error('Не удалось загрузить menu_data.json');
            }
            
            const data = await response.json();
            let addedCount = 0;
            let skippedCount = 0;
            
            // Маппинг категорий к типам товаров
            const categoryTypeMap = {
                'Пицца': 'dish',
                'Роллы': 'dish',
                'Маки': 'dish',
                'Запеченные': 'dish',
                'Темпура': 'dish',
                'Гунканы': 'dish',
                'Суши': 'dish',
                'Сеты': 'dish',
                'Салаты': 'dish',
                'Закуски': 'dish',
                'Супы': 'dish',
                'Сэндвичи': 'dish',
                'Wok': 'dish',
                'Завтраки': 'dish',
                'Блины': 'dish',
                'Пироги': 'dish',
                'Напитки': 'ingredient',
                'Соусы': 'semi_product',
                'Комбо': 'dish'
            };
            
            // Получаем текущий максимальный ID
            let maxId = Math.max(...this.system.products.map(p => p.id), 0);
            
            data.offers.forEach(item => {
                // Проверяем, не существует ли уже такой товар (по названию)
                const exists = this.system.products.some(p => 
                    p.name.toLowerCase() === item.name.toLowerCase()
                );
                
                if (exists) {
                    skippedCount++;
                    return;
                }
                
                // Определяем тип товара на основе категории
                const categoryName = item.category_name || 'Другое';
                const productType = categoryTypeMap[categoryName] || 'ingredient';
                
                // Вычисляем примерную себестоимость (40% от цены продажи)
                const price = parseInt(item.price) || 0;
                const cost = Math.round(price * 0.4);
                
                // Добавляем новый товар
                maxId++;
                this.system.products.push({
                    id: maxId,
                    code: `MENU-${item.id}`,
                    name: item.name,
                    type: productType,
                    category: categoryName,
                    baseUnit: 'шт',
                    isAlcohol: false,
                    minStock: 5.0,
                    currentStock: 0,
                    price: cost, // Себестоимость для товароучёта
                    salePrice: price, // Цена продажи
                    description: item.description ? item.description.replace(/<[^>]*>/g, '') : '',
                    picture: item.picture || '',
                    url: item.url || ''
                });
                
                addedCount++;
            });
            
            // Сохраняем обновлённый список
            this.system.saveToLocalStorage('products', this.system.products);
            
            // Обновляем отображение
            this.renderProductsList();
            
            this.showNotification(
                `✅ Загрузка завершена!\nДобавлено: ${addedCount} товаров\nПропущено (дубли): ${skippedCount}`,
                'success'
            );
            
        } catch (error) {
            console.error('Ошибка загрузки меню:', error);
            this.showNotification('❌ Ошибка загрузки меню: ' + error.message, 'error');
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
            white-space: pre-line;
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
    module.exports = NomenclatureModule;
}

