// Модуль дополнительных форм импорта (раздел 3.7 ТЗ)
// Импорт модификаторов, единиц измерения, обновление цен, нутриенты, изображения

class AdvancedImportManager {
    constructor() {
        this.API_BASE = '/api';
    }

    init() {
        this.render();
    }

    render() {
        const container = document.getElementById('advancedImportContent');
        if (!container) {
            console.warn('Container #advancedImportContent not found');
            return;
        }

        container.innerHTML = `
            <div class="advanced-import-management">
                <div class="import-header" style="margin-bottom: 2rem;">
                    <h2>📥 Дополнительные формы импорта</h2>
                    <p style="color: #666; margin-top: 0.5rem;">
                        Импорт справочников, обновление данных и массовые операции
                    </p>
                    <div style="margin-top: 1rem; padding: 1rem; background: #e8f5f3; border-radius: 8px; border-left: 4px solid var(--dandy-green, #08615C);">
                        <strong>📚 Нужна помощь?</strong> 
                        <a href="docs/import-instructions-ru.md" target="_blank" style="color: var(--dandy-green, #08615C); text-decoration: underline; margin-left: 0.5rem;">
                            Открыть подробную инструкцию по импорту
                        </a>
                        <div style="margin-top: 0.5rem; font-size: 0.9em; color: #666;">
                            В инструкции: структура CSV файлов, примеры, решение проблем с фото, импорт из 1С
                        </div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
                    <!-- Импорт модификаторов -->
                    <div class="card">
                        <h3 style="margin-bottom: 1rem;">⚙️ Модификаторы и допы</h3>
                        <p style="color: #666; font-size: 0.9em; margin-bottom: 1rem;">
                            Импорт модификаторов (соусы, опции приготовления, доп. ингредиенты)
                        </p>
                        <button class="btn btn-primary" onclick="advancedImportManager.showModifiersImport()">
                            📥 Импорт модификаторов
                        </button>
                        <button class="btn btn-secondary btn-small" onclick="advancedImportManager.downloadTemplate('modifiers')" style="margin-top: 0.5rem;">
                            📄 Скачать шаблон
                        </button>
                    </div>

                    <!-- Импорт единиц измерения -->
                    <div class="card">
                        <h3 style="margin-bottom: 1rem;">📏 Единицы измерения</h3>
                        <p style="color: #666; font-size: 0.9em; margin-bottom: 1rem;">
                            Импорт справочника единиц измерения и упаковок
                        </p>
                        <button class="btn btn-primary" onclick="advancedImportManager.showUnitsImport()">
                            📥 Импорт единиц
                        </button>
                        <button class="btn btn-secondary btn-small" onclick="advancedImportManager.downloadTemplate('units')" style="margin-top: 0.5rem;">
                            📄 Скачать шаблон
                        </button>
                    </div>

                    <!-- Обновление цен -->
                    <div class="card">
                        <h3 style="margin-bottom: 1rem;">💰 Обновление цен</h3>
                        <p style="color: #666; font-size: 0.9em; margin-bottom: 1rem;">
                            Массовая переоценка товаров по коду или штрих-коду
                        </p>
                        <button class="btn btn-primary" onclick="advancedImportManager.showPriceUpdate()">
                            📥 Обновить цены
                        </button>
                        <button class="btn btn-secondary btn-small" onclick="advancedImportManager.downloadTemplate('prices')" style="margin-top: 0.5rem;">
                            📄 Скачать шаблон
                        </button>
                    </div>

                    <!-- Импорт нутриентов -->
                    <div class="card">
                        <h3 style="margin-bottom: 1rem;">🥗 Энергетическая ценность</h3>
                        <p style="color: #666; font-size: 0.9em; margin-bottom: 1rem;">
                            Импорт калорийности, белков, жиров, углеводов для блюд
                        </p>
                        <button class="btn btn-primary" onclick="advancedImportManager.showNutritionImport()">
                            📥 Импорт нутриентов
                        </button>
                        <button class="btn btn-secondary btn-small" onclick="advancedImportManager.downloadTemplate('nutrition')" style="margin-top: 0.5rem;">
                            📄 Скачать шаблон
                        </button>
                    </div>

                    <!-- Импорт изображений -->
                    <div class="card">
                        <h3 style="margin-bottom: 1rem;">🖼️ Изображения</h3>
                        <p style="color: #666; font-size: 0.9em; margin-bottom: 1rem;">
                            Импорт изображений из ZIP архива или по URL из файла
                        </p>
                        <button class="btn btn-primary" onclick="advancedImportManager.showImagesImport()">
                            📥 Импорт изображений
                        </button>
                        <button class="btn btn-secondary btn-small" onclick="advancedImportManager.downloadTemplate('images')" style="margin-top: 0.5rem;">
                            📄 Скачать шаблон
                        </button>
                    </div>

                    <!-- Импорт категорий -->
                    <div class="card">
                        <h3 style="margin-bottom: 1rem;">📂 Категории</h3>
                        <p style="color: #666; font-size: 0.9em; margin-bottom: 1rem;">
                            Импорт структуры категорий меню и складских групп
                        </p>
                        <button class="btn btn-primary" onclick="advancedImportManager.showCategoriesImport()">
                            📥 Импорт категорий
                        </button>
                        <button class="btn btn-secondary btn-small" onclick="advancedImportManager.downloadTemplate('categories')" style="margin-top: 0.5rem;">
                            📄 Скачать шаблон
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    showModifiersImport() {
        const modal = this.createModal('Импорт модификаторов', `
            <form id="modifiersImportForm">
                <div class="form-group">
                    <label class="form-label">Файл CSV/Excel</label>
                    <input type="file" id="modifiersFile" accept=".csv,.xlsx,.xls" class="form-input" required>
                    <small class="form-text">Формат: name, price, category_menu, type, applied_to</small>
                </div>
                <div class="form-group">
                    <label class="form-label">Опции импорта</label>
                    <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <input type="checkbox" id="updateExistingModifiers" checked>
                        Обновлять существующие модификаторы
                    </label>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">📥 Импортировать</button>
                    <button type="button" class="btn btn-secondary" onclick="advancedImportManager.closeModal()">Отмена</button>
                </div>
            </form>
        `);

        modal.querySelector('#modifiersImportForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const file = document.getElementById('modifiersFile').files[0];
            if (!file) {
                alert('Выберите файл');
                return;
            }
            await this.importModifiers(file);
        });
    }

    showUnitsImport() {
        const modal = this.createModal('Импорт единиц измерения', `
            <form id="unitsImportForm">
                <div class="form-group">
                    <label class="form-label">Файл CSV/Excel</label>
                    <input type="file" id="unitsFile" accept=".csv,.xlsx,.xls" class="form-input" required>
                    <small class="form-text">Формат: unit_code, unit_name, conversion_factor_to_base_unit</small>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">📥 Импортировать</button>
                    <button type="button" class="btn btn-secondary" onclick="advancedImportManager.closeModal()">Отмена</button>
                </div>
            </form>
        `);

        modal.querySelector('#unitsImportForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const file = document.getElementById('unitsFile').files[0];
            if (!file) {
                alert('Выберите файл');
                return;
            }
            await this.importUnits(file);
        });
    }

    showPriceUpdate() {
        const modal = this.createModal('Обновление цен', `
            <form id="priceUpdateForm">
                <div class="form-group">
                    <label class="form-label">Файл CSV/Excel</label>
                    <input type="file" id="pricesFile" accept=".csv,.xlsx,.xls" class="form-input" required>
                    <small class="form-text">Формат: product_code/barcode, new_price, effective_date</small>
                </div>
                <div class="form-group">
                    <label class="form-label">Дата вступления в силу</label>
                    <input type="date" id="effectiveDate" class="form-input" value="${new Date().toISOString().split('T')[0]}">
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">💰 Обновить цены</button>
                    <button type="button" class="btn btn-secondary" onclick="advancedImportManager.closeModal()">Отмена</button>
                </div>
            </form>
        `);

        modal.querySelector('#priceUpdateForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const file = document.getElementById('pricesFile').files[0];
            const effectiveDate = document.getElementById('effectiveDate').value;
            if (!file) {
                alert('Выберите файл');
                return;
            }
            await this.updatePrices(file, effectiveDate);
        });
    }

    showNutritionImport() {
        const modal = this.createModal('Импорт энергетической ценности', `
            <form id="nutritionImportForm">
                <div class="form-group">
                    <label class="form-label">Файл CSV/Excel</label>
                    <input type="file" id="nutritionFile" accept=".csv,.xlsx,.xls" class="form-input" required>
                    <small class="form-text">Формат: product_code/name, energy_kcal, energy_kj, proteins, fats, carbohydrates</small>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">📥 Импортировать</button>
                    <button type="button" class="btn btn-secondary" onclick="advancedImportManager.closeModal()">Отмена</button>
                </div>
            </form>
        `);

        modal.querySelector('#nutritionImportForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const file = document.getElementById('nutritionFile').files[0];
            if (!file) {
                alert('Выберите файл');
                return;
            }
            await this.importNutrition(file);
        });
    }

    showImagesImport() {
        const modal = this.createModal('Импорт изображений', `
            <form id="imagesImportForm">
                <div class="form-group">
                    <label class="form-label">Вариант импорта</label>
                    <select id="imagesImportType" class="form-input" onchange="advancedImportManager.toggleImagesImportType()">
                        <option value="zip">ZIP архив с изображениями</option>
                        <option value="csv">CSV файл с URL изображений</option>
                    </select>
                </div>
                <div class="form-group" id="imagesZipGroup">
                    <label class="form-label">ZIP архив</label>
                    <input type="file" id="imagesZip" accept=".zip" class="form-input">
                    <small class="form-text">Архив должен содержать изображения, названные по SKU или названию товара</small>
                </div>
                <div class="form-group" id="imagesCsvGroup" style="display: none;">
                    <label class="form-label">CSV файл с URL</label>
                    <input type="file" id="imagesCsv" accept=".csv,.xlsx,.xls" class="form-input">
                    <small class="form-text">Формат: product_code/name, image_url</small>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">📥 Импортировать</button>
                    <button type="button" class="btn btn-secondary" onclick="advancedImportManager.closeModal()">Отмена</button>
                </div>
            </form>
        `);

        modal.querySelector('#imagesImportForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const importType = document.getElementById('imagesImportType').value;
            if (importType === 'zip') {
                const file = document.getElementById('imagesZip').files[0];
                if (!file) {
                    alert('Выберите ZIP архив');
                    return;
                }
                await this.importImagesFromZip(file);
            } else {
                const file = document.getElementById('imagesCsv').files[0];
                if (!file) {
                    alert('Выберите CSV файл');
                    return;
                }
                await this.importImagesFromCsv(file);
            }
        });
    }

    showCategoriesImport() {
        const modal = this.createModal('Импорт категорий', `
            <form id="categoriesImportForm">
                <div class="form-group">
                    <label class="form-label">Файл CSV/Excel</label>
                    <input type="file" id="categoriesFile" accept=".csv,.xlsx,.xls" class="form-input" required>
                    <small class="form-text">Формат: slug, parent_slug, category_name, type, display_on_site, display_in_nav</small>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">📥 Импортировать</button>
                    <button type="button" class="btn btn-secondary" onclick="advancedImportManager.closeModal()">Отмена</button>
                </div>
            </form>
        `);

        modal.querySelector('#categoriesImportForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const file = document.getElementById('categoriesFile').files[0];
            if (!file) {
                alert('Выберите файл');
                return;
            }
            await this.importCategories(file);
        });
    }

    toggleImagesImportType() {
        const type = document.getElementById('imagesImportType').value;
        document.getElementById('imagesZipGroup').style.display = type === 'zip' ? 'block' : 'none';
        document.getElementById('imagesCsvGroup').style.display = type === 'csv' ? 'block' : 'none';
    }

    async importModifiers(file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'modifiers');

        try {
            const response = await fetch(`${this.API_BASE}/importModifiers`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.success || result.ok) {
                alert(`✅ Импортировано модификаторов: ${result.imported || 0}`);
                this.closeModal();
            } else {
                throw new Error(result.error || 'Ошибка импорта');
            }
        } catch (error) {
            console.error('Import modifiers error:', error);
            alert('❌ Ошибка: ' + error.message);
        }
    }

    async importUnits(file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'units');

        try {
            const response = await fetch(`${this.API_BASE}/importUnits`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.success || result.ok) {
                alert(`✅ Импортировано единиц измерения: ${result.imported || 0}`);
                this.closeModal();
            } else {
                throw new Error(result.error || 'Ошибка импорта');
            }
        } catch (error) {
            console.error('Import units error:', error);
            alert('❌ Ошибка: ' + error.message);
        }
    }

    async updatePrices(file, effectiveDate) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'prices');
        formData.append('effective_date', effectiveDate);

        try {
            const response = await fetch(`${this.API_BASE}/updatePrices`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.success || result.ok) {
                alert(`✅ Обновлено цен: ${result.updated || 0}`);
                this.closeModal();
            } else {
                throw new Error(result.error || 'Ошибка обновления цен');
            }
        } catch (error) {
            console.error('Update prices error:', error);
            alert('❌ Ошибка: ' + error.message);
        }
    }

    async importNutrition(file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'nutrition');

        try {
            const response = await fetch(`${this.API_BASE}/importNutrition`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.success || result.ok) {
                alert(`✅ Импортировано нутриентов: ${result.imported || 0}`);
                this.closeModal();
            } else {
                throw new Error(result.error || 'Ошибка импорта');
            }
        } catch (error) {
            console.error('Import nutrition error:', error);
            alert('❌ Ошибка: ' + error.message);
        }
    }

    async importImagesFromZip(file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'images_zip');

        try {
            const response = await fetch(`${this.API_BASE}/importImages`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.success || result.ok) {
                let message = `✅ Импортировано изображений: ${result.imported || 0}`;
                if (result.errors > 0 && result.errorMessages && result.errorMessages.length > 0) {
                    message += `\n\n⚠️ Ошибок: ${result.errors}\n\n`;
                    message += result.errorMessages.slice(0, 5).join('\n');
                    if (result.errorMessages.length > 5) {
                        message += `\n... и еще ${result.errorMessages.length - 5} ошибок`;
                    }
                    message += '\n\n💡 Совет: Проверьте, что товары уже импортированы, а имена файлов совпадают с SKU или названием товара.';
                }
                alert(message);
                this.closeModal();
            } else {
                throw new Error(result.error || 'Ошибка импорта');
            }
        } catch (error) {
            console.error('Import images error:', error);
            let errorMessage = '❌ Ошибка: ' + error.message;
            errorMessage += '\n\n💡 Если фото не загружаются:';
            errorMessage += '\n1. Убедитесь, что товары уже импортированы';
            errorMessage += '\n2. Имена файлов должны совпадать с SKU или названием товара';
            errorMessage += '\n3. Примеры: PIZZA-001.jpg, Пицца Маргарита.jpg';
            errorMessage += '\n4. Поддерживаемые форматы: JPG, PNG, GIF, WEBP';
            alert(errorMessage);
        }
    }

    async importImagesFromCsv(file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'images_csv');

        try {
            const response = await fetch(`${this.API_BASE}/importImages`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.success || result.ok) {
                let message = `✅ Импортировано изображений: ${result.imported || 0}`;
                if (result.errors > 0 && result.errorMessages && result.errorMessages.length > 0) {
                    message += `\n\n⚠️ Ошибок: ${result.errors}\n\n`;
                    message += result.errorMessages.slice(0, 5).join('\n');
                    if (result.errorMessages.length > 5) {
                        message += `\n... и еще ${result.errorMessages.length - 5} ошибок`;
                    }
                }
                alert(message);
                this.closeModal();
            } else {
                throw new Error(result.error || 'Ошибка импорта');
            }
        } catch (error) {
            console.error('Import images error:', error);
            alert('❌ Ошибка: ' + error.message);
        }
    }

    async importCategories(file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'categories');

        try {
            const response = await fetch(`${this.API_BASE}/importCategories`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.success || result.ok) {
                alert(`✅ Импортировано категорий: ${result.imported || 0}`);
                this.closeModal();
            } else {
                throw new Error(result.error || 'Ошибка импорта');
            }
        } catch (error) {
            console.error('Import categories error:', error);
            alert('❌ Ошибка: ' + error.message);
        }
    }

    downloadTemplate(type) {
        const templates = {
            modifiers: {
                headers: ['name', 'price', 'category_menu', 'type', 'applied_to'],
                example: ['Острый соус', '50', 'Соусы', 'modifier', 'Пицца, Роллы']
            },
            units: {
                headers: ['unit_code', 'unit_name', 'conversion_factor_to_base_unit'],
                example: ['kg', 'Килограмм', '1', 'шт', 'Штука', '1']
            },
            prices: {
                headers: ['product_code', 'new_price', 'effective_date'],
                example: ['SKU-001', '299', '2025-01-15']
            },
            nutrition: {
                headers: ['product_code', 'energy_kcal', 'energy_kj', 'proteins', 'fats', 'carbohydrates'],
                example: ['SKU-001', '250', '1046', '12', '8', '30']
            },
            images: {
                headers: ['product_code', 'image_url'],
                example: ['SKU-001', 'https://example.com/image.jpg']
            },
            categories: {
                headers: ['slug', 'parent_slug', 'category_name', 'type', 'display_on_site', 'display_in_nav'],
                example: ['pizza', '', 'Пицца', 'menu', '1', '1']
            }
        };

        const template = templates[type];
        if (!template) {
            alert('Шаблон не найден');
            return;
        }

        let csv = template.headers.join(',') + '\n';
        csv += template.example.join(',') + '\n';

        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `template_${type}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }

    createModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="advancedImportManager.closeModal()">×</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }

    closeModal() {
        document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
    }
}

// Инициализация
if (typeof window !== 'undefined') {
    window.AdvancedImportManager = AdvancedImportManager;
    window.advancedImportManager = new AdvancedImportManager();
}

