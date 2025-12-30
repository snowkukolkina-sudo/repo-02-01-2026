const path = require('path');
const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const yaml = require('js-yaml');

const store = require('../services/import_store');
const queue = require('../services/import_queue');
const connector = require('../services/catalog_connector');
const fuzzyMatcher = require('../services/fuzzy_matcher');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const TARGET_FIELDS = [
    'external_id',
    'sku',
    'name',
    'category_list',
    'price',
    'old_price',
    'quantity',
    'short_description',
    'description',
    'image_url',
    'weight',
    'length',
    'width',
    'height',
    'is_visible',
    'parameters',
    'parent_id',
    'modifiers',
    'description_url'
];

const SAMPLE_DATA = [
    {
        product_id: 'KM-12345',
        barcode: '4601234567890',
        title: 'Чай улун Те Гуань Инь',
        category: 'Чай;Зелёный чай',
        price: 799,
        quantity: 25,
        description: 'Китай, Фуцзянь',
        images: 'https://example.com/img1.jpg;https://example.com/img2.jpg'
    },
    {
        product_id: 'ING-9087',
        barcode: '4680012345678',
        title: 'Соус томатный для пиццы',
        category: 'Ингредиенты;Соусы',
        price: 189,
        quantity: 48,
        description: 'Банка 1 л',
        images: ''
    }
];

store.ensureStorage().catch((error) => {
    console.error('[ImportBackend] Не удалось подготовить каталог хранения импорта', error);
});

function detectDelimiter(buffer) {
    const sample = buffer.slice(0, 1024).toString('utf8');
    if (sample.indexOf('\t') !== -1) return '\t';
    if (sample.indexOf(';') !== -1) return ';';
    return ',';
}

function parseCsv(buffer) {
    const delimiter = detectDelimiter(buffer);
    const records = parse(buffer.toString('utf8'), {
        delimiter,
        skip_empty_lines: true
    });
    const headers = records[0] || [];
    const rows = records.slice(1);
    return { headers, rows };
}

function parseXlsx(buffer) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // Проверяем, что workbook содержит листы
    if (!workbook || !workbook.SheetNames || !Array.isArray(workbook.SheetNames) || workbook.SheetNames.length === 0) {
        throw new Error('Файл не содержит листов или поврежден. Убедитесь, что это корректный Excel файл.');
    }
    
    const firstSheet = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheet];
    
    if (!worksheet) {
        throw new Error(`Не удалось прочитать данные из листа "${firstSheet}".`);
    }
    
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
    const headers = rows[0] || [];
    return { headers, rows: rows.slice(1) };
}

function parseYml(buffer) {
    const doc = yaml.load(buffer.toString('utf8'));
    const offers = doc?.shop?.offers?.offer || [];
    const rows = Array.isArray(offers) ? offers : [offers];
    if (!rows.length) {
        return { headers: [], rows: [] };
    }
    
    // Обрабатываем каждый offer для нормализации данных
    const normalizedRows = rows.map((offer) => {
        const normalized = {};
        const params = [];
        
        // Обрабатываем все поля из offer
        Object.keys(offer).forEach(key => {
            const value = offer[key];
            
            // Обработка параметров (param)
            if (key === 'param' || key === 'parameters') {
                const paramArray = Array.isArray(value) ? value : [value];
                paramArray.forEach(param => {
                    if (param && typeof param === 'object') {
                        const paramName = param.name || param._name || param.$?.name || '';
                        let paramValue = param.value || param._text || param.$?.value || '';
                        
                        // Если значение - объект, пытаемся извлечь текст
                        if (paramValue && typeof paramValue === 'object' && paramValue._text) {
                            paramValue = paramValue._text;
                        }
                        
                        if (paramName && paramValue) {
                            // Сохраняем параметр в массив
                            params.push({ name: paramName, value: paramValue });
                            // Также добавляем как отдельное поле для удобства
                            normalized[`param_${paramName.toLowerCase().replace(/\s+/g, '_')}`] = paramValue;
                        }
                    }
                });
                // Сохраняем параметры как JSON для последующей обработки
                normalized.parameters = JSON.stringify(params);
            }
            // Если значение - объект с _text (XML структура), извлекаем текст
            else if (value && typeof value === 'object' && value._text) {
                normalized[key] = value._text;
            } 
            // Если значение - массив, обрабатываем специально
            else if (Array.isArray(value) && value.length > 0) {
                // Для массивов изображений сохраняем как строку с разделителем
                if (key === 'picture' || key === 'image' || key === 'image_url') {
                    normalized[key] = value.map(v => {
                        if (typeof v === 'object' && v._text) return v._text;
                        if (typeof v === 'object' && v.url) return v.url;
                        return String(v);
                    }).filter(Boolean).join(';');
                } else {
                    normalized[key] = value[0];
                }
            }
            // Если значение - объект, пытаемся извлечь текст или сериализуем
            else if (value && typeof value === 'object') {
                // Для вложенных объектов (например, category) извлекаем name или id
                if (value.name) {
                    normalized[key] = value.name;
                } else if (value._text) {
                    normalized[key] = value._text;
                } else {
                    normalized[key] = JSON.stringify(value);
                }
            }
            else {
                normalized[key] = value;
            }
        });
        
        // ✅ КРИТИЧНО: Извлекаем weight напрямую из offer.weight (из тега <weight>)
        if (offer.weight !== undefined && offer.weight !== null) {
            const weightValue = String(offer.weight).trim();
            if (weightValue) {
                // Преобразуем вес: если в килограммах (0.125), оставляем как есть для дальнейшей конвертации
                normalized.weight = weightValue;
            }
        }
        
        // ✅ КРИТИЧНО: Извлекаем calories напрямую из offer.calories (если есть тег <calories>)
        if (offer.calories !== undefined && offer.calories !== null) {
            const caloriesValue = String(offer.calories).trim();
            if (caloriesValue) {
                normalized.calories = caloriesValue;
            }
        }
        
        // Также извлекаем вес и калории из параметров (если не нашли напрямую)
        params.forEach(param => {
            const nameLower = param.name.toLowerCase();
            const value = param.value;
            
            // Вес из параметров (только если не найден напрямую)
            if (!normalized.weight && (nameLower.includes('вес') || nameLower.includes('weight') || nameLower === 'вес')) {
                normalized.weight = value;
            }
            // Калорийность из параметров (только если не найдены напрямую)
            if (!normalized.calories && (nameLower.includes('калори') || nameLower.includes('калорий') || nameLower.includes('calor') || nameLower === 'калорийность')) {
                normalized.calories = value;
            }
        });
        
        // Специальная обработка для description - объединяем все варианты
        if (!normalized.description) {
            normalized.description = normalized.description_full || 
                                    normalized.description_detail || 
                                    normalized.desc || 
                                    '';
        }
        
        // Специальная обработка для category - извлекаем название
        if (normalized.category && typeof normalized.category === 'object') {
            normalized.category = normalized.category.name || normalized.category._text || '';
        }
        
        // Обрабатываем categoryId как отдельное поле
        if (normalized.categoryId && typeof normalized.categoryId === 'object') {
            normalized.categoryId = normalized.categoryId._text || normalized.categoryId;
        }
        
        return normalized;
    });
    
    // Собираем все уникальные ключи
    const allKeys = new Set();
    normalizedRows.forEach(row => {
        Object.keys(row).forEach(key => allKeys.add(key));
    });
    const columns = Array.from(allKeys);
    
    // Преобразуем в массив массивов
    const dataRows = normalizedRows.map((row) => columns.map((key) => {
        const val = row[key];
        // Сериализуем объекты в JSON
        if (val && typeof val === 'object' && !Array.isArray(val)) {
            return JSON.stringify(val);
        }
        return val || '';
    }));
    
    return { headers: columns, rows: dataRows };
}

router.get('/config', (req, res) => {
    res.json({
        ok: true,
        targetFields: TARGET_FIELDS
    });
});

router.get('/sample', (req, res) => {
    res.json({
        ok: true,
        headers: Object.keys(SAMPLE_DATA[0]),
        rows: SAMPLE_DATA.map((item) => Object.values(item)),
        totalRows: SAMPLE_DATA.length,
        truncated: false,
        jobId: null,
        message: 'Демонстрационный набор. После загрузки файла появятся реальные данные.'
    });
});

router.post('/parse', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ ok: false, error: 'Файл не найден. Выберите CSV, Excel или YML.' });
    }
    try {
        const mimetype = req.file.mimetype || '';
        const originalName = req.file.originalname || '';
        const ext = (originalName.split('.').pop() || '').toLowerCase();

        const { id: jobId, jobDir, meta } = await store.createJob({
            filename: originalName,
            mimetype,
            size: req.file.size
        });
        await queue.registerJob(jobId, { meta });

        const safeName = originalName || `upload.${ext || 'bin'}`;
        const filePath = await store.saveOriginalFile(jobDir, req.file.buffer, safeName);
        await store.appendLog(jobDir, {
            level: 'info',
            message: `Файл сохранён (${safeName}, ${mimetype || 'mime/unknown'})`
        });
        const metaUpdate = { filePath, filename: safeName };

        let result;
        // КРИТИЧНО: Сначала проверяем расширение файла для YML, чтобы избежать обработки YML как Excel
        if (ext === 'yml' || ext === 'yaml') {
            result = parseYml(req.file.buffer);
        } else if (mimetype === 'text/csv' || ext === 'csv' || ext === 'txt') {
            result = parseCsv(req.file.buffer);
        } else if (
            mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            mimetype === 'application/vnd.ms-excel' ||
            ext === 'xls' ||
            ext === 'xlsx'
        ) {
            result = parseXlsx(req.file.buffer);
        } else if (mimetype === 'application/pdf' || mimetype.startsWith('image/')) {
            await queue.setJobStatus(jobId, 'queued', metaUpdate);
            queue.enqueue(jobId, { filePath, mimetype, originalName: safeName });
            return res.json({
                ok: true,
                status: 'processing',
                jobId,
                message: 'Файл отправлен в очередь OCR/CV. Следите за статусом.',
                meta: { filename: safeName }
            });
        } else {
            await queue.setJobStatus(jobId, 'failed', {
                error: 'unsupported_format',
                filename: safeName
            });
            return res.status(415).json({
                ok: false,
                error: 'Формат файла не поддерживается. Допускаются CSV, XLSX, YML, PDF, изображения.'
            });
        }

        const rows = result.rows.slice(0, 200);
        await queue.setJobStatus(jobId, 'processing', metaUpdate);
        const analysis = fuzzyMatcher.analyseDataset(result.headers, result.rows);
        await store.writeMetrics(jobDir, analysis.metrics);
        await store.appendLog(jobDir, {
            level: 'info',
            message: `Fuzzy-matching подготовил ${analysis.metrics.withSuggestions}/${analysis.metrics.rowsTotal} строк`
        });
        await queue.registerImmediateResult(jobId, {
            headers: result.headers,
            rows: result.rows,
            totalRows: result.rows.length,
            truncated: false,
            source: safeName,
            matches: analysis.suggestions,
            metrics: analysis.metrics
        });

        res.json({
            ok: true,
            status: 'completed',
            jobId,
            headers: result.headers,
            rows,
            totalRows: result.rows.length,
            truncated: result.rows.length > rows.length,
            message: 'Файл обработан синхронно.',
            matches: analysis.suggestions.slice(0, 50),
            metrics: analysis.metrics
        });
    } catch (error) {
        console.error('[ImportBackend] parse error', error);
        res.status(500).json({ ok: false, error: 'Ошибка при разборе файла: ' + error.message });
    }
});

router.get('/jobs/:jobId', async (req, res) => {
    const { jobId } = req.params;
    const job = queue.getJob(jobId);
    if (!job) {
        return res.status(404).json({ ok: false, error: 'Задание не найдено' });
    }
    const [result, logs, metrics, manualMatches] = await Promise.all([
        store.readResult(job.jobDir),
        store.readLog(job.jobDir),
        store.readMetrics(job.jobDir),
        store.readMatches(job.jobDir)
    ]);
    res.json({
        ok: true,
        jobId,
        status: job.status,
        meta: job.meta,
        result,
        logs,
        metrics,
        manualMatches
    });
});

router.post('/publish', express.json(), async (req, res) => {
    const { jobId, mapping, provider, matchDecisions } = req.body || {};
    if (!jobId || !mapping || typeof mapping !== 'object') {
        return res.status(400).json({ ok: false, error: 'Укажите jobId и объект mapping.' });
    }

    const job = queue.getJob(jobId);
    if (!job) {
        return res.status(404).json({ ok: false, error: 'Задание не найдено.' });
    }
    if (job.status !== 'completed') {
        return res.status(409).json({ ok: false, error: 'Задание ещё выполняется. Дождитесь завершения обработки.' });
    }

    const dataset = await store.readResult(job.jobDir);
    if (!dataset || !Array.isArray(dataset.headers) || !Array.isArray(dataset.rows)) {
        return res.status(400).json({ ok: false, error: 'Результат задания не содержит таблицу.' });
    }

    const headerIndex = dataset.headers.reduce((acc, header, idx) => {
        acc[header] = idx;
        return acc;
    }, {});

    const decisions = matchDecisions && typeof matchDecisions === 'object' ? matchDecisions : {};

    const records = dataset.rows.map((row, rowIndex) => {
        const record = {};
        Object.entries(mapping).forEach(([sourceColumn, targetField]) => {
            if (!targetField) return;
            const idx = headerIndex[sourceColumn];
            if (typeof idx === 'number') {
                record[targetField] = row[idx] ?? '';
            }
        });
        if (decisions[rowIndex]) {
            record.__match = decisions[rowIndex];
        }
        return record;
    });

    const filteredRecords = records.filter((item) => Object.keys(item).length > 0);

    if (decisions && Object.keys(decisions).length) {
        await store.writeMatches(job.jobDir, decisions);
        await store.appendLog(job.jobDir, {
            level: 'info',
            message: `Зафиксированы решения модерации по ${Object.keys(decisions).length} строкам`
        });
    }

    await store.appendLog(job.jobDir, {
        level: 'info',
        message: `Подготовлено к публикации: ${filteredRecords.length} записей`
    });

    const publishResult = await connector.publish(job, provider, {
        provider,
        mapping,
        source: dataset.source || job.meta?.filename,
        records: filteredRecords,
        total: filteredRecords.length,
        matchDecisions: decisions
    });

    res.json({
        ok: true,
        published: filteredRecords.length,
        connector: publishResult,
        matchDecisions: decisions
    });
});

module.exports = router;

