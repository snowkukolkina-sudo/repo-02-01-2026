const express = require('express');

const store = require('../services/inventory_state_store');

const router = express.Router();
router.use(express.json({ limit: '5mb' }));

router.get('/health', (req, res) => {
    res.json({
        ok: true,
        service: 'inventory',
        status: 'ready',
        timestamp: new Date().toISOString()
    });
});

router.get('/bootstrap', async (req, res) => {
    try {
        const state = await store.getState();
        res.json({ ok: true, state });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

router.get('/products', async (req, res) => {
    try {
        const products = await store.listProducts();
        const search = (req.query.search || '').toString().trim().toLowerCase();
        const filtered = search
            ? products.filter((product) =>
                  [product.name, product.code, product.category]
                      .filter(Boolean)
                      .some((value) => value.toLowerCase().includes(search))
              )
            : products;
        res.json({ ok: true, data: filtered, total: filtered.length });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

router.post('/products', async (req, res) => {
    try {
        const product = await store.createProduct(req.body || {});
        res.status(201).json({ ok: true, product });
    } catch (error) {
        res.status(400).json({ ok: false, error: error.message });
    }
});

router.patch('/products/:id', async (req, res) => {
    try {
        const product = await store.updateProduct(req.params.id, req.body || {});
        res.json({ ok: true, product });
    } catch (error) {
        res.status(404).json({ ok: false, error: error.message });
    }
});

router.get('/state/:key', async (req, res) => {
    try {
        const data = await store.getKey(req.params.key);
        res.json({ ok: true, data });
    } catch (error) {
        res.status(400).json({ ok: false, error: error.message });
    }
});

router.put('/state/:key', async (req, res) => {
    try {
        if (!Object.prototype.hasOwnProperty.call(req.body || {}, 'data')) {
            return res.status(400).json({ ok: false, error: 'Не переданы данные для сохранения' });
        }
        const data = await store.setKey(req.params.key, req.body.data);
        res.json({ ok: true, data });
    } catch (error) {
        res.status(400).json({ ok: false, error: error.message });
    }
});

router.post('/menu/publish', async (req, res) => {
    try {
        const productIds = Array.isArray(req.body?.productIds) ? req.body.productIds : [];
        const result = await store.publishMenu(productIds);
        res.json({ ok: true, result });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

module.exports = router;

