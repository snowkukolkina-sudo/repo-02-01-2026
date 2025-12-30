/**
 * DANDY Inventory — Модуль технологических карт (ТК/ТТК)
 * Управление рецептурами, калькуляция, коэффициенты потерь
 */

class RecipesModule {
    constructor(inventorySystem) {
        this.system = inventorySystem;
        this.selectedRecipe = null;
        this.editingIngredients = [];
    }

    /**
     * Инициализация модуля
     */
    init() {
        console.log('📖 Recipes module initialized');
        this.renderRecipesList();
    }

    /**
     * Отрисовка списка техкарт
     */
    renderRecipesList() {
        const tbody = document.querySelector('#recipesTableBody');
        if (!tbody) return;

        if (this.system.recipes.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem; color: #F3EADB; opacity: 0.7;">
                        Техкарты не найдены. Создайте первую ТК!
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.system.recipes.map(recipe => `
            <tr style="cursor: pointer;" onclick="recipesModule.selectRecipe(${recipe.id})">
                <td><code>${recipe.code}</code></td>
                <td><strong>${recipe.dishName}</strong></td>
                <td>${recipe.yieldOut} ${recipe.yieldUnit}</td>
                <td><strong>₽ ${recipe.costPrice.toFixed(2)}</strong></td>
                <td>${recipe.ingredients.length}</td>
                <td><span class="badge badge-info">${recipe.version}</span></td>
                <td>
                    <button class="btn btn-primary btn-small" onclick="event.stopPropagation(); recipesModule.editRecipe(${recipe.id})">
                        ✏️ Редактировать
                    </button>
                    <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); recipesModule.calculateRecipe(${recipe.id})">
                        🧮 Калькуляция
                    </button>
                </td>
            </tr>
        `).join('');
    }

    /**
     * Выбор техкарты
     */
    selectRecipe(recipeId) {
        this.selectedRecipe = this.system.recipes.find(r => r.id === recipeId);
        if (this.selectedRecipe) {
            this.showRecipeDetails(this.selectedRecipe);
        }
    }

    /**
     * Показать детали техкарты
     */
    showRecipeDetails(recipe) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        const ingredientsHTML = recipe.ingredients.map(ing => {
            const product = this.system.products.find(p => p.id === ing.id);
            const productName = product ? product.name : ing.name;
            const loss = (ing.k_evap || 0) + (ing.k_trim || 0) + (ing.k_wash || 0);
            
            return `
                <tr>
                    <td>${productName}</td>
                    <td>${ing.qty} ${ing.unit}</td>
                    <td>${loss > 0 ? `${loss.toFixed(1)}%` : '—'}</td>
                    <td>${product ? `₽ ${(ing.qty * product.price).toFixed(2)}` : '—'}</td>
                </tr>
            `;
        }).join('');

        modal.innerHTML = `
            <div style="background: #094a45; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 2rem; max-width: 900px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h2 style="margin: 0; color: #eebc5c;">📖 ${recipe.dishName}</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" 
                            style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #F3EADB; opacity: 0.7;">×</button>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                    <div style="background: rgba(59, 130, 246, 0.1); padding: 1rem; border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.3);">
                        <strong style="display: block; margin-bottom: 0.5rem; color: #F3EADB;">Код ТК</strong>
                        <code style="font-size: 1.1em; color: #F3EADB;">${recipe.code}</code>
                    </div>
                    <div style="background: rgba(34, 197, 94, 0.1); padding: 1rem; border-radius: 8px; border: 1px solid rgba(34, 197, 94, 0.3);">
                        <strong style="display: block; margin-bottom: 0.5rem; color: #F3EADB;">Выход</strong>
                        <span style="font-size: 1.2em; font-weight: 700; color: #F3EADB;">${recipe.yieldOut} ${recipe.yieldUnit}</span>
                    </div>
                    <div style="background: rgba(234, 179, 8, 0.1); padding: 1rem; border-radius: 8px; border: 1px solid rgba(234, 179, 8, 0.3);">
                        <strong style="display: block; margin-bottom: 0.5rem; color: #F3EADB;">Себестоимость</strong>
                        <span style="font-size: 1.2em; font-weight: 700; color: #eebc5c;">₽ ${recipe.costPrice.toFixed(2)}</span>
                    </div>
                </div>

                <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; border: 1px solid rgba(255,255,255,0.12);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>Версия:</strong> ${recipe.version}
                        </div>
                        <div>
                            <strong>Ингредиентов:</strong> ${recipe.ingredients.length}
                        </div>
                        <div>
                            <strong>Создана:</strong> ${recipe.createdAt ? new Date(recipe.createdAt).toLocaleDateString('ru-RU') : '—'}
                        </div>
                    </div>
                </div>

                <h3 style="margin-top: 1.5rem; margin-bottom: 1rem; color: #eebc5c;">🥘 Состав</h3>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Ингредиент</th>
                            <th>Закладка</th>
                            <th>Потери</th>
                            <th>Стоимость</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ingredientsHTML}
                    </tbody>
                    <tfoot>
                        <tr style="background: rgba(255,255,255,0.05); font-weight: 700;">
                            <td colspan="3">ИТОГО:</td>
                            <td>₽ ${recipe.costPrice.toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>

                <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                    <button onclick="recipesModule.editRecipe(${recipe.id}); this.closest('.modal-overlay').remove();" 
                            class="btn btn-primary">
                        ✏️ Редактировать
                    </button>
                    <button onclick="recipesModule.calculateRecipe(${recipe.id})" 
                            class="btn btn-secondary">
                        🧮 Перерасчёт
                    </button>
                    <button onclick="recipesModule.duplicateRecipe(${recipe.id}); this.closest('.modal-overlay').remove();" 
                            class="btn btn-secondary">
                        📋 Дублировать
                    </button>
                    <button onclick="this.closest('.modal-overlay').remove()" 
                            class="btn btn-secondary">
                        Закрыть
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    /**
     * Создание новой техкарты
     */
    createRecipe() {
        this.editingIngredients = [];
        this.showRecipeEditor(null);
    }

    /**
     * Редактирование техкарты
     */
    editRecipe(recipeId) {
        const recipe = this.system.recipes.find(r => r.id === recipeId);
        if (!recipe) return;

        this.editingIngredients = [...recipe.ingredients];
        this.showRecipeEditor(recipe);
    }

    /**
     * Показать редактор техкарты
     */
    showRecipeEditor(recipe) {
        const isNew = !recipe;
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'recipeEditorModal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: #094a45; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 2rem; max-width: 1000px; width: 95%; max-height: 95vh; overflow-y: auto;">
                <h2 style="margin: 0 0 1.5rem 0; color: #eebc5c;">
                    ${isNew ? '➕ Создание техкарты' : '✏️ Редактирование техкарты'}
                </h2>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                    <div class="form-group">
                        <label class="form-label">Код ТК*</label>
                        <input type="text" class="form-input" id="recipeCode" value="${recipe ? recipe.code : ''}" placeholder="TK-001">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Наименование блюда*</label>
                        <input type="text" class="form-input" id="recipeDishName" value="${recipe ? recipe.dishName : ''}" placeholder="Например: Пицца Пепперони">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Выход (количество)*</label>
                        <input type="number" class="form-input" id="recipeYield" value="${recipe ? recipe.yieldOut : ''}" step="0.01" placeholder="450">
                    </div>

                    <div class="form-group">
                        <label class="form-label">Единица выхода*</label>
                        <select class="form-select" id="recipeYieldUnit">
                            <option value="г" ${recipe && recipe.yieldUnit === 'г' ? 'selected' : ''}>г</option>
                            <option value="кг" ${recipe && recipe.yieldUnit === 'кг' ? 'selected' : ''}>кг</option>
                            <option value="мл" ${recipe && recipe.yieldUnit === 'мл' ? 'selected' : ''}>мл</option>
                            <option value="л" ${recipe && recipe.yieldUnit === 'л' ? 'selected' : ''}>л</option>
                            <option value="шт" ${recipe && recipe.yieldUnit === 'шт' ? 'selected' : ''}>шт</option>
                            <option value="порция" ${recipe && recipe.yieldUnit === 'порция' ? 'selected' : ''}>порция</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Версия</label>
                        <input type="text" class="form-input" id="recipeVersion" value="${recipe ? recipe.version : 'v1.0'}" placeholder="v1.0">
                    </div>
                </div>

                <h3 style="margin-top: 1.5rem; margin-bottom: 1rem; color: #eebc5c;">🥘 Состав</h3>
                
                <div style="margin-bottom: 1rem;">
                    <button onclick="recipesModule.addIngredient()" class="btn btn-primary btn-small">
                        ➕ Добавить ингредиент
                    </button>
                </div>

                <div id="ingredientsList" style="margin-bottom: 1.5rem;">
                    <!-- Список ингредиентов будет здесь -->
                </div>

                <div style="background: rgba(34, 197, 94, 0.1); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; border: 1px solid rgba(34, 197, 94, 0.3);">
                    <strong style="color: #F3EADB;">Себестоимость (расчётная):</strong> 
                    <span id="calculatedCost" style="font-size: 1.2em; font-weight: 700; color: #eebc5c; margin-left: 0.5rem;">
                        ₽ 0.00
                    </span>
                </div>

                <div style="display: flex; gap: 1rem;">
                    <button onclick="recipesModule.saveRecipe(${recipe ? recipe.id : 'null'})" class="btn btn-primary">
                        💾 Сохранить
                    </button>
                    <button onclick="recipesModule.calculateCost()" class="btn btn-secondary">
                        🧮 Пересчитать
                    </button>
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">
                        Отмена
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.renderIngredientsList();
        this.calculateCost();
    }

    /**
     * Отрисовка списка ингредиентов
     */
    renderIngredientsList() {
        const container = document.getElementById('ingredientsList');
        if (!container) return;

        if (this.editingIngredients.length === 0) {
            container.innerHTML = `
                <div style="padding: 2rem; text-align: center; color: #F3EADB; opacity: 0.7; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.12);">
                    Ингредиентов пока нет. Добавьте первый!
                </div>
            `;
            return;
        }

        container.innerHTML = this.editingIngredients.map((ing, index) => {
            const product = this.system.products.find(p => p.id === ing.id);
            return `
                <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; margin-bottom: 0.75rem; border: 1px solid rgba(255,255,255,0.12);">
                    <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr auto; gap: 0.75rem; align-items: end;">
                        <div class="form-group" style="margin: 0;">
                            <label class="form-label" style="font-size: 0.85em;">Ингредиент</label>
                            <select class="form-select" onchange="recipesModule.updateIngredient(${index}, 'id', parseInt(this.value))">
                                <option value="">Выберите...</option>
                                ${this.system.products.filter(p => p.type === 'ingredient' || p.type === 'semi_product').map(p => `
                                    <option value="${p.id}" ${ing.id === p.id ? 'selected' : ''}>${p.name}</option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <div class="form-group" style="margin: 0;">
                            <label class="form-label" style="font-size: 0.85em;">Количество</label>
                            <input type="number" class="form-input" value="${ing.qty}" step="0.01" 
                                   onchange="recipesModule.updateIngredient(${index}, 'qty', parseFloat(this.value))">
                        </div>
                        
                        <div class="form-group" style="margin: 0;">
                            <label class="form-label" style="font-size: 0.85em;">Единица</label>
                            <select class="form-select" onchange="recipesModule.updateIngredient(${index}, 'unit', this.value)">
                                <option value="г" ${ing.unit === 'г' ? 'selected' : ''}>г</option>
                                <option value="кг" ${ing.unit === 'кг' ? 'selected' : ''}>кг</option>
                                <option value="мл" ${ing.unit === 'мл' ? 'selected' : ''}>мл</option>
                                <option value="л" ${ing.unit === 'л' ? 'selected' : ''}>л</option>
                                <option value="шт" ${ing.unit === 'шт' ? 'selected' : ''}>шт</option>
                            </select>
                        </div>
                        
                        <div class="form-group" style="margin: 0;">
                            <label class="form-label" style="font-size: 0.85em;">Потери %</label>
                            <input type="number" class="form-input" value="${ing.k_evap || 0}" step="0.1" 
                                   onchange="recipesModule.updateIngredient(${index}, 'k_evap', parseFloat(this.value))"
                                   title="Уварка/ужарка">
                        </div>
                        
                        <div style="color: #eebc5c; font-weight: 700; font-size: 1.1em; padding: 0.5rem;">
                            ${product ? `₽ ${(ing.qty * product.price).toFixed(2)}` : '—'}
                        </div>
                        
                        <button onclick="recipesModule.removeIngredient(${index})" 
                                style="padding: 0.5rem 0.75rem; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer;">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Добавить ингредиент
     */
    addIngredient() {
        this.editingIngredients.push({
            id: null,
            name: '',
            qty: 0,
            unit: 'г',
            k_evap: 0,
            k_trim: 0,
            k_wash: 0
        });
        this.renderIngredientsList();
    }

    /**
     * Обновить ингредиент
     */
    updateIngredient(index, field, value) {
        if (this.editingIngredients[index]) {
            this.editingIngredients[index][field] = value;
            
            // Если изменили ингредиент, обновляем имя
            if (field === 'id') {
                const product = this.system.products.find(p => p.id === value);
                if (product) {
                    this.editingIngredients[index].name = product.name;
                    this.editingIngredients[index].unit = product.baseUnit;
                }
            }
            
            this.renderIngredientsList();
            this.calculateCost();
        }
    }

    /**
     * Удалить ингредиент
     */
    removeIngredient(index) {
        this.editingIngredients.splice(index, 1);
        this.renderIngredientsList();
        this.calculateCost();
    }

    /**
     * Расчёт себестоимости
     */
    calculateCost() {
        let totalCost = 0;

        this.editingIngredients.forEach(ing => {
            if (!ing.id) return;
            
            const product = this.system.products.find(p => p.id === ing.id);
            if (product) {
                // Учитываем потери
                const lossCoeff = 1 + (ing.k_evap || 0) / 100;
                const actualQty = ing.qty * lossCoeff;
                
                totalCost += actualQty * product.price;
            }
        });

        const costElement = document.getElementById('calculatedCost');
        if (costElement) {
            costElement.textContent = `₽ ${totalCost.toFixed(2)}`;
        }

        return totalCost;
    }

    /**
     * Сохранение техкарты
     */
    saveRecipe(recipeId) {
        const code = document.getElementById('recipeCode').value.trim();
        const dishName = document.getElementById('recipeDishName').value.trim();
        const yieldOut = parseFloat(document.getElementById('recipeYield').value);
        const yieldUnit = document.getElementById('recipeYieldUnit').value;
        const version = document.getElementById('recipeVersion').value.trim();

        // ✅ ВАЛИДАЦИЯ
        if (window.inventoryValidator) {
            const validator = window.inventoryValidator;
            validator.clearErrors();
            
            validator.validateRequired(code, 'Код ТК');
            validator.validateRequired(dishName, 'Наименование блюда');
            validator.validateQuantity(yieldOut, 'Выход');
            
            if (this.editingIngredients.length === 0) {
                validator.addError('Состав', 'Добавьте хотя бы один ингредиент');
            }
            
            if (validator.hasErrors()) {
                validator.showErrors();
                return;
            }
        } else {
            // Fallback валидация
            if (!code || !dishName || !yieldOut) {
                alert('⚠️ Заполните обязательные поля: код, наименование, выход');
                return;
            }

            if (this.editingIngredients.length === 0) {
                alert('⚠️ Добавьте хотя бы один ингредиент');
                return;
            }
        }

        // Проверяем, что все ингредиенты выбраны
        const hasEmptyIngredients = this.editingIngredients.some(ing => !ing.id);
        if (hasEmptyIngredients) {
            alert('⚠️ Выберите ингредиенты для всех строк');
            return;
        }

        const costPrice = this.calculateCost();

        if (recipeId && recipeId !== 'null') {
            // Обновляем существующую
            const recipe = this.system.recipes.find(r => r.id === recipeId);
            if (recipe) {
                recipe.code = code;
                recipe.dishName = dishName;
                recipe.yieldOut = yieldOut;
                recipe.yieldUnit = yieldUnit;
                recipe.version = version;
                recipe.ingredients = [...this.editingIngredients];
                recipe.costPrice = costPrice;
                recipe.updatedAt = new Date().toISOString();
            }
        } else {
            // Создаём новую
            const newRecipe = {
                id: Date.now(),
                code,
                dishId: Date.now(), // В реальной системе связь с блюдом
                dishName,
                version,
                yieldOut,
                yieldUnit,
                ingredients: [...this.editingIngredients],
                costPrice,
                createdAt: new Date().toISOString()
            };
            this.system.recipes.push(newRecipe);
        }

        // Сохраняем
        this.system.saveToLocalStorage('recipes', this.system.recipes);

        // Закрываем модалку
        document.querySelector('.modal-overlay').remove();

        // Обновляем список
        this.renderRecipesList();

        // Уведомление
        this.showNotification('✅ Техкарта успешно сохранена!', 'success');
    }

    /**
     * Калькуляция техкарты
     */
    calculateRecipe(recipeId) {
        const recipe = this.system.recipes.find(r => r.id === recipeId);
        if (!recipe) return;

        // Пересчитываем себестоимость
        const costPrice = this.system.calculateRecipeCost(recipe);
        recipe.costPrice = costPrice;

        this.system.saveToLocalStorage('recipes', this.system.recipes);
        this.renderRecipesList();

        this.showNotification('🧮 Себестоимость пересчитана!', 'success');
    }

    /**
     * Дублирование техкарты
     */
    duplicateRecipe(recipeId) {
        const recipe = this.system.recipes.find(r => r.id === recipeId);
        if (!recipe) return;

        const newRecipe = {
            ...recipe,
            id: Date.now(),
            code: `${recipe.code}-COPY`,
            dishName: `${recipe.dishName} (копия)`,
            ingredients: recipe.ingredients.map(ing => ({ ...ing })),
            createdAt: new Date().toISOString()
        };

        this.system.recipes.push(newRecipe);
        this.system.saveToLocalStorage('recipes', this.system.recipes);

        this.renderRecipesList();
        this.showNotification('📋 Техкарта дублирована!', 'success');
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
    module.exports = RecipesModule;
}

