/**
 * Модуль составных товаров (комбо, наборы, комплекты)
 * Поддержка создания товаров из нескольких компонентов с автоматическим расчетом цены
 */

class CompositeProductsModule {
    constructor() {
        this.compositeProducts = new Map();
        this.compositeTemplates = new Map();
        this.compositeRules = new Map();
        this.init();
    }

    init() {
        this.loadCompositeProducts();
        this.setupDefaultComposites();
    }

    // Загрузка составных товаров
    loadCompositeProducts() {
        try {
            const savedData = localStorage.getItem('compositeProducts');
            if (savedData) {
                const data = JSON.parse(savedData);
                this.compositeProducts = new Map(data.compositeProducts || []);
                this.compositeTemplates = new Map(data.compositeTemplates || []);
                this.compositeRules = new Map(data.compositeRules || []);
            }
        } catch (error) {
            console.error('Ошибка загрузки составных товаров:', error);
        }
    }

    // Сохранение составных товаров
    saveCompositeProducts() {
        try {
            const data = {
                compositeProducts: Array.from(this.compositeProducts.entries()),
                compositeTemplates: Array.from(this.compositeTemplates.entries()),
                compositeRules: Array.from(this.compositeRules.entries())
            };
            localStorage.setItem('compositeProducts', JSON.stringify(data));
        } catch (error) {
            console.error('Ошибка сохранения составных товаров:', error);
        }
    }

    // Настройка составных товаров по умолчанию
    setupDefaultComposites() {
        if (this.compositeProducts.size === 0) {
            this.createDefaultComposites();
        }
    }

    // Создание составных товаров по умолчанию
    createDefaultComposites() {
        // Шаблоны составных товаров
        const templates = [
            {
                id: 'pizza_combo',
                name: 'Пицца + Напиток',
                description: 'Пицца любого размера + напиток',
                categoryId: 'combo',
                type: 'fixed', // fixed, flexible, custom
                components: [
                    {
                        type: 'product',
                        categoryId: 'pizza',
                        required: true,
                        quantity: 1,
                        priceModifier: 0 // 0 = полная цена, -0.1 = скидка 10%
                    },
                    {
                        type: 'product',
                        categoryId: 'drinks',
                        required: true,
                        quantity: 1,
                        priceModifier: -0.2 // скидка 20% на напиток
                    }
                ],
                totalDiscount: 0.15, // общая скидка 15%
                imageUrl: '/images/combo-pizza-drink.jpg'
            },
            {
                id: 'sushi_set',
                name: 'Сет суши',
                description: 'Набор из роллов и суши',
                categoryId: 'combo',
                type: 'flexible',
                components: [
                    {
                        type: 'product',
                        categoryId: 'rolls',
                        required: true,
                        quantity: 2,
                        priceModifier: -0.1
                    },
                    {
                        type: 'product',
                        categoryId: 'sushi',
                        required: true,
                        quantity: 1,
                        priceModifier: -0.1
                    },
                    {
                        type: 'product',
                        categoryId: 'sauces',
                        required: false,
                        quantity: 1,
                        priceModifier: 0
                    }
                ],
                totalDiscount: 0.2,
                imageUrl: '/images/combo-sushi-set.jpg'
            },
            {
                id: 'breakfast_combo',
                name: 'Завтрак',
                description: 'Блины + кофе + сок',
                categoryId: 'combo',
                type: 'fixed',
                components: [
                    {
                        type: 'product',
                        categoryId: 'pancakes',
                        required: true,
                        quantity: 1,
                        priceModifier: 0
                    },
                    {
                        type: 'product',
                        categoryId: 'coffee',
                        required: true,
                        quantity: 1,
                        priceModifier: -0.3
                    },
                    {
                        type: 'product',
                        categoryId: 'juice',
                        required: true,
                        quantity: 1,
                        priceModifier: -0.3
                    }
                ],
                totalDiscount: 0.25,
                imageUrl: '/images/combo-breakfast.jpg'
            },
            {
                id: 'family_pack',
                name: 'Семейный набор',
                description: 'Большая пицца + 2 напитка + салат',
                categoryId: 'combo',
                type: 'fixed',
                components: [
                    {
                        type: 'product',
                        categoryId: 'pizza',
                        required: true,
                        quantity: 1,
                        priceModifier: 0,
                        sizeRestriction: 'large' // только большая пицца
                    },
                    {
                        type: 'product',
                        categoryId: 'drinks',
                        required: true,
                        quantity: 2,
                        priceModifier: -0.2
                    },
                    {
                        type: 'product',
                        categoryId: 'salads',
                        required: true,
                        quantity: 1,
                        priceModifier: -0.15
                    }
                ],
                totalDiscount: 0.2,
                imageUrl: '/images/combo-family.jpg'
            }
        ];

        // Составные товары
        const compositeProducts = [
            {
                id: 'combo_001',
                name: 'Пицца Маргарита + Кола',
                description: 'Пицца Маргарита средняя + Кола 0.5л',
                templateId: 'pizza_combo',
                categoryId: 'combo',
                price: 0, // будет рассчитана автоматически
                components: [
                    {
                        productId: 'pizza_margherita',
                        productName: 'Пицца Маргарита',
                        quantity: 1,
                        size: 'medium',
                        price: 450
                    },
                    {
                        productId: 'drink_cola',
                        productName: 'Кола',
                        quantity: 1,
                        size: 'medium',
                        price: 120
                    }
                ],
                totalDiscount: 0.15,
                finalPrice: 0, // будет рассчитана автоматически
                imageUrl: '/images/combo-margherita-cola.jpg',
                isAvailable: true,
                sortOrder: 1
            },
            {
                id: 'combo_002',
                name: 'Сет Филадельфия',
                description: 'Ролл Филадельфия + Ролл Калифорния + Соус',
                templateId: 'sushi_set',
                categoryId: 'combo',
                price: 0,
                components: [
                    {
                        productId: 'roll_philadelphia',
                        productName: 'Ролл Филадельфия',
                        quantity: 1,
                        price: 380
                    },
                    {
                        productId: 'roll_california',
                        productName: 'Ролл Калифорния',
                        quantity: 1,
                        price: 320
                    },
                    {
                        productId: 'sauce_soy',
                        productName: 'Соевый соус',
                        quantity: 1,
                        price: 50
                    }
                ],
                totalDiscount: 0.2,
                finalPrice: 0,
                imageUrl: '/images/combo-philadelphia-set.jpg',
                isAvailable: true,
                sortOrder: 2
            },
            {
                id: 'combo_003',
                name: 'Завтрак с блинами',
                description: 'Блины с вареньем + Капучино + Апельсиновый сок',
                templateId: 'breakfast_combo',
                categoryId: 'combo',
                price: 0,
                components: [
                    {
                        productId: 'pancakes_jam',
                        productName: 'Блины с вареньем',
                        quantity: 1,
                        price: 280
                    },
                    {
                        productId: 'coffee_cappuccino',
                        productName: 'Капучино',
                        quantity: 1,
                        price: 150
                    },
                    {
                        productId: 'juice_orange',
                        productName: 'Апельсиновый сок',
                        quantity: 1,
                        price: 120
                    }
                ],
                totalDiscount: 0.25,
                finalPrice: 0,
                imageUrl: '/images/combo-breakfast-pancakes.jpg',
                isAvailable: true,
                sortOrder: 3
            }
        ];

        // Правила составных товаров
        const rules = [
            {
                id: 'combo_minimum_price',
                name: 'Минимальная цена комбо',
                description: 'Минимальная цена составного товара',
                condition: 'totalPrice < 300',
                action: 'setMinimumPrice',
                value: 300,
                message: 'Минимальная цена комбо: 300₽'
            },
            {
                id: 'combo_maximum_discount',
                name: 'Максимальная скидка',
                description: 'Максимальная скидка на составной товар',
                condition: 'discount > 0.5',
                action: 'limitDiscount',
                value: 0.5,
                message: 'Максимальная скидка: 50%'
            },
            {
                id: 'combo_size_restriction',
                name: 'Ограничение размера',
                description: 'Ограничения по размеру компонентов',
                condition: 'component.size === "small"',
                action: 'restrictSize',
                value: 'medium',
                message: 'Минимальный размер: средний'
            }
        ];

        // Сохранение шаблонов
        templates.forEach(template => {
            this.compositeTemplates.set(template.id, template);
        });

        // Сохранение составных товаров
        compositeProducts.forEach(product => {
            // Расчет финальной цены
            product.finalPrice = this.calculateCompositePrice(product);
            this.compositeProducts.set(product.id, product);
        });

        // Сохранение правил
        rules.forEach(rule => {
            this.compositeRules.set(rule.id, rule);
        });

        this.saveCompositeProducts();
    }

    // Создание составного товара
    createCompositeProduct(productData) {
        const compositeProduct = {
            id: productData.id || this.generateCompositeId(),
            name: productData.name,
            description: productData.description || '',
            templateId: productData.templateId || null,
            categoryId: productData.categoryId || 'combo',
            price: productData.price || 0,
            components: productData.components || [],
            totalDiscount: productData.totalDiscount || 0,
            finalPrice: 0, // будет рассчитана автоматически
            imageUrl: productData.imageUrl || '',
            isAvailable: productData.isAvailable !== false,
            sortOrder: productData.sortOrder || 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Расчет финальной цены
        compositeProduct.finalPrice = this.calculateCompositePrice(compositeProduct);

        this.compositeProducts.set(compositeProduct.id, compositeProduct);
        this.saveCompositeProducts();
        return compositeProduct;
    }

    // Создание шаблона составного товара
    createCompositeTemplate(templateData) {
        const template = {
            id: templateData.id || this.generateTemplateId(),
            name: templateData.name,
            description: templateData.description || '',
            categoryId: templateData.categoryId || 'combo',
            type: templateData.type || 'flexible', // fixed, flexible, custom
            components: templateData.components || [],
            totalDiscount: templateData.totalDiscount || 0,
            imageUrl: templateData.imageUrl || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.compositeTemplates.set(template.id, template);
        this.saveCompositeProducts();
        return template;
    }

    // Расчет цены составного товара
    calculateCompositePrice(compositeProduct) {
        let totalPrice = 0;
        let totalDiscountAmount = 0;

        // Расчет базовой цены компонентов
        for (const component of compositeProduct.components) {
            let componentPrice = component.price || 0;
            
            // Применение модификатора цены компонента
            if (component.priceModifier) {
                componentPrice = componentPrice * (1 + component.priceModifier);
            }

            totalPrice += componentPrice * (component.quantity || 1);
        }

        // Применение общей скидки
        if (compositeProduct.totalDiscount > 0) {
            totalDiscountAmount = totalPrice * compositeProduct.totalDiscount;
            totalPrice -= totalDiscountAmount;
        }

        // Применение правил
        totalPrice = this.applyCompositeRules(compositeProduct, totalPrice);

        return Math.round(totalPrice);
    }

    // Применение правил составных товаров
    applyCompositeRules(compositeProduct, price) {
        let finalPrice = price;

        for (const [ruleId, rule] of this.compositeRules) {
            switch (rule.action) {
                case 'setMinimumPrice':
                    if (finalPrice < rule.value) {
                        finalPrice = rule.value;
                    }
                    break;
                case 'limitDiscount':
                    // Логика ограничения скидки
                    break;
                case 'restrictSize':
                    // Логика ограничения размера
                    break;
            }
        }

        return finalPrice;
    }

    // Создание составного товара из шаблона
    createFromTemplate(templateId, customizations = {}) {
        const template = this.compositeTemplates.get(templateId);
        if (!template) {
            throw new Error('Шаблон не найден');
        }

        const compositeProduct = {
            id: this.generateCompositeId(),
            name: customizations.name || template.name,
            description: customizations.description || template.description,
            templateId: templateId,
            categoryId: template.categoryId,
            price: 0,
            components: [],
            totalDiscount: template.totalDiscount,
            finalPrice: 0,
            imageUrl: customizations.imageUrl || template.imageUrl,
            isAvailable: true,
            sortOrder: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // Копирование компонентов из шаблона
        for (const templateComponent of template.components) {
            const component = {
                ...templateComponent,
                productId: customizations[`component_${templateComponent.type}_id`] || null,
                productName: customizations[`component_${templateComponent.type}_name`] || '',
                price: customizations[`component_${templateComponent.type}_price`] || 0
            };
            compositeProduct.components.push(component);
        }

        // Расчет финальной цены
        compositeProduct.finalPrice = this.calculateCompositePrice(compositeProduct);

        this.compositeProducts.set(compositeProduct.id, compositeProduct);
        this.saveCompositeProducts();
        return compositeProduct;
    }

    // Обновление составного товара
    updateCompositeProduct(productId, updateData) {
        const product = this.compositeProducts.get(productId);
        if (product) {
            const updatedProduct = {
                ...product,
                ...updateData,
                updatedAt: new Date().toISOString()
            };

            // Пересчет цены при изменении компонентов
            if (updateData.components || updateData.totalDiscount !== undefined) {
                updatedProduct.finalPrice = this.calculateCompositePrice(updatedProduct);
            }

            this.compositeProducts.set(productId, updatedProduct);
            this.saveCompositeProducts();
            return updatedProduct;
        }
        return null;
    }

    // Обновление шаблона
    updateCompositeTemplate(templateId, updateData) {
        const template = this.compositeTemplates.get(templateId);
        if (template) {
            const updatedTemplate = {
                ...template,
                ...updateData,
                updatedAt: new Date().toISOString()
            };
            this.compositeTemplates.set(templateId, updatedTemplate);
            this.saveCompositeProducts();
            return updatedTemplate;
        }
        return null;
    }

    // Удаление составного товара
    deleteCompositeProduct(productId) {
        const deleted = this.compositeProducts.delete(productId);
        if (deleted) {
            this.saveCompositeProducts();
        }
        return deleted;
    }

    // Удаление шаблона
    deleteCompositeTemplate(templateId) {
        // Удаление всех товаров, созданных из этого шаблона
        for (const [productId, product] of this.compositeProducts) {
            if (product.templateId === templateId) {
                this.compositeProducts.delete(productId);
            }
        }

        const deleted = this.compositeTemplates.delete(templateId);
        if (deleted) {
            this.saveCompositeProducts();
        }
        return deleted;
    }

    // Получение всех составных товаров
    getAllCompositeProducts() {
        return Array.from(this.compositeProducts.values());
    }

    // Получение всех шаблонов
    getAllCompositeTemplates() {
        return Array.from(this.compositeTemplates.values());
    }

    // Получение составных товаров по категории
    getCompositeProductsByCategory(categoryId) {
        const products = [];
        for (const [productId, product] of this.compositeProducts) {
            if (product.categoryId === categoryId && product.isAvailable) {
                products.push(product);
            }
        }
        return products.sort((a, b) => a.sortOrder - b.sortOrder);
    }

    // Получение составного товара по ID
    getCompositeProduct(productId) {
        return this.compositeProducts.get(productId);
    }

    // Получение шаблона по ID
    getCompositeTemplate(templateId) {
        return this.compositeTemplates.get(templateId);
    }

    // Поиск составных товаров
    searchCompositeProducts(query) {
        const results = [];
        const searchTerm = query.toLowerCase();

        for (const [productId, product] of this.compositeProducts) {
            if (product.name.toLowerCase().includes(searchTerm) ||
                product.description.toLowerCase().includes(searchTerm)) {
                results.push(product);
            }
        }

        return results;
    }

    // Валидация составного товара
    validateCompositeProduct(product) {
        const errors = [];

        if (!product.name || product.name.trim() === '') {
            errors.push('Название товара обязательно');
        }

        if (!product.components || product.components.length === 0) {
            errors.push('Товар должен содержать хотя бы один компонент');
        }

        for (const component of product.components) {
            if (!component.productId) {
                errors.push('Каждый компонент должен иметь ID товара');
            }
            if (!component.productName) {
                errors.push('Каждый компонент должен иметь название');
            }
            if (!component.price || component.price < 0) {
                errors.push('Цена компонента должна быть положительной');
            }
        }

        if (product.totalDiscount < 0 || product.totalDiscount > 1) {
            errors.push('Скидка должна быть от 0 до 100%');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    // Получение статистики составных товаров
    getCompositeStats() {
        const stats = {
            totalProducts: this.compositeProducts.size,
            totalTemplates: this.compositeTemplates.size,
            productsByCategory: {},
            averagePrice: 0,
            averageDiscount: 0
        };

        let totalPrice = 0;
        let totalDiscount = 0;

        for (const [productId, product] of this.compositeProducts) {
            totalPrice += product.finalPrice;
            totalDiscount += product.totalDiscount;

            if (!stats.productsByCategory[product.categoryId]) {
                stats.productsByCategory[product.categoryId] = 0;
            }
            stats.productsByCategory[product.categoryId]++;
        }

        stats.averagePrice = this.compositeProducts.size > 0 ? totalPrice / this.compositeProducts.size : 0;
        stats.averageDiscount = this.compositeProducts.size > 0 ? totalDiscount / this.compositeProducts.size : 0;

        return stats;
    }

    // Генерация ID составного товара
    generateCompositeId() {
        return `combo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Генерация ID шаблона
    generateTemplateId() {
        return `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Экспорт составных товаров
    exportCompositeProducts() {
        return {
            compositeProducts: Array.from(this.compositeProducts.values()),
            compositeTemplates: Array.from(this.compositeTemplates.values()),
            compositeRules: Array.from(this.compositeRules.values()),
            exportedAt: new Date().toISOString()
        };
    }

    // Импорт составных товаров
    importCompositeProducts(data) {
        try {
            if (data.compositeProducts) {
                data.compositeProducts.forEach(product => {
                    this.compositeProducts.set(product.id, product);
                });
            }

            if (data.compositeTemplates) {
                data.compositeTemplates.forEach(template => {
                    this.compositeTemplates.set(template.id, template);
                });
            }

            if (data.compositeRules) {
                data.compositeRules.forEach(rule => {
                    this.compositeRules.set(rule.id, rule);
                });
            }

            this.saveCompositeProducts();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

// Экспорт модуля
window.CompositeProductsModule = CompositeProductsModule;
