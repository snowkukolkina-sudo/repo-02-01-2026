/**
 * Модуль мульти-принтеров кухни
 * Поддержка множественных принтеров для разных станций приготовления
 */

class KitchenPrintersModule {
    constructor() {
        this.printersConfig = null;
        this.printers = new Map();
        this.stations = new Map();
        this.printQueue = [];
        this.isConnected = false;
        this.lastSync = null;
        this.init();
    }

    init() {
        this.loadPrintersConfig();
        this.setupStations();
        this.setupEventListeners();
        this.testConnections();
        this.startPrintQueueProcessor();
    }

    // Загрузка конфигурации принтеров
    loadPrintersConfig() {
        const config = JSON.parse(localStorage.getItem('kitchenPrintersConfig') || '{}');
        this.printersConfig = {
            // Основные настройки
            enabled: config.enabled !== false,
            autoPrint: config.autoPrint !== false,
            printTimeout: config.printTimeout || 10000,
            retryAttempts: config.retryAttempts || 3,
            
            // Настройки принтеров
            printers: config.printers || [],
            
            // Настройки станций
            stations: config.stations || [],
            
            // Настройки шаблонов
            templates: config.templates || {},
            
            // Настройки уведомлений
            notifications: config.notifications !== false,
            
            ...config
        };
    }

    // Сохранение конфигурации
    savePrintersConfig() {
        localStorage.setItem('kitchenPrintersConfig', JSON.stringify(this.printersConfig));
    }

    // Настройка станций
    setupStations() {
        // Станции по умолчанию
        const defaultStations = [
            {
                id: 'hot',
                name: 'Горячая кухня',
                description: 'Пицца, горячие блюда',
                printers: ['hot-printer'],
                categories: ['pizza25', 'pizza33', 'pizza42', 'combo'],
                priority: 1
            },
            {
                id: 'cold',
                name: 'Холодная кухня',
                description: 'Роллы, салаты, холодные закуски',
                printers: ['cold-printer'],
                categories: ['rollsStd', 'rollsG', 'salads'],
                priority: 2
            },
            {
                id: 'bar',
                name: 'Бар',
                description: 'Напитки, алкоголь',
                printers: ['bar-printer'],
                categories: ['beer', 'beerDraft'],
                priority: 3
            }
        ];

        // Объединяем с пользовательскими настройками
        const stations = [...defaultStations, ...this.printersConfig.stations];
        
        this.stations.clear();
        stations.forEach(station => {
            this.stations.set(station.id, station);
        });
    }

    // Настройка обработчиков событий
    setupEventListeners() {
        // Обработка событий от POS
        document.addEventListener('pos:orderCreated', (event) => {
            this.processOrder(event.detail);
        });

        document.addEventListener('pos:orderUpdated', (event) => {
            this.processOrderUpdate(event.detail);
        });

        document.addEventListener('pos:orderCancelled', (event) => {
            this.processOrderCancellation(event.detail);
        });

        // Обработка событий принтеров
        document.addEventListener('printer:statusChanged', (event) => {
            this.handlePrinterStatusChange(event.detail);
        });

        document.addEventListener('printer:error', (event) => {
            this.handlePrinterError(event.detail);
        });
    }

    // Тестирование подключений
    async testConnections() {
        if (!this.printersConfig.enabled) return;

        for (const printerConfig of this.printersConfig.printers) {
            try {
                const printer = new KitchenPrinter(printerConfig);
                const isConnected = await printer.testConnection();
                
                this.printers.set(printerConfig.id, printer);
                
                if (isConnected) {
                    console.log(`Принтер ${printerConfig.name} подключен`);
                } else {
                    console.warn(`Принтер ${printerConfig.name} недоступен`);
                }
            } catch (error) {
                console.error(`Ошибка подключения принтера ${printerConfig.name}:`, error);
            }
        }
    }

    // Обработка заказа
    async processOrder(orderData) {
        if (!this.printersConfig.enabled || !this.printersConfig.autoPrint) return;

        try {
            // Группируем товары по станциям
            const stationOrders = this.groupOrderByStations(orderData);
            
            // Добавляем в очередь печати
            for (const [stationId, stationOrder] of stationOrders) {
                await this.addToPrintQueue(stationId, stationOrder);
            }
            
            console.log('Заказ добавлен в очередь печати');
            
        } catch (error) {
            console.error('Ошибка обработки заказа:', error);
        }
    }

    // Группировка заказа по станциям
    groupOrderByStations(orderData) {
        const stationOrders = new Map();
        
        orderData.items.forEach(item => {
            const station = this.getStationForItem(item);
            if (station) {
                if (!stationOrders.has(station.id)) {
                    stationOrders.set(station.id, {
                        stationId: station.id,
                        stationName: station.name,
                        orderId: orderData.id,
                        orderNumber: orderData.number,
                        timestamp: orderData.timestamp,
                        items: [],
                        total: 0
                    });
                }
                
                const stationOrder = stationOrders.get(station.id);
                stationOrder.items.push(item);
                stationOrder.total += item.sum;
            }
        });
        
        return stationOrders;
    }

    // Получение станции для товара
    getStationForItem(item) {
        for (const station of this.stations.values()) {
            if (station.categories.includes(item.categoryId)) {
                return station;
            }
        }
        return null;
    }

    // Добавление в очередь печати
    async addToPrintQueue(stationId, orderData) {
        const printJob = {
            id: this.generatePrintJobId(),
            stationId,
            orderData,
            status: 'pending',
            createdAt: new Date(),
            attempts: 0,
            priority: this.stations.get(stationId)?.priority || 1
        };
        
        this.printQueue.push(printJob);
        
        // Сортируем по приоритету
        this.printQueue.sort((a, b) => a.priority - b.priority);
        
        console.log(`Задание печати добавлено в очередь: ${printJob.id}`);
    }

    // Обработчик очереди печати
    startPrintQueueProcessor() {
        setInterval(async () => {
            if (this.printQueue.length > 0) {
                await this.processPrintQueue();
            }
        }, 1000); // каждую секунду
    }

    // Обработка очереди печати
    async processPrintQueue() {
        const pendingJobs = this.printQueue.filter(job => job.status === 'pending');
        
        for (const job of pendingJobs) {
            try {
                await this.printOrder(job);
                job.status = 'completed';
                console.log(`Задание печати выполнено: ${job.id}`);
            } catch (error) {
                job.attempts++;
                if (job.attempts >= this.printersConfig.retryAttempts) {
                    job.status = 'failed';
                    console.error(`Задание печати провалено: ${job.id}`, error);
                } else {
                    console.warn(`Повторная попытка печати: ${job.id}`, error);
                }
            }
        }
        
        // Удаляем завершенные задания
        this.printQueue = this.printQueue.filter(job => job.status === 'pending');
    }

    // Печать заказа
    async printOrder(printJob) {
        const station = this.stations.get(printJob.stationId);
        if (!station) {
            throw new Error(`Станция ${printJob.stationId} не найдена`);
        }
        
        // Получаем принтер для станции
        const printer = this.getPrinterForStation(station);
        if (!printer) {
            throw new Error(`Принтер для станции ${station.name} не найден`);
        }
        
        // Генерируем содержимое для печати
        const printContent = this.generatePrintContent(printJob.orderData, station);
        
        // Отправляем на печать
        await printer.print(printContent);
        
        // Отправляем событие
        document.dispatchEvent(new CustomEvent('kitchen:orderPrinted', {
            detail: { printJob, station, printer: printer.config }
        }));
    }

    // Получение принтера для станции
    getPrinterForStation(station) {
        for (const printerId of station.printers) {
            const printer = this.printers.get(printerId);
            if (printer && printer.isConnected) {
                return printer;
            }
        }
        return null;
    }

    // Генерация содержимого для печати
    generatePrintContent(orderData, station) {
        const template = this.printersConfig.templates[station.id] || this.getDefaultTemplate();
        
        let content = template.header
            .replace('{stationName}', station.name)
            .replace('{orderNumber}', orderData.orderNumber)
            .replace('{timestamp}', new Date(orderData.timestamp).toLocaleString())
            .replace('{total}', orderData.total.toFixed(2));
        
        content += '\n' + '='.repeat(40) + '\n';
        
        orderData.items.forEach(item => {
            content += template.item
                .replace('{itemName}', item.name)
                .replace('{quantity}', item.quantity)
                .replace('{price}', item.price.toFixed(2))
                .replace('{sum}', item.sum.toFixed(2));
        });
        
        content += '\n' + '='.repeat(40) + '\n';
        content += template.footer;
        
        return content;
    }

    // Получение шаблона по умолчанию
    getDefaultTemplate() {
        return {
            header: `
DANDY PIZZA
{stationName}
Заказ №{orderNumber}
{timestamp}
Сумма: {total}₽
`,
            item: `
{quantity}x {itemName}
  {price}₽ x {quantity} = {sum}₽
`,
            footer: `
Спасибо за заказ!
Время приготовления: 15-25 мин
`
        };
    }

    // Обработка обновления заказа
    async processOrderUpdate(orderData) {
        // Находим существующие задания печати
        const existingJobs = this.printQueue.filter(job => 
            job.orderData.orderId === orderData.id
        );
        
        // Отменяем старые задания
        existingJobs.forEach(job => {
            job.status = 'cancelled';
        });
        
        // Добавляем новое задание
        await this.processOrder(orderData);
    }

    // Обработка отмены заказа
    async processOrderCancellation(orderData) {
        // Находим задания печати для отмены
        const jobsToCancel = this.printQueue.filter(job => 
            job.orderData.orderId === orderData.id
        );
        
        jobsToCancel.forEach(job => {
            job.status = 'cancelled';
        });
        
        // Отправляем уведомление об отмене
        const stationOrders = this.groupOrderByStations(orderData);
        for (const [stationId, stationOrder] of stationOrders) {
            const station = this.stations.get(stationId);
            const printer = this.getPrinterForStation(station);
            
            if (printer) {
                const cancelContent = `
ОТМЕНА ЗАКАЗА
Заказ №${orderData.number} ОТМЕНЕН
Время: ${new Date().toLocaleString()}
`;
                await printer.print(cancelContent);
            }
        }
    }

    // Обработка изменения статуса принтера
    handlePrinterStatusChange(printerData) {
        const printer = this.printers.get(printerData.id);
        if (printer) {
            printer.updateStatus(printerData.status);
            console.log(`Статус принтера ${printerData.name} изменен: ${printerData.status}`);
        }
    }

    // Обработка ошибки принтера
    handlePrinterError(errorData) {
        console.error(`Ошибка принтера ${errorData.printerName}:`, errorData.error);
        
        // Отправляем уведомление
        if (this.printersConfig.notifications) {
            document.dispatchEvent(new CustomEvent('notification:show', {
                detail: {
                    type: 'error',
                    title: 'Ошибка принтера',
                    message: `Принтер ${errorData.printerName}: ${errorData.error.message}`
                }
            }));
        }
    }

    // Генерация ID задания печати
    generatePrintJobId() {
        return 'print_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Настройка модуля
    configure(settings) {
        this.printersConfig = { ...this.printersConfig, ...settings };
        this.savePrintersConfig();
        this.setupStations();
        this.testConnections();
    }

    // Получение статуса модуля
    getStatus() {
        const connectedPrinters = Array.from(this.printers.values()).filter(p => p.isConnected).length;
        const totalPrinters = this.printers.size;
        const pendingJobs = this.printQueue.filter(job => job.status === 'pending').length;
        
        return {
            enabled: this.printersConfig.enabled,
            isConnected: connectedPrinters > 0,
            connectedPrinters,
            totalPrinters,
            pendingJobs,
            stationsCount: this.stations.size,
            lastSync: this.lastSync
        };
    }

    // Получение списка принтеров
    getPrinters() {
        return Array.from(this.printers.values()).map(printer => ({
            id: printer.config.id,
            name: printer.config.name,
            type: printer.config.type,
            station: printer.config.station,
            isConnected: printer.isConnected,
            status: printer.status
        }));
    }

    // Получение списка станций
    getStations() {
        return Array.from(this.stations.values());
    }

    // Получение очереди печати
    getPrintQueue() {
        return this.printQueue;
    }
}

// Класс принтера кухни
class KitchenPrinter {
    constructor(config) {
        this.config = config;
        this.isConnected = false;
        this.status = 'disconnected';
        this.lastPrint = null;
        this.errorCount = 0;
    }

    // Тестирование подключения
    async testConnection() {
        try {
            // Симуляция подключения к принтеру
            await new Promise(resolve => setTimeout(resolve, 100));
            
            this.isConnected = true;
            this.status = 'ready';
            this.errorCount = 0;
            
            return true;
        } catch (error) {
            this.isConnected = false;
            this.status = 'error';
            this.errorCount++;
            throw error;
        }
    }

    // Печать
    async print(content) {
        if (!this.isConnected) {
            throw new Error('Принтер не подключен');
        }
        
        try {
            this.status = 'printing';
            
            // Симуляция печати
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            this.status = 'ready';
            this.lastPrint = new Date();
            
            console.log(`Принтер ${this.config.name} напечатал:`, content);
            
        } catch (error) {
            this.status = 'error';
            this.errorCount++;
            throw error;
        }
    }

    // Обновление статуса
    updateStatus(status) {
        this.status = status;
        this.isConnected = status === 'ready' || status === 'printing';
    }
}

// Экспорт модуля
window.KitchenPrintersModule = KitchenPrintersModule;
window.KitchenPrinter = KitchenPrinter;
