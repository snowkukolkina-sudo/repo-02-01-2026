const path = require('path');
const fs = require('fs-extra');

const STORAGE_DIR = process.env.COMPLIANCE_STORAGE_PATH || path.join(process.cwd(), 'storage', 'compliance');
const DATA_FILE = path.join(STORAGE_DIR, 'data.json');

let cache = null;

const defaultStore = {
    mercury: {
        settings: {
            apiUrl: 'https://api.mercury.vetrf.ru',
            organizationId: '',
            autoRedeem: false
        },
        batches: [
            {
                id: 'b1',
                product_name: 'Лосось свежий',
                batch_number: 'LS-2025-001',
                quantity: 5.2,
                unit: 'кг',
                production_date: '2025-01-04',
                expiry_date: '2025-01-12',
                supplier: 'ООО «Рыбный мир»',
                status: 'active',
                guid: 'b1-1234567890'
            },
            {
                id: 'b2',
                product_name: 'Мясо говядина охлажденное',
                batch_number: 'MG-2025-015',
                quantity: 18.4,
                unit: 'кг',
                production_date: '2025-01-02',
                expiry_date: '2025-01-14',
                supplier: 'ООО «Мясокомбинат»',
                status: 'redeemed',
                guid: 'b2-0987654321'
            },
            {
                id: 'b3',
                product_name: 'Молоко пастеризованное 3.2%',
                batch_number: 'ML-2025-044',
                quantity: 24,
                unit: 'л',
                production_date: '2025-01-06',
                expiry_date: '2025-01-10',
                supplier: 'ООО «Молочный завод»',
                status: 'expired',
                guid: 'b3-2222333344'
            }
        ],
        documents: [
            {
                id: 'vsd1',
                type: 'VSD',
                number: 'ВСД-000152',
                date: '2025-01-05',
                supplier: 'ООО «Рыбный мир»',
                status: 'received',
                batches_count: 3
            },
            {
                id: 'vsd2',
                type: 'VSD',
                number: 'ВСД-000153',
                date: '2025-01-04',
                supplier: 'ООО «Мясокомбинат»',
                status: 'processing',
                batches_count: 5
            }
        ]
    },
    honest: {
        config: {
            apiUrl: 'https://api.честныйзнак.рф/v1',
            token: '',
            organizationId: '',
            inn: '',
            kpp: ''
        },
        products: [
            {
                id: 'm1',
                name: 'Напиток газированный 0.5л',
                category: 'soft_drink',
                gtin: '04601234567892',
                isMarked: true,
                markType: 'DATA_MATRIX',
                status: 'active'
            },
            {
                id: 'm2',
                name: 'Сыр полутвердый 200г',
                category: 'cheese',
                gtin: '04601234560012',
                isMarked: true,
                markType: 'DATA_MATRIX',
                status: 'active'
            }
        ],
        marks: [
            {
                code: '010460123456789221ABCDEF1234567',
                status: 'available',
                productId: 'm1',
                scannedAt: null
            },
            {
                code: '010460123456001221ABCDEFG765432',
                status: 'sold',
                productId: 'm2',
                scannedAt: '2025-01-04T09:10:00.000Z'
            }
        ],
        reports: []
    },
    egais: {
        config: {
            apiUrl: 'https://api.egais.ru/v1',
            apiKey: '',
            organizationId: '',
            inn: '',
            kpp: ''
        },
        products: [
            {
                id: 'al1',
                name: 'Вино красное сухое 0.75л',
                alcVolumeL: 0.75,
                alcStrength: 13.5,
                quantity: 48,
                isDraft: false
            },
            {
                id: 'al2',
                name: 'Пиво светлое 30л',
                alcVolumeL: 30,
                alcStrength: 4.8,
                quantity: 5,
                isDraft: true,
                draftLiters: 30
            }
        ],
        marks: [
            {
                code: 'ALC-123456789012',
                productId: 'al1',
                status: 'in_stock'
            },
            {
                code: 'ALC-987654321000',
                productId: 'al1',
                status: 'sold'
            }
        ],
        reports: []
    }
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
    if (!cache) {
        return;
    }
    await fs.writeJson(DATA_FILE, cache, { spaces: 2 });
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

// Mercury helpers
async function listMercuryBatches() {
    const store = await loadStore();
    return clone(store.mercury.batches);
}

async function getMercuryBatch(batchId) {
    const store = await loadStore();
    const batch = store.mercury.batches.find((item) => item.id === batchId);
    return batch ? clone(batch) : null;
}

async function listMercuryDocuments() {
    const store = await loadStore();
    return clone(store.mercury.documents);
}

async function getMercurySettings() {
    const store = await loadStore();
    return clone(store.mercury.settings);
}

async function createMercuryBatch(batch) {
    const store = await loadStore();
    const newBatch = {
        id: `b${Date.now()}`,
        ...batch
    };
    store.mercury.batches.unshift(newBatch);
    await saveStore();
    return clone(newBatch);
}

async function updateMercuryBatch(batchId, changes) {
    const store = await loadStore();
    const idx = store.mercury.batches.findIndex((b) => b.id === batchId);
    if (idx === -1) {
        return null;
    }
    store.mercury.batches[idx] = {
        ...store.mercury.batches[idx],
        ...changes
    };
    await saveStore();
    return clone(store.mercury.batches[idx]);
}

async function updateMercurySettings(settings) {
    const store = await loadStore();
    store.mercury.settings = {
        ...store.mercury.settings,
        ...settings
    };
    await saveStore();
    return clone(store.mercury.settings);
}

// Honest Sign helpers
async function getHonestStatus() {
    const store = await loadStore();
    return {
        products: store.honest.products.length,
        marks: store.honest.marks.length,
        reports: store.honest.reports.length,
        connected: Boolean(store.honest.config.token)
    };
}

async function listHonestProducts() {
    const store = await loadStore();
    return clone(store.honest.products);
}

async function listHonestMarks() {
    const store = await loadStore();
    return clone(store.honest.marks);
}

async function listHonestReports() {
    const store = await loadStore();
    return clone(store.honest.reports);
}

async function getHonestConfig() {
    const store = await loadStore();
    return clone(store.honest.config);
}

async function updateHonestConfig(config) {
    const store = await loadStore();
    store.honest.config = {
        ...store.honest.config,
        ...config
    };
    await saveStore();
    return clone(store.honest.config);
}

async function validateHonestMark(code) {
    const store = await loadStore();
    const mark = store.honest.marks.find((m) => m.code === code);
    if (!mark) {
        return {
            isValid: false,
            errors: ['Марка не найдена'],
            warnings: []
        };
    }
    const product = store.honest.products.find((p) => p.id === mark.productId);
    return {
        isValid: mark.status !== 'revoked',
        product,
        status: mark.status,
        errors: mark.status === 'revoked' ? ['Марка отозвана'] : [],
        warnings: []
    };
}

async function updateHonestMarkStatus(code, status) {
    const store = await loadStore();
    const mark = store.honest.marks.find((m) => m.code === code);
    if (!mark) {
        return null;
    }
    mark.status = status;
    mark.updatedAt = new Date().toISOString();
    await saveStore();
    return clone(mark);
}

async function recordHonestReport(report) {
    const store = await loadStore();
    const newReport = {
        id: `honest-report-${Date.now()}`,
        ...report,
        status: 'generated',
        url: report.url || null,
        generatedAt: new Date().toISOString()
    };
    store.honest.reports.push(newReport);
    await saveStore();
    return clone(newReport);
}

// EGAIS helpers
async function getEgaisStatus() {
    const store = await loadStore();
    return {
        products: store.egais.products.length,
        marks: store.egais.marks.length,
        reports: store.egais.reports.length,
        connected: Boolean(store.egais.config.apiKey)
    };
}

async function listEgaisProducts() {
    const store = await loadStore();
    return clone(store.egais.products);
}

async function listEgaisMarks() {
    const store = await loadStore();
    return clone(store.egais.marks);
}

async function listEgaisReports() {
    const store = await loadStore();
    return clone(store.egais.reports);
}

async function getEgaisConfig() {
    const store = await loadStore();
    return clone(store.egais.config);
}

async function updateEgaisConfig(config) {
    const store = await loadStore();
    store.egais.config = {
        ...store.egais.config,
        ...config
    };
    await saveStore();
    return clone(store.egais.config);
}

async function recordEgaisReport(report) {
    const store = await loadStore();
    const newReport = {
        id: `egais-report-${Date.now()}`,
        ...report,
        status: 'generated',
        url: report.url || null,
        generatedAt: new Date().toISOString()
    };
    store.egais.reports.push(newReport);
    await saveStore();
    return clone(newReport);
}

module.exports = {
    // Mercury
    listMercuryBatches,
    listMercuryDocuments,
    getMercurySettings,
    createMercuryBatch,
    updateMercuryBatch,
    updateMercurySettings,
    getMercuryBatch,

    // Honest Sign
    getHonestStatus,
    listHonestProducts,
    listHonestMarks,
    listHonestReports,
    getHonestConfig,
    updateHonestConfig,
    validateHonestMark,
    updateHonestMarkStatus,
    recordHonestReport,

    // EGAIS
    getEgaisStatus,
    listEgaisProducts,
    listEgaisMarks,
    listEgaisReports,
    getEgaisConfig,
    updateEgaisConfig,
    recordEgaisReport
};

