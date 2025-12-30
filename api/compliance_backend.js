const express = require('express');
const complianceStore = require('../services/compliance_store');

const router = express.Router();

router.use(express.json());

function ok(data = null) {
    return { success: true, data };
}

function fail(error, status = 400) {
    return { success: false, error, status };
}

// Mercury routes
router.get('/mercury/batches', async (req, res) => {
    try {
        const batches = await complianceStore.listMercuryBatches();
        res.json(ok(batches));
    } catch (error) {
        res.status(500).json(fail(error.message));
    }
});

router.post('/mercury/batches', async (req, res) => {
    try {
        const batch = await complianceStore.createMercuryBatch(req.body || {});
        res.json(ok(batch));
    } catch (error) {
        res.status(500).json(fail(error.message));
    }
});

router.post('/mercury/batches/:id/redeem', async (req, res) => {
    try {
        const batch = await complianceStore.getMercuryBatch(req.params.id);
        if (!batch) {
            return res.status(404).json(fail('Партия не найдена', 404));
        }

        const redeemQuantity = Math.min(parseFloat(req.body?.quantity || batch.quantity) || 0, batch.quantity);
        const remaining = parseFloat((batch.quantity - redeemQuantity).toFixed(3));
        const payload = {
            quantity: Math.max(remaining, 0),
            status: remaining <= 0 ? 'redeemed' : batch.status,
            last_redeem_reason: req.body?.reason || null,
            last_redeem_at: new Date().toISOString()
        };

        const updated = await complianceStore.updateMercuryBatch(req.params.id, payload);
        res.json(ok(updated));
    } catch (error) {
        res.status(500).json(fail(error.message));
    }
});

router.get('/mercury/documents', async (req, res) => {
    try {
        const documents = await complianceStore.listMercuryDocuments();
        res.json(ok(documents));
    } catch (error) {
        res.status(500).json(fail(error.message));
    }
});

router.get('/mercury/settings', async (req, res) => {
    try {
        const settings = await complianceStore.getMercurySettings();
        res.json(ok(settings));
    } catch (error) {
        res.status(500).json(fail(error.message));
    }
});

router.post('/mercury/settings', async (req, res) => {
    try {
        const settings = await complianceStore.updateMercurySettings(req.body || {});
        res.json(ok(settings));
    } catch (error) {
        res.status(500).json(fail(error.message));
    }
});

// Honest Sign routes
router.get('/honest/status', async (req, res) => {
    try {
        const status = await complianceStore.getHonestStatus();
        res.json(ok(status));
    } catch (error) {
        res.status(500).json(fail(error.message));
    }
});

router.get('/honest/products', async (req, res) => {
    try {
        const products = await complianceStore.listHonestProducts();
        res.json(ok(products));
    } catch (error) {
        res.status(500).json(fail(error.message));
    }
});

router.get('/honest/marks', async (req, res) => {
    try {
        const marks = await complianceStore.listHonestMarks();
        res.json(ok(marks));
    } catch (error) {
        res.status(500).json(fail(error.message));
    }
});

router.get('/honest/reports', async (req, res) => {
    try {
        const reports = await complianceStore.listHonestReports();
        res.json(ok(reports));
    } catch (error) {
        res.status(500).json(fail(error.message));
    }
});

router.get('/honest/config', async (req, res) => {
    try {
        const config = await complianceStore.getHonestConfig();
        res.json(ok(config));
    } catch (error) {
        res.status(500).json(fail(error.message));
    }
});

router.post('/honest/config', async (req, res) => {
    try {
        const config = await complianceStore.updateHonestConfig(req.body || {});
        res.json(ok(config));
    } catch (error) {
        res.status(500).json(fail(error.message));
    }
});

router.get('/honest/marks/:code/validate', async (req, res) => {
    try {
        const result = await complianceStore.validateHonestMark(req.params.code);
        res.json(result);
    } catch (error) {
        res.status(500).json(fail(error.message));
    }
});

router.put('/honest/marks/:code/status', async (req, res) => {
    try {
        const updated = await complianceStore.updateHonestMarkStatus(req.params.code, req.body?.status || 'unknown');
        if (!updated) {
            return res.status(404).json(fail('Марка не найдена', 404));
        }
        res.json(ok(updated));
    } catch (error) {
        res.status(500).json(fail(error.message));
    }
});

router.post('/honest/sales', async (req, res) => {
    try {
        const report = await complianceStore.recordHonestReport({
            type: 'sale',
            payload: req.body || {}
        });
        res.json({
            id: report.id,
            status: 'accepted',
            report
        });
    } catch (error) {
        res.status(500).json(fail(error.message));
    }
});

router.post('/honest/returns', async (req, res) => {
    try {
        const report = await complianceStore.recordHonestReport({
            type: 'return',
            payload: req.body || {}
        });
        res.json({
            id: report.id,
            status: 'accepted',
            report
        });
    } catch (error) {
        res.status(500).json(fail(error.message));
    }
});

router.post('/honest/qr/decode', async (req, res) => {
    const qrCode = req.body?.qrCode || '';
    res.json({
        type: 'stub',
        data: qrCode,
        decodedAt: new Date().toISOString()
    });
});

router.post('/honest/reports', async (req, res) => {
    try {
        const report = await complianceStore.recordHonestReport(req.body || {});
        res.json(report);
    } catch (error) {
        res.status(500).json(fail(error.message));
    }
});

// EGAIS routes
router.get('/egais/status', async (req, res) => {
    try {
        const status = await complianceStore.getEgaisStatus();
        res.json(ok(status));
    } catch (error) {
        res.status(500).json(fail(error.message));
    }
});

router.get('/egais/products/alcohol', async (req, res) => {
    try {
        const products = await complianceStore.listEgaisProducts();
        res.json({ data: products });
    } catch (error) {
        res.status(500).json(fail(error.message));
    }
});

router.get('/egais/marks', async (req, res) => {
    try {
        const marks = await complianceStore.listEgaisMarks();
        res.json({ data: marks });
    } catch (error) {
        res.status(500).json(fail(error.message));
    }
});

router.get('/egais/reports', async (req, res) => {
    try {
        const reports = await complianceStore.listEgaisReports();
        res.json(ok(reports));
    } catch (error) {
        res.status(500).json(fail(error.message));
    }
});

router.get('/egais/config', async (req, res) => {
    try {
        const config = await complianceStore.getEgaisConfig();
        res.json(ok(config));
    } catch (error) {
        res.status(500).json(fail(error.message));
    }
});

router.post('/egais/config', async (req, res) => {
    try {
        const config = await complianceStore.updateEgaisConfig(req.body || {});
        res.json(ok(config));
    } catch (error) {
        res.status(500).json(fail(error.message));
    }
});

router.post('/egais/sales', async (req, res) => {
    res.json({
        id: `egais-sale-${Date.now()}`,
        status: 'accepted'
    });
});

router.post('/egais/returns', async (req, res) => {
    res.json({
        id: `egais-return-${Date.now()}`,
        status: 'accepted'
    });
});

router.post('/egais/inventory', async (req, res) => {
    res.json({
        id: `egais-inventory-${Date.now()}`,
        status: 'accepted'
    });
});

router.post('/egais/reports', async (req, res) => {
    try {
        const report = await complianceStore.recordEgaisReport(req.body || {});
        res.json(report);
    } catch (error) {
        res.status(500).json(fail(error.message));
    }
});

router.get('/egais/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;

