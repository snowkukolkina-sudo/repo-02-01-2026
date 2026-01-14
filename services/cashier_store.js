const path = require('path');
const fs = require('fs-extra');
const sqlite3 = require('sqlite3');

const STORAGE_DIR = process.env.CASHIER_STORAGE_PATH || path.join(process.cwd(), 'storage', 'cashier');
const DATA_FILE = path.join(STORAGE_DIR, 'data.json');

let cache = null;

function resolveDbPath() {
    const candidates = [
        path.join(process.cwd(), 'database.sqlite'),
        path.join(process.cwd(), 'api', 'database.sqlite')
    ];
    for (const p of candidates) {
        try {
            if (fs.existsSync(p)) return p;
        } catch (_) {}
    }
    return candidates[0];
}

function toSqliteDateTime(value) {
    try {
        const d = value ? new Date(value) : new Date();
        if (Number.isNaN(d.getTime())) return null;
        return d.toISOString().slice(0, 19).replace('T', ' ');
    } catch (_) {
        return null;
    }
}

function withDb(dbPath, handler) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
            if (err) return reject(err);
            Promise.resolve()
                .then(() => handler(db))
                .then((result) => {
                    db.close(() => resolve(result));
                })
                .catch((error) => {
                    db.close(() => reject(error));
                });
        });
    });
}

function dbAll(db, sql, params) {
    return new Promise((resolve, reject) => {
        db.all(sql, params || [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });
}

async function loadOrdersForPeriod(startIso, endIso) {
    const dbPath = resolveDbPath();
    const start = toSqliteDateTime(startIso);
    const end = toSqliteDateTime(endIso);
    if (!start || !end) return [];

    return withDb(dbPath, async (db) => {
        const rows = await dbAll(
            db,
            `SELECT id, customer_name, phone, address, total, status, created_at, items, payment_method, delivery_type, source
             FROM orders
             WHERE datetime(created_at) >= datetime(?) AND datetime(created_at) <= datetime(?)
             ORDER BY created_at DESC`,
            [start, end]
        );
        return rows.map((r) => {
            let items = r.items;
            try {
                if (typeof items === 'string') items = JSON.parse(items);
            } catch (_) {
                items = [];
            }
            if (!Array.isArray(items)) items = [];
            return {
                id: r.id,
                customer_name: r.customer_name || '',
                phone: r.phone || '',
                address: r.address || '',
                total: Number(r.total) || 0,
                status: r.status || 'pending',
                created_at: r.created_at || null,
                payment_method: r.payment_method || null,
                delivery_type: r.delivery_type || null,
                source: r.source || null,
                items
            };
        });
    });
}

function computeReport({ shift, storeReport, orders }) {
    const cashInitial = Number(shift?.cash_initial) || 0;
    const expenses = Array.isArray(storeReport?.expenses) ? storeReport.expenses : [];
    const totalExpenses = Number(storeReport?.total_expenses) || 0;
    const expensesByCategory = storeReport?.expenses_by_category || {};

    const buckets = {
        cash_at_store: 0,
        cash_at_store_orders: 0,
        cash_at_courier: 0,
        cash_at_courier_orders: 0,
        card_at_store: 0,
        card_at_store_orders: 0,
        card_at_courier: 0,
        card_at_courier_orders: 0,
        yandex_eda: 0,
        yandex_eda_orders: 0,
        delivery_club: 0,
        delivery_club_orders: 0,
        vkusvill: 0,
        vkusvill_orders: 0
    };

    let totalSales = 0;
    let cashSales = 0;
    let cardSales = 0;
    let aggregatorsSales = 0;

    const ordersList = Array.isArray(orders) ? orders : [];

    ordersList.forEach((o) => {
        const amount = Number(o.total) || 0;
        totalSales += amount;

        const source = (o.source || '').toLowerCase();
        const payment = (o.payment_method || '').toLowerCase();
        const delivery = (o.delivery_type || '').toLowerCase();
        const isDelivery = delivery === 'delivery' || delivery === 'courier';
        const isPickup = delivery === 'pickup' || delivery === 'self' || delivery === 'store';

        const isAggregator = source === 'yandex_eda' || source === 'delivery_club' || source === 'vkusvill';
        if (isAggregator) {
            aggregatorsSales += amount;
            if (source === 'yandex_eda') {
                buckets.yandex_eda += amount;
                buckets.yandex_eda_orders += 1;
            } else if (source === 'delivery_club') {
                buckets.delivery_club += amount;
                buckets.delivery_club_orders += 1;
            } else if (source === 'vkusvill') {
                buckets.vkusvill += amount;
                buckets.vkusvill_orders += 1;
            }
            return;
        }

        if (payment === 'cash') {
            cashSales += amount;
            if (isDelivery) {
                buckets.cash_at_courier += amount;
                buckets.cash_at_courier_orders += 1;
            } else {
                buckets.cash_at_store += amount;
                buckets.cash_at_store_orders += 1;
            }
            return;
        }

        if (payment === 'card') {
            cardSales += amount;
            if (isDelivery) {
                buckets.card_at_courier += amount;
                buckets.card_at_courier_orders += 1;
            } else {
                buckets.card_at_store += amount;
                buckets.card_at_store_orders += 1;
            }
            return;
        }

        // Unknown payment method: treat as non-cash
        cardSales += amount;
        if (isDelivery) {
            buckets.card_at_courier += amount;
            buckets.card_at_courier_orders += 1;
        } else if (isPickup || !delivery) {
            buckets.card_at_store += amount;
            buckets.card_at_store_orders += 1;
        }
    });

    const cashExpected = parseFloat((cashInitial + cashSales - totalExpenses).toFixed(2));

    return {
        total_orders: ordersList.length,
        total_sales: parseFloat(totalSales.toFixed(2)),
        cash_total: cashExpected,
        card_total: parseFloat(cardSales.toFixed(2)),
        aggregators_total: parseFloat(aggregatorsSales.toFixed(2)),
        total_expenses: parseFloat(totalExpenses.toFixed(2)),
        income_by_source: buckets,
        expenses_count: expenses.length,
        expenses_by_category: expensesByCategory,
        expenses
    };
}

const defaultStore = {
    currentShift: {
        id: 'shift-demo',
        opened_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        cash_initial: 5000,
        cash_difference: 0,
        notes: 'Демо смена',
        closed_at: null
    },
    report: {
        total_orders: 37,
        total_sales: 184560,
        cash_total: 52430,
        card_total: 98200,
        aggregators_total: 33880,
        total_expenses: 12450,
        income_by_source: {
            cash_at_store: 32400,
            cash_at_store_orders: 12,
            cash_at_courier: 20030,
            cash_at_courier_orders: 9,
            card_at_store: 45800,
            card_at_store_orders: 8,
            card_at_courier: 52400,
            card_at_courier_orders: 5,
            yandex_eda: 19880,
            yandex_eda_orders: 2,
            delivery_club: 8400,
            delivery_club_orders: 1,
            vkusvill: 5600,
            vkusvill_orders: 0
        },
        expenses_count: 3,
        expenses_by_category: {
            supplier_payment: 6500,
            courier_salary: 2800,
            utilities: 1450,
            rent: 0,
            office_supplies: 1200,
            repairs: 500,
            other: 0
        },
        expenses: [
            {
                id: 'exp-1',
                category: 'supplier_payment',
                amount: 6500,
                description: 'Поставка овощей',
                created_at: new Date().toISOString()
            },
            {
                id: 'exp-2',
                category: 'courier_salary',
                amount: 2800,
                description: 'Смена курьера Иванова',
                created_at: new Date().toISOString()
            },
            {
                id: 'exp-3',
                category: 'utilities',
                amount: 1450,
                description: 'Оплата электроэнергии',
                created_at: new Date().toISOString()
            }
        ]
    },
    history: []
};

async function ensureStorage() {
    await fs.ensureDir(STORAGE_DIR);
    const exists = await fs.pathExists(DATA_FILE);
    if (!exists) {
        await fs.writeJson(DATA_FILE, defaultStore, { spaces: 2 });
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

async function getCurrentShift() {
    const store = await loadStore();
    if (!store.currentShift || store.currentShift.closed_at) {
        return {
            shift: null,
            report: null,
            orders: []
        };
    }

    const orders = await loadOrdersForPeriod(store.currentShift.opened_at, new Date().toISOString()).catch(() => []);
    const report = computeReport({
        shift: store.currentShift,
        storeReport: store.report,
        orders
    });

    return {
        shift: clone(store.currentShift),
        report: clone(report),
        orders: clone(orders)
    };
}

async function openShift(data) {
    const store = await loadStore();
    if (store.currentShift && !store.currentShift.closed_at) {
        throw new Error('Текущая смена уже открыта');
    }
    const newShift = {
        id: `shift-${Date.now()}`,
        opened_at: new Date().toISOString(),
        cash_initial: data.cash_initial || 0,
        cash_difference: 0,
        notes: data.notes || null,
        closed_at: null
    };
    const newReport = {
        total_orders: 0,
        total_sales: 0,
        cash_total: data.cash_initial || 0,
        card_total: 0,
        aggregators_total: 0,
        total_expenses: 0,
        income_by_source: {
            cash_at_store: 0,
            cash_at_store_orders: 0,
            cash_at_courier: 0,
            cash_at_courier_orders: 0,
            card_at_store: 0,
            card_at_store_orders: 0,
            card_at_courier: 0,
            card_at_courier_orders: 0,
            yandex_eda: 0,
            yandex_eda_orders: 0,
            delivery_club: 0,
            delivery_club_orders: 0,
            vkusvill: 0,
            vkusvill_orders: 0
        },
        expenses_count: 0,
        expenses_by_category: {
            supplier_payment: 0,
            courier_salary: 0,
            utilities: 0,
            rent: 0,
            office_supplies: 0,
            repairs: 0,
            other: 0
        },
        expenses: []
    };
    store.currentShift = newShift;
    store.report = newReport;
    await saveStore();
    return {
        shift: clone(newShift),
        report: clone(newReport)
    };
}

async function closeShift(data) {
    const store = await loadStore();
    if (!store.currentShift || store.currentShift.closed_at) {
        throw new Error('Нет открытой смены');
    }

    const orders = await loadOrdersForPeriod(store.currentShift.opened_at, new Date().toISOString()).catch(() => []);
    const computed = computeReport({
        shift: store.currentShift,
        storeReport: store.report,
        orders
    });

    const actualCash = data.cash_actual || 0;
    const expectedCash = computed.cash_total;
    store.currentShift.cash_difference = parseFloat((actualCash - expectedCash).toFixed(2));
    store.currentShift.closed_at = new Date().toISOString();
    store.currentShift.notes = data.notes || store.currentShift.notes;

    store.history.unshift({
        shift: clone(store.currentShift),
        report: clone(computed),
        orders: clone(orders)
    });

    const result = {
        shift: clone(store.currentShift),
        report: clone(computed),
        orders: clone(orders)
    };

    store.currentShift = null;
    store.report = null;
    await saveStore();
    return result;
}

async function addExpense(expense) {
    const store = await loadStore();
    if (!store.currentShift || store.currentShift.closed_at) {
        throw new Error('Нет открытой смены');
    }
    const newExpense = {
        id: `expense-${Date.now()}`,
        category: expense.category,
        amount: expense.amount,
        description: expense.description || '',
        created_at: new Date().toISOString()
    };
    store.report.expenses = store.report.expenses || [];
    store.report.expenses.push(newExpense);
    store.report.expenses_count = (store.report.expenses_count || 0) + 1;
    store.report.total_expenses = parseFloat((store.report.total_expenses + expense.amount).toFixed(2));
    if (!store.report.expenses_by_category[expense.category]) {
        store.report.expenses_by_category[expense.category] = 0;
    }
    store.report.expenses_by_category[expense.category] = parseFloat(
        (store.report.expenses_by_category[expense.category] + expense.amount).toFixed(2)
    );
    await saveStore();
    return clone(newExpense);
}

async function getXReport() {
    const store = await loadStore();
    if (!store.currentShift || store.currentShift.closed_at) {
        throw new Error('Нет отчёта');
    }
    const orders = await loadOrdersForPeriod(store.currentShift.opened_at, new Date().toISOString()).catch(() => []);
    const computed = computeReport({
        shift: store.currentShift,
        storeReport: store.report,
        orders
    });
    return clone(computed);
}

async function listHistory() {
    const store = await loadStore();
    return clone(Array.isArray(store.history) ? store.history : []);
}

module.exports = {
    getCurrentShift,
    openShift,
    closeShift,
    addExpense,
    getXReport,
    listHistory
};

