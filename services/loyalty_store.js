const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

const STORAGE_ROOT = process.env.LOYALTY_STORAGE_PATH || path.join(process.cwd(), 'storage', 'loyalty');
const DATA_FILE = path.join(STORAGE_ROOT, 'config.json');

const defaultData = {
    campaigns: [
        {
            id: 'weekday_combo',
            type: 'weekdayCombo',
            name: 'Будни: комбо + напиток за 1 ₽',
            status: 'active',
            priority: 80,
            schedule: {
                days: ['Mon', 'Tue', 'Wed', 'Thu'],
                time: { from: '11:00', to: '18:00' }
            },
            conditions: [
                { type: 'cartHasGroup', args: { group: 'combo' } }
            ],
            actions: [
                { type: 'addGiftFor1', args: { group: 'soda_standard', perEachOf: 'combo', max: 1 } }
            ],
            caps: { perOrder: 2 },
            display: {
                badges: { card: '+ напиток 1 ₽', cart: 'Напиток 1 ₽', tooltip: 'При комбо в будни 11–18 напиток за 1 ₽' },
                banner: null
            }
        },
        {
            id: 'pizza7',
            type: 'nthPizza',
            name: '7-я пицца за 1 ₽',
            status: 'active',
            priority: 90,
            schedule: { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
            conditions: [
                { type: 'cartCountInGroup', args: { group: 'pizza', gte: 7 } }
            ],
            actions: [
                { type: 'priceOverrideTo1', args: { target: 'cheapestInGroup', group: 'pizza' } }
            ],
            caps: { perOrder: 1 },
            display: {
                badges: { card: '7-я за 1 ₽', cart: '7-я пицца — 1 ₽' },
                tooltip: 'Добавьте 7 пицц — одна будет 1 ₽'
            }
        },
        {
            id: 'crab_roll',
            type: 'rollForOrder',
            name: 'Краб-ролл за 1 ₽',
            status: 'active',
            priority: 70,
            schedule: { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
            conditions: [
                { type: 'minSubtotalInGroups', args: { groups: ['pizza', 'roll'], min: 2500 } }
            ],
            actions: [
                { type: 'addGiftFor1', args: { sku: 'ROLL_CRAB', max: 1 } }
            ],
            caps: { perOrder: 1 },
            display: {
                badges: { card: 'Краб‑ролл 1 ₽', cart: 'Краб-ролл 1 ₽' }
            }
        }
    ],
    loyaltyRules: [
        { id: 'rule_global', scope: 'global', target: '*', percent: 10, coinsRate: 1, excludePromo: true },
        { id: 'rule_pizza', scope: 'category', target: 'pizza', percent: 12, coinsRate: 1, excludePromo: false },
        { id: 'rule_combo', scope: 'category', target: 'combo', percent: 8, coinsRate: 1, excludePromo: true }
    ],
    productGroups: [
        { id: 'group_pizza', name: 'Пицца', type: 'dynamic', query: { category: 'pizza' }, notes: 'Вся пицца' },
        { id: 'group_combo', name: 'Комбо', type: 'dynamic', query: { category: 'combo' } },
        { id: 'group_drinks', name: 'Газировка стандарт', type: 'static', members: ['d1', 'd2', 'd3'] }
    ],
    display: {
        cardBadgeTemplate: 'Акция: {{title}}',
        cartBannerTemplate: 'Добавьте еще {{missing}} ₽ для {{reward}}',
        tooltipText: 'Скидки и дэндики рассчитываются автоматически',
        showAnchorHints: true
    },
    anchors: [
        { id: 'anchor_promos', key: 'promo', mapping: { type: 'campaign', refId: 'pizza7' }, utmSupport: true },
        { id: 'anchor_new', key: 'category-new', mapping: { type: 'category', refId: 'new' }, utmSupport: false }
    ],
    settings: {
        coins: {
            rate: 1,
            rounding: 'floor',
            expiryDays: 365
        },
        stacking: {
            mode: 'bestPrice',
            excludedGroups: []
        }
    }
};

async function ensureStorage() {
    await fs.ensureDir(STORAGE_ROOT);
    const exists = await fs.pathExists(DATA_FILE);
    if (!exists) {
        await fs.writeJson(DATA_FILE, defaultData, { spaces: 2 });
    }
}

async function readConfig() {
    await ensureStorage();
    return fs.readJson(DATA_FILE);
}

async function writeConfig(data) {
    await ensureStorage();
    await fs.writeJson(DATA_FILE, data, { spaces: 2 });
    return data;
}

function makeId(prefix) {
    return `${prefix}_${uuidv4().slice(0, 8)}`;
}

async function upsertItem(collectionKey, item, idField = 'id') {
    const data = await readConfig();
    const collection = data[collectionKey] || [];
    if (!item[idField]) {
        item[idField] = makeId(collectionKey.slice(0, 3));
    }
    const idx = collection.findIndex((existing) => existing[idField] === item[idField]);
    if (idx === -1) {
        collection.push(item);
    } else {
        collection[idx] = item;
    }
    data[collectionKey] = collection;
    await writeConfig(data);
    return item;
}

async function deleteItem(collectionKey, id, idField = 'id') {
    const data = await readConfig();
    const collection = data[collectionKey] || [];
    const idx = collection.findIndex((existing) => existing[idField] === id);
    if (idx === -1) {
        return false;
    }
    collection.splice(idx, 1);
    data[collectionKey] = collection;
    await writeConfig(data);
    return true;
}

module.exports = {
    ensureStorage,
    readConfig,
    writeConfig,
    upsertItem,
    deleteItem,
    makeId
};

