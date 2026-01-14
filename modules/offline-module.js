/**
 * Модуль офлайн-режима и синхронизации
 * Работа без интернета, локальное хранение, синхронизация с сервером
 */

class OfflineModule {
    constructor() {
        this.isOnline = navigator.onLine;
        this.syncQueue = [];
        this.localStorage = new Map();
        this.syncInterval = null;
        this.init();
    }

    init() {
        this.loadSyncQueue();
        this.setupEventListeners();
        this.startSyncInterval();
    }

    // Настройка обработчиков событий
    setupEventListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.onNetworkOnline();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.onNetworkOffline();
        });

        // Обработка закрытия страницы
        window.addEventListener('beforeunload', () => {
            this.saveSyncQueue();
        });
    }

    // Обработка восстановления сети
    async onNetworkOnline() {
        console.log('Сеть восстановлена, начинаем синхронизацию...');
        
        // Показываем уведомление
        this.showNotification('Сеть восстановлена', 'Начинаем синхронизацию данных...', 'success');
        
        // Запускаем синхронизацию
        await this.syncAll();
        
        // Обновляем статус в интерфейсе
        this.updateOnlineStatus(true);
    }

    // Обработка потери сети
    onNetworkOffline() {
        console.log('Сеть потеряна, переходим в офлайн-режим...');
        
        // Показываем уведомление
        this.showNotification('Нет сети', 'Работаем в офлайн-режиме', 'warning');
        
        // Обновляем статус в интерфейсе
        this.updateOnlineStatus(false);
    }

    // Обновление статуса сети в интерфейсе
    updateOnlineStatus(isOnline) {
        const statusElement = document.getElementById('network-status');
        if (statusElement) {
            statusElement.textContent = isOnline ? 'Онлайн' : 'Офлайн';
            statusElement.className = isOnline ? 'status-online' : 'status-offline';
        }

        // Обновляем иконку в заголовке
        const iconElement = document.getElementById('network-icon');
        if (iconElement) {
            iconElement.textContent = isOnline ? '🟢' : '🔴';
        }
    }

    // Добавление операции в очередь синхронизации
    addToSyncQueue(operation) {
        const syncItem = {
            id: this.generateSyncId(),
            operation: operation.type,
            data: operation.data,
            timestamp: new Date().toISOString(),
            retryCount: 0,
            maxRetries: 3
        };

        this.syncQueue.push(syncItem);
        this.saveSyncQueue();

        console.log('Добавлено в очередь синхронизации:', syncItem);
    }

    // Синхронизация всех операций
    async syncAll() {
        if (!this.isOnline || this.syncQueue.length === 0) {
            return;
        }

        console.log(`Синхронизация ${this.syncQueue.length} операций...`);

        const successful = [];
        const failed = [];

        for (const item of this.syncQueue) {
            try {
                const result = await this.syncItem(item);
                if (result.success) {
                    successful.push(item);
                } else {
                    failed.push(item);
                }
            } catch (error) {
                console.error('Ошибка синхронизации:', error);
                failed.push(item);
            }
        }

        // Удаляем успешно синхронизированные операции
        this.syncQueue = failed;
        this.saveSyncQueue();

        if (successful.length > 0) {
            this.showNotification(
                'Синхронизация завершена', 
                `Синхронизировано ${successful.length} операций`, 
                'success'
            );
        }

        if (failed.length > 0) {
            this.showNotification(
                'Ошибки синхронизации', 
                `Не удалось синхронизировать ${failed.length} операций`, 
                'error'
            );
        }
    }

    // Синхронизация отдельной операции
    async syncItem(item) {
        try {
            switch (item.operation) {
                case 'receipt':
                    return await this.syncReceipt(item.data);
                case 'order':
                    return await this.syncOrder(item.data);
                case 'payment':
                    return await this.syncPayment(item.data);
                case 'refund':
                    return await this.syncRefund(item.data);
                case 'user_action':
                    return await this.syncUserAction(item.data);
                default:
                    return { success: false, error: 'Неизвестная операция' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Синхронизация чека
    async syncReceipt(receiptData) {
        // Симуляция отправки чека на сервер
        const response = await this.sendToServer('/api/receipts', {
            method: 'POST',
            body: JSON.stringify(receiptData)
        });

        return response;
    }

    // Синхронизация заказа
    async syncOrder(orderData) {
        const response = await this.sendToServer('/api/orders', {
            method: 'POST',
            body: JSON.stringify(orderData)
        });

        return response;
    }

    // Синхронизация платежа
    async syncPayment(paymentData) {
        const response = await this.sendToServer('/api/payments', {
            method: 'POST',
            body: JSON.stringify(paymentData)
        });

        return response;
    }

    // Синхронизация возврата
    async syncRefund(refundData) {
        const response = await this.sendToServer('/api/refunds', {
            method: 'POST',
            body: JSON.stringify(refundData)
        });

        return response;
    }

    // Синхронизация действий пользователя
    async syncUserAction(actionData) {
        const response = await this.sendToServer('/api/user-actions', {
            method: 'POST',
            body: JSON.stringify(actionData)
        });

        return response;
    }

    // Отправка данных на сервер
    async sendToServer(url, options) {
        // Симуляция отправки на сервер
        return new Promise((resolve) => {
            setTimeout(() => {
                // Симуляция успешного ответа
                resolve({ success: true, data: { id: Date.now() } });
            }, 1000);
        });
    }

    // Локальное хранение данных
    storeLocally(key, data) {
        this.localStorage.set(key, {
            data: data,
            timestamp: new Date().toISOString(),
            synced: false
        });

        // Сохранение в IndexedDB или localStorage
        this.saveToStorage(key, data);
    }

    // Получение данных из локального хранилища
    getLocally(key) {
        const item = this.localStorage.get(key);
        return item ? item.data : null;
    }

    // Сохранение в IndexedDB
    async saveToStorage(key, data) {
        try {
            if ('indexedDB' in window) {
                const db = await this.openIndexedDB();
                const transaction = db.transaction(['offlineData'], 'readwrite');
                const store = transaction.objectStore('offlineData');
                await store.put({ key: key, data: data, timestamp: new Date().toISOString() });
            } else {
                // Fallback на localStorage
                localStorage.setItem(`offline_${key}`, JSON.stringify(data));
            }
        } catch (error) {
            console.error('Ошибка сохранения в локальное хранилище:', error);
        }
    }

    // Открытие IndexedDB
    async openIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('DandyPOSOffline', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('offlineData')) {
                    db.createObjectStore('offlineData', { keyPath: 'key' });
                }
            };
        });
    }

    // Загрузка очереди синхронизации
    loadSyncQueue() {
        const saved = localStorage.getItem('syncQueue');
        if (saved) {
            this.syncQueue = JSON.parse(saved);
        }
    }

    // Сохранение очереди синхронизации
    saveSyncQueue() {
        localStorage.setItem('syncQueue', JSON.stringify(this.syncQueue));
    }

    // Запуск интервала синхронизации
    startSyncInterval() {
        // Синхронизация каждые 30 секунд
        this.syncInterval = setInterval(() => {
            if (this.isOnline && this.syncQueue.length > 0) {
                this.syncAll();
            }
        }, 30000);
    }

    // Остановка интервала синхронизации
    stopSyncInterval() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    // Проверка статуса синхронизации
    getSyncStatus() {
        return {
            isOnline: this.isOnline,
            queueLength: this.syncQueue.length,
            lastSync: this.getLastSyncTime()
        };
    }

    // Получение времени последней синхронизации
    getLastSyncTime() {
        const lastSync = localStorage.getItem('lastSync');
        return lastSync ? new Date(lastSync) : null;
    }

    // Обновление времени последней синхронизации
    updateLastSyncTime() {
        localStorage.setItem('lastSync', new Date().toISOString());
    }

    // Показ уведомлений
    showNotification(title, message, type = 'info') {
        // Создание элемента уведомления
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        `;

        // Добавление в DOM
        document.body.appendChild(notification);

        // Автоматическое удаление через 5 секунд
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    // Генерация ID для синхронизации
    generateSyncId() {
        return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }

    // Очистка локальных данных
    clearLocalData() {
        this.localStorage.clear();
        this.syncQueue = [];
        this.saveSyncQueue();
        
        // Очистка IndexedDB
        if ('indexedDB' in window) {
            indexedDB.deleteDatabase('DandyPOSOffline');
        }
        
        // Очистка localStorage
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('offline_')) {
                localStorage.removeItem(key);
            }
        });
    }

    // Получение статистики офлайн-режима
    getOfflineStats() {
        return {
            isOnline: this.isOnline,
            syncQueueLength: this.syncQueue.length,
            localDataSize: this.localStorage.size,
            lastSync: this.getLastSyncTime(),
            uptime: this.getUptime()
        };
    }

    // Получение времени работы
    getUptime() {
        const startTime = localStorage.getItem('sessionStart');
        if (startTime) {
            return Date.now() - new Date(startTime).getTime();
        }
        return 0;
    }

    // Запуск сессии
    startSession() {
        localStorage.setItem('sessionStart', new Date().toISOString());
    }

    // Завершение сессии
    endSession() {
        localStorage.removeItem('sessionStart');
    }
}

// Экспорт модуля
window.OfflineModule = OfflineModule;
