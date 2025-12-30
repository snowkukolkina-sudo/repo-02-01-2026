const path = require('path');
const fs = require('fs-extra');

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'catalog');
const EVENTS_FILE = path.join(STORAGE_DIR, 'integration-events.jsonl');

async function ensureFile() {
    await fs.ensureDir(STORAGE_DIR);
    if (!(await fs.pathExists(EVENTS_FILE))) {
        await fs.writeFile(EVENTS_FILE, '', 'utf8');
    }
}

async function appendEvent(event) {
    await ensureFile();
    const payload = {
        id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        ...event
    };
    await fs.appendFile(EVENTS_FILE, JSON.stringify(payload) + '\n', 'utf8');
    return payload;
}

async function listEvents(limit = 50) {
    await ensureFile();
    const content = await fs.readFile(EVENTS_FILE, 'utf8');
    if (!content.trim()) return [];
    const lines = content.trim().split('\n');
    const events = [];
    for (let i = lines.length - 1; i >= 0 && events.length < limit; i--) {
        try {
            events.push(JSON.parse(lines[i]));
        } catch (_) {
            // ignore malformed lines
        }
    }
    return events;
}

async function recordProductUpdate(product, action = 'update', extras = {}) {
    if (!product) return;
    return appendEvent({
        type: 'PRODUCT_UPDATED',
        action,
        product_id: product.internal_id || product.id,
        sku: product.sku,
        payload: {
            name: product.name,
            categories: product.categories,
            is_visible: product.is_visible
        },
        metas: extras
    });
}

async function recordCatalogSync(productId, targets = []) {
    return appendEvent({
        type: 'CATALOG_SYNC',
        product_id: productId,
        targets
    });
}

async function recordMarketplaceTask(productId, marketplaces = []) {
    return appendEvent({
        type: 'MARKETPLACE_TASK',
        product_id: productId,
        marketplaces
    });
}

async function recordNotification(channel, message, meta = {}) {
    return appendEvent({
        type: 'NOTIFICATION',
        channel,
        message,
        meta
    });
}

module.exports = {
    listEvents,
    recordProductUpdate,
    recordCatalogSync,
    recordMarketplaceTask,
    recordNotification
};

