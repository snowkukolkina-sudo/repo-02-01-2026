const express = require('express');

const store = require('../services/admin_state_store');

const router = express.Router();
router.use(express.json({ limit: '2mb' }));

router.get('/health', (req, res) => {
    res.json({
        ok: true,
        service: 'admin-state',
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

router.get('/keys/:key', async (req, res) => {
    try {
        const data = await store.getKey(req.params.key);
        res.json({ ok: true, data });
    } catch (error) {
        res.status(400).json({ ok: false, error: error.message });
    }
});

async function writeKey(req, res) {
    if (!Object.prototype.hasOwnProperty.call(req.body || {}, 'data')) {
        return res.status(400).json({ ok: false, error: 'Не переданы данные для сохранения' });
    }
    try {
        const saved = await store.setKey(req.params.key, req.body.data);
        res.json({ ok: true, data: saved });
    } catch (error) {
        res.status(400).json({ ok: false, error: error.message });
    }
}

router.put('/keys/:key', writeKey);
router.post('/keys/:key', writeKey);

module.exports = router;

