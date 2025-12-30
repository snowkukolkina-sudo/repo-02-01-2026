/**
 * DANDY Inventory — Модуль отчётов и аналитики
 * COGS, Menu Engineering, ABC-XYZ, Waste Analysis
 */

class ReportsModule {
    constructor(inventorySystem) {
        this.system = inventorySystem;
        this.currentReport = null;
        this.dateRange = {
            from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            to: new Date().toISOString().split('T')[0]
        };
    }

    /**
     * Инициализация модуля
     */
    init() {
        console.log('📊 Reports module initialized');
        this.setupDatePickers();
    }

    /**
     * Настройка выбора дат
     */
    setupDatePickers() {
        const fromInput = document.getElementById('reportDateFrom');
        const toInput = document.getElementById('reportDateTo');
        
        if (fromInput) fromInput.value = this.dateRange.from;
        if (toInput) toInput.value = this.dateRange.to;
    }

    /**
     * Генерация отчёта COGS (себестоимость проданных товаров)
     */
    generateCOGSReport() {
        console.log('📊 Generating COGS report...');

        // Демо-данные продаж
        const salesData = [
            { dishId: 101, dishName: 'Пицца Пепперони', quantity: 45, revenue: 22500, costPrice: 8100 },
            { dishId: 102, dishName: 'Ролл Филадельфия', quantity: 38, revenue: 19000, costPrice: 8360 },
            { dishId: 103, dishName: 'Бургер Классик', quantity: 52, revenue: 20800, costPrice: 7280 },
            { dishId: 104, dishName: 'Паста Карбонара', quantity: 31, revenue: 15500, costPrice: 4650 },
            { dishId: 105, dishName: 'Салат Цезарь', quantity: 28, revenue: 11200, costPrice: 3920 }
        ];

        // Расчёт метрик
        const totalRevenue = salesData.reduce((sum, item) => sum + item.revenue, 0);
        const totalCOGS = salesData.reduce((sum, item) => sum + item.costPrice, 0);
        const grossProfit = totalRevenue - totalCOGS;
        const grossMargin = (grossProfit / totalRevenue * 100).toFixed(1);

        // Сортировка по марже
        const sortedByMargin = salesData.map(item => ({
            ...item,
            margin: ((item.revenue - item.costPrice) / item.revenue * 100).toFixed(1)
        })).sort((a, b) => b.margin - a.margin);

        this.currentReport = {
            type: 'cogs',
            period: `${this.dateRange.from} — ${this.dateRange.to}`,
            totalRevenue,
            totalCOGS,
            grossProfit,
            grossMargin,
            items: sortedByMargin
        };

        this.renderCOGSReport();
    }

    /**
     * Отрисовка отчёта COGS
     */
    renderCOGSReport() {
        const container = document.getElementById('reportResults');
        if (!container) return;

        const report = this.currentReport;

        container.innerHTML = `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h2 style="margin: 0; color: var(--dandy-green);">📊 COGS Report</h2>
                    <button class="btn btn-secondary" onclick="reportsModule.exportReport('cogs')">📥 Экспорт</button>
                </div>

                <div class="alert alert-info">
                    <span>📅</span>
                    <div>
                        <strong>Период:</strong> ${report.period}
                    </div>
                </div>

                <!-- Метрики -->
                <div class="grid grid-4" style="margin-bottom: 2rem;">
                    <div class="stat-card">
                        <div class="stat-value">₽ ${report.totalRevenue.toLocaleString('ru-RU')}</div>
                        <div class="stat-label">Выручка</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">₽ ${report.totalCOGS.toLocaleString('ru-RU')}</div>
                        <div class="stat-label">Себестоимость</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" style="color: var(--dandy-green);">₽ ${report.grossProfit.toLocaleString('ru-RU')}</div>
                        <div class="stat-label">Валовая прибыль</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" style="color: var(--dandy-green);">${report.grossMargin}%</div>
                        <div class="stat-label">Маржинальность</div>
                    </div>
                </div>

                <!-- Таблица по блюдам -->
                <h3 style="margin-bottom: 1rem;">По блюдам:</h3>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Блюдо</th>
                            <th style="text-align: right;">Продано</th>
                            <th style="text-align: right;">Выручка</th>
                            <th style="text-align: right;">Себестоимость</th>
                            <th style="text-align: right;">Прибыль</th>
                            <th style="text-align: right;">Маржа %</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${report.items.map(item => `
                            <tr>
                                <td><strong>${item.dishName}</strong></td>
                                <td style="text-align: right;">${item.quantity} шт</td>
                                <td style="text-align: right;">₽ ${item.revenue.toLocaleString('ru-RU')}</td>
                                <td style="text-align: right;">₽ ${item.costPrice.toLocaleString('ru-RU')}</td>
                                <td style="text-align: right; color: var(--dandy-green);">₽ ${(item.revenue - item.costPrice).toLocaleString('ru-RU')}</td>
                                <td style="text-align: right;">
                                    <span class="badge ${item.margin >= 70 ? 'badge-success' : item.margin >= 60 ? '' : 'badge-warning'}">
                                        ${item.margin}%
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <!-- График динамики -->
                <div style="margin-top: 2rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 1.5rem;">
                    <h3 style="margin: 0 0 1rem 0; color: #F3EADB;">📈 График динамики</h3>
                    <canvas id="cogsChart" style="max-height: 400px;"></canvas>
                </div>
            </div>
        `;

        // Рисуем график через Chart.js
        this.renderCOGSChart(report.items);
    }

    /**
     * Генерация Menu Engineering отчёта
     */
    generateMenuEngineeringReport() {
        console.log('📊 Generating Menu Engineering report...');

        // Демо-данные продаж с маржой и популярностью
        const menuData = [
            { dishId: 101, dishName: 'Пицца Пепперони', quantity: 45, margin: 64, category: 'stars' },
            { dishId: 102, dishName: 'Ролл Филадельфия', quantity: 38, margin: 56, category: 'plowhorses' },
            { dishId: 103, dishName: 'Бургер Классик', quantity: 52, margin: 65, category: 'stars' },
            { dishId: 104, dishName: 'Паста Карбонара', quantity: 31, margin: 70, category: 'puzzles' },
            { dishId: 105, dishName: 'Салат Цезарь', quantity: 28, margin: 65, category: 'puzzles' },
            { dishId: 106, dishName: 'Суп дня', quantity: 15, margin: 45, category: 'dogs' },
            { dishId: 107, dishName: 'Десерт Тирамису', quantity: 22, margin: 72, category: 'puzzles' },
            { dishId: 108, dishName: 'Картофель фри', quantity: 48, margin: 55, category: 'plowhorses' }
        ];

        // Группировка по категориям
        const stars = menuData.filter(d => d.category === 'stars');
        const plowhorses = menuData.filter(d => d.category === 'plowhorses');
        const puzzles = menuData.filter(d => d.category === 'puzzles');
        const dogs = menuData.filter(d => d.category === 'dogs');

        this.currentReport = {
            type: 'menu_engineering',
            period: `${this.dateRange.from} — ${this.dateRange.to}`,
            stars,
            plowhorses,
            puzzles,
            dogs
        };

        this.renderMenuEngineeringReport();
    }

    /**
     * Отрисовка Menu Engineering отчёта
     */
    renderMenuEngineeringReport() {
        const container = document.getElementById('reportResults');
        if (!container) return;

        const report = this.currentReport;

        container.innerHTML = `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h2 style="margin: 0; color: var(--dandy-green);">⭐ Menu Engineering</h2>
                    <button class="btn btn-secondary" onclick="reportsModule.exportReport('menu_engineering')">📥 Экспорт</button>
                </div>

                <div class="alert alert-info">
                    <span>ℹ️</span>
                    <div>
                        <strong>Метод:</strong> Классификация блюд по маржинальности и популярности<br>
                        <strong>Период:</strong> ${report.period}
                    </div>
                </div>

                <!-- Матрица 2x2 -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
                    <!-- Stars -->
                    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 1.5rem; border-radius: 12px; color: white;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
                            <span style="font-size: 1.5rem;">⭐</span>
                            <h3 style="margin: 0;">Stars (Звёзды)</h3>
                        </div>
                        <p style="opacity: 0.9; margin-bottom: 1rem; font-size: 0.9em;">Высокая маржа + Высокий спрос</p>
                        <div style="background: rgba(255,255,255,0.1); padding: 1rem; border-radius: 8px;">
                            ${report.stars.length > 0 ? report.stars.map(d => `
                                <div style="margin-bottom: 0.5rem;">
                                    <strong>${d.dishName}</strong><br>
                                    <span style="font-size: 0.85em; opacity: 0.9;">Продано: ${d.quantity} | Маржа: ${d.margin}%</span>
                                </div>
                            `).join('') : '<p style="opacity: 0.7;">Нет блюд в категории</p>'}
                        </div>
                        <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(255,255,255,0.2); border-radius: 8px; font-size: 0.9em;">
                            💡 <strong>Рекомендация:</strong> Продвигать, поддерживать качество
                        </div>
                    </div>

                    <!-- Puzzles -->
                    <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 1.5rem; border-radius: 12px; color: white;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
                            <span style="font-size: 1.5rem;">🧩</span>
                            <h3 style="margin: 0;">Puzzles (Загадки)</h3>
                        </div>
                        <p style="opacity: 0.9; margin-bottom: 1rem; font-size: 0.9em;">Высокая маржа + Низкий спрос</p>
                        <div style="background: rgba(255,255,255,0.1); padding: 1rem; border-radius: 8px;">
                            ${report.puzzles.length > 0 ? report.puzzles.map(d => `
                                <div style="margin-bottom: 0.5rem;">
                                    <strong>${d.dishName}</strong><br>
                                    <span style="font-size: 0.85em; opacity: 0.9;">Продано: ${d.quantity} | Маржа: ${d.margin}%</span>
                                </div>
                            `).join('') : '<p style="opacity: 0.7;">Нет блюд в категории</p>'}
                        </div>
                        <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(255,255,255,0.2); border-radius: 8px; font-size: 0.9em;">
                            💡 <strong>Рекомендация:</strong> Пересмотреть позиционирование, возможно убрать
                        </div>
                    </div>

                    <!-- Plowhorses -->
                    <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 1.5rem; border-radius: 12px; color: white;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
                            <span style="font-size: 1.5rem;">🐴</span>
                            <h3 style="margin: 0;">Plowhorses (Трудяги)</h3>
                        </div>
                        <p style="opacity: 0.9; margin-bottom: 1rem; font-size: 0.9em;">Низкая маржа + Высокий спрос</p>
                        <div style="background: rgba(255,255,255,0.1); padding: 1rem; border-radius: 8px;">
                            ${report.plowhorses.length > 0 ? report.plowhorses.map(d => `
                                <div style="margin-bottom: 0.5rem;">
                                    <strong>${d.dishName}</strong><br>
                                    <span style="font-size: 0.85em; opacity: 0.9;">Продано: ${d.quantity} | Маржа: ${d.margin}%</span>
                                </div>
                            `).join('') : '<p style="opacity: 0.7;">Нет блюд в категории</p>'}
                        </div>
                        <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(255,255,255,0.2); border-radius: 8px; font-size: 0.9em;">
                            💡 <strong>Рекомендация:</strong> Увеличить цену или снизить себестоимость
                        </div>
                    </div>

                    <!-- Dogs -->
                    <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 1.5rem; border-radius: 12px; color: white;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
                            <span style="font-size: 1.5rem;">🐕</span>
                            <h3 style="margin: 0;">Dogs (Собаки)</h3>
                        </div>
                        <p style="opacity: 0.9; margin-bottom: 1rem; font-size: 0.9em;">Низкая маржа + Низкий спрос</p>
                        <div style="background: rgba(255,255,255,0.1); padding: 1rem; border-radius: 8px;">
                            ${report.dogs.length > 0 ? report.dogs.map(d => `
                                <div style="margin-bottom: 0.5rem;">
                                    <strong>${d.dishName}</strong><br>
                                    <span style="font-size: 0.85em; opacity: 0.9;">Продано: ${d.quantity} | Маржа: ${d.margin}%</span>
                                </div>
                            `).join('') : '<p style="opacity: 0.7;">Нет блюд в категории</p>'}
                        </div>
                        <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(255,255,255,0.2); border-radius: 8px; font-size: 0.9em;">
                            💡 <strong>Рекомендация:</strong> Убрать из меню
                        </div>
                    </div>
                </div>

                <!-- Статистика -->
                <div class="grid grid-4">
                    <div class="stat-card">
                        <div class="stat-value" style="color: #10b981;">${report.stars.length}</div>
                        <div class="stat-label">Звёзд</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" style="color: #f59e0b;">${report.puzzles.length}</div>
                        <div class="stat-label">Загадок</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" style="color: #3b82f6;">${report.plowhorses.length}</div>
                        <div class="stat-label">Трудяг</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" style="color: #ef4444;">${report.dogs.length}</div>
                        <div class="stat-label">Собак</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Генерация ABC-XYZ анализа
     */
    generateABCXYZReport() {
        console.log('📊 Generating ABC-XYZ report...');

        // Демо-данные товаров с оборотом и волатильностью
        const productsData = [
            { id: 1, name: 'Лосось филе', revenue: 144000, volatility: 15, abc: 'A', xyz: 'X' },
            { id: 2, name: 'Сыр Моцарелла', revenue: 102000, volatility: 12, abc: 'A', xyz: 'X' },
            { id: 3, name: 'Мука пшеничная', revenue: 95000, volatility: 8, abc: 'A', xyz: 'X' },
            { id: 4, name: 'Томаты свежие', revenue: 78000, volatility: 45, abc: 'B', xyz: 'Y' },
            { id: 5, name: 'Говядина вырезка', revenue: 68000, volatility: 22, abc: 'B', xyz: 'Y' },
            { id: 6, name: 'Курица охлажденная', revenue: 54000, volatility: 18, abc: 'B', xyz: 'X' },
            { id: 7, name: 'Рис для роллов', revenue: 32000, volatility: 10, abc: 'C', xyz: 'X' },
            { id: 8, name: 'Креветки королевские', revenue: 28000, volatility: 65, abc: 'C', xyz: 'Z' },
            { id: 9, name: 'Пармезан тёртый', revenue: 18000, volatility: 38, abc: 'C', xyz: 'Y' },
            { id: 10, name: 'Трюфельное масло', revenue: 8000, volatility: 80, abc: 'C', xyz: 'Z' }
        ];

        // Группировка
        const categories = {
            'AX': [], 'AY': [], 'AZ': [],
            'BX': [], 'BY': [], 'BZ': [],
            'CX': [], 'CY': [], 'CZ': []
        };

        productsData.forEach(product => {
            const key = `${product.abc}${product.xyz}`;
            if (categories[key]) {
                categories[key].push(product);
            }
        });

        this.currentReport = {
            type: 'abc_xyz',
            period: `${this.dateRange.from} — ${this.dateRange.to}`,
            categories,
            totalRevenue: productsData.reduce((sum, p) => sum + p.revenue, 0)
        };

        this.renderABCXYZReport();
    }

    /**
     * Отрисовка ABC-XYZ отчёта
     */
    renderABCXYZReport() {
        const container = document.getElementById('reportResults');
        if (!container) return;

        const report = this.currentReport;

        const getCategoryColor = (key) => {
            const colors = {
                'AX': '#10b981', 'AY': '#059669', 'AZ': '#047857',
                'BX': '#3b82f6', 'BY': '#2563eb', 'BZ': '#1d4ed8',
                'CX': '#f59e0b', 'CY': '#d97706', 'CZ': '#b45309'
            };
            return colors[key] || '#666';
        };

        const getCategoryPriority = (key) => {
            const priorities = {
                'AX': 'Высший приоритет: стабильные хиты',
                'AY': 'Высокий: сезонные лидеры',
                'AZ': 'Средний: непредсказуемые лидеры',
                'BX': 'Средний: стабильная база',
                'BY': 'Средний: сезонная база',
                'BZ': 'Низкий: нестабильные',
                'CX': 'Низкий: стабильный хвост',
                'CY': 'Очень низкий: сезонный хвост',
                'CZ': 'Минимальный: случайные'
            };
            return priorities[key] || '';
        };

        container.innerHTML = `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h2 style="margin: 0; color: var(--dandy-green);">📊 ABC-XYZ Анализ</h2>
                    <button class="btn btn-secondary" onclick="reportsModule.exportReport('abc_xyz')">📥 Экспорт</button>
                </div>

                <div class="alert alert-info">
                    <span>ℹ️</span>
                    <div>
                        <strong>ABC:</strong> По выручке (A=80%, B=15%, C=5%)<br>
                        <strong>XYZ:</strong> По стабильности спроса (X=стабильный, Y=сезонный, Z=непредсказуемый)<br>
                        <strong>Период:</strong> ${report.period}
                    </div>
                </div>

                <!-- Матрица 3x3 -->
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem;">
                    ${Object.keys(report.categories).map(key => {
                        const items = report.categories[key];
                        const color = getCategoryColor(key);
                        const priority = getCategoryPriority(key);
                        
                        return `
                            <div style="background: ${color}; padding: 1rem; border-radius: 12px; color: white;">
                                <div style="font-size: 1.2rem; font-weight: bold; margin-bottom: 0.5rem;">${key}</div>
                                <div style="font-size: 0.85em; opacity: 0.9; margin-bottom: 0.75rem;">${priority}</div>
                                <div style="background: rgba(255,255,255,0.15); padding: 0.75rem; border-radius: 8px; font-size: 0.9em;">
                                    <strong>${items.length}</strong> товаров
                                    ${items.length > 0 ? `<br><span style="opacity: 0.8;">${items[0].name}</span>` : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>

                <!-- Легенда -->
                <div class="grid grid-2" style="margin-bottom: 2rem;">
                    <div style="background: #f9f9f9; padding: 1.5rem; border-radius: 12px;">
                        <h3 style="margin: 0 0 1rem 0; color: var(--dandy-green);">📈 ABC (по выручке)</h3>
                        <ul style="list-style: none; padding: 0; margin: 0;">
                            <li style="margin-bottom: 0.5rem;">
                                <span style="display: inline-block; width: 24px; height: 24px; background: #10b981; border-radius: 4px; margin-right: 0.5rem;"></span>
                                <strong>A:</strong> 80% оборота (топ товары)
                            </li>
                            <li style="margin-bottom: 0.5rem;">
                                <span style="display: inline-block; width: 24px; height: 24px; background: #3b82f6; border-radius: 4px; margin-right: 0.5rem;"></span>
                                <strong>B:</strong> 15% оборота (средняя зона)
                            </li>
                            <li>
                                <span style="display: inline-block; width: 24px; height: 24px; background: #f59e0b; border-radius: 4px; margin-right: 0.5rem;"></span>
                                <strong>C:</strong> 5% оборота (хвост)
                            </li>
                        </ul>
                    </div>

                    <div style="background: #f9f9f9; padding: 1.5rem; border-radius: 12px;">
                        <h3 style="margin: 0 0 1rem 0; color: var(--dandy-green);">📉 XYZ (по стабильности)</h3>
                        <ul style="list-style: none; padding: 0; margin: 0;">
                            <li style="margin-bottom: 0.5rem;">
                                <strong>X:</strong> Стабильный спрос (вариация &lt;15%)
                            </li>
                            <li style="margin-bottom: 0.5rem;">
                                <strong>Y:</strong> Сезонный спрос (вариация 15-50%)
                            </li>
                            <li>
                                <strong>Z:</strong> Непредсказуемый (вариация &gt;50%)
                            </li>
                        </ul>
                    </div>
                </div>

                <!-- Детальная таблица -->
                <h3 style="margin-bottom: 1rem;">Детализация по товарам:</h3>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Товар</th>
                            <th style="text-align: right;">Выручка</th>
                            <th style="text-align: center;">ABC</th>
                            <th style="text-align: center;">XYZ</th>
                            <th style="text-align: center;">Категория</th>
                            <th style="text-align: center;">Приоритет</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.keys(report.categories).flatMap(key => 
                            report.categories[key].map(item => {
                                const color = getCategoryColor(key);
                                return `
                                    <tr>
                                        <td><strong>${item.name}</strong></td>
                                        <td style="text-align: right;">₽ ${item.revenue.toLocaleString('ru-RU')}</td>
                                        <td style="text-align: center;">
                                            <span class="badge" style="background: ${getCategoryColor(item.abc + 'X')};">${item.abc}</span>
                                        </td>
                                        <td style="text-align: center;">
                                            <span class="badge">${item.xyz}</span>
                                        </td>
                                        <td style="text-align: center;">
                                            <span class="badge" style="background: ${color};">${key}</span>
                                        </td>
                                        <td style="text-align: center; font-size: 0.85em; color: #666;">
                                            ${getCategoryPriority(key)}
                                        </td>
                                    </tr>
                                `;
                            })
                        ).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    /**
     * Отрисовка графика COGS
     */
    renderCOGSChart(items) {
        setTimeout(() => {
            const canvas = document.getElementById('cogsChart');
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            
            // Уничтожаем предыдущий график, если был
            if (this.cogsChart) {
                this.cogsChart.destroy();
            }

            // Данные для графика
            const labels = items.map(item => item.dishName);
            const revenues = items.map(item => item.revenue);
            const costs = items.map(item => item.costPrice);
            const profits = items.map(item => item.revenue - item.costPrice);

            this.cogsChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Выручка',
                            data: revenues,
                            backgroundColor: 'rgba(34, 197, 94, 0.6)',
                            borderColor: 'rgba(34, 197, 94, 1)',
                            borderWidth: 1
                        },
                        {
                            label: 'Себестоимость',
                            data: costs,
                            backgroundColor: 'rgba(239, 68, 68, 0.6)',
                            borderColor: 'rgba(239, 68, 68, 1)',
                            borderWidth: 1
                        },
                        {
                            label: 'Прибыль',
                            data: profits,
                            backgroundColor: 'rgba(59, 130, 246, 0.6)',
                            borderColor: 'rgba(59, 130, 246, 1)',
                            borderWidth: 1
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                        legend: {
                            labels: {
                                color: '#F3EADB'
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return context.dataset.label + ': ₽ ' + context.parsed.y.toLocaleString('ru-RU');
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            ticks: { color: '#F3EADB' },
                            grid: { color: 'rgba(255,255,255,0.1)' }
                        },
                        y: {
                            ticks: {
                                color: '#F3EADB',
                                callback: function(value) {
                                    return '₽ ' + value.toLocaleString('ru-RU');
                                }
                            },
                            grid: { color: 'rgba(255,255,255,0.1)' }
                        }
                    }
                }
            });
        }, 100);
    }

    /**
     * Генерация отчёта Waste / Потери
     */
    generateWasteReport() {
        console.log('📊 Generating Waste report...');

        // Демо-данные списаний
        const wasteData = [
            { date: '2025-09-28', productName: 'Салат Айсберг', quantity: 2.5, unit: 'кг', reason: 'Брак', cost: 450 },
            { date: '2025-09-27', productName: 'Молоко 3.2%', quantity: 1, unit: 'л', reason: 'Истёк срок', cost: 80 },
            { date: '2025-09-26', productName: 'Томаты свежие', quantity: 3.2, unit: 'кг', reason: 'Порча', cost: 640 },
            { date: '2025-09-25', productName: 'Лосось филе', quantity: 0.5, unit: 'кг', reason: 'Ошибка приготовления', cost: 600 },
            { date: '2025-09-24', productName: 'Сливки 33%', quantity: 0.8, unit: 'л', reason: 'Разлив', cost: 320 },
            { date: '2025-09-23', productName: 'Огурцы свежие', quantity: 1.5, unit: 'кг', reason: 'Порча', cost: 150 },
            { date: '2025-09-22', productName: 'Авокадо', quantity: 5, unit: 'шт', reason: 'Брак', cost: 500 }
        ];

        const totalWaste = wasteData.reduce((sum, item) => sum + item.cost, 0);
        const totalQuantity = wasteData.length;

        // Группировка по причинам
        const byReason = {};
        wasteData.forEach(item => {
            if (!byReason[item.reason]) {
                byReason[item.reason] = { count: 0, cost: 0 };
            }
            byReason[item.reason].count++;
            byReason[item.reason].cost += item.cost;
        });

        this.currentReport = {
            type: 'waste',
            period: `${this.dateRange.from} — ${this.dateRange.to}`,
            totalWaste,
            totalQuantity,
            items: wasteData,
            byReason
        };

        this.renderWasteReport();
    }

    /**
     * Отрисовка отчёта Waste
     */
    renderWasteReport() {
        const container = document.getElementById('reportResults');
        if (!container) return;

        const report = this.currentReport;

        container.innerHTML = `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h2 style="margin: 0; color: #eebc5c;">🗑️ Waste Report / Потери</h2>
                    <button class="btn btn-secondary" onclick="reportsModule.exportReport('waste')">📥 Экспорт</button>
                </div>

                <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                    <span style="color: #fca5a5;">⚠️</span>
                    <div style="color: #F3EADB;">
                        <strong>Период:</strong> ${report.period}
                    </div>
                </div>

                <!-- Метрики -->
                <div class="grid grid-3" style="margin-bottom: 2rem;">
                    <div class="stat-card">
                        <div class="stat-value" style="color: #ef4444;">₽ ${report.totalWaste.toLocaleString('ru-RU')}</div>
                        <div class="stat-label">Общие потери</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${report.totalQuantity}</div>
                        <div class="stat-label">Случаев списания</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">₽ ${Math.round(report.totalWaste / report.totalQuantity).toLocaleString('ru-RU')}</div>
                        <div class="stat-label">Средняя потеря</div>
                    </div>
                </div>

                <!-- По причинам -->
                <h3 style="margin-bottom: 1rem; color: #F3EADB;">По причинам:</h3>
                <div class="grid grid-2" style="margin-bottom: 2rem;">
                    ${Object.keys(report.byReason).map(reason => {
                        const data = report.byReason[reason];
                        const percent = (data.cost / report.totalWaste * 100).toFixed(1);
                        return `
                            <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); padding: 1.5rem; border-radius: 12px;">
                                <h4 style="margin: 0 0 0.75rem 0; color: #eebc5c;">${reason}</h4>
                                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; color: #F3EADB;">
                                    <span>Случаев:</span>
                                    <strong>${data.count}</strong>
                                </div>
                                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; color: #F3EADB;">
                                    <span>Сумма:</span>
                                    <strong>₽ ${data.cost.toLocaleString('ru-RU')}</strong>
                                </div>
                                <div style="margin-top: 0.75rem; background: rgba(239, 68, 68, 0.2); height: 8px; border-radius: 4px; overflow: hidden;">
                                    <div style="width: ${percent}%; height: 100%; background: #ef4444;"></div>
                                </div>
                                <div style="text-align: right; margin-top: 0.25rem; font-size: 0.85em; color: #fca5a5;">${percent}%</div>
                            </div>
                        `;
                    }).join('')}
                </div>

                <!-- Детальная таблица -->
                <h3 style="margin-bottom: 1rem; color: #F3EADB;">Детализация:</h3>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Дата</th>
                            <th>Товар</th>
                            <th style="text-align: right;">Количество</th>
                            <th>Причина</th>
                            <th style="text-align: right;">Стоимость</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${report.items.map(item => `
                            <tr>
                                <td>${new Date(item.date).toLocaleDateString('ru-RU')}</td>
                                <td><strong>${item.productName}</strong></td>
                                <td style="text-align: right;">${item.quantity} ${item.unit}</td>
                                <td>
                                    <span class="badge badge-warning">${item.reason}</span>
                                </td>
                                <td style="text-align: right; color: #ef4444; font-weight: 600;">₽ ${item.cost.toLocaleString('ru-RU')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="background: rgba(255,255,255,0.05); font-weight: 700;">
                            <td colspan="4">ИТОГО:</td>
                            <td style="text-align: right; color: #ef4444;">₽ ${report.totalWaste.toLocaleString('ru-RU')}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    }

    /**
     * Генерация отчёта Оборачиваемость
     */
    generateTurnoverReport() {
        console.log('📊 Generating Turnover report...');

        // Демо-данные оборачиваемости
        const turnoverData = [
            { productName: 'Coca-Cola 0.33л', avgStock: 240, dailySales: 48, turnoverDays: 5, status: 'fast' },
            { productName: 'Тесто для пиццы', avgStock: 50, dailySales: 8, turnoverDays: 6.25, status: 'fast' },
            { productName: 'Сыр Моцарелла', avgStock: 25, dailySales: 3.5, turnoverDays: 7.14, status: 'normal' },
            { productName: 'Томаты свежие', avgStock: 30, dailySales: 4, turnoverDays: 7.5, status: 'normal' },
            { productName: 'Лосось филе', avgStock: 15, dailySales: 1.2, turnoverDays: 12.5, status: 'slow' },
            { productName: 'Авокадо', avgStock: 40, dailySales: 2.5, turnoverDays: 16, status: 'slow' },
            { productName: 'Соус Песто', avgStock: 12, dailySales: 0.5, turnoverDays: 24, status: 'very_slow' }
        ];

        const avgTurnover = turnoverData.reduce((sum, item) => sum + item.turnoverDays, 0) / turnoverData.length;

        this.currentReport = {
            type: 'turnover',
            period: `${this.dateRange.from} — ${this.dateRange.to}`,
            items: turnoverData,
            avgTurnover: avgTurnover.toFixed(1)
        };

        this.renderTurnoverReport();
    }

    /**
     * Отрисовка отчёта Оборачиваемость
     */
    renderTurnoverReport() {
        const container = document.getElementById('reportResults');
        if (!container) return;

        const report = this.currentReport;

        const getStatusColor = (status) => {
            switch(status) {
                case 'fast': return '#10b981';
                case 'normal': return '#3b82f6';
                case 'slow': return '#f59e0b';
                case 'very_slow': return '#ef4444';
                default: return '#666';
            }
        };

        const getStatusText = (status) => {
            switch(status) {
                case 'fast': return 'Быстрая';
                case 'normal': return 'Нормальная';
                case 'slow': return 'Медленная';
                case 'very_slow': return 'Очень медленная';
                default: return 'Неизвестно';
            }
        };

        container.innerHTML = `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h2 style="margin: 0; color: #eebc5c;">📦 Оборачиваемость товаров</h2>
                    <button class="btn btn-secondary" onclick="reportsModule.exportReport('turnover')">📥 Экспорт</button>
                </div>

                <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                    <span style="color: #60a5fa;">ℹ️</span>
                    <div style="color: #F3EADB;">
                        <strong>Период:</strong> ${report.period}<br>
                        <strong>Средняя оборачиваемость:</strong> ${report.avgTurnover} дней
                    </div>
                </div>

                <!-- Легенда -->
                <div class="grid grid-4" style="margin-bottom: 2rem;">
                    <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); padding: 1rem; border-radius: 8px; text-align: center;">
                        <div style="color: #10b981; font-size: 1.5rem; margin-bottom: 0.5rem;">⚡</div>
                        <div style="color: #F3EADB; font-weight: 600;">Быстрая</div>
                        <div style="color: #F3EADB; opacity: 0.7; font-size: 0.85em;">&lt; 7 дней</div>
                    </div>
                    <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); padding: 1rem; border-radius: 8px; text-align: center;">
                        <div style="color: #3b82f6; font-size: 1.5rem; margin-bottom: 0.5rem;">✓</div>
                        <div style="color: #F3EADB; font-weight: 600;">Нормальная</div>
                        <div style="color: #F3EADB; opacity: 0.7; font-size: 0.85em;">7-14 дней</div>
                    </div>
                    <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); padding: 1rem; border-radius: 8px; text-align: center;">
                        <div style="color: #f59e0b; font-size: 1.5rem; margin-bottom: 0.5rem;">⚠️</div>
                        <div style="color: #F3EADB; font-weight: 600;">Медленная</div>
                        <div style="color: #F3EADB; opacity: 0.7; font-size: 0.85em;">14-21 день</div>
                    </div>
                    <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); padding: 1rem; border-radius: 8px; text-align: center;">
                        <div style="color: #ef4444; font-size: 1.5rem; margin-bottom: 0.5rem;">🐌</div>
                        <div style="color: #F3EADB; font-weight: 600;">Очень медленная</div>
                        <div style="color: #F3EADB; opacity: 0.7; font-size: 0.85em;">&gt; 21 дня</div>
                    </div>
                </div>

                <!-- Таблица -->
                <table class="table">
                    <thead>
                        <tr>
                            <th>Товар</th>
                            <th style="text-align: right;">Средний запас</th>
                            <th style="text-align: right;">Продажи/день</th>
                            <th style="text-align: right;">Оборачиваемость (дни)</th>
                            <th style="text-align: center;">Статус</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${report.items.map(item => `
                            <tr>
                                <td><strong>${item.productName}</strong></td>
                                <td style="text-align: right;">${item.avgStock}</td>
                                <td style="text-align: right;">${item.dailySales}</td>
                                <td style="text-align: right; font-weight: 600; color: ${getStatusColor(item.status)};">
                                    ${item.turnoverDays.toFixed(1)}
                                </td>
                                <td style="text-align: center;">
                                    <span class="badge" style="background: ${getStatusColor(item.status)}; color: white;">
                                        ${getStatusText(item.status)}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <!-- Рекомендации -->
                <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); padding: 1.5rem; border-radius: 8px; margin-top: 2rem;">
                    <h3 style="margin: 0 0 1rem 0; color: #eebc5c;">💡 Рекомендации:</h3>
                    <ul style="margin: 0; padding-left: 1.5rem; color: #F3EADB;">
                        <li style="margin-bottom: 0.5rem;">Товары с очень медленной оборачиваемостью рекомендуется заказывать реже и меньшими партиями</li>
                        <li style="margin-bottom: 0.5rem;">Быстрооборачиваемые товары требуют частого контроля остатков</li>
                        <li>Рассмотрите возможность удаления из ассортимента товаров с оборачиваемостью &gt; 30 дней</li>
                    </ul>
                </div>
            </div>
        `;
    }

    /**
     * Генерация отчёта Алко-декларации
     */
    generateAlcoholReport() {
        console.log('📊 Generating Alcohol report...');

        // Демо-данные алкоголя
        const alcoholData = [
            { 
                name: 'Водка "Беленькая" 0.5л', 
                code: '4607116540021', 
                volume: 0.5, 
                strength: 40, 
                startBalance: 120, 
                received: 240, 
                sold: 310, 
                writeOff: 2, 
                endBalance: 48,
                category: 'Крепкий алкоголь'
            },
            { 
                name: 'Вино "Массандра" 0.75л', 
                code: '4607001234567', 
                volume: 0.75, 
                strength: 12, 
                startBalance: 60, 
                received: 96, 
                sold: 108, 
                writeOff: 0, 
                endBalance: 48,
                category: 'Вино'
            },
            { 
                name: 'Пиво "Балтика 3" 0.45л', 
                code: '4607038100012', 
                volume: 0.45, 
                strength: 4.8, 
                startBalance: 480, 
                received: 960, 
                sold: 1224, 
                writeOff: 12, 
                endBalance: 204,
                category: 'Пиво'
            }
        ];

        // Расчёт объёмов в ДАЛ (декалитрах = 10 литров)
        const calculateDAL = (volume, strength, quantity) => {
            return (volume * strength / 100 * quantity) / 10;
        };

        const enrichedData = alcoholData.map(item => ({
            ...item,
            startBalanceDAL: calculateDAL(item.volume, item.strength, item.startBalance),
            receivedDAL: calculateDAL(item.volume, item.strength, item.received),
            soldDAL: calculateDAL(item.volume, item.strength, item.sold),
            writeOffDAL: calculateDAL(item.volume, item.strength, item.writeOff),
            endBalanceDAL: calculateDAL(item.volume, item.strength, item.endBalance)
        }));

        const totalStartDAL = enrichedData.reduce((sum, item) => sum + item.startBalanceDAL, 0);
        const totalReceivedDAL = enrichedData.reduce((sum, item) => sum + item.receivedDAL, 0);
        const totalSoldDAL = enrichedData.reduce((sum, item) => sum + item.soldDAL, 0);
        const totalWriteOffDAL = enrichedData.reduce((sum, item) => sum + item.writeOffDAL, 0);
        const totalEndDAL = enrichedData.reduce((sum, item) => sum + item.endBalanceDAL, 0);

        this.currentReport = {
            type: 'alcohol',
            period: `${this.dateRange.from} — ${this.dateRange.to}`,
            items: enrichedData,
            totalStartDAL,
            totalReceivedDAL,
            totalSoldDAL,
            totalWriteOffDAL,
            totalEndDAL
        };

        this.renderAlcoholReport();
    }

    /**
     * Отрисовка отчёта Алко-декларации
     */
    renderAlcoholReport() {
        const container = document.getElementById('reportResults');
        if (!container) return;

        const report = this.currentReport;

        container.innerHTML = `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h2 style="margin: 0; color: #eebc5c;">🍷 Алко-декларации (Формы 7/8 ФСРАР)</h2>
                    <button class="btn btn-secondary" onclick="reportsModule.exportReport('alcohol')">📥 Экспорт в XML</button>
                </div>

                <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                    <span style="color: #fbbf24;">⚠️</span>
                    <div style="color: #F3EADB;">
                        <strong>Период:</strong> ${report.period}<br>
                        <strong>Важно:</strong> Отчёт формируется в соответствии с требованиями ФСРАР
                    </div>
                </div>

                <!-- Сводные данные в ДАЛ -->
                <h3 style="margin-bottom: 1rem; color: #F3EADB;">Сводные данные (в декалитрах безводного спирта):</h3>
                <div class="grid grid-5" style="margin-bottom: 2rem;">
                    <div class="stat-card">
                        <div class="stat-value">${report.totalStartDAL.toFixed(2)}</div>
                        <div class="stat-label">Остаток на начало (ДАЛ)</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" style="color: #10b981;">${report.totalReceivedDAL.toFixed(2)}</div>
                        <div class="stat-label">Поступило (ДАЛ)</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" style="color: #3b82f6;">${report.totalSoldDAL.toFixed(2)}</div>
                        <div class="stat-label">Продано (ДАЛ)</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" style="color: #ef4444;">${report.totalWriteOffDAL.toFixed(2)}</div>
                        <div class="stat-label">Списано (ДАЛ)</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${report.totalEndDAL.toFixed(2)}</div>
                        <div class="stat-label">Остаток на конец (ДАЛ)</div>
                    </div>
                </div>

                <!-- Детальная таблица -->
                <h3 style="margin-bottom: 1rem; color: #F3EADB;">Детализация по товарам:</h3>
                <table class="table">
                    <thead>
                        <tr>
                            <th>Наименование</th>
                            <th>Штрихкод</th>
                            <th style="text-align: center;">Категория</th>
                            <th style="text-align: right;">Крепость %</th>
                            <th style="text-align: right;">Остаток нач.</th>
                            <th style="text-align: right;">Поступило</th>
                            <th style="text-align: right;">Продано</th>
                            <th style="text-align: right;">Списано</th>
                            <th style="text-align: right;">Остаток кон.</th>
                            <th style="text-align: right;">ДАЛ продано</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${report.items.map(item => `
                            <tr>
                                <td><strong>${item.name}</strong></td>
                                <td><code style="font-size: 0.85em; color: #60a5fa;">${item.code}</code></td>
                                <td style="text-align: center;">
                                    <span class="badge badge-info">${item.category}</span>
                                </td>
                                <td style="text-align: right;">${item.strength}%</td>
                                <td style="text-align: right;">${item.startBalance}</td>
                                <td style="text-align: right; color: #10b981;">${item.received}</td>
                                <td style="text-align: right; color: #3b82f6;">${item.sold}</td>
                                <td style="text-align: right; color: #ef4444;">${item.writeOff}</td>
                                <td style="text-align: right; font-weight: 600;">${item.endBalance}</td>
                                <td style="text-align: right; font-weight: 600; color: #eebc5c;">${item.soldDAL.toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="background: rgba(255,255,255,0.05); font-weight: 700;">
                            <td colspan="9" style="text-align: right;">ИТОГО (ДАЛ):</td>
                            <td style="text-align: right; color: #eebc5c;">${report.totalSoldDAL.toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>

                <!-- Формула и пояснения -->
                <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); padding: 1.5rem; border-radius: 8px; margin-top: 2rem;">
                    <h3 style="margin: 0 0 1rem 0; color: #60a5fa;">📐 Формула расчёта ДАЛ:</h3>
                    <code style="display: block; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px; color: #F3EADB; margin-bottom: 1rem;">
                        ДАЛ = (Объём в литрах × Крепость % ÷ 100 × Количество) ÷ 10
                    </code>
                    <p style="color: #F3EADB; margin: 0;">
                        <strong>Пример:</strong> 100 бутылок водки 0.5л 40% = (0.5 × 40 ÷ 100 × 100) ÷ 10 = 2 ДАЛ
                    </p>
                </div>

                <!-- Информация о формах -->
                <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); padding: 1.5rem; border-radius: 8px; margin-top: 1.5rem;">
                    <h3 style="margin: 0 0 1rem 0; color: #eebc5c;">📋 Информация о формах ФСРАР:</h3>
                    <ul style="margin: 0; padding-left: 1.5rem; color: #F3EADB;">
                        <li style="margin-bottom: 0.5rem;"><strong>Форма 7:</strong> Декларация об объёме розничной продажи алкогольной и спиртосодержащей продукции</li>
                        <li style="margin-bottom: 0.5rem;"><strong>Форма 8:</strong> Справка об объёме поступления и остатков алкогольной продукции</li>
                        <li>Отчёты подаются ежемесячно до 20-го числа следующего месяца</li>
                    </ul>
                </div>
            </div>
        `;
    }

    /**
     * Экспорт отчёта
     */
    exportReport(type) {
        if (!this.currentReport) {
            alert('⚠️ Сначала сгенерируйте отчёт');
            return;
        }

        console.log(`📥 Exporting ${type} report...`);

        // В реальной системе — экспорт в Excel/PDF
        const dataStr = JSON.stringify(this.currentReport, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${type}_report_${new Date().toISOString().split('T')[0]}.json`;
        link.click();

        this.showNotification('✅ Отчёт экспортирован!', 'success');
    }

    /**
     * Показ уведомления
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10001;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            animation: slideIn 0.3s ease-out;
            ${type === 'success' ? 'background: #16a34a;' : ''}
            ${type === 'error' ? 'background: #dc2626;' : ''}
            ${type === 'info' ? 'background: #2563eb;' : ''}
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReportsModule;
}

