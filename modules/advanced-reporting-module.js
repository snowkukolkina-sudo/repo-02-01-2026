/**
 * Расширенный модуль отчетности и аналитики
 * Поддержка детальных отчетов по продажам, доставке, агрегаторам
 */

class AdvancedReportingModule {
    constructor() {
        this.reports = new Map();
        this.reportTemplates = new Map();
        this.analytics = new Map();
        this.init();
    }

    init() {
        this.loadReportSettings();
        this.setupDefaultReports();
    }

    // Загрузка настроек отчетов
    loadReportSettings() {
        try {
            const savedSettings = localStorage.getItem('reportSettings');
            if (savedSettings) {
                const data = JSON.parse(savedSettings);
                this.reports = new Map(data.reports || []);
                this.reportTemplates = new Map(data.reportTemplates || []);
            }
        } catch (error) {
            console.error('Ошибка загрузки настроек отчетов:', error);
        }
    }

    // Сохранение настроек отчетов
    saveReportSettings() {
        try {
            const data = {
                reports: Array.from(this.reports.entries()),
                reportTemplates: Array.from(this.reportTemplates.entries())
            };
            localStorage.setItem('reportSettings', JSON.stringify(data));
        } catch (error) {
            console.error('Ошибка сохранения настроек отчетов:', error);
        }
    }

    // Настройка отчетов по умолчанию
    setupDefaultReports() {
        if (this.reportTemplates.size === 0) {
            this.createDefaultReportTemplates();
        }
    }

    // Создание шаблонов отчетов по умолчанию
    createDefaultReportTemplates() {
        const defaultTemplates = [
            {
                id: 'sales_report',
                name: 'Отчет по продажам',
                description: 'Детальный отчет по продажам за период',
                type: 'sales',
                fields: [
                    'date', 'orderId', 'customer', 'items', 'total', 'paymentMethod',
                    'discount', 'tax', 'commission', 'status'
                ],
                filters: ['dateRange', 'paymentMethod', 'status', 'category'],
                groupBy: ['date', 'category', 'paymentMethod'],
                isDefault: true
            },
            {
                id: 'delivery_report',
                name: 'Отчет по доставке',
                description: 'Отчет по заказам на доставку и самовывоз',
                type: 'delivery',
                fields: [
                    'date', 'orderId', 'customer', 'deliveryType', 'address',
                    'deliveryTime', 'deliveryFee', 'status', 'courier'
                ],
                filters: ['dateRange', 'deliveryType', 'status', 'zone'],
                groupBy: ['date', 'deliveryType', 'zone'],
                isDefault: true
            },
            {
                id: 'aggregator_report',
                name: 'Отчет по агрегаторам',
                description: 'Отчет по заказам с агрегаторов доставки',
                type: 'aggregator',
                fields: [
                    'date', 'orderId', 'aggregator', 'customer', 'total',
                    'commission', 'status', 'paymentStatus'
                ],
                filters: ['dateRange', 'aggregator', 'status'],
                groupBy: ['date', 'aggregator'],
                isDefault: true
            },
            {
                id: 'product_report',
                name: 'Отчет по товарам',
                description: 'Отчет по продажам товаров и категорий',
                type: 'product',
                fields: [
                    'date', 'productId', 'productName', 'category', 'quantity',
                    'price', 'total', 'discount', 'profit'
                ],
                filters: ['dateRange', 'category', 'product'],
                groupBy: ['date', 'category', 'product'],
                isDefault: true
            },
            {
                id: 'financial_report',
                name: 'Финансовый отчет',
                description: 'Отчет по выручке, расходам и прибыли',
                type: 'financial',
                fields: [
                    'date', 'revenue', 'expenses', 'profit', 'tax',
                    'commission', 'deliveryFee', 'discounts'
                ],
                filters: ['dateRange', 'paymentMethod'],
                groupBy: ['date', 'paymentMethod'],
                isDefault: true
            },
            {
                id: 'shift_report',
                name: 'Сменный отчет',
                description: 'Отчет по смене кассира',
                type: 'shift',
                fields: [
                    'shiftId', 'cashier', 'startTime', 'endTime', 'orders',
                    'revenue', 'returns', 'cash', 'card'
                ],
                filters: ['dateRange', 'cashier'],
                groupBy: ['cashier', 'date'],
                isDefault: true
            }
        ];

        defaultTemplates.forEach(template => {
            this.reportTemplates.set(template.id, template);
        });

        this.saveReportSettings();
    }

    // Генерация отчета
    async generateReport(templateId, filters = {}, groupBy = null) {
        const template = this.reportTemplates.get(templateId);
        if (!template) {
            return { success: false, error: 'Шаблон отчета не найден' };
        }

        try {
            let data = await this.getDataForReport(template.type, filters);
            
            // Применение фильтров
            data = this.applyFilters(data, filters);
            
            // Группировка данных
            if (groupBy) {
                data = this.groupData(data, groupBy);
            }
            
            // Расчет агрегатов
            const aggregates = this.calculateAggregates(data, template.fields);
            
            const report = {
                id: this.generateReportId(),
                templateId: templateId,
                name: template.name,
                generatedAt: new Date().toISOString(),
                filters: filters,
                groupBy: groupBy,
                data: data,
                aggregates: aggregates,
                summary: this.generateSummary(data, template.type)
            };

            this.reports.set(report.id, report);
            this.saveReportSettings();
            
            return { success: true, report: report };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Получение данных для отчета
    async getDataForReport(reportType, filters) {
        switch (reportType) {
            case 'sales':
                return await this.getSalesData(filters);
            case 'delivery':
                return await this.getDeliveryData(filters);
            case 'aggregator':
                return await this.getAggregatorData(filters);
            case 'product':
                return await this.getProductData(filters);
            case 'financial':
                return await this.getFinancialData(filters);
            case 'shift':
                return await this.getShiftData(filters);
            default:
                return [];
        }
    }

    // Получение данных по продажам
    async getSalesData(filters) {
        try {
            const orders = JSON.parse(localStorage.getItem('orders') || '[]');
            const receipts = JSON.parse(localStorage.getItem('receipts') || '[]');
            
            const salesData = orders.map(order => {
                const receipt = receipts.find(r => r.orderId === order.id);
                return {
                    date: order.createdAt,
                    orderId: order.id,
                    customer: order.customer?.name || 'Гость',
                    items: order.items?.length || 0,
                    total: order.total || 0,
                    paymentMethod: order.paymentMethod || 'cash',
                    discount: order.discount || 0,
                    tax: order.tax || 0,
                    commission: order.commission || 0,
                    status: order.status || 'completed',
                    category: this.getOrderCategory(order)
                };
            });

            return salesData;
        } catch (error) {
            console.error('Ошибка получения данных по продажам:', error);
            return [];
        }
    }

    // Получение данных по доставке
    async getDeliveryData(filters) {
        try {
            const orders = JSON.parse(localStorage.getItem('orders') || '[]');
            
            const deliveryData = orders
                .filter(order => order.delivery)
                .map(order => ({
                    date: order.createdAt,
                    orderId: order.id,
                    customer: order.customer?.name || 'Гость',
                    deliveryType: order.delivery.type || 'delivery',
                    address: order.delivery.address || '',
                    deliveryTime: order.delivery.time || '',
                    deliveryFee: order.deliveryFee || 0,
                    status: order.status || 'pending',
                    courier: order.courier || null,
                    zone: this.getDeliveryZone(order.delivery.address)
                }));

            return deliveryData;
        } catch (error) {
            console.error('Ошибка получения данных по доставке:', error);
            return [];
        }
    }

    // Получение данных по агрегаторам
    async getAggregatorData(filters) {
        try {
            const orders = JSON.parse(localStorage.getItem('orders') || '[]');
            
            const aggregatorData = orders
                .filter(order => order.source === 'aggregator')
                .map(order => ({
                    date: order.createdAt,
                    orderId: order.id,
                    aggregator: order.aggregatorId || 'unknown',
                    customer: order.customer?.name || 'Гость',
                    total: order.total || 0,
                    commission: order.commission || 0,
                    status: order.status || 'pending',
                    paymentStatus: order.paymentStatus || 'pending'
                }));

            return aggregatorData;
        } catch (error) {
            console.error('Ошибка получения данных по агрегаторам:', error);
            return [];
        }
    }

    // Получение данных по товарам
    async getProductData(filters) {
        try {
            const orders = JSON.parse(localStorage.getItem('orders') || '[]');
            
            const productData = [];
            orders.forEach(order => {
                if (order.items) {
                    order.items.forEach(item => {
                        productData.push({
                            date: order.createdAt,
                            productId: item.id,
                            productName: item.name,
                            category: item.category || 'unknown',
                            quantity: item.quantity || 1,
                            price: item.price || 0,
                            total: (item.price || 0) * (item.quantity || 1),
                            discount: item.discount || 0,
                            profit: this.calculateProductProfit(item)
                        });
                    });
                }
            });

            return productData;
        } catch (error) {
            console.error('Ошибка получения данных по товарам:', error);
            return [];
        }
    }

    // Получение финансовых данных
    async getFinancialData(filters) {
        try {
            const orders = JSON.parse(localStorage.getItem('orders') || '[]');
            const receipts = JSON.parse(localStorage.getItem('receipts') || '[]');
            
            const financialData = orders.map(order => {
                const receipt = receipts.find(r => r.orderId === order.id);
                return {
                    date: order.createdAt,
                    revenue: order.total || 0,
                    expenses: this.calculateOrderExpenses(order),
                    profit: this.calculateOrderProfit(order),
                    tax: order.tax || 0,
                    commission: order.commission || 0,
                    deliveryFee: order.deliveryFee || 0,
                    discounts: order.discount || 0,
                    paymentMethod: order.paymentMethod || 'cash'
                };
            });

            return financialData;
        } catch (error) {
            console.error('Ошибка получения финансовых данных:', error);
            return [];
        }
    }

    // Получение данных по сменам
    async getShiftData(filters) {
        try {
            const shifts = JSON.parse(localStorage.getItem('shifts') || '[]');
            const orders = JSON.parse(localStorage.getItem('orders') || '[]');
            
            const shiftData = shifts.map(shift => {
                const shiftOrders = orders.filter(order => 
                    order.createdAt >= shift.startTime && 
                    order.createdAt <= shift.endTime
                );
                
                return {
                    shiftId: shift.id,
                    cashier: shift.cashier,
                    startTime: shift.startTime,
                    endTime: shift.endTime,
                    orders: shiftOrders.length,
                    revenue: shiftOrders.reduce((sum, order) => sum + (order.total || 0), 0),
                    returns: shiftOrders.filter(order => order.status === 'cancelled').length,
                    cash: shiftOrders
                        .filter(order => order.paymentMethod === 'cash')
                        .reduce((sum, order) => sum + (order.total || 0), 0),
                    card: shiftOrders
                        .filter(order => order.paymentMethod === 'card')
                        .reduce((sum, order) => sum + (order.total || 0), 0)
                };
            });

            return shiftData;
        } catch (error) {
            console.error('Ошибка получения данных по сменам:', error);
            return [];
        }
    }

    // Применение фильтров
    applyFilters(data, filters) {
        let filteredData = [...data];

        if (filters.dateRange) {
            const { startDate, endDate } = filters.dateRange;
            filteredData = filteredData.filter(item => {
                const itemDate = new Date(item.date);
                return itemDate >= new Date(startDate) && itemDate <= new Date(endDate);
            });
        }

        if (filters.paymentMethod) {
            filteredData = filteredData.filter(item => item.paymentMethod === filters.paymentMethod);
        }

        if (filters.status) {
            filteredData = filteredData.filter(item => item.status === filters.status);
        }

        if (filters.category) {
            filteredData = filteredData.filter(item => item.category === filters.category);
        }

        if (filters.aggregator) {
            filteredData = filteredData.filter(item => item.aggregator === filters.aggregator);
        }

        return filteredData;
    }

    // Группировка данных
    groupData(data, groupBy) {
        const grouped = {};
        
        data.forEach(item => {
            const key = groupBy.map(field => item[field]).join('_');
            if (!grouped[key]) {
                grouped[key] = [];
            }
            grouped[key].push(item);
        });

        return Object.entries(grouped).map(([key, items]) => ({
            key: key,
            items: items,
            count: items.length,
            total: items.reduce((sum, item) => sum + (item.total || 0), 0)
        }));
    }

    // Расчет агрегатов
    calculateAggregates(data, fields) {
        const aggregates = {};

        if (fields.includes('total')) {
            aggregates.totalRevenue = data.reduce((sum, item) => sum + (item.total || 0), 0);
        }

        if (fields.includes('discount')) {
            aggregates.totalDiscounts = data.reduce((sum, item) => sum + (item.discount || 0), 0);
        }

        if (fields.includes('tax')) {
            aggregates.totalTax = data.reduce((sum, item) => sum + (item.tax || 0), 0);
        }

        if (fields.includes('commission')) {
            aggregates.totalCommission = data.reduce((sum, item) => sum + (item.commission || 0), 0);
        }

        aggregates.totalOrders = data.length;
        aggregates.averageOrderValue = aggregates.totalOrders > 0 ? aggregates.totalRevenue / aggregates.totalOrders : 0;

        return aggregates;
    }

    // Генерация сводки
    generateSummary(data, reportType) {
        const summary = {
            totalRecords: data.length,
            generatedAt: new Date().toISOString(),
            reportType: reportType
        };

        switch (reportType) {
            case 'sales':
                summary.totalRevenue = data.reduce((sum, item) => sum + (item.total || 0), 0);
                summary.averageOrderValue = summary.totalRevenue / summary.totalRecords;
                break;
            case 'delivery':
                summary.deliveryOrders = data.filter(item => item.deliveryType === 'delivery').length;
                summary.pickupOrders = data.filter(item => item.deliveryType === 'pickup').length;
                break;
            case 'aggregator':
                summary.totalCommission = data.reduce((sum, item) => sum + (item.commission || 0), 0);
                break;
            case 'product':
                summary.totalProducts = data.reduce((sum, item) => sum + (item.quantity || 0), 0);
                break;
            case 'financial':
                summary.totalProfit = data.reduce((sum, item) => sum + (item.profit || 0), 0);
                break;
            case 'shift':
                summary.totalShifts = data.length;
                break;
        }

        return summary;
    }

    // Расчет прибыли товара
    calculateProductProfit(item) {
        // Упрощенный расчет прибыли
        const cost = item.cost || (item.price * 0.6); // Предполагаем 40% наценку
        return (item.price - cost) * item.quantity;
    }

    // Расчет расходов заказа
    calculateOrderExpenses(order) {
        return (order.commission || 0) + (order.deliveryFee || 0);
    }

    // Расчет прибыли заказа
    calculateOrderProfit(order) {
        const expenses = this.calculateOrderExpenses(order);
        return (order.total || 0) - expenses;
    }

    // Получение категории заказа
    getOrderCategory(order) {
        if (order.items && order.items.length > 0) {
            return order.items[0].category || 'unknown';
        }
        return 'unknown';
    }

    // Получение зоны доставки
    getDeliveryZone(address) {
        // Упрощенное определение зоны доставки
        if (address.includes('центр') || address.includes('Центр')) return 'center';
        if (address.includes('спальный') || address.includes('Спальный')) return 'residential';
        return 'other';
    }

    // Экспорт отчета
    exportReport(reportId, format = 'json') {
        const report = this.reports.get(reportId);
        if (!report) {
            return { success: false, error: 'Отчет не найден' };
        }

        try {
            let exportData;
            
            switch (format) {
                case 'json':
                    exportData = JSON.stringify(report, null, 2);
                    break;
                case 'csv':
                    exportData = this.convertToCSV(report.data);
                    break;
                case 'excel':
                    // В реальной системе здесь был бы экспорт в Excel
                    exportData = this.convertToCSV(report.data);
                    break;
                default:
                    return { success: false, error: 'Неподдерживаемый формат' };
            }

            return { success: true, data: exportData, format: format };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Конвертация в CSV
    convertToCSV(data) {
        if (!data || data.length === 0) return '';

        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(',')];

        data.forEach(row => {
            const values = headers.map(header => {
                const value = row[header];
                return typeof value === 'string' ? `"${value}"` : value;
            });
            csvRows.push(values.join(','));
        });

        return csvRows.join('\n');
    }

    // Получение всех отчетов
    getAllReports() {
        return Array.from(this.reports.values());
    }

    // Получение шаблонов отчетов
    getAllReportTemplates() {
        return Array.from(this.reportTemplates.values());
    }

    // Удаление отчета
    deleteReport(reportId) {
        const deleted = this.reports.delete(reportId);
        if (deleted) {
            this.saveReportSettings();
        }
        return deleted;
    }

    // Генерация ID отчета
    generateReportId() {
        return `RPT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Получение статистики отчетов
    getReportStats() {
        return {
            totalReports: this.reports.size,
            totalTemplates: this.reportTemplates.size,
            reportsByType: this.getReportsByType(),
            lastGenerated: this.getLastGeneratedReport()
        };
    }

    // Получение статуса модуля (для тестирования)
    getStats() {
        const stats = this.getReportStats();
        return {
            totalReports: stats.totalReports,
            totalTemplates: stats.totalTemplates,
            lastReportDate: stats.lastGenerated ? stats.lastGenerated.generatedAt : 'Нет отчетов',
            isActive: true
        };
    }

    // Генерация аналитики (для тестирования)
    async generateAnalytics(period = 'today') {
        try {
            const filters = this.getFiltersForPeriod(period);
            const salesData = await this.getSalesData(filters);
            
            return {
                period: period,
                revenue: salesData.reduce((sum, item) => sum + (item.total || 0), 0),
                orders: salesData.length,
                averageOrder: salesData.length > 0 ? salesData.reduce((sum, item) => sum + (item.total || 0), 0) / salesData.length : 0
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Получение фильтров для периода
    getFiltersForPeriod(period) {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        switch (period) {
            case 'today':
                return {
                    dateRange: {
                        startDate: startOfDay.toISOString(),
                        endDate: now.toISOString()
                    }
                };
            case 'week':
                const startOfWeek = new Date(startOfDay);
                startOfWeek.setDate(startOfDay.getDate() - 7);
                return {
                    dateRange: {
                        startDate: startOfWeek.toISOString(),
                        endDate: now.toISOString()
                    }
                };
            case 'month':
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                return {
                    dateRange: {
                        startDate: startOfMonth.toISOString(),
                        endDate: now.toISOString()
                    }
                };
            default:
                return {};
        }
    }

    // Получение отчетов по типам
    getReportsByType() {
        const reportsByType = {};
        for (const report of this.reports.values()) {
            const template = this.reportTemplates.get(report.templateId);
            if (template) {
                if (!reportsByType[template.type]) {
                    reportsByType[template.type] = 0;
                }
                reportsByType[template.type]++;
            }
        }
        return reportsByType;
    }

    // Получение последнего сгенерированного отчета
    getLastGeneratedReport() {
        const reports = Array.from(this.reports.values());
        if (reports.length === 0) return null;
        
        return reports.sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt))[0];
    }
}

// Экспорт модуля
window.AdvancedReportingModule = AdvancedReportingModule;
