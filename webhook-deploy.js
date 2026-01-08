#!/usr/bin/env node

/**
 * Webhook сервер для автоматического деплоя при push в GitHub
 * Запуск: node webhook-deploy.js
 * Порт: 9000 (настраивается через WEBHOOK_PORT)
 */

const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');

const PORT = process.env.WEBHOOK_PORT || 9000;
const SECRET = process.env.WEBHOOK_SECRET || 'your-webhook-secret';
const DEPLOY_SCRIPT = '/var/www/testdandypizza/deploy.sh';

// Проверка подписи GitHub
function verifySignature(payload, signature) {
    if (!signature) return false;

    const hmac = crypto.createHmac('sha256', SECRET);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');

    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(digest)
    );
}

// Выполнение деплоя
function executeDeploy() {
    console.log('🚀 Запуск скрипта деплоя...');

    const deploy = spawn('bash', [DEPLOY_SCRIPT], {
        stdio: 'inherit'
    });

    deploy.on('exit', (code) => {
        if (code === 0) {
            console.log('✅ Деплой завершён успешно');
        } else {
            console.error(`❌ Деплой завершился с ошибкой: ${code}`);
        }
    });
}

// HTTP сервер
const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/webhook') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
    }

    let body = '';

    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', () => {
        const signature = req.headers['x-hub-signature-256'];

        // Проверяем подпись (если настроен SECRET)
        if (SECRET !== 'your-webhook-secret' && !verifySignature(body, signature)) {
            console.error('❌ Неверная подпись webhook');
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid signature' }));
            return;
        }

        try {
            const payload = JSON.parse(body);

            // Проверяем событие push в ветку main
            if (payload.ref === 'refs/heads/main') {
                console.log(`📦 Получен push от ${payload.pusher.name}`);
                console.log(`📝 Коммит: ${payload.head_commit.message}`);

                executeDeploy();

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'success',
                    message: 'Deploy started'
                }));
            } else {
                console.log(`ℹ️ Игнорируем push в ветку ${payload.ref}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'ignored',
                    message: 'Not main branch'
                }));
            }
        } catch (err) {
            console.error('❌ Ошибка обработки webhook:', err);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid payload' }));
        }
    });
});

server.listen(PORT, () => {
    console.log(`🎣 Webhook сервер запущен на порту ${PORT}`);
    console.log(`📍 Endpoint: http://localhost:${PORT}/webhook`);
    console.log(`🔐 Secret: ${SECRET === 'your-webhook-secret' ? '⚠️ НЕ НАСТРОЕН' : '✅ Настроен'}`);
});

// Обработка сигналов завершения
process.on('SIGINT', () => {
    console.log('\n👋 Остановка webhook сервера...');
    server.close(() => {
        process.exit(0);
    });
});
