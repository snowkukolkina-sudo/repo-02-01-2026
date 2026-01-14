// Модуль импорта из 1С с улучшенным UI сопоставления колонок
// VERSION: v1.0 - Enhanced column mapping UI
console.log('📦 admin-1c-import.js VERSION 1.0 LOADED - Enhanced column mapping UI');

class OneCImportManager {
    constructor() {
        this.file = null;
        this.fileData = null;
        this.headers = [];
        this.sampleRows = [];
        this.fieldMapping = {};
        this.API_BASE = '/api/onec';
    }

    async init() {
        this.render();
    }

    render() {
        // Используем контейнер из страницы интеграции с 1С
        const container = document.getElementById('onecIntegrationContent') || document.getElementById('onecImportContent');
        if (!container) {
            console.warn('Container #onecIntegrationContent or #onecImportContent not found');
            return;
        }

        container.innerHTML = `
            <div style="max-width: 1200px; margin: 0 auto; padding: 2rem;">
                <h2 style="margin-bottom: 1.5rem; color: var(--dandy-green, #08615C);">
                    📥 Импорт номенклатуры из 1С
                </h2>
                
                <div class="card" style="margin-bottom: 1.5rem;">
                    <h3 class="card-title">Инструкция</h3>
                    <div style="padding: 1rem; background: #f8f9fa; border-radius: 8px;">
                        <ol style="margin: 0; padding-left: 1.5rem; line-height: 1.8;">
                            <li>Экспортируйте справочник номенклатуры из 1С в формате Excel (.xlsx) или CSV</li>
                            <li>Загрузите файл ниже</li>
                            <li>Сопоставьте колонки файла с системными полями</li>
                            <li>Проверьте предпросмотр данных</li>
                            <li>Нажмите "Импортировать"</li>
                        </ol>
                    </div>
                </div>

                <div class="card" style="margin-bottom: 1.5rem;">
                    <h3 class="card-title">1. Выбор файла</h3>
                    <div style="padding: 1rem;">
                        <input type="file" id="onecFileInput" accept=".xlsx,.xls,.csv" 
                               style="padding: 0.75rem; border: 2px dashed #ddd; border-radius: 8px; width: 100%; cursor: pointer;"
                               onchange="onecImportManager.handleFileSelect(event)">
                        <div id="fileInfo" style="margin-top: 1rem; padding: 0.75rem; background: #e8f5f3; border-radius: 8px; display: none;">
                            <strong>Файл:</strong> <span id="fileName"></span><br>
                            <strong>Колонок:</strong> <span id="columnCount"></span><br>
                            <strong>Строк:</strong> <span id="rowCount"></span>
                        </div>
                    </div>
                </div>

                <div id="mappingSection" class="card" style="display: none; margin-bottom: 1.5rem;">
                    <h3 class="card-title">2. Сопоставление колонок</h3>
                    <div style="padding: 1rem;">
                        <div style="margin-bottom: 1rem; padding: 0.75rem; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
                            <strong>💡 Совет:</strong> Система автоматически определит сопоставления. Проверьте и при необходимости измените вручную.
                        </div>
                        
                        <div style="margin-bottom: 1rem;">
                            <button class="btn btn-secondary btn-small" onclick="onecImportManager.autoMapFields()" style="margin-right: 0.5rem;">
                                🔄 Автосопоставление
                            </button>
                            <button class="btn btn-secondary btn-small" onclick="onecImportManager.clearMapping()">
                                🗑️ Очистить
                            </button>
                        </div>

                        <div id="mappingTableContainer" style="overflow-x: auto;">
                            <!-- Таблица сопоставления будет здесь -->
                        </div>
                    </div>
                </div>

                <div id="previewSection" class="card" style="display: none; margin-bottom: 1.5rem;">
                    <h3 class="card-title">3. Предпросмотр данных</h3>
                    <div style="padding: 1rem;">
                        <div id="previewTableContainer" style="overflow-x: auto;">
                            <!-- Предпросмотр будет здесь -->
                        </div>
                    </div>
                </div>

                <div id="importSection" class="card" style="display: none;">
                    <h3 class="card-title">4. Настройки импорта</h3>
                    <div style="padding: 1rem;">
                        <div style="margin-bottom: 1rem;">
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="updateExisting" checked>
                                <span>Обновлять существующие товары (по названию или штрихкоду)</span>
                            </label>
                        </div>
                        <div style="margin-bottom: 1rem;">
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="autoAssignAccounts" checked>
                                <span>Автоматически назначать счета учёта по правилам</span>
                            </label>
                        </div>
                        <div style="display: flex; gap: 1rem;">
                            <button class="btn btn-primary" onclick="onecImportManager.startImport()">
                                📥 Начать импорт
                            </button>
                            <button class="btn btn-secondary" onclick="onecImportManager.reset()">
                                🔄 Сбросить
                            </button>
                        </div>
                    </div>
                </div>

                <div id="importProgress" style="display: none; margin-top: 1.5rem;">
                    <!-- Прогресс импорта будет здесь -->
                </div>
            </div>
        `;
    }

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.file = file;
        
        try {
            // Показываем индикатор загрузки
            const fileInfo = document.getElementById('fileInfo');
            fileInfo.style.display = 'block';
            document.getElementById('fileName').textContent = file.name;

            // Читаем файл
            if (file.name.endsWith('.csv')) {
                await this.parseCSV(file);
            } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                await this.parseExcel(file);
            } else {
                alert('❌ Поддерживаются только файлы CSV и Excel (.xlsx, .xls)');
                return;
            }

            // Показываем информацию о файле
            document.getElementById('columnCount').textContent = this.headers.length;
            document.getElementById('rowCount').textContent = this.sampleRows.length;

            // Показываем секции
            document.getElementById('mappingSection').style.display = 'block';
            document.getElementById('previewSection').style.display = 'block';
            document.getElementById('importSection').style.display = 'block';

            // Автоматически сопоставляем поля
            this.autoMapFields();
            
            // Рендерим таблицу сопоставления
            this.renderMappingTable();
            
            // Рендерим предпросмотр
            this.renderPreview();

        } catch (error) {
            console.error('Ошибка при чтении файла:', error);
            alert('❌ Ошибка при чтении файла: ' + error.message);
        }
    }

    async parseCSV(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const lines = text.split('\n').filter(line => line.trim());
                    
                    if (lines.length === 0) {
                        reject(new Error('Файл пуст'));
                        return;
                    }

                    // Определяем разделитель
                    const delimiter = this.detectDelimiter(text);
                    
                    // Парсим заголовки
                    this.headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ''));
                    
                    // Парсим первые 5 строк для предпросмотра
                    this.sampleRows = [];
                    for (let i = 1; i < Math.min(6, lines.length); i++) {
                        const values = lines[i].split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
                        if (values.length === this.headers.length) {
                            const row = {};
                            this.headers.forEach((header, idx) => {
                                row[header] = values[idx] || '';
                            });
                            this.sampleRows.push(row);
                        }
                    }

                    resolve();
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('Ошибка чтения файла'));
            reader.readAsText(file, 'UTF-8');
        });
    }

    async parseExcel(file) {
        // Для Excel нужна библиотека XLSX
        if (typeof XLSX === 'undefined') {
            alert('❌ Библиотека XLSX не загружена. Пожалуйста, используйте CSV файл или убедитесь, что библиотека загружена.');
            return;
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    
                    // Конвертируем в JSON
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
                    
                    if (jsonData.length === 0) {
                        reject(new Error('Файл пуст'));
                        return;
                    }

                    // Первая строка - заголовки
                    this.headers = jsonData[0].map(h => String(h).trim());
                    
                    // Следующие 5 строк - для предпросмотра
                    this.sampleRows = [];
                    for (let i = 1; i < Math.min(6, jsonData.length); i++) {
                        const row = {};
                        this.headers.forEach((header, idx) => {
                            row[header] = String(jsonData[i][idx] || '').trim();
                        });
                        this.sampleRows.push(row);
                    }

                    resolve();
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('Ошибка чтения файла'));
            reader.readAsArrayBuffer(file);
        });
    }

    detectDelimiter(text) {
        const sample = text.substring(0, 1000);
        const delimiters = [',', ';', '\t'];
        let maxCount = 0;
        let bestDelimiter = ',';
        
        delimiters.forEach(delim => {
            const count = (sample.match(new RegExp('\\' + delim, 'g')) || []).length;
            if (count > maxCount) {
                maxCount = count;
                bestDelimiter = delim;
            }
        });
        
        return bestDelimiter;
    }

    // Системные поля для сопоставления
    getSystemFields() {
        return [
            { key: 'name', label: 'Наименование', required: true, description: 'Название товара/материала', examples: ['Лосось свежий', 'Мука пшеничная'] },
            { key: 'barcode', label: 'Штрихкод', required: false, description: 'Штрихкод товара (EAN-13, Code128)', examples: ['4601234567890', '4680012345678'] },
            { key: 'sku', label: 'Артикул/SKU', required: false, description: 'Внутренний код товара', examples: ['LS-001', 'MF-500'] },
            { key: 'type', label: 'Тип номенклатуры', required: false, description: 'товар/материал/полуфабрикат', examples: ['товар', 'материал'] },
            { key: 'unit', label: 'Единица измерения', required: false, description: 'кг, л, шт, м² и т.д.', examples: ['кг', 'л', 'шт'] },
            { key: 'price', label: 'Цена продажи', required: false, description: 'Розничная цена в рублях', examples: ['799', '189'] },
            { key: 'cost', label: 'Закупочная цена', required: false, description: 'Цена закупки в рублях', examples: ['450', '120'] },
            { key: 'vat_rate', label: 'Ставка НДС', required: false, description: '10, 20, 0 или "Без НДС"', examples: ['20', '10', '0'] },
            { key: 'category', label: 'Категория', required: false, description: 'Категория номенклатуры', examples: ['Рыба', 'Мясо', 'Овощи'] },
            { key: 'account_code', label: 'Счёт учёта', required: false, description: 'Счёт бухгалтерского учёта', examples: ['41.01', '10.01'] },
            { key: 'stock', label: 'Остаток', required: false, description: 'Количество на складе', examples: ['5.2', '48', '100'] },
            { key: 'description', label: 'Описание', required: false, description: 'Описание товара', examples: ['Свежий лосось', 'Мука высшего сорта'] }
        ];
    }

    autoMapFields() {
        const systemFields = this.getSystemFields();
        this.fieldMapping = {};

        systemFields.forEach(systemField => {
            // Ищем колонку, которая похожа на системное поле
            const matched = this.headers.find(header => {
                const headerLower = header.toLowerCase();
                const fieldLabelLower = systemField.label.toLowerCase();
                
                // Точное совпадение
                if (headerLower === fieldLabelLower) return true;
                
                // Частичное совпадение
                if (headerLower.includes(fieldLabelLower) || fieldLabelLower.includes(headerLower)) return true;
                
                // Синонимы
                const synonyms = {
                    'name': ['наименование', 'название', 'title', 'name'],
                    'barcode': ['штрихкод', 'barcode', 'ean', 'код'],
                    'sku': ['артикул', 'sku', 'код товара', 'article'],
                    'type': ['тип', 'type', 'вид'],
                    'unit': ['единица', 'ед. изм.', 'unit', 'измерение'],
                    'price': ['цена', 'price', 'стоимость'],
                    'cost': ['закупочная цена', 'себестоимость', 'cost', 'закупка'],
                    'vat_rate': ['ндс', 'vat', 'ставка ндс', 'vat_rate'],
                    'category': ['категория', 'category', 'группа'],
                    'account_code': ['счёт', 'account', 'счет учёта', 'account_code'],
                    'stock': ['остаток', 'stock', 'количество', 'quantity'],
                    'description': ['описание', 'description', 'комментарий']
                };

                if (synonyms[systemField.key]) {
                    return synonyms[systemField.key].some(syn => headerLower.includes(syn));
                }
                
                return false;
            });

            if (matched) {
                this.fieldMapping[systemField.key] = matched;
            }
        });

        this.renderMappingTable();
        this.renderPreview();
    }

    clearMapping() {
        this.fieldMapping = {};
        this.renderMappingTable();
        this.renderPreview();
    }

    renderMappingTable() {
        const container = document.getElementById('mappingTableContainer');
        if (!container) return;

        const systemFields = this.getSystemFields();
        
        let html = `
            <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <thead>
                    <tr style="background: var(--dandy-green, #08615C); color: white;">
                        <th style="padding: 12px; text-align: left; font-weight: 600; width: 25%;">Системное поле</th>
                        <th style="padding: 12px; text-align: left; font-weight: 600; width: 30%;">Колонка из файла</th>
                        <th style="padding: 12px; text-align: left; font-weight: 600; width: 20%;">Примеры данных</th>
                        <th style="padding: 12px; text-align: left; font-weight: 600; width: 25%;">Описание</th>
                    </tr>
                </thead>
                <tbody>
        `;

        systemFields.forEach(field => {
            const mappedColumn = this.fieldMapping[field.key] || '';
            const examples = this.getColumnExamples(mappedColumn);
            
            html += `
                <tr style="border-bottom: 1px solid #e5e7eb; ${field.required ? 'background: #fff3cd;' : ''}">
                    <td style="padding: 12px;">
                        <strong>${field.label}</strong>
                        ${field.required ? '<span style="color: #dc3545; margin-left: 4px;">*</span>' : ''}
                    </td>
                    <td style="padding: 12px;">
                        <select id="mapping_${field.key}" 
                                data-field="${field.key}" 
                                class="form-input mapping-select" 
                                style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 6px; font-size: 0.95rem;"
                                onchange="onecImportManager.updateMapping('${field.key}', this.value)">
                            <option value="">-- Не сопоставлять --</option>
                            ${this.headers.map(header => `
                                <option value="${header}" ${header === mappedColumn ? 'selected' : ''}>
                                    ${header}
                                </option>
                            `).join('')}
                        </select>
                    </td>
                    <td style="padding: 12px; color: #666; font-size: 0.85rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">
                        ${examples.length > 0 ? examples.slice(0, 3).join(', ') : '—'}
                    </td>
                    <td style="padding: 12px; color: #666; font-size: 0.9rem;">
                        ${field.description}
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';

        container.innerHTML = html;
    }

    getColumnExamples(columnName) {
        if (!columnName || this.sampleRows.length === 0) return [];
        
        const examples = [];
        this.sampleRows.forEach(row => {
            if (row[columnName] && row[columnName].trim()) {
                examples.push(row[columnName].trim());
            }
        });
        
        return examples;
    }

    updateMapping(fieldKey, columnName) {
        if (columnName) {
            this.fieldMapping[fieldKey] = columnName;
        } else {
            delete this.fieldMapping[fieldKey];
        }
        this.renderPreview();
    }

    renderPreview() {
        const container = document.getElementById('previewTableContainer');
        if (!container) return;

        const systemFields = this.getSystemFields();
        const mappedFields = systemFields.filter(f => this.fieldMapping[f.key]);

        if (mappedFields.length === 0) {
            container.innerHTML = '<p style="color: #666; padding: 1rem;">Сопоставьте хотя бы одно поле для предпросмотра</p>';
            return;
        }

        let html = `
            <div style="margin-bottom: 1rem; padding: 0.75rem; background: #e8f5f3; border-radius: 8px;">
                <strong>Показано:</strong> ${mappedFields.length} из ${systemFields.length} полей сопоставлено
            </div>
            <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <thead>
                    <tr style="background: #f8f9fa;">
                        ${mappedFields.map(field => `
                            <th style="padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #dee2e6;">
                                ${field.label}
                            </th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody>
        `;

        this.sampleRows.forEach((row, idx) => {
            html += '<tr>';
            mappedFields.forEach(field => {
                const columnName = this.fieldMapping[field.key];
                const value = row[columnName] || '';
                html += `
                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; ${idx % 2 === 0 ? 'background: #f8f9fa;' : ''}">
                        ${value || '<span style="color: #999;">—</span>'}
                    </td>
                `;
            });
            html += '</tr>';
        });

        html += '</tbody></table>';

        container.innerHTML = html;
    }

    async startImport() {
        // Проверяем обязательные поля
        const systemFields = this.getSystemFields();
        const requiredFields = systemFields.filter(f => f.required);
        const missingFields = requiredFields.filter(f => !this.fieldMapping[f.key]);

        if (missingFields.length > 0) {
            alert(`❌ Не сопоставлены обязательные поля:\n${missingFields.map(f => f.label).join(', ')}`);
            return;
        }

        if (Object.keys(this.fieldMapping).length === 0) {
            alert('❌ Не сопоставлено ни одного поля');
            return;
        }

        const updateExisting = document.getElementById('updateExisting').checked;
        const autoAssignAccounts = document.getElementById('autoAssignAccounts').checked;

        // Показываем прогресс
        const progressContainer = document.getElementById('importProgress');
        progressContainer.style.display = 'block';
        progressContainer.innerHTML = `
            <div class="card">
                <h3 class="card-title">Импорт в процессе...</h3>
                <div style="padding: 1rem;">
                    <div style="margin-bottom: 1rem;">
                        <div style="width: 100%; height: 20px; background: #e5e7eb; border-radius: 10px; overflow: hidden;">
                            <div id="progressBar" style="width: 0%; height: 100%; background: var(--dandy-green, #08615C); transition: width 0.3s;"></div>
                        </div>
                    </div>
                    <div id="progressText" style="text-align: center; color: #666;">Подготовка файла...</div>
                </div>
            </div>
        `;

        try {
            // Создаем FormData
            const formData = new FormData();
            formData.append('file', this.file);
            formData.append('fieldMapping', JSON.stringify(this.fieldMapping));
            formData.append('updateExisting', updateExisting);
            formData.append('autoAssignAccounts', autoAssignAccounts);

            // Отправляем на сервер
            const response = await fetch(`${this.API_BASE}/import`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success || result.ok) {
                let warningsHtml = '';
                if (result.warnings && result.warnings.length > 0) {
                    warningsHtml = `
                        <div style="margin-top: 1rem; padding: 0.75rem; background: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
                            <strong>⚠️ Предупреждения (${result.warningCount || result.warnings.length}):</strong>
                            <ul style="margin: 0.5rem 0 0 0; padding-left: 1.5rem;">
                                ${result.warnings.slice(0, 10).map(w => `<li style="margin: 0.25rem 0;">${w}</li>`).join('')}
                            </ul>
                            ${(result.warningCount || result.warnings.length) > 10 ? `<p style="margin: 0.5rem 0 0 0; font-size: 0.9em;">... и еще ${(result.warningCount || result.warnings.length) - 10} предупреждений</p>` : ''}
                        </div>
                    `;
                }
                
                progressContainer.innerHTML = `
                    <div class="card" style="background: #d4edda; border-color: #c3e6cb;">
                        <h3 class="card-title" style="color: #155724;">✅ Импорт завершён успешно</h3>
                        <div style="padding: 1rem;">
                            <p><strong>Импортировано:</strong> ${result.imported || 0} товаров</p>
                            <p><strong>Обновлено:</strong> ${result.updated || 0} товаров</p>
                            ${result.errors ? `<p style="color: #dc3545;"><strong>Ошибок:</strong> ${result.errors}</p>` : ''}
                            ${warningsHtml}
                        </div>
                    </div>
                `;
            } else {
                throw new Error(result.error || 'Неизвестная ошибка');
            }

        } catch (error) {
            console.error('Ошибка импорта:', error);
            progressContainer.innerHTML = `
                <div class="card" style="background: #f8d7da; border-color: #f5c6cb;">
                    <h3 class="card-title" style="color: #721c24;">❌ Ошибка импорта</h3>
                    <div style="padding: 1rem;">
                        <p>${error.message}</p>
                    </div>
                </div>
            `;
        }
    }

    reset() {
        this.file = null;
        this.fileData = null;
        this.headers = [];
        this.sampleRows = [];
        this.fieldMapping = {};
        
        document.getElementById('fileInfo').style.display = 'none';
        document.getElementById('mappingSection').style.display = 'none';
        document.getElementById('previewSection').style.display = 'none';
        document.getElementById('importSection').style.display = 'none';
        document.getElementById('importProgress').style.display = 'none';
        document.getElementById('onecFileInput').value = '';
    }
}

// Инициализация
if (typeof window !== 'undefined') {
    window.OneCImportManager = OneCImportManager;
    window.onecImportManager = new OneCImportManager();
}

