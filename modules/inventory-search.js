/**
 * DANDY Inventory System - Global Search Module
 * Глобальный поиск по всей системе
 */

class GlobalSearchModule {
    constructor(system) {
        this.system = system;
        this.searchIndex = [];
        this.buildSearchIndex();
    }

    buildSearchIndex() {
        this.searchIndex = [];

        // Индексируем товары
        this.system.products.forEach(product => {
            this.searchIndex.push({
                type: 'product',
                id: product.id,
                title: product.name,
                subtitle: `${product.type} • ${product.category || 'Без категории'}`,
                description: `Код: ${product.code} • Цена: ₽${product.price || 0}`,
                keywords: [product.name, product.code, product.type, product.category, product.barcode].filter(Boolean),
                data: product,
                icon: '📦',
                action: () => {
                    this.system.switchPage('nomenclature');
                    setTimeout(() => nomenclatureModule.showProductDetails(product.id), 100);
                }
            });
        });

        // Индексируем рецепты
        this.system.recipes.forEach(recipe => {
            this.searchIndex.push({
                type: 'recipe',
                id: recipe.id,
                title: recipe.name,
                subtitle: `Технологическая карта • Выход: ${recipe.outputQty} ${recipe.outputUnit}`,
                description: `Код: ${recipe.code} • Себестоимость: ₽${recipe.cost || 0}`,
                keywords: [recipe.name, recipe.code, 'рецепт', 'техкарта'].filter(Boolean),
                data: recipe,
                icon: '📖',
                action: () => {
                    this.system.switchPage('recipes');
                    setTimeout(() => recipesModule.viewRecipe(recipe.id), 100);
                }
            });
        });

        // Индексируем документы склада
        if (this.system.warehouseDocs) {
            this.system.warehouseDocs.forEach(doc => {
                this.searchIndex.push({
                    type: 'document',
                    id: doc.id,
                    title: `${doc.type} ${doc.number}`,
                    subtitle: `${doc.warehouse} • ${new Date(doc.date).toLocaleDateString('ru-RU')}`,
                    description: `Сумма: ₽${doc.totalAmount || 0} • Статус: ${doc.status}`,
                    keywords: [doc.number, doc.type, doc.supplier, doc.warehouse].filter(Boolean),
                    data: doc,
                    icon: '📄',
                    action: () => {
                        this.system.switchPage('warehouse');
                        setTimeout(() => warehouseModule.viewDocument(doc.id), 100);
                    }
                });
            });
        }

        // Индексируем категории
        const categories = [...new Set(this.system.products.map(p => p.category).filter(Boolean))];
        categories.forEach(category => {
            this.searchIndex.push({
                type: 'category',
                id: category,
                title: category,
                subtitle: `Категория товаров`,
                description: `${this.system.products.filter(p => p.category === category).length} товаров`,
                keywords: [category, 'категория'],
                icon: '🏷️',
                action: () => {
                    this.system.switchPage('nomenclature');
                    setTimeout(() => {
                        const filterInput = document.getElementById('productCategoryFilter');
                        if (filterInput) {
                            filterInput.value = category;
                            nomenclatureModule.filterProducts();
                        }
                    }, 100);
                }
            });
        });

        console.log('🔍 Search index built:', this.searchIndex.length, 'items');
    }

    search(query) {
        if (!query || query.trim().length < 2) {
            return [];
        }

        query = query.toLowerCase().trim();
        const words = query.split(' ').filter(w => w.length > 0);

        const results = this.searchIndex.map(item => {
            let score = 0;

            // Поиск в заголовке (высший приоритет)
            if (item.title.toLowerCase().includes(query)) {
                score += 100;
            }

            // Поиск в ключевых словах
            words.forEach(word => {
                item.keywords.forEach(keyword => {
                    if (keyword.toLowerCase().includes(word)) {
                        score += 50;
                    }
                });
            });

            // Поиск в подзаголовке
            if (item.subtitle.toLowerCase().includes(query)) {
                score += 30;
            }

            // Поиск в описании
            if (item.description.toLowerCase().includes(query)) {
                score += 10;
            }

            return { ...item, score };
        });

        // Фильтруем и сортируем по релевантности
        return results
            .filter(r => r.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 50); // Топ-50 результатов
    }

    renderSearchUI() {
        const header = document.querySelector('.header');
        if (!header) return;

        // Проверяем, не добавлен ли уже
        if (document.getElementById('globalSearchContainer')) return;

        const searchContainer = document.createElement('div');
        searchContainer.id = 'globalSearchContainer';
        searchContainer.style.cssText = `
            position: relative;
            margin: 0 2rem;
            flex: 1;
            max-width: 500px;
        `;

        searchContainer.innerHTML = `
            <div style="position: relative;">
                <input 
                    type="text" 
                    id="globalSearchInput" 
                    placeholder="Поиск по всей системе..." 
                    style="
                        width: 100%;
                        padding: 0.7rem 1rem 0.7rem 2.5rem;
                        background: rgba(255,255,255,0.1);
                        border: 1px solid var(--chip-border);
                        border-radius: 25px;
                        color: var(--text-light);
                        font-size: 0.9rem;
                        transition: all 0.3s ease;
                    "
                />
                <span style="
                    position: absolute;
                    left: 1rem;
                    top: 50%;
                    transform: translateY(-50%);
                    pointer-events: none;
                    opacity: 0.6;
                ">🔍</span>
                <div id="globalSearchResults" style="
                    display: none;
                    position: absolute;
                    top: calc(100% + 0.5rem);
                    left: 0;
                    right: 0;
                    max-height: 500px;
                    overflow-y: auto;
                    background: #094a45;
                    border: 1px solid var(--chip-border);
                    border-radius: 12px;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
                    z-index: 1000;
                "></div>
            </div>
        `;

        header.appendChild(searchContainer);

        // Обработчики событий
        const input = document.getElementById('globalSearchInput');
        const results = document.getElementById('globalSearchResults');

        let searchTimeout;
        input.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.performSearch(e.target.value);
            }, 300);
        });

        input.addEventListener('focus', () => {
            if (input.value.trim().length >= 2) {
                results.style.display = 'block';
            }
        });

        // Закрытие по клику вне
        document.addEventListener('click', (e) => {
            if (!searchContainer.contains(e.target)) {
                results.style.display = 'none';
            }
        });

        // Горячая клавиша Ctrl+K или Cmd+K
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                input.focus();
                input.select();
            }
        });

        console.log('🔍 Global search UI rendered');
    }

    performSearch(query) {
        const resultsContainer = document.getElementById('globalSearchResults');
        if (!resultsContainer) return;

        if (!query || query.trim().length < 2) {
            resultsContainer.style.display = 'none';
            return;
        }

        const results = this.search(query);

        if (results.length === 0) {
            resultsContainer.innerHTML = `
                <div style="padding: 2rem; text-align: center; color: var(--text-light); opacity: 0.7;">
                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔍</div>
                    <p>Ничего не найдено</p>
                </div>
            `;
        } else {
            resultsContainer.innerHTML = `
                <div style="padding: 0.5rem;">
                    <div style="padding: 0.5rem 1rem; color: var(--text-light); opacity: 0.7; font-size: 0.85rem;">
                        Найдено: ${results.length}
                    </div>
                    ${results.map(r => this.renderSearchResult(r)).join('')}
                </div>
            `;
        }

        resultsContainer.style.display = 'block';
    }

    renderSearchResult(result) {
        return `
            <div 
                onclick="globalSearchModule.selectResult(${result.id})"
                style="
                    padding: 1rem;
                    margin: 0.25rem;
                    background: rgba(255,255,255,0.05);
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    border: 1px solid transparent;
                "
                onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.borderColor='var(--accent)'"
                onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.borderColor='transparent'"
            >
                <div style="display: flex; align-items: start; gap: 1rem;">
                    <div style="font-size: 1.5rem;">${result.icon}</div>
                    <div style="flex: 1;">
                        <div style="color: var(--text-light); font-weight: 600; margin-bottom: 0.25rem;">
                            ${result.title}
                        </div>
                        <div style="color: var(--text-light); opacity: 0.8; font-size: 0.85rem; margin-bottom: 0.25rem;">
                            ${result.subtitle}
                        </div>
                        <div style="color: var(--text-light); opacity: 0.6; font-size: 0.8rem;">
                            ${result.description}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    selectResult(id) {
        const result = this.searchIndex.find(r => r.id === id);
        if (result && result.action) {
            result.action();
            
            // Закрываем результаты
            const resultsContainer = document.getElementById('globalSearchResults');
            if (resultsContainer) {
                resultsContainer.style.display = 'none';
            }
            
            // Очищаем поиск
            const input = document.getElementById('globalSearchInput');
            if (input) {
                input.value = '';
            }
        }
    }

    rebuild() {
        this.buildSearchIndex();
    }
}

// Глобальная функция для доступа из HTML
if (typeof window !== 'undefined') {
    window.GlobalSearchModule = GlobalSearchModule;
}

