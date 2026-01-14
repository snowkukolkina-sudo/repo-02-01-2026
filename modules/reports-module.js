/**
 * Модуль отчетности
 * Z/X отчеты, аналитические отчеты, экспорт данных
 */

class ReportsModule {
    constructor() {
        this.reports = [];
        this.shiftData = {
            isOpen: false,
            startTime: null,
            endTime: null,
            cashier: null,
            receipts: [],
            payments: [],
            refunds: [],
            totalSales: 0,
            totalRefunds: 0,
            totalCash: 0,
            totalCard: 0,
            totalOnline: 0
        };
        this.init();
    }

    init() {
        this.loadShiftData();
        this.setupEventListeners();
    }

    // Открытие смены
    async openShift(cashierId) {
        if (this.shiftData.isOpen) {
            return { success: false, error: 'Смена уже открыта' };
        }

        this.shiftData = {
            isOpen: true,
            startTime: new Date().toISOString(),
            endTime: null,
            cashier: cashierId,
            receipts: [],
            payments: [],
            refunds: [],
            totalSales: 0,
            totalRefunds: 0,
            totalCash: 0,
            totalCard: 0,
            totalOnline: 0
        };

        this.saveShiftData();
        this.logShiftEvent('shift_opened', { cashierId: cashierId });

        return { success: true, shiftData: this.shiftData };
    }

    // Закрытие смены
    async closeShift() {
        if (!this.shiftData.isOpen) {
            return { success: false, error: 'Смена не открыта' };
        }

        this.shiftData.endTime = new Date().toISOString();
        this.shiftData.isOpen = false;

        // Создание Z-отчета
        const zReport = await this.generateZReport();
        
        this.saveShiftData();
        this.logShiftEvent('shift_closed', { 
            cashierId: this.shiftData.cashier,
            duration: this.getShiftDuration(),
            totalSales: this.shiftData.totalSales
        });

        return { success: true, zReport: zReport };
    }

    // Генерация Z-отчета
    async generateZReport() {
        const zReport = {
            id: this.generateReportId(),
            type: 'Z_REPORT',
            shiftId: this.shiftData.cashier + '_' + this.shiftData.startTime,
            startTime: this.shiftData.startTime,
            endTime: this.shiftData.endTime,
            cashier: this.shiftData.cashier,
            receipts: this.shiftData.receipts.length,
            totalSales: this.shiftData.totalSales,
            totalRefunds: this.shiftData.totalRefunds,
            totalCash: this.shiftData.totalCash,
            totalCard: this.shiftData.totalCard,
            totalOnline: this.shiftData.totalOnline,
            netSales: this.shiftData.totalSales - this.shiftData.totalRefunds,
            createdAt: new Date().toISOString()
        };

        this.reports.push(zReport);
        this.saveReports();

        return zReport;
    }

    // Генерация X-отчета
    async generateXReport() {
        const xReport = {
            id: this.generateReportId(),
            type: 'X_REPORT',
            shiftId: this.shiftData.cashier + '_' + this.shiftData.startTime,
            startTime: this.shiftData.startTime,
            endTime: new Date().toISOString(),
            cashier: this.shiftData.cashier,
            receipts: this.shiftData.receipts.length,
            totalSales: this.shiftData.totalSales,
            totalRefunds: this.shiftData.totalRefunds,
            totalCash: this.shiftData.totalCash,
            totalCard: this.shiftData.totalCard,
            totalOnline: this.shiftData.totalOnline,
            netSales: this.shiftData.totalSales - this.shiftData.totalRefunds,
            createdAt: new Date().toISOString()
        };

        this.reports.push(xReport);
        this.saveReports();

        return xReport;
    }

    // Добавление чека в смену
    addReceiptToShift(receiptData) {
        if (!this.shiftData.isOpen) {
            return { success: false, error: 'Смена не открыта' };
        }

        this.shiftData.receipts.push(receiptData);
        this.shiftData.totalSales += receiptData.total;

        // Обновление сумм по способам оплаты
        receiptData.payments.forEach(payment => {
            switch (payment.method) {
                case 'cash':
                    this.shiftData.totalCash += payment.amount;
                    break;
                case 'card':
                    this.shiftData.totalCard += payment.amount;
                    break;
                case 'online':
                    this.shiftData.totalOnline += payment.amount;
                    break;
            }
        });

        this.saveShiftData();
        return { success: true };
    }

    // Добавление возврата в смену
    addRefundToShift(refundData) {
        if (!this.shiftData.isOpen) {
            return { success: false, error: 'Смена не открыта' };
        }

        this.shiftData.refunds.push(refundData);
        this.shiftData.totalRefunds += refundData.amount;

        this.saveShiftData();
        return { success: true };
    }

    // Аналитический отчет по продажам
    async generateSalesReport(filters = {}) {
        const report = {
            id: this.generateReportId(),
            type: 'SALES_ANALYTICS',
            period: {
                start: filters.startDate || this.getStartOfDay(),
                end: filters.endDate || new Date().toISOString()
            },
            totalSales: 0,
            totalReceipts: 0,
            averageReceipt: 0,
            salesByCategory: {},
            salesByPaymentMethod: {},
            salesByHour: {},
            topProducts: [],
            createdAt: new Date().toISOString()
        };

        // Анализ данных за период
        const receipts = this.getReceiptsInPeriod(report.period.start, report.period.end);
        
        report.totalReceipts = receipts.length;
        report.totalSales = receipts.reduce((sum, receipt) => sum + receipt.total, 0);
        report.averageReceipt = report.totalReceipts > 0 ? report.totalSales / report.totalReceipts : 0;

        // Анализ по категориям
        report.salesByCategory = this.analyzeSalesByCategory(receipts);
        
        // Анализ по способам оплаты
        report.salesByPaymentMethod = this.analyzeSalesByPaymentMethod(receipts);
        
        // Анализ по часам
        report.salesByHour = this.analyzeSalesByHour(receipts);
        
        // Топ товаров
        report.topProducts = this.getTopProducts(receipts);

        this.reports.push(report);
        this.saveReports();

        return report;
    }

    // Анализ продаж по категориям
    analyzeSalesByCategory(receipts) {
        const categorySales = {};
        
        receipts.forEach(receipt => {
            receipt.items.forEach(item => {
                const category = item.category || 'Другое';
                if (!categorySales[category]) {
                    categorySales[category] = { count: 0, amount: 0 };
                }
                categorySales[category].count += item.quantity;
                categorySales[category].amount += item.sum;
            });
        });

        return categorySales;
    }

    // Анализ продаж по способам оплаты
    analyzeSalesByPaymentMethod(receipts) {
        const paymentSales = { cash: 0, card: 0, online: 0 };
        
        receipts.forEach(receipt => {
            receipt.payments.forEach(payment => {
                if (paymentSales[payment.method] !== undefined) {
                    paymentSales[payment.method] += payment.amount;
                }
            });
        });

        return paymentSales;
    }

    // Анализ продаж по часам
    analyzeSalesByHour(receipts) {
        const hourlySales = {};
        
        receipts.forEach(receipt => {
            const hour = new Date(receipt.timestamp).getHours();
            if (!hourlySales[hour]) {
                hourlySales[hour] = { count: 0, amount: 0 };
            }
            hourlySales[hour].count += 1;
            hourlySales[hour].amount += receipt.total;
        });

        return hourlySales;
    }

    // Получение топ товаров
    getTopProducts(receipts) {
        const productSales = {};
        
        receipts.forEach(receipt => {
            receipt.items.forEach(item => {
                if (!productSales[item.name]) {
                    productSales[item.name] = { count: 0, amount: 0 };
                }
                productSales[item.name].count += item.quantity;
                productSales[item.name].amount += item.sum;
            });
        });

        return Object.entries(productSales)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 10);
    }

    // Отчет по доставке
    async generateDeliveryReport(filters = {}) {
        const report = {
            id: this.generateReportId(),
            type: 'DELIVERY_ANALYTICS',
            period: {
                start: filters.startDate || this.getStartOfDay(),
                end: filters.endDate || new Date().toISOString()
            },
            totalOrders: 0,
            deliveryOrders: 0,
            pickupOrders: 0,
            totalDeliveryRevenue: 0,
            averageDeliveryTime: 0,
            ordersByStatus: {},
            ordersByZone: {},
            createdAt: new Date().toISOString()
        };

        // Получение заказов за период
        const orders = this.getOrdersInPeriod(report.period.start, report.period.end);
        
        report.totalOrders = orders.length;
        report.deliveryOrders = orders.filter(o => o.type === 'delivery').length;
        report.pickupOrders = orders.filter(o => o.type === 'pickup').length;
        
        // Анализ по статусам
        report.ordersByStatus = this.analyzeOrdersByStatus(orders);
        
        // Анализ по зонам доставки
        report.ordersByZone = this.analyzeOrdersByZone(orders);

        this.reports.push(report);
        this.saveReports();

        return report;
    }

    // Анализ заказов по статусам
    analyzeOrdersByStatus(orders) {
        const statusCounts = {};
        
        orders.forEach(order => {
            if (!statusCounts[order.status]) {
                statusCounts[order.status] = 0;
            }
            statusCounts[order.status]++;
        });

        return statusCounts;
    }

    // Анализ заказов по зонам
    analyzeOrdersByZone(orders) {
        const zoneCounts = {};
        
        orders.filter(o => o.type === 'delivery').forEach(order => {
            const zone = order.delivery.zone?.name || 'Неизвестная зона';
            if (!zoneCounts[zone]) {
                zoneCounts[zone] = { count: 0, revenue: 0 };
            }
            zoneCounts[zone].count++;
            zoneCounts[zone].revenue += order.total;
        });

        return zoneCounts;
    }

    // Экспорт отчета в CSV
    exportReportToCSV(reportId) {
        const report = this.reports.find(r => r.id === reportId);
        if (!report) {
            return { success: false, error: 'Отчет не найден' };
        }

        let csvData = '';
        
        switch (report.type) {
            case 'Z_REPORT':
            case 'X_REPORT':
                csvData = this.convertShiftReportToCSV(report);
                break;
            case 'SALES_ANALYTICS':
                csvData = this.convertSalesReportToCSV(report);
                break;
            case 'DELIVERY_ANALYTICS':
                csvData = this.convertDeliveryReportToCSV(report);
                break;
            default:
                return { success: false, error: 'Неподдерживаемый тип отчета' };
        }

        // Создание и скачивание файла
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${report.type}_${report.id}.csv`;
        link.click();

        return { success: true };
    }

    // Конвертация сменного отчета в CSV
    convertShiftReportToCSV(report) {
        const headers = ['Тип отчета', 'ID смены', 'Кассир', 'Начало смены', 'Конец смены', 'Чеков', 'Продажи', 'Возвраты', 'Наличные', 'Карта', 'Онлайн'];
        const row = [
            report.type,
            report.shiftId,
            report.cashier,
            report.startTime,
            report.endTime,
            report.receipts,
            report.totalSales,
            report.totalRefunds,
            report.totalCash,
            report.totalCard,
            report.totalOnline
        ];

        return [headers, row].map(row => 
            row.map(field => `"${field}"`).join(',')
        ).join('\n');
    }

    // Конвертация аналитического отчета в CSV
    convertSalesReportToCSV(report) {
        const headers = ['Период', 'Всего продаж', 'Количество чеков', 'Средний чек'];
        const data = [
            `${report.period.start} - ${report.period.end}`,
            report.totalSales,
            report.totalReceipts,
            report.averageReceipt
        ];

        return [headers, data].map(row => 
            row.map(field => `"${field}"`).join(',')
        ).join('\n');
    }

    // Конвертация отчета по доставке в CSV
    convertDeliveryReportToCSV(report) {
        const headers = ['Период', 'Всего заказов', 'Доставка', 'Самовывоз'];
        const data = [
            `${report.period.start} - ${report.period.end}`,
            report.totalOrders,
            report.deliveryOrders,
            report.pickupOrders
        ];

        return [headers, data].map(row => 
            row.map(field => `"${field}"`).join(',')
        ).join('\n');
    }

    // Получение чеков за период
    getReceiptsInPeriod(startDate, endDate) {
        // В реальной системе здесь будет запрос к базе данных
        return this.shiftData.receipts.filter(receipt => 
            receipt.timestamp >= startDate && receipt.timestamp <= endDate
        );
    }

    // Получение заказов за период
    getOrdersInPeriod(startDate, endDate) {
        // В реальной системе здесь будет запрос к базе данных
        const orders = JSON.parse(localStorage.getItem('deliveryOrders') || '[]');
        return orders.filter(order => 
            order.createdAt >= startDate && order.createdAt <= endDate
        );
    }

    // Получение начала дня
    getStartOfDay() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today.toISOString();
    }

    // Получение продолжительности смены
    getShiftDuration() {
        if (!this.shiftData.startTime) return 0;
        
        const start = new Date(this.shiftData.startTime);
        const end = new Date(this.shiftData.endTime || new Date());
        return end.getTime() - start.getTime();
    }

    // Генерация ID отчета
    generateReportId() {
        return `RPT_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }

    // Логирование событий смены
    logShiftEvent(event, data) {
        const logEntry = {
            event: event,
            data: data,
            timestamp: new Date().toISOString()
        };
        
        console.log('Событие смены:', logEntry);
    }

    // Сохранение данных смены
    saveShiftData() {
        localStorage.setItem('shiftData', JSON.stringify(this.shiftData));
    }

    // Загрузка данных смены
    loadShiftData() {
        const saved = localStorage.getItem('shiftData');
        if (saved) {
            this.shiftData = JSON.parse(saved);
        }
    }

    // Сохранение отчетов
    saveReports() {
        localStorage.setItem('reports', JSON.stringify(this.reports));
    }

    // Загрузка отчетов
    loadReports() {
        const saved = localStorage.getItem('reports');
        if (saved) {
            this.reports = JSON.parse(saved);
        }
    }

    // Настройка обработчиков событий
    setupEventListeners() {
        // Обработка событий от других модулей
        document.addEventListener('receiptCreated', (event) => {
            this.addReceiptToShift(event.detail);
        });

        document.addEventListener('refundCreated', (event) => {
            this.addRefundToShift(event.detail);
        });
    }
}

// Экспорт модуля
window.ReportsModule = ReportsModule;
