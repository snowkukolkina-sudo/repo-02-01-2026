const express = require('express');
const cashierStore = require('../services/cashier_store');

const router = express.Router();

router.use(express.json());

function ok(data = null) {
    return { success: true, data };
}

function fail(error, status = 400) {
    return { success: false, error, status };
}

router.get('/shift/current', async (req, res) => {
    try {
        const data = await cashierStore.getCurrentShift();
        res.json(ok(data));
    } catch (error) {
        res.status(500).json(fail(error.message));
    }
});

router.post('/shift/open', async (req, res) => {
    try {
        const data = await cashierStore.openShift(req.body || {});
        res.json(ok(data));
    } catch (error) {
        res.status(400).json(fail(error.message));
    }
});

router.post('/shift/close', async (req, res) => {
    try {
        const data = await cashierStore.closeShift(req.body || {});
        res.json(ok(data));
    } catch (error) {
        res.status(400).json(fail(error.message));
    }
});

router.post('/expense', async (req, res) => {
    try {
        const expense = await cashierStore.addExpense(req.body || {});
        res.json(ok(expense));
    } catch (error) {
        res.status(400).json(fail(error.message));
    }
});

router.get('/x-report', async (req, res) => {
    try {
        const report = await cashierStore.getXReport();
        res.json(ok(report));
    } catch (error) {
        res.status(400).json(fail(error.message));
    }
});

router.get('/shift/history', async (req, res) => {
    try {
        const history = await cashierStore.listHistory();
        res.json(ok(history));
    } catch (error) {
        res.status(500).json(fail(error.message));
    }
});

module.exports = router;

