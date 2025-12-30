const path = require('path');
const fs = require('fs-extra');

const STORAGE_DIR = process.env.AGGREGATORS_STORAGE_PATH || path.join(process.cwd(), 'storage', 'integrations');
const DATA_FILE = path.join(STORAGE_DIR, 'aggregators.json');
const ORDERS_FILE = path.join(STORAGE_DIR, 'aggregator-orders.jsonl');

let cache = null;

const defaultStore = {
    aggregators: {
        yandex_eda: {
            id: 'yandex_eda',
            name: 'Яндекс.Еда',
            description: 'Приём заказов и синхронизация меню с платформой Яндекс.Еда',
            enabled: false,
            restaurant_id: '',
            api_key: '',
            webhook_url: '',
            menu_last_sync: null,
            orders_today: 0,
            revenue_today: 0,
            status: 'not_configured'
        },
        delivery_club: {
            id: 'delivery_club',
            name: 'Delivery Club',
            description: 'Подключение ресторана к Delivery Club и обмен заказами',
            enabled: false,
            restaurant_id: '',
            api_key: '',
            webhook_url: '',
            menu_last_sync: null,
            orders_today: 0,
            revenue_today: 0,
            status: 'not_configured'
        },
        vkusvill: {
            id: 'vkusvill',
            name: 'ВкусВилл',
            description: 'Заказы в сервисе ВкусВилл и онлайн-витрина',
            enabled: false,
            restaurant_id: '',
            api_key: '',
            webhook_url: '',
            menu_last_sync: null,
            orders_today: 0,
            revenue_today: 0,
            status: 'not_configured'
        }
    }
};

async function ensureStorage() {
    await fs.ensureDir(STORAGE_DIR);
    const exists = await fs.pathExists(DATA_FILE);
    if (!exists) {
        await fs.writeJson(DATA_FILE, defaultStore, { spaces: 2 });
    }
    if (!(await fs.pathExists(ORDERS_FILE))) {
        await fs.writeFile(ORDERS_FILE, '', 'utf8');
    }
}

async function loadStore() {
    if (cache) {
        return cache;
    }
    await ensureStorage();
    cache = await fs.readJson(DATA_FILE);
    return cache;
}

async function saveStore() {
    if (!cache) return;
    await fs.writeJson(DATA_FILE, cache, { spaces: 2 });
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

async function listAggregators() {
    const store = await loadStore();
    return clone(Object.values(store.aggregators));
}

async function getAggregator(id) {
    const store = await loadStore();
    return clone(store.aggregators[id] || null);
}

async function updateAggregator(id, changes) {
    const store = await loadStore();
    if (!store.aggregators[id]) {
        throw new Error('Aggregator not found');
    }
    store.aggregators[id] = {
        ...store.aggregators[id],
        ...changes
    };
    await saveStore();
    return clone(store.aggregators[id]);
}

async function toggleAggregator(id, enabled) {
    return updateAggregator(id, {
        enabled,
        status: enabled ? 'active' : 'configured'
    });
}

async function recordSync(id, payload = {}) {
    const now = new Date().toISOString();
    const changes = {
        menu_last_sync: payload.menu ? now : undefined,
        orders_today: payload.orders_today ?? 0,
        revenue_today: payload.revenue_today ?? 0,
        status: payload.status || 'active'
    };
    Object.keys(changes).forEach((key) => {
        if (typeof changes[key] === 'undefined') {
            delete changes[key];
        }
    });
    return updateAggregator(id, changes);
}

async function appendOrderEvent(id, payload = {}) {
    const store = await loadStore();
    if (!store.aggregators[id]) {
        throw new Error('Aggregator not found');
    }

    const totalRaw = payload?.total ?? payload?.amount ?? payload?.order_total ?? payload?.price ?? payload?.sum ?? 0;
    const total = Number(totalRaw) || 0;

    const event = {
        id: `agg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        aggregator: id,
        createdAt: new Date().toISOString(),
        total,
        payload
    };

    await ensureStorage();
    await fs.appendFile(ORDERS_FILE, JSON.stringify(event) + '\n', 'utf8');

    const current = store.aggregators[id];
    store.aggregators[id] = {
        ...current,
        orders_today: (Number(current.orders_today) || 0) + 1,
        revenue_today: (Number(current.revenue_today) || 0) + total,
        status: 'active'
    };
    await saveStore();

    return clone(event);
}

async function listOrderEvents(id, limit = 50) {
    await ensureStorage();
    if (!(await fs.pathExists(ORDERS_FILE))) return [];
    const content = await fs.readFile(ORDERS_FILE, 'utf8');
    if (!content.trim()) return [];
    const lines = content.trim().split('\n');
    const events = [];
    for (let i = lines.length - 1; i >= 0 && events.length < limit; i--) {
        const line = (lines[i] || '').trim();
        if (!line) continue;
        try {
            const evt = JSON.parse(line);
            if (evt && evt.aggregator === id) {
                events.push(evt);
            }
        } catch (_) {
            // ignore
        }
    }
    return events.reverse();
}

module.exports = {
    listAggregators,
    getAggregator,
    updateAggregator,
    toggleAggregator,
    recordSync,
    appendOrderEvent,
    listOrderEvents
};

