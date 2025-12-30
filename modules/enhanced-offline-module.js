/**
 * Расширенный модуль офлайн-режима с улучшенной отказоустойчивостью
 * Поддержка локального хранения, синхронизации и восстановления данных
 */

class EnhancedOfflineModule {
    constructor() {
        this.isOnline = navigator.onLine;
        this.syncQueue = [];
        this.localStorage = new Map();
        this.indexedDB = null;
        this.syncInterval = null;
        this.retryAttempts = 3;
        this.maxRetryDelay = 30000; // 30 секунд
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initIndexedDB();
        this.startSyncInterval();
        this.loadLocalData();
    }

    // Настройка обработчиков событий
    setupEventListeners() {
        // Обработка изменения статуса сети
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.onNetworkRestored();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.onNetworkLost();
        });

        // Обработка закрытия страницы
        window.addEventListener('beforeunload', () => {
            this.savePendingData();
        });

        // Обработка восстановления страницы
        window.addEventListener('pageshow', () => {
            this.restoreSession();
        });
    }

    // Инициализация IndexedDB
    async initIndexedDB() {
        try {
            const request = indexedDB.open('DandyOfflineDB', 1);
            
            request.onerror = () => {
                console.error('Ошибка открытия IndexedDB');
            };

            request.onsuccess = () => {
                this.indexedDB = request.result;
                console.log('IndexedDB инициализирован');
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Создание хранилищ
                if (!db.objectStoreNames.contains('orders')) {
                    const ordersStore = db.createObjectStore('orders', { keyPath: 'id' });
                    ordersStore.createIndex('timestamp', 'timestamp', { unique: false });
                    ordersStore.createIndex('status', 'status', { unique: false });
                }

                if (!db.objectStoreNames.contains('payments')) {
                    const paymentsStore = db.createObjectStore('payments', { keyPath: 'id' });
                    paymentsStore.createIndex('orderId', 'orderId', { unique: false });
                    paymentsStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                if (!db.objectStoreNames.contains('receipts')) {
                    const receiptsStore = db.createObjectStore('receipts', { keyPath: 'id' });
                    receiptsStore.createIndex('orderId', 'orderId', { unique: false });
                    receiptsStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                if (!db.objectStoreNames.contains('syncQueue')) {
                    const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
                    syncStore.createIndex('timestamp', 'timestamp', { unique: false });
                    syncStore.createIndex('type', 'type', { unique: false });
                }

                if (!db.objectStoreNames.contains('products')) {
                    const productsStore = db.createObjectStore('products', { keyPath: 'id' });
                    productsStore.createIndex('categoryId', 'categoryId', { unique: false });
                    productsStore.createIndex('isAvailable', 'isAvailable', { unique: false });
                }

                if (!db.objectStoreNames.contains('categories')) {
                    const categoriesStore = db.createObjectStore('categories', { keyPath: 'id' });
                    categoriesStore.createIndex('parentId', 'parentId', { unique: false });
                }
            };
        } catch (error) {
            console.error('Ошибка инициализации IndexedDB:', error);
        }
    }

    // Сохранение данных локально
    async saveLocalData(type, data) {
        try {
            if (this.indexedDB) {
                const transaction = this.indexedDB.transaction([type], 'readwrite');
                const store = transaction.objectStore(type);
                
                if (Array.isArray(data)) {
                    for (const item of data) {
                        await store.put(item);
                    }
                } else {
                    await store.put(data);
                }
                
                console.log(`Данные сохранены локально: ${type}`);
            } else {
                // Fallback на localStorage
                localStorage.setItem(`offline_${type}`, JSON.stringify(data));
            }
        } catch (error) {
            console.error('Ошибка сохранения локальных данных:', error);
        }
    }

    // Загрузка данных из локального хранилища
    async loadLocalData() {
        try {
            if (this.indexedDB) {
                const transaction = this.indexedDB.transaction(['orders', 'payments', 'receipts', 'products', 'categories'], 'readonly');
                
                // Загрузка заказов
                const ordersStore = transaction.objectStore('orders');
                const ordersRequest = ordersStore.getAll();
                ordersRequest.onsuccess = () => {
                    this.localStorage.set('orders', ordersRequest.result);
                };

                // Загрузка платежей
                const paymentsStore = transaction.objectStore('payments');
                const paymentsRequest = paymentsStore.getAll();
                paymentsRequest.onsuccess = () => {
                    this.localStorage.set('payments', paymentsRequest.result);
                };

                // Загрузка чеков
                const receiptsStore = transaction.objectStore('receipts');
                const receiptsRequest = receiptsStore.getAll();
                receiptsRequest.onsuccess = () => {
                    this.localStorage.set('receipts', receiptsRequest.result);
                };

                // Загрузка товаров
                const productsStore = transaction.objectStore('products');
                const productsRequest = productsStore.getAll();
                productsRequest.onsuccess = () => {
                    this.localStorage.set('products', productsRequest.result);
                };

                // Загрузка категорий
                const categoriesStore = transaction.objectStore('categories');
                const categoriesRequest = categoriesStore.getAll();
                categoriesRequest.onsuccess = () => {
                    this.localStorage.set('categories', categoriesRequest.result);
                };
            } else {
                // Fallback на localStorage
                const keys = ['orders', 'payments', 'receipts', 'products', 'categories'];
                for (const key of keys) {
                    const data = localStorage.getItem(`offline_${key}`);
                    if (data) {
                        this.localStorage.set(key, JSON.parse(data));
                    }
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки локальных данных:', error);
        }
    }

    // Добавление в очередь синхронизации
    async addToSyncQueue(type, data, operation = 'create') {
        const syncItem = {
            id: this.generateSyncId(),
            type: type,
            operation: operation,
            data: data,
            timestamp: new Date().toISOString(),
            retryCount: 0,
            lastRetry: null
        };

        try {
            if (this.indexedDB) {
                const transaction = this.indexedDB.transaction(['syncQueue'], 'readwrite');
                const store = transaction.objectStore('syncQueue');
                await store.put(syncItem);
            } else {
                this.syncQueue.push(syncItem);
                localStorage.setItem('syncQueue', JSON.stringify(this.syncQueue));
            }

            console.log('Добавлено в очередь синхронизации:', syncItem);
        } catch (error) {
            console.error('Ошибка добавления в очередь синхронизации:', error);
        }
    }

    // Синхронизация данных
    async syncData() {
        if (!this.isOnline) {
            console.log('Синхронизация отложена: нет подключения к интернету');
            return;
        }

        try {
            const syncItems = await this.getSyncQueue();
            
            for (const item of syncItems) {
                try {
                    const result = await this.processSyncItem(item);
                    
                    if (result.success) {
                        await this.removeFromSyncQueue(item.id);
                        console.log('Синхронизация успешна:', item.type);
                    } else {
                        await this.updateSyncItemRetry(item);
                    }
                } catch (error) {
                    console.error('Ошибка синхронизации элемента:', error);
                    await this.updateSyncItemRetry(item);
                }
            }
        } catch (error) {
            console.error('Ошибка синхронизации:', error);
        }
    }

    // Получение очереди синхронизации
    async getSyncQueue() {
        try {
            if (this.indexedDB) {
                const transaction = this.indexedDB.transaction(['syncQueue'], 'readonly');
                const store = transaction.objectStore('syncQueue');
                const request = store.getAll();
                
                return new Promise((resolve, reject) => {
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            } else {
                return this.syncQueue;
            }
        } catch (error) {
            console.error('Ошибка получения очереди синхронизации:', error);
            return [];
        }
    }

    // Обработка элемента синхронизации
    async processSyncItem(item) {
        try {
            switch (item.type) {
                case 'order':
                    return await this.syncOrder(item);
                case 'payment':
                    return await this.syncPayment(item);
                case 'receipt':
                    return await this.syncReceipt(item);
                case 'product':
                    return await this.syncProduct(item);
                case 'category':
                    return await this.syncCategory(item);
                default:
                    return { success: false, error: 'Неизвестный тип данных' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Синхронизация заказа
    async syncOrder(item) {
        try {
            const response = await fetch('/api/orders', {
                method: item.operation === 'create' ? 'POST' : 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item.data)
            });

            return response.ok ? { success: true } : { success: false, error: response.statusText };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Синхронизация платежа
    async syncPayment(item) {
        try {
            const response = await fetch('/api/payments', {
                method: item.operation === 'create' ? 'POST' : 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item.data)
            });

            return response.ok ? { success: true } : { success: false, error: response.statusText };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Синхронизация чека
    async syncReceipt(item) {
        try {
            const response = await fetch('/api/receipts', {
                method: item.operation === 'create' ? 'POST' : 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item.data)
            });

            return response.ok ? { success: true } : { success: false, error: response.statusText };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Синхронизация товара
    async syncProduct(item) {
        try {
            const response = await fetch('/api/products', {
                method: item.operation === 'create' ? 'POST' : 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item.data)
            });

            return response.ok ? { success: true } : { success: false, error: response.statusText };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Синхронизация категории
    async syncCategory(item) {
        try {
            const response = await fetch('/api/categories', {
                method: item.operation === 'create' ? 'POST' : 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item.data)
            });

            return response.ok ? { success: true } : { success: false, error: response.statusText };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Удаление из очереди синхронизации
    async removeFromSyncQueue(id) {
        try {
            if (this.indexedDB) {
                const transaction = this.indexedDB.transaction(['syncQueue'], 'readwrite');
                const store = transaction.objectStore('syncQueue');
                await store.delete(id);
            } else {
                this.syncQueue = this.syncQueue.filter(item => item.id !== id);
                localStorage.setItem('syncQueue', JSON.stringify(this.syncQueue));
            }
        } catch (error) {
            console.error('Ошибка удаления из очереди синхронизации:', error);
        }
    }

    // Обновление попытки синхронизации
    async updateSyncItemRetry(item) {
        item.retryCount++;
        item.lastRetry = new Date().toISOString();

        if (item.retryCount >= this.retryAttempts) {
            console.error('Превышено количество попыток синхронизации:', item);
            await this.removeFromSyncQueue(item.id);
        } else {
            try {
                if (this.indexedDB) {
                    const transaction = this.indexedDB.transaction(['syncQueue'], 'readwrite');
                    const store = transaction.objectStore('syncQueue');
                    await store.put(item);
                } else {
                    const index = this.syncQueue.findIndex(syncItem => syncItem.id === item.id);
                    if (index !== -1) {
                        this.syncQueue[index] = item;
                        localStorage.setItem('syncQueue', JSON.stringify(this.syncQueue));
                    }
                }
            } catch (error) {
                console.error('Ошибка обновления попытки синхронизации:', error);
            }
        }
    }

    // Запуск интервала синхронизации
    startSyncInterval() {
        this.syncInterval = setInterval(() => {
            this.syncData();
        }, 30000); // Синхронизация каждые 30 секунд
    }

    // Остановка интервала синхронизации
    stopSyncInterval() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    // Обработка восстановления сети
    async onNetworkRestored() {
        console.log('Сеть восстановлена, начинаем синхронизацию');
        await this.syncData();
        this.showNotification('Сеть восстановлена', 'Синхронизация данных завершена', 'success');
    }

    // Обработка потери сети
    onNetworkLost() {
        console.log('Сеть потеряна, переходим в офлайн-режим');
        this.showNotification('Офлайн-режим', 'Работаем без подключения к интернету', 'warning');
    }

    // Сохранение отложенных данных
    savePendingData() {
        try {
            const pendingData = {
                orders: this.localStorage.get('orders') || [],
                payments: this.localStorage.get('payments') || [],
                receipts: this.localStorage.get('receipts') || [],
                syncQueue: this.syncQueue
            };

            localStorage.setItem('pendingData', JSON.stringify(pendingData));
        } catch (error) {
            console.error('Ошибка сохранения отложенных данных:', error);
        }
    }

    // Восстановление сессии
    restoreSession() {
        try {
            const pendingData = localStorage.getItem('pendingData');
            if (pendingData) {
                const data = JSON.parse(pendingData);
                
                if (data.orders) this.localStorage.set('orders', data.orders);
                if (data.payments) this.localStorage.set('payments', data.payments);
                if (data.receipts) this.localStorage.set('receipts', data.receipts);
                if (data.syncQueue) this.syncQueue = data.syncQueue;
                
                localStorage.removeItem('pendingData');
                console.log('Сессия восстановлена');
            }
        } catch (error) {
            console.error('Ошибка восстановления сессии:', error);
        }
    }

    // Получение локальных данных
    getLocalData(type) {
        return this.localStorage.get(type) || [];
    }

    // Добавление локальных данных
    addLocalData(type, data) {
        const existingData = this.getLocalData(type);
        existingData.push(data);
        this.localStorage.set(type, existingData);
        this.saveLocalData(type, existingData);
    }

    // Обновление локальных данных
    updateLocalData(type, id, data) {
        const existingData = this.getLocalData(type);
        const index = existingData.findIndex(item => item.id === id);
        
        if (index !== -1) {
            existingData[index] = { ...existingData[index], ...data };
            this.localStorage.set(type, existingData);
            this.saveLocalData(type, existingData);
        }
    }

    // Удаление локальных данных
    removeLocalData(type, id) {
        const existingData = this.getLocalData(type);
        const filteredData = existingData.filter(item => item.id !== id);
        this.localStorage.set(type, filteredData);
        this.saveLocalData(type, filteredData);
    }

    // Показ уведомления
    showNotification(title, message, type = 'info') {
        // Создание уведомления
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        `;

        // Добавление в DOM
        document.body.appendChild(notification);

        // Удаление через 5 секунд
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    // Генерация ID для синхронизации
    generateSyncId() {
        return `SYNC_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Получение статуса офлайн-режима
    getStatus() {
        return {
            isOnline: this.isOnline,
            syncQueueLength: this.syncQueue.length,
            localDataCount: {
                orders: this.getLocalData('orders').length,
                payments: this.getLocalData('payments').length,
                receipts: this.getLocalData('receipts').length,
                products: this.getLocalData('products').length,
                categories: this.getLocalData('categories').length
            }
        };
    }

    // Очистка локальных данных
    async clearLocalData() {
        try {
            if (this.indexedDB) {
                const transaction = this.indexedDB.transaction(['orders', 'payments', 'receipts', 'products', 'categories', 'syncQueue'], 'readwrite');
                
                const stores = ['orders', 'payments', 'receipts', 'products', 'categories', 'syncQueue'];
                for (const storeName of stores) {
                    const store = transaction.objectStore(storeName);
                    await store.clear();
                }
            } else {
                const keys = ['orders', 'payments', 'receipts', 'products', 'categories', 'syncQueue'];
                for (const key of keys) {
                    localStorage.removeItem(`offline_${key}`);
                }
            }

            this.localStorage.clear();
            this.syncQueue = [];
            console.log('Локальные данные очищены');
        } catch (error) {
            console.error('Ошибка очистки локальных данных:', error);
        }
    }
}

// Экспорт модуля
window.EnhancedOfflineModule = EnhancedOfflineModule;
