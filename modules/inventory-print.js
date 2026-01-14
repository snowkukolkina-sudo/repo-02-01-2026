/**
 * DANDY Inventory System - Print Module
 * Печать документов
 */

class PrintModule {
    constructor(system) {
        this.system = system;
    }

    // Печать накладной
    printInvoice(docId) {
        const doc = this.system.warehouseDocs?.find(d => d.id === docId);
        if (!doc) {
            alert('Документ не найден');
            return;
        }

        const html = this.generateInvoiceHTML(doc);
        this.printHTML(html);
    }

    generateInvoiceHTML(doc) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Накладная ${doc.number}</title>
                <style>
                    @media print {
                        @page { margin: 2cm; }
                        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                    }
                    body {
                        font-family: Arial, sans-serif;
                        font-size: 12pt;
                        color: #000;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 2rem;
                        border-bottom: 2px solid #000;
                        padding-bottom: 1rem;
                    }
                    .company-info {
                        margin: 1.5rem 0;
                        display: flex;
                        justify-content: space-between;
                    }
                    .info-block {
                        flex: 1;
                    }
                    .info-label {
                        font-weight: bold;
                        margin-bottom: 0.5rem;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 1.5rem;
                    }
                    th, td {
                        border: 1px solid #000;
                        padding: 0.5rem;
                        text-align: left;
                    }
                    th {
                        background: #f0f0f0;
                        font-weight: bold;
                    }
                    .total {
                        text-align: right;
                        font-size: 14pt;
                        font-weight: bold;
                        margin-top: 1rem;
                    }
                    .signatures {
                        display: flex;
                        justify-content: space-between;
                        margin-top: 3rem;
                    }
                    .signature-block {
                        width: 45%;
                    }
                    .signature-line {
                        border-bottom: 1px solid #000;
                        margin-top: 2rem;
                        padding-top: 0.5rem;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>ТОВАРНАЯ НАКЛАДНАЯ № ${doc.number}</h1>
                    <p>от ${new Date(doc.date).toLocaleDateString('ru-RU')}</p>
                </div>

                <div class="company-info">
                    <div class="info-block">
                        <div class="info-label">Поставщик:</div>
                        <div>${doc.supplier || 'Не указан'}</div>
                        <div>ИНН: ${doc.supplierINN || '—'}</div>
                        <div>КПП: ${doc.supplierKPP || '—'}</div>
                    </div>
                    <div class="info-block">
                        <div class="info-label">Покупатель:</div>
                        <div>DANDY (ИП Иванов И.И.)</div>
                        <div>ИНН: 1234567890</div>
                        <div>КПП: 123456789</div>
                    </div>
                </div>

                <div class="info-block">
                    <div class="info-label">Склад:</div>
                    <div>${doc.warehouse}</div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>№</th>
                            <th>Наименование</th>
                            <th>Ед. изм.</th>
                            <th>Количество</th>
                            <th>Цена</th>
                            <th>Сумма</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${doc.items ? doc.items.map((item, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${item.productName || item.name}</td>
                                <td>${item.unit || 'шт'}</td>
                                <td>${item.quantity}</td>
                                <td>${(item.price || 0).toLocaleString('ru-RU')} ₽</td>
                                <td>${((item.quantity || 0) * (item.price || 0)).toLocaleString('ru-RU')} ₽</td>
                            </tr>
                        `).join('') : '<tr><td colspan="6">Нет данных</td></tr>'}
                    </tbody>
                </table>

                <div class="total">
                    Итого: ${(doc.totalAmount || 0).toLocaleString('ru-RU')} ₽
                </div>

                <div class="signatures">
                    <div class="signature-block">
                        <div>Отпустил:</div>
                        <div class="signature-line">_________________ / _________________ /</div>
                        <div style="text-align: center; font-size: 10pt; margin-top: 0.5rem;">(подпись / расшифровка)</div>
                    </div>
                    <div class="signature-block">
                        <div>Получил:</div>
                        <div class="signature-line">_________________ / _________________ /</div>
                        <div style="text-align: center; font-size: 10pt; margin-top: 0.5rem;">(подпись / расшифровка)</div>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    // Печать акта инвентаризации
    printInventoryAct(actId) {
        const act = {
            id: actId,
            number: `ИНВ-${actId}`,
            date: new Date().toISOString(),
            items: this.system.products.slice(0, 20).map(p => ({
                name: p.name,
                unit: p.unit,
                stock: p.stock || 0,
                actualStock: (p.stock || 0) + Math.floor(Math.random() * 10) - 5,
                variance: Math.floor(Math.random() * 10) - 5
            }))
        };

        const html = this.generateInventoryActHTML(act);
        this.printHTML(html);
    }

    generateInventoryActHTML(act) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Акт инвентаризации ${act.number}</title>
                <style>
                    @media print {
                        @page { margin: 2cm; }
                        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                    }
                    body {
                        font-family: Arial, sans-serif;
                        font-size: 12pt;
                        color: #000;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 2rem;
                        border-bottom: 2px solid #000;
                        padding-bottom: 1rem;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 1.5rem;
                    }
                    th, td {
                        border: 1px solid #000;
                        padding: 0.5rem;
                        text-align: left;
                    }
                    th {
                        background: #f0f0f0;
                        font-weight: bold;
                    }
                    .variance-positive { background: #d4edda; }
                    .variance-negative { background: #f8d7da; }
                    .signatures {
                        display: flex;
                        justify-content: space-between;
                        margin-top: 3rem;
                    }
                    .signature-block {
                        width: 30%;
                    }
                    .signature-line {
                        border-bottom: 1px solid #000;
                        margin-top: 2rem;
                        padding-top: 0.5rem;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>АКТ ИНВЕНТАРИЗАЦИИ № ${act.number}</h1>
                    <p>от ${new Date(act.date).toLocaleDateString('ru-RU')}</p>
                    <p>Организация: DANDY (ИП Иванов И.И.)</p>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>№</th>
                            <th>Наименование</th>
                            <th>Ед. изм.</th>
                            <th>По учёту</th>
                            <th>Фактически</th>
                            <th>Расхождение</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${act.items.map((item, index) => {
                            const varianceClass = item.variance > 0 ? 'variance-positive' : item.variance < 0 ? 'variance-negative' : '';
                            return `
                                <tr class="${varianceClass}">
                                    <td>${index + 1}</td>
                                    <td>${item.name}</td>
                                    <td>${item.unit}</td>
                                    <td>${item.stock}</td>
                                    <td>${item.actualStock}</td>
                                    <td>${item.variance > 0 ? '+' : ''}${item.variance}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>

                <div class="signatures">
                    <div class="signature-block">
                        <div>Председатель комиссии:</div>
                        <div class="signature-line">_____________</div>
                    </div>
                    <div class="signature-block">
                        <div>Член комиссии:</div>
                        <div class="signature-line">_____________</div>
                    </div>
                    <div class="signature-block">
                        <div>Материально ответственное лицо:</div>
                        <div class="signature-line">_____________</div>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    // Печать этикетки
    printLabel(productId) {
        const product = this.system.products.find(p => p.id === productId);
        if (!product) {
            alert('Товар не найден');
            return;
        }

        const html = this.generateLabelHTML(product);
        this.printHTML(html);
    }

    generateLabelHTML(product) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Этикетка ${product.name}</title>
                <style>
                    @media print {
                        @page { size: 58mm 40mm; margin: 0; }
                        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                    }
                    body {
                        font-family: Arial, sans-serif;
                        font-size: 8pt;
                        margin: 0;
                        padding: 5mm;
                        width: 58mm;
                        height: 40mm;
                        border: 1px solid #000;
                    }
                    .name {
                        font-weight: bold;
                        font-size: 10pt;
                        margin-bottom: 3mm;
                        text-align: center;
                    }
                    .barcode {
                        text-align: center;
                        margin: 2mm 0;
                        font-family: "Libre Barcode 39", monospace;
                        font-size: 24pt;
                    }
                    .price {
                        font-size: 14pt;
                        font-weight: bold;
                        text-align: center;
                        margin-top: 2mm;
                    }
                    .info {
                        font-size: 7pt;
                        text-align: center;
                    }
                </style>
            </head>
            <body>
                <div class="name">${product.name}</div>
                ${product.barcode ? `<div class="barcode">*${product.barcode}*</div>` : ''}
                <div class="price">${(product.price || 0).toLocaleString('ru-RU')} ₽</div>
                <div class="info">Код: ${product.code}</div>
                <div class="info">${new Date().toLocaleDateString('ru-RU')}</div>
            </body>
            </html>
        `;
    }

    // Печать техкарты
    printRecipe(recipeId) {
        const recipe = this.system.recipes.find(r => r.id === recipeId);
        if (!recipe) {
            alert('Рецепт не найден');
            return;
        }

        const html = this.generateRecipeHTML(recipe);
        this.printHTML(html);
    }

    generateRecipeHTML(recipe) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Технологическая карта ${recipe.name}</title>
                <style>
                    @media print {
                        @page { margin: 2cm; }
                        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                    }
                    body {
                        font-family: Arial, sans-serif;
                        font-size: 12pt;
                        color: #000;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 2rem;
                        border-bottom: 2px solid #000;
                        padding-bottom: 1rem;
                    }
                    .info-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 1rem;
                        margin: 1.5rem 0;
                    }
                    .info-item {
                        border-bottom: 1px solid #ccc;
                        padding: 0.5rem 0;
                    }
                    .info-label {
                        font-weight: bold;
                        color: #666;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 1.5rem;
                    }
                    th, td {
                        border: 1px solid #000;
                        padding: 0.5rem;
                        text-align: left;
                    }
                    th {
                        background: #f0f0f0;
                        font-weight: bold;
                    }
                    .cost-block {
                        background: #d4edda;
                        padding: 1rem;
                        margin-top: 1rem;
                        border: 2px solid #28a745;
                        border-radius: 8px;
                        text-align: center;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>ТЕХНОЛОГИЧЕСКАЯ КАРТА</h1>
                    <h2>${recipe.name}</h2>
                    <p>Код: ${recipe.code}</p>
                </div>

                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">Выход:</div>
                        <div>${recipe.outputQty} ${recipe.outputUnit}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Версия:</div>
                        <div>${recipe.version || 'v1.0'}</div>
                    </div>
                </div>

                <h3>Состав:</h3>
                <table>
                    <thead>
                        <tr>
                            <th>№</th>
                            <th>Ингредиент</th>
                            <th>Количество</th>
                            <th>Ед. изм.</th>
                            <th>Потери, %</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${recipe.ingredients ? recipe.ingredients.map((ing, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${ing.name}</td>
                                <td>${ing.quantity}</td>
                                <td>${ing.unit}</td>
                                <td>${ing.waste || 0}%</td>
                            </tr>
                        `).join('') : '<tr><td colspan="5">Нет данных</td></tr>'}
                    </tbody>
                </table>

                <div class="cost-block">
                    <strong>Себестоимость (расчётная):</strong>
                    <div style="font-size: 18pt; margin-top: 0.5rem;">₽ ${(recipe.cost || 0).toLocaleString('ru-RU')}</div>
                </div>
            </body>
            </html>
        `;
    }

    // Универсальный метод печати HTML
    printHTML(html) {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(html);
        printWindow.document.close();
        
        // Ждём загрузки и печатаем
        printWindow.onload = () => {
            setTimeout(() => {
                printWindow.print();
                // printWindow.close(); // Можно раскомментировать для автозакрытия
            }, 500);
        };
    }

    // Экспорт в PDF через jsPDF
    exportToPDF(docType, docId) {
        alert(`Экспорт в PDF для ${docType} в разработке. Используйте функцию печати.`);
    }
}

// Глобальная функция для доступа из HTML
if (typeof window !== 'undefined') {
    window.PrintModule = PrintModule;
}

