/**
 * DANDY Recipes Management Module
 * Управление техкартами (рецептами) с калькуляцией себестоимости
 */

class RecipesManagementModule {
    constructor() {
        this.recipes = [];
        this.products = [];
        this.categories = [];
        this.currentRecipe = null;
        this.API_BASE = '/api/inventory/recipes'; // Используем правильный endpoint
    }

    async init() {
        console.log('📋 Recipes Management Module initialized');
        await this.loadRecipes();
        await this.loadProducts();
        await this.loadCategories();
        this.render();
    }

    async loadRecipes() {
        try {
            const response = await fetch(this.API_BASE);
            if (!response.ok) {
                throw new Error('API not available');
            }
            const data = await response.json();
            // Поддерживаем оба формата ответа
            const recipes = data.data || data.recipes || [];
            if (Array.isArray(recipes)) {
                this.recipes = recipes;
                // Пересчитываем себестоимость для всех рецептов
                this.recipes.forEach(recipe => {
                    if (recipe.ingredients && recipe.ingredients.length > 0) {
                        recipe.cost = this.calculateRecipeCost(recipe);
                    }
                });
            }
        } catch (error) {
            console.warn('⚠️ Не удалось загрузить техкарты:', error);
            this.recipes = [];
        }
    }

    async loadProducts() {
        try {
            // Загружаем доступные компоненты техкарт (ингредиенты/полуфабрикаты) из БД (счет 10.*)
            const response = await fetch('/api/techcards/components');
            if (response.ok) {
                const data = await response.json();
                if (data.success && Array.isArray(data.data)) {
                    this.products = data.data;
                    return;
                }
            }

            // Fallback (если новый endpoint недоступен)
            const fallbackResponse = await fetch('/api/products?for_modifiers=1&include_subgroups=1');
            if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json();
                if (fallbackData.success && Array.isArray(fallbackData.data)) {
                    this.products = fallbackData.data;
                }
            }
        } catch (error) {
            console.warn('⚠️ Не удалось загрузить товары:', error);
            this.products = [];
        }
    }

    async loadCategories() {
        try {
            const response = await fetch('/api/categories');
            if (response.ok) {
                const data = await response.json();
                if (data.success && Array.isArray(data.data)) {
                    this.categories = data.data;
                }
            }
        } catch (error) {
            console.warn('⚠️ Не удалось загрузить категории:', error);
            this.categories = [];
        }
    }

    render() {
        const container = document.getElementById('recipesContent') || document.getElementById('recipes') || document.getElementById('menu');
        if (!container) return;

        container.innerHTML = `
            <div class="recipes-management">
                <!-- Header -->
                <div class="recipes-header">
                    <h2>📋 Техкарты (Рецепты)</h2>
                    <div class="recipes-actions">
                        <input type="text" id="recipeSearch" placeholder="🔍 Поиск рецептов..." class="form-input" style="width: 300px;">
                        <button class="btn btn-primary" onclick="recipesModule.showCreateRecipeForm()">
                            ➕ Создать техкарту
                        </button>
                        <button class="btn btn-secondary" onclick="recipesModule.calculateAllCosts()">
                            💰 Пересчитать себестоимость
                        </button>
                        <button class="btn btn-secondary" onclick="recipesModule.exportRecipes()">
                            📥 Экспорт CSV
                        </button>
                    </div>
                </div>

                <!-- Stats -->
                <div class="recipes-stats grid grid-4" style="margin-top: 1rem;">
                    <div class="card">
                        <h4>Всего рецептов</h4>
                        <div class="stat-value">${this.recipes.length}</div>
                    </div>
                    <div class="card">
                        <h4>Средняя себестоимость</h4>
                        <div class="stat-value">₽ ${this.calculateAverageCost().toFixed(2)}</div>
                    </div>
                    <div class="card">
                        <h4>Активных рецептов</h4>
                        <div class="stat-value text-success">${this.recipes.filter(r => r.is_active).length}</div>
                    </div>
                    <div class="card">
                        <h4>Общая стоимость</h4>
                        <div class="stat-value">₽ ${this.calculateTotalCost().toLocaleString()}</div>
                    </div>
                </div>

                <!-- Recipes Table -->
                <div class="card" style="margin-top: 1rem;">
                    <div class="card-header">
                        <h3>Список техкарт</h3>
                    </div>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Название блюда</th>
                                    <th>Категория</th>
                                    <th>Выход</th>
                                    <th>Ингредиентов</th>
                                    <th>Себестоимость</th>
                                    <th>Время готовки</th>
                                    <th>Потери</th>
                                    <th>Статус</th>
                                    <th>Действия</th>
                                </tr>
                            </thead>
                            <tbody id="recipesTableBody">
                                ${this.renderRecipesRows()}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        // Event listeners
        document.getElementById('recipeSearch').addEventListener('input', (e) => {
            this.filterRecipes(e.target.value);
        });
    }

    renderRecipesRows() {
        if (this.recipes.length === 0) {
            return '<tr><td colspan="9" style="text-align: center;">Нет техкарт</td></tr>';
        }

        return this.recipes.map(recipe => {
            const cost = recipe.cost || 0;
            const statusClass = recipe.is_active ? 'success' : 'secondary';
            const statusText = recipe.is_active ? '✅ Активна' : '⏸️ Неактивна';

            return `
                <tr>
                    <td><strong>${recipe.name}</strong></td>
                    <td>${recipe.category_name || '-'}</td>
                    <td>${recipe.output_quantity} ${recipe.output_unit}</td>
                    <td>${recipe.ingredients?.length || 0}</td>
                    <td><strong>₽ ${cost.toFixed(2)}</strong></td>
                    <td>${recipe.cooking_time ? recipe.cooking_time + ' мин' : '-'}</td>
                    <td>${recipe.loss_percentage || 0}%</td>
                    <td><span class="badge badge-${statusClass}">${statusText}</span></td>
                    <td>
                        <button class="btn btn-small" onclick="recipesModule.showRecipeDetails('${recipe.id}')">👁️</button>
                        <button class="btn btn-small" onclick="recipesModule.showEditRecipeForm('${recipe.id}')">✏️</button>
                        <button class="btn btn-small btn-danger" onclick="recipesModule.deleteRecipe('${recipe.id}')">🗑️</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    showCreateRecipeForm() {
        const modal = this.createModal('Создать техкарту', `
            <form id="recipeForm">
                <div class="form-group">
                    <label class="form-label">Название блюда *</label>
                    <input type="text" name="name" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Категория</label>
                    <select name="category_id" class="form-input">
                        <option value="">Без категории</option>
                        ${this.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Описание</label>
                    <textarea name="description" class="form-input" rows="2"></textarea>
                </div>
                <div class="grid grid-2">
                    <div class="form-group">
                        <label class="form-label">Выход (количество) *</label>
                        <input type="number" name="output_quantity" class="form-input" step="0.001" min="0.001" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Единица измерения *</label>
                        <select name="output_unit" class="form-input" required>
                            <option value="pcs">шт</option>
                            <option value="kg">кг</option>
                            <option value="l">л</option>
                            <option value="portion">порция</option>
                        </select>
                    </div>
                </div>
                <div class="grid grid-2">
                    <div class="form-group">
                        <label class="form-label">Время готовки (мин)</label>
                        <input type="number" name="cooking_time" class="form-input" min="1">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Потери при готовке (%)</label>
                        <input type="number" name="loss_percentage" class="form-input" min="0" max="100" value="0">
                    </div>
                </div>
                <div class="grid grid-2">
                    <div class="form-group">
                        <label class="form-label">Наценка (%)</label>
                        <input type="number" name="markup" class="form-input" min="0" value="0" step="0.1">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Статус</label>
                        <select name="is_active" class="form-input">
                            <option value="true">✅ Активна (отображается в меню)</option>
                            <option value="false">⏸️ Черновик (скрыта от клиентов)</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Инструкция приготовления</label>
                    <textarea name="cooking_instructions" class="form-input" rows="3"></textarea>
                </div>
                
                <hr style="margin: 1rem 0;">
                <h4>Ингредиенты *</h4>
                <div id="ingredientsList">
                    <div class="ingredient-row" style="display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <select name="ingredients[0][product_id]" class="form-input" required>
                            <option value="">Выберите продукт...</option>
                            ${this.products.map(p => `<option value="${p.id}">${p.name} (${p.sku})</option>`).join('')}
                        </select>
                        <input type="number" name="ingredients[0][quantity]" class="form-input" placeholder="Количество" step="0.001" min="0.001" required>
                        <select name="ingredients[0][unit]" class="form-input">
                            <option value="kg">кг</option>
                            <option value="g">г</option>
                            <option value="l">л</option>
                            <option value="ml">мл</option>
                            <option value="pcs">шт</option>
                        </select>
                        <button type="button" class="btn btn-small btn-danger" onclick="this.parentElement.remove()">🗑️</button>
                    </div>
                </div>
                <button type="button" class="btn btn-secondary btn-small" onclick="recipesModule.addIngredientRow()">➕ Добавить ингредиент</button>
                
                <div class="form-actions" style="margin-top: 1rem;">
                    <button type="button" class="btn btn-secondary" onclick="recipesModule.closeModal()">Отмена</button>
                    <button type="submit" class="btn btn-primary">💾 Сохранить</button>
                </div>
            </form>
        `, '', 'large');

        document.getElementById('recipeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitRecipe(new FormData(e.target));
        });
    }

    addIngredientRow(listId = 'ingredientsList') {
        const list = document.getElementById(listId);
        if (!list) return;
        
        const index = list.children.length;
        
        const row = document.createElement('div');
        row.className = 'ingredient-row';
        row.style.cssText = 'display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 0.5rem; margin-bottom: 0.5rem;';
        row.innerHTML = `
            <select name="ingredients[${index}][product_id]" class="form-input" required>
                <option value="">Выберите продукт...</option>
                ${this.products.map(p => `<option value="${p.id}">${p.name} (${p.sku || ''})</option>`).join('')}
            </select>
            <input type="number" name="ingredients[${index}][quantity]" class="form-input" placeholder="Количество" step="0.001" min="0.001" required>
            <select name="ingredients[${index}][unit]" class="form-input">
                <option value="kg">кг</option>
                <option value="g">г</option>
                <option value="l">л</option>
                <option value="ml">мл</option>
                <option value="pcs">шт</option>
            </select>
            <button type="button" class="btn btn-small btn-danger" onclick="this.parentElement.remove()">🗑️</button>
        `;
        list.appendChild(row);
    }

    // Расчет себестоимости техкарты
    calculateRecipeCost(recipe) {
        if (!recipe.ingredients || recipe.ingredients.length === 0) {
            return 0;
        }

        let totalCost = 0;
        recipe.ingredients.forEach(ing => {
            const product = this.products.find(p => 
                p.id === ing.product_id || 
                p.id === ing.id ||
                String(p.id) === String(ing.product_id) ||
                String(p.id) === String(ing.id)
            );
            
            if (product) {
                const quantity = parseFloat(ing.quantity || ing.qty || 0);
                const price = parseFloat(product.cost_price || product.purchase_price || product.cost || product.price || 0);
                const lossPercentage = parseFloat(ing.loss_percentage || recipe.loss_percentage || 0);
                
                // Учитываем потери при обработке
                const actualQuantity = quantity * (1 + lossPercentage / 100);
                totalCost += actualQuantity * price;
            }
        });

        // Применяем наценку, если указана
        const markup = parseFloat(recipe.markup || recipe.markup_percentage || 0);
        if (markup > 0) {
            totalCost = totalCost * (1 + markup / 100);
        }

        return totalCost;
    }

    async submitRecipe(formData) {
        try {
            const data = {};
            const ingredients = [];

            for (const [key, value] of formData.entries()) {
                if (key.startsWith('ingredients[')) {
                    const match = key.match(/ingredients\[(\d+)\]\[(\w+)\]/);
                    if (match) {
                        const index = parseInt(match[1]);
                        const field = match[2];
                        
                        if (!ingredients[index]) {
                            ingredients[index] = {};
                        }
                        ingredients[index][field] = value;
                    }
                } else {
                    data[key] = value || null;
                }
            }

            data.ingredients = ingredients.filter(ing => ing.product_id && ing.quantity);
            data.output_quantity = parseFloat(data.output_quantity);
            data.cooking_time = data.cooking_time ? parseInt(data.cooking_time) : null;
            data.loss_percentage = data.loss_percentage ? parseFloat(data.loss_percentage) : 0;
            data.is_active = data.is_active !== false; // По умолчанию активна
            data.status = data.is_active ? 'active' : 'draft';

            // Рассчитываем себестоимость перед сохранением
            const tempRecipe = { ...data, ingredients: data.ingredients };
            data.cost = this.calculateRecipeCost(tempRecipe);

            const response = await fetch(this.API_BASE, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Ошибка сервера' }));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            
            const result = await response.json();
            if (result.ok || result.success) {
                const message = '✅ Техкарта успешно создана!' + 
                    (result.product_id ? ` Товар создан с ID: ${result.product_id}` : '') +
                    (result.cost ? ` Себестоимость: ₽${result.cost.toFixed(2)}` : '');
                alert(message);
                this.closeModal();
                await this.loadRecipes();
                this.render();
                
                // Обновляем список товаров, если есть ProductCardsManager
                if (window.ProductCardsManager && typeof window.ProductCardsManager.loadProducts === 'function') {
                    await window.ProductCardsManager.loadProducts();
                }
            } else {
                alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
            }
        } catch (error) {
            console.error('Error creating recipe:', error);
            const errorMessage = error.message || 'Ошибка соединения с сервером';
            alert('❌ Ошибка: ' + errorMessage);
        }
    }

    async showRecipeDetails(recipeId) {
        const recipe = this.recipes.find(r => r.id === recipeId);
        if (!recipe) return;

        const ingredientsTable = recipe.ingredients?.map(ing => `
            <tr>
                <td>${ing.product_name}</td>
                <td>${ing.quantity} ${ing.unit}</td>
                <td>₽ ${(ing.product_price || 0).toFixed(2)}</td>
                <td>₽ ${((ing.product_price || 0) * ing.quantity).toFixed(2)}</td>
            </tr>
        `).join('') || '';

        this.createModal(`Техкарта: ${recipe.name}`, `
            <div class="recipe-details">
                <div class="grid grid-2">
                    <div>
                        <p><strong>Категория:</strong> ${recipe.category_name || '-'}</p>
                        <p><strong>Выход:</strong> ${recipe.output_quantity} ${recipe.output_unit}</p>
                        <p><strong>Время готовки:</strong> ${recipe.cooking_time ? recipe.cooking_time + ' мин' : '-'}</p>
                        <p><strong>Потери:</strong> ${recipe.loss_percentage || 0}%</p>
                    </div>
                    <div>
                        <p><strong>Себестоимость:</strong> <span style="font-size: 1.5rem; color: #0b5c3b;">₽ ${(recipe.cost || 0).toFixed(2)}</span></p>
                        <p><strong>Ингредиентов:</strong> ${recipe.ingredients?.length || 0}</p>
                        <p><strong>Статус:</strong> ${recipe.is_active ? '✅ Активна' : '⏸️ Неактивна'}</p>
                    </div>
                </div>
                
                ${recipe.description ? `<p><strong>Описание:</strong> ${recipe.description}</p>` : ''}
                
                <h4>Ингредиенты:</h4>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Продукт</th>
                            <th>Количество</th>
                            <th>Цена за ед.</th>
                            <th>Сумма</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ingredientsTable}
                    </tbody>
                    <tfoot>
                        <tr>
                            <th colspan="3">ИТОГО:</th>
                            <th>₽ ${(recipe.cost || 0).toFixed(2)}</th>
                        </tr>
                    </tfoot>
                </table>
                
                ${recipe.cooking_instructions ? `
                    <h4>Инструкция приготовления:</h4>
                    <p style="white-space: pre-wrap;">${recipe.cooking_instructions}</p>
                ` : ''}
            </div>
            <div class="form-actions">
                <button class="btn btn-secondary" onclick="recipesModule.closeModal()">Закрыть</button>
                <button class="btn btn-primary" onclick="recipesModule.showEditRecipeForm('${recipe.id}')">✏️ Редактировать</button>
            </div>
        `, '', 'large');
    }

    async showEditRecipeForm(recipeId) {
        const recipe = this.recipes.find(r => r.id === recipeId);
        if (!recipe) {
            alert('Техкарта не найдена');
            return;
        }

        // Создаем форму редактирования аналогично форме создания
        const modal = this.createModal('Редактировать техкарту', `
            <form id="recipeEditForm">
                <div class="form-group">
                    <label class="form-label">Название блюда *</label>
                    <input type="text" name="name" class="form-input" value="${recipe.name || recipe.dishName || ''}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Категория</label>
                    <select name="category_id" class="form-input">
                        <option value="">Без категории</option>
                        ${this.categories.map(c => `<option value="${c.id}" ${recipe.category_id == c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Описание</label>
                    <textarea name="description" class="form-input" rows="2">${recipe.description || ''}</textarea>
                </div>
                <div class="grid grid-2">
                    <div class="form-group">
                        <label class="form-label">Выход (количество) *</label>
                        <input type="number" name="output_quantity" class="form-input" step="0.001" min="0.001" value="${recipe.output_quantity || recipe.yieldOut || ''}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Единица измерения *</label>
                        <select name="output_unit" class="form-input" required>
                            <option value="pcs" ${(recipe.output_unit || recipe.yieldUnit) === 'pcs' || (recipe.output_unit || recipe.yieldUnit) === 'шт' ? 'selected' : ''}>шт</option>
                            <option value="kg" ${(recipe.output_unit || recipe.yieldUnit) === 'kg' || (recipe.output_unit || recipe.yieldUnit) === 'кг' ? 'selected' : ''}>кг</option>
                            <option value="g" ${(recipe.output_unit || recipe.yieldUnit) === 'g' || (recipe.output_unit || recipe.yieldUnit) === 'г' ? 'selected' : ''}>г</option>
                            <option value="l" ${(recipe.output_unit || recipe.yieldUnit) === 'l' || (recipe.output_unit || recipe.yieldUnit) === 'л' ? 'selected' : ''}>л</option>
                            <option value="portion" ${(recipe.output_unit || recipe.yieldUnit) === 'portion' || (recipe.output_unit || recipe.yieldUnit) === 'порция' ? 'selected' : ''}>порция</option>
                        </select>
                    </div>
                </div>
                <div class="grid grid-2">
                    <div class="form-group">
                        <label class="form-label">Время готовки (мин)</label>
                        <input type="number" name="cooking_time" class="form-input" min="1" value="${recipe.cooking_time || ''}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Потери при готовке (%)</label>
                        <input type="number" name="loss_percentage" class="form-input" min="0" max="100" value="${recipe.loss_percentage || 0}">
                    </div>
                </div>
                <div class="grid grid-2">
                    <div class="form-group">
                        <label class="form-label">Наценка (%)</label>
                        <input type="number" name="markup" class="form-input" min="0" value="${recipe.markup || recipe.markup_percentage || 0}" step="0.1">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Статус</label>
                        <select name="is_active" class="form-input">
                            <option value="true" ${recipe.is_active !== false ? 'selected' : ''}>✅ Активна (отображается в меню)</option>
                            <option value="false" ${recipe.is_active === false ? 'selected' : ''}>⏸️ Черновик (скрыта от клиентов)</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Инструкция приготовления</label>
                    <textarea name="cooking_instructions" class="form-input" rows="3">${recipe.cooking_instructions || ''}</textarea>
                </div>
                
                <hr style="margin: 1rem 0;">
                <h4>Ингредиенты *</h4>
                <div id="editIngredientsList">
                    ${(recipe.ingredients || []).map((ing, idx) => `
                        <div class="ingredient-row" style="display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 0.5rem; margin-bottom: 0.5rem;">
                            <select name="ingredients[${idx}][product_id]" class="form-input" required>
                                <option value="">Выберите продукт...</option>
                                ${this.products.map(p => `<option value="${p.id}" ${(ing.product_id || ing.id) == p.id ? 'selected' : ''}>${p.name} (${p.sku || ''})</option>`).join('')}
                            </select>
                            <input type="number" name="ingredients[${idx}][quantity]" class="form-input" placeholder="Количество" step="0.001" min="0.001" value="${ing.quantity || ing.qty || ''}" required>
                            <select name="ingredients[${idx}][unit]" class="form-input">
                                <option value="kg" ${(ing.unit || 'kg') === 'kg' ? 'selected' : ''}>кг</option>
                                <option value="g" ${(ing.unit || 'g') === 'g' ? 'selected' : ''}>г</option>
                                <option value="l" ${(ing.unit || 'l') === 'l' ? 'selected' : ''}>л</option>
                                <option value="ml" ${(ing.unit || 'ml') === 'ml' ? 'selected' : ''}>мл</option>
                                <option value="pcs" ${(ing.unit || 'pcs') === 'pcs' ? 'selected' : ''}>шт</option>
                            </select>
                            <button type="button" class="btn btn-small btn-danger" onclick="this.parentElement.remove()">🗑️</button>
                        </div>
                    `).join('')}
                </div>
                <button type="button" class="btn btn-secondary btn-small" onclick="recipesModule.addIngredientRow('editIngredientsList')">➕ Добавить ингредиент</button>
                
                <div class="form-actions" style="margin-top: 1rem;">
                    <button type="button" class="btn btn-secondary" onclick="recipesModule.closeModal()">Отмена</button>
                    <button type="submit" class="btn btn-primary">💾 Сохранить изменения</button>
                </div>
            </form>
        `, '', 'large');

        document.getElementById('recipeEditForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.updateRecipe(recipeId, new FormData(e.target));
        });
    }

    async updateRecipe(recipeId, formData) {
        try {
            const data = {};
            const ingredients = [];

            for (const [key, value] of formData.entries()) {
                if (key.startsWith('ingredients[')) {
                    const match = key.match(/ingredients\[(\d+)\]\[(\w+)\]/);
                    if (match) {
                        const index = parseInt(match[1]);
                        const field = match[2];
                        
                        if (!ingredients[index]) {
                            ingredients[index] = {};
                        }
                        ingredients[index][field] = value;
                    }
                } else {
                    data[key] = value || null;
                }
            }

            data.ingredients = ingredients.filter(ing => ing.product_id && ing.quantity);
            data.output_quantity = parseFloat(data.output_quantity);
            data.cooking_time = data.cooking_time ? parseInt(data.cooking_time) : null;
            data.loss_percentage = data.loss_percentage ? parseFloat(data.loss_percentage) : 0;
            data.markup = data.markup ? parseFloat(data.markup) : 0;
            data.is_active = data.is_active === 'true';
            data.status = data.is_active ? 'active' : 'draft';

            // Рассчитываем себестоимость
            const tempRecipe = { ...data, ingredients: data.ingredients };
            data.cost = this.calculateRecipeCost(tempRecipe);

            const response = await fetch(`${this.API_BASE}/${recipeId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (result.ok) {
                alert('✅ Техкарта успешно обновлена!');
                this.closeModal();
                await this.loadRecipes();
                this.render();
            } else {
                alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
            }
        } catch (error) {
            console.error('Error updating recipe:', error);
            alert('❌ Ошибка соединения с сервером: ' + error.message);
        }
    }

    async deleteRecipe(recipeId) {
        if (!confirm('Вы уверены, что хотите удалить эту техкарту?')) {
            return;
        }

        try {
            const response = await fetch(`${this.API_BASE}/${recipeId}`, {
                method: 'DELETE'
            });

            const result = await response.json();
            if (result.ok) {
                alert('✅ Техкарта удалена!');
                await this.loadRecipes();
                this.render();
            } else {
                alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
            }
        } catch (error) {
            console.error('Error deleting recipe:', error);
            alert('❌ Ошибка соединения с сервером');
        }
    }

    calculateAverageCost() {
        if (this.recipes.length === 0) return 0;
        const total = this.recipes.reduce((sum, r) => sum + (r.cost || 0), 0);
        return total / this.recipes.length;
    }

    calculateTotalCost() {
        return this.recipes.reduce((sum, r) => sum + (r.cost || 0), 0);
    }

    async calculateAllCosts() {
        if (!confirm(`Пересчитать себестоимость для всех ${this.recipes.length} техкарт?`)) {
            return;
        }

        let updated = 0;
        let errors = [];

        for (const recipe of this.recipes) {
            try {
                const newCost = this.calculateRecipeCost(recipe);
                recipe.cost = newCost;

                // Обновляем на сервере
                try {
                    const response = await fetch(`${this.API_BASE}/${recipe.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ cost: newCost })
                    });
                    if (response.ok) {
                        updated++;
                    }
                } catch (err) {
                    errors.push(recipe.name || recipe.dishName || 'Без названия');
                }
            } catch (error) {
                errors.push(recipe.name || recipe.dishName || 'Без названия');
            }
        }

        await this.loadRecipes();
        this.render();

        let message = `✅ Себестоимость пересчитана для ${updated} техкарт`;
        if (errors.length > 0) {
            message += `\n⚠️ Ошибок: ${errors.length}`;
        }
        alert(message);
    }

    filterRecipes(searchTerm) {
        const tbody = document.getElementById('recipesTableBody');
        const rows = tbody.querySelectorAll('tr');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            if (text.includes(searchTerm.toLowerCase())) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
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
                    <button class="modal-close" onclick="recipesModule.closeModal()">×</button>
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

    // Экспорт техкарт в CSV
    async exportRecipes() {
        if (this.recipes.length === 0) {
            alert('❌ Нет техкарт для экспорта');
            return;
        }

        const headers = [
            'name', 'category_id', 'category_name', 'output_quantity', 'output_unit',
            'cooking_time', 'loss_percentage', 'markup', 'cost', 'is_active',
            'ingredients', 'cooking_instructions', 'description'
        ];

        let csvContent = headers.join(',') + '\n';

        this.recipes.forEach(recipe => {
            const ingredients = (recipe.ingredients || []).map(ing => {
                const product = this.products.find(p => p.id === ing.product_id || p.id === ing.id);
                const productName = product ? product.name : (ing.product_name || ing.name || '');
                return `${productName}:${ing.quantity || ing.qty || 0}${ing.unit || ''}`;
            }).join(';');

            const row = [
                `"${(recipe.name || recipe.dishName || '').replace(/"/g, '""')}"`,
                recipe.category_id || '',
                `"${(recipe.category_name || '').replace(/"/g, '""')}"`,
                recipe.output_quantity || recipe.yieldOut || '',
                recipe.output_unit || recipe.yieldUnit || '',
                recipe.cooking_time || '',
                recipe.loss_percentage || 0,
                recipe.markup || recipe.markup_percentage || 0,
                recipe.cost || 0,
                recipe.is_active ? 'active' : 'draft',
                `"${ingredients.replace(/"/g, '""')}"`,
                `"${(recipe.cooking_instructions || '').replace(/"/g, '""')}"`,
                `"${(recipe.description || '').replace(/"/g, '""')}"`
            ];
            csvContent += row.join(',') + '\n';
        });

        // Создаем и скачиваем файл
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `dandy_recipes_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        alert(`✅ Экспорт техкарт завершен (${this.recipes.length} рецептов)`);
    }
}

// Initialize module
if (typeof window !== 'undefined') {
    window.RecipesManagementModule = RecipesManagementModule;
    window.recipesModule = new RecipesManagementModule();
}

