// Модуль импорта остатков из Контур.Маркет (раздел 3.6 ТЗ)
// Импорт начальных остатков по товарам из Excel/CSV

class StockImportManager {
    constructor() {
        this.API_BASE = '/api/inventory';
        this.selectedFile = null;
        this.parsedData = null;
        this.validationErrors = [];
    }

    init() {
        this.render();
    }

    render() {
        const container = document.getElementById('stockImportContent') || document.getElementById('stock');
        if (!container) {
            console.warn('Container for stock import not found');
            return;
        }

        // Добавляем кнопку импорта остатков в существующий интерфейс склада
        const existingContent = container.innerHTML;
        container.innerHTML = `
            ${existingContent}
            <div class="card" style="margin-top: 1.5rem;">
                <h3 style="margin-bottom: 1rem;">📥 Импорт остатков из Контур.Маркет</h3>
                <p style="color: #666; margin-bottom: 1rem;">
                    Загрузка начальных остатков по товарам из файлов формата *.xlsx, *.xls, *.csv или *.txt
                </p>
                <div style="display: flex; gap: 1rem; align-items: center;">
                    <input type="file" id="stockImportFile" accept=".xlsx,.xls,.csv,.txt" style="display: none;" 
                           onchange="stockImportManager.handleFileSelect(this.files[0])">
                    <button class="btn btn-primary" onclick="document.getElementById('stockImportFile').click()">
                        📁 Выбрать файл
                    </button>
                    <button class="btn btn-secondary" onclick="stockImportManager.downloadTemplate()">
                        📄 Скачать шаблон
                    </button>
                    <button class="btn btn-secondary" id="startStockImportBtn" onclick="stockImportManager.startImport()" disabled>
                        📥 Импортировать остатки
                    </button>
                </div>
                <div id="stockImportPreview" style="margin-top: 1rem;"></div>
                <div id="stockImportErrors" style="margin-top: 1rem;"></div>
            </div>
        `;
    }

    async handleFileSelect(file) {
        if (!file) return;

        // Валидация размера файла (до 100 МБ)
        const maxSize = 100 * 1024 * 1024; // 100 МБ
        if (file.size > maxSize) {
            alert('❌ Размер файла превышает 100 МБ');
            return;
        }

        this.selectedFile = file;
        const preview = document.getElementById('stockImportPreview');
        const errorsDiv = document.getElementById('stockImportErrors');
        const importBtn = document.getElementById('startStockImportBtn');

        preview.innerHTML = '<p style="color: #666;">⏳ Обработка файла...</p>';
        errorsDiv.innerHTML = '';

        try {
            const text = await this.readFileAsText(file);
            this.parsedData = await this.parseFile(text, file.name);
            
            if (this.parsedData.errors && this.parsedData.errors.length > 0) {
                this.validationErrors = this.parsedData.errors;
                this.renderErrors();
            } else {
                this.validationErrors = [];
            }

            this.renderPreview();
            importBtn.disabled = this.validationErrors.length > 0;
        } catch (error) {
            console.error('File parsing error:', error);
            preview.innerHTML = `<p style="color: #ef4444;">❌ Ошибка обработки файла: ${error.message}</p>`;
            importBtn.disabled = true;
        }
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file, 'UTF-8');
        });
    }

    async parseFile(text, fileName) {
        const extension = fileName.split('.').pop().toLowerCase();
        const errors = [];
        const rows = [];

        if (extension === 'csv' || extension === 'txt') {
            return this.parseCSV(text, errors);
        } else if (extension === 'xlsx' || extension === 'xls') {
            // Для Excel файлов нужна библиотека, пока используем CSV парсинг
            alert('⚠️ Excel файлы требуют серверной обработки. Пожалуйста, сохраните файл как CSV.');
            return { rows: [], errors: ['Excel файлы требуют серверной обработки'] };
        }

        return { rows, errors };
    }

    parseCSV(text, errors) {
        const rows = [];
        const lines = text.split('\n').filter(line => line.trim());
        
        // Ограничение до 50 000 строк
        if (lines.length > 50000) {
            errors.push(`⚠️ Файл содержит более 50 000 строк. Будут обработаны первые 50 000.`);
        }

        const maxLines = Math.min(lines.length, 50000);
        const headers = this.parseCSVLine(lines[0]);

        // Ожидаемые колонки согласно ТЗ
        const expectedColumns = [
            'Наименование', 'Штрихкод', 'Ед. изм.', 'Закупочная цена', 
            'Ставка НДС', 'Категория', 'Тип', 'Остаток'
        ];

        // Автоматическое определение колонок
        const columnMap = {};
        headers.forEach((header, index) => {
            const headerLower = header.toLowerCase().trim();
            expectedColumns.forEach(expected => {
                const expectedLower = expected.toLowerCase();
                if (headerLower.includes(expectedLower) || 
                    (expectedLower === 'наименование' && (headerLower.includes('название') || headerLower.includes('name'))) ||
                    (expectedLower === 'штрихкод' && (headerLower.includes('barcode') || headerLower.includes('код'))) ||
                    (expectedLower === 'ед. изм.' && (headerLower.includes('единица') || headerLower.includes('unit'))) ||
                    (expectedLower === 'закупочная цена' && (headerLower.includes('цена') || headerLower.includes('price'))) ||
                    (expectedLower === 'ставка ндс' && (headerLower.includes('ндс') || headerLower.includes('vat'))) ||
                    (expectedLower === 'категория' && (headerLower.includes('category') || headerLower.includes('cat'))) ||
                    (expectedLower === 'тип' && (headerLower.includes('type'))) ||
                    (expectedLower === 'остаток' && (headerLower.includes('quantity') || headerLower.includes('stock')))
                ) {
                    columnMap[expected] = index;
                }
            });
        });

        // Проверка обязательных колонок
        if (!columnMap['Наименование']) {
            errors.push('❌ Не найдена колонка "Наименование"');
        }
        if (!columnMap['Остаток']) {
            errors.push('❌ Не найдена колонка "Остаток"');
        }

        // Парсинг строк
        for (let i = 1; i < maxLines; i++) {
            const values = this.parseCSVLine(lines[i]);
            if (values.length === 0) continue;

            const row = {
                name: values[columnMap['Наименование']]?.trim() || '',
                barcode: values[columnMap['Штрихкод']]?.trim() || '',
                unit: values[columnMap['Ед. изм.']]?.trim() || 'шт',
                purchase_price: this.parseFloatSafe(values[columnMap['Закупочная цена']]),
                vat_rate: this.parseVATRate(values[columnMap['Ставка НДС']]),
                category: values[columnMap['Категория']]?.trim() || '',
                type: values[columnMap['Тип']]?.trim() || 'товар',
                quantity: this.parseQuantity(values[columnMap['Остаток']], values[columnMap['Ед. изм.']]?.trim() || 'шт')
            };

            // Валидация строки
            const rowErrors = this.validateStockRow(row, i + 1);
            if (rowErrors.length > 0) {
                errors.push(...rowErrors);
            } else {
                rows.push(row);
            }
        }

        return { rows, errors };
    }

    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current);

        return values.map(v => v.trim().replace(/^"|"$/g, ''));
    }

    parseFloatSafe(value) {
        if (!value || value === '') return null;
        const parsed = parseFloat(value.toString().replace(',', '.'));
        return isNaN(parsed) ? null : parsed;
    }

    parseVATRate(value) {
        if (!value || value === '') return null;
        const str = value.toString().toLowerCase().trim();
        if (str.includes('без') || str.includes('0')) return '0';
        if (str.includes('10')) return '10';
        if (str.includes('20')) return '20';
        return null;
    }

    parseQuantity(value, unit) {
        const parsed = this.parseFloatSafe(value);
        if (parsed === null || parsed <= 0) return 0;
        
        // Округление: для фасованных товаров (шт) - до целого, для весовых - до 3 знаков
        const unitLower = (unit || 'шт').toLowerCase();
        const isWeighted = unitLower.includes('кг') || unitLower.includes('г') || 
                          unitLower.includes('л') || unitLower.includes('мл');
        
        if (isWeighted) {
            return Math.round(parsed * 1000) / 1000; // До 3 знаков после запятой
        } else {
            return Math.round(parsed); // До целого
        }
    }

    validateStockRow(row, lineNumber) {
        const errors = [];

        if (!row.name || row.name.trim() === '') {
            errors.push(`Строка ${lineNumber}: Пустое наименование товара`);
        }

        if (row.quantity < 0) {
            errors.push(`Строка ${lineNumber}: Отрицательный остаток`);
        }

        if (row.purchase_price !== null && row.purchase_price < 0) {
            errors.push(`Строка ${lineNumber}: Отрицательная закупочная цена`);
        }

        if (row.quantity > 0 && row.purchase_price === null) {
            // Предупреждение, но не ошибка
            console.warn(`Строка ${lineNumber}: Товар с остатком без закупочной цены`);
        }

        return errors;
    }

    renderPreview() {
        const preview = document.getElementById('stockImportPreview');
        if (!this.parsedData || !this.parsedData.rows) {
            preview.innerHTML = '<p style="color: #666;">Нет данных для предпросмотра</p>';
            return;
        }

        const rows = this.parsedData.rows;
        const withStock = rows.filter(r => r.quantity > 0).length;
        const withoutStock = rows.filter(r => r.quantity <= 0).length;

        preview.innerHTML = `
            <div style="background: #f9fafb; padding: 1rem; border-radius: 8px;">
                <h4 style="margin: 0 0 0.5rem 0;">📊 Статистика импорта</h4>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
                    <div>
                        <strong>Всего строк:</strong> ${rows.length}
                    </div>
                    <div>
                        <strong>С остатком:</strong> ${withStock}
                    </div>
                    <div>
                        <strong>Без остатка:</strong> ${withoutStock}
                    </div>
                </div>
                ${rows.length > 0 ? `
                    <div style="margin-top: 1rem;">
                        <h5>Первые 5 строк:</h5>
                        <table class="data-table" style="font-size: 0.9em;">
                            <thead>
                                <tr>
                                    <th>Наименование</th>
                                    <th>Штрихкод</th>
                                    <th>Ед. изм.</th>
                                    <th>Остаток</th>
                                    <th>Цена</th>
                                    <th>НДС</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows.slice(0, 5).map(row => `
                                    <tr>
                                        <td>${this.escapeHtml(row.name)}</td>
                                        <td>${row.barcode || '—'}</td>
                                        <td>${row.unit}</td>
                                        <td><strong>${row.quantity}</strong></td>
                                        <td>${row.purchase_price ? `₽ ${row.purchase_price.toFixed(2)}` : '—'}</td>
                                        <td>${row.vat_rate ? `${row.vat_rate}%` : '—'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderErrors() {
        const errorsDiv = document.getElementById('stockImportErrors');
        if (!this.validationErrors || this.validationErrors.length === 0) {
            errorsDiv.innerHTML = '';
            return;
        }

        const criticalErrors = this.validationErrors.filter(e => e.includes('❌'));
        const warnings = this.validationErrors.filter(e => !e.includes('❌'));

        errorsDiv.innerHTML = `
            <div style="background: ${criticalErrors.length > 0 ? '#fee2e2' : '#fef3c7'}; padding: 1rem; border-radius: 8px; border: 1px solid ${criticalErrors.length > 0 ? '#fca5a5' : '#fbbf24'};">
                <h4 style="margin: 0 0 0.5rem 0; color: ${criticalErrors.length > 0 ? '#dc2626' : '#d97706'};">
                    ${criticalErrors.length > 0 ? '❌ Критические ошибки' : '⚠️ Предупреждения'}
                </h4>
                <ul style="margin: 0; padding-left: 1.5rem; max-height: 200px; overflow-y: auto;">
                    ${this.validationErrors.slice(0, 20).map(error => `
                        <li style="margin-bottom: 0.25rem; font-size: 0.9em;">${this.escapeHtml(error)}</li>
                    `).join('')}
                    ${this.validationErrors.length > 20 ? `<li>...и еще ${this.validationErrors.length - 20} ошибок</li>` : ''}
                </ul>
            </div>
        `;
    }

    async startImport() {
        if (!this.selectedFile || !this.parsedData) {
            alert('❌ Выберите файл для импорта');
            return;
        }

        if (this.validationErrors.length > 0) {
            const proceed = confirm(`⚠️ Найдено ${this.validationErrors.length} ошибок валидации.\n\nПродолжить импорт? (Ошибочные строки будут пропущены)`);
            if (!proceed) return;
        }

        const importBtn = document.getElementById('startStockImportBtn');
        importBtn.disabled = true;
        importBtn.textContent = '⏳ Импортируем...';

        try {
            const formData = new FormData();
            formData.append('file', this.selectedFile);
            formData.append('type', 'stock_balances');

            const response = await fetch(`${this.API_BASE}/importStock`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if (result.success || result.ok) {
                const message = result.message || `Импорт завершен. Обработано: ${result.processed || 0}, Создано актов: ${result.documents_created || 0}`;
                alert(`✅ ${message}`);
                
                // Обновляем интерфейс склада
                if (window.warehouseModule) {
                    await window.warehouseModule.loadInventory();
                    window.warehouseModule.render();
                }
                
                // Очищаем форму
                this.selectedFile = null;
                this.parsedData = null;
                this.validationErrors = [];
                document.getElementById('stockImportFile').value = '';
                document.getElementById('stockImportPreview').innerHTML = '';
                document.getElementById('stockImportErrors').innerHTML = '';
                importBtn.disabled = true;
            } else {
                throw new Error(result.error || 'Ошибка импорта');
            }
        } catch (error) {
            console.error('Stock import error:', error);
            alert('❌ Ошибка: ' + error.message);
        } finally {
            importBtn.disabled = false;
            importBtn.textContent = '📥 Импортировать остатки';
        }
    }

    downloadTemplate() {
        const headers = ['Наименование', 'Штрихкод', 'Ед. изм.', 'Закупочная цена', 'Ставка НДС', 'Категория', 'Тип', 'Остаток'];
        const example = ['Лосось', '4601234567890', 'кг', '1200', '20', 'Рыба', 'материал', '5.5'];
        
        let csv = headers.join(',') + '\n';
        csv += example.join(',') + '\n';
        csv += 'Мука пшеничная,4601234567891,кг,80,20,Мука,материал,10.0\n';
        csv += 'Кока-Кола 0.5л,4601234567892,шт,120,20,Напитки,товар,24\n';

        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `template_stock_import_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Инициализация
if (typeof window !== 'undefined') {
    window.StockImportManager = StockImportManager;
    window.stockImportManager = new StockImportManager();
}

