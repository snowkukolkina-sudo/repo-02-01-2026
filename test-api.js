#!/usr/bin/env node

/**
 * Скрипт для проверки API endpoints после миграции на серверные storage
 * 
 * Использование:
 *   node test-api.js
 * 
 * Или с указанием базового URL:
 *   node test-api.js http://localhost:3000
 */

const http = require('http');
const https = require('https');

const BASE_URL = process.argv[2] || 'http://localhost:3000';

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(url, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const client = urlObj.protocol === 'https:' ? https : http;
        
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (body) {
            options.headers['Content-Length'] = Buffer.byteLength(body);
        }

        const req = client.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const json = data ? JSON.parse(data) : {};
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: json
                    });
                } catch (error) {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: data
                    });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (body) {
            req.write(body);
        }

        req.end();
    });
}

async function testEndpoint(name, url, method = 'GET', body = null, expectedStatus = 200) {
    try {
        log(`\n🔍 Тестирую: ${name}`, 'cyan');
        log(`   ${method} ${url}`, 'blue');
        
        const response = await makeRequest(url, method, body);
        const success = response.status === expectedStatus && 
                       (response.body?.ok !== false);
        
        if (success) {
            log(`   ✅ Успешно (${response.status})`, 'green');
            if (response.body && typeof response.body === 'object') {
                const keys = Object.keys(response.body).slice(0, 3);
                log(`   Данные: ${keys.join(', ')}${keys.length < Object.keys(response.body).length ? '...' : ''}`, 'blue');
            }
            return true;
        } else {
            log(`   ❌ Ошибка (${response.status})`, 'red');
            if (response.body?.error) {
                log(`   Сообщение: ${response.body.error}`, 'yellow');
            }
            return false;
        }
    } catch (error) {
        log(`   ❌ Ошибка соединения: ${error.message}`, 'red');
        return false;
    }
}

async function runTests() {
    log('\n🚀 Запуск проверки API endpoints...\n', 'cyan');
    log(`Базовый URL: ${BASE_URL}\n`, 'blue');

    const results = {
        passed: 0,
        failed: 0,
        tests: []
    };

    // Admin State API
    log('\n📦 Admin State API', 'yellow');
    results.tests.push(await testEndpoint(
        'Health check',
        `${BASE_URL}/api/admin-state/health`
    ));
    results.tests.push(await testEndpoint(
        'Bootstrap',
        `${BASE_URL}/api/admin-state/bootstrap`
    ));
    results.tests.push(await testEndpoint(
        'Get promotions',
        `${BASE_URL}/api/admin-state/keys/promotions`
    ));
    results.tests.push(await testEndpoint(
        'Get alerts',
        `${BASE_URL}/api/admin-state/keys/alerts`
    ));
    results.tests.push(await testEndpoint(
        'Get alert settings',
        `${BASE_URL}/api/admin-state/keys/alert_settings`
    ));
    results.tests.push(await testEndpoint(
        'Get reports',
        `${BASE_URL}/api/admin-state/keys/reports`
    ));

    // Inventory API
    log('\n📦 Inventory API', 'yellow');
    results.tests.push(await testEndpoint(
        'Bootstrap inventory',
        `${BASE_URL}/api/inventory/bootstrap`
    ));
    results.tests.push(await testEndpoint(
        'Get products',
        `${BASE_URL}/api/inventory/products`
    ));

    // Loyalty API
    log('\n📦 Loyalty API', 'yellow');
    results.tests.push(await testEndpoint(
        'Get loyalty config',
        `${BASE_URL}/api/loyalty/config`
    ));
    results.tests.push(await testEndpoint(
        'Get loyalty stats',
        `${BASE_URL}/api/loyalty/stats`
    ));

    // Подсчёт результатов
    results.passed = results.tests.filter(r => r === true).length;
    results.failed = results.tests.filter(r => r === false).length;

    // Итоги
    log('\n' + '='.repeat(50), 'cyan');
    log('📊 Результаты проверки:', 'cyan');
    log(`   ✅ Успешно: ${results.passed}`, 'green');
    log(`   ❌ Ошибок: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
    log(`   📈 Всего: ${results.tests.length}`, 'blue');
    log('='.repeat(50) + '\n', 'cyan');

    if (results.failed === 0) {
        log('🎉 Все тесты пройдены успешно!', 'green');
        process.exit(0);
    } else {
        log('⚠️  Некоторые тесты не прошли. Проверьте конфигурацию сервера.', 'yellow');
        process.exit(1);
    }
}

// Запуск
runTests().catch((error) => {
    log(`\n❌ Критическая ошибка: ${error.message}`, 'red');
    process.exit(1);
});

