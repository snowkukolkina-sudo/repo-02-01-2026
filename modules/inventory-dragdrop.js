/**
 * DANDY Inventory System - Drag & Drop Module
 * Загрузка файлов перетаскиванием
 */

class DragDropModule {
    constructor(system) {
        this.system = system;
        this.dropZones = [];
    }

    init() {
        console.log('🎯 Initializing Drag & Drop Module...');
        this.setupGlobalDragDrop();
    }

    setupGlobalDragDrop() {
        // Предотвращаем стандартное поведение для всего документа
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.body.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        // Показываем оверлей при перетаскивании файлов
        let dragCounter = 0;
        
        document.body.addEventListener('dragenter', (e) => {
            dragCounter++;
            if (dragCounter === 1) {
                this.showDropOverlay();
            }
        });

        document.body.addEventListener('dragleave', (e) => {
            dragCounter--;
            if (dragCounter === 0) {
                this.hideDropOverlay();
            }
        });

        document.body.addEventListener('drop', (e) => {
            dragCounter = 0;
            this.hideDropOverlay();
            this.handleDrop(e);
        });

        console.log('✅ Global drag & drop initialized');
    }

    showDropOverlay() {
        let overlay = document.getElementById('dragDropOverlay');
        
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'dragDropOverlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(9, 74, 69, 0.95);
                backdrop-filter: blur(10px);
                z-index: 9999;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                pointer-events: none;
            `;
            
            overlay.innerHTML = `
                <div style="text-align: center; color: var(--text-light);">
                    <div style="font-size: 5rem; margin-bottom: 1rem; animation: bounce 1s infinite;">📁</div>
                    <h2 style="margin: 0 0 1rem 0; color: var(--dandy-yellow);">Перетащите файлы сюда</h2>
                    <p style="font-size: 1.2rem; opacity: 0.9;">Поддерживаются: Excel (.xlsx, .xls, .csv), изображения (.jpg, .png)</p>
                </div>
            `;
            
            document.body.appendChild(overlay);
        }
        
        overlay.style.display = 'flex';
    }

    hideDropOverlay() {
        const overlay = document.getElementById('dragDropOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    handleDrop(e) {
        const files = e.dataTransfer.files;
        
        if (files.length === 0) return;

        console.log('📁 Files dropped:', files.length);

        // Определяем текущую страницу
        const currentPage = this.system.currentPage;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            this.processFile(file, currentPage);
        }
    }

    processFile(file, currentPage) {
        const fileName = file.name.toLowerCase();
        const fileType = file.type;

        console.log('📄 Processing file:', fileName, fileType);

        // Excel файлы
        if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv') || fileType.includes('spreadsheet')) {
            this.handleExcelDrop(file, currentPage);
        }
        // Изображения
        else if (fileType.startsWith('image/')) {
            this.handleImageDrop(file, currentPage);
        }
        // JSON
        else if (fileName.endsWith('.json')) {
            this.handleJSONDrop(file);
        }
        else {
            alert(`Неподдерживаемый тип файла: ${fileName}`);
        }
    }

    handleExcelDrop(file, currentPage) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Проверяем, что workbook содержит листы
                if (!workbook || !workbook.SheetNames || !Array.isArray(workbook.SheetNames) || workbook.SheetNames.length === 0) {
                    throw new Error('Файл не содержит листов или поврежден. Убедитесь, что это корректный Excel файл.');
                }
                
                const firstSheetName = workbook.SheetNames[0];
                const firstSheet = workbook.Sheets[firstSheetName];
                
                if (!firstSheet) {
                    throw new Error(`Не удалось прочитать данные из листа "${firstSheetName}".`);
                }
                
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);

                console.log('📊 Excel parsed:', jsonData.length, 'rows');

                // Показываем диалог импорта
                this.showImportDialog(file.name, jsonData, currentPage);
            } catch (error) {
                console.error('Error parsing Excel:', error);
                alert('Ошибка при чтении Excel файла');
            }
        };

        reader.readAsArrayBuffer(file);
    }

    showImportDialog(fileName, data, currentPage) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: #094a45; padding: 2rem; border-radius: 12px; max-width: 600px; width: 90%; max-height: 80vh; overflow: auto; border: 1px solid var(--chip-border);">
                <h2 style="color: #eebc5c; margin-top: 0;">📊 Импорт из ${fileName}</h2>
                <p style="color: var(--text-light);">Найдено записей: <strong>${data.length}</strong></p>
                
                <div style="margin: 1.5rem 0; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; max-height: 300px; overflow-y: auto;">
                    <table style="width: 100%; color: var(--text-light); font-size: 0.85rem;">
                        <thead>
                            <tr>
                                ${Object.keys(data[0] || {}).map(key => `<th style="text-align: left; padding: 0.5rem; border-bottom: 1px solid var(--chip-border);">${key}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${data.slice(0, 5).map(row => `
                                <tr>
                                    ${Object.values(row).map(val => `<td style="padding: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.1);">${val}</td>`).join('')}
                                </tr>
                            `).join('')}
                            ${data.length > 5 ? `<tr><td colspan="${Object.keys(data[0]).length}" style="text-align: center; padding: 0.5rem; opacity: 0.7;">... и ещё ${data.length - 5} записей</td></tr>` : ''}
                        </tbody>
                    </table>
                </div>

                <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                    <button onclick="this.closest('[style*=fixed]').remove()" class="btn-secondary">Отмена</button>
                    <button onclick="dragDropModule.confirmImport(${JSON.stringify(data).replace(/"/g, '&quot;')}, '${currentPage}'); this.closest('[style*=fixed]').remove()" class="btn-primary">✓ Импортировать</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    confirmImport(data, currentPage) {
        try {
            if (currentPage === 'nomenclature') {
                this.importProducts(data);
            } else if (currentPage === 'warehouse') {
                this.importWarehouseData(data);
            } else {
                alert('Импорт для этой страницы пока не поддерживается');
            }
        } catch (error) {
            console.error('Import error:', error);
            alert('Ошибка при импорте данных');
        }
    }

    importProducts(data) {
        let imported = 0;
        let skipped = 0;

        data.forEach(row => {
            // Пытаемся найти необходимые поля
            const name = row['Наименование'] || row['Название'] || row['name'] || row['Name'];
            const code = row['Код'] || row['code'] || row['Code'];
            const price = parseFloat(row['Цена'] || row['price'] || row['Price'] || 0);
            const type = row['Тип'] || row['type'] || row['Type'] || 'Ингредиент';

            if (!name) {
                skipped++;
                return;
            }

            // Проверяем дубликаты
            const exists = this.system.products.find(p => 
                p.name === name || p.code === code
            );

            if (exists) {
                skipped++;
                return;
            }

            // Создаём товар
            const product = {
                id: Date.now() + imported,
                code: code || `IMP-${Date.now()}-${imported}`,
                name: name,
                type: type,
                category: row['Категория'] || row['category'] || '',
                unit: row['Единица'] || row['unit'] || 'шт',
                price: price,
                cost: parseFloat(row['Себестоимость'] || row['cost'] || price * 0.4),
                minStock: parseFloat(row['Мин. остаток'] || row['minStock'] || 1),
                stock: parseFloat(row['Остаток'] || row['stock'] || 0),
                barcode: row['Штрихкод'] || row['barcode'] || '',
                supplier: row['Поставщик'] || row['supplier'] || '',
                isAlcohol: false
            };

            this.system.products.push(product);
            imported++;
        });

        this.system.saveProducts();
        
        if (nomenclatureModule) {
            nomenclatureModule.init();
        }

        if (globalSearchModule) {
            globalSearchModule.rebuild();
        }

        alert(`✅ Импортировано: ${imported}\n⏭️ Пропущено: ${skipped}`);
        console.log('✅ Import completed:', imported, 'products');
    }

    importWarehouseData(data) {
        alert('Импорт складских данных пока в разработке');
    }

    handleImageDrop(file, currentPage) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const imageData = e.target.result;
            console.log('🖼️ Image loaded:', file.name);
            
            // Здесь можно добавить логику для привязки изображения к товару
            alert(`Изображение "${file.name}" загружено. Функция привязки к товару в разработке.`);
        };

        reader.readAsDataURL(file);
    }

    handleJSONDrop(file) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const jsonData = JSON.parse(e.target.result);
                console.log('📄 JSON loaded:', jsonData);
                
                // Восстановление из backup
                if (confirm(`Восстановить данные из ${file.name}?`)) {
                    if (backupModule) {
                        backupModule.restoreFromData(jsonData);
                    }
                }
            } catch (error) {
                console.error('Error parsing JSON:', error);
                alert('Ошибка при чтении JSON файла');
            }
        };

        reader.readAsText(file);
    }

    // Создание зоны для перетаскивания
    createDropZone(elementId, callback) {
        const element = document.getElementById(elementId);
        if (!element) return;

        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            element.style.background = 'rgba(238, 188, 92, 0.2)';
            element.style.borderColor = 'var(--dandy-yellow)';
        });

        element.addEventListener('dragleave', (e) => {
            element.style.background = '';
            element.style.borderColor = '';
        });

        element.addEventListener('drop', (e) => {
            e.preventDefault();
            element.style.background = '';
            element.style.borderColor = '';
            
            const files = e.dataTransfer.files;
            if (callback) {
                callback(files);
            }
        });

        this.dropZones.push(elementId);
    }
}

// Глобальная функция для доступа из HTML
if (typeof window !== 'undefined') {
    window.DragDropModule = DragDropModule;
}

