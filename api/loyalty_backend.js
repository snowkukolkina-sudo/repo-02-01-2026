const express = require('express');
const store = require('../services/loyalty_store');

const router = express.Router();

router.use(express.json());

router.get('/health', async (req, res) => {
    try {
        await store.ensureStorage();
        res.json({ ok: true, message: 'Loyalty backend ready' });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

router.get('/config', async (req, res) => {
    try {
        const config = await store.readConfig();
        res.json({ ok: true, config });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

router.put('/config', async (req, res) => {
    try {
        const payload = req.body || {};
        const config = await store.writeConfig(payload);
        res.json({ ok: true, config });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

router.post('/campaigns', async (req, res) => {
    try {
        const campaign = await store.upsertItem('campaigns', req.body || {});
        res.status(201).json({ ok: true, campaign });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

router.put('/campaigns/:id', async (req, res) => {
    try {
        const campaign = await store.upsertItem('campaigns', { ...req.body, id: req.params.id });
        res.json({ ok: true, campaign });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

router.delete('/campaigns/:id', async (req, res) => {
    try {
        const removed = await store.deleteItem('campaigns', req.params.id);
        if (!removed) {
            return res.status(404).json({ ok: false, error: 'Campaign not found' });
        }
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

router.post('/rules', async (req, res) => {
    try {
        const rule = await store.upsertItem('loyaltyRules', req.body || {});
        res.status(201).json({ ok: true, rule });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

router.put('/rules/:id', async (req, res) => {
    try {
        const rule = await store.upsertItem('loyaltyRules', { ...req.body, id: req.params.id });
        res.json({ ok: true, rule });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

router.delete('/rules/:id', async (req, res) => {
    try {
        const removed = await store.deleteItem('loyaltyRules', req.params.id);
        if (!removed) {
            return res.status(404).json({ ok: false, error: 'Rule not found' });
        }
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

router.post('/groups', async (req, res) => {
    try {
        const group = await store.upsertItem('productGroups', req.body || {});
        res.status(201).json({ ok: true, group });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

router.put('/groups/:id', async (req, res) => {
    try {
        const group = await store.upsertItem('productGroups', { ...req.body, id: req.params.id });
        res.json({ ok: true, group });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

router.delete('/groups/:id', async (req, res) => {
    try {
        const removed = await store.deleteItem('productGroups', req.params.id);
        if (!removed) {
            return res.status(404).json({ ok: false, error: 'Group not found' });
        }
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

router.post('/anchors', async (req, res) => {
    try {
        const anchor = await store.upsertItem('anchors', req.body || {});
        res.status(201).json({ ok: true, anchor });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

router.delete('/anchors/:id', async (req, res) => {
    try {
        const removed = await store.deleteItem('anchors', req.params.id);
        if (!removed) {
            return res.status(404).json({ ok: false, error: 'Anchor not found' });
        }
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

router.post('/evaluate', async (req, res) => {
    try {
        const config = await store.readConfig();
        const cart = req.body?.cart || [];
        const now = new Date();

        const context = {
            total: cart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0),
            items: cart
        };

        const appliedCampaigns = config.campaigns.filter((campaign) => campaign.status === 'active');
        const results = appliedCampaigns.map((campaign) => {
            return {
                id: campaign.id,
                name: campaign.name,
                actions: campaign.actions,
                discount: 0,
                coinsMultiplier: 1,
                status: 'pending'
            };
        });

        const coinsRate = config.settings?.coins?.rate || 1;
        const coinsPercent = (config.loyaltyRules.find((rule) => rule.scope === 'global')?.percent ?? 0) / 100;
        const coinsEarned = Math.floor(context.total * coinsPercent * coinsRate);

        res.json({
            ok: true,
            evaluatedAt: now.toISOString(),
            cartTotal: context.total,
            coinsEarned,
            appliedCampaigns: results
        });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

module.exports = router;

