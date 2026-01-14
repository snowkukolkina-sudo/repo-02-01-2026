const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');

const router = express.Router();
router.use(express.json({ limit: '1mb' }));

const SETTINGS_FILE = path.join(process.cwd(), 'storage', 'integrations', 'settings.json');

function ok(data = null) {
    return { ok: true, data };
}

function fail(error, status = 400, details = null) {
    return { ok: false, error, status, details };
}

async function ensureSettingsFile() {
    await fs.ensureDir(path.dirname(SETTINGS_FILE));
    if (!(await fs.pathExists(SETTINGS_FILE))) {
        await fs.writeJson(SETTINGS_FILE, {}, { spaces: 2 });
    }
}

async function loadSettings() {
    await ensureSettingsFile();
    try {
        const json = await fs.readJson(SETTINGS_FILE);
        return json && typeof json === 'object' ? json : {};
    } catch (_) {
        return {};
    }
}

async function saveSettings(settings) {
    await ensureSettingsFile();
    await fs.writeJson(SETTINGS_FILE, settings || {}, { spaces: 2 });
}

function normalizeIntegrationConfig(integrationData) {
    if (!integrationData || typeof integrationData !== 'object') return { enabled: false, config: {} };
    const enabled = Boolean(integrationData.enabled);
    const config = integrationData.config && typeof integrationData.config === 'object'
        ? integrationData.config
        : integrationData;
    return { enabled, config };
}

function isConfigured(integration, config) {
    const get = (k) => (config && config[k] !== undefined && config[k] !== null ? String(config[k]).trim() : '');
    switch (integration) {
        case 'egais':
            return Boolean(get('fsrar_id') && get('inn') && get('kpp'));
        case 'mercury':
            return Boolean(get('api_key') && get('login') && get('issuer_id'));
        case 'honest_sign':
            return Boolean(get('token') && get('participant_inn'));
        case 'erp_1c':
            return Boolean(get('base_url') && get('username') && get('password'));
        case 'yandex_eda':
            return Boolean(get('client_id') && get('secret'));
        case 'delivery_club':
            return Boolean(get('restaurant_id') && get('api_key'));
        case 'onec':
            return Boolean(get('connectionString') || get('base_url') || get('url'));
        case 'rkeeper':
            return Boolean(get('serverUrl') || get('host'));
        case 'kontur':
            return Boolean(get('apiKey') || get('api_key'));
        default:
            return false;
    }
}

function probeUrlForIntegration(integration, config) {
    const get = (k) => (config && config[k] !== undefined && config[k] !== null ? String(config[k]).trim() : '');
    switch (integration) {
        case 'egais':
            return get('api_url') || 'https://fsrar.gov.ru';
        case 'mercury':
            return get('api_url') || 'https://api.vetrf.ru';
        case 'honest_sign':
            return get('api_url') || 'https://markirovka.crpt.ru';
        case 'erp_1c':
            return get('base_url');
        case 'yandex_eda':
            return get('webhook_url');
        case 'delivery_club':
            return get('webhook_url');
        case 'onec':
            return get('base_url') || get('url');
        case 'rkeeper':
            return get('serverUrl') || get('host');
        case 'kontur':
            return get('apiUrl') || get('api_url');
        default:
            return '';
    }
}

async function probe(url, headers = {}) {
    if (!url) {
        return { connected: false, http_code: null, message: 'No URL to probe' };
    }

    try {
        const resp = await axios.request({
            url,
            method: 'HEAD',
            timeout: 10000,
            headers,
            validateStatus: () => true
        });
        return {
            connected: resp.status >= 200 && resp.status < 500,
            http_code: resp.status,
            message: 'Connection probe ok'
        };
    } catch (e) {
        // fallback GET (some servers may not support HEAD)
        try {
            const resp = await axios.request({
                url,
                method: 'GET',
                timeout: 10000,
                headers,
                validateStatus: () => true
            });
            return {
                connected: resp.status >= 200 && resp.status < 500,
                http_code: resp.status,
                message: 'Connection probe ok'
            };
        } catch (e2) {
            return {
                connected: false,
                http_code: null,
                message: 'Connection probe failed: ' + (e2.response?.data || e2.message)
            };
        }
    }
}

router.get('/settings', async (req, res) => {
    try {
        const settings = await loadSettings();
        res.json(ok(settings));
    } catch (e) {
        res.status(500).json(fail('Failed to load settings', 500, e.message));
    }
});

router.post('/settings', async (req, res) => {
    try {
        const data = req.body?.data;
        if (!data || typeof data !== 'object') {
            return res.status(400).json(fail('Invalid settings data', 400));
        }
        await saveSettings(data);
        res.json(ok(data));
    } catch (e) {
        res.status(500).json(fail('Failed to save settings', 500, e.message));
    }
});

router.get('/status', async (req, res) => {
    try {
        const settings = await loadSettings();
        const status = {};
        Object.keys(settings || {}).forEach((key) => {
            const normalized = normalizeIntegrationConfig(settings[key]);
            status[key] = {
                enabled: Boolean(normalized.enabled),
                configured: isConfigured(key, normalized.config),
                connected: false,
                lastSync: settings[key]?.lastSync || null,
                syncStatus: 'idle'
            };
        });
        res.json(ok(status));
    } catch (e) {
        res.status(500).json(fail('Failed to get status', 500, e.message));
    }
});

router.post('/test', async (req, res) => {
    try {
        const integration = String(req.body?.integration || '').trim();
        if (!integration) {
            return res.status(400).json(fail('Invalid test data', 400));
        }

        const settings = await loadSettings();
        const integrationData = settings[integration] || null;
        const { enabled, config } = normalizeIntegrationConfig(integrationData);

        const out = {
            integration,
            timestamp: new Date().toISOString(),
            enabled,
            configured: false,
            connected: false,
            http_code: null,
            message: ''
        };

        if (!enabled) {
            out.message = 'Integration is disabled';
            return res.json(ok(out));
        }

        out.configured = isConfigured(integration, config);
        if (!out.configured) {
            out.message = 'Integration is not configured';
            return res.json(ok(out));
        }

        const url = probeUrlForIntegration(integration, config);
        const headers = {};
        if (integration === 'honest_sign' && config && config.token) {
            headers.Authorization = 'Bearer ' + String(config.token);
        }

        const pr = await probe(url, headers);
        out.connected = pr.connected;
        out.http_code = pr.http_code;
        out.message = pr.message;

        return res.json(ok(out));
    } catch (e) {
        res.status(500).json(fail('Test failed', 500, e.message));
    }
});

module.exports = router;
