const path = require('path');
const express = require('express');
const dotenv = require('dotenv');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');

dotenv.config();

const app = express();

// -----------------------------
// PHP API bridge
// -----------------------------
// Default OFF: production Node hosting may not have PHP (e.g. reg.ru Node app)
// Enable explicitly with USE_PHP_API=1 when you have a PHP runtime.
const USE_PHP_API = String(process.env.USE_PHP_API || '0') !== '0';
const PHP_HOST = process.env.PHP_HOST || '127.0.0.1';
const PHP_PORT = parseInt(process.env.PHP_PORT || '9000', 10);
const PHP_INDEX_URL = process.env.PHP_INDEX_URL || `http://${PHP_HOST}:${PHP_PORT}/api/index.php`;
const START_PHP = String(process.env.START_PHP || '0') === '1';

let phpProc = null;
if (USE_PHP_API && START_PHP) {
    try {
        const phpBin = process.env.PHP_BIN || 'php';
        phpProc = spawn(phpBin, ['-S', `${PHP_HOST}:${PHP_PORT}`, '-t', __dirname], {
            stdio: 'inherit',
            windowsHide: true
        });
        phpProc.on('exit', (code) => {
            console.log(`[PHP] exited with code ${code}`);
        });
        console.log(`[PHP] started built-in server at http://${PHP_HOST}:${PHP_PORT}`);
    } catch (e) {
        console.warn('[PHP] failed to start built-in server. Start PHP manually or set USE_PHP_API=0.', e.message);
    }
}

const proxyToPhpIndex = (req, res) => {
    const target = new URL(PHP_INDEX_URL);
    const client = target.protocol === 'https:' ? https : http;

    const headers = { ...req.headers };
    // Preserve original URI for routing inside api/index.php
    headers['x-original-uri'] = req.originalUrl;
    // Host should match upstream
    headers['host'] = target.host;

    const options = {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        method: req.method,
        path: target.pathname + (target.search || ''),
        headers
    };

    const proxyReq = client.request(options, (proxyRes) => {
        res.statusCode = proxyRes.statusCode || 502;
        Object.entries(proxyRes.headers || {}).forEach(([k, v]) => {
            if (v !== undefined) res.setHeader(k, v);
        });
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
        res.status(502).json({ ok: false, error: 'PHP upstream error', message: err.message });
    });

    // Stream body (important for multipart uploads)
    req.pipe(proxyReq);
};

if (USE_PHP_API) {
    app.use((req, res, next) => {
        const url = req.originalUrl || '';
        // Keep Node static helper
        if (url.startsWith('/api/public')) return next();
        // Allow Node Diadoc OAuth helpers to stay local (optional)
        if (url.startsWith('/api/diadoc/oauth')) return next();
        // Proxy everything else under /api/* to PHP
        if (url.startsWith('/api/')) return proxyToPhpIndex(req, res);
        return next();
    });
}

// Body parsers for remaining Node endpoints (kept after PHP proxy for streaming)
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

const staticDir = path.join(__dirname, 'public');
app.use('/api/public', express.static(staticDir));

const storageDir = path.join(__dirname, 'storage');
app.use('/storage', express.static(storageDir));

const edoRouter = require('./api/edo_backend');
app.use('/api/edo', edoRouter);

const importRouter = require('./api/import_backend');
app.use('/api/import', importRouter);

const loyaltyRouter = require('./api/loyalty_backend');
app.use('/api/loyalty', loyaltyRouter);

const complianceRouter = require('./api/compliance_backend');
app.use('/api', complianceRouter);

const authRouter = require('./api/auth_backend');
app.use('/api/auth', authRouter);

const catalogRouter = require('./api/catalog_backend');
app.use('/api/catalog', catalogRouter);

const inventoryRouter = require('./api/inventory_backend');
app.use('/api/inventory', inventoryRouter);

const diadocRouter = require('./api/diadoc_backend');
app.use('/api/diadoc', diadocRouter);

const adminStateRouter = require('./api/admin_state_backend');
app.use('/api/admin-state', adminStateRouter);

const cashierRouter = require('./api/cashier_backend');
app.use('/api/cashier-report', cashierRouter);

const aggregatorRouter = require('./api/aggregator_backend');
app.use('/api/aggregators', aggregatorRouter);

const integrationsRouter = require('./api/integrations_backend');
app.use('/api/integrations', integrationsRouter);

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`[Server] Listening on port ${PORT}`);
});

process.on('SIGINT', () => {
    try {
        if (phpProc) phpProc.kill('SIGINT');
    } catch (_) {}
    process.exit(0);
});

