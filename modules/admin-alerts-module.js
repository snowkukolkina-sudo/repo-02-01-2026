// ===== Alerts Module - Уведомления =====

class AlertsModule {
    constructor() {
        this.alerts = [];
        this.settings = {
            enabled: true,
            soundEnabled: true,
            emailEnabled: false,
            pushEnabled: true
        };
        this.ready = this.init();
    }

    async init() {
        console.log('🔔 Initializing Alerts Module...');
        await this.loadAlerts();
        await this.loadSettings();
        this.render();
        this.startMonitoring();
    }

    async loadAlerts() {
        try {
            const fallback = this.getDefaultAlerts();
            const data = await this.fetchStateKey('alerts', fallback);
            this.alerts = Array.isArray(data) && data.length ? data : fallback;
            console.log('✅ Уведомления загружены из API:', this.alerts.length);
        } catch (error) {
            console.warn('⚠️ Ошибка загрузки уведомлений, используем fallback:', error);
            this.alerts = this.getDefaultAlerts();
        }
    }

    async saveAlerts() {
        try {
            await this.saveStateKey('alerts', this.alerts);
            console.log('✅ Уведомления сохранены через API:', this.alerts.length);
        } catch (error) {
            console.warn('⚠️ Не удалось сохранить уведомления', error);
            // Показываем пользователю ошибку только если это критично
            if (error.message && !error.message.includes('HTTP 404')) {
                console.error('[Alerts] Критическая ошибка сохранения:', error);
            }
        }
    }

    async loadSettings() {
        try {
            const data = await this.fetchStateKey('alert_settings', this.settings);
            if (data && typeof data === 'object') {
                this.settings = { ...this.settings, ...data };
                console.log('✅ Настройки уведомлений загружены из API');
            }
        } catch (error) {
            console.warn('⚠️ Ошибка загрузки настроек, используем значения по умолчанию:', error);
        }
    }

    async saveSettings() {
        try {
            await this.saveStateKey('alert_settings', this.settings);
            console.log('✅ Настройки уведомлений сохранены через API');
        } catch (error) {
            console.warn('⚠️ Не удалось сохранить настройки уведомлений', error);
            // Показываем пользователю ошибку только если это критично
            if (error.message && !error.message.includes('HTTP 404')) {
                console.error('[Alerts] Критическая ошибка сохранения настроек:', error);
            }
        }
    }

    getDefaultAlerts() {
        return [
            {
                id: 1,
                type: 'warning',
                title: '⚠️ Критические остатки',
                message: 'Лосось < 1.0 кг',
                timestamp: new Date().toISOString(),
                read: false,
                priority: 'high'
            },
            {
                id: 2,
                type: 'info',
                title: '📋 Напоминание',
                message: 'Срок оплаты накладной — завтра',
                timestamp: new Date(Date.now() - 3600000).toISOString(),
                read: false,
                priority: 'medium'
            },
            {
                id: 3,
                type: 'success',
                title: '✅ Заказ выполнен',
                message: 'Заказ #1029 доставлен',
                timestamp: new Date(Date.now() - 7200000).toISOString(),
                read: true,
                priority: 'low'
            }
        ];
    }

    startMonitoring() {
        // Симуляция получения новых уведомлений
        setInterval(() => {
            if (this.settings.enabled && Math.random() < 0.1) {
                this.addRandomAlert();
            }
        }, 30000);
    }

    addRandomAlert() {
        const alerts = [
            { type: 'warning', title: '⚠️ Низкий остаток', message: 'Товар заканчивается' },
            { type: 'info', title: '📦 Новый заказ', message: 'Поступил заказ #' + Math.floor(Math.random() * 1000) },
            { type: 'success', title: '✅ Оплата получена', message: 'Заказ оплачен' }
        ];
        
        const randomAlert = alerts[Math.floor(Math.random() * alerts.length)];
        this.addAlert(randomAlert);
    }

    addAlert(alertData) {
        const newAlert = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            read: false,
            priority: 'medium',
            ...alertData
        };

        this.alerts.unshift(newAlert);
        this.saveAlerts();
        this.render();

        // Звуковое уведомление
        if (this.settings.soundEnabled) {
            this.playNotificationSound();
        }

        // Браузерное уведомление
        if (this.settings.pushEnabled && 'Notification' in window) {
            this.showBrowserNotification(newAlert);
        }
    }

    playNotificationSound() {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
        audio.play().catch(e => console.log('Sound notification failed:', e));
    }

    showBrowserNotification(alert) {
        if (Notification.permission === 'granted') {
            new Notification(alert.title, {
                body: alert.message,
                icon: 'assets/brand/logo.svg'
            });
        }
    }

    markAsRead(id) {
        const alert = this.alerts.find(a => a.id === id);
        if (alert) {
            alert.read = true;
            this.saveAlerts();
            this.render();
        }
    }

    markAllAsRead() {
        this.alerts.forEach(alert => alert.read = true);
        this.saveAlerts();
        this.render();
    }

    deleteAlert(id) {
        this.alerts = this.alerts.filter(a => a.id !== id);
        this.saveAlerts();
        this.render();
    }

    clearAll() {
        if (confirm('Удалить все уведомления?')) {
            this.alerts = [];
            this.saveAlerts();
            this.render();
        }
    }

    render() {
        const container = document.getElementById('alertsContent');
        if (!container) return;

        const unreadCount = this.alerts.filter(a => !a.read).length;

        container.innerHTML = `
            <div class="card">
                <h3 class="card-title">🔔 Уведомления ${unreadCount > 0 ? `(${unreadCount})` : ''}</h3>
                
                <!-- Настройки -->
                <div class="form-row" style="margin-bottom: 2rem;">
                    <div class="form-group">
                        <label class="form-label">
                            <input type="checkbox" ${this.settings.enabled ? 'checked' : ''} 
                                   onchange="alertsModule.updateSetting('enabled', this.checked)">
                            Включить уведомления
                        </label>
                    </div>
                    <div class="form-group">
                        <label class="form-label">
                            <input type="checkbox" ${this.settings.soundEnabled ? 'checked' : ''} 
                                   onchange="alertsModule.updateSetting('soundEnabled', this.checked)">
                            Звуковые уведомления
                        </label>
                    </div>
                    <div class="form-group">
                        <label class="form-label">
                            <input type="checkbox" ${this.settings.pushEnabled ? 'checked' : ''} 
                                   onchange="alertsModule.updateSetting('pushEnabled', this.checked)">
                            Браузерные уведомления
                        </label>
                    </div>
                </div>

                <!-- Действия -->
                <div style="margin-bottom: 2rem;">
                    <button class="btn btn-primary" onclick="alertsModule.markAllAsRead()">✓ Отметить все как прочитанные</button>
                    <button class="btn btn-secondary" onclick="alertsModule.clearAll()">🗑️ Очистить все</button>
                    <button class="btn btn-success" onclick="alertsModule.testNotification()">🔔 Тестовое уведомление</button>
                </div>

                <!-- Список уведомлений -->
                <div style="max-height: 500px; overflow-y: auto;">
                    ${this.alerts.length === 0 ? `
                        <div style="text-align: center; padding: 3rem; color: #666;">
                            <div style="font-size: 4rem; margin-bottom: 1rem;">🔕</div>
                            <p>Нет уведомлений</p>
                        </div>
                    ` : this.alerts.map(alert => this.renderAlertItem(alert)).join('')}
                </div>
            </div>
        `;
    }

    renderAlertItem(alert) {
        const time = new Date(alert.timestamp).toLocaleString('ru-RU');
        const typeColors = {
            danger: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6',
            success: '#10b981'
        };
        const color = typeColors[alert.type] || '#6b7280';

        return `
            <div style="padding: 1rem; margin-bottom: 1rem; background: ${alert.read ? '#f9f9f9' : 'white'}; 
                        border-radius: 8px; border-left: 4px solid ${color}; 
                        opacity: ${alert.read ? '0.7' : '1'}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                            <strong style="color: #333;">${alert.title}</strong>
                            ${!alert.read ? '<span style="background: #ef4444; color: white; padding: 0.2rem 0.5rem; border-radius: 12px; font-size: 0.7rem;">NEW</span>' : ''}
                        </div>
                        <p style="margin: 0.5rem 0; color: #666;">${alert.message}</p>
                        <small style="color: #999;">${time}</small>
                    </div>
                    <div style="display: flex; gap: 0.5rem; margin-left: 1rem;">
                        ${!alert.read ? `
                            <button onclick="alertsModule.markAsRead(${alert.id})" 
                                    style="background: #10b981; color: white; border: none; padding: 0.5rem; border-radius: 4px; cursor: pointer;">
                                ✓
                            </button>
                        ` : ''}
                        <button onclick="alertsModule.deleteAlert(${alert.id})" 
                                style="background: #ef4444; color: white; border: none; padding: 0.5rem; border-radius: 4px; cursor: pointer;">
                            🗑️
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    updateSetting(key, value) {
        this.settings[key] = value;
        this.saveSettings();
        
        if (key === 'pushEnabled' && value) {
            this.requestNotificationPermission();
        }
    }

    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    testNotification() {
        this.addAlert({
            type: 'info',
            title: '🔔 Тестовое уведомление',
            message: 'Это тестовое уведомление для проверки работы системы'
        });
    }

    async fetchStateKey(key, fallback) {
        try {
            const response = await fetch(`/api/admin-state/keys/${encodeURIComponent(key)}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const payload = await response.json();
            if (payload && Object.prototype.hasOwnProperty.call(payload, 'data')) {
                return payload.data;
            }
        } catch (error) {
            console.warn(`[Alerts] Не удалось загрузить ключ ${key}:`, error.message || error);
        }
        return fallback;
    }

    async saveStateKey(key, data) {
        const body = JSON.stringify({ data });
        try {
            const response = await fetch(`/api/admin-state/keys/${encodeURIComponent(key)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.warn(`[Alerts] Не удалось сохранить ключ ${key}:`, error.message || error);
            throw error;
        }
    }
}

// Глобальная функция для инициализации
window.initAlerts = function() {
    if (window.alertsModule) {
        window.alertsModule = null;
    }
    window.alertsModule = new AlertsModule();
};

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AlertsModule;
}





