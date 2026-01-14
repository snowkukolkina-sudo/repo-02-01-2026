/**
 * Расширенный модуль модификаторов товаров
 * Поддержка дополнительных ингредиентов, размеров, опций и ценовых модификаций
 */

class EnhancedModifiersModule {
    constructor() {
        this.modifiers = new Map();
        this.modifierGroups = new Map();
        this.modifierRules = new Map();
        this.init();
    }

    init() {
        this.loadModifiers();
        this.setupDefaultModifiers();
    }

    // Загрузка модификаторов
    loadModifiers() {
        try {
            const savedModifiers = localStorage.getItem('modifiers');
            if (savedModifiers) {
                const data = JSON.parse(savedModifiers);
                this.modifiers = new Map(data.modifiers || []);
                this.modifierGroups = new Map(data.modifierGroups || []);
                this.modifierRules = new Map(data.modifierRules || []);
            }
        } catch (error) {
            console.error('Ошибка загрузки модификаторов:', error);
        }
    }

    // Сохранение модификаторов
    saveModifiers() {
        try {
            const data = {
                modifiers: Array.from(this.modifiers.entries()),
                modifierGroups: Array.from(this.modifierGroups.entries()),
                modifierRules: Array.from(this.modifierRules.entries())
            };
            localStorage.setItem('modifiers', JSON.stringify(data));
        } catch (error) {
            console.error('Ошибка сохранения модификаторов:', error);
        }
    }

    // Настройка модификаторов по умолчанию
    setupDefaultModifiers() {
        if (this.modifiers.size === 0) {
            this.createDefaultModifiers();
        }
    }

    // Создание модификаторов по умолчанию
    createDefaultModifiers() {
        // Группы модификаторов
        const modifierGroups = [
            {
                id: 'size',
                name: 'Размер',
                type: 'single', // single, multiple
                required: true,
                sortOrder: 1
            },
            {
                id: 'dough',
                name: 'Тесто',
                type: 'single',
                required: false,
                sortOrder: 2
            },
            {
                id: 'toppings',
                name: 'Дополнительные ингредиенты',
                type: 'multiple',
                required: false,
                sortOrder: 3
            },
            {
                id: 'sauce',
                name: 'Соус',
                type: 'single',
                required: false,
                sortOrder: 4
            },
            {
                id: 'spice',
                name: 'Острота',
                type: 'single',
                required: false,
                sortOrder: 5
            },
            {
                id: 'drink_size',
                name: 'Размер напитка',
                type: 'single',
                required: true,
                sortOrder: 1
            },
            {
                id: 'ice',
                name: 'Лед',
                type: 'single',
                required: false,
                sortOrder: 2
            }
        ];

        // Модификаторы
        const modifiers = [
            // Размеры пиццы
            { id: 'size_small', groupId: 'size', name: 'Маленькая (25 см)', price: 0, sortOrder: 1 },
            { id: 'size_medium', groupId: 'size', name: 'Средняя (30 см)', price: 150, sortOrder: 2 },
            { id: 'size_large', groupId: 'size', name: 'Большая (35 см)', price: 300, sortOrder: 3 },
            { id: 'size_xl', groupId: 'size', name: 'Очень большая (40 см)', price: 450, sortOrder: 4 },

            // Тесто
            { id: 'dough_thin', groupId: 'dough', name: 'Тонкое', price: 0, sortOrder: 1 },
            { id: 'dough_thick', groupId: 'dough', name: 'Толстое', price: 50, sortOrder: 2 },
            { id: 'dough_cheese', groupId: 'dough', name: 'Сырное', price: 100, sortOrder: 3 },

            // Дополнительные ингредиенты
            { id: 'extra_cheese', groupId: 'toppings', name: 'Дополнительный сыр', price: 80, sortOrder: 1 },
            { id: 'extra_pepperoni', groupId: 'toppings', name: 'Дополнительная пепперони', price: 120, sortOrder: 2 },
            { id: 'extra_mushrooms', groupId: 'toppings', name: 'Дополнительные грибы', price: 60, sortOrder: 3 },
            { id: 'extra_olives', groupId: 'toppings', name: 'Дополнительные оливки', price: 70, sortOrder: 4 },
            { id: 'extra_tomatoes', groupId: 'toppings', name: 'Дополнительные помидоры', price: 50, sortOrder: 5 },
            { id: 'extra_onions', groupId: 'toppings', name: 'Дополнительный лук', price: 40, sortOrder: 6 },
            { id: 'extra_peppers', groupId: 'toppings', name: 'Дополнительный перец', price: 60, sortOrder: 7 },
            { id: 'extra_bacon', groupId: 'toppings', name: 'Дополнительный бекон', price: 100, sortOrder: 8 },

            // Соусы
            { id: 'sauce_tomato', groupId: 'sauce', name: 'Томатный', price: 0, sortOrder: 1 },
            { id: 'sauce_bbq', groupId: 'sauce', name: 'Барбекю', price: 30, sortOrder: 2 },
            { id: 'sauce_garlic', groupId: 'sauce', name: 'Чесночный', price: 25, sortOrder: 3 },
            { id: 'sauce_spicy', groupId: 'sauce', name: 'Острый', price: 35, sortOrder: 4 },

            // Острота
            { id: 'spice_mild', groupId: 'spice', name: 'Не острая', price: 0, sortOrder: 1 },
            { id: 'spice_medium', groupId: 'spice', name: 'Средне острая', price: 0, sortOrder: 2 },
            { id: 'spice_hot', groupId: 'spice', name: 'Острая', price: 0, sortOrder: 3 },
            { id: 'spice_very_hot', groupId: 'spice', name: 'Очень острая', price: 0, sortOrder: 4 },

            // Размеры напитков
            { id: 'drink_small', groupId: 'drink_size', name: 'Маленький (0.33л)', price: 0, sortOrder: 1 },
            { id: 'drink_medium', groupId: 'drink_size', name: 'Средний (0.5л)', price: 30, sortOrder: 2 },
            { id: 'drink_large', groupId: 'drink_size', name: 'Большой (0.75л)', price: 60, sortOrder: 3 },

            // Лед
            { id: 'ice_normal', groupId: 'ice', name: 'Обычный лед', price: 0, sortOrder: 1 },
            { id: 'ice_extra', groupId: 'ice', name: 'Дополнительный лед', price: 0, sortOrder: 2 },
            { id: 'ice_no', groupId: 'ice', name: 'Без льда', price: 0, sortOrder: 3 }
        ];

        // Правила модификаторов
        const modifierRules = [
            {
                id: 'pizza_size_rule',
                productCategoryId: 'pizza',
                modifierGroupId: 'size',
                required: true,
                defaultModifierId: 'size_medium'
            },
            {
                id: 'drink_size_rule',
                productCategoryId: 'drinks',
                modifierGroupId: 'drink_size',
                required: true,
                defaultModifierId: 'drink_medium'
            },
            {
                id: 'max_toppings_rule',
                modifierGroupId: 'toppings',
                maxSelections: 5,
                message: 'Максимум 5 дополнительных ингредиентов'
            }
        ];

        // Сохранение групп модификаторов
        modifierGroups.forEach(group => {
            this.modifierGroups.set(group.id, group);
        });

        // Сохранение модификаторов
        modifiers.forEach(modifier => {
            this.modifiers.set(modifier.id, modifier);
        });

        // Сохранение правил
        modifierRules.forEach(rule => {
            this.modifierRules.set(rule.id, rule);
        });

        this.saveModifiers();
    }

    // Получение модификаторов для продукта
    getModifiersForProduct(productId, categoryId) {
        const applicableModifiers = [];
        const applicableGroups = new Map();

        // Получение правил для категории
        for (const [ruleId, rule] of this.modifierRules) {
            if (rule.productCategoryId === categoryId) {
                const group = this.modifierGroups.get(rule.modifierGroupId);
                if (group) {
                    applicableGroups.set(group.id, {
                        ...group,
                        rule: rule
                    });
                }
            }
        }

        // Получение модификаторов для групп
        for (const [groupId, group] of applicableGroups) {
            const groupModifiers = [];
            
            for (const [modifierId, modifier] of this.modifiers) {
                if (modifier.groupId === groupId) {
                    groupModifiers.push(modifier);
                }
            }

            // Сортировка по sortOrder
            groupModifiers.sort((a, b) => a.sortOrder - b.sortOrder);

            applicableModifiers.push({
                group: group,
                modifiers: groupModifiers
            });
        }

        // Сортировка групп по sortOrder
        applicableModifiers.sort((a, b) => a.group.sortOrder - b.group.sortOrder);

        return applicableModifiers;
    }

    // Создание модификатора
    createModifier(modifierData) {
        const modifier = {
            id: modifierData.id || this.generateModifierId(),
            groupId: modifierData.groupId,
            name: modifierData.name,
            price: modifierData.price || 0,
            sortOrder: modifierData.sortOrder || 1,
            isAvailable: modifierData.isAvailable !== false,
            description: modifierData.description || '',
            imageUrl: modifierData.imageUrl || '',
            allergens: modifierData.allergens || [],
            nutrition: modifierData.nutrition || {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.modifiers.set(modifier.id, modifier);
        this.saveModifiers();
        return modifier;
    }

    // Создание группы модификаторов
    createModifierGroup(groupData) {
        const group = {
            id: groupData.id || this.generateGroupId(),
            name: groupData.name,
            type: groupData.type || 'single', // single, multiple
            required: groupData.required || false,
            sortOrder: groupData.sortOrder || 1,
            description: groupData.description || '',
            maxSelections: groupData.maxSelections || null,
            minSelections: groupData.minSelections || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.modifierGroups.set(group.id, group);
        this.saveModifiers();
        return group;
    }

    // Создание правила модификатора
    createModifierRule(ruleData) {
        const rule = {
            id: ruleData.id || this.generateRuleId(),
            productCategoryId: ruleData.productCategoryId,
            modifierGroupId: ruleData.modifierGroupId,
            required: ruleData.required || false,
            defaultModifierId: ruleData.defaultModifierId || null,
            maxSelections: ruleData.maxSelections || null,
            minSelections: ruleData.minSelections || null,
            message: ruleData.message || '',
            conditions: ruleData.conditions || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.modifierRules.set(rule.id, rule);
        this.saveModifiers();
        return rule;
    }

    // Обновление модификатора
    updateModifier(modifierId, updateData) {
        const modifier = this.modifiers.get(modifierId);
        if (modifier) {
            const updatedModifier = {
                ...modifier,
                ...updateData,
                updatedAt: new Date().toISOString()
            };
            this.modifiers.set(modifierId, updatedModifier);
            this.saveModifiers();
            return updatedModifier;
        }
        return null;
    }

    // Обновление группы модификаторов
    updateModifierGroup(groupId, updateData) {
        const group = this.modifierGroups.get(groupId);
        if (group) {
            const updatedGroup = {
                ...group,
                ...updateData,
                updatedAt: new Date().toISOString()
            };
            this.modifierGroups.set(groupId, updatedGroup);
            this.saveModifiers();
            return updatedGroup;
        }
        return null;
    }

    // Обновление правила модификатора
    updateModifierRule(ruleId, updateData) {
        const rule = this.modifierRules.get(ruleId);
        if (rule) {
            const updatedRule = {
                ...rule,
                ...updateData,
                updatedAt: new Date().toISOString()
            };
            this.modifierRules.set(ruleId, updatedRule);
            this.saveModifiers();
            return updatedRule;
        }
        return null;
    }

    // Удаление модификатора
    deleteModifier(modifierId) {
        const deleted = this.modifiers.delete(modifierId);
        if (deleted) {
            this.saveModifiers();
        }
        return deleted;
    }

    // Удаление группы модификаторов
    deleteModifierGroup(groupId) {
        // Удаление всех модификаторов в группе
        for (const [modifierId, modifier] of this.modifiers) {
            if (modifier.groupId === groupId) {
                this.modifiers.delete(modifierId);
            }
        }

        // Удаление группы
        const deleted = this.modifierGroups.delete(groupId);
        if (deleted) {
            this.saveModifiers();
        }
        return deleted;
    }

    // Удаление правила модификатора
    deleteModifierRule(ruleId) {
        const deleted = this.modifierRules.delete(ruleId);
        if (deleted) {
            this.saveModifiers();
        }
        return deleted;
    }

    // Валидация выбранных модификаторов
    validateModifierSelection(productId, categoryId, selectedModifiers) {
        const errors = [];
        const applicableModifiers = this.getModifiersForProduct(productId, categoryId);

        for (const modifierGroup of applicableModifiers) {
            const group = modifierGroup.group;
            const selectedInGroup = selectedModifiers.filter(mod => 
                this.modifiers.get(mod.modifierId)?.groupId === group.id
            );

            // Проверка обязательности
            if (group.required && selectedInGroup.length === 0) {
                errors.push(`Группа "${group.name}" обязательна для выбора`);
            }

            // Проверка минимального количества
            if (group.minSelections && selectedInGroup.length < group.minSelections) {
                errors.push(`Минимум ${group.minSelections} выборов в группе "${group.name}"`);
            }

            // Проверка максимального количества
            if (group.maxSelections && selectedInGroup.length > group.maxSelections) {
                errors.push(`Максимум ${group.maxSelections} выборов в группе "${group.name}"`);
            }

            // Проверка типа группы
            if (group.type === 'single' && selectedInGroup.length > 1) {
                errors.push(`В группе "${group.name}" можно выбрать только один вариант`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    // Расчет цены с модификаторами
    calculatePriceWithModifiers(basePrice, selectedModifiers) {
        let totalPrice = basePrice;
        let modifierDetails = [];

        for (const selectedModifier of selectedModifiers) {
            const modifier = this.modifiers.get(selectedModifier.modifierId);
            if (modifier) {
                totalPrice += modifier.price;
                modifierDetails.push({
                    name: modifier.name,
                    price: modifier.price,
                    quantity: selectedModifier.quantity || 1
                });
            }
        }

        return {
            basePrice: basePrice,
            modifierPrice: totalPrice - basePrice,
            totalPrice: totalPrice,
            modifierDetails: modifierDetails
        };
    }

    // Получение всех модификаторов
    getAllModifiers() {
        return Array.from(this.modifiers.values());
    }

    // Получение всех групп модификаторов
    getAllModifierGroups() {
        return Array.from(this.modifierGroups.values());
    }

    // Получение всех правил модификаторов
    getAllModifierRules() {
        return Array.from(this.modifierRules.values());
    }

    // Поиск модификаторов
    searchModifiers(query) {
        const results = [];
        const searchTerm = query.toLowerCase();

        for (const [modifierId, modifier] of this.modifiers) {
            if (modifier.name.toLowerCase().includes(searchTerm) ||
                modifier.description.toLowerCase().includes(searchTerm)) {
                results.push(modifier);
            }
        }

        return results;
    }

    // Получение модификаторов по группе
    getModifiersByGroup(groupId) {
        const results = [];
        
        for (const [modifierId, modifier] of this.modifiers) {
            if (modifier.groupId === groupId) {
                results.push(modifier);
            }
        }

        return results.sort((a, b) => a.sortOrder - b.sortOrder);
    }

    // Получение группы модификатора
    getModifierGroup(modifierId) {
        const modifier = this.modifiers.get(modifierId);
        if (modifier) {
            return this.modifierGroups.get(modifier.groupId);
        }
        return null;
    }

    // Генерация ID модификатора
    generateModifierId() {
        return `mod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Генерация ID группы
    generateGroupId() {
        return `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Генерация ID правила
    generateRuleId() {
        return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Экспорт модификаторов
    exportModifiers() {
        return {
            modifiers: Array.from(this.modifiers.values()),
            modifierGroups: Array.from(this.modifierGroups.values()),
            modifierRules: Array.from(this.modifierRules.values()),
            exportedAt: new Date().toISOString()
        };
    }

    // Импорт модификаторов
    importModifiers(data) {
        try {
            if (data.modifiers) {
                data.modifiers.forEach(modifier => {
                    this.modifiers.set(modifier.id, modifier);
                });
            }

            if (data.modifierGroups) {
                data.modifierGroups.forEach(group => {
                    this.modifierGroups.set(group.id, group);
                });
            }

            if (data.modifierRules) {
                data.modifierRules.forEach(rule => {
                    this.modifierRules.set(rule.id, rule);
                });
            }

            this.saveModifiers();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Получение статистики модификаторов
    getModifierStats() {
        const stats = {
            totalModifiers: this.modifiers.size,
            totalGroups: this.modifierGroups.size,
            totalRules: this.modifierRules.size,
            modifiersByGroup: {},
            averagePrice: 0
        };

        let totalPrice = 0;
        for (const [modifierId, modifier] of this.modifiers) {
            totalPrice += modifier.price;
            
            if (!stats.modifiersByGroup[modifier.groupId]) {
                stats.modifiersByGroup[modifier.groupId] = 0;
            }
            stats.modifiersByGroup[modifier.groupId]++;
        }

        stats.averagePrice = this.modifiers.size > 0 ? totalPrice / this.modifiers.size : 0;

        return stats;
    }
}

// Экспорт модуля
window.EnhancedModifiersModule = EnhancedModifiersModule;
