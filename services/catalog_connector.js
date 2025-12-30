const store = require('./import_store');

async function publishToRemote(provider, payload) {
    const fetchFn = typeof fetch === 'function' ? fetch : null;
    if (!fetchFn) {
        throw new Error('В этой версии Node отсутствует fetch. Обновите Node.js или установите polyfill.');
    }

    const baseUrl = process.env.CATALOG_CONNECTOR_URL;
    if (!baseUrl) {
        throw new Error('CATALOG_CONNECTOR_URL не задан. Укажите URL коннектора или используйте режим локального сохранения.');
    }

    const endpoint = `${baseUrl.replace(/\/$/, '')}/sync/import`;
    const response = await fetchFn(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Provider': provider || 'generic'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Коннектор вернул ошибку ${response.status}: ${text}`);
    }

    return response.json().catch(() => ({ ok: true }));
}

async function publishToLocal(jobDir, payload) {
    await store.appendLog(jobDir, {
        level: 'info',
        message: `Публикация сохранена локально (без коннектора). Записано ${payload.records?.length || 0} записей`
    });
    await store.writePublishResult(jobDir, {
        ...(payload || {}),
        publishedAt: new Date().toISOString()
    });
    return { ok: true, mode: 'local', count: payload.records?.length || 0 };
}

module.exports = {
    async publish(job, provider, payload) {
        try {
            if (!job) {
                throw new Error('Job не найден');
            }
            const result = await publishToRemote(provider, payload);
            await store.writePublishResult(job.jobDir, {
                ...(payload || {}),
                response: result,
                publishedAt: new Date().toISOString(),
                mode: 'remote'
            });
            await store.appendLog(job.jobDir, {
                level: 'info',
                message: `Отправлено в коннектор (${provider || 'generic'})`
            });
            return { ok: true, mode: 'remote', result };
        } catch (error) {
            await store.appendLog(job.jobDir, {
                level: 'warn',
                message: `Удалённый коннектор недоступен: ${error.message}. Результат сохранён локально.`
            });
            const fallback = await publishToLocal(job.jobDir, payload);
            return { ok: true, mode: fallback.mode, fallback };
        }
    }
};

