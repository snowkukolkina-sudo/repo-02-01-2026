const express = require('express');
const aggregatorStore = require('../services/aggregator_store');

const router = express.Router();

router.use(express.json());

function ok(data = null) {
    return { ok: true, data };
}

function fail(error, status = 400) {
    return { ok: false, error, status };
}

router.get('/', async (req, res) => {
    try {
        const aggregators = await aggregatorStore.listAggregators();
        res.json(ok(aggregators));
    } catch (error) {
        res.status(500).json(fail(error.message));
    }
});

router.post('/webhook/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const aggregator = await aggregatorStore.getAggregator(id);
        if (!aggregator) {
            return res.status(404).json(fail('Aggregator not found', 404));
        }

        const token = (req.headers['x-api-key'] || req.query.token || '').toString();
        if (!token || token !== String(aggregator.api_key || '')) {
            return res.status(401).json(fail('Unauthorized', 401));
        }

        if (!aggregator.enabled) {
            return res.status(409).json(fail('Aggregator disabled', 409));
        }

        const event = await aggregatorStore.appendOrderEvent(id, req.body || {});
        res.json(ok({ received: true, eventId: event.id }));
    } catch (error) {
        res.status(500).json(fail(error.message));
    }
});

router.get('/:id', async (req, res) => {
    try {
        const aggregator = await aggregatorStore.getAggregator(req.params.id);
        if (!aggregator) {
            return res.status(404).json(fail('Aggregator not found', 404));
        }
        res.json(ok(aggregator));
    } catch (error) {
        res.status(500).json(fail(error.message));
    }
});

router.get('/:id/events', async (req, res) => {
    try {
        const aggregator = await aggregatorStore.getAggregator(req.params.id);
        if (!aggregator) {
            return res.status(404).json(fail('Aggregator not found', 404));
        }
        const limit = Math.max(1, Math.min(parseInt(req.query.limit || '50', 10) || 50, 200));
        const events = await aggregatorStore.listOrderEvents(req.params.id, limit);
        res.json(ok({ events }));
    } catch (error) {
        res.status(500).json(fail(error.message));
    }
});

router.post('/:id', async (req, res) => {
    try {
        const aggregator = await aggregatorStore.updateAggregator(req.params.id, req.body || {});
        res.json(ok(aggregator));
    } catch (error) {
        res.status(400).json(fail(error.message));
    }
});

router.post('/:id/toggle', async (req, res) => {
    try {
        const aggregator = await aggregatorStore.toggleAggregator(req.params.id, !!req.body?.enabled);
        res.json(ok(aggregator));
    } catch (error) {
        res.status(400).json(fail(error.message));
    }
});

router.post('/:id/sync', async (req, res) => {
    try {
        const aggregator = await aggregatorStore.recordSync(req.params.id, req.body || {});
        res.json(ok(aggregator));
    } catch (error) {
        res.status(400).json(fail(error.message));
    }
});

module.exports = router;

