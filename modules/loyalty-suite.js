(function () {
    'use strict';

    const container = document.getElementById('loyaltySuiteContainer');
    if (!container) {
        return;
    }

    const FALLBACK_IMG = 'data:image/svg+xml;charset=utf-8,' +
        encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160">' +
            '<rect width="100%" height="100%" fill="#0b6b64"/>' +
            '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="Arial" font-size="18">Нет фото</text>' +
        '</svg>');

    const tabs = [
        { id: 'overview', label: 'Обзор' },
        { id: 'campaigns', label: 'Кампании' },
        { id: 'rules', label: 'Правила начисления' },
        { id: 'groups', label: 'Группы товаров' },
        { id: 'display', label: 'Отображение' },
        { id: 'card', label: 'Карточка товара' },
        { id: 'cart', label: 'Тест‑корзина' },
        { id: 'anchors', label: 'Якоря' },
        { id: 'stack', label: 'Тех. стэк' }
    ];

    const initialCatalog = [
        { id: 'p1', name: 'Пицца Маргарита', category: 'pizza', price: 500, img: FALLBACK_IMG },
        { id: 'p2', name: 'Пицца Пепперони', category: 'pizza', price: 620, img: FALLBACK_IMG },
        { id: 'c1', name: 'Комбо «Ролл-дей»', category: 'combo', price: 1149, img: FALLBACK_IMG },
        { id: 'd1', name: 'Газировка', category: 'drink', price: 150, img: FALLBACK_IMG },
        { id: 'r1', name: 'Ролл с крабом', category: 'roll', price: 350, img: FALLBACK_IMG }
    ];

    const initialOptionGroups = [
        {
            id: 'grp_dough',
            name: 'Тип теста',
            type: 'single',
            isRequired: true,
            description: 'Выберите основу для пиццы',
            choices: [
                { id: 'thin', name: 'Тонкое тесто', price: 0, isDefault: true, isRequired: true },
                { id: 'traditional', name: 'Традиционное', price: 30, isDefault: false, isRequired: true },
                { id: 'cheese-bort', name: 'Сырный борт', price: 120, isDefault: false, isRequired: true }
            ]
        },
        {
            id: 'grp_sauces',
            name: 'Дополнительные соусы',
            type: 'multiple',
            isRequired: false,
            description: 'Можно выбрать несколько соусов',
            choices: [
                { id: 'bbq', name: 'Соус BBQ', price: 35, isDefault: false, isRequired: false },
                { id: 'garlic', name: 'Чесночный соус', price: 30, isDefault: false, isRequired: false },
                { id: 'cheese', name: 'Сырный соус', price: 40, isDefault: false, isRequired: false }
            ]
        },
        {
            id: 'grp_custom',
            name: 'Дополнительные пожелания',
            type: 'custom',
            isRequired: false,
            description: 'Например, «без лука», «нарезать 12 кусочков».',
            placeholder: 'Ваш комментарий к блюду'
        }
    ];

    const state = {
        activeTab: 'overview',
        catalog: initialCatalog.slice(),
        campaigns: [
            {
                id: 'weekday_combo',
                type: 'weekdayCombo',
                name: 'Будни: комбо + напиток за 1 ₽',
                status: 'active',
                priority: 80,
                details: 'Напиток за 1 ₽ при заказе комбо в будние дни с 11:00 до 18:00',
                conditions: ['корзина содержит комбо', 'будни 11:00–18:00'],
                actions: ['снизить напиток до 1 ₽ (1 на комбо)'],
                display: { card: '+ напиток 1 ₽', cart: 'Выберите напиток — будет 1 ₽', tooltip: 'В будни с 11 до 18 напиток по 1 ₽' }
            },
            {
                id: 'pizza7',
                type: 'nthPizza',
                name: '7-я пицца за 1 ₽',
                status: 'active',
                priority: 90,
                n: 7,
                target: 'cheapest',
                price: 1,
                details: 'Каждая 7‑я пицца (дешёвая) по цене 1 ₽',
                conditions: ['≥ 7 пицц в корзине'],
                actions: ['дешёвая пицца → 1 ₽'],
                display: { card: '7-я за 1 ₽', cart: 'Добавьте 7 пицц — одна будет 1 ₽' }
            },
            {
                id: 'loyal_rate',
                type: 'dandikRate',
                name: 'Базовое начисление дэндиков',
                status: 'active',
                priority: 10,
                rate: 10,
                excludeDiscounted: true,
                details: 'Начисление 10% от суммы заказа, кроме подарков',
                display: { card: '+10% дэндиков', cart: 'Дэндики начислим после оплаты' }
            },
            {
                id: 'crab_roll',
                type: 'rollForOrder',
                name: 'Краб-ролл за 1 ₽',
                status: 'active',
                priority: 70,
                minAmount: 2500,
                details: 'При заказе от 2500 ₽ ролл с крабом — за 1 ₽',
                conditions: ['сумма ≥ 2500 ₽'],
                actions: ['добавить ролл за 1 ₽'],
                display: { card: 'Краб-ролл 1 ₽', cart: 'Соберите заказ от 2500 ₽ и добавьте ролл' }
            }
        ],
        loyaltyRules: [
            { id: 'rule_global', scope: 'global', target: 'Все категории', percent: 10, excludePromo: true },
            { id: 'rule_pizza', scope: 'category', target: 'Пицца', percent: 12, excludePromo: false },
            { id: 'rule_combo', scope: 'category', target: 'Комбо', percent: 8, excludePromo: true }
        ],
        productGroups: [
            { id: 'group_pizza', name: 'Пицца', type: 'dynamic', query: 'category=pizza' },
            { id: 'group_combo', name: 'Комбо', type: 'dynamic', query: 'category=combo' },
            { id: 'group_drinks', name: 'Газировка стандарт', type: 'static', query: 'SKU: d1, d2, d3' }
        ],
        displaySettings: {
            cardBadgeTemplate: 'Акция: {{title}}',
            cartBanner: 'Добавьте ещё {{missing}} ₽, чтобы получить подарок',
            tooltipText: 'Скидки и дэндики рассчитываются автоматически',
            showAnchorHints: true
        },
        cardSettings: {
            showImage: true,
            showName: true,
            showPrice: true,
            showCalories: false,
            showWeight: false,
            ingredients: [
                { id: 'ing_sauce', name: 'Соус томатный', removable: true, isMandatory: false, isVisible: true, displayOrder: 1 },
                { id: 'ing_cheese', name: 'Сыр моцарелла', removable: false, isMandatory: true, isVisible: true, displayOrder: 2 },
                { id: 'ing_basil', name: 'Базилик', removable: true, isMandatory: false, isVisible: true, displayOrder: 3 }
            ],
            optionGroups: clone(initialOptionGroups)
        },
        cartItems: initialCartState(),
        selectedProductId: 'p1',
        userConfig: {
            removed: [],
            options: buildDefaultOptionSelections(initialOptionGroups)
        },
        anchors: [],
        settings: {
            coins: { rate: 1, rounding: 'floor', expiryDays: 365 },
            stacking: { mode: 'bestPrice', excludedGroups: [] }
        },
        remoteEvaluation: null,
        remoteLoading: false,
        lastSyncAt: null,
        apiMessage: null
    };

    let persistTimer = null;

    function requestJSON(url, options) {
        return fetch(url, options).then(function (resp) {
            return resp.json().catch(function () { return {}; }).then(function (data) {
                if (!resp.ok) {
                    throw new Error(data && data.error ? data.error : ('HTTP ' + resp.status));
                }
                return data;
            });
        });
    }

    const loyaltyApi = {
        loadConfig: function () {
            return requestJSON('/api/loyalty/config').catch(function (error) {
                // Если конфигурация не найдена, возвращаем значения по умолчанию
                if (error.message && (error.message.includes('404') || error.message.includes('Not found'))) {
                    return {
                        ok: true,
                        enabled: true,
                        pointsPerRub: 1,
                        rubPerPoint: 100,
                        minOrderAmount: 0,
                        welcomeBonus: 0,
                        birthdayBonus: 0
                    };
                }
                throw error;
            });
        },
        saveConfig: function (payload) {
            return requestJSON('/api/loyalty/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        },
        createCampaign: function (payload) {
            return requestJSON('/api/loyalty/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        },
        updateCampaign: function (id, payload) {
            return requestJSON('/api/loyalty/campaigns/' + encodeURIComponent(id), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        },
        deleteCampaign: function (id) {
            return requestJSON('/api/loyalty/campaigns/' + encodeURIComponent(id), { method: 'DELETE' });
        },
        createRule: function (payload) {
            return requestJSON('/api/loyalty/rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        },
        updateRule: function (id, payload) {
            return requestJSON('/api/loyalty/rules/' + encodeURIComponent(id), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        },
        deleteRule: function (id) {
            return requestJSON('/api/loyalty/rules/' + encodeURIComponent(id), { method: 'DELETE' });
        },
        createGroup: function (payload) {
            return requestJSON('/api/loyalty/groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        },
        updateGroup: function (id, payload) {
            return requestJSON('/api/loyalty/groups/' + encodeURIComponent(id), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        },
        deleteGroup: function (id) {
            return requestJSON('/api/loyalty/groups/' + encodeURIComponent(id), { method: 'DELETE' });
        },
        evaluateCart: function (cartItems) {
            return requestJSON('/api/loyalty/evaluate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cart: cartItems })
            });
        }
    };

    function initialCartState() {
        return [
            clone(initialCatalog[0]),
            clone(initialCatalog[1]),
            clone(initialCatalog[0]),
            clone(initialCatalog[1]),
            clone(initialCatalog[0]),
            clone(initialCatalog[1]),
            clone(initialCatalog[2]),
            clone(initialCatalog[3]),
            clone(initialCatalog[4])
        ];
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function buildDefaultOptionSelections(groups) {
        const defaults = {};
        groups.forEach(function (group) {
            if (group.type === 'multiple') {
                defaults[group.id] = (group.choices || []).filter(function (choice) { return choice.isDefault; }).map(function (choice) { return choice.id; });
            } else if (group.type === 'custom') {
                defaults[group.id] = '';
            } else {
                const defaultChoice = (group.choices || []).find(function (choice) { return choice.isDefault; }) || (group.choices ? group.choices[0] : null);
                defaults[group.id] = defaultChoice ? defaultChoice.id : null;
            }
        });
        return defaults;
    }

    function buildConfigSnapshot() {
        return {
            campaigns: state.campaigns,
            loyaltyRules: state.loyaltyRules,
            productGroups: state.productGroups,
            display: {
                cardBadgeTemplate: state.displaySettings.cardBadgeTemplate,
                cartBannerTemplate: state.displaySettings.cartBanner,
                tooltipText: state.displaySettings.tooltipText,
                showAnchorHints: state.displaySettings.showAnchorHints
            },
            anchors: state.anchors || [],
            settings: state.settings || {}
        };
    }

    function persistConfigNow() {
        persistTimer = null;
        loyaltyApi.saveConfig(buildConfigSnapshot()).then(function () {
            state.lastSyncAt = new Date().toISOString();
            state.apiMessage = 'Изменения сохранены в API';
            render();
        }).catch(function (error) {
            console.warn('[LoyaltySuite] Failed to persist config', error);
            state.apiMessage = 'Не удалось сохранить конфигурацию: ' + error.message;
            render();
        });
    }

    function schedulePersist() {
        if (persistTimer) {
            clearTimeout(persistTimer);
        }
        persistTimer = setTimeout(persistConfigNow, 800);
    }

    function applyConfigFromBackend(config) {
        if (!config) { return; }
        if (Array.isArray(config.campaigns)) {
            state.campaigns = config.campaigns;
        }
        if (Array.isArray(config.loyaltyRules)) {
            state.loyaltyRules = config.loyaltyRules;
        }
        if (Array.isArray(config.productGroups)) {
            state.productGroups = config.productGroups;
        }
        if (config.display) {
            state.displaySettings = Object.assign({}, state.displaySettings, {
                cardBadgeTemplate: config.display.cardBadgeTemplate || state.displaySettings.cardBadgeTemplate,
                cartBanner: config.display.cartBannerTemplate || state.displaySettings.cartBanner,
                tooltipText: typeof config.display.tooltipText === 'string' ? config.display.tooltipText : state.displaySettings.tooltipText,
                showAnchorHints: typeof config.display.showAnchorHints === 'boolean' ? config.display.showAnchorHints : state.displaySettings.showAnchorHints
            });
        }
        if (Array.isArray(config.anchors)) {
            state.anchors = config.anchors;
        }
        if (config.settings) {
            state.settings = Object.assign({}, state.settings, config.settings);
        }
        state.lastSyncAt = new Date().toISOString();
        state.apiMessage = 'Конфигурация загружена из API';
        render();
    }

    function hydrateFromBackend() {
        loyaltyApi.loadConfig().then(function (data) {
            if (data && data.config) {
                applyConfigFromBackend(data.config);
            } else if (data && data.ok) {
                // Конфигурация загружена, но структура может отличаться
                // Применяем данные напрямую если они есть
                if (data.enabled !== undefined || data.pointsPerRub !== undefined) {
                    state.settings.enabled = data.enabled !== false;
                    if (data.pointsPerRub !== undefined) state.settings.pointsPerRub = data.pointsPerRub;
                    if (data.rubPerPoint !== undefined) state.settings.rubPerPoint = data.rubPerPoint;
                    state.apiMessage = 'Конфигурация загружена';
                    render();
                }
            }
        }).catch(function (error) {
            // Тихая обработка - конфигурация может быть не настроена
            // Не логируем как ошибку, если это 404
            if (!error.message || (!error.message.includes('404') && !error.message.includes('Not found'))) {
                console.warn('[LoyaltySuite] Failed to load config', error);
            }
            // Используем значения по умолчанию
            state.apiMessage = 'Используется локальная конфигурация';
            render();
        });
    }

    function ensureUserConfigConsistency() {
        const ingredientIds = state.cardSettings.ingredients.map(function (ing) { return ing.id; });
        state.userConfig.removed = state.userConfig.removed.filter(function (id) { return ingredientIds.indexOf(id) !== -1; });

        const groupIds = state.cardSettings.optionGroups.map(function (group) { return group.id; });
        const nextOptions = {};

        groupIds.forEach(function (groupId) {
            const group = state.cardSettings.optionGroups.find(function (item) { return item.id === groupId; });
            if (!group) { return; }
            if (typeof state.userConfig.options[groupId] === 'undefined') {
                nextOptions[groupId] = buildGroupDefault(group);
            } else {
                if (group.type === 'multiple') {
                    const availableIds = (group.choices || []).map(function (choice) { return choice.id; });
                    nextOptions[groupId] = (state.userConfig.options[groupId] || []).filter(function (id) { return availableIds.indexOf(id) !== -1; });
                } else if (group.type === 'custom') {
                    nextOptions[groupId] = state.userConfig.options[groupId] || '';
                } else {
                    const availableIds = (group.choices || []).map(function (choice) { return choice.id; });
                    const stored = state.userConfig.options[groupId];
                    nextOptions[groupId] = availableIds.indexOf(stored) !== -1 ? stored : buildGroupDefault(group);
                }
            }
        });

        state.userConfig.options = nextOptions;
    }

    function buildGroupDefault(group) {
        if (!group) { return null; }
        if (group.type === 'multiple') {
            return (group.choices || []).filter(function (choice) { return choice.isDefault; }).map(function (choice) { return choice.id; });
        }
        if (group.type === 'custom') {
            return '';
        }
        const defaultChoice = (group.choices || []).find(function (choice) { return choice.isDefault; }) || (group.choices ? group.choices[0] : null);
        return defaultChoice ? defaultChoice.id : null;
    }

    function escapeHtml(value) {
        if (typeof value !== 'string') { return value; }
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatCurrency(value) {
        return value.toLocaleString('ru-RU');
    }

    function evaluatePromos(cartItems, campaigns) {
        const updated = cartItems.map(function (item) {
            return Object.assign({}, item, {
                discount: item.discount || 0,
                promoLabels: item.promoLabels ? item.promoLabels.slice() : []
            });
        });
        const applied = [];
        const now = new Date();
        const weekday = now.getDay();
        const hour = now.getHours();

        campaigns.forEach(function (campaign) {
            if (campaign.type === 'weekdayCombo') {
                if (weekday >= 1 && weekday <= 4 && hour >= 11 && hour < 18) {
                    let comboCount = updated.filter(function (item) { return item.category === 'combo'; }).length;
                    if (comboCount > 0) {
                        updated.forEach(function (item) {
                            if (comboCount === 0) { return; }
                            if (item.category === 'drink' && !item.appliedCombo) {
                                item.discount = item.price - 1;
                                item.promoLabels.push('Напиток 1 ₽ (будни)');
                                item.appliedCombo = true;
                                comboCount -= 1;
                                applied.push('Комбо + напиток 1 ₽');
                            }
                        });
                    }
                }
            }

            if (campaign.type === 'nthPizza') {
                const pizzas = updated.filter(function (item) { return item.category === 'pizza'; });
                if (pizzas.length >= (campaign.n || 7)) {
                    let targetIndex = 0;
                    if (campaign.target === 'cheapest') {
                        let min = Infinity;
                        pizzas.forEach(function (pizza, index) {
                            if (index < campaign.n && pizza.price < min) {
                                min = pizza.price;
                                targetIndex = index;
                            }
                        });
                    } else {
                        targetIndex = (campaign.n || 7) - 1;
                    }
                    const target = pizzas[targetIndex];
                    if (target) {
                        const newPrice = campaign.price || 1;
                        const discount = target.price - newPrice;
                        target.discount = discount > 0 ? discount : target.price;
                        target.promoLabels.push(newPrice === 0 ? 'Пицца в подарок' : 'Пицца за 1 ₽');
                        applied.push('7‑я пицца за 1 ₽');
                    }
                }
            }

            if (campaign.type === 'rollForOrder') {
                const subtotal = updated.reduce(function (sum, item) { return sum + item.price; }, 0);
                if (subtotal >= (campaign.minAmount || 2500)) {
                    const roll = updated.find(function (item) { return item.category === 'roll' && !item.appliedPromo; });
                    if (roll) {
                        roll.discount = roll.price - 1;
                        roll.appliedPromo = true;
                        roll.promoLabels.push('Ролл за 1 ₽');
                        applied.push('Ролл за 1 ₽');
                    }
                }
            }
        });

        return { items: updated, appliedPromos: applied };
    }

    function calcDandiks(items, rate, excludeDiscounted) {
        return items.reduce(function (sum, item) {
            const discount = item.discount || 0;
            if (excludeDiscounted && discount >= item.price) { return sum; }
            const effective = item.price - discount;
            return sum + Math.round((effective * rate) / 100);
        }, 0);
    }

    function getSelectedProduct() {
        return state.catalog.find(function (product) { return product.id === state.selectedProductId; }) || state.catalog[0];
    }

    function getSelectionForGroup(group) {
        if (!group) { return null; }
        const value = state.userConfig.options[group.id];
        if (typeof value === 'undefined') {
            return buildGroupDefault(group);
        }
        return group.type === 'multiple' ? value.slice() : value;
    }

    function findChoice(group, choiceId) {
        if (!group) { return null; }
        return (group.choices || []).find(function (choice) { return choice.id === choiceId; }) || null;
    }

    function computeOptionExtraTotal() {
        return state.cardSettings.optionGroups.reduce(function (sum, group) {
            const selection = getSelectionForGroup(group);
            if (group.type === 'multiple') {
                const choiceIds = selection || [];
                choiceIds.forEach(function (id) {
                    const choice = findChoice(group, id);
                    if (choice) { sum += choice.price || 0; }
                });
            } else if (group.type === 'custom') {
                sum += 0;
            } else {
                const choice = findChoice(group, selection);
                if (choice) { sum += choice.price || 0; }
            }
            return sum;
        }, 0);
    }

    function getConfiguredName() {
        const product = getSelectedProduct();
        const removed = state.cardSettings.ingredients
            .filter(function (ing) { return state.userConfig.removed.indexOf(ing.id) !== -1; })
            .map(function (ing) { return ing.name; });

        const optionFragments = [];
        const customNotes = [];

        state.cardSettings.optionGroups.forEach(function (group) {
            const selection = getSelectionForGroup(group);
            if (group.type === 'multiple') {
                (selection || []).forEach(function (id) {
                    const choice = findChoice(group, id);
                    if (choice) {
                        optionFragments.push(choice.name + (choice.price ? ' +' + choice.price + '₽' : ''));
                    }
                });
            } else if (group.type === 'custom') {
                if (selection && selection.trim()) {
                    customNotes.push(selection.trim());
                }
            } else {
                const choice = findChoice(group, selection);
                if (choice) {
                    optionFragments.push(choice.name + (choice.price ? ' +' + choice.price + '₽' : ''));
                }
            }
        });

        let suffix = '';
        if (optionFragments.length) {
            suffix += ' + ' + optionFragments.join(', ');
        }
        if (removed.length) {
            suffix += ' — без: ' + removed.join(', ');
        }
        if (customNotes.length) {
            suffix += ' / ' + customNotes.join(' • ');
        }
        return (product ? product.name : 'Товар') + (suffix ? ' (' + suffix + ')' : '');
    }

    function computeCartTotals() {
        const evaluated = evaluatePromos(state.cartItems.map(function (item) { return clone(item); }), state.campaigns);
        const total = evaluated.items.reduce(function (sum, item) { return sum + item.price - (item.discount || 0); }, 0);
        const dandikCampaign = state.campaigns.find(function (campaign) { return campaign.type === 'dandikRate'; });
        const dandiks = dandikCampaign ? calcDandiks(evaluated.items, dandikCampaign.rate, dandikCampaign.excludeDiscounted) : 0;
        return {
            evaluated: evaluated.items,
            appliedPromos: evaluated.appliedPromos,
            total: total,
            dandiks: dandiks
        };
    }

    function evaluateCartRemote() {
        if (state.remoteLoading) { return; }
        state.remoteLoading = true;
        state.apiMessage = 'Отправляем корзину в API...';
        render();
        const payloadCart = state.cartItems.map(function (item) {
            return {
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity || 1,
                category: item.category,
                tags: item.tags || item.category || ''
            };
        });
        loyaltyApi.evaluateCart(payloadCart).then(function (response) {
            state.remoteEvaluation = response;
            state.remoteLoading = false;
            state.apiMessage = 'Получены результаты расчёта из API';
            render();
        }).catch(function (error) {
            console.warn('[LoyaltySuite] evaluateCart failed', error);
            state.remoteLoading = false;
            state.apiMessage = 'Ошибка расчёта корзины: ' + error.message;
            render();
        });
    }

    function clearRemoteEvaluation() {
        state.remoteEvaluation = null;
        state.apiMessage = 'Результаты расчёта очищены';
        render();
    }

    function computeOverviewMetrics() {
        const totals = computeCartTotals();
        const pizzasInCart = state.cartItems.filter(function (item) { return item.category === 'pizza'; }).length;
        const combosInCart = state.cartItems.filter(function (item) { return item.category === 'combo'; }).length;
        const drinksInCart = state.cartItems.filter(function (item) { return item.category === 'drink'; }).length;
        const pizzasUntilPromo = pizzasInCart >= 7 ? 0 : 7 - pizzasInCart;

        return [
            { title: 'Активных кампаний', value: state.campaigns.length },
            { title: 'Промо в корзине', value: totals.appliedPromos.length },
            { title: 'Выручка корзины, ₽', value: formatCurrency(totals.total) },
            { title: 'Дэндики за заказ', value: totals.dandiks },
            { title: 'Пицц до акции', value: pizzasUntilPromo === 0 ? 'готово' : pizzasUntilPromo },
            { title: 'Комбо в корзине', value: combosInCart + ' / напитков ' + drinksInCart }
        ];
    }

    function render() {
        ensureUserConfigConsistency();
        container.innerHTML = buildTemplate();
    }

    function buildTemplate() {
        return (
            '<div class="loyalty-suite">' +
                '<aside class="loyalty-sidebar">' +
                    '<h2>Навигация</h2>' +
                    tabs.map(function (tab) {
                        return '<div class="loyalty-nav-item' + (state.activeTab === tab.id ? ' active' : '') + '" data-tab="' + tab.id + '">' + escapeHtml(tab.label) + '</div>';
                    }).join('') +
                '</aside>' +
                '<section class="loyalty-main">' +
                    renderStatusBar() +
                    renderTabContent() +
                '</section>' +
            '</div>'
        );
    }

    function renderTabContent() {
        switch (state.activeTab) {
            case 'overview': return renderOverviewTab();
            case 'campaigns': return renderCampaignsTab();
            case 'rules': return renderRulesTab();
            case 'groups': return renderGroupsTab();
            case 'display': return renderDisplayTab();
            case 'card': return renderCardTab();
            case 'cart': return renderCartTab();
            case 'anchors': return renderAnchorsTab();
            case 'stack': return renderStackTab();
            default: return '';
        }
    }

    function renderStatusBar() {
        var messages = [];
        if (state.apiMessage) {
            messages.push('<span>' + escapeHtml(state.apiMessage) + '</span>');
        }
        if (state.lastSyncAt) {
            messages.push('<span class="loyalty-muted">Синхронизировано: ' + escapeHtml(new Date(state.lastSyncAt).toLocaleString()) + '</span>');
        }
        if (!messages.length) {
            return '';
        }
        return '<div style="margin-bottom:12px;background:rgba(10,107,102,0.08);padding:10px 14px;border-radius:12px;">' + messages.join('<br>') + '</div>';
    }

    function renderOverviewTab() {
        const metrics = computeOverviewMetrics();
        const totals = computeCartTotals();
        const pizzasInCart = state.cartItems.filter(function (item) { return item.category === 'pizza'; }).length;
        const combosInCart = state.cartItems.filter(function (item) { return item.category === 'combo'; }).length;
        const drinksInCart = state.cartItems.filter(function (item) { return item.category === 'drink'; }).length;
        const pizzasProgress = Math.min(100, (pizzasInCart / 7) * 100);
        const drinksProgress = combosInCart ? Math.min(100, (drinksInCart / combosInCart) * 100) : 0;
        const pizzasUntilPromo = pizzasInCart >= 7 ? 0 : 7 - pizzasInCart;

        return (
            '<div class="loyalty-suite-container">' +
                '<div class="loyalty-metrics-grid">' +
                    metrics.map(function (metric) {
                        return (
                            '<div class="loyalty-metric-card">' +
                                '<h4>' + escapeHtml(metric.title) + '</h4>' +
                                '<p>' + escapeHtml(String(metric.value)) + '</p>' +
                            '</div>'
                        );
                    }).join('') +
                '</div>' +
                '<div class="loyalty-panel">' +
                    '<h3>Прогресс по ключевым акциям</h3>' +
                    '<div class="loyalty-grid">' +
                        '<div>' +
                            '<strong>7‑я пицца за 1 ₽</strong>' +
                            '<div class="loyalty-progress"><span style="width:' + pizzasProgress + '%"></span></div>' +
                            '<div class="loyalty-muted">В корзине ' + pizzasInCart + ' пицц — ' + (pizzasUntilPromo === 0 ? 'акция будет применена автоматически' : 'осталось ' + pizzasUntilPromo) + '</div>' +
                        '</div>' +
                        '<div>' +
                            '<strong>Комбо + напиток 1 ₽</strong>' +
                            '<div class="loyalty-progress"><span style="width:' + drinksProgress + '%"></span></div>' +
                            '<div class="loyalty-muted">Комбо: ' + combosInCart + ', напитков: ' + drinksInCart + '. ' + (combosInCart > drinksInCart ? 'Добавьте напиток, чтобы применить акцию.' : 'Требования выполнены.') + '</div>' +
                        '</div>' +
                        '<div>' +
                            '<strong>Активные бейджи</strong>' +
                            '<div>' +
                                state.campaigns.map(function (campaign) {
                                    return '<span class="loyalty-chip">' + escapeHtml(campaign.display && campaign.display.card ? campaign.display.card : campaign.name) + '</span>';
                                }).join('') +
                            '</div>' +
                        '</div>' +
                        '<div>' +
                            '<strong>Начисление дэндиков</strong>' +
                            '<div class="loyalty-muted">Текущий заказ: ' + totals.dandiks + ' баллов · после применения всех промо.</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="loyalty-panel">' +
                    '<h3>Активные кампании</h3>' +
                    state.campaigns.map(function (campaign) {
                        return (
                            '<div style="margin-bottom:16px;border-bottom:1px solid rgba(10,107,102,0.12);padding-bottom:16px;">' +
                                '<div class="loyalty-inline-actions" style="justify-content:space-between;">' +
                                    '<div>' +
                                        '<strong>' + escapeHtml(campaign.name) + '</strong>' +
                                        '<div class="loyalty-muted">Тип: ' + escapeHtml(campaign.type) + ' · Приоритет: ' + escapeHtml(String(campaign.priority || 0)) + '</div>' +
                                    '</div>' +
                                    '<span class="loyalty-badge">' + escapeHtml(campaign.status || 'active') + '</span>' +
                                '</div>' +
                                (campaign.display && campaign.display.card ? '<div class="loyalty-muted">Бейдж карточки: ' + escapeHtml(campaign.display.card) + '</div>' : '') +
                                (campaign.conditions && campaign.conditions.length ? '<div class="loyalty-muted">Условия: ' + escapeHtml(campaign.conditions.join(', ')) + '</div>' : '') +
                                (campaign.actions && campaign.actions.length ? '<div class="loyalty-muted">Действия: ' + escapeHtml(campaign.actions.join(', ')) + '</div>' : '') +
                            '</div>'
                        );
                    }).join('') +
                '</div>' +
            '</div>'
        );
    }

    function renderCampaignsTab() {
        return (
            '<div class="loyalty-suite-container">' +
                '<div class="loyalty-panel">' +
                    '<h3>Активные кампании</h3>' +
                    state.campaigns.map(function (campaign) {
                        return (
                            '<div style="margin-bottom:12px;border-bottom:1px solid rgba(10,107,102,0.12);padding-bottom:12px;">' +
                                '<div class="loyalty-inline-actions" style="justify-content:space-between;">' +
                                    '<div>' +
                                        '<strong>' + escapeHtml(campaign.name) + '</strong>' +
                                        '<div class="loyalty-muted">Тип: ' + escapeHtml(campaign.type) + ' · Приоритет: ' + escapeHtml(String(campaign.priority || 0)) + '</div>' +
                                    '</div>' +
                                    '<div class="loyalty-inline-actions">' +
                                        '<button class="loyalty-button secondary" data-action="preview-campaign" data-id="' + campaign.id + '">Предпросмотр</button>' +
                                        '<button class="loyalty-button danger" data-action="remove-campaign" data-id="' + campaign.id + '">Удалить</button>' +
                                    '</div>' +
                                '</div>' +
                                (campaign.details ? '<p>' + escapeHtml(campaign.details) + '</p>' : '') +
                                (campaign.display && campaign.display.card ? '<p class="loyalty-muted">Бейдж (карточка): ' + escapeHtml(campaign.display.card) + '</p>' : '') +
                                (campaign.display && campaign.display.cart ? '<p class="loyalty-muted">Бейдж (корзина): ' + escapeHtml(campaign.display.cart) + '</p>' : '') +
                                '<div class="loyalty-muted">Якорь: ' + escapeHtml(getBaseUrl() + '/#promo=' + campaign.id) + '</div>' +
                            '</div>'
                        );
                    }).join('') +
                '</div>' +
                '<div class="loyalty-panel">' +
                    '<h3>Добавить кампанию</h3>' +
                    '<div class="loyalty-grid">' +
                        '<label>Тип кампании</label>' +
                        '<select data-action="set-new-campaign-field" data-field="type">' +
                            ['weekdayCombo', 'nthPizza', 'dandikRate', 'rollForOrder'].map(function (type) {
                                return '<option value="' + type + '"' + (state._newCampaign && state._newCampaign.type === type ? ' selected' : (!state._newCampaign && type === 'weekdayCombo' ? ' selected' : '')) + '>' + escapeHtml(type) + '</option>';
                            }).join('') +
                        '</select>' +
                        '<label>Название</label>' +
                        '<input type="text" value="' + escapeHtml((state._newCampaign && state._newCampaign.name) || '') + '" data-action="set-new-campaign-field" data-field="name" />' +
                        '<label>Описание</label>' +
                        '<textarea data-action="set-new-campaign-field" data-field="details">' + escapeHtml((state._newCampaign && state._newCampaign.details) || '') + '</textarea>' +
                        '<label>Приоритет</label>' +
                        '<input type="number" value="' + escapeHtml(String((state._newCampaign && state._newCampaign.priority) || 50)) + '" data-action="set-new-campaign-field" data-field="priority" />' +
                        '<label>Бейдж (карточка)</label>' +
                        '<input type="text" value="' + escapeHtml((state._newCampaign && state._newCampaign.badgeCard) || '') + '" data-action="set-new-campaign-field" data-field="badgeCard" />' +
                        '<label>Бейдж (корзина)</label>' +
                        '<input type="text" value="' + escapeHtml((state._newCampaign && state._newCampaign.badgeCart) || '') + '" data-action="set-new-campaign-field" data-field="badgeCart" />' +
                        '<label>Условия (через запятую)</label>' +
                        '<input type="text" value="' + escapeHtml((state._newCampaign && state._newCampaign.conditionsText) || '') + '" data-action="set-new-campaign-field" data-field="conditionsText" />' +
                        '<label>Действия (через запятую)</label>' +
                        '<input type="text" value="' + escapeHtml((state._newCampaign && state._newCampaign.actionsText) || '') + '" data-action="set-new-campaign-field" data-field="actionsText" />' +
                        '<button class="loyalty-button primary" data-action="add-campaign">Сохранить кампанию</button>' +
                    '</div>' +
                '</div>' +
            '</div>'
        );
    }

    function renderRulesTab() {
        return (
            '<div class="loyalty-suite-container">' +
                '<div class="loyalty-panel">' +
                    '<h3>Правила начисления</h3>' +
                    '<table class="loyalty-table">' +
                        '<thead><tr><th>Область</th><th>Цель</th><th>% дэндиков</th><th>Исключать промо</th><th></th></tr></thead>' +
                        '<tbody>' +
                            state.loyaltyRules.map(function (rule) {
                                return (
                                    '<tr>' +
                                        '<td>' + escapeHtml(rule.scope) + '</td>' +
                                        '<td>' + escapeHtml(rule.target) + '</td>' +
                                        '<td>' + escapeHtml(String(rule.percent)) + '%</td>' +
                                        '<td><label class="inline"><input type="checkbox" data-action="toggle-rule-exclude" data-id="' + rule.id + '"' + (rule.excludePromo ? ' checked' : '') + '> да</label></td>' +
                                        '<td><button class="loyalty-button danger" data-action="remove-rule" data-id="' + rule.id + '">Удалить</button></td>' +
                                    '</tr>'
                                );
                            }).join('') +
                        '</tbody>' +
                    '</table>' +
                    '<button class="loyalty-button secondary" data-action="add-rule">Добавить правило</button>' +
                '</div>' +
                '<div class="loyalty-panel">' +
                    '<h3>Напоминание</h3>' +
                    '<p class="loyalty-muted">Баллы начисляются после применения всех акций. Подарочные позиции (0–1 ₽) и скидки выше порога автоматически исключаются из расчёта.</p>' +
                '</div>' +
            '</div>'
        );
    }

    function renderGroupsTab() {
        return (
            '<div class="loyalty-suite-container">' +
                '<div class="loyalty-panel">' +
                    '<h3>Группы товаров</h3>' +
                    '<table class="loyalty-table">' +
                        '<thead><tr><th>Название</th><th>Тип</th><th>Фильтр / Список SKU</th><th></th></tr></thead>' +
                        '<tbody>' +
                            state.productGroups.map(function (group) {
                                return (
                                    '<tr>' +
                                        '<td>' + escapeHtml(group.name) + '</td>' +
                                        '<td>' + escapeHtml(group.type) + '</td>' +
                                        '<td>' + escapeHtml(group.query) + '</td>' +
                                        '<td><button class="loyalty-button danger" data-action="remove-group" data-id="' + group.id + '">Удалить</button></td>' +
                                    '</tr>'
                                );
                            }).join('') +
                        '</tbody>' +
                    '</table>' +
                    '<button class="loyalty-button secondary" data-action="add-group">Создать группу</button>' +
                '</div>' +
                '<div class="loyalty-panel">' +
                    '<h3>Использование групп</h3>' +
                    '<ul class="loyalty-muted">' +
                        '<li>Кампании оперируют группами в условиях и действиях (например «каждая N‑я позиция группы pizza»).</li>' +
                        '<li>Витрина подсвечивает якоря по группам — ссылки вида <code>/#group=pizza</code>.</li>' +
                        '<li>Группы могут быть статическими (конкретные SKU) и динамическими (по фильтрам).</li>' +
                    '</ul>' +
                '</div>' +
            '</div>'
        );
    }

    function renderDisplayTab() {
        return (
            '<div class="loyalty-suite-container">' +
                '<div class="loyalty-panel">' +
                    '<h3>Отображение акций и бейджей</h3>' +
                    '<label>Шаблон бейджа в карточке</label>' +
                    '<input type="text" value=\"' + escapeHtml(state.displaySettings.cardBadgeTemplate) + '\" data-setting=\"cardBadgeTemplate\" />' +
                    '<label>Баннер корзины</label>' +
                    '<textarea data-setting=\"cartBanner\">' + escapeHtml(state.displaySettings.cartBanner) + '</textarea>' +
                    '<label>Текст подсказки</label>' +
                    '<textarea data-setting=\"tooltipText\">' + escapeHtml(state.displaySettings.tooltipText) + '</textarea>' +
                    '<label class=\"inline\"><input type=\"checkbox\" data-setting=\"showAnchorHints\"' + (state.displaySettings.showAnchorHints ? ' checked' : '') + '> Показывать подсказки по якорям</label>' +
                '</div>' +
                '<div class=\"loyalty-panel\">' +
                    '<h3>Пример отображения</h3>' +
                    '<div class=\"loyalty-panel\" style=\"background:#0a6b66;color:#fff;border:none;box-shadow:none;\">' +
                        '<span class=\"loyalty-badge\">' + escapeHtml(state.displaySettings.cardBadgeTemplate.replace('{{title}}', '7‑я за 1 ₽')) + '</span>' +
                        '<p style=\"margin-top:12px;\">' + escapeHtml(state.displaySettings.tooltipText) + '</p>' +
                        '<div class=\"preview-cart\" style=\"margin-top:16px;background:rgba(255,255,255,0.1);\">' +
                            '<strong>Корзина:</strong>' +
                            '<p>' + escapeHtml(state.displaySettings.cartBanner.replace('{{missing}}', '150')) + '</p>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>'
        );
    }

    function renderCardTab() {
        const product = getSelectedProduct();
        const optionExtraTotal = computeOptionExtraTotal();
        const finalPrice = (product ? product.price : 0) + optionExtraTotal;
        const configuredName = getConfiguredName();

        return (
            '<div class=\"loyalty-suite-container\">' +
                '<div class=\"loyalty-panel\">' +
                    '<h3>Настройки карточки</h3>' +
                    '<label>Выбор товара</label>' +
                    '<select data-action=\"select-product\">' +
                        state.catalog.map(function (item) {
                            return '<option value=\"' + item.id + '\"' + (state.selectedProductId === item.id ? ' selected' : '') + '>' + escapeHtml(item.name) + '</option>';
                        }).join('') +
                    '</select>' +
                '</div>' +
                '<div class=\"loyalty-panel\">' +
                    '<h3>Ингредиенты</h3>' +
                    '<table class=\"loyalty-table\">' +
                        '<thead><tr><th>Название</th><th>Обязательный</th><th>Можно убрать</th><th>Показывать</th><th>Порядок</th><th></th></tr></thead>' +
                        '<tbody>' +
                            state.cardSettings.ingredients.slice().sort(function (a, b) { return (a.displayOrder || 0) - (b.displayOrder || 0); }).map(function (ingredient) {
                                return (
                                    '<tr>' +
                                        '<td>' + escapeHtml(ingredient.name) + '</td>' +
                                        '<td><label class=\"inline\"><input type=\"checkbox\" data-action=\"toggle-ingredient-mandatory\" data-id=\"' + ingredient.id + '\"' + (ingredient.isMandatory ? ' checked' : '') + '> да</label></td>' +
                                        '<td><label class=\"inline\"><input type=\"checkbox\" data-action=\"toggle-ingredient-removable\" data-id=\"' + ingredient.id + '\"' + (ingredient.removable ? ' checked' : '') + (ingredient.isMandatory ? ' disabled' : '') + '> да</label></td>' +
                                        '<td><label class=\"inline\"><input type=\"checkbox\" data-action=\"toggle-ingredient-visible\" data-id=\"' + ingredient.id + '\"' + (ingredient.isVisible ? ' checked' : '') + '> да</label></td>' +
                                        '<td><input type=\"number\" value=\"' + escapeHtml(String(ingredient.displayOrder || 0)) + '\" data-action=\"update-ingredient-order\" data-id=\"' + ingredient.id + '\" style=\"width:60px\"></td>' +
                                        '<td><button class=\"loyalty-button danger\" data-action=\"remove-ingredient\" data-id=\"' + ingredient.id + '\">Удалить</button></td>' +
                                    '</tr>'
                                );
                            }).join('') +
                        '</tbody>' +
                    '</table>' +
                    '<button class=\"loyalty-button secondary\" data-action=\"add-ingredient\">Добавить ингредиент</button>' +
                '</div>' +
                '<div class=\"loyalty-panel\">' +
                    '<h3>Группы допов</h3>' +
                    (state.cardSettings.optionGroups.length ? '' : '<p class=\"loyalty-muted\">Группы допов ещё не добавлены.</p>') +
                    state.cardSettings.optionGroups.map(function (group) {
                        return (
                            '<div class=\"option-group-card\" style=\"margin-bottom:12px;\">' +
                                '<div class=\"loyalty-inline-actions\" style=\"justify-content:space-between;\">' +
                                    '<div>' +
                                        '<strong>' + escapeHtml(group.name) + '</strong>' +
                                        '<div class=\"loyalty-muted\">Тип: ' + escapeHtml(group.type) + '</div>' +
                                    '</div>' +
                                    '<div class=\"loyalty-inline-actions\">' +
                                        '<button class=\"loyalty-button ghost\" data-action=\"set-group-description\" data-id=\"' + group.id + '\">Описание</button>' +
                                        '<button class=\"loyalty-button danger\" data-action=\"remove-group-option\" data-id=\"' + group.id + '\">Удалить группу</button>' +
                                    '</div>' +
                                '</div>' +
                                '<label class=\"inline\"><input type=\"checkbox\" data-action=\"toggle-group-required\" data-id=\"' + group.id + '\"' + (group.isRequired ? ' checked' : '') + '> Обязательная группа</label>' +
                                '<div class=\"loyalty-muted\">' + escapeHtml(group.description || 'Описание для интерфейса не задано.') + '</div>' +
                                (group.type === 'custom'
                                    ? '<div class=\"loyalty-muted\">Пользователь вводит значение вручную (текст).</div>'
                                    : '<table class=\"loyalty-table\">' +
                                        '<thead><tr><th>Опция</th><th>Цена</th><th>По умолчанию</th><th>Обязательная</th><th></th></tr></thead>' +
                                        '<tbody>' +
                                            (group.choices || []).map(function (choice) {
                                                return (
                                                    '<tr>' +
                                                        '<td>' + escapeHtml(choice.name) + '</td>' +
                                                        '<td>' + escapeHtml(String(choice.price || 0)) + '</td>' +
                                                        '<td><label class=\"inline\"><input type=\"checkbox\" data-action=\"toggle-choice-default\" data-group=\"' + group.id + '\" data-choice=\"' + choice.id + '\"' + (choice.isDefault ? ' checked' : '') + '> да</label></td>' +
                                                        '<td><label class=\"inline\"><input type=\"checkbox\" data-action=\"toggle-choice-required\" data-group=\"' + group.id + '\" data-choice=\"' + choice.id + '\"' + (choice.isRequired ? ' checked' : '') + '> да</label></td>' +
                                                        '<td>' +
                                                            '<div class=\"loyalty-inline-actions\">' +
                                                                '<button class=\"loyalty-button ghost\" data-action=\"update-choice-price\" data-group=\"' + group.id + '\" data-choice=\"' + choice.id + '\">Цена</button>' +
                                                                '<button class=\"loyalty-button danger\" data-action=\"remove-choice\" data-group=\"' + group.id + '\" data-choice=\"' + choice.id + '\">Удалить</button>' +
                                                            '</div>' +
                                                        '</td>' +
                                                    '</tr>'
                                                );
                                            }).join('') +
                                        '</tbody>' +
                                    '</table>'
                                ) +
                                (group.type === 'custom' ? '' : '<button class=\"loyalty-button secondary\" data-action=\"add-choice\" data-id=\"' + group.id + '\">Добавить опцию</button>') +
                            '</div>'
                        );
                    }).join('') +
                    '<button class=\"loyalty-button\" data-action=\"add-group-option\">Добавить группу допов</button>' +
                '</div>' +
                '<div class=\"loyalty-panel\">' +
                    '<h3>Предпросмотр карточки</h3>' +
                    '<div class=\"preview-card\" style=\"background:#0a6b66;color:#fff;\">' +
                        (state.cardSettings.showImage && product ? '<img src=\"' + escapeHtml(product.img) + '\" alt=\"' + escapeHtml(product.name) + '\">' : '') +
                        (state.cardSettings.showName ? '<h2 style=\"color:#fff;\">' + escapeHtml(configuredName) + '</h2>' : '') +
                        (state.cardSettings.showPrice ? '<p>Цена: ' + formatCurrency(finalPrice) + ' ₽ <span class=\"loyalty-muted\">(база ' + formatCurrency(product ? product.price : 0) + ' ₽ + допы ' + formatCurrency(optionExtraTotal) + ' ₽)</span></p>' : '') +
                        '<div class=\"panel-section\" style=\"background:rgba(255,255,255,0.1);\">' +
                            '<h3 style=\"margin:0 0 8px;\">Убрать ингредиенты</h3>' +
                            (state.cardSettings.ingredients.filter(function (ing) { return ing.removable && ing.isVisible; }).length === 0
                                ? '<p class=\"loyalty-muted\">Нет ингредиентов, которые можно убрать.</p>'
                                : state.cardSettings.ingredients.filter(function (ing) { return ing.removable && ing.isVisible; }).map(function (ing) {
                                    return '<label class=\"inline\"><input type=\"checkbox\" data-action=\"toggle-user-ingredient\" data-id=\"' + ing.id + '\"' + (state.userConfig.removed.indexOf(ing.id) !== -1 ? ' checked' : '') + '> ' + escapeHtml(ing.name) + '</label>';
                                }).join('')) +
                        '</div>' +
                        '<div class=\"panel-section\" style=\"background:rgba(255,255,255,0.1);\">' +
                            '<h3 style=\"margin:0 0 8px;\">Выбор допов</h3>' +
                            (state.cardSettings.optionGroups.length === 0
                                ? '<p class=\"loyalty-muted\">Группы допов отсутствуют.</p>'
                                : state.cardSettings.optionGroups.map(function (group) {
                                    const selection = getSelectionForGroup(group);
                                    if (group.type === 'multiple') {
                                        return '<div style=\"margin-bottom:8px;\"><strong>' + escapeHtml(group.name) + '</strong>' +
                                            (group.description ? '<div class=\"loyalty-muted\">' + escapeHtml(group.description) + '</div>' : '') +
                                            (group.choices || []).map(function (choice) {
                                                const checked = selection && selection.indexOf(choice.id) !== -1;
                                                return '<label class=\"inline\"><input type=\"checkbox\" data-action=\"toggle-user-choice\" data-group=\"' + group.id + '\" data-choice=\"' + choice.id + '\"' + (checked ? ' checked' : '') + '> ' + escapeHtml(choice.name) + (choice.price ? ' (+' + choice.price + ' ₽)' : '') + '</label>';
                                            }).join('') +
                                        '</div>';
                                    }
                                    if (group.type === 'single') {
                                        return '<div style=\"margin-bottom:8px;\"><strong>' + escapeHtml(group.name) + '</strong>' +
                                            (group.description ? '<div class=\"loyalty-muted\">' + escapeHtml(group.description) + '</div>' : '') +
                                            (group.choices || []).map(function (choice) {
                                                return '<label class=\"inline\"><input type=\"radio\" name=\"loyalty-radio-' + group.id + '\" data-action=\"select-user-choice\" data-group=\"' + group.id + '\" data-choice=\"' + choice.id + '\"' + (selection === choice.id ? ' checked' : '') + '> ' + escapeHtml(choice.name) + (choice.price ? ' (+' + choice.price + ' ₽)' : '') + '</label>';
                                            }).join('') +
                                        '</div>';
                                    }
                                    if (group.type === 'select') {
                                        return '<div style=\"margin-bottom:8px;\"><strong>' + escapeHtml(group.name) + '</strong>' +
                                            (group.description ? '<div class=\"loyalty-muted\">' + escapeHtml(group.description) + '</div>' : '') +
                                            '<select data-action=\"select-user-choice\" data-group=\"' + group.id + '\">' +
                                                '<option value=\"\">— Выберите —</option>' +
                                                (group.choices || []).map(function (choice) {
                                                    return '<option value=\"' + choice.id + '\"' + (selection === choice.id ? ' selected' : '') + '>' + escapeHtml(choice.name) + (choice.price ? ' (+' + choice.price + ' ₽)' : '') + '</option>';
                                                }).join('') +
                                            '</select>' +
                                        '</div>';
                                    }
                                    return '<div style=\"margin-bottom:8px;\"><strong>' + escapeHtml(group.name) + '</strong>' +
                                        (group.description ? '<div class=\"loyalty-muted\">' + escapeHtml(group.description) + '</div>' : '') +
                                        '<input type=\"text\" data-action=\"set-custom-choice\" data-group=\"' + group.id + '\" value=\"' + escapeHtml(selection || '') + '\" placeholder=\"' + escapeHtml(group.placeholder || '') + '\">' +
                                    '</div>';
                                }).join('')) +
                        '</div>' +
                        '<div class=\"loyalty-inline-actions\" style=\"margin-top:12px;\">' +
                            '<button class=\"loyalty-button primary\" data-action=\"add-configured-to-cart\">Добавить в корзину</button>' +
                            '<button class=\"loyalty-button secondary\" data-action=\"reset-user-config\">Сбросить выбор</button>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>'
        );
    }

    function renderCartTab() {
        const totals = computeCartTotals();
        return (
            '<div class=\"loyalty-suite-container\">' +
                '<div class=\"loyalty-panel\">' +
                    '<h3>Каталог</h3>' +
                    state.catalog.map(function (product) {
                        return (
                            '<div class=\"loyalty-inline-actions\" style=\"justify-content:space-between;margin-bottom:8px;\">' +
                                '<span>' + escapeHtml(product.name) + ' — ' + formatCurrency(product.price) + ' ₽</span>' +
                                '<button class=\"loyalty-button secondary\" data-action=\"catalog-add\" data-id=\"' + product.id + '\">Добавить</button>' +
                            '</div>'
                        );
                    }).join('') +
                '</div>' +
                '<div class=\"loyalty-panel\">' +
                    '<h3>Корзина (' + state.cartItems.length + ' поз.)</h3>' +
                    totals.evaluated.map(function (item, index) {
                        const meta = item.meta || {};
                        return (
                            '<div style=\"margin-bottom:12px;border-bottom:1px solid rgba(10,107,102,0.12);padding-bottom:12px;\">' +
                                '<div class=\"loyalty-inline-actions\" style=\"justify-content:space-between;\">' +
                                    '<div>' +
                                        '<strong>' + escapeHtml(item.name) + '</strong> — ' + formatCurrency(item.price - (item.discount || 0)) + ' ₽' +
                                        (item.discount ? '<span class=\"loyalty-muted\"> (скидка ' + formatCurrency(item.discount) + ' ₽)</span>' : '') +
                                    '</div>' +
                                    '<button class=\"loyalty-button ghost\" data-action=\"cart-remove\" data-index=\"' + index + '\">Удалить</button>' +
                                '</div>' +
                                (meta.removedIngredients && meta.removedIngredients.length ? '<div class=\"loyalty-muted\">Без: ' + escapeHtml(meta.removedIngredients.join(', ')) + '</div>' : '') +
                                (meta.options && meta.options.length ? '<div class=\"loyalty-muted\">' + meta.options.map(function (opt) {
                                    if (opt.customValue) {
                                        return escapeHtml(opt.groupName + ': ' + opt.customValue);
                                    }
                                    const choiceNames = (opt.choices || []).map(function (choice) {
                                        return choice.name + (choice.price ? ' (+' + choice.price + ' ₽)' : '');
                                    }).join(', ');
                                    return escapeHtml(opt.groupName + ': ' + choiceNames);
                                }).join('<br>') + '</div>' : '') +
                                (item.promoLabels && item.promoLabels.length ? '<div>' + item.promoLabels.map(function (label) {
                                    return '<span class=\"loyalty-chip\">' + escapeHtml(label) + '</span>';
                                }).join('') + '</div>' : '') +
                            '</div>'
                        );
                    }).join('') +
                    '<hr style=\"border-color:rgba(10,107,102,0.12);margin:12px 0;\">' +
                    '<p><strong>Итого:</strong> ' + formatCurrency(totals.total) + ' ₽</p>' +
                    '<p><strong>Дэндики:</strong> ' + totals.dandiks + ' баллов</p>' +
                    '<div class=\"loyalty-inline-actions\" style=\"margin-top:12px;\">' +
                        '<button class=\"loyalty-button primary\" data-action=\"evaluate-remote\"' + (state.remoteLoading ? ' disabled' : '') + '>' + (state.remoteLoading ? 'Расчёт…' : 'Проверить через API') + '</button>' +
                        (state.remoteEvaluation ? '<button class=\"loyalty-button ghost\" data-action=\"clear-evaluation\">Очистить результат</button>' : '') +
                    '</div>' +
                    renderRemoteEvaluationPanel() +
                '</div>' +
            '</div>'
        );
    }

    function renderRemoteEvaluationPanel() {
        if (!state.remoteEvaluation) {
            return '';
        }
        const result = state.remoteEvaluation;
        const campaigns = (result.appliedCampaigns || []).map(function (item) {
            const label = item.name || item.id || 'Кампания';
            const status = item.status || 'pending';
            return '<li>' + escapeHtml(label) + ' — ' + escapeHtml(status) + '</li>';
        }).join('');
        return (
            '<div style="margin-top:12px;background:rgba(242,189,98,0.18);padding:12px;border-radius:12px;">' +
                '<strong>Ответ API /api/loyalty/evaluate</strong>' +
                '<div class="loyalty-muted">Сумма: ' + formatCurrency(result.cartTotal || 0) + ' ₽ · Дэндики: ' + escapeHtml(String(result.coinsEarned || 0)) + '</div>' +
                (campaigns ? '<ul class="loyalty-muted" style="margin:8px 0 0 18px;">' + campaigns + '</ul>' : '') +
                (result.evaluatedAt ? '<div class="loyalty-muted">Время: ' + escapeHtml(new Date(result.evaluatedAt).toLocaleString()) + '</div>' : '') +
            '</div>'
        );
    }

    function renderAnchorsTab() {
        const anchors = computeAnchors();
        return (
            '<div class=\"loyalty-suite-container\">' +
                '<div class=\"loyalty-panel loyalty-anchor-table\">' +
                    '<h3>Якоря и быстрые ссылки</h3>' +
                    '<table class=\"loyalty-table\">' +
                        '<thead><tr><th>Описание</th><th>Ссылка</th></tr></thead>' +
                        '<tbody>' +
                            anchors.map(function (anchor) {
                                return '<tr><td>' + escapeHtml(anchor.label) + '</td><td><code>' + escapeHtml(anchor.value) + '</code></td></tr>';
                            }).join('') +
                        '</tbody>' +
                    '</table>' +
                '</div>' +
                '<div class=\"loyalty-panel\">' +
                    '<h3>Советы по использованию</h3>' +
                    '<ul class=\"loyalty-muted\">' +
                        '<li>Используйте якоря в рекламных кампаниях (UTM + #promo=ID), чтобы открывать нужную акцию.</li>' +
                        '<li>Для подсветки категории — <code>#category=имя</code>, для товара — <code>#sku=артикул</code>.</li>' +
                        '<li>Настройки подсказок управляются в разделе «Отображение».</li>' +
                    '</ul>' +
                '</div>' +
            '</div>'
        );
    }

    function renderStackTab() {
        return (
            '<div class=\"loyalty-suite-container\">' +
                '<div class=\"loyalty-panel\">' +
                    '<h3>Frontend</h3>' +
                    '<ul>' +
                        '<li><strong>React 18 + TypeScript</strong> — админ‑UI и витрина.</li>' +
                        '<li><strong>Zustand / Redux Toolkit</strong> — управление состоянием.</li>' +
                        '<li><strong>Tailwind CSS + shadcn/ui</strong> — быстрые адаптивные интерфейсы.</li>' +
                        '<li><strong>React Hook Form</strong> — сложные формы и валидация.</li>' +
                        '<li><strong>Socket.IO</strong> — live‑обновления корзины и статусов.</li>' +
                    '</ul>' +
                '</div>' +
                '<div class=\"loyalty-panel\">' +
                    '<h3>Backend</h3>' +
                    '<ul>' +
                        '<li><strong>NestJS (Node.js)</strong> — модули Products, Campaigns, Loyalty, Cart.</li>' +
                        '<li><strong>PostgreSQL + Prisma ORM</strong> — хранение товаров, ингредиентов, кампаний.</li>' +
                        '<li><strong>Redis</strong> — кэш активных кампаний, ограничения применения.</li>' +
                        '<li><strong>Swagger/OpenAPI</strong> — документация API.</li>' +
                        '<li><strong>BullMQ</strong> — отложенные задачи (сгорание дэндиков, расписания).</li>' +
                    '</ul>' +
                '</div>' +
                '<div class=\"loyalty-panel\">' +
                    '<h3>Интеграции и отчётность</h3>' +
                    '<ul>' +
                        '<li>REST API: <code>/api/promo/evaluate</code>, <code>/api/loyalty/quote</code>, <code>/api/campaigns/active</code>.</li>' +
                        '<li>Выгрузки CSV/JSON, подключение BI (PowerBI/Tableau) — на втором этапе.</li>' +
                        '<li>Audit trail: история изменений кампаний, откаты, архив.</li>' +
                    '</ul>' +
                '</div>' +
            '</div>'
        );
    }

    function computeAnchors() {
        const base = getBaseUrl();
        const customAnchors = (state.anchors || []).map(function (anchor) {
            const label = anchor.name || ('Якорь: ' + anchor.key);
            var hash = anchor.hash || '';
            if (!hash && anchor.mapping) {
                if (anchor.mapping.type === 'campaign') {
                    hash = '#promo=' + anchor.mapping.refId;
                } else if (anchor.mapping.type === 'category') {
                    hash = '#category=' + anchor.mapping.refId;
                } else if (anchor.mapping.type === 'sku') {
                    hash = '#sku=' + anchor.mapping.refId;
                }
            }
            if (!hash) {
                hash = '#'+ anchor.key;
            }
            if (hash.charAt(0) !== '#') {
                hash = '#' + hash;
            }
            return { label: label, value: base + '/' + hash.replace(/^#/, '#') };
        });
        const campaignAnchors = state.campaigns.map(function (campaign) {
            return { label: 'Кампания: ' + campaign.name, value: base + '/#promo=' + campaign.id };
        });
        const groupAnchors = state.productGroups.map(function (group) {
            return { label: 'Группа: ' + group.name, value: base + '/#group=' + group.id };
        });
        const defaults = [
            { label: 'Категория: Новинки', value: base + '/#category=novinki' },
            { label: 'Категория: Комбо', value: base + '/#category=combo' },
            { label: 'Карточка товара (SKU)', value: base + '/#sku=p1' }
        ];
        return customAnchors.concat(campaignAnchors, groupAnchors, defaults);
    }

    function getBaseUrl() {
        if (typeof window !== 'undefined' && window.location) {
            return window.location.origin;
        }
        return 'https://example.com';
    }

    function setActiveTab(tabId) {
        if (state.activeTab === tabId) { return; }
        state.activeTab = tabId;
        render();
    }

    function addCampaign() {
        const draft = Object.assign({
            type: 'weekdayCombo',
            name: '',
            details: '',
            priority: 50,
            badgeCard: '',
            badgeCart: '',
            conditionsText: '',
            actionsText: ''
        }, state._newCampaign || {});

        if (!draft.name) {
            window.alert('Введите название кампании.');
            return;
        }

        const campaign = {
            id: 'camp_' + Date.now(),
            type: draft.type,
            name: draft.name,
            details: draft.details,
            priority: parseInt(draft.priority, 10) || 50,
            display: {
                card: draft.badgeCard || '',
                cart: draft.badgeCart || ''
            },
            conditions: draft.conditionsText ? draft.conditionsText.split(',').map(function (item) { return item.trim(); }).filter(Boolean) : [],
            actions: draft.actionsText ? draft.actionsText.split(',').map(function (item) { return item.trim(); }).filter(Boolean) : []
        };

        if (campaign.type === 'dandikRate') {
            campaign.rate = parseInt(window.prompt('Процент начисления дэндиков', '10'), 10) || 10;
            campaign.excludeDiscounted = window.confirm('Не начислять дэндики на подарки? (OK — да)');
        }

        var savedCampaign = Object.assign({}, campaign);
        loyaltyApi.createCampaign(campaign).then(function (response) {
            savedCampaign = response.campaign || response.campaigns || response || campaign;
            if (!savedCampaign.id) {
                savedCampaign.id = campaign.id;
            }
            state.apiMessage = 'Кампания сохранена через API';
            state.campaigns.push(savedCampaign);
            state._newCampaign = null;
            render();
        }).catch(function (error) {
            console.warn('[LoyaltySuite] createCampaign failed', error);
            state.apiMessage = 'Кампания сохранена локально (ошибка API: ' + error.message + ')';
            state.campaigns.push(savedCampaign);
            state._newCampaign = null;
            render();
            schedulePersist();
        });
    }

    function removeCampaign(id) {
        state.campaigns = state.campaigns.filter(function (campaign) { return campaign.id !== id; });
        render();
        loyaltyApi.deleteCampaign(id).then(function () {
            state.apiMessage = 'Кампания удалена';
            render();
        }).catch(function (error) {
            console.warn('[LoyaltySuite] deleteCampaign failed', error);
            state.apiMessage = 'Не удалось удалить кампанию: ' + error.message;
            hydrateFromBackend();
        });
    }

    function toggleRuleExclude(id) {
        const updatedRules = state.loyaltyRules.map(function (rule) {
            if (rule.id === id) {
                return Object.assign({}, rule, { excludePromo: !rule.excludePromo });
            }
            return rule;
        });
        const targetRule = updatedRules.find(function (rule) { return rule.id === id; });
        state.loyaltyRules = updatedRules;
        render();
        if (targetRule) {
            loyaltyApi.updateRule(id, targetRule).then(function () {
                state.apiMessage = 'Правило обновлено';
                render();
            }).catch(function (error) {
                console.warn('[LoyaltySuite] updateRule failed', error);
                state.apiMessage = 'Не удалось обновить правило: ' + error.message;
                hydrateFromBackend();
            });
        }
    }

    function removeRule(id) {
        state.loyaltyRules = state.loyaltyRules.filter(function (rule) { return rule.id !== id; });
        render();
        loyaltyApi.deleteRule(id).then(function () {
            state.apiMessage = 'Правило удалено';
            render();
        }).catch(function (error) {
            console.warn('[LoyaltySuite] deleteRule failed', error);
            state.apiMessage = 'Не удалось удалить правило: ' + error.message;
            hydrateFromBackend();
        });
    }

    function addRule() {
        const scope = window.prompt('Сфера применения (global/category/sku)', 'category');
        if (!scope) { return; }
        const target = window.prompt('Цель (например, pizza или SKU)', scope === 'global' ? 'Все категории' : 'pizza');
        const percent = parseInt(window.prompt('Процент дэндиков', '10'), 10);
        if (isNaN(percent)) { return; }
        const exclude = window.confirm('Исключать подарки/промо? (OK — да)');
        const ruleDraft = {
            scope: scope,
            target: target || '',
            percent: percent,
            excludePromo: exclude
        };
        loyaltyApi.createRule(ruleDraft).then(function (response) {
            const saved = response.rule || response;
            if (!saved.id) {
                saved.id = 'rule_' + Date.now();
            }
            state.loyaltyRules.push(saved);
            state.apiMessage = 'Правило сохранено';
            render();
        }).catch(function (error) {
            console.warn('[LoyaltySuite] createRule failed', error);
            ruleDraft.id = 'rule_' + Date.now();
            state.loyaltyRules.push(ruleDraft);
            state.apiMessage = 'Правило сохранено локально (ошибка API: ' + error.message + ')';
            render();
            schedulePersist();
        });
    }

    function addGroup() {
        const name = window.prompt('Название группы');
        if (!name) { return; }
        const type = window.prompt('Тип (static/dynamic)', 'dynamic') || 'dynamic';
        const query = window.prompt('Фильтр или список SKU', type === 'static' ? 'SKU1, SKU2' : 'category=pizza') || '';
        const groupDraft = {
            name: name,
            type: type,
            query: query
        };
        loyaltyApi.createGroup(groupDraft).then(function (response) {
            const saved = response.group || response;
            if (!saved.id) {
                saved.id = 'group_' + Date.now();
            }
            state.productGroups.push(saved);
            state.apiMessage = 'Группа сохранена';
            render();
        }).catch(function (error) {
            console.warn('[LoyaltySuite] createGroup failed', error);
            groupDraft.id = 'group_' + Date.now();
            state.productGroups.push(groupDraft);
            state.apiMessage = 'Группа сохранена локально (ошибка API: ' + error.message + ')';
            render();
            schedulePersist();
        });
    }

    function removeGroup(id) {
        state.productGroups = state.productGroups.filter(function (group) { return group.id !== id; });
        render();
        loyaltyApi.deleteGroup(id).then(function () {
            state.apiMessage = 'Группа удалена';
            render();
        }).catch(function (error) {
            console.warn('[LoyaltySuite] deleteGroup failed', error);
            state.apiMessage = 'Не удалось удалить группу: ' + error.message;
            hydrateFromBackend();
        });
    }

    function setDisplaySetting(field, value, isCheckbox) {
        state.displaySettings[field] = isCheckbox ? !!value : value;
        state.apiMessage = 'Настройки отображения изменены';
        schedulePersist();
        render();
    }

    function selectProduct(productId) {
        state.selectedProductId = productId;
        state.userConfig = {
            removed: [],
            options: buildDefaultOptionSelections(state.cardSettings.optionGroups)
        };
        render();
    }

    function addIngredient() {
        const name = window.prompt('Название ингредиента');
        if (!name) { return; }
        const isMandatory = window.confirm('Сделать ингредиент обязательным? (OK — да)');
        state.cardSettings.ingredients.push({
            id: 'ing_' + Date.now(),
            name: name,
            removable: !isMandatory,
            isMandatory: isMandatory,
            isVisible: true,
            displayOrder: state.cardSettings.ingredients.length + 1
        });
        render();
    }

    function toggleIngredientProperty(id, key) {
        state.cardSettings.ingredients = state.cardSettings.ingredients.map(function (ingredient) {
            if (ingredient.id === id) {
                const updated = Object.assign({}, ingredient);
                if (key === 'isMandatory') {
                    updated.isMandatory = !updated.isMandatory;
                    if (updated.isMandatory) {
                        updated.removable = false;
                    }
                } else if (key === 'removable') {
                    if (ingredient.isMandatory) {
                        return ingredient;
                    }
                    updated.removable = !updated.removable;
                } else if (key === 'isVisible') {
                    updated.isVisible = !updated.isVisible;
                }
                return updated;
            }
            return ingredient;
        });
        render();
    }

    function updateIngredientOrder(id, value) {
        const order = parseInt(value, 10) || 0;
        state.cardSettings.ingredients = state.cardSettings.ingredients.map(function (ingredient) {
            if (ingredient.id === id) {
                return Object.assign({}, ingredient, { displayOrder: order });
            }
            return ingredient;
        });
        render();
    }

    function removeIngredient(id) {
        state.cardSettings.ingredients = state.cardSettings.ingredients.filter(function (ingredient) { return ingredient.id !== id; });
        render();
    }

    function addOptionGroupAdmin() {
        const name = window.prompt('Название группы допов');
        if (!name) { return; }
        const typeInput = window.prompt('Тип (single, multiple, select, custom)', 'single');
        const type = ['single', 'multiple', 'select', 'custom'].indexOf(typeInput) === -1 ? 'single' : typeInput;
        state.cardSettings.optionGroups.push({
            id: 'grp_' + Date.now(),
            name: name,
            type: type,
            isRequired: type !== 'multiple' && type !== 'custom',
            description: '',
            placeholder: '',
            choices: type === 'custom' ? [] : []
        });
        render();
    }

    function removeOptionGroup(groupId) {
        state.cardSettings.optionGroups = state.cardSettings.optionGroups.filter(function (group) { return group.id !== groupId; });
        render();
    }

    function toggleGroupRequired(groupId) {
        state.cardSettings.optionGroups = state.cardSettings.optionGroups.map(function (group) {
            if (group.id === groupId) {
                return Object.assign({}, group, { isRequired: !group.isRequired });
            }
            return group;
        });
        render();
    }

    function setGroupDescription(groupId) {
        const description = window.prompt('Описание для группы (подсказка)');
        if (description === null) { return; }
        state.cardSettings.optionGroups = state.cardSettings.optionGroups.map(function (group) {
            if (group.id === groupId) {
                return Object.assign({}, group, { description: description });
            }
            return group;
        });
        render();
    }

    function addOptionChoice(groupId) {
        const group = state.cardSettings.optionGroups.find(function (item) { return item.id === groupId; });
        if (!group) { return; }
        const name = window.prompt('Название опции');
        if (!name) { return; }
        const price = parseInt(window.prompt('Наценка, ₽', '0'), 10);
        if (isNaN(price)) { return; }
        const choice = { id: 'choice_' + Date.now(), name: name, price: price, isDefault: false, isRequired: false };
        group.choices = (group.choices || []).concat([choice]);
        render();
    }

    function removeOptionChoice(groupId, choiceId) {
        state.cardSettings.optionGroups = state.cardSettings.optionGroups.map(function (group) {
            if (group.id === groupId) {
                return Object.assign({}, group, {
                    choices: (group.choices || []).filter(function (choice) { return choice.id !== choiceId; })
                });
            }
            return group;
        });
        render();
    }

    function toggleChoiceDefault(groupId, choiceId) {
        state.cardSettings.optionGroups = state.cardSettings.optionGroups.map(function (group) {
            if (group.id === groupId) {
                const choices = (group.choices || []).map(function (choice) {
                    if (choice.id === choiceId) {
                        return Object.assign({}, choice, { isDefault: !choice.isDefault });
                    }
                    if (group.type === 'single' || group.type === 'select') {
                        return Object.assign({}, choice, { isDefault: false });
                    }
                    return choice;
                });
                return Object.assign({}, group, { choices: choices });
            }
            return group;
        });
        render();
    }

    function toggleChoiceRequired(groupId, choiceId) {
        state.cardSettings.optionGroups = state.cardSettings.optionGroups.map(function (group) {
            if (group.id === groupId) {
                const choices = (group.choices || []).map(function (choice) {
                    if (choice.id === choiceId) {
                        return Object.assign({}, choice, { isRequired: !choice.isRequired });
                    }
                    return choice;
                });
                return Object.assign({}, group, { choices: choices });
            }
            return group;
        });
        render();
    }

    function updateChoicePrice(groupId, choiceId) {
        const price = parseInt(window.prompt('Новая цена доплаты'), 10);
        if (isNaN(price)) { return; }
        state.cardSettings.optionGroups = state.cardSettings.optionGroups.map(function (group) {
            if (group.id === groupId) {
                const choices = (group.choices || []).map(function (choice) {
                    if (choice.id === choiceId) {
                        return Object.assign({}, choice, { price: price });
                    }
                    return choice;
                });
                return Object.assign({}, group, { choices: choices });
            }
            return group;
        });
        render();
    }

    function addConfiguredToCart() {
        const product = getSelectedProduct();
        const optionExtraTotal = computeOptionExtraTotal();
        const finalPrice = (product ? product.price : 0) + optionExtraTotal;
        const configuredName = getConfiguredName();
        const removedIngredients = state.cardSettings.ingredients
            .filter(function (ing) { return state.userConfig.removed.indexOf(ing.id) !== -1; })
            .map(function (ing) { return ing.name; });
        const optionsSummary = state.cardSettings.optionGroups.map(function (group) {
            const selection = getSelectionForGroup(group);
            if (group.type === 'multiple') {
                const arr = selection || [];
                if (!arr.length) { return null; }
                return {
                    groupName: group.name,
                choices: arr.map(function (id) {
                        const choice = findChoice(group, id);
                        return choice ? { name: choice.name, price: choice.price || 0 } : null;
                    }).filter(Boolean)
                };
            }
            if (group.type === 'custom') {
                if (!selection || !selection.trim()) { return null; }
                return { groupName: group.name, customValue: selection.trim() };
            }
            const choice = findChoice(group, selection);
            if (!choice) { return null; }
            return {
                groupName: group.name,
                choices: [{ name: choice.name, price: choice.price || 0 }]
            };
        }).filter(Boolean);

        state.cartItems.push({
            id: 'custom_' + Date.now(),
            name: configuredName,
            category: product ? product.category : 'custom',
            price: finalPrice,
            img: product ? product.img : '',
            meta: {
                removedIngredients: removedIngredients,
                options: optionsSummary
            }
        });
        render();
    }

    function resetUserConfig() {
        state.userConfig = {
            removed: [],
            options: buildDefaultOptionSelections(state.cardSettings.optionGroups)
        };
        render();
    }

    function toggleUserIngredient(id) {
        const exists = state.userConfig.removed.indexOf(id);
        if (exists === -1) {
            state.userConfig.removed.push(id);
        } else {
            state.userConfig.removed.splice(exists, 1);
        }
        render();
    }

    function toggleUserChoice(groupId, choiceId, checked) {
        const group = state.cardSettings.optionGroups.find(function (item) { return item.id === groupId; });
        if (!group) { return; }
        if (group.type === 'multiple') {
            const selected = state.userConfig.options[groupId] || [];
            const index = selected.indexOf(choiceId);
            if (checked && index === -1) {
                selected.push(choiceId);
            }
            if (!checked && index !== -1) {
                selected.splice(index, 1);
            }
            state.userConfig.options[groupId] = selected;
        } else {
            state.userConfig.options[groupId] = choiceId;
        }
        render();
    }

    function selectUserChoice(groupId, choiceId) {
        state.userConfig.options[groupId] = choiceId;
        render();
    }

    function setCustomChoice(groupId, value) {
        state.userConfig.options[groupId] = value;
    }

    function addCatalogItem(productId) {
        const product = state.catalog.find(function (item) { return item.id === productId; });
        if (!product) { return; }
        state.cartItems.push(clone(product));
        render();
    }

    function removeCartItem(index) {
        state.cartItems.splice(index, 1);
        render();
    }

    function setNewCampaignDraft(field, value) {
        state._newCampaign = Object.assign({
            type: 'weekdayCombo',
            name: '',
            details: '',
            priority: 50,
            badgeCard: '',
            badgeCart: '',
            conditionsText: '',
            actionsText: ''
        }, state._newCampaign || {});
        if (field === 'priority') {
            state._newCampaign[field] = value;
        } else {
            state._newCampaign[field] = value;
        }
    }

    function handleClick(event) {
        const tabBtn = event.target.closest('[data-tab]');
        if (tabBtn) {
            setActiveTab(tabBtn.getAttribute('data-tab'));
            return;
        }

        const actionEl = event.target.closest('[data-action]');
        if (!actionEl) { return; }

        const action = actionEl.getAttribute('data-action');
        switch (action) {
            case 'preview-campaign':
                window.alert('Предпросмотр кампании доступен в MVP — пока демонстрация.');
                break;
            case 'remove-campaign':
                removeCampaign(actionEl.getAttribute('data-id'));
                break;
            case 'add-campaign':
                addCampaign();
                break;
            case 'add-rule':
                addRule();
                break;
            case 'toggle-rule-exclude':
                toggleRuleExclude(actionEl.getAttribute('data-id'));
                break;
            case 'remove-rule':
                removeRule(actionEl.getAttribute('data-id'));
                break;
            case 'add-group':
                addGroup();
                break;
            case 'remove-group':
                removeGroup(actionEl.getAttribute('data-id'));
                break;
            case 'select-product':
                break;
            case 'add-ingredient':
                addIngredient();
                break;
            case 'toggle-ingredient-mandatory':
                toggleIngredientProperty(actionEl.getAttribute('data-id'), 'isMandatory');
                break;
            case 'toggle-ingredient-removable':
                toggleIngredientProperty(actionEl.getAttribute('data-id'), 'removable');
                break;
            case 'toggle-ingredient-visible':
                toggleIngredientProperty(actionEl.getAttribute('data-id'), 'isVisible');
                break;
            case 'remove-ingredient':
                removeIngredient(actionEl.getAttribute('data-id'));
                break;
            case 'add-group-option':
                addOptionGroupAdmin();
                break;
            case 'remove-group-option':
                removeOptionGroup(actionEl.getAttribute('data-id'));
                break;
            case 'toggle-group-required':
                toggleGroupRequired(actionEl.getAttribute('data-id'));
                break;
            case 'set-group-description':
                setGroupDescription(actionEl.getAttribute('data-id'));
                break;
            case 'add-choice':
                addOptionChoice(actionEl.getAttribute('data-id'));
                break;
            case 'remove-choice':
                removeOptionChoice(actionEl.getAttribute('data-group'), actionEl.getAttribute('data-choice'));
                break;
            case 'toggle-choice-default':
                toggleChoiceDefault(actionEl.getAttribute('data-group'), actionEl.getAttribute('data-choice'));
                break;
            case 'toggle-choice-required':
                toggleChoiceRequired(actionEl.getAttribute('data-group'), actionEl.getAttribute('data-choice'));
                break;
            case 'update-choice-price':
                updateChoicePrice(actionEl.getAttribute('data-group'), actionEl.getAttribute('data-choice'));
                break;
            case 'add-configured-to-cart':
                addConfiguredToCart();
                break;
            case 'reset-user-config':
                resetUserConfig();
                break;
            case 'toggle-user-ingredient':
                toggleUserIngredient(actionEl.getAttribute('data-id'));
                break;
            case 'toggle-user-choice':
                toggleUserChoice(actionEl.getAttribute('data-group'), actionEl.getAttribute('data-choice'), actionEl.querySelector('input') ? actionEl.querySelector('input').checked : !actionEl.classList.contains('active'));
                break;
            case 'select-user-choice':
                toggleUserChoice(actionEl.getAttribute('data-group'), actionEl.getAttribute('data-choice'), true);
                break;
            case 'catalog-add':
                addCatalogItem(actionEl.getAttribute('data-id'));
                break;
            case 'cart-remove':
                removeCartItem(parseInt(actionEl.getAttribute('data-index'), 10));
                break;
            case 'evaluate-remote':
                evaluateCartRemote();
                break;
            case 'clear-evaluation':
                clearRemoteEvaluation();
                break;
            case 'remove-group-option':
                removeOptionGroup(actionEl.getAttribute('data-id'));
                break;
            default:
                break;
        }
    }

    function handleChange(event) {
        const sel = event.target;
        if (sel.matches('[data-setting]')) {
            const field = sel.getAttribute('data-setting');
            if (sel.type === 'checkbox') {
                setDisplaySetting(field, sel.checked, true);
            } else {
                setDisplaySetting(field, sel.value, false);
            }
            return;
        }

        if (sel.matches('[data-action=\"select-product\"]')) {
            selectProduct(sel.value);
            return;
        }

        if (sel.matches('[data-action=\"update-ingredient-order\"]')) {
            updateIngredientOrder(sel.getAttribute('data-id'), sel.value);
            return;
        }

        if (sel.matches('[data-action=\"select-user-choice\"]')) {
            const groupId = sel.getAttribute('data-group');
            const choiceId = sel.value || null;
            if (state.cardSettings.optionGroups.find(function (group) { return group.id === groupId && group.type === 'custom'; })) {
                setCustomChoice(groupId, choiceId || '');
            } else {
                state.userConfig.options[groupId] = choiceId;
            }
            render();
            return;
        }

        if (sel.matches('[data-action=\"set-custom-choice\"]')) {
            setCustomChoice(sel.getAttribute('data-group'), sel.value || '');
            return;
        }

        if (sel.matches('[data-action=\"set-new-campaign-field\"]')) {
            const field = sel.getAttribute('data-field');
            setNewCampaignDraft(field, sel.value);
            return;
        }
    }

    function handleInput(event) {
        const input = event.target;
        if (input.matches('[data-action=\"set-new-campaign-field\"]')) {
            const field = input.getAttribute('data-field');
            setNewCampaignDraft(field, input.value);
            return;
        }

        if (input.matches('[data-setting]') && input.type !== 'checkbox') {
            setDisplaySetting(input.getAttribute('data-setting'), input.value, false);
            return;
        }

        if (input.matches('[data-action=\"set-custom-choice\"]')) {
            setCustomChoice(input.getAttribute('data-group'), input.value);
        }
    }

    container.addEventListener('click', handleClick);
    container.addEventListener('change', handleChange);
    container.addEventListener('input', handleInput);

    render();
    hydrateFromBackend();

    try {
        const testCampaigns = [{ type: 'nthPizza', n: 7, price: 1, target: 'cheapest' }];
        const testCart = Array(7).fill(0).map(function (_, idx) {
            return { name: 'Пицца', category: 'pizza', price: 500 + idx };
        });
        const res = evaluatePromos(testCart, testCampaigns);
        console.assert(res.items.some(function (item) { return item.discount > 0; }), '[LoyaltySuite] Тест скидки на 7‑ю пиццу не прошёл');

        const defaultSelections = buildDefaultOptionSelections(initialOptionGroups);
        console.assert(defaultSelections.grp_dough === 'thin', '[LoyaltySuite] Некорректный дефолтный выбор группы');

        console.log('%cLoyalty Suite ready', 'color:#0f0');
    } catch (error) {
        console.error('Loyalty Suite self-tests failed', error);
    }
})();

