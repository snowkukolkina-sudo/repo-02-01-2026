const path = require('path');
const fs = require('fs-extra');
const { imageSize } = require('image-size');
const store = require('./import_store');

const SAMPLE_HEADERS = [
    'Артикул',
    'Штрихкод',
    'Наименование',
    'Категория',
    'Цена',
    'Количество',
    'Описание'
];

const SAMPLE_ROWS = [
    ['KM-12345', '4601234567890', 'Чай улун Те Гуань Инь', 'Чай;Зелёный чай', '799', '25', 'Китай, Фуцзянь'],
    ['ING-9087', '4680012345678', 'Соус томатный для пиццы', 'Ингредиенты;Соусы', '189', '48', 'Банка 1 л'],
    ['BLD-5578', '4680022223456', 'Пицца Маргарита 30 см', 'Готовые блюда;Пицца', '529', '12', 'Томаты, сыр моцарелла']
];

async function evaluateQuality(job) {
    const provider = process.env.OCR_PROVIDER || 'stub';
    const filePath = job.payload.filePath;
    const ext = path.extname(filePath).toLowerCase();
    const stats = await fs.stat(filePath);
    const quality = {
        provider,
        fileType: ext.replace('.', '') || 'unknown',
        sizeKb: Math.round(stats.size / 1024),
        warnings: []
    };

    if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
        try {
            const dimensions = imageSize(filePath);
            quality.resolution = { width: dimensions.width, height: dimensions.height };
            if (dimensions.width < 600 || dimensions.height < 600) {
                quality.warnings.push('Низкое разрешение изображения — возможны ошибки OCR');
            }
        } catch (error) {
            quality.warnings.push('Не удалось определить разрешение изображения: ' + error.message);
        }
    } else if (ext === '.pdf') {
        quality.warnings.push('Для PDF требуется подключенный OCR-сервис (Textract/Vision/Yandex).');
    }

    return quality;
}

async function simulateOcr(job) {
    const quality = await evaluateQuality(job);
    await store.appendLog(job.jobDir, {
        level: 'info',
        message: 'Используется заглушка OCR (configure OCR_PROVIDER для реальной интеграции)'
    });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return {
        headers: SAMPLE_HEADERS,
        rows: SAMPLE_ROWS,
        totalRows: SAMPLE_ROWS.length,
        truncated: false,
        source: path.basename(job.payload.filePath),
        quality
    };
}

async function processWithProvider(job, provider) {
    const normalized = provider.toLowerCase();
    switch (normalized) {
        case 'textract':
        case 'aws-textract':
            await store.appendLog(job.jobDir, { level: 'warn', message: 'Textract не настроен. Укажите AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.' });
            return simulateOcr(job);
        case 'vision':
        case 'google':
            await store.appendLog(job.jobDir, { level: 'warn', message: 'Google Vision не настроен. Добавьте интеграцию и расчёт таблиц.' });
            return simulateOcr(job);
        case 'yandex':
        case 'yandex-ocr':
            await store.appendLog(job.jobDir, { level: 'warn', message: 'Yandex Vision не настроен. Добавьте API-ключ и обработку таблиц.' });
            return simulateOcr(job);
        default:
            return simulateOcr(job);
    }
}

async function advancedOcr(job) {
    const provider = process.env.OCR_PROVIDER;
    if (!provider || provider === 'stub') {
        return simulateOcr(job);
    }

    const result = await processWithProvider(job, provider);
    if (!result.quality) {
        result.quality = await evaluateQuality(job);
    }
    return result;
}

module.exports = {
    process: async (job) => {
        if (!job || !job.payload || !job.payload.filePath) {
            throw new Error('Некорректные параметры задания OCR');
        }
        const exists = await fs.pathExists(job.payload.filePath);
        if (!exists) {
            throw new Error(`Файл ${job.payload.filePath} не найден`);
        }
        return advancedOcr(job);
    }
};

