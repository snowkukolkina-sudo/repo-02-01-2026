const express = require('express');
const router = express.Router();
const diadocMapper = require('../services/diadoc_mapper');
const diadocImporter = require('../services/diadoc_importer');
const axios = require('axios');
const adminStateStore = require('../services/admin_state_store');
const multer = require('multer');

router.use(express.json({ limit: '1mb' }));
router.use(express.text({ type: ['text/*', 'application/xml', 'application/octet-stream'], limit: '10mb' }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

router.post('/parse', async (req, res) => {
    try {
        const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '', 'utf8');
        const mapped = await diadocMapper.mapInvoiceBuffer(buffer);
        res.json({ ok: true, mapping: mapped });
    } catch (error) {
        res.status(400).json({ ok: false, error: error.message });
    }
});

router.post('/parse-package', upload.single('file'), async (req, res) => {
    try {
        if (!req.file?.buffer) {
            return res.status(400).json({ ok: false, error: 'Файл не загружен' });
        }
        const docs = await diadocImporter.parseDiadocPackage(req.file.buffer, req.file.originalname || 'upload');
        const filtered = (docs || []).filter((doc) => doc && doc.ok && Array.isArray(doc.lines) && doc.lines.length);
        res.json({ ok: true, documents: filtered, total: filtered.length });
    } catch (error) {
        res.status(400).json({ ok: false, error: error.message });
    }
});

// Save a receipt draft and optionally create discrepancy act
router.post('/receive', async (req, res) => {
    try {
        const { receipt, create_discrepancy = false } = req.body || {};
        if (!receipt) return res.status(400).json({ ok: false, error: 'Missing receipt payload' });
        const saved = await diadocMapper.saveReceiptDraft(receipt);
        let act = null;
        if (create_discrepancy) {
            act = await diadocMapper.createDiscrepancyAct(saved);
        }
        res.json({ ok: true, receipt: saved, discrepancy_act: act });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    }
});

router.get('/oauth/status', async (req, res) => {
    try {
        const stored = await adminStateStore.getKey('diadoc_oauth');
        const hasToken = Boolean(stored && stored.access_token);
        res.json({ ok: true, configured: hasToken });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

router.post('/oauth/exchange', async (req, res) => {
    try {
        const tokenUrl = process.env.DIADOC_OAUTH_TOKEN_URL || 'https://auth.kontur.ru/connect/token';
        const clientId = process.env.DIADOC_OAUTH_CLIENT_ID || '';
        const clientSecret = process.env.DIADOC_OAUTH_CLIENT_SECRET || '';
        const redirectUri = process.env.DIADOC_OAUTH_REDIRECT_URI || '';
        const code = (req.body && req.body.code) ? String(req.body.code) : '';

        if (!clientId || !clientSecret || !redirectUri) {
            return res.status(400).json({ ok: false, error: 'Missing DIADOC_OAUTH_CLIENT_ID / DIADOC_OAUTH_CLIENT_SECRET / DIADOC_OAUTH_REDIRECT_URI in .env' });
        }
        if (!code) {
            return res.status(400).json({ ok: false, error: 'Missing authorization code' });
        }

        const body = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: redirectUri
        });

        const response = await axios.post(tokenUrl, body.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 15000
        });

        const data = response.data || {};
        if (!data.access_token) {
            return res.status(400).json({ ok: false, error: 'No access_token in response', data });
        }

        const payload = {
            access_token: data.access_token,
            token_type: data.token_type || 'Bearer',
            expires_in: data.expires_in || null,
            refresh_token: data.refresh_token || null,
            created_at: new Date().toISOString()
        };

        await adminStateStore.setKey('diadoc_oauth', payload);

        res.json({ ok: true, stored: true, token_type: payload.token_type, expires_in: payload.expires_in });
    } catch (e) {
        const status = e.response?.status;
        const details = e.response?.data || null;
        res.status(status || 500).json({ ok: false, error: e.message, details });
    }
});

router.get('/oauth/test', async (req, res) => {
    try {
        const apiUrl = process.env.DIADOC_API_URL || 'https://diadoc-api.kontur.ru';
        const stored = await adminStateStore.getKey('diadoc_oauth');
        const token = stored?.access_token;
        if (!token) {
            return res.status(400).json({ ok: false, error: 'No stored access_token. Call POST /api/diadoc/oauth/exchange first.' });
        }
        const resp = await axios.get(`${apiUrl}/GetMyOrganizations`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 15000
        });
        res.json({ ok: true, data: resp.data });
    } catch (e) {
        const status = e.response?.status;
        const details = e.response?.data || e.response?.text || null;
        res.status(status || 500).json({ ok: false, error: e.message, details });
    }
});

module.exports = router;
