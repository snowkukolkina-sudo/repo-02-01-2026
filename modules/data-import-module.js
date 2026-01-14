// Data Import Module v7 - полностью оффлайн (без HTTP-запросов к /api/import/*)
(() => {
    const TARGET_TOKENS = [
        'external_id',
        'sku',
        'name',
        'category_list',
        'price',
        'quantity',
        'short_description',
        'description',
        'image_url'
    ];
    const PROVIDERS = [
        { value: 'local', label: 'Сохранить локально' },
        { value: 'moysklad', label: 'МойСклад' },
        { value: 'commerceml', label: '1С / CommerceML' },
        { value: 'kontur', label: 'Контур.Маркет' },
        { value: 'iiko', label: 'iiko' }
    ];
    const DEFAULT_MESSAGE = 'Загрузите CSV, Excel, YML, PDF или изображение, чтобы начать сопоставление.';
    const POLL_INTERVAL = 2000;

    const state = {
        isReady: false,
        isLoading: false,
        isPublishing: false,
        targetFields: [],
        columns: [],
        rows: [],
        totalRows: 0,
        truncated: false,
        mapping: {},
        message: DEFAULT_MESSAGE,
        status: 'idle',
        jobId: null,
        logs: [],
        provider: PROVIDERS[0].value,
        publishResult: null,
        meta: null,
        matches: [],
        matchDecisions: {},
        metrics: null,
        quality: null,
        remoteEvaluation: null,
        remoteLoading: false,
        lastSyncAt: null,
        apiMessage: null
    };

    let root = null;
    
    function getRoot() {
        if (!root) {
            root = document.getElementById('dataImportRoot');
        }
        return root;
    }

    function escapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    let pollTimer = null;

    function setState(patch) {
        Object.assign(state, patch);
        render();
    }

    function autoMapHeaders(headers) {
        return headers.reduce((acc, column) => {
            const normalized = column.toLowerCase();
            const candidate = state.targetFields.find((field) => normalized.includes(field));
            if (candidate) {
                acc[column] = candidate;
            }
            return acc;
        }, {});
    }

    function calculateProgress() {
        if (!state.columns.length) return 0;
        const mapped = state.columns.filter((col) => state.mapping[col]);
        return Math.round((mapped.length / state.columns.length) * 100);
    }

    function buildPreviewRecords() {
        if (!state.rows.length || !state.columns.length) return [];
        return state.rows.slice(0, 5).map((row) => {
            const record = {};
            state.columns.forEach((column, index) => {
                const target = state.mapping[column];
                if (target) {
                    record[target] = row[index];
                }
            });
            return record;
        });
    }

    // Конфиг больше не загружаем с сервера — используем только базовый список полей
    async function loadConfig() {
        setState({
            targetFields: TARGET_TOKENS,
            isReady: true
        });
    }

    // Демо-данные тоже больше не запрашиваем с сервера — всегда создаём локально
    async function loadSample() {
        const headers = ['external_id', 'sku', 'name', 'category_list', 'price', 'description', 'image_url'];
        const rows = [
            ['EXT001', 'SKU-001', 'Маргарита', 'Пицца', '599', 'Классическая пицца с томатами и моцареллой', 'https://example.com/pizza1.jpg'],
            ['EXT002', 'SKU-002', 'Пепперони', 'Пицца', '699', 'Пицца с колбасой пепперони', 'https://example.com/pizza2.jpg'],
            ['EXT003', 'SKU-003', 'Калифорния', 'Суши', '899', 'Ролл с авокадо и крабом', 'https://example.com/sushi1.jpg']
        ];
        const mapping = autoMapHeaders(headers);
        setState({
            isLoading: false,
            columns: headers,
            rows,
            totalRows: rows.length,
            truncated: false,
            mapping,
            status: 'sample',
            message: 'Загружены локальные демонстрационные данные.',
            matches: [],
            matchDecisions: {},
            metrics: null,
            quality: null
        });
    }

    function stopPolling() {
        if (pollTimer) {
            clearTimeout(pollTimer);
            pollTimer = null;
        }
    }

    async function pollJob(jobId) {
        if (!jobId) return;
        try {
            const resp = await fetch(`/api/import/jobs/${jobId}`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            const result = data.result || {};
            const headers = result.headers || state.columns;
            const rows = (result.rows || state.rows).slice(0, 200);
            const mapping = Object.keys(state.mapping).length ? state.mapping : autoMapHeaders(headers || []);
            const status = data.status || state.status;
            const matches = Array.isArray(result.matches) ? result.matches : state.matches;
            const metrics = result.metrics || data.metrics || state.metrics;
            const manualMatches = data.manualMatches || null;
            const mergedDecisions = manualMatches || state.matchDecisions;
            const quality = result.quality || state.quality;
            const message =
                status === 'processing'
                    ? 'Файл обрабатывается OCR/CV...'
                    : status === 'completed'
                        ? 'Файл распознан. Проверьте сопоставление перед публикацией.'
                        : state.message;

            setState({
                status,
                columns: headers,
                rows,
                totalRows: result.totalRows || rows.length,
                truncated: Boolean(result.truncated),
                mapping,
                logs: data.logs || state.logs,
                meta: data.meta || state.meta,
                message,
                matches,
                metrics,
                matchDecisions: mergedDecisions,
                quality
            });

            if (status === 'completed' || status === 'failed') {
                stopPolling();
                if (status === 'failed') {
                    setState({
                        message: data.meta?.error
                            ? `Ошибка обработки: ${data.meta.error}`
                            : 'Не удалось распознать файл. Проверьте лог.'
                    });
                }
            } else if (!pollTimer) {
                pollTimer = setTimeout(() => pollJob(jobId), POLL_INTERVAL);
            }
        } catch (error) {
            console.error('[DataImportModule] Polling error', error);
            stopPolling();
            setState({
                status: 'error',
                message: 'Ошибка проверки статуса. Обновите страницу или попробуйте позже.'
            });
        }
    }

    async function handleFileUpload(file) {
        if (!file) return;
        
        // Более надежное определение расширения файла
        const fileName = file.name || '';
        const fileExtension = fileName.split('.').pop()?.toLowerCase()?.trim() || '';
        const isExcel = ['xlsx', 'xls'].includes(fileExtension);
        const isYML = ['yml', 'yaml', 'xml'].includes(fileExtension);
        const isCSV = ['csv', 'txt'].includes(fileExtension);
        
        console.log('[DataImportModule] File upload detected:', {
            fileName: fileName,
            fileExtension: fileExtension,
            fileSize: file.size,
            isExcel: isExcel,
            isYML: isYML,
            isCSV: isCSV
        });
        
        // КРИТИЧНО: Если это YML, НЕ загружаем XLSX и НЕ обрабатываем как Excel
        if (isYML && !isExcel && !isCSV) {
            console.log('[DataImportModule] ✅ Confirmed YML/XML file, will parse as XML');
        }
        
        // Пытаемся загрузить XLSX только для Excel файлов
        if (isExcel && typeof XLSX === 'undefined') {
            console.warn('[DataImportModule] XLSX library not found, attempting to load...');
            
            if (typeof window.loadXLSX === 'function') {
                setState({
                    status: 'loading',
                    message: 'Загрузка библиотеки XLSX для обработки Excel файла...'
                });
                
                try {
                    const xlsxLib = await window.loadXLSX();
                    if (!xlsxLib && typeof XLSX === 'undefined') {
                        throw new Error('XLSX не загружена после вызова loadXLSX');
                    }
                    console.log('[DataImportModule] ✅ XLSX library loaded successfully');
                } catch (error) {
                    console.error('[DataImportModule] Failed to load XLSX:', error);
                    setState({
                        status: 'error',
                        message: 'Не удалось загрузить библиотеку XLSX. Пожалуйста, сохраните файл как CSV и попробуйте снова.'
                    });
                    return;
                }
            } else {
                console.error('[DataImportModule] XLSX library not found and loadXLSX function not available');
                setState({
                    status: 'error',
                    message: 'Библиотека XLSX не загружена. Для Excel файлов сохраните как CSV или обновите страницу.'
                });
                return;
            }
        }
        
        // Для CSV файлов XLSX не нужна
        if (!isExcel && typeof XLSX === 'undefined') {
            // Это нормально для CSV файлов
        }

        stopPolling();
        setState({
            isLoading: true,
            status: 'loading',
            message: `Разбираем файл "${file.name}" в браузере...`,
            columns: [],
            rows: [],
            jobId: null,
            logs: [],
            publishResult: null
        });

        try {
            // Обработка YML/XML файлов - должна быть первой, чтобы не попасть в блок Excel
            if (isYML) {
                console.log('[DataImportModule] ✅ YML/XML file detected, entering YML parsing block');
                console.log('[DataImportModule] Processing YML/XML file:', file.name, 'Extension:', fileExtension);
                
                // КРИТИЧНО: Убеждаемся, что это НЕ Excel файл
                if (isExcel) {
                    console.error('[DataImportModule] ❌ ERROR: File detected as both YML and Excel! Extension:', fileExtension);
                    throw new Error('Конфликт определения типа файла. Файл определен как YML и Excel одновременно.');
                }
                
                setState({
                    isLoading: true,
                    status: 'loading',
                    message: `Читаем YML файл "${file.name}"...`
                });
                
                let text;
                try {
                    text = await file.text();
                    console.log('[DataImportModule] YML file read, size:', text.length, 'bytes');
                } catch (error) {
                    console.error('[DataImportModule] Failed to read YML file:', error);
                    throw new Error('Не удалось прочитать файл: ' + error.message);
                }
                
                if (!text || text.length === 0) {
                    throw new Error('Файл пуст или поврежден.');
                }
                
                setState({
                    isLoading: true,
                    status: 'loading',
                    message: `Парсим XML/YML файл (${(text.length / 1024 / 1024).toFixed(2)} МБ)...`
                });
                
                // Парсим XML/YML
                let xmlDoc;
                try {
                    const parser = new DOMParser();
                    xmlDoc = parser.parseFromString(text, 'text/xml');
                } catch (error) {
                    throw new Error('Ошибка парсинга XML: ' + error.message);
                }
                
                // Проверяем на ошибки парсинга
                const parseError = xmlDoc.querySelector('parsererror');
                if (parseError) {
                    const errorText = parseError.textContent || 'Неизвестная ошибка парсинга';
                    throw new Error('Не удалось распарсить XML/YML файл: ' + errorText.substring(0, 200));
                }
                
                // Для YML формата Yandex Market ищем offers
                const offers = xmlDoc.querySelectorAll('offer');
                if (offers.length === 0) {
                    // Пробуем найти другие структуры
                    const items = xmlDoc.querySelectorAll('item, product, товар');
                    if (items.length === 0) {
                        throw new Error('Файл не содержит товаров (offers/items). Убедитесь, что это корректный YML файл.');
                    }
                }
                
                // Извлекаем данные из YML
                setState({
                    isLoading: true,
                    status: 'loading',
                    message: 'Извлекаем товары из YML...'
                });
                
                const rows = [];
                const allOffers = xmlDoc.querySelectorAll('offer, item, product, товар');
                
                if (allOffers.length === 0) {
                    throw new Error('Не найдено товаров в файле. Проверьте структуру YML файла.');
                }
                
                // Обрабатываем товары с прогрессом для больших файлов
                const totalOffers = allOffers.length;
                const batchSize = 100; // Обрабатываем по 100 товаров за раз
                
                for (let i = 0; i < totalOffers; i += batchSize) {
                    if (i % (batchSize * 10) === 0) {
                        setState({
                            isLoading: true,
                            status: 'loading',
                            message: `Обработано ${i} из ${totalOffers} товаров...`
                        });
                    }
                    
                    const batch = Array.from(allOffers).slice(i, i + batchSize);
                    batch.forEach((offer) => {
                        try {
                            // Проверяем, что offer является элементом (не текстовым узлом)
                            if (!offer || offer.nodeType !== 1) {
                                console.warn(`Пропущен не-элемент узел в позиции ${i}`);
                                return;
                            }
                            
                            const row = {};
                            
                            // ИСПРАВЛЕНИЕ: Используем childNodes вместо children и фильтруем только элементы
                            // Это решает проблему с текстовыми узлами между тегами (переносы строк, пробелы)
                            Array.from(offer.childNodes || [])
                                .filter(node => node.nodeType === 1) // ELEMENT_NODE = 1
                                .forEach(child => {
                                    const tagName = child.tagName;
                                    if (!tagName) return; // Дополнительная проверка
                                    
                                    // Для description и других текстовых полей сохраняем HTML структуру
                                    let value = '';
                                    if (tagName.toLowerCase() === 'description' || 
                                        tagName.toLowerCase() === 'desc' ||
                                        tagName.toLowerCase() === 'description_full') {
                                        // Сохраняем HTML содержимое для описания
                                        value = child.innerHTML || child.textContent || '';
                                    } else {
                                        // Для остальных полей берем только текст
                                        value = child.textContent?.trim() || '';
                                    }
                                    
                                    // Если уже есть такое поле, делаем массив
                                    if (row[tagName]) {
                                        if (!Array.isArray(row[tagName])) {
                                            row[tagName] = [row[tagName]];
                                        }
                                        row[tagName].push(value);
                                    } else {
                                        row[tagName] = value;
                                    }
                                });
                            
                            // Добавляем ID если есть атрибут id (с защитой)
                            if (offer.getAttribute && typeof offer.getAttribute === 'function') {
                                const idAttr = offer.getAttribute('id');
                                if (idAttr) {
                                    row['id'] = idAttr;
                                }
                            }
                            
                            // Добавляем другие атрибуты (с защитой)
                            if (offer.attributes && offer.attributes.length > 0) {
                                try {
                                    Array.from(offer.attributes).forEach(attr => {
                                        if (attr && attr.name && attr.name !== 'id') {
                                            row[attr.name] = attr.value || '';
                                        }
                                    });
                                } catch (attrError) {
                                    console.warn(`Ошибка обработки атрибутов для товара ${i}:`, attrError);
                                }
                            }
                            
                            if (Object.keys(row).length > 0) {
                                rows.push(row);
                            }
                        } catch (error) {
                            console.warn(`Ошибка обработки товара ${i}:`, error);
                            // Продолжаем обработку остальных товаров
                        }
                    });
                }
                
                if (rows.length === 0) {
                    throw new Error('Не удалось извлечь данные из YML файла.');
                }
                
                // Собираем все уникальные заголовки
                const allHeaders = new Set();
                rows.forEach(row => {
                    Object.keys(row).forEach(key => allHeaders.add(key));
                });
                const headers = Array.from(allHeaders);
                
                const initialMapping = autoMapHeaders(headers);
                
                console.log('[DataImportModule] ✅ YML parsing completed successfully:', {
                    totalOffers: rows.length,
                    headers: headers.length,
                    sampleRow: rows[0] || null
                });
                
                setState({
                    isLoading: false,
                    status: 'parsed',
                    message: `Файл "${file.name}" успешно прочитан. Найдено товаров: ${rows.length}`,
                    columns: headers,
                    rows: rows,
                    totalRows: rows.length,
                    truncated: false,
                    mapping: initialMapping,
                    jobId: null,
                    logs: [],
                    publishResult: null,
                    meta: { fileType: 'yml', totalOffers: rows.length },
                    matches: [],
                    matchDecisions: {},
                    metrics: null,
                    quality: null
                });
                
                console.log('[DataImportModule] ✅ YML parsing block completed, returning (will NOT process as Excel)');
                return; // КРИТИЧНО: Прерываем выполнение, чтобы не попасть в блок Excel
            }
            
            // Обработка CSV файлов без XLSX
            if (isCSV) {
                console.log('[DataImportModule] ✅ CSV file detected, entering CSV parsing block');
                const text = await file.text();
                const lines = text.split('\n').filter(line => line.trim());
                if (lines.length === 0) {
                    throw new Error('Файл пуст');
                }
                
                // Парсим CSV
                const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
                const rows = [];
                
                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                    if (values.length > 0 && values.some(v => v)) {
                        const row = {};
                        headers.forEach((header, idx) => {
                            row[header] = values[idx] || '';
                        });
                        rows.push(row);
                    }
                }
                
                const initialMapping = autoMapHeaders(headers);
                
                console.log('[DataImportModule] ✅ CSV parsing completed successfully:', {
                    totalRows: rows.length,
                    headers: headers.length
                });
                
                setState({
                    isLoading: false,
                    status: 'parsed',
                    message: `Файл "${file.name}" успешно прочитан в браузере.`,
                    columns: headers,
                    rows: rows,
                    totalRows: rows.length,
                    truncated: false,
                    mapping: initialMapping,
                    jobId: null,
                    logs: [],
                    publishResult: null,
                    meta: { fileType: 'csv' },
                    matches: [],
                    matchDecisions: {},
                    metrics: null,
                    quality: null
                });
                
                console.log('[DataImportModule] ✅ CSV parsing block completed, returning (will NOT process as Excel)');
                return; // КРИТИЧНО: Прерываем выполнение, чтобы не попасть в блок Excel
            }
            
            // Обработка Excel файлов с XLSX
            // КРИТИЧНО: Строгая проверка - если файл YML или CSV, НЕ обрабатываем как Excel
            if (isYML) {
                console.error('[DataImportModule] ❌ CRITICAL ERROR: YML file reached Excel parser block! This should never happen.');
                throw new Error('Ошибка обработки: YML файл попал в блок парсинга Excel. Это ошибка системы.');
            }
            
            if (isCSV) {
                console.error('[DataImportModule] ❌ CRITICAL ERROR: CSV file reached Excel parser block! This should never happen.');
                throw new Error('Ошибка обработки: CSV файл попал в блок парсинга Excel. Это ошибка системы.');
            }
            
            // Строгая проверка: если файл не Excel, выбрасываем ошибку ДО попытки чтения
            if (!isExcel) {
                console.error('[DataImportModule] Attempted to process non-Excel file as Excel:', {
                    fileName: file.name,
                    fileExtension: fileExtension,
                    isExcel: isExcel,
                    isYML: isYML,
                    isCSV: isCSV
                });
                throw new Error(`Неподдерживаемый формат файла: ${fileExtension || 'неизвестный'}. Поддерживаются: CSV, TXT, XLSX, XLS, YML, YAML, XML.`);
            }
            
            console.log('[DataImportModule] ✅ Processing Excel file:', file.name);
            
            if (typeof XLSX === 'undefined') {
                throw new Error('Библиотека XLSX не загружена для обработки Excel файла. Попробуйте сохранить файл как CSV.');
            }
            
            const arrayBuffer = await file.arrayBuffer();
            let workbook;
            try {
                workbook = XLSX.read(arrayBuffer, { type: 'array' });
            } catch (error) {
                throw new Error('Не удалось прочитать Excel файл. Убедитесь, что файл не поврежден. Ошибка: ' + error.message);
            }
            
            if (!workbook || !workbook.SheetNames || !Array.isArray(workbook.SheetNames) || workbook.SheetNames.length === 0) {
                throw new Error('Файл не содержит листов или поврежден. Убедитесь, что это корректный Excel файл.');
            }
            
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            
            if (!sheet) {
                throw new Error('Не удалось прочитать данные из листа "' + sheetName + '".');
            }
            
            let rowsAoA;
            try {
                rowsAoA = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
            } catch (error) {
                throw new Error('Не удалось преобразовать данные листа в таблицу. Ошибка: ' + error.message);
            }

            if (!rowsAoA || !Array.isArray(rowsAoA) || rowsAoA.length === 0) {
                throw new Error('Файл пустой или не содержит данных.');
            }

            // Извлекаем заголовки и данные
            if (rowsAoA.length === 0) {
                throw new Error('Файл не содержит строк данных.');
            }
            
            const headerRow = rowsAoA[0] || [];
            const dataRows = rowsAoA.slice(1);
            
            // Обрабатываем заголовки
            const headers = Array.isArray(headerRow) 
                ? headerRow.map((h) => String(h || '').trim()).filter(h => h)
                : [];
            
            // Если заголовков нет, создаем автоматические
            if (headers.length === 0 && dataRows.length > 0) {
                const firstDataRow = dataRows[0] || [];
                const maxCols = Math.max(...dataRows.map(row => Array.isArray(row) ? row.length : 0));
                headers.push(...Array.from({ length: maxCols }, (_, i) => `Колонка ${i + 1}`));
            }
            
            // Обрабатываем строки данных
            const rows = dataRows.map(row => {
                if (!Array.isArray(row)) {
                    return null; // Пропускаем не-массивы
                }
                const rowObj = {};
                headers.forEach((header, idx) => {
                    rowObj[header] = String(row[idx] || '').trim();
                });
                return rowObj;
            }).filter(row => row !== null && Object.values(row).some(v => v)); // Убираем пустые строки
            const initialMapping = autoMapHeaders(headers);

            console.log('[DataImportModule] Parsed XLSX locally', {
                sheetName,
                columns: headers,
                rowCount: rows.length
            });

            setState({
                isLoading: false,
                status: 'parsed',
                columns: headers,
                rows,
                totalRows: rows.length,
                truncated: false,
                mapping: initialMapping,
                message: `Файл "${file.name}" успешно прочитан в браузере.`,
                jobId: null,
                logs: [],
                publishResult: null,
                meta: { sheetName },
                matches: [],
                matchDecisions: {},
                metrics: null,
                quality: null
            });
        } catch (error) {
            console.error('[DataImportModule] ❌ File parse failed', error);
            console.error('[DataImportModule] Error stack:', error.stack);
            let errorMessage = error.message || 'Неизвестная ошибка';
            
            // Определяем тип файла для более точного сообщения об ошибке
            const fileName = file?.name || 'unknown';
            const fileExtension = fileName.split('.').pop()?.toLowerCase()?.trim() || 'unknown';
            const isExcelFile = ['xlsx', 'xls'].includes(fileExtension);
            const isYMLFile = ['yml', 'yaml', 'xml'].includes(fileExtension);
            const isCSVFile = ['csv', 'txt'].includes(fileExtension);
            
            console.error('[DataImportModule] File type detection on error:', {
                fileName: fileName,
                fileExtension: fileExtension,
                isExcelFile: isExcelFile,
                isYMLFile: isYMLFile,
                isCSVFile: isCSVFile
            });
            
            // Более понятные сообщения для типичных ошибок
            if (errorMessage.includes('Cannot read properties of undefined')) {
                if (isYMLFile) {
                    errorMessage = 'Файл YML/XML поврежден или имеет неверную структуру. Убедитесь, что файл содержит корректные XML-теги (offer, item, product или товар). Если вы загружаете YML файл, но видите эту ошибку, возможно файл был неправильно определен как Excel.';
                } else if (isExcelFile) {
                    errorMessage = 'Файл Excel поврежден или имеет неверный формат. Попробуйте открыть файл в Excel и сохранить заново.';
                } else {
                    errorMessage = 'Файл поврежден или имеет неверный формат. Проверьте содержимое файла.';
                }
            } else if (errorMessage.includes('not defined') || errorMessage.includes('undefined')) {
                if (isYMLFile) {
                    errorMessage = 'Ошибка при чтении YML/XML файла. Убедитесь, что файл имеет расширение .yml, .yaml или .xml и содержит корректную XML структуру.';
                } else if (isExcelFile) {
                    errorMessage = 'Ошибка при чтении файла. Убедитесь, что это корректный Excel файл (.xlsx или .xls).';
                } else {
                    errorMessage = 'Ошибка при чтении файла. Проверьте формат и содержимое файла.';
                }
            }
            
            // Формируем сообщение об ошибке в зависимости от типа файла
            let statusMessage;
            if (isYMLFile) {
                statusMessage = `Не удалось прочитать YML/XML (${fileExtension}): ${errorMessage}`;
            } else if (isCSVFile) {
                statusMessage = `Не удалось прочитать CSV: ${errorMessage}`;
            } else if (isExcelFile) {
                statusMessage = `Не удалось прочитать XLSX: ${errorMessage}`;
            } else {
                statusMessage = `Не удалось прочитать файл (${fileExtension}): ${errorMessage}`;
            }
            
            setState({
                isLoading: false,
                status: 'error',
                message: statusMessage
            });
        }
    }

    function handleMappingChange(column, value) {
        const nextMapping = { ...state.mapping };
        if (!value) {
            delete nextMapping[column];
        } else {
            nextMapping[column] = value;
        }
        setState({ mapping: nextMapping });
    }

    function exportMapping() {
        const payload = {
            mapping: state.mapping,
            columns: state.columns,
            totalRows: state.totalRows,
            status: state.status,
            jobId: state.jobId,
            createdAt: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'import-mapping.json';
        link.click();
        URL.revokeObjectURL(url);
    }

    async function publishDataset() {
        if (!state.columns.length || !state.rows.length) {
            setState({ message: 'Сначала загрузите и разберите файл.' });
            return;
        }
        if (!Object.keys(state.mapping).length) {
            setState({ message: 'Сопоставьте хотя бы одно поле перед публикацией.' });
            return;
        }

        setState({
            isPublishing: true,
            message: 'Импортируем данные в каталог товаров (products)...'
        });

        const columns = state.columns;
        const mapping = state.mapping;
        let created = 0;
        let failed = 0;
        const errors = [];

        for (let rowIndex = 0; rowIndex < state.rows.length; rowIndex++) {
            const row = state.rows[rowIndex];
            const record = {};

            columns.forEach((colName, colIndex) => {
                const target = mapping[colName];
                if (!target) return;
                if (row && typeof row === 'object' && !Array.isArray(row)) {
                    record[target] = row[colName];
                } else {
                    record[target] = row ? row[colIndex] : undefined;
                }
            });

            const rawPrice = record.price ?? record.cost ?? record.sum ?? record['Цена'] ?? record['price'] ?? null;
            const price = rawPrice === null || rawPrice === undefined || rawPrice === ''
                ? 0
                : parseFloat(String(rawPrice).replace(',', '.'));

            const payload = {
                sku: record.sku || record.code || record.external_id || null,
                name: record.name || record['Название'] || record.title || 'Товар без названия',
                description: record.description || record.short_description || record.description_short || null,
                price: Number.isFinite(price) ? price : 0,
                category: record.category || record.category_name || record['Категория'] || '',
                image_url: record.image_url || record.image || record.picture || record.photo || record['Картинка'] || '',
                visible_on_site: record.is_visible !== undefined ? Boolean(record.is_visible) : true,
                weight: record.weight || record['Вес'] || null,
                calories: record.calories || record['Калории'] || null,
                product_data: {
                    import_attributes: record,
                    import_status: record.status || 'draft'
                }
            };

            try {
                const resp = await fetch('/api/v1/products', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
                const json = await resp.json();
                if (!resp.ok || !json.success) {
                    failed++;
                    errors.push(`Строка ${rowIndex + 2}: ${json.error || 'ошибка сохранения'}`);
                } else {
                    created++;
                }
            } catch (e) {
                console.error('[DataImportModule] Failed to create item from row', rowIndex, e);
                failed++;
                errors.push(`Строка ${rowIndex + 2}: ${e.message}`);
            }
        }

        setState({
            isPublishing: false,
            status: failed === 0 ? 'published' : 'error',
            message:
                failed === 0
                    ? `Импорт завершён. Создано записей: ${created}.`
                    : `Импорт завершён. Создано: ${created}, с ошибками: ${failed}.`,
            publishResult: {
                mode: 'local',
                created,
                failed,
                errors: errors.slice(0, 20)
            },
            logs: errors.slice(0, 20)
        });
    }

    function renderSidebar() {
        const progress = calculateProgress();
        const mappingBadge = state.columns.length ? `${progress}% сопоставлено` : 'Ожидает данных';
        const publishBadge =
            state.publishResult?.mode === 'remote'
                ? 'Коннектор'
                : state.publishResult?.mode === 'local'
                    ? 'Локально'
                    : '';

        const stages = [
            {
                key: 'upload',
                label: '1. Загрузка',
                active: ['loading', 'processing', 'completed', 'published', 'sample', 'parsed'].includes(state.status)
            },
            {
                key: 'mapping',
                label: '2. Сопоставление',
                active: state.columns.length > 0,
                badge: mappingBadge
            },
            {
                key: 'preview',
                label: '3. Предпросмотр',
                active: Object.keys(state.mapping).length > 0
            },
            {
                key: 'publish',
                label: '4. Публикация',
                active: state.publishResult || state.status === 'published',
                badge: publishBadge
            }
        ];

        return `
            <aside class="import-sidebar">
                <h2>Пайплайн импорта</h2>
                ${stages
                    .map(
                        (stage) => `
                        <div class="import-nav-item ${stage.active ? 'active' : ''}">
                            <span>${stage.label}</span>
                            ${stage.badge ? `<span class="import-tag">${stage.badge}</span>` : ''}
                        </div>
                    `
                    )
                    .join('')}
                <div style="margin-top: 1.5rem;">
                    <p class="import-muted">
                        Очередь OCR/CV и публикация в коннектор работают в реальном времени. Следите за логами, чтобы увидеть ход обработки.
                    </p>
                </div>
            </aside>
        `;
    }

    function renderUploadPanel() {
        return `
            <section class="import-panel">
                <h3>Загрузка файла</h3>
                <div class="import-info-banner">
                    ${state.message}
                </div>
                <div class="import-upload">
                    <input type="file" id="dataImportFile" accept=".csv,.txt,.xls,.xlsx,.yml,.yaml,.pdf,.jpg,.jpeg,.png,.webp" ${state.isLoading ? 'disabled' : ''}>
                    <div class="import-actions">
                        <button class="import-button primary" id="dataImportUploadBtn" ${state.isLoading ? 'disabled' : ''}>
                            ${state.isLoading ? 'Загружаем…' : '📤 Загрузить файл'}
                        </button>
                        <button class="import-button secondary" id="dataImportSampleBtn">
                            📋 Использовать демо-данные
                        </button>
                        <button class="import-button ghost" id="dataImportResetBtn">
                            ♻️ Очистить
                        </button>
                    </div>
                </div>
            </section>
        `;
    }

    function renderPreviewPanel() {
        if (!state.columns.length) {
            return `
                <section class="import-panel">
                    <h3>Предпросмотр данных</h3>
                    <p class="import-muted">После загрузки файла здесь появятся первые строки.</p>
                </section>
            `;
        }
        const rows = state.rows.slice(0, 10);
        const total = state.totalRows || rows.length;
        
        // Определяем формат данных: массивы (CSV/Excel) или объекты (YML)
        const isObjectFormat = rows.length > 0 && typeof rows[0] === 'object' && !Array.isArray(rows[0]);
        
        return `
            <section class="import-panel">
                <h3>Предпросмотр данных</h3>
                <p class="import-muted">
                    Показаны первые ${rows.length} из ${total} строк.
                    ${state.truncated ? 'Показаны не все строки, загрузите полный набор через API.' : ''}
                </p>
                <div style="overflow:auto;">
                    <table class="import-table">
                        <thead>
                            <tr>${state.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr>
                        </thead>
                        <tbody>
                            ${isObjectFormat
                                ? rows.map((row) => {
                                    const cells = state.columns.map((col) => {
                                        const value = row[col];
                                        if (Array.isArray(value)) {
                                            return value.join(', ');
                                        }
                                        return value ?? '';
                                    });
                                    return `<tr>${cells.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join('')}</tr>`;
                                }).join('')
                                : rows.map((row) => {
                                    if (!Array.isArray(row)) {
                                        // Fallback для неожиданных форматов
                                        const cells = state.columns.map((col) => {
                                            const value = row && typeof row === 'object' ? row[col] : '';
                                            return `<td>${escapeHtml(String(value ?? ''))}</td>`;
                                        });
                                        return `<tr>${cells.join('')}</tr>`;
                                    }
                                    return `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell ?? ''))}</td>`).join('')}</tr>`;
                                }).join('')}
                        </tbody>
                    </table>
                </div>
            </section>
        `;
    }

    function renderMappingPanel() {
        if (!state.columns.length) {
            return `
                <section class="import-panel">
                    <h3>Сопоставление полей</h3>
                    <p class="import-muted">Выберите файл или демо, чтобы настроить сопоставление столбцов.</p>
                </section>
            `;
        }
        const progress = calculateProgress();
        return `
            <section class="import-panel">
                <h3>Сопоставление полей</h3>
                <div class="import-progress">
                    <span class="import-muted">
                        ${progress}% столбцов сопоставлено (${Object.keys(state.mapping).length}/${state.columns.length})
                    </span>
                    <div class="import-progress-bar">
                        <span style="width: ${progress}%;"></span>
                    </div>
                </div>
                <div class="import-mapping">
                    ${state.columns
                        .map((column) => {
                            const current = state.mapping[column] || '';
                            return `
                                <label>
                                    <span class="import-muted" style="display:block; margin-bottom:6px;">${column}</span>
                                    <select data-column="${column}">
                                        <option value="">— Не сопоставлять —</option>
                                        ${state.targetFields
                                            .map(
                                                (field) => `
                                            <option value="${field}" ${current === field ? 'selected' : ''}>${field}</option>
                                        `
                                            )
                                            .join('')}
                                    </select>
                                </label>
                            `;
                        })
                        .join('')}
                </div>
                <div class="import-actions" style="margin-top: 16px;">
                    <button class="import-button secondary" id="dataImportAutoMapBtn">✨ Автосопоставление</button>
                    <button class="import-button ghost" id="dataImportExportMappingBtn">💾 Экспорт конфигурации</button>
                </div>
            </section>
        `;
    }

    function renderMatchingPanel() {
        if (!state.matches.length) {
            return `
                <section class="import-panel">
                    <h3>Сопоставление номенклатуры</h3>
                    <p class="import-muted">После распознавания здесь появятся предложения по сопоставлению товаров.</p>
                </section>
            `;
        }

        const items = state.matches.slice(0, 50).map(function (match) {
            const decision = getDecisionForRow(match.rowIndex);
            const decisionLabel = decision
                ? decision.status === 'accepted'
                    ? 'Принято: ' + (decision.name || decision.candidateId || 'кандидат')
                    : decision.status === 'manual'
                        ? 'Ручной ввод: ' + decision.value
                        : decision.status === 'ignored'
                            ? 'Помечено к ручной обработке'
                            : 'Решение сохранено'
                : 'Ожидает решения';
            const candidatesHtml = (match.candidates || []).map(function (candidate, idx) {
                return `
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;">
                        <span>${escapeHtml(candidate.name)} (скор ${Math.round(candidate.score * 100)}%)</span>
                        <button class="import-button secondary" data-action="match-accept" data-row="${match.rowIndex}" data-candidate="${idx}">Выбрать</button>
                    </div>
                `;
            }).join('');

            return `
                <div class="import-panel" style="padding:12px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
                        <div>
                            <strong>Строка ${match.rowIndex + 1}:</strong> ${escapeHtml(match.sourceName || '(без названия)')}
                            ${match.barcode ? `<div class="import-muted">Штрихкод: ${match.barcode}</div>` : ''}
                        </div>
                        <span class="import-tag">${escapeHtml(decisionLabel)}</span>
                    </div>
                    <div class="import-muted" style="margin:8px 0;">Лучшие кандидаты:</div>
                    <div class="import-matching-list">
                        ${candidatesHtml || '<p class="import-muted">Кандидаты не найдены.</p>'}
                    </div>
                    <div class="import-actions" style="margin-top:8px;">
                        <button class="import-button secondary" data-action="match-manual" data-row="${match.rowIndex}">Ручной ввод</button>
                        <button class="import-button ghost" data-action="match-reject" data-row="${match.rowIndex}">Отложить</button>
                        <button class="import-button ghost" data-action="match-clear" data-row="${match.rowIndex}">Сбросить</button>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <section class="import-panel">
                <h3>Сопоставление номенклатуры</h3>
                ${items}
                ${state.matches.length > 50 ? '<p class="import-muted">Показаны первые 50 строк. Остальные можно проверить в деталях задания.</p>' : ''}
            </section>
        `;
    }

    function renderMetricsPanel() {
        if (!state.metrics && !state.quality) {
            return '';
        }
        const metrics = state.metrics;
        const quality = state.quality;
        const metricsHtml = metrics
            ? `
                <ul class="import-muted">
                    <li>Всего строк: ${metrics.rowsTotal}</li>
                    <li>Есть предложения: ${metrics.withSuggestions}</li>
                    <li>Без совпадений: ${metrics.unmatchedRows}</li>
                    <li>Средний скор: ${metrics.avgScore}</li>
                    <li>Штрихкоды найдены: ${metrics.barcodeHits}</li>
                </ul>
            `
            : '<p class="import-muted">Метрики недоступны.</p>';

        const qualityHtml = quality
            ? `
                <div class="import-muted" style="margin-top:8px;">
                    <strong>Источник:</strong> ${quality.provider || '—'} · ${quality.fileType || '?'} (${quality.sizeKb || 0} КБ)
                    ${quality.resolution ? `<div>Разрешение: ${quality.resolution.width}×${quality.resolution.height}</div>` : ''}
                    ${(quality.warnings || []).map((warn) => `<div style="color:#b45309;">⚠️ ${escapeHtml(warn)}</div>`).join('')}
                </div>
            `
            : '';

        return `
            <section class="import-panel">
                <h3>Метрики распознавания</h3>
                ${metricsHtml}
                ${qualityHtml}
            </section>
        `;
    }

    function renderJsonPreviewPanel() {
        const previewRecords = buildPreviewRecords();
        if (!previewRecords.length) {
            return `
                <section class="import-panel">
                    <h3>JSON-превью</h3>
                    <p class="import-muted">Когда вы сопоставите столбцы, здесь появится результат.</p>
                </section>
            `;
        }
        const json = JSON.stringify(previewRecords, null, 2);
        return `
            <section class="import-panel">
                <h3>JSON-превью</h3>
                <div class="import-json-preview">${json}</div>
            </section>
        `;
    }

    function renderLogsPanel() {
        const logs = state.logs.slice(-10).reverse();
        if (!logs.length) {
            return `
                <section class="import-panel">
                    <h3>Лог обработки</h3>
                    <p class="import-muted">После загрузки файла здесь появится журнал действий OCR/CV и публикации.</p>
                </section>
            `;
        }
        return `
            <section class="import-panel">
                <h3>Лог обработки</h3>
                <div class="import-json-preview" style="max-height: 180px;">
                    ${logs
                        .map(
                            (entry) => `[${new Date(entry.timestamp).toLocaleTimeString()}] [${entry.level?.toUpperCase() || 'LOG'}] ${entry.message}`
                        )
                        .join('\n')}
                </div>
            </section>
        `;
    }

    function renderPublishPanel() {
        const ready = state.status === 'completed' && Object.keys(state.mapping).length > 0;
        const disabled = !ready || state.isPublishing;
        const resultInfo = state.publishResult
            ? `<div class="import-info-banner" style="margin-top:12px;">
                    Режим: ${state.publishResult.mode || 'local'}.
                    ${state.publishResult.result ? `Ответ: ${JSON.stringify(state.publishResult.result)}` : ''}
                </div>`
            : '';
        return `
            <section class="import-panel">
                <h3>Публикация</h3>
                <div class="import-actions" style="align-items:center;">
                    <label style="display:flex; flex-direction:column; gap:6px;">
                        <span class="import-muted">Куда отправлять данные</span>
                        <select id="dataImportProviderSelect">
                            ${PROVIDERS.map((option) => `<option value="${option.value}" ${state.provider === option.value ? 'selected' : ''}>${option.label}</option>`).join('')}
                        </select>
                    </label>
                    <button class="import-button primary" id="dataImportPublishBtn" ${disabled ? 'disabled' : ''}>
                        ${state.isPublishing ? '⏳ Отправляем...' : '🚀 Отправить в коннектор'}
                    </button>
                </div>
                <p class="import-muted" style="margin-top: 10px;">
                    При отсутствии удалённого коннектора данные сохраняются локально в storage/imports.
                </p>
                ${resultInfo}
            </section>
        `;
    }

    function render() {
        const rootEl = getRoot();
        if (!rootEl) {
            console.warn('[DataImportModule] Root element not found, cannot render.');
            return;
        }
        rootEl.classList.toggle('import-suite-loading', !state.isReady);
        rootEl.innerHTML = `
            <div class="import-suite">
                ${renderSidebar()}
                <div class="import-main">
                    ${renderUploadPanel()}
                    ${renderPreviewPanel()}
                    ${renderMappingPanel()}
                    ${renderMatchingPanel()}
                    ${renderMetricsPanel()}
                    ${renderJsonPreviewPanel()}
                    ${renderLogsPanel()}
                    ${renderPublishPanel()}
                </div>
            </div>
        `;

        const fileInput = rootEl.querySelector('#dataImportFile');
        const uploadBtn = rootEl.querySelector('#dataImportUploadBtn');
        const sampleBtn = rootEl.querySelector('#dataImportSampleBtn');
        const resetBtn = rootEl.querySelector('#dataImportResetBtn');
        const autoMapBtn = rootEl.querySelector('#dataImportAutoMapBtn');
        const exportBtn = rootEl.querySelector('#dataImportExportMappingBtn');
        const publishBtn = rootEl.querySelector('#dataImportPublishBtn');
        const providerSelect = rootEl.querySelector('#dataImportProviderSelect');

        if (fileInput) {
            fileInput.addEventListener('change', (event) => {
                const file = event.target.files?.[0];
                handleFileUpload(file);
            });
        }

        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => {
                if (fileInput?.files?.[0]) {
                    handleFileUpload(fileInput.files[0]);
                } else {
                    fileInput?.click();
                }
            });
        }

        if (sampleBtn) {
            sampleBtn.addEventListener('click', loadSample);
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (fileInput) fileInput.value = '';
                stopPolling();
                setState({
                    columns: [],
                    rows: [],
                    totalRows: 0,
                    truncated: false,
                    mapping: {},
                    status: 'idle',
                    message: DEFAULT_MESSAGE,
                    jobId: null,
                    logs: [],
                    publishResult: null,
                    meta: null,
                    matches: [],
                    matchDecisions: {},
                    metrics: null,
                    quality: null
                });
            });
        }

        if (autoMapBtn) {
            autoMapBtn.addEventListener('click', () => {
                setState({ mapping: autoMapHeaders(state.columns) });
            });
        }

        if (exportBtn) {
            exportBtn.addEventListener('click', exportMapping);
        }

        if (publishBtn) {
            publishBtn.addEventListener('click', publishDataset);
        }

        if (providerSelect) {
            providerSelect.addEventListener('change', (event) => {
                setState({ provider: event.target.value });
            });
        }

        const selects = rootEl.querySelectorAll('.import-mapping select');
        selects.forEach((select) => {
            select.addEventListener('change', (event) => {
                const column = event.target.getAttribute('data-column');
                const value = event.target.value;
                handleMappingChange(column, value);
            });
        });

        // Обработчики для кнопок сопоставления номенклатуры
        rootEl.querySelectorAll('[data-action="match-accept"]').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                const rowIndex = parseInt(event.target.getAttribute('data-row'), 10);
                const candidateIndex = parseInt(event.target.getAttribute('data-candidate'), 10);
                acceptMatch(rowIndex, candidateIndex);
            });
        });

        rootEl.querySelectorAll('[data-action="match-manual"]').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                const rowIndex = parseInt(event.target.getAttribute('data-row'), 10);
                manualMatch(rowIndex);
            });
        });

        rootEl.querySelectorAll('[data-action="match-reject"]').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                const rowIndex = parseInt(event.target.getAttribute('data-row'), 10);
                rejectMatch(rowIndex);
            });
        });

        rootEl.querySelectorAll('[data-action="match-clear"]').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                const rowIndex = parseInt(event.target.getAttribute('data-row'), 10);
                clearMatchDecision(rowIndex);
            });
        });
    }

    function clearRemoteEvaluation() {
        state.remoteEvaluation = null;
        state.apiMessage = 'Результаты расчёта очищены';
        render();
    }

    function getDecisionForRow(rowIndex) {
        return state.matchDecisions[rowIndex] || null;
    }

    function applyMatchDecision(rowIndex, decision, message) {
        const next = Object.assign({}, state.matchDecisions);
        if (decision) {
            next[rowIndex] = Object.assign({ updatedAt: new Date().toISOString() }, decision);
        } else {
            delete next[rowIndex];
        }
        setState({
            matchDecisions: next,
            apiMessage: message || 'Решение по строке ' + (rowIndex + 1)
        });
    }

    function acceptMatch(rowIndex, candidateIndex) {
        const match = state.matches.find(function (item) { return item.rowIndex === rowIndex; });
        if (!match) { return; }
        const candidate = match.candidates && match.candidates[candidateIndex] ? match.candidates[candidateIndex] : match.bestMatch;
        if (!candidate) {
            applyMatchDecision(rowIndex, null, 'Нет подходящих кандидатов для строки ' + (rowIndex + 1));
            return;
        }
        applyMatchDecision(rowIndex, {
            status: 'accepted',
            candidateId: candidate.id,
            name: candidate.name,
            score: candidate.score
        }, 'Выбрано сопоставление для строки ' + (rowIndex + 1));
    }

    function rejectMatch(rowIndex) {
        applyMatchDecision(rowIndex, {
            status: 'ignored'
        }, 'Строка ' + (rowIndex + 1) + ' помечена к ручной обработке');
    }

    function manualMatch(rowIndex) {
        const current = getDecisionForRow(rowIndex);
        const placeholder = current && current.status === 'manual' ? current.value || '' : '';
        const value = window.prompt('Укажите название или ID товара', placeholder);
        if (!value) {
            return;
        }
        applyMatchDecision(rowIndex, {
            status: 'manual',
            value: value.trim()
        }, 'Указано ручное сопоставление для строки ' + (rowIndex + 1));
    }

    function clearMatchDecision(rowIndex) {
        applyMatchDecision(rowIndex, null, 'Решение по строке ' + (rowIndex + 1) + ' сброшено');
    }

    function computeCartTotals() {
        // Подсчёт статистики по сопоставлениям
        const accepted = Object.values(state.matchDecisions).filter(d => d.status === 'accepted').length;
        const ignored = Object.values(state.matchDecisions).filter(d => d.status === 'ignored').length;
        const manual = Object.values(state.matchDecisions).filter(d => d.status === 'manual').length;
        
        return {
            accepted,
            ignored,
            manual,
            total: Object.keys(state.matchDecisions).length
        };
    }

    function computeOverviewMetrics() {
        const totals = computeCartTotals();
        return {
            totalRows: state.totalRows,
            matchedRows: state.matches.length,
            unmatchedRows: state.totalRows - state.matches.length,
            quality: state.quality || null,
            totals: totals
        };
    }

    // Экспорт функций для использования вне модуля
    window.dataImportModule = {
        computeOverviewMetrics,
        applyMatchDecision,
        clearMatchDecision,
        init: function() {
            console.log('[DataImportModule] init() called');
            const rootEl = getRoot();
            if (!rootEl) {
                console.warn('[DataImportModule] Root element #dataImportRoot not found, cannot initialize.');
                return false;
            }
            console.log('[DataImportModule] Root element found, loading config...');
            loadConfig();
            console.log('[DataImportModule] Config loaded, rendering...');
            render();
            console.log('[DataImportModule] ✅ Module initialized successfully');
            return true;
        },
        render: render
    };

    console.log('[DataImportModule] Module loaded, window.dataImportModule available');
    console.log('[DataImportModule] Exported methods:', Object.keys(window.dataImportModule));
    console.log('[DataImportModule] Has init method:', typeof window.dataImportModule.init === 'function');
    // Инициализация отложена - будет вызвана через window.dataImportModule.init()
    // при открытии страницы импорта
})();

