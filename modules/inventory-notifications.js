/**
 * DANDY Inventory System - Notifications Module
 * Push-уведомления о критических событиях
 */

class NotificationsModule {
    constructor(system) {
        this.system = system;
        this.notifications = this.loadNotifications();
        this.settings = this.loadSettings();
        this.checkInterval = null;
    }

    loadNotifications() {
        const saved = localStorage.getItem('dandy_notifications');
        return saved ? JSON.parse(saved) : [];
    }

    saveNotifications() {
        localStorage.setItem('dandy_notifications', JSON.stringify(this.notifications));
    }

    loadSettings() {
        const saved = localStorage.getItem('dandy_notification_settings');
        return saved ? JSON.parse(saved) : {
            enabled: true,
            criticalStock: true,
            expiringProducts: true,
            inventoryReminders: true,
            syncErrors: true,
            checkInterval: 30000, // 30 секунд
            expiryDaysWarning: 7 // предупреждать за 7 дней до истечения
        };
    }

    saveSettings() {
        localStorage.setItem('dandy_notification_settings', JSON.stringify(this.settings));
    }

    init() {
        console.log('🔔 Initializing Notifications Module...');
        
        // Запрашиваем разрешение на уведомления
        this.requestPermission();
        
        // Запускаем периодическую проверку
        this.startMonitoring();
        
        // Отображаем уведомления в UI
        this.renderNotificationsPanel();
    }

    requestPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    console.log('✅ Notification permission granted');
                    this.showNotification('🔔 Уведомления включены', 'Вы будете получать важные оповещения');
                }
            });
        }
    }

    startMonitoring() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }

        // Первоначальная проверка
        this.checkCriticalStock();
        this.checkExpiringProducts();
        
        // Периодическая проверка
        this.checkInterval = setInterval(() => {
            if (this.settings.enabled) {
                if (this.settings.criticalStock) this.checkCriticalStock();
                if (this.settings.expiringProducts) this.checkExpiringProducts();
                if (this.settings.inventoryReminders) this.checkInventoryReminders();
            }
        }, this.settings.checkInterval);

        console.log('✅ Monitoring started with interval:', this.settings.checkInterval);
    }

    stopMonitoring() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    checkCriticalStock() {
        const criticalProducts = this.system.products.filter(p => {
            const stock = p.stock || 0;
            const minStock = p.minStock || 0;
            return stock <= minStock && stock > 0;
        });

        const outOfStock = this.system.products.filter(p => (p.stock || 0) === 0);

        if (criticalProducts.length > 0) {
            this.addNotification({
                type: 'warning',
                title: '⚠️ Критические остатки',
                message: `${criticalProducts.length} товаров достигли минимального остатка`,
                data: criticalProducts,
                action: 'view_critical_stock'
            });
        }

        if (outOfStock.length > 0) {
            this.addNotification({
                type: 'danger',
                title: '🚨 Товары закончились',
                message: `${outOfStock.length} товаров отсутствуют на складе`,
                data: outOfStock,
                action: 'view_out_of_stock'
            });
        }
    }

    checkExpiringProducts() {
        const now = new Date();
        const warningDate = new Date();
        warningDate.setDate(warningDate.getDate() + this.settings.expiryDaysWarning);

        const expiringProducts = this.system.products.filter(p => {
            if (!p.expiryDate) return false;
            const expiryDate = new Date(p.expiryDate);
            return expiryDate <= warningDate && expiryDate > now;
        });

        const expiredProducts = this.system.products.filter(p => {
            if (!p.expiryDate) return false;
            const expiryDate = new Date(p.expiryDate);
            return expiryDate <= now;
        });

        if (expiringProducts.length > 0) {
            this.addNotification({
                type: 'warning',
                title: '📅 Истекает срок годности',
                message: `${expiringProducts.length} товаров истекают в ближайшие ${this.settings.expiryDaysWarning} дней`,
                data: expiringProducts,
                action: 'view_expiring'
            });
        }

        if (expiredProducts.length > 0) {
            this.addNotification({
                type: 'danger',
                title: '🚫 Просроченные товары',
                message: `${expiredProducts.length} товаров с истёкшим сроком годности`,
                data: expiredProducts,
                action: 'view_expired'
            });
        }
    }

    checkInventoryReminders() {
        // Проверяем, когда была последняя инвентаризация
        const lastInventory = localStorage.getItem('dandy_last_inventory');
        if (!lastInventory) return;

        const lastDate = new Date(lastInventory);
        const now = new Date();
        const daysSinceInventory = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));

        // Напоминаем каждые 30 дней
        if (daysSinceInventory >= 30) {
            this.addNotification({
                type: 'info',
                title: '📋 Напоминание об инвентаризации',
                message: `Прошло ${daysSinceInventory} дней с последней инвентаризации`,
                action: 'start_inventory'
            });
        }
    }

    addNotification(notification) {
        const id = Date.now();
        const newNotification = {
            id,
            timestamp: new Date().toISOString(),
            read: false,
            ...notification
        };

        // Проверяем дубликаты (за последний час)
        const hourAgo = Date.now() - 60 * 60 * 1000;
        const duplicate = this.notifications.find(n => 
            n.title === notification.title && 
            new Date(n.timestamp).getTime() > hourAgo
        );

        if (duplicate) {
            console.log('⏭️ Skipping duplicate notification:', notification.title);
            return;
        }

        this.notifications.unshift(newNotification);
        
        // Ограничиваем количество уведомлений
        if (this.notifications.length > 50) {
            this.notifications = this.notifications.slice(0, 50);
        }

        this.saveNotifications();
        
        // Показываем браузерное уведомление
        this.showNotification(notification.title, notification.message);
        
        // Обновляем UI
        this.renderNotificationsPanel();
        this.updateBadge();

        console.log('🔔 New notification:', notification.title);
    }

    showNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification(title, {
                body,
                icon: 'favicon.ico',
                badge: 'favicon.ico',
                tag: 'dandy-inventory',
                requireInteraction: false
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
            };

            // Автоматически закрываем через 5 секунд
            setTimeout(() => notification.close(), 5000);
        }
    }

    markAsRead(id) {
        const notification = this.notifications.find(n => n.id === id);
        if (notification) {
            notification.read = true;
            this.saveNotifications();
            this.renderNotificationsPanel();
            this.updateBadge();
        }
    }

    markAllAsRead() {
        this.notifications.forEach(n => n.read = true);
        this.saveNotifications();
        this.renderNotificationsPanel();
        this.updateBadge();
    }

    deleteNotification(id) {
        this.notifications = this.notifications.filter(n => n.id !== id);
        this.saveNotifications();
        this.renderNotificationsPanel();
        this.updateBadge();
    }

    clearAll() {
        if (confirm('Удалить все уведомления?')) {
            this.notifications = [];
            this.saveNotifications();
            this.renderNotificationsPanel();
            this.updateBadge();
        }
    }

    updateBadge() {
        const unreadCount = this.notifications.filter(n => !n.read).length;
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            badge.textContent = unreadCount;
            badge.style.display = unreadCount > 0 ? 'flex' : 'none';
        }
    }

    renderNotificationsPanel() {
        const panel = document.getElementById('notificationsPanel');
        if (!panel) return;

        const unread = this.notifications.filter(n => !n.read);
        const read = this.notifications.filter(n => n.read);

        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--chip-border);">
                <h3 style="margin: 0; color: var(--text-light);">🔔 Уведомления (${unread.length})</h3>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn-secondary" onclick="notificationsModule.markAllAsRead()" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">
                        ✓ Отметить все
                    </button>
                    <button class="btn-secondary" onclick="notificationsModule.clearAll()" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">
                        🗑️ Очистить
                    </button>
                    <button class="btn-secondary" onclick="notificationsModule.toggleSettings()" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">
                        ⚙️
                    </button>
                </div>
            </div>

            <div id="notificationSettings" style="display: none; margin-bottom: 1rem; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid var(--chip-border);">
                <h4 style="margin-top: 0; color: var(--text-light);">⚙️ Настройки уведомлений</h4>
                <label style="display: flex; align-items: center; margin-bottom: 0.5rem; color: var(--text-light);">
                    <input type="checkbox" ${this.settings.enabled ? 'checked' : ''} onchange="notificationsModule.updateSetting('enabled', this.checked)" style="margin-right: 0.5rem;">
                    Включить уведомления
                </label>
                <label style="display: flex; align-items: center; margin-bottom: 0.5rem; color: var(--text-light);">
                    <input type="checkbox" ${this.settings.criticalStock ? 'checked' : ''} onchange="notificationsModule.updateSetting('criticalStock', this.checked)" style="margin-right: 0.5rem;">
                    Критические остатки
                </label>
                <label style="display: flex; align-items: center; margin-bottom: 0.5rem; color: var(--text-light);">
                    <input type="checkbox" ${this.settings.expiringProducts ? 'checked' : ''} onchange="notificationsModule.updateSetting('expiringProducts', this.checked)" style="margin-right: 0.5rem;">
                    Истекающие сроки годности
                </label>
                <label style="display: flex; align-items: center; margin-bottom: 0.5rem; color: var(--text-light);">
                    <input type="checkbox" ${this.settings.inventoryReminders ? 'checked' : ''} onchange="notificationsModule.updateSetting('inventoryReminders', this.checked)" style="margin-right: 0.5rem;">
                    Напоминания об инвентаризации
                </label>
                <label style="display: block; margin-top: 1rem; color: var(--text-light);">
                    Предупреждать за (дней до истечения):
                    <input type="number" value="${this.settings.expiryDaysWarning}" onchange="notificationsModule.updateSetting('expiryDaysWarning', parseInt(this.value))" 
                        style="width: 60px; margin-left: 0.5rem; padding: 0.3rem; background: rgba(255,255,255,0.05); color: var(--text-light); border: 1px solid var(--chip-border); border-radius: 4px;">
                </label>
            </div>

            <div style="max-height: 500px; overflow-y: auto;">
                ${unread.length === 0 && read.length === 0 ? `
                    <div style="text-align: center; padding: 2rem; color: var(--text-light); opacity: 0.7;">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">🔕</div>
                        <p>Нет уведомлений</p>
                    </div>
                ` : ''}

                ${unread.length > 0 ? `
                    <h4 style="color: var(--text-light); margin-bottom: 0.5rem;">Непрочитанные</h4>
                ` : ''}
                ${unread.map(n => this.renderNotificationItem(n)).join('')}

                ${read.length > 0 ? `
                    <h4 style="color: var(--text-light); margin-top: 1rem; margin-bottom: 0.5rem; opacity: 0.7;">Прочитанные</h4>
                ` : ''}
                ${read.slice(0, 10).map(n => this.renderNotificationItem(n)).join('')}
            </div>
        `;

        this.updateBadge();
    }

    renderNotificationItem(n) {
        const time = new Date(n.timestamp).toLocaleString('ru-RU');
        const typeColors = {
            danger: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6',
            success: '#10b981'
        };
        const color = typeColors[n.type] || '#6b7280';

        return `
            <div style="padding: 1rem; margin-bottom: 0.5rem; background: ${n.read ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.08)'}; border-radius: 8px; border-left: 3px solid ${color}; opacity: ${n.read ? '0.6' : '1'};">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                    <strong style="color: var(--text-light);">${n.title}</strong>
                    <div style="display: flex; gap: 0.5rem;">
                        ${!n.read ? `<button onclick="notificationsModule.markAsRead(${n.id})" style="background: none; border: none; cursor: pointer; color: var(--text-light); opacity: 0.7;">✓</button>` : ''}
                        <button onclick="notificationsModule.deleteNotification(${n.id})" style="background: none; border: none; cursor: pointer; color: var(--text-light); opacity: 0.7;">🗑️</button>
                    </div>
                </div>
                <p style="margin: 0.5rem 0; color: var(--text-light); opacity: 0.9;">${n.message}</p>
                <small style="color: var(--text-light); opacity: 0.6;">${time}</small>
            </div>
        `;
    }

    toggleSettings() {
        const settings = document.getElementById('notificationSettings');
        if (settings) {
            settings.style.display = settings.style.display === 'none' ? 'block' : 'none';
        }
    }

    updateSetting(key, value) {
        this.settings[key] = value;
        this.saveSettings();
        
        if (key === 'enabled') {
            if (value) {
                this.startMonitoring();
            } else {
                this.stopMonitoring();
            }
        }
        
        console.log('⚙️ Setting updated:', key, value);
    }
}

// Глобальная функция для доступа из HTML
if (typeof window !== 'undefined') {
    window.NotificationsModule = NotificationsModule;
}

