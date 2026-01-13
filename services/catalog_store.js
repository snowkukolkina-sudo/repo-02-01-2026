const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const { parse: parseCsv } = require('csv-parse/sync');
const yaml = require('js-yaml');
const integrationBus = require('./integration_bus');
const loyaltyStore = require('./loyalty_store');
const https = require('https');
const http = require('http');

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'catalog');
const PRODUCTS_FILE = path.join(STORAGE_DIR, 'products.json');
const CATEGORIES_FILE = path.join(STORAGE_DIR, 'categories.json');
const MODIFIERS_FILE = path.join(STORAGE_DIR, 'modifiers.json');
const HISTORY_FILE = path.join(STORAGE_DIR, 'history.jsonl');
const SYNC_STATUS_FILE = path.join(STORAGE_DIR, 'sync-status.json');
const DRAFTS_FILE = path.join(STORAGE_DIR, 'drafts.json');
const PARAMETER_PRESETS_FILE = path.join(STORAGE_DIR, 'parameter-presets.json');
const JOBS_FILE = path.join(STORAGE_DIR, 'jobs.json');
const EXPORTS_DIR = path.join(STORAGE_DIR, 'exports');

const DEFAULT_PRODUCTS = [
    {
        internal_id: 'prd-sample-1',
        type: 'product',
        name: 'Пицца Маргарита',
        sku: 'PIZZA-MARG',
        barcode: '4607001234567',
        categories: ['pizza'],
        unit: 'шт',
        price_type: 'fixed',
        purchase_price: 200,
        price: 500,
        old_price: null,
        tax_system: 'osn',
        vat_rate: '20%',
        quantity: 32,
        min_stock: 2,
        min_order_qty: 1,
        weight: 0.45,
        dimensions: { length: 33, width: 33, height: 4 },
        shelf_life: null,
        origin_country: 'Россия',
        manufacturer: 'DANDY',
        composition: 'Тесто, соус, сыр',
        short_description: 'Классическая пицца',
        description: 'Сочная пицца Маргарита с соусом и сыром',
        description_url: '',
        forbid_discounts: false,
        forbid_loyalty: false,
        is_visible: true,
        images: [
            {
                id: 'img-1',
                url: '/assets/products/pizza-margarita.jpg',
                role: 'primary',
                alt_text: 'Пицца Маргарита',
                effects: { zoom: false, tint: null, overlayText: null, clickAction: 'lightbox' }
            }
        ],
        variations: [],
        modifiers: [],
        related_products: [],
        custom_attributes: [],
        external_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }
];

const DEFAULT_CATEGORIES = [
    { id: 'pizza', name: 'Пицца', parent_id: null, position: 1 },
    { id: 'sushi', name: 'Роллы', parent_id: null, position: 2 },
    { id: 'drinks', name: 'Напитки', parent_id: null, position: 3 }
];

const DEFAULT_MODIFIERS = [
    {
        group_id: 'mods-sauces',
        group_name: 'Соусы',
        multi_select: true,
        min_select: 0,
        max_select: 3,
        options: [
            { id: 'sauce-garlic', name: 'Соус чесночный', type: 'checkbox', price: 29, default_active: false, image_url: null, description: null },
            { id: 'sauce-bbq', name: 'Соус BBQ', type: 'checkbox', price: 29, default_active: false, image_url: null, description: null }
        ]
    }
];

const DEFAULT_PARAMETER_PRESETS = [];

class ValidationError extends Error {
    constructor(message, details = [], status = 400) {
        super(message);
        this.name = 'ValidationError';
        this.details = Array.isArray(details) ? details : [details];
        this.status = status;
    }
}

async function ensureStorage() {
    await fs.ensureDir(STORAGE_DIR);
    if (!(await fs.pathExists(PRODUCTS_FILE))) {
        await fs.writeJson(PRODUCTS_FILE, DEFAULT_PRODUCTS, { spaces: 2 });
    }
    if (!(await fs.pathExists(CATEGORIES_FILE))) {
        await fs.writeJson(CATEGORIES_FILE, DEFAULT_CATEGORIES, { spaces: 2 });
    }
    if (!(await fs.pathExists(MODIFIERS_FILE))) {
        await fs.writeJson(MODIFIERS_FILE, DEFAULT_MODIFIERS, { spaces: 2 });
    }
    if (!(await fs.pathExists(HISTORY_FILE))) {
        await fs.writeFile(HISTORY_FILE, '', 'utf8');
    }
    if (!(await fs.pathExists(SYNC_STATUS_FILE))) {
        await fs.writeJson(SYNC_STATUS_FILE, {}, { spaces: 2 });
    }
    if (!(await fs.pathExists(DRAFTS_FILE))) {
        await fs.writeJson(DRAFTS_FILE, [], { spaces: 2 });
    }
    if (!(await fs.pathExists(PARAMETER_PRESETS_FILE))) {
        await fs.writeJson(PARAMETER_PRESETS_FILE, DEFAULT_PARAMETER_PRESETS, { spaces: 2 });
    }
    if (!(await fs.pathExists(JOBS_FILE))) {
        await fs.writeJson(JOBS_FILE, [], { spaces: 2 });
    }
    await fs.ensureDir(EXPORTS_DIR);
}

async function readJson(filePath, fallback) {
    await ensureStorage();
    const exists = await fs.pathExists(filePath);
    if (!exists) {
        return fallback;
    }
    return fs.readJson(filePath);
}

async function writeJson(filePath, data) {
    await ensureStorage();
    await fs.writeJson(filePath, data, { spaces: 2 });
}

async function readProducts() {
    return readJson(PRODUCTS_FILE, []);
}

async function writeProducts(products) {
    return writeJson(PRODUCTS_FILE, products);
}

async function readCategories() {
    return readJson(CATEGORIES_FILE, []);
}

async function writeCategories(categories) {
    return writeJson(CATEGORIES_FILE, categories);
}

async function readModifiers() {
    return readJson(MODIFIERS_FILE, []);
}

async function writeModifiers(modifiers) {
    return writeJson(MODIFIERS_FILE, modifiers);
}

async function appendHistory(entry) {
    await ensureStorage();
    const payload = { id: `hist_${Date.now()}`, timestamp: new Date().toISOString(), ...entry };
    await fs.appendFile(HISTORY_FILE, JSON.stringify(payload) + '\n', 'utf8');
    return payload;
}

async function readHistoryEntries() {
    await ensureStorage();
    try {
        const content = await fs.readFile(HISTORY_FILE, 'utf8');
        if (!content.trim()) return [];
        return content
            .trim()
            .split('\n')
            .map((line) => {
                try {
                    return JSON.parse(line);
                } catch (_) {
                    return null;
                }
            })
            .filter(Boolean);
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
}

async function readSyncStatusMap() {
    await ensureStorage();
    try {
        const data = await fs.readFile(SYNC_STATUS_FILE, 'utf8');
        return JSON.parse(data || '{}');
    } catch (error) {
        if (error.code === 'ENOENT') return {};
        throw error;
    }
}

async function writeSyncStatusMap(map) {
    await ensureStorage();
    await fs.writeFile(SYNC_STATUS_FILE, JSON.stringify(map, null, 2), 'utf8');
}

async function readDrafts() {
    return readJson(DRAFTS_FILE, []);
}

async function writeDrafts(drafts) {
    return writeJson(DRAFTS_FILE, drafts);
}

async function readParameterPresets() {
    return readJson(PARAMETER_PRESETS_FILE, []);
}

async function writeParameterPresets(presets) {
    return writeJson(PARAMETER_PRESETS_FILE, presets);
}

async function readJobs() {
    return readJson(JOBS_FILE, []);
}

async function writeJobs(jobs) {
    return writeJson(JOBS_FILE, jobs);
}

async function markSyncPending(productIds, targets = ['pos', 'mobile'], actor = 'system') {
    const ids = Array.isArray(productIds) ? productIds : [productIds];
    const filteredIds = ids.filter(Boolean);
    if (!filteredIds.length) return {};
    const timestamp = new Date().toISOString();
    const statusMap = await readSyncStatusMap();
    const syncRecords = [];
    filteredIds.forEach((id) => {
        statusMap[id] = statusMap[id] || {};
        const targetList =
            Array.isArray(targets) && targets.length
                ? targets
                : Object.keys(statusMap[id]).length
                ? Object.keys(statusMap[id])
                : ['pos', 'mobile'];
        targetList.forEach((target) => {
            statusMap[id][target] = {
                state: 'pending',
                updated_at: timestamp,
                actor
            };
        });
        syncRecords.push({ id, targets: targetList });
    });
    await writeSyncStatusMap(statusMap);
    await Promise.all(
        syncRecords.map((record) =>
            Promise.all([
                integrationBus.recordCatalogSync(record.id, record.targets),
                integrationBus.recordMarketplaceTask(record.id, ['wb', 'ozon'])
            ])
        )
    );
    return statusMap;
}

async function clearSyncStatus(productId) {
    if (!productId) return;
    const statusMap = await readSyncStatusMap();
    if (statusMap[productId]) {
        delete statusMap[productId];
        await writeSyncStatusMap(statusMap);
    }
}

const MAJOR_ACTIONS = new Set([
    'create',
    'update',
    'patch',
    'bulk_patch',
    'import',
    'restore',
    'delete'
]);

function withHistoryMeta(entry) {
    if (!entry) return entry;
    const diffKeys =
        entry.diff && typeof entry.diff === 'object' ? Object.keys(entry.diff).length : 0;
    return {
        ...entry,
        is_major: MAJOR_ACTIONS.has(entry.action || 'update'),
        diff_fields: diffKeys
    };
}

async function listHistory(productId, limit = 10, majorLimit = 3) {
    const entries = await readHistoryEntries();
    const items = [];
    const majors = [];
    for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        if (!productId || entry.product_id === productId) {
            const normalized = withHistoryMeta(entry);
            if (items.length < limit) {
                items.push(normalized);
            }
            if (
                normalized.is_major &&
                majors.length < majorLimit &&
                !majors.find((item) => item.id === normalized.id)
            ) {
                majors.push(normalized);
            }
            if (items.length >= limit && majors.length >= majorLimit) {
                break;
            }
        }
    }
    return {
        entries: items,
        majors
    };
}

function normalizeSnapshotValue(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    return JSON.parse(JSON.stringify(value));
}

function snapshotsEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

function summarizeHistoryEntry(entry) {
    return {
        id: entry.id,
        action: entry.action,
        actor: entry.actor,
        timestamp: entry.timestamp
    };
}

async function compareHistoryEntries(productId, leftId, rightId) {
    if (!productId || !leftId || !rightId) {
        throw new ValidationError('Не указаны карточка и сравниваемые версии');
    }
    if (leftId === rightId) {
        throw new ValidationError('Нужно выбрать две разные версии');
    }
    const entries = await readHistoryEntries();
    const left = entries.find((entry) => entry.id === leftId && entry.product_id === productId);
    const right = entries.find((entry) => entry.id === rightId && entry.product_id === productId);
    if (!left || !right) {
        throw new ValidationError('Версия не найдена', [], 404);
    }
    if (!left.snapshot || !right.snapshot) {
        throw new ValidationError('Снимки версий недоступны для сравнения');
    }
    const changes = [];
    const keys = new Set([
        ...Object.keys(left.snapshot || {}),
        ...Object.keys(right.snapshot || {})
    ]);
    keys.forEach((key) => {
        if (['updated_at', 'created_at'].includes(key)) return;
        const fromValue = normalizeSnapshotValue(left.snapshot[key]);
        const toValue = normalizeSnapshotValue(right.snapshot[key]);
        if (!snapshotsEqual(fromValue, toValue)) {
            changes.push({
                field: key,
                from: fromValue,
                to: toValue
            });
        }
    });
    return {
        product_id: productId,
        left: summarizeHistoryEntry(left),
        right: summarizeHistoryEntry(right),
        changes,
        changed_fields: changes.length
    };
}

async function recordSyncEvent(productId, targets = [], actor = 'system') {
    if (!productId) {
        throw new ValidationError('Не указан товар для синхронизации');
    }
    const normalizedTargets = Array.isArray(targets) ? targets : [];
    const timestamp = new Date().toISOString();
    await appendHistory({
        product_id: productId,
        action: 'sync',
        actor,
        targets: normalizedTargets,
        timestamp
    });
    const statusMap = await readSyncStatusMap();
    statusMap[productId] = statusMap[productId] || {};
    normalizedTargets.forEach((target) => {
        statusMap[productId][target] = {
            state: 'synced',
            updated_at: timestamp,
            actor
        };
    });
    await writeSyncStatusMap(statusMap);
    await integrationBus.recordCatalogSync(productId, normalizedTargets);
    await integrationBus.recordNotification('sync', 'Запущена ручная синхронизация', {
        product_id: productId,
        targets: normalizedTargets,
        actor
    });
    return {
        product_id: productId,
        synced: normalizedTargets.map((target) => ({
            target,
            state: statusMap[productId][target].state,
            updated_at: timestamp
        }))
    };
}

async function getSyncStatus(productId) {
    if (!productId) return {};
    const map = await readSyncStatusMap();
    return map[productId] || {};
}

async function listSyncStatuses(ids = []) {
    const map = await readSyncStatusMap();
    if (!ids || !ids.length) return map;
    const result = {};
    ids.forEach((id) => {
        if (map[id]) result[id] = map[id];
    });
    return result;
}

async function saveDraftVersion({ draftId, productId = null, payload = {}, actor = 'system' }) {
    if (!draftId) {
        throw new ValidationError('Не указан идентификатор черновика');
    }
    const drafts = await readDrafts();
    const entry = {
        draft_id: draftId,
        product_id: productId || null,
        payload,
        saved_by: actor,
        saved_at: new Date().toISOString()
    };
    const index = drafts.findIndex((item) => item.draft_id === draftId);
    if (index === -1) {
        drafts.push(entry);
    } else {
        drafts[index] = entry;
    }
    await writeDrafts(drafts);
    return entry;
}

async function getDraftVersion({ draftId, productId }) {
    if (!draftId && !productId) return null;
    const drafts = await readDrafts();
    if (draftId) {
        return drafts.find((item) => item.draft_id === draftId) || null;
    }
    if (productId) {
        return drafts.find((item) => item.product_id === productId) || null;
    }
    return null;
}

async function deleteDraftVersion({ draftId, productId }) {
    if (!draftId && !productId) return { deleted: 0 };
    const drafts = await readDrafts();
    const next = drafts.filter((item) => {
        const matchesDraft = draftId && item.draft_id === draftId;
        const matchesProduct = productId && item.product_id === productId;
        return !(matchesDraft || matchesProduct);
    });
    if (next.length !== drafts.length) {
        await writeDrafts(next);
    }
    return { deleted: drafts.length - next.length };
}

function normalizeParameterPreset(payload = {}) {
    const id = payload.id || payload.preset_id || `preset_${Date.now()}`;
    const name = sanitizeString(payload.name || 'Новый пресет', { max: 128 });
    const rawParameters = Array.isArray(payload.parameters) ? payload.parameters : [];
    const parameters = rawParameters
        .slice(0, 5)
        .map((param) => {
            const paramName = sanitizeString(param.name || '', { max: 64 });
            const values = Array.isArray(param.values) ? param.values : [];
            const normalizedValues = values
                .map((value) => sanitizeString(value || '', { max: 64 }))
                .filter(Boolean)
                .slice(0, 20);
            return {
                name: paramName,
                values: normalizedValues
            };
        })
        .filter((param) => param.name && param.values.length);
    return {
        id,
        name,
        parameters
    };
}

async function listParameterPresets() {
    const presets = await readParameterPresets();
    return presets;
}

async function upsertParameterPreset(payload = {}) {
    const presets = await readParameterPresets();
    const preset = normalizeParameterPreset(payload);
    const index = presets.findIndex((item) => item.id === preset.id);
    if (index === -1) {
        presets.push(preset);
    } else {
        presets[index] = preset;
    }
    await writeParameterPresets(presets);
    return preset;
}

async function deleteParameterPreset(id) {
    if (!id) {
        throw new ValidationError('Не указан пресет для удаления');
    }
    const presets = await readParameterPresets();
    const next = presets.filter((item) => item.id !== id);
    if (next.length === presets.length) {
        throw new ValidationError('Пресет не найден', [], 404);
    }
    await writeParameterPresets(next);
    return { deleted: 1 };
}

async function createJob(type, payload = {}) {
    const jobs = await readJobs();
    const job = {
        id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type,
        status: 'pending',
        progress: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        payload,
        result: null,
        error: null
    };
    jobs.push(job);
    await writeJobs(jobs);
    return job;
}

async function updateJob(jobId, patch = {}) {
    const jobs = await readJobs();
    const index = jobs.findIndex((job) => job.id === jobId);
    if (index === -1) {
        throw new ValidationError('Задание не найдено', [], 404);
    }
    jobs[index] = {
        ...jobs[index],
        ...patch,
        updated_at: new Date().toISOString()
    };
    await writeJobs(jobs);
    return jobs[index];
}

async function getJob(jobId) {
    const jobs = await readJobs();
    return jobs.find((job) => job.id === jobId) || null;
}

async function processImportJob(jobId, { buffer, format, mode = 'upsert', actor = 'system', importHidden = false }) {
    try {
        await updateJob(jobId, { status: 'processing', progress: 1 });
    } catch (_) {
        // job removed meanwhile
    }
    try {
        const records = parseImportBuffer(buffer, format);
        if (!Array.isArray(records) || !records.length) {
            throw new ValidationError('Файл не содержит записей');
        }
        const total = records.length;
        const products = await readProducts();
        const stats = { created: 0, updated: 0, skipped: 0, errors: [] };
        const touchedIds = new Set();
        const touchedProducts = [];

        for (let index = 0; index < records.length; index += 1) {
            const raw = records[index];
            try {
                const mappedPayload = convertImportRecord(raw);

                // Если в записи есть модификаторы/допы — убедимся, что они сохранены в глобальном списке модификаторов
                if (Array.isArray(mappedPayload.modifiers) && mappedPayload.modifiers.length > 0) {
                    const persisted = [];
                    for (const grp of mappedPayload.modifiers) {
                        try {
                            const upserted = await upsertModifierGroup(grp);
                            if (upserted) persisted.push(upserted);
                        } catch (e) {
                            // не критично для импорта — логируем в статистику
                            stats.errors.push({ modifier_group: grp.group_name || grp.name || grp.group_id || 'unknown', error: e.message });
                        }
                    }
                    // Заменяем модификаторы в payload на актуальные (с group_id и опциями)
                    mappedPayload.modifiers = persisted;
                }
                // Если есть изображения — попробуем скачать внешние URL и нормализовать
                if (Array.isArray(mappedPayload.images) && mappedPayload.images.length > 0) {
                    const imgs = [];
                    for (let i = 0; i < mappedPayload.images.length; i += 1) {
                        const rawImg = mappedPayload.images[i];
                        const src = typeof rawImg === 'string' ? rawImg : (rawImg && (rawImg.url || rawImg.path));
                        if (src && /^https?:\/\//i.test(src)) {
                            try {
                                const downloaded = await downloadAndNormalizeImage(src, i);
                                if (downloaded) {
                                    imgs.push({
                                        id: downloaded.id,
                                        url: downloaded.url,
                                        role: (rawImg && rawImg.role) || downloaded.role,
                                        alt_text: (rawImg && rawImg.alt_text) || null,
                                        order: downloaded.order
                                    });
                                    continue;
                                }
                            } catch (e) {
                                stats.errors.push({ image: src, error: e.message });
                            }
                        }
                        imgs.push(typeof rawImg === 'object' ? normalizeImage(rawImg, i) : normalizeImage({ url: src }, i));
                    }
                    mappedPayload.images = imgs.filter(Boolean).slice(0, 12);
                }
                const existingIndex = mappedPayload.internal_id
                    ? products.findIndex((product) => product.internal_id === mappedPayload.internal_id)
                    : products.findIndex((product) => product.sku && product.sku === mappedPayload.sku);
                if (existingIndex === -1) {
                    const created = mapProductPayload(mappedPayload);
                    if (importHidden) {
                        created.is_visible = false;
                    }
                    const { valid, errors } = validateProduct(created);
                    if (!valid) {
                        stats.errors.push({ sku: created.sku, errors });
                        stats.skipped += 1;
                        continue;
                    }
                    enforceUnique(products, created);
                    products.push(created);
                    touchedIds.add(created.internal_id);
                    touchedProducts.push({ product: created, action: 'import_create' });
                    stats.created += 1;
                } else if (mode !== 'append') {
                    const updated = mapProductPayload(mappedPayload, { existing: products[existingIndex] });
                    if (importHidden) {
                        updated.is_visible = false;
                    }
                    const { valid, errors } = validateProduct(updated);
                    if (!valid) {
                        stats.errors.push({ sku: updated.sku, errors });
                        stats.skipped += 1;
                        continue;
                    }
                    enforceUnique(products, updated, updated.internal_id);
                    products[existingIndex] = updated;
                    touchedIds.add(updated.internal_id);
                    touchedProducts.push({ product: updated, action: 'import_update' });
                    stats.updated += 1;
                } else {
                    stats.skipped += 1;
                }
            } catch (error) {
                stats.errors.push({ sku: raw?.sku || raw?.name, error: error.message });
                stats.skipped += 1;
            }

            if (index % 5 === 0 || index === total - 1) {
                const progress = Math.min(99, Math.round(((index + 1) / total) * 100));
                await updateJob(jobId, {
                    progress,
                    meta: {
                        total,
                        processed: index + 1
                    }
                }).catch(() => {});
            }
        }

        await writeProducts(products);
        await appendHistory({ action: 'import', actor, diff: { stats } });
        if (touchedIds.size) {
            await markSyncPending(Array.from(touchedIds), ['pos', 'mobile'], actor);
            await Promise.all(
                touchedProducts.map(({ product, action }) =>
                    integrationBus.recordProductUpdate(product, action, { job_id: jobId })
                )
            );
        }

        await updateJob(jobId, {
            status: 'completed',
            progress: 100,
            result: { stats }
        });
        await integrationBus.recordNotification('import', 'Импорт завершён', {
            stats,
            job_id: jobId
        });
    } catch (error) {
        await updateJob(jobId, {
            status: 'failed',
            progress: 100,
            error: error.message || 'Ошибка импорта'
        }).catch(() => {});
        await integrationBus.recordNotification('import', 'Импорт завершился с ошибкой', {
            job_id: jobId,
            error: error.message
        });
    }
}

async function processExportJob(jobId, { format = 'csv' }) {
    try {
        await updateJob(jobId, { status: 'processing', progress: 10 });
    } catch (_) {
        return;
    }
    try {
        const exportPayload = await exportProducts(format);
        const filePath = path.join(EXPORTS_DIR, `${jobId}.${exportPayload.extension}`);
        await fs.writeFile(filePath, exportPayload.content, 'utf8');
        await updateJob(jobId, {
            status: 'completed',
            progress: 100,
            result: {
                format: exportPayload.extension,
                mime: exportPayload.mime,
                file_path: filePath
            }
        });
        await integrationBus.recordNotification('export', 'Экспорт готов', {
            job_id: jobId,
            format: exportPayload.extension,
            path: filePath
        });
    } catch (error) {
        await updateJob(jobId, {
            status: 'failed',
            progress: 100,
            error: error.message || 'Ошибка экспорта'
        }).catch(() => {});
        await integrationBus.recordNotification('export', 'Экспорт завершился с ошибкой', {
            job_id: jobId,
            error: error.message
        });
    }
}

async function listIntegrationEvents(limit = 50) {
    return integrationBus.listEvents(limit);
}

async function restoreHistoryEntry(productId, entryId, actor = 'system') {
    if (!productId || !entryId) {
        throw new ValidationError('Необходимо указать карточку и запись истории');
    }
    const entries = await readHistoryEntries();
    const entry = entries.find((item) => item.id === entryId && item.product_id === productId);
    if (!entry || !entry.snapshot) {
        throw new ValidationError('Снимок истории не найден для восстановления');
    }
    const products = await readProducts();
    const index = products.findIndex((product) => product.internal_id === productId);
    if (index === -1) {
        throw new ValidationError('Карточка не найдена', [], 404);
    }
    const restored = mapProductPayload(entry.snapshot, { existing: products[index] });
    products[index] = restored;
    await writeProducts(products);
    await appendHistory({
        product_id: productId,
        action: 'restore',
        actor,
        source_entry: entryId,
        diff: entry.diff || null,
        snapshot: restored
    });
    await markSyncPending(productId, ['pos', 'mobile'], actor);
    return restored;
}

function parseNumber(value, opts = {}) {
    if (value === null || value === undefined || value === '') return opts.default ?? null;
    const num = Number(value);
    if (Number.isNaN(num)) return opts.default ?? null;
    if (opts.min !== undefined && num < opts.min) return opts.min;
    if (opts.max !== undefined && num > opts.max) return opts.max;
    return Number(num);
}

function sanitizeString(value, opts = {}) {
    if (typeof value !== 'string') return opts.default ?? '';
    let result = value.trim();
    if (opts.max && result.length > opts.max) {
        result = result.slice(0, opts.max);
    }
    if (opts.noHtml) {
        result = result.replace(/<[^>]*>?/gm, '');
    }
    return result;
}

function ensureArray(value) {
    if (Array.isArray(value)) return value;
    if (value === null || value === undefined) return [];
    return [value];
}

function normalizeDimensions(source) {
    if (!source || typeof source !== 'object') {
        return { length: null, width: null, height: null };
    }
    return {
        length: parseNumber(source.length, { default: null }),
        width: parseNumber(source.width, { default: null }),
        height: parseNumber(source.height, { default: null })
    };
}

function normalizeImage(image, index = 0) {
    if (!image || typeof image !== 'object') return null;
    return {
        id: image.id || `img-${Date.now()}-${index}`,
        url: sanitizeString(image.url || image.path || '', { max: 512 }),
        role: image.role || (index === 0 ? 'primary' : index === 1 ? 'hover' : 'gallery'),
        alt_text: sanitizeString(image.alt_text || '', { max: 250 }),
        effects: {
            zoom: Boolean(image?.effects?.zoom),
            tint: image?.effects?.tint || null,
            overlayText: sanitizeString(image?.effects?.overlayText || '', { max: 140 }),
            clickAction: image?.effects?.clickAction || 'lightbox'
        },
        order: typeof image.order === 'number' ? image.order : index
    };
}

async function downloadAndNormalizeImage(imageUrl, index = 0) {
    if (!imageUrl || typeof imageUrl !== 'string') return null;
    if (!/^https?:\/\//i.test(imageUrl)) return null;
    try {
        const urlObj = new URL(imageUrl);
        const ext = path.extname(urlObj.pathname) || '.jpg';
        const id = `img-${uuidv4().slice(0, 8)}`;
        const filename = `${id}${ext}`;
        const destDir = path.join(STORAGE_DIR, 'images');
        await fs.ensureDir(destDir);
        const destPath = path.join(destDir, filename);

        await new Promise((resolve, reject) => {
            const client = imageUrl.startsWith('https') ? https : http;
            const req = client.get(imageUrl, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    // follow redirect
                    return resolve(downloadAndNormalizeImage(res.headers.location, index));
                }
                if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
                const fileStream = fs.createWriteStream(destPath);
                res.pipe(fileStream);
                fileStream.on('finish', () => fileStream.close(resolve));
                fileStream.on('error', reject);
            });
            req.on('error', reject);
            req.setTimeout(20000, () => {
                req.abort();
                reject(new Error('Timeout')); 
            });
        });

        return {
            id,
            url: `/storage/catalog/images/${filename}`,
            role: index === 0 ? 'primary' : index === 1 ? 'hover' : 'gallery',
            alt_text: null,
            order: index
        };
    } catch (e) {
        console.warn('downloadAndNormalizeImage failed for', imageUrl, e && e.message);
        return null;
    }
}

function normalizeVariation(variation) {
    if (!variation || typeof variation !== 'object') return null;
    return {
        variant_id: variation.variant_id || uuidv4(),
        parent_id: variation.parent_id || null,
        sku: sanitizeString(variation.sku || '', { max: 50 }),
        price: parseNumber(variation.price, { default: null, min: 0 }),
        old_price: parseNumber(variation.old_price, { default: null, min: 0 }),
        quantity: parseNumber(variation.quantity, { default: 0, min: 0 }),
        weight: parseNumber(variation.weight, { default: null, min: 0 }),
        dimensions: normalizeDimensions(variation.dimensions),
        parameters: Array.isArray(variation.parameters)
            ? variation.parameters.slice(0, 5).map((param) => ({
                  name: sanitizeString(param.name || '', { max: 64 }),
                  value: sanitizeString(param.value || '', { max: 64 }),
                  display: param.display || 'list'
              }))
            : [],
        images: ensureArray(variation.images)
            .map(normalizeImage)
            .filter(Boolean)
            .slice(0, 8)
    };
}

function normalizeModifierGroup(group) {
    if (!group || typeof group !== 'object') return null;
    return {
        group_id: group.group_id || group.id || `mod-${Date.now()}`,
        group_name: sanitizeString(group.group_name || group.name || 'Новая группа', { max: 128 }),
        multi_select: Boolean(group.multi_select),
        min_select: parseNumber(group.min_select, { default: 0, min: 0 }),
        max_select: parseNumber(group.max_select, { default: null, min: 0 }),
        is_visible: Boolean(group.is_visible ?? true),
        show_in_product_card: Boolean(group.show_in_product_card ?? true),
        category_ids: ensureArray(group.category_ids)
            .filter((id) => id !== null && id !== undefined && id !== '')
            .slice(0, 50),
        options: ensureArray(group.options)
            .slice(0, 50)
            .map((option, idx) => ({
                id: option.id || option.option_id || `opt-${Date.now()}-${idx}`,
                name: sanitizeString(option.name || 'Опция', { max: 128 }),
                type: option.type || 'checkbox',
                price: parseNumber(option.price, { default: 0, min: 0 }),
                default_active: Boolean(option.default_active),
                is_visible: Boolean(option.is_visible ?? true),
                show_in_product_card: Boolean(option.show_in_product_card ?? true),
                category_ids: ensureArray(option.category_ids)
                    .filter((id) => id !== null && id !== undefined && id !== '')
                    .slice(0, 50),
                image_url: sanitizeString(option.image_url || '', { max: 512 }),
                description: sanitizeString(option.description || '', { max: 256 })
            }))
    };
}

function normalizeRelatedProducts(list) {
    return ensureArray(list)
        .filter(Boolean)
        .slice(0, 20)
        .map((id, idx) => ({
            product_id: typeof id === 'string' ? id : id?.product_id,
            position: idx
        }))
        .filter((item) => item.product_id);
}

function mapProductPayload(payload = {}, { existing } = {}) {
    const base = existing
        ? { ...existing }
        : {
              internal_id: uuidv4(),
              created_at: new Date().toISOString()
          };

    const product = {
        ...base,
        display_only: Boolean(payload.display_only ?? base.display_only ?? false),
        parent_id: payload.parent_id ?? base.parent_id ?? null,
        size_label: sanitizeString(payload.size_label || base.size_label || '', { max: 50 }) || null,
        diameter: payload.diameter !== undefined
            ? parseNumber(payload.diameter, { default: null, min: 0 })
            : (base.diameter ?? null),
        recipe_coefficient: payload.recipe_coefficient !== undefined
            ? parseNumber(payload.recipe_coefficient, { default: 1, min: 0 })
            : (base.recipe_coefficient ?? 1),
        inventory_account: sanitizeString(payload.inventory_account || base.inventory_account || '', { max: 32 }) || null,
        type: payload.type || base.type || 'product',
        name: sanitizeString(payload.name || base.name || '', { max: 128 }),
        sku: sanitizeString(payload.sku || base.sku || '', { max: 50 }),
        barcode: sanitizeString(payload.barcode || base.barcode || '', { max: 64 }).replace(/\D/g, ''),
        categories: ensureArray(payload.categories || base.categories).slice(0, 10),
        unit: sanitizeString(payload.unit || base.unit || 'шт', { max: 32 }),
        price_type: payload.price_type || base.price_type || 'fixed',
        purchase_price: parseNumber(payload.purchase_price, { default: base.purchase_price ?? null, min: 0 }),
        price: parseNumber(payload.price, { default: base.price ?? 0, min: 0 }),
        old_price: parseNumber(payload.old_price, { default: base.old_price ?? null, min: 0 }),
        tax_system: payload.tax_system || base.tax_system || 'osn',
        vat_rate: payload.vat_rate || base.vat_rate || '20%',
        quantity: parseNumber(payload.quantity, { default: base.quantity ?? 0, min: 0 }),
        min_stock: parseNumber(payload.min_stock, { default: base.min_stock ?? 0, min: 0 }),
        min_order_qty: parseNumber(payload.min_order_qty, { default: base.min_order_qty ?? 1, min: 0 }),
        weight: parseNumber(payload.weight, { default: base.weight ?? null, min: 0 }),
        calories: payload.calories !== undefined
            ? (typeof payload.calories === 'number'
                ? payload.calories
                : (parseInt(payload.calories) || (base.calories ?? null)))
            : (base.calories ?? null),
        dimensions: normalizeDimensions(payload.dimensions || base.dimensions),
        shelf_life: payload.shelf_life || base.shelf_life || null,
        origin_country: sanitizeString(payload.origin_country || base.origin_country || '', { max: 64 }),
        manufacturer: sanitizeString(payload.manufacturer || base.manufacturer || '', { max: 128 }),
        composition: sanitizeString(payload.composition || base.composition || '', { max: 512 }),
        short_description: sanitizeString(payload.short_description || base.short_description || '', { max: 256 }),
        description: typeof payload.description === 'string' ? payload.description : base.description || '',
        description_url: sanitizeString(payload.description_url || base.description_url || '', { max: 256 }),
        forbid_discounts: Boolean(payload.forbid_discounts ?? base.forbid_discounts),
        forbid_loyalty: Boolean(payload.forbid_loyalty ?? base.forbid_loyalty),
        is_visible: Boolean(payload.is_visible ?? base.is_visible ?? true),
        images: ensureArray(payload.images || base.images)
            .map(normalizeImage)
            .filter(Boolean)
            .slice(0, 12),
        variations: ensureArray(payload.variations || base.variations)
            .map(normalizeVariation)
            .filter(Boolean)
            .slice(0, 200),
        modifiers: ensureArray(payload.modifiers || base.modifiers)
            .map(normalizeModifierGroup)
            .filter(Boolean)
            .slice(0, 10),
        related_products: normalizeRelatedProducts(payload.related_products || base.related_products),
        custom_attributes: ensureArray(payload.custom_attributes || base.custom_attributes)
            .slice(0, 50)
            .map((attr) => ({
                name: sanitizeString(attr.name || '', { max: 128 }),
                value: sanitizeString(attr.value || '', { max: 512 })
            }))
            .filter((attr) => attr.name),
        external_id: payload.external_id || base.external_id || null,
        updated_at: new Date().toISOString()
    };

    return product;
}

function validateProduct(product, { partial = false } = {}) {
    const errors = [];
    const requiredFields = ['name', 'type', 'price', 'tax_system', 'vat_rate'];

    if (!partial) {
        requiredFields.forEach((field) => {
            if (!product[field] && product[field] !== 0) {
                errors.push({ field, message: `Поле ${field} обязательно` });
            }
        });
    }

    if (product.name && product.name.length > 128) {
        errors.push({ field: 'name', message: 'Название не может превышать 128 символов' });
    }

    if (product.sku && product.sku.length > 50) {
        errors.push({ field: 'sku', message: 'SKU не может превышать 50 символов' });
    }

    if (product.barcode && /\D/.test(product.barcode)) {
        errors.push({ field: 'barcode', message: 'Штрих-код может содержать только цифры' });
    }

    if (product.variations && product.variations.length > 200) {
        errors.push({ field: 'variations', message: 'Не более 200 вариаций на карточку' });
    }

    if (product.display_only && product.parent_id) {
        errors.push({ field: 'display_only', message: 'Витринная карточка не может иметь parent_id' });
    }

    if (!product.display_only && product.parent_id === product.internal_id) {
        errors.push({ field: 'parent_id', message: 'parent_id не может ссылаться на саму карточку' });
    }

    const parameterCount = product.variations
        ? Math.max(
              0,
              ...product.variations.map((variation) => (Array.isArray(variation.parameters) ? variation.parameters.length : 0))
          )
        : 0;
    if (parameterCount > 5) {
        errors.push({ field: 'parameters', message: 'Допускается не более 5 параметров' });
    }

    if ((!product.images || !product.images.length) && !product.parent_id) {
        errors.push({ field: 'images', message: 'Добавьте хотя бы одно изображение' });
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

function enforceUnique(products, candidate, ignoreId) {
    if (candidate.sku) {
        const duplicate = products.find((item) => item.sku === candidate.sku && item.internal_id !== ignoreId);
        if (duplicate) {
            throw new ValidationError('SKU уже используется другим товаром', [{ field: 'sku' }]);
        }
    }
    if (candidate.barcode) {
        const duplicate = products.find((item) => item.barcode === candidate.barcode && item.internal_id !== ignoreId);
        if (duplicate) {
            throw new ValidationError('Штрих-код уже используется другим товаром', [{ field: 'barcode' }]);
        }
    }
}

function applyFilters(products, filters = {}) {
    let result = [...products];
    const search = (filters.search || '').toLowerCase().trim();
    if (search) {
        result = result.filter((product) => {
            const haystack = [product.name, product.sku, product.barcode].filter(Boolean).join(' ').toLowerCase();
            return haystack.includes(search);
        });
    }

    if (filters.category) {
        result = result.filter((product) => product.categories?.includes(filters.category));
    }

    if (filters.type) {
        result = result.filter((product) => product.type === filters.type);
    }

    if (filters.visible !== undefined && filters.visible !== null) {
        const visible = filters.visible === 'true' || filters.visible === true;
        result = result.filter((product) => product.is_visible === visible);
    }

    if (filters.display_only !== undefined && filters.display_only !== null) {
        const displayOnly = filters.display_only === 'true' || filters.display_only === true;
        result = result.filter((product) => Boolean(product.display_only) === displayOnly);
    }

    if (filters.parent_id !== undefined && filters.parent_id !== null) {
        const parentId = filters.parent_id === 'null' ? null : filters.parent_id;
        result = result.filter((product) => (product.parent_id ?? null) === parentId);
    }

    if (filters.has_barcode !== undefined) {
        const flag = filters.has_barcode === 'true' || filters.has_barcode === true;
        result = result.filter((product) => (flag ? Boolean(product.barcode) : !product.barcode));
    }

    if (filters.promo_restriction === 'discounts') {
        result = result.filter((product) => product.forbid_discounts);
    } else if (filters.promo_restriction === 'loyalty') {
        result = result.filter((product) => product.forbid_loyalty);
    }

    if (filters.stock === 'positive') {
        result = result.filter((product) => (product.quantity || 0) > 0);
    } else if (filters.stock === 'zero') {
        result = result.filter((product) => (product.quantity || 0) === 0);
    } else if (filters.stock === 'negative') {
        result = result.filter((product) => (product.quantity || 0) < 0);
    }

    return result;
}

function paginate(collection, { page = 1, limit = 25 } = {}) {
    const currentPage = Math.max(parseInt(page, 10) || 1, 1);
    const perPage = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 500);
    const start = (currentPage - 1) * perPage;
    const end = start + perPage;
    return {
        items: collection.slice(start, end),
        meta: {
            page: currentPage,
            limit: perPage,
            total: collection.length,
            pages: Math.ceil(collection.length / perPage)
        }
    };
}

async function listProducts(filters = {}) {
    const products = await readProducts();
    const filtered = applyFilters(products, filters);
    const sorted = filtered.sort((a, b) => {
        if (filters.sort === 'stock_asc') {
            return (a.quantity || 0) - (b.quantity || 0);
        }
        if (filters.sort === 'stock_desc') {
            return (b.quantity || 0) - (a.quantity || 0);
        }
        if (filters.sort === 'price_desc') {
            return (b.price || 0) - (a.price || 0);
        }
        if (filters.sort === 'price_asc') {
            return (a.price || 0) - (b.price || 0);
        }
        return a.name.localeCompare(b.name);
    });

    const paginated = paginate(sorted, filters);
    return {
        items: paginated.items,
        meta: paginated.meta
    };
}

async function getProductById(id) {
    if (!id) return null;
    const products = await readProducts();
    return (
        products.find((product) =>
            product.internal_id === id || product.sku === id || product.external_id === id || String(product.id) === String(id)
        ) || null
    );
}

async function createProduct(payload, actor = 'system') {
    const products = await readProducts();
    const product = mapProductPayload(payload);
    const { valid, errors } = validateProduct(product);
    if (!valid) {
        throw new ValidationError('Некорректные данные карточки', errors);
    }
    if (product.parent_id) {
        const parent = products.find((item) => item.internal_id === product.parent_id);
        if (!parent || !parent.display_only) {
            throw new ValidationError('parent_id должен ссылаться на витринную карточку', [
                { field: 'parent_id' }
            ]);
        }
        product.display_only = false;
    }
    enforceUnique(products, product);
    products.push(product);
    await writeProducts(products);
    await appendHistory({
        product_id: product.internal_id,
        action: 'create',
        actor,
        diff: product,
        snapshot: product
    });
    await markSyncPending(product.internal_id, ['pos', 'mobile'], actor);
    await integrationBus.recordProductUpdate(product, 'create');
    return product;
}

async function updateProduct(id, payload, actor = 'system') {
    const products = await readProducts();
    const index = products.findIndex((product) =>
        product.internal_id === id || product.sku === id || product.external_id === id || String(product.id) === String(id)
    );
    if (index === -1) {
        throw new ValidationError('Карточка не найдена', [], 404);
    }
    if (payload.barcode && payload.barcode !== products[index].barcode && products[index].has_sales) {
        throw new ValidationError('Штрих-код нельзя менять после продажи', [{ field: 'barcode' }], 409);
    }
    if (payload.parent_id && payload.parent_id !== products[index].parent_id) {
        const parent = products.find((item) => item.internal_id === payload.parent_id);
        if (!parent || !parent.display_only) {
            throw new ValidationError('parent_id должен ссылаться на витринную карточку', [
                { field: 'parent_id' }
            ]);
        }
    }
    const product = mapProductPayload(payload, { existing: products[index] });
    const { valid, errors } = validateProduct(product);
    if (!valid) {
        throw new ValidationError('Некорректные данные карточки', errors);
    }
    enforceUnique(products, product, id);
    products[index] = product;
    await writeProducts(products);
    await appendHistory({
        product_id: product.internal_id,
        action: 'update',
        actor,
        diff: payload,
        snapshot: product
    });
    await markSyncPending(product.internal_id, ['pos', 'mobile'], actor);
    await deleteDraftVersion({ draftId: id, productId: id });
    await integrationBus.recordProductUpdate(product, 'update');
    return product;
}

const PATCHABLE_FIELDS = new Set([
    'price',
    'old_price',
    'quantity',
    'min_stock',
    'min_order_qty',
    'is_visible',
    'forbid_discounts',
    'forbid_loyalty',
    'categories',
    'tax_system',
    'vat_rate'
]);

async function patchProduct(id, changes = {}, actor = 'system') {
    const products = await readProducts();
    const index = products.findIndex((product) =>
        product.internal_id === id || product.sku === id || product.external_id === id || String(product.id) === String(id)
    );
    if (index === -1) {
        throw new ValidationError('Карточка не найдена', [], 404);
    }
    const allowed = {};
    Object.keys(changes || {}).forEach((key) => {
        if (PATCHABLE_FIELDS.has(key)) {
            allowed[key] = changes[key];
        }
    });
    if (allowed.parent_id && allowed.parent_id !== products[index].parent_id) {
        const parent = products.find((item) => item.internal_id === allowed.parent_id);
        if (!parent || !parent.display_only) {
            throw new ValidationError('parent_id должен ссылаться на витринную карточку', [
                { field: 'parent_id' }
            ]);
        }
    }
    const patched = mapProductPayload(allowed, { existing: products[index] });
    const { valid, errors } = validateProduct(patched, { partial: false });
    if (!valid) {
        throw new ValidationError('Некорректные данные карточки', errors);
    }
    enforceUnique(products, patched, id);
    products[index] = patched;
    await writeProducts(products);
    await appendHistory({
        product_id: patched.internal_id,
        action: 'patch',
        actor,
        diff: allowed,
        snapshot: patched
    });
    await markSyncPending(patched.internal_id, ['pos', 'mobile'], actor);
    await deleteDraftVersion({ draftId: id, productId: id });
    await integrationBus.recordProductUpdate(patched, 'patch');
    return patched;
}

async function deleteProduct(id, actor = 'system') {
    const products = await readProducts();
    const index = products.findIndex((product) => product.internal_id === id);
    if (index === -1) {
        throw new ValidationError('Карточка не найдена', [], 404);
    }
    const [removed] = products.splice(index, 1);
    await writeProducts(products);
    await appendHistory({
        product_id: id,
        action: 'delete',
        actor,
        diff: removed,
        snapshot: removed
    });
    await clearSyncStatus(id);
    await deleteDraftVersion({ draftId: id, productId: id });
    await integrationBus.recordProductUpdate(removed, 'delete', { deleted: true });
    return { deleted: true };
}

async function bulkUpdate(ids = [], changes = {}, actor = 'system') {
    if (!Array.isArray(ids) || !ids.length) {
        throw new ValidationError('Не переданы карточки для обновления');
    }
    const products = await readProducts();
    const allowedKeys = Object.keys(changes || {}).filter((key) => PATCHABLE_FIELDS.has(key));
    if (!allowedKeys.length) {
        throw new ValidationError('Нет поддерживаемых полей для массового изменения');
    }

    const updated = [];
    for (const id of ids) {
        const index = products.findIndex((product) => product.internal_id === id);
        if (index === -1) continue;
        const next = mapProductPayload(
            allowedKeys.reduce((acc, key) => {
                acc[key] = changes[key];
                return acc;
            }, {}),
            { existing: products[index] }
        );
        products[index] = next;
        updated.push(next);
    }
    await writeProducts(products);
    await appendHistory({
        product_ids: ids,
        action: 'bulk_patch',
        actor,
        diff: changes,
        snapshots: updated
    });
    await markSyncPending(ids, ['pos', 'mobile'], actor);
    await Promise.all(
        ids.map((productId) => deleteDraftVersion({ draftId: productId, productId }))
    );
    await Promise.all(
        updated.map((product) => integrationBus.recordProductUpdate(product, 'bulk_patch'))
    );
    return updated;
}

async function listVariants(parentId) {
    const products = await readProducts();
    return products.filter((product) => product.parent_id === parentId);
}

async function createVariant(parentId, payload, actor = 'system') {
    const products = await readProducts();
    const parent = products.find((item) => item.internal_id === parentId);
    if (!parent || !parent.display_only) {
        throw new ValidationError('Родительская карточка не найдена или не является витринной', [], 404);
    }
    const variant = mapProductPayload(
        {
            ...payload,
            parent_id: parentId,
            display_only: false
        }
    );
    const { valid, errors } = validateProduct(variant);
    if (!valid) {
        throw new ValidationError('Некорректные данные варианта', errors);
    }
    enforceUnique(products, variant);
    products.push(variant);
    await writeProducts(products);
    await appendHistory({
        product_id: variant.internal_id,
        action: 'variant_create',
        actor,
        diff: payload,
        snapshot: variant
    });
    await markSyncPending(variant.internal_id, ['pos', 'mobile'], actor);
    await integrationBus.recordProductUpdate(variant, 'create');
    return variant;
}

async function updateVariant(variantId, payload, actor = 'system') {
    const products = await readProducts();
    const index = products.findIndex((product) => product.internal_id === variantId);
    if (index === -1) {
        throw new ValidationError('Вариант не найден', [], 404);
    }
    if (!products[index].parent_id) {
        throw new ValidationError('Карточка не является вариантом', [], 400);
    }
    const merged = mapProductPayload(
        {
            ...payload,
            parent_id: products[index].parent_id,
            display_only: false
        },
        { existing: products[index] }
    );
    const { valid, errors } = validateProduct(merged);
    if (!valid) {
        throw new ValidationError('Некорректные данные варианта', errors);
    }
    enforceUnique(products, merged, merged.internal_id);
    products[index] = merged;
    await writeProducts(products);
    await appendHistory({
        product_id: merged.internal_id,
        action: 'variant_update',
        actor,
        diff: payload,
        snapshot: merged
    });
    await markSyncPending(merged.internal_id, ['pos', 'mobile'], actor);
    await integrationBus.recordProductUpdate(merged, 'update');
    return merged;
}

async function deleteVariant(variantId, actor = 'system') {
    const products = await readProducts();
    const index = products.findIndex((product) => product.internal_id === variantId);
    if (index === -1) {
        throw new ValidationError('Вариант не найден', [], 404);
    }
    if (!products[index].parent_id) {
        throw new ValidationError('Карточка не является вариантом', [], 400);
    }
    const [removed] = products.splice(index, 1);
    await writeProducts(products);
    await appendHistory({
        product_id: removed.internal_id,
        action: 'variant_delete',
        actor,
        diff: removed,
        snapshot: removed
    });
    await markSyncPending(removed.internal_id, ['pos', 'mobile'], actor);
    await integrationBus.recordProductUpdate(removed, 'delete', { deleted: true });
    return removed;
}

function parseListField(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        return value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
    }
    return [];
}

function parseParametersField(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed;
        } catch (_) {
            return value.split('|').map((item) => {
                const [name, val] = item.split(':');
                return { name: name?.trim(), value: val?.trim(), display: 'list' };
            });
        }
    }
    return [];
}

// Функция для автоматического определения типа товара на основе категории
function determineProductType(categoryNames = [], name = '') {
    const categoryStr = categoryNames.join(' ').toLowerCase();
    const nameStr = name.toLowerCase();
    const combined = (categoryStr + ' ' + nameStr).toLowerCase();
    
    // Материалы и ингредиенты
    if (combined.match(/\b(материал|ингредиент|сырье|компонент|material|ingredient|raw)\b/)) {
        return 'material';
    }
    
    // Продукты питания
    if (combined.match(/\b(продукт|еда|блюдо|product|food|dish|meal)\b/)) {
        return 'product';
    }
    
    // По умолчанию - товар
    return 'product';
}

// Функция для автоматического создания категорий по названию
async function ensureCategoriesExist(categoryNames = []) {
    if (!Array.isArray(categoryNames) || categoryNames.length === 0) {
        return [];
    }
    
    const categories = await readCategories();
    const categoryIds = [];
    
    for (const categoryName of categoryNames) {
        if (!categoryName || typeof categoryName !== 'string') continue;
        
        const trimmedName = categoryName.trim();
        if (!trimmedName) continue;
        
        // Ищем существующую категорию по названию
        let category = categories.find(cat => 
            cat.name.toLowerCase() === trimmedName.toLowerCase()
        );
        
        // Если категория не найдена, создаем новую
        if (!category) {
            const newCategory = {
                id: `cat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: trimmedName,
                parent_id: null,
                position: categories.length + 1
            };
            categories.push(newCategory);
            category = newCategory;
            await writeCategories(categories);
        }
        
        categoryIds.push(category.id);
    }
    
    return categoryIds;
}

function convertImportRecord(record = {}) {
    // Извлекаем категории (могут быть строками или массивами)
    const categoryInput = record.category_list || record.categories || record.category || '';
    const categoryNames = parseListField(categoryInput);
    
    // Определяем тип товара на основе категории
    const productType = record.type || determineProductType(categoryNames, record.name || record.title || '');
    
    // Обрабатываем описание - извлекаем из разных полей
    let description = record.description || '';
    if (!description && record.description_full) {
        description = record.description_full;
    }
    if (!description && typeof record.description === 'object' && record.description._text) {
        description = record.description._text;
    }
    
    // Обрабатываем краткое описание
    let shortDescription = record.short_description || '';
    if (!shortDescription && record.description && description.length > 256) {
        shortDescription = description.substring(0, 256);
    }
    
    // Обрабатываем параметры из YAML
    let parsedParams = [];
    let weightFromParams = null;
    let caloriesFromParams = null;
    let variationsFromParams = [];
    let modifiersFromParams = [];
    
    // Парсим параметры из строки JSON или массива
    try {
        if (record.parameters) {
            if (typeof record.parameters === 'string') {
                parsedParams = JSON.parse(record.parameters);
            } else if (Array.isArray(record.parameters)) {
                parsedParams = record.parameters;
            }
        }
    } catch (e) {
        // Если не удалось распарсить, игнорируем
    }
    
    // Обрабатываем параметры
    if (Array.isArray(parsedParams) && parsedParams.length > 0) {
        const sizeParams = [];
        const modifierParams = [];
        
        parsedParams.forEach(param => {
            if (!param || !param.name) return;
            
            const paramName = String(param.name).toLowerCase().trim();
            const paramValue = String(param.value || '').trim();
            
            if (!paramValue) return;
            
            // Извлекаем вес
            if ((paramName.includes('вес') || paramName === 'weight') && !weightFromParams) {
                const weightMatch = paramValue.match(/([\d.]+)\s*(г|гр|кг|g|kg)?/i);
                if (weightMatch) {
                    weightFromParams = parseNumber(weightMatch[1], { default: null });
                    if (weightMatch[2] && (weightMatch[2].toLowerCase() === 'кг' || weightMatch[2].toLowerCase() === 'kg')) {
                        weightFromParams = weightFromParams ? weightFromParams * 1000 : null;
                    }
                } else {
                    weightFromParams = parseNumber(paramValue, { default: null });
                }
            }
            
            // Извлекаем калории
            if ((paramName.includes('калори') || paramName.includes('калорий') || paramName.includes('calor')) && !caloriesFromParams) {
                const calMatch = paramValue.match(/(\d+)/);
                if (calMatch) {
                    caloriesFromParams = parseInt(calMatch[1]) || null;
                } else {
                    caloriesFromParams = parseInt(paramValue) || null;
                }
            }
            
            // Определяем параметры размера (вариации)
            if (paramName.includes('размер') || paramName.includes('size') || 
                paramName.includes('диаметр') || paramName.includes('diameter') ||
                paramName.match(/^\d+\s*см$/i) || paramName.match(/^\d+\s*cm$/i)) {
                sizeParams.push({ name: param.name, value: paramValue });
            }
            
            // Определяем модификаторы (допы, соусы)
            if (paramName.includes('соус') || paramName.includes('доп') || 
                paramName.includes('sauce') || paramName.includes('добавка') ||
                paramName.includes('topping')) {
                modifierParams.push({ name: param.name, value: paramValue });
            }
        });
        
        // Создаем вариацию из параметров размера
        if (sizeParams.length > 0) {
            variationsFromParams.push({
                variant_id: uuidv4(),
                sku: record.sku || '',
                price: parseNumber(record.price, { default: null }),
                old_price: parseNumber(record.old_price, { default: null }),
                quantity: parseNumber(record.quantity, { default: 0 }),
                weight: weightFromParams,
                parameters: sizeParams.map(p => ({
                    name: p.name,
                    value: p.value,
                    display: 'list'
                }))
            });
        }
        
        // Создаем модификаторы из параметров
        if (modifierParams.length > 0) {
            modifiersFromParams.push({
                group_id: `mod-group-${Date.now()}`,
                group_name: 'Дополнения',
                multi_select: true,
                min_select: 0,
                max_select: null,
                options: modifierParams.map(p => ({
                    id: `mod-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    name: p.value || p.name,
                    type: 'checkbox',
                    price: 0,
                    default_active: false
                }))
            });
        }
    }
    
    // ✅ Используем вес и калории: сначала из параметров, затем из полей записи (из тега <weight> в YML)
    // Преобразуем weight: если в килограммах (< 10), конвертируем в граммы
    let recordWeight = null;
    if (record.weight !== undefined && record.weight !== null && record.weight !== '') {
        const weightValue = String(record.weight).trim();
        if (weightValue) {
            const weightNum = parseFloat(weightValue);
            if (!isNaN(weightNum)) {
                // Если вес меньше 10, вероятно в килограммах (0.125), конвертируем в граммы (125)
                recordWeight = weightNum < 10 ? weightNum * 1000 : weightNum;
            } else {
                recordWeight = parseNumber(weightValue, { default: null });
            }
        }
    }
    
    const finalWeight = weightFromParams || recordWeight;
    const finalCalories = caloriesFromParams || (record.calories ? parseInt(record.calories) : null);
    
    // Объединяем вариации из параметров и из записи
    const allVariations = [
        ...variationsFromParams,
        ...ensureArray(record.variations)
    ];
    
    // Объединяем модификаторы из параметров и из записи
    const allModifiers = [
        ...modifiersFromParams,
        ...ensureArray(record.modifiers)
    ];
    
    return {
        internal_id: record.id || record.internal_id || undefined,
        display_only: record.display_only === true || record.display_only === 'true' || record.display_only === 1 || record.display_only === '1',
        parent_id: record.parent_id || record.parentId || null,
        size_label: record.size_label || record.sizeLabel || null,
        diameter: record.diameter || null,
        recipe_coefficient: record.recipe_coefficient || record.recipeCoefficient || null,
        inventory_account: record.inventory_account || record.inventoryAccount || null,
        type: productType,
        name: record.name || record.title || '',
        sku: record.sku || record.article || '',
        barcode: record.barcode || record.code || '',
        categories: categoryNames, // Сохраняем названия для последующего создания категорий
        category_names: categoryNames, // Дополнительное поле для названий категорий
        unit: record.unit || 'шт',
        price_type: record.price_type || 'fixed',
        purchase_price: parseNumber(record.purchase_price, { default: null, min: 0 }),
        price: parseNumber(record.price, { default: 0, min: 0 }),
        old_price: parseNumber(record.old_price, { default: null, min: 0 }),
        tax_system: record.tax_system || 'osn',
        vat_rate: record.vat_rate || record.vat || '20%',
        quantity: parseNumber(record.quantity, { default: 0 }),
        min_stock: parseNumber(record.min_stock, { default: 0 }),
        min_order_qty: parseNumber(record.min_order_qty, { default: 1 }),
        weight: finalWeight,
        calories: finalCalories,
        dimensions: normalizeDimensions({
            length: record.length || record.dimensions?.length,
            width: record.width || record.dimensions?.width,
            height: record.height || record.dimensions?.height
        }),
        shelf_life: record.shelf_life || null,
        origin_country: record.origin_country || '',
        manufacturer: record.manufacturer || '',
        composition: record.composition || '',
        short_description: shortDescription || record.short_description || '',
        description: description || record.description || '',
        description_url: record.description_url || '',
        forbid_discounts: record.forbid_discounts === true || record.forbid_discounts === 'true',
        forbid_loyalty: record.forbid_loyalty === true || record.forbid_loyalty === 'true',
        is_visible: record.is_visible !== false && record.is_visible !== 'false',
        images: parseListField(record.image_url || record.images).map((url, idx) => ({
            url,
            role: idx === 0 ? 'primary' : idx === 1 ? 'hover' : 'gallery',
            alt_text: record.alt_text || ''
        })),
        variations: allVariations.map(normalizeVariation).filter(Boolean),
        modifiers: allModifiers.map(normalizeModifierGroup).filter(Boolean),
        related_products: parseListField(record.related_products),
        custom_attributes: ensureArray(record.custom_attributes),
        external_id: record.external_id || null
    };
}

function parseImportBuffer(buffer, formatHint) {
    const text = buffer.toString('utf8');
    if (formatHint === 'yaml' || formatHint === 'yml') {
        const data = yaml.load(text);
        if (Array.isArray(data)) return data;
        if (Array.isArray(data?.products)) return data.products;
        throw new Error('Не удалось распарсить YAML');
    }
    if (formatHint === 'json') {
        const data = JSON.parse(text);
        if (Array.isArray(data)) return data;
        if (Array.isArray(data?.products)) return data.products;
        throw new Error('JSON должен содержать массив');
    }
    // Default CSV
    const records = parseCsv(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true
    });
    return records;
}

async function importProducts({ buffer, format, mode = 'upsert', actor = 'system' }) {
    if (!buffer) {
        throw new ValidationError('Не получен файл или данные для импорта');
    }
    const records = parseImportBuffer(buffer, format);
    if (!Array.isArray(records) || !records.length) {
        throw new ValidationError('Файл не содержит записей');
    }
    const products = await readProducts();
    const stats = { created: 0, updated: 0, skipped: 0, errors: [] };
    const touchedIds = new Set();

    for (const raw of records) {
        try {
            const mappedPayload = convertImportRecord(raw);

            // Автоматически сохраняем модификаторы в глобальном реестре и используем их
            if (Array.isArray(mappedPayload.modifiers) && mappedPayload.modifiers.length > 0) {
                const persisted = [];
                for (const grp of mappedPayload.modifiers) {
                    try {
                        const upserted = await upsertModifierGroup(grp);
                        if (upserted) persisted.push(upserted);
                    } catch (e) {
                        stats.errors.push({ modifier_group: grp.group_name || grp.name || grp.group_id || 'unknown', error: e.message });
                    }
                }
                mappedPayload.modifiers = persisted;
            }
            // If images present — attempt to download external ones and normalize
            if (Array.isArray(mappedPayload.images) && mappedPayload.images.length > 0) {
                const imgs = [];
                for (let i = 0; i < mappedPayload.images.length; i += 1) {
                    const rawImg = mappedPayload.images[i];
                    const src = typeof rawImg === 'string' ? rawImg : (rawImg && (rawImg.url || rawImg.path));
                    if (src && /^https?:\/\//i.test(src)) {
                        try {
                            const downloaded = await downloadAndNormalizeImage(src, i);
                            if (downloaded) {
                                imgs.push({
                                    id: downloaded.id,
                                    url: downloaded.url,
                                    role: (rawImg && rawImg.role) || downloaded.role,
                                    alt_text: (rawImg && rawImg.alt_text) || null,
                                    order: downloaded.order
                                });
                                continue;
                            }
                        } catch (e) {
                            stats.errors.push({ image: src, error: e.message });
                        }
                    }
                    imgs.push(typeof rawImg === 'object' ? normalizeImage(rawImg, i) : normalizeImage({ url: src }, i));
                }
                mappedPayload.images = imgs.filter(Boolean).slice(0, 12);
            }
            
            // Автоматически создаем категории, если они указаны названиями
            if (mappedPayload.category_names && mappedPayload.category_names.length > 0) {
                const categoryIds = await ensureCategoriesExist(mappedPayload.category_names);
                // Заменяем названия категорий на их ID
                mappedPayload.categories = categoryIds;
            }
            
            const existingIndex = mappedPayload.internal_id
                ? products.findIndex((product) => product.internal_id === mappedPayload.internal_id)
                : products.findIndex((product) => product.sku && product.sku === mappedPayload.sku);
            if (existingIndex === -1) {
                const created = mapProductPayload(mappedPayload);
                const { valid, errors } = validateProduct(created);
                if (!valid) {
                    stats.errors.push({ sku: created.sku, errors });
                    stats.skipped += 1;
                    continue;
                }
                enforceUnique(products, created);
                products.push(created);
                touchedIds.add(created.internal_id);
                stats.created += 1;
            } else if (mode !== 'append') {
                const updated = mapProductPayload(mappedPayload, { existing: products[existingIndex] });
                const { valid, errors } = validateProduct(updated);
                if (!valid) {
                    stats.errors.push({ sku: updated.sku, errors });
                    stats.skipped += 1;
                    continue;
                }
                enforceUnique(products, updated, updated.internal_id);
                products[existingIndex] = updated;
                touchedIds.add(updated.internal_id);
                stats.updated += 1;
            } else {
                stats.skipped += 1;
            }
        } catch (error) {
            stats.errors.push({ sku: raw.sku || raw.name, error: error.message });
            stats.skipped += 1;
        }
    }

    await writeProducts(products);
    await appendHistory({ action: 'import', actor, diff: { stats } });
    if (touchedIds.size) {
        await markSyncPending(Array.from(touchedIds), ['pos', 'mobile'], actor);
        await Promise.all(
            Array.from(touchedIds).map((id) => {
                const product = products.find((item) => item.internal_id === id);
                return product ? integrationBus.recordProductUpdate(product, 'import') : null;
            })
        );
    }
    return stats;
}

async function listCategoriesTree() {
    const categories = await readCategories();
    return categories;
}

async function upsertCategory(payload) {
    const categories = await readCategories();
    const id = payload.id || payload.category_id || `cat-${Date.now()}`;
    const index = categories.findIndex((category) => category.id === id);
    const item = {
        id,
        name: sanitizeString(payload.name || 'Новая категория', { max: 128 }),
        parent_id: payload.parent_id || null,
        position: parseNumber(payload.position, { default: categories.length + 1, min: 0 }),
        is_visible: Boolean(payload.is_visible ?? true),
        show_in_product_card: Boolean(payload.show_in_product_card ?? true)
    };
    if (index === -1) {
        categories.push(item);
    } else {
        categories[index] = { ...categories[index], ...item };
    }
    await writeCategories(categories);
    return item;
}

async function deleteCategory(id) {
    const categories = await readCategories();
    const next = categories.filter((category) => category.id !== id);
    await writeCategories(next);
    const products = await readProducts();
    let touched = false;
    products.forEach((product) => {
        if (product.categories?.includes(id)) {
            product.categories = product.categories.filter((catId) => catId !== id);
            touched = true;
        }
    });
    if (touched) {
        await writeProducts(products);
    }
    return { deleted: categories.length - next.length };
}

async function listModifiers(search) {
    const modifiers = await readModifiers();
    if (!search) return modifiers;
    const query = search.toLowerCase();
    return modifiers.filter((group) => group.group_name.toLowerCase().includes(query));
}

async function upsertModifierGroup(payload) {
    const modifiers = await readModifiers();
    const group = normalizeModifierGroup(payload);
    const index = modifiers.findIndex((item) => item.group_id === group.group_id);
    if (index === -1) {
        modifiers.push(group);
    } else {
        modifiers[index] = group;
    }
    await writeModifiers(modifiers);
    // Also index modifier group into loyalty store so rules can reference them
    try {
        await loyaltyStore.upsertItem('modifiers', {
            id: group.group_id,
            group_id: group.group_id,
            name: group.group_name,
            options: group.options || [],
            meta: { from: 'catalog' }
        }, 'id');
    } catch (e) {
        // don't fail the upsert on loyalty errors, just log
        console.warn('Failed to index modifier group into loyalty:', e && e.message);
    }
    return group;
}

async function exportProducts(format = 'csv') {
    const products = await readProducts();
    const safeFormat = (format || 'csv').toLowerCase();
    if (safeFormat === 'yml' || safeFormat === 'yaml') {
        const content = yaml.dump({
            generated_at: new Date().toISOString(),
            products
        });
        return {
            mime: 'application/x-yaml',
            extension: 'yml',
            content
        };
    }

    const header = [
        'id',
        'name',
        'sku',
        'barcode',
        'type',
        'price',
        'purchase_price',
        'quantity',
        'categories',
        'short_description',
        'description',
        'image_url',
        'is_visible'
    ];
    const rows = products.map((product) => {
        const cols = [
            product.internal_id,
            product.name,
            product.sku,
            product.barcode,
            product.type,
            product.price,
            product.purchase_price,
            product.quantity,
            Array.isArray(product.categories) ? product.categories.join('|') : '',
            product.short_description || '',
            product.description || '',
            (product.images && product.images[0]?.url) || '',
            product.is_visible ? 'true' : 'false'
        ];
        return cols
            .map((value) => {
                if (value === null || value === undefined) return '';
                const stringValue = String(value).replace(/"/g, '""');
                return stringValue.includes(',') ? `"${stringValue}"` : stringValue;
            })
            .join(',');
    });
    const content = [header.join(','), ...rows].join('\n');
    return {
        mime: 'text/csv; charset=utf-8',
        extension: 'csv',
        content
    };
}

module.exports = {
    listProducts,
    getProductById,
    createProduct,
    updateProduct,
    patchProduct,
    deleteProduct,
    bulkUpdate,
    listVariants,
    createVariant,
    updateVariant,
    deleteVariant,
    importProducts,
    listCategoriesTree,
    upsertCategory,
    deleteCategory,
    listModifiers,
    upsertModifierGroup,
    listHistory,
    compareHistoryEntries,
    recordSyncEvent,
    getSyncStatus,
    listSyncStatuses,
    markSyncPending,
    clearSyncStatus,
    restoreHistoryEntry,
    saveDraftVersion,
    getDraftVersion,
    deleteDraftVersion,
    listParameterPresets,
    upsertParameterPreset,
    deleteParameterPreset,
    exportProducts,
    ValidationError,
    createJob,
    updateJob,
    getJob,
    processImportJob,
    processExportJob,
    listIntegrationEvents,
    EXPORTS_DIR
};
