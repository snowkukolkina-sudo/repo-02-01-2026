const express = require('express');
const multer = require('multer');
const fs = require('fs-extra');
const catalogStore = require('../services/catalog_store');
const authStore = require('../services/auth_store');
const path = require('path');

const router = express.Router();
router.use(express.json({ limit: '10mb' }));

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 }
});

const MODIFIER_IMAGES_DIR = path.join(process.cwd(), 'storage', 'catalog', 'modifiers-images');

const ROLE_MATRIX = {
    admin: {
        permissions: {
            'product.create': true,
            'product.update': true,
            'product.delete': true,
            'product.price': true,
            'product.stock': true,
            'product.visibility': true,
            'product.bulk': true,
            'product.import': true,
            'product.export': true,
            'category.manage': true,
            'modifier.manage': true,
            'history.restore': true,
            'sync.trigger': true
        }
    },
    content: {
        permissions: {
            'product.create': true,
            'product.update': true,
            'product.delete': false,
            'product.price': true,
            'product.stock': true,
            'product.visibility': true,
            'product.bulk': true,
            'product.import': true,
            'product.export': true,
            'category.manage': false,
            'modifier.manage': false,
            'history.restore': false,
            'sync.trigger': true
        }
    },
    cashier: {
        permissions: {
            'product.create': false,
            'product.update': false,
            'product.delete': false,
            'product.price': false,
            'product.stock': true,
            'product.visibility': true,
            'product.bulk': false,
            'product.import': false,
            'product.export': false,
            'category.manage': false,
            'modifier.manage': false,
            'history.restore': false,
            'sync.trigger': false
        }
    },
    viewer: {
        permissions: {
            'product.create': false,
            'product.update': false,
            'product.delete': false,
            'product.price': false,
            'product.stock': false,
            'product.visibility': false,
            'product.bulk': false,
            'product.import': false,
            'product.export': false,
            'category.manage': false,
            'modifier.manage': false,
            'history.restore': false,
            'sync.trigger': false
        }
    }
};

function resolveRole(roleKey) {
    const normalized = (roleKey || '').toLowerCase();
    if (ROLE_MATRIX[normalized]) {
        return { key: normalized, permissions: ROLE_MATRIX[normalized].permissions };
    }
    return { key: 'viewer', permissions: ROLE_MATRIX.viewer.permissions };
}

function extractToken(req) {
    const header = req.headers.authorization || '';
    if (header.toLowerCase().startsWith('bearer ')) {
        return header.slice(7).trim();
    }
    return null;
}

async function requireAuth(req, res, next) {
    if (req.path === '/health') {
        return next();
    }
    try {
        const token = extractToken(req);
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Требуется авторизация'
            });
        }
        const session = await authStore.getSession(token);
        if (!session) {
            return res.status(401).json({
                success: false,
                error: 'Сессия недействительна'
            });
        }
        req.user = session.user;
        req.catalogRole = resolveRole(session.user.role);
        req.authToken = token;
        next();
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message || 'Ошибка авторизации'
        });
    }
}

router.use(requireAuth);

function ensurePermission(permission) {
    return (req, res, next) => {
        if (!permission) {
            return next();
        }
        const role = req.catalogRole || resolveRole();
        if (role.permissions[permission]) {
            return next();
        }
        return res.status(403).json({
            success: false,
            error: 'Недостаточно прав для выполнения действия'
        });
    };
}

function requiredPermissionsFromChanges(changes = {}) {
    const perms = new Set();
    const keys = Object.keys(changes || {});
    if (!keys.length) {
        perms.add('product.update');
        return Array.from(perms);
    }
    const priceKeys = ['price', 'old_price'];
    const stockKeys = ['quantity', 'min_stock', 'min_order_qty'];
    const visibilityKeys = ['is_visible'];
    const updateKeys = [
        'categories',
        'custom_attributes',
        'tax_system',
        'vat_rate',
        'forbid_discounts',
        'forbid_loyalty',
        'image_url',
        'images',
        'related_products',
        'modifiers'
    ];
    keys.forEach((key) => {
        if (priceKeys.includes(key)) {
            perms.add('product.price');
        } else if (stockKeys.includes(key)) {
            perms.add('product.stock');
        } else if (visibilityKeys.includes(key)) {
            perms.add('product.visibility');
        } else if (updateKeys.includes(key)) {
            perms.add('product.update');
        } else {
            perms.add('product.update');
        }
    });
    return Array.from(perms);
}

function ensureChangesPermission(resolver) {
    return (req, res, next) => {
        const permissions = resolver(req);
        const role = req.catalogRole || resolveRole();
        const missing = permissions.filter((perm) => !role.permissions[perm]);
        if (missing.length) {
            return res.status(403).json({
                success: false,
                error: 'Недостаточно прав для выполнения изменения'
            });
        }
        next();
    };
}

const requireProductChangesPermission = ensureChangesPermission((req) =>
    requiredPermissionsFromChanges(req.body || {})
);
const requireBulkChangesPermission = ensureChangesPermission((req) =>
    requiredPermissionsFromChanges((req.body && req.body.changes) || {})
);

function ensureDraftPermission(req, res, next) {
    const perm = req.params.id === 'new' ? 'product.create' : 'product.update';
    return ensurePermission(perm)(req, res, next);
}

function resolveDraftIdentity(req) {
    const paramId = req.params.id;
    if (paramId === 'new') {
        const draftId = req.body?.draft_id || req.query?.draft_id;
        if (!draftId) {
            throw new catalogStore.ValidationError('Не указан идентификатор черновика');
        }
        return { draftId, productId: null };
    }
    return { draftId: paramId, productId: paramId };
}

function ensureJobType(job, type) {
    if (!job || job.type !== type) {
        throw new catalogStore.ValidationError('Задание не найдено', [], 404);
    }
}

function ok(data = null, meta = null) {
    const payload = { success: true, data };
    if (meta) {
        payload.meta = meta;
    }
    return payload;
}

function sendError(res, error) {
    if (error instanceof catalogStore.ValidationError) {
        return res.status(error.status || 400).json({
            success: false,
            error: error.message,
            details: error.details
        });
    }
    console.error('[catalog]', error);
    return res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
    });
}

router.get('/health', (req, res) => {
    res.json(ok({ status: 'ok', timestamp: new Date().toISOString() }));
});

router.get('/products', async (req, res) => {
    try {
        const result = await catalogStore.listProducts(req.query || {});
        res.json(ok(result.items, result.meta));
    } catch (error) {
        sendError(res, error);
    }
});

router.get('/products/:id', async (req, res) => {
    try {
        const product = await catalogStore.getProductById(req.params.id);
        if (!product) {
            return res.status(404).json({
                success: false,
                error: 'Карточка не найдена'
            });
        }
        res.json(ok(product));
    } catch (error) {
        sendError(res, error);
    }
});

router.get('/items/:id/variants', async (req, res) => {
    try {
        const variants = await catalogStore.listVariants(req.params.id);
        res.json(ok(variants));
    } catch (error) {
        sendError(res, error);
    }
});

router.post('/items/:id/variants', ensurePermission('product.create'), async (req, res) => {
    try {
        const actor = req.user?.id || 'admin';
        const variant = await catalogStore.createVariant(req.params.id, req.body || {}, actor);
        res.status(201).json(ok(variant));
    } catch (error) {
        sendError(res, error);
    }
});

router.patch('/items/variant/:id', ensurePermission('product.update'), async (req, res) => {
    try {
        const actor = req.user?.id || 'admin';
        const variant = await catalogStore.updateVariant(req.params.id, req.body || {}, actor);
        res.json(ok(variant));
    } catch (error) {
        sendError(res, error);
    }
});

router.delete('/items/variant/:id', ensurePermission('product.delete'), async (req, res) => {
    try {
        const actor = req.user?.id || 'admin';
        const removed = await catalogStore.deleteVariant(req.params.id, actor);
        res.json(ok(removed));
    } catch (error) {
        sendError(res, error);
    }
});

router.post('/products', ensurePermission('product.create'), async (req, res) => {
    try {
        const actor = req.user?.id || 'admin';
        const product = await catalogStore.createProduct(req.body || {}, actor);
        res.status(201).json(ok(product));
    } catch (error) {
        sendError(res, error);
    }
});

router.put('/products/:id', ensurePermission('product.update'), async (req, res) => {
    try {
        const actor = req.user?.id || 'admin';
        const product = await catalogStore.updateProduct(req.params.id, req.body || {}, actor);
        res.json(ok(product));
    } catch (error) {
        sendError(res, error);
    }
});

router.patch('/products/:id', requireProductChangesPermission, async (req, res) => {
    try {
        const actor = req.user?.id || 'admin';
        const product = await catalogStore.patchProduct(req.params.id, req.body || {}, actor);
        res.json(ok(product));
    } catch (error) {
        sendError(res, error);
    }
});

router.delete('/products/:id', ensurePermission('product.delete'), async (req, res) => {
    try {
        const actor = req.user?.id || 'admin';
        await catalogStore.deleteProduct(req.params.id, actor);
        res.json(ok({ deleted: true }));
    } catch (error) {
        sendError(res, error);
    }
});

router.patch('/products/bulk', requireBulkChangesPermission, async (req, res) => {
    try {
        const actor = req.user?.id || 'admin';
        const { ids, changes } = req.body || {};
        const updated = await catalogStore.bulkUpdate(ids, changes, actor);
        res.json(ok({ updated: updated.length }));
    } catch (error) {
        sendError(res, error);
    }
});

router.post('/products/import', ensurePermission('product.import'), upload.single('file'), async (req, res) => {
    try {
        const actor = req.user?.id || 'admin';
        const buffer = req.file?.buffer || Buffer.from(JSON.stringify(req.body?.records || []));
        const format =
            req.body?.format ||
            (req.file?.originalname || '').split('.').pop()?.toLowerCase() ||
            'csv';
        const stats = await catalogStore.importProducts({
            buffer,
            format,
            mode: req.body?.mode || 'upsert',
            actor
        });
        res.json(ok(stats));
    } catch (error) {
        sendError(res, error);
    }
});

router.get('/products/export', ensurePermission('product.export'), async (req, res) => {
    try {
        const format = req.query.format || 'csv';
        const { content, mime, extension } = await catalogStore.exportProducts(format);
        res.setHeader('Content-Type', mime);
        res.setHeader('Content-Disposition', `attachment; filename=products.${extension}`);
        res.send(content);
    } catch (error) {
        sendError(res, error);
    }
});

router.get('/categories', async (req, res) => {
    try {
        const categories = await catalogStore.listCategoriesTree();
        res.json(ok(categories));
    } catch (error) {
        sendError(res, error);
    }
});

router.post('/categories', ensurePermission('category.manage'), async (req, res) => {
    try {
        if (req.body?.action === 'delete') {
            const result = await catalogStore.deleteCategory(req.body?.id);
            return res.json(ok(result));
        }
        const category = await catalogStore.upsertCategory(req.body || {});
        res.json(ok(category));
    } catch (error) {
        sendError(res, error);
    }
});

router.delete('/categories/:id', ensurePermission('category.manage'), async (req, res) => {
    try {
        const result = await catalogStore.deleteCategory(req.params.id);
        res.json(ok(result));
    } catch (error) {
        sendError(res, error);
    }
});

router.get('/modifiers', async (req, res) => {
    try {
        const groups = await catalogStore.listModifiers(req.query?.search || '');
        res.json(ok(groups));
    } catch (error) {
        sendError(res, error);
    }
});

router.post('/modifiers', ensurePermission('modifier.manage'), async (req, res) => {
    try {
        const group = await catalogStore.upsertModifierGroup(req.body || {});
        res.json(ok(group));
    } catch (error) {
        sendError(res, error);
    }
});

router.post('/modifiers/upload', ensurePermission('modifier.manage'), upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        if (!file || !file.buffer) {
            return res.status(400).json({ success: false, error: 'Не получен файл' });
        }

        const originalName = (file.originalname || '').toLowerCase();
        const ext = originalName.endsWith('.png')
            ? '.png'
            : originalName.endsWith('.webp')
            ? '.webp'
            : originalName.endsWith('.gif')
            ? '.gif'
            : '.jpg';

        await fs.ensureDir(MODIFIER_IMAGES_DIR);
        const filename = `mod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
        const absPath = path.join(MODIFIER_IMAGES_DIR, filename);
        await fs.writeFile(absPath, file.buffer);

        const urlPath = `/storage/catalog/modifiers-images/${filename}`;
        res.json(ok({ url: urlPath, filename }));
    } catch (error) {
        sendError(res, error);
    }
});

router.get('/products/:id/history', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 10;
        const majorLimit = parseInt(req.query.majorLimit, 10) || 3;
        const history = await catalogStore.listHistory(req.params.id, limit, majorLimit);
        res.json(ok(history));
    } catch (error) {
        sendError(res, error);
    }
});

router.post('/products/:id/sync', ensurePermission('sync.trigger'), async (req, res) => {
    try {
        const actor = req.user?.id || 'admin';
        const targets = Array.isArray(req.body?.targets) ? req.body.targets : [];
        const result = await catalogStore.recordSyncEvent(req.params.id, targets, actor);
        res.json(ok(result));
    } catch (error) {
        sendError(res, error);
    }
});

router.get('/products/:id/sync/status', async (req, res) => {
    try {
        const status = await catalogStore.getSyncStatus(req.params.id);
        res.json(ok(status));
    } catch (error) {
        sendError(res, error);
    }
});

router.get('/sync/status', async (req, res) => {
    try {
        const ids = typeof req.query.ids === 'string' ? req.query.ids.split(',') : [];
        const status = await catalogStore.listSyncStatuses(ids);
        res.json(ok(status));
    } catch (error) {
        sendError(res, error);
    }
});

router.get('/products/:id/draft', ensureDraftPermission, async (req, res) => {
    try {
        const identifiers = resolveDraftIdentity(req);
        const draft = await catalogStore.getDraftVersion(identifiers);
        res.json(ok(draft));
    } catch (error) {
        sendError(res, error);
    }
});

router.post('/products/:id/draft', ensureDraftPermission, async (req, res) => {
    try {
        const actor = req.user?.id || 'admin';
        const identifiers = resolveDraftIdentity(req);
        const entry = await catalogStore.saveDraftVersion({
            ...identifiers,
            payload: req.body?.payload || {},
            actor
        });
        res.json(ok(entry));
    } catch (error) {
        sendError(res, error);
    }
});

router.delete('/products/:id/draft', ensureDraftPermission, async (req, res) => {
    try {
        const identifiers = resolveDraftIdentity(req);
        const result = await catalogStore.deleteDraftVersion(identifiers);
        res.json(ok(result));
    } catch (error) {
        sendError(res, error);
    }
});

router.get('/products/presets', async (req, res) => {
    try {
        const presets = await catalogStore.listParameterPresets();
        res.json(ok(presets));
    } catch (error) {
        sendError(res, error);
    }
});

router.post('/products/presets', ensurePermission('product.update'), async (req, res) => {
    try {
        const preset = await catalogStore.upsertParameterPreset(req.body || {});
        res.json(ok(preset));
    } catch (error) {
        sendError(res, error);
    }
});

router.delete('/products/presets/:id', ensurePermission('product.update'), async (req, res) => {
    try {
        await catalogStore.deleteParameterPreset(req.params.id);
        res.json(ok({ deleted: true }));
    } catch (error) {
        sendError(res, error);
    }
});

router.post('/products/import/jobs', ensurePermission('product.import'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file?.buffer) {
            throw new catalogStore.ValidationError('Не получен файл для импорта');
        }
        const actor = req.user?.id || 'admin';
        const format =
            req.body?.format ||
            (req.file?.originalname || '').split('.').pop()?.toLowerCase() ||
            'csv';
        const mode = req.body?.mode || 'upsert';
        const importHidden = req.body?.importHidden === 'true';
        const job = await catalogStore.createJob('import', { format, mode, importHidden });
        setImmediate(() => {
            catalogStore
                .processImportJob(job.id, {
                    buffer: req.file.buffer,
                    format,
                    mode,
                    actor,
                    importHidden
                })
                .catch(() => {});
        });
        res.status(202).json(ok(job));
    } catch (error) {
        sendError(res, error);
    }
});

router.get('/products/import/jobs/:id', async (req, res) => {
    try {
        const job = await catalogStore.getJob(req.params.id);
        ensureJobType(job, 'import');
        res.json(ok(job));
    } catch (error) {
        sendError(res, error);
    }
});

router.post('/products/export/jobs', ensurePermission('product.export'), async (req, res) => {
    try {
        const format = (req.body?.format || 'csv').toLowerCase();
        const job = await catalogStore.createJob('export', { format });
        setImmediate(() => {
            catalogStore.processExportJob(job.id, { format }).catch(() => {});
        });
        res.status(202).json(ok(job));
    } catch (error) {
        sendError(res, error);
    }
});

router.get('/products/export/jobs/:id', async (req, res) => {
    try {
        const job = await catalogStore.getJob(req.params.id);
        ensureJobType(job, 'export');
        res.json(ok(job));
    } catch (error) {
        sendError(res, error);
    }
});

router.get('/products/export/jobs/:id/download', async (req, res) => {
    try {
        const job = await catalogStore.getJob(req.params.id);
        ensureJobType(job, 'export');
        if (job.status !== 'completed' || !job.result?.file_path) {
            throw new catalogStore.ValidationError('Файл недоступен', [], 409);
        }
        const exists = await fs.pathExists(job.result.file_path);
        if (!exists) {
            throw new catalogStore.ValidationError('Файл не найден', [], 404);
        }
        res.download(job.result.file_path, `products-${req.params.id}.${job.result.format}`);
    } catch (error) {
        sendError(res, error);
    }
});

router.get('/integrations/events', ensurePermission('product.update'), async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
        const events = await catalogStore.listIntegrationEvents(limit);
        res.json(ok(events));
    } catch (error) {
        sendError(res, error);
    }
});

router.post('/products/:id/history/:entryId/restore', ensurePermission('history.restore'), async (req, res) => {
    try {
        const actor = req.user?.id || 'admin';
        const restored = await catalogStore.restoreHistoryEntry(req.params.id, req.params.entryId, actor);
        res.json(ok(restored));
    } catch (error) {
        sendError(res, error);
    }
});

router.get('/products/:id/history/compare', async (req, res) => {
    try {
        const { lhs, rhs } = req.query;
        const diff = await catalogStore.compareHistoryEntries(req.params.id, lhs, rhs);
        res.json(ok(diff));
    } catch (error) {
        sendError(res, error);
    }
});

module.exports = router;
