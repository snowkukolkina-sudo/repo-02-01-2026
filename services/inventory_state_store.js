const path = require('path');
const fs = require('fs-extra');

const defaultState = require('../config/inventory-default-state.json');

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'inventory');
const STATE_FILE = path.join(STORAGE_DIR, 'state.json');
const MENU_FILE = path.join(process.cwd(), 'menu_data.json');

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function mergeWithDefault(state = {}) {
    const base = clone(defaultState);
    Object.keys(state || {}).forEach((key) => {
        base[key] = state[key];
    });
    return base;
}

async function ensureState() {
    await fs.ensureDir(STORAGE_DIR);
    if (!(await fs.pathExists(STATE_FILE))) {
        const initial = clone(defaultState);
        await fs.writeJson(STATE_FILE, initial, { spaces: 2 });
        return initial;
    }
    const data = await fs.readJson(STATE_FILE);
    return mergeWithDefault(data);
}

async function saveState(state) {
    await fs.writeJson(STATE_FILE, state, { spaces: 2 });
    return state;
}

function sanitizeKey(key) {
    const normalized = String(key || '').trim();
    if (!normalized || !/^[a-zA-Z0-9_-]+$/.test(normalized)) {
        throw new Error('Недопустимое имя ключа');
    }
    return normalized;
}

async function getState() {
    return ensureState();
}

async function getKey(key) {
    const safeKey = sanitizeKey(key);
    const state = await ensureState();
    return typeof state[safeKey] === 'undefined' ? null : state[safeKey];
}

async function setKey(key, value) {
    const safeKey = sanitizeKey(key);
    const state = await ensureState();
    state[safeKey] = clone(value);
    await saveState(state);
    return state[safeKey];
}

async function listProducts() {
    const state = await ensureState();
    return Array.isArray(state.products) ? state.products : [];
}

async function listWarehouses() {
    const state = await ensureState();
    return Array.isArray(state.warehouses) ? state.warehouses : [];
}

function normalizeStockBalancePayload(payload = {}) {
    return {
        warehouseId: Number(payload.warehouseId) || Number(payload.warehouse_id) || 1,
        productId: Number(payload.productId) || Number(payload.product_id) || 0,
        quantity: Number(payload.quantity) || 0,
        costPerUnit: payload.costPerUnit !== undefined ? Number(payload.costPerUnit) : (payload.purchase_price !== undefined ? Number(payload.purchase_price) : null),
        batchNumber: payload.batchNumber || payload.batch_number || null,
        expiryDate: payload.expiryDate || payload.expiry_date || null,
        supplier: payload.supplier || null,
        supplierInvoice: payload.supplierInvoice || payload.supplier_invoice || null
    };
}

function toIsoDateOnly(value) {
    if (!value) return null;
    try {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return null;
        return d.toISOString().slice(0, 10);
    } catch (_) {
        return null;
    }
}

async function listStockItems({ warehouseId } = {}) {
    const state = await ensureState();
    const products = Array.isArray(state.products) ? state.products : [];
    const warehouses = Array.isArray(state.warehouses) ? state.warehouses : [];
    const balances = Array.isArray(state.stockBalances) ? state.stockBalances : [];

    const whFilter = warehouseId ? String(warehouseId) : null;
    const filtered = whFilter
        ? balances.filter((b) => String(b.warehouseId) === whFilter)
        : balances;

    return filtered.map((b, idx) => {
        const p = products.find((x) => String(x.id) === String(b.productId)) || {};
        const w = warehouses.find((x) => String(x.id) === String(b.warehouseId)) || {};
        return {
            id: `${b.warehouseId}-${b.productId}-${idx}`,
            warehouse_id: b.warehouseId,
            warehouse_name: w.name || String(b.warehouseId),
            product_id: b.productId,
            product_name: p.name || String(b.productId),
            product_sku: p.code || p.sku || String(b.productId),
            batch_number: b.batchNumber || '',
            expiry_date: b.expiryDate ? toIsoDateOnly(b.expiryDate) : null,
            quantity: Number(b.quantity) || 0,
            unit: p.baseUnit || 'шт',
            purchase_price: b.costPerUnit !== null && b.costPerUnit !== undefined ? Number(b.costPerUnit) : null,
            supplier: b.supplier || null,
            supplier_invoice: b.supplierInvoice || null
        };
    });
}

async function listExpiringItems({ days = 7, warehouseId } = {}) {
    const items = await listStockItems({ warehouseId });
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + (Number(days) || 0));
    const horizonDate = horizon.toISOString().slice(0, 10);
    return items
        .filter((item) => item.expiry_date && item.expiry_date <= horizonDate)
        .map((item) => {
            const diffMs = new Date(item.expiry_date).getTime() - Date.now();
            const diffDays = Math.ceil(diffMs / (24 * 3600 * 1000));
            return { ...item, days_to_expiry: diffDays };
        });
}

async function receiveStock(payload = {}) {
    const state = await ensureState();
    const balance = normalizeStockBalancePayload(payload);
    if (!balance.productId) {
        throw new Error('Не указан product_id');
    }
    if (!balance.warehouseId) {
        throw new Error('Не указан warehouse_id');
    }
    if (!(balance.quantity > 0)) {
        throw new Error('Количество должно быть > 0');
    }

    state.stockBalances = Array.isArray(state.stockBalances) ? state.stockBalances : [];
    state.stockBalances.push({
        warehouseId: balance.warehouseId,
        productId: balance.productId,
        quantity: balance.quantity,
        costPerUnit: balance.costPerUnit,
        batchNumber: balance.batchNumber,
        expiryDate: balance.expiryDate,
        supplier: balance.supplier,
        supplierInvoice: balance.supplierInvoice
    });
    await saveState(state);
    return { ok: true };
}

function compareBatch(a, b) {
    const ae = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
    const be = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
    if (ae !== be) return ae - be;
    return 0;
}

async function writeoffStock(payload = {}) {
    const state = await ensureState();
    const wh = Number(payload.warehouseId || payload.warehouse_id) || 0;
    const pid = Number(payload.productId || payload.product_id) || 0;
    const qty = Number(payload.quantity) || 0;
    if (!wh || !pid) throw new Error('warehouse_id и product_id обязательны');
    if (!(qty > 0)) throw new Error('quantity должно быть > 0');

    const balances = Array.isArray(state.stockBalances) ? state.stockBalances : [];
    const relevant = balances
        .map((b, idx) => ({ ...b, _idx: idx }))
        .filter((b) => Number(b.warehouseId) === wh && Number(b.productId) === pid && Number(b.quantity) > 0)
        .sort(compareBatch);

    let remaining = qty;
    for (const batch of relevant) {
        if (remaining <= 0) break;
        const can = Math.min(Number(batch.quantity) || 0, remaining);
        remaining -= can;
        balances[batch._idx].quantity = (Number(balances[batch._idx].quantity) || 0) - can;
    }

    if (remaining > 1e-9) {
        throw new Error('Недостаточно остатка для списания');
    }

    state.stockBalances = balances.filter((b) => (Number(b.quantity) || 0) > 1e-9);
    await saveState(state);
    return { ok: true };
}

async function transferStock(payload = {}) {
    const fromWh = Number(payload.from_warehouse_id || payload.fromWarehouseId) || 0;
    const toWh = Number(payload.to_warehouse_id || payload.toWarehouseId) || 0;
    const productId = Number(payload.product_id || payload.productId) || 0;
    const quantity = Number(payload.quantity) || 0;
    if (!fromWh || !toWh || !productId) throw new Error('from/to warehouse и product_id обязательны');
    if (fromWh === toWh) throw new Error('Склады должны быть разными');
    if (!(quantity > 0)) throw new Error('quantity должно быть > 0');

    await writeoffStock({ warehouseId: fromWh, productId, quantity });
    await receiveStock({ warehouseId: toWh, productId, quantity, purchase_price: payload.purchase_price || null, batch_number: payload.batch_number || null, expiry_date: payload.expiry_date || null });
    return { ok: true };
}

function convertQty(qty, fromUnit, toBaseUnit) {
    const q = Number(qty) || 0;
    const from = String(fromUnit || '').toLowerCase();
    const to = String(toBaseUnit || '').toLowerCase();
    if (!from || !to || from === to) return q;
    if ((from === 'г' || from === 'гр' || from === 'gram' || from === 'g') && (to === 'кг' || to === 'kg')) return q / 1000;
    if ((from === 'кг' || from === 'kg') && (to === 'г' || to === 'g')) return q * 1000;
    if ((from === 'мл' || from === 'ml') && (to === 'л' || to === 'l')) return q / 1000;
    if ((from === 'л' || from === 'l') && (to === 'мл' || to === 'ml')) return q * 1000;
    return q;
}

async function computeVirtualStock({ warehouseId } = {}) {
    const state = await ensureState();
    const wh = Number(warehouseId) || 0;
    const products = Array.isArray(state.products) ? state.products : [];
    const recipes = Array.isArray(state.recipes) ? state.recipes : [];
    const balances = Array.isArray(state.stockBalances) ? state.stockBalances : [];

    const stockSum = new Map();
    balances
        .filter((b) => !wh || Number(b.warehouseId) === wh)
        .forEach((b) => {
            const key = String(b.productId);
            stockSum.set(key, (stockSum.get(key) || 0) + (Number(b.quantity) || 0));
        });

    const out = [];
    for (const recipe of recipes) {
        const dishId = recipe.dishId;
        const dish = products.find((p) => Number(p.id) === Number(dishId)) || {};
        const lines = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
        const limits = [];
        let minPossible = Infinity;
        for (const ing of lines) {
            const ingId = Number(ing.id);
            const ingProduct = products.find((p) => Number(p.id) === ingId) || {};
            const baseUnit = ingProduct.baseUnit || 'шт';
            const requiredBase = convertQty(ing.qty, ing.unit, baseUnit);
            const availableBase = stockSum.get(String(ingId)) || 0;
            const possible = requiredBase > 0 ? Math.floor(availableBase / requiredBase) : 0;
            if (possible < minPossible) minPossible = possible;
            limits.push({
                ingredient_product_id: ingId,
                required_qty: ing.qty,
                required_unit: ing.unit,
                available_base: availableBase,
                base_type: baseUnit,
                possible
            });
        }
        if (!Number.isFinite(minPossible)) minPossible = 0;
        out.push({
            dish_product_id: dishId,
            dish_name: dish.name || recipe.dishName || String(dishId),
            virtual_available: minPossible,
            limits
        });
    }
    return out;
}

function normalizeProductPayload(payload = {}) {
    const id = payload.id || Date.now();
    const price = Number(payload.price) || 0;
    const salePrice = Number(payload.salePrice || payload.price) || 0;
    return {
        id,
        code: payload.code || `PRD-${id}`,
        name: payload.name || `Без названия ${id}`,
        type: payload.type || 'ingredient',
        category: payload.category || 'Другое',
        baseUnit: payload.baseUnit || 'шт',
        isAlcohol: Boolean(payload.isAlcohol),
        alcoholStrength: payload.alcoholStrength || null,
        minStock: Number(payload.minStock) || 0,
        currentStock: Number(payload.currentStock) || 0,
        price,
        salePrice,
        description: payload.description || '',
        picture: payload.picture || '',
        image_url: payload.image_url || payload.picture || '',
        url: payload.url || '',
        visible_on_site: payload.visible_on_site !== false
    };
}

async function createProduct(payload = {}) {
    const state = await ensureState();
    const product = normalizeProductPayload(payload);
    state.products = Array.isArray(state.products) ? state.products : [];
    state.products.push(product);
    await saveState(state);
    return product;
}

async function updateProduct(productId, changes = {}) {
    const state = await ensureState();
    const products = Array.isArray(state.products) ? state.products : [];
    const targetId = String(productId);
    const index = products.findIndex((item) => String(item.id) === targetId);
    if (index === -1) {
        throw new Error('Товар не найден');
    }
    const updated = {
        ...products[index],
        ...changes,
        id: products[index].id
    };
    products[index] = normalizeProductPayload(updated);
    state.products = products;
    await saveState(state);
    return products[index];
}

async function publishMenu(productIds = []) {
    const products = await listProducts();
    let selected = products;
    if (Array.isArray(productIds) && productIds.length) {
        const idsSet = new Set(productIds.map((id) => String(id)));
        selected = products.filter((item) => idsSet.has(String(item.id)));
    }
    const offers = selected.map((product) => ({
        id: product.id,
        code: product.code,
        name: product.name,
        category_name: product.category || 'Другое',
        price: Number(product.salePrice || product.price || 0),
        description: product.description || '',
        picture: product.picture || product.image_url || '',
        url: product.url || '',
        ingredients_cost: Number(product.price) || 0,
        base_unit: product.baseUnit || 'шт'
    }));
    const categories = Array.from(
        new Set(offers.map((item) => item.category_name || 'Другое'))
    ).map((name, index) => ({
        id: index + 1,
        name
    }));
    const payload = {
        generated_from: 'inventory',
        updated_at: new Date().toISOString(),
        offers,
        categories
    };
    await fs.writeJson(MENU_FILE, payload, { spaces: 2 });
    return { count: offers.length, file: MENU_FILE };
}

module.exports = {
    getState,
    getKey,
    setKey,
    listProducts,
    listWarehouses,
    listStockItems,
    listExpiringItems,
    receiveStock,
    writeoffStock,
    transferStock,
    computeVirtualStock,
    createProduct,
    updateProduct,
    publishMenu
};

