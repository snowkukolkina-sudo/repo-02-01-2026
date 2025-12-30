// ===== KDS (Kitchen Display System) Module =====
// Реальная система отображения заказов для кухни с автообновлением

class KDSModule {
    constructor() {
        this.orders = [];
        this.stations = {
            hot: { name: 'Горячий цех', orders: [] },
            cold: { name: 'Холодный цех', orders: [] },
            bar: { name: 'Бар', orders: [] },
            all: { name: 'Все заказы', orders: [] }
        };
        this.currentStation = 'all';
        this.autoRefreshInterval = null;
        this.soundEnabled = true;
        this.notificationSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGO59e2rYBwGO5bf88x8KgYVYbTs8Khg'); // Bell sound
        
        // Конфигурация таймеров
        this.config = {
            preparingTime: 15, // минут на приготовление
            urgentTime: 20, // после какого времени заказ становится срочным
            criticalTime: 25, // критическое время
            autoRefreshSeconds: 5 // автообновление каждые 5 секунд
        };
        
        this.init();
    }

    init() {
        this.loadOrders();
        this.startAutoRefresh();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Переключение станций
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('station-filter')) {
                this.switchStation(e.target.dataset.station);
            }
            
            // Отметить позицию как готовую
            if (e.target.classList.contains('item-checkbox')) {
                this.toggleItemComplete(e.target.dataset.orderId, e.target.dataset.itemIndex);
            }
            
            // Завершить заказ
            if (e.target.classList.contains('complete-order-btn')) {
                this.completeOrder(e.target.dataset.orderId);
            }
            
            // Переключить звук
            if (e.target.id === 'kdsSound') {
                this.soundEnabled = e.target.checked;
            }
        });
    }

    async loadOrders() {
        try {
            const response = await fetch('/api/orders');
            if (response.ok) {
                const result = await response.json();
                const orders = result.data || result || [];
                
                // Фильтруем только заказы в работе
                this.orders = orders
                    .filter(order => ['accepted', 'preparing', 'ready'].includes(order.status))
                    .map(order => this.transformOrder(order));
                
                // Проверяем новые заказы для звукового оповещения
                this.checkForNewOrders();
                
                this.distributeOrdersByStations();
                this.render();
            }
        } catch (error) {
            console.error('KDS: Ошибка загрузки заказов:', error);
        }
    }

    transformOrder(order) {
        const createdAt = new Date(order.created_at);
        const now = new Date();
        const elapsedMinutes = Math.floor((now - createdAt) / 60000);
        
        return {
            id: order.id,
            orderNumber: order.id,
            customerName: order.customer_name || 'Клиент',
            items: order.items || [],
            createdAt: createdAt,
            elapsedMinutes: elapsedMinutes,
            status: order.status,
            priority: this.calculatePriority(elapsedMinutes),
            deliveryType: order.delivery_type,
            completedItems: []
        };
    }

    calculatePriority(elapsedMinutes) {
        if (elapsedMinutes >= this.config.criticalTime) return 'critical';
        if (elapsedMinutes >= this.config.urgentTime) return 'urgent';
        return 'normal';
    }

    distributeOrdersByStations() {
        // Очищаем станции
        Object.keys(this.stations).forEach(key => {
            this.stations[key].orders = [];
        });

        this.orders.forEach(order => {
            // Определяем станцию по товарам
            const station = this.getStationForOrder(order);
            this.stations[station].orders.push(order);
            this.stations.all.orders.push(order);
        });
    }

    getStationForOrder(order) {
        // Простая логика распределения по категориям
        const categories = order.items.map(item => item.product_name.toLowerCase());
        
        if (categories.some(cat => cat.includes('пицц') || cat.includes('гриль'))) {
            return 'hot';
        } else if (categories.some(cat => cat.includes('ролл') || cat.includes('салат'))) {
            return 'cold';
        } else if (categories.some(cat => cat.includes('напиток') || cat.includes('кофе') || cat.includes('чай'))) {
            return 'bar';
        }
        
        return 'hot'; // по умолчанию
    }

    checkForNewOrders() {
        // Проверка новых заказов и воспроизведение звука
        const previousOrderIds = this.previousOrders || [];
        const currentOrderIds = this.orders.map(o => o.id);
        const newOrders = currentOrderIds.filter(id => !previousOrderIds.includes(id));
        
        if (newOrders.length > 0 && this.soundEnabled) {
            this.playNotificationSound();
            this.showNotification(`🔔 Новых заказов: ${newOrders.length}`);
        }
        
        this.previousOrders = currentOrderIds;
    }

    playNotificationSound() {
        try {
            this.notificationSound.play();
        } catch (error) {
            console.log('KDS: Не удалось воспроизвести звук');
        }
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'kds-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #16a34a;
            color: white;
            padding: 1rem 2rem;
            border-radius: 8px;
            font-weight: 600;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    switchStation(station) {
        this.currentStation = station;
        
        // Обновляем активную кнопку
        document.querySelectorAll('.station-filter').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-station="${station}"]`).classList.add('active');
        
        this.render();
    }

    toggleItemComplete(orderId, itemIndex) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) return;
        
        const index = parseInt(itemIndex);
        if (order.completedItems.includes(index)) {
            order.completedItems = order.completedItems.filter(i => i !== index);
        } else {
            order.completedItems.push(index);
        }
        
        this.render();
    }

    async completeOrder(orderId) {
        if (!confirm('Заказ полностью готов?')) return;
        
        try {
            const response = await fetch(`/api/orders/${orderId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'ready' })
            });
            
            if (response.ok) {
                this.showNotification('✅ Заказ готов!');
                this.orders = this.orders.filter(o => o.id !== orderId);
                this.distributeOrdersByStations();
                this.render();
            }
        } catch (error) {
            console.error('KDS: Ошибка завершения заказа:', error);
        }
    }

    startAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }
        
        this.autoRefreshInterval = setInterval(() => {
            this.loadOrders();
        }, this.config.autoRefreshSeconds * 1000);
    }

    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
    }

    render() {
        const container = document.getElementById('kdsContent');
        if (!container) return;
        
        const currentOrders = this.stations[this.currentStation].orders;
        
        container.innerHTML = `
            <div class="kds-header" style="background: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <h2 style="margin: 0 0 0.5rem 0; color: var(--dandy-green);">🍳 Экран кухни (KDS)</h2>
                        <p style="margin: 0; color: #666; font-size: 0.9rem;">
                            Обновлено: ${new Date().toLocaleTimeString()} • Активных заказов: ${this.orders.length}
                        </p>
                    </div>
                    
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="checkbox" id="kdsSound" ${this.soundEnabled ? 'checked' : ''} 
                                   style="width: 20px; height: 20px; cursor: pointer;">
                            <span>🔔 Звук</span>
                        </label>
                    </div>
                </div>
                
                <div style="display: flex; gap: 0.5rem; margin-top: 1rem; flex-wrap: wrap;">
                    <button class="station-filter ${this.currentStation === 'all' ? 'active' : ''}" data-station="all"
                            style="padding: 0.5rem 1rem; border: 2px solid var(--dandy-green); border-radius: 8px; background: ${this.currentStation === 'all' ? 'var(--dandy-green)' : 'white'}; color: ${this.currentStation === 'all' ? 'white' : 'var(--dandy-green)'}; cursor: pointer; font-weight: 600;">
                        Все (${this.stations.all.orders.length})
                    </button>
                    <button class="station-filter ${this.currentStation === 'hot' ? 'active' : ''}" data-station="hot"
                            style="padding: 0.5rem 1rem; border: 2px solid #ea580c; border-radius: 8px; background: ${this.currentStation === 'hot' ? '#ea580c' : 'white'}; color: ${this.currentStation === 'hot' ? 'white' : '#ea580c'}; cursor: pointer; font-weight: 600;">
                        🔥 Горячий цех (${this.stations.hot.orders.length})
                    </button>
                    <button class="station-filter ${this.currentStation === 'cold' ? 'active' : ''}" data-station="cold"
                            style="padding: 0.5rem 1rem; border: 2px solid #2563eb; border-radius: 8px; background: ${this.currentStation === 'cold' ? '#2563eb' : 'white'}; color: ${this.currentStation === 'cold' ? 'white' : '#2563eb'}; cursor: pointer; font-weight: 600;">
                        ❄️ Холодный цех (${this.stations.cold.orders.length})
                    </button>
                    <button class="station-filter ${this.currentStation === 'bar' ? 'active' : ''}" data-station="bar"
                            style="padding: 0.5rem 1rem; border: 2px solid #7c3aed; border-radius: 8px; background: ${this.currentStation === 'bar' ? '#7c3aed' : 'white'}; color: ${this.currentStation === 'bar' ? 'white' : '#7c3aed'}; cursor: pointer; font-weight: 600;">
                        🍹 Бар (${this.stations.bar.orders.length})
                    </button>
                </div>
            </div>
            
            <div class="kds-orders-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 1rem;">
                ${currentOrders.length === 0 
                    ? '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: white; border-radius: 12px;"><p style="color: #999; font-size: 1.2rem;">Нет активных заказов на этой станции</p></div>'
                    : currentOrders.map(order => this.renderOrderCard(order)).join('')
                }
            </div>
            
            <style>
                @keyframes slideIn {
                    from { transform: translateX(400px); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(400px); opacity: 0; }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            </style>
        `;
    }

    renderOrderCard(order) {
        const priorityColors = {
            normal: { bg: '#dbeafe', border: '#2563eb', text: '#1e40af' },
            urgent: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
            critical: { bg: '#fee2e2', border: '#dc2626', text: '#991b1b' }
        };
        
        const colors = priorityColors[order.priority];
        const completionPercent = order.items.length > 0 
            ? (order.completedItems.length / order.items.length * 100).toFixed(0)
            : 0;
        
        return `
            <div class="kds-order-card" style="background: ${colors.bg}; border: 3px solid ${colors.border}; border-radius: 12px; padding: 1.5rem; ${order.priority === 'critical' ? 'animation: pulse 2s infinite;' : ''}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="margin: 0; font-size: 1.5rem; color: ${colors.text};">Заказ #${order.orderNumber.slice(-8)}</h3>
                    <span style="background: ${colors.border}; color: white; padding: 0.25rem 0.75rem; border-radius: 20px; font-weight: 600; font-size: 0.9rem;">
                        ${order.elapsedMinutes} мин
                    </span>
                </div>
                
                <div style="margin-bottom: 1rem; padding: 0.75rem; background: white; border-radius: 8px;">
                    <div style="font-weight: 600; margin-bottom: 0.25rem;">👤 ${order.customerName}</div>
                    <div style="font-size: 0.9rem; color: #666;">
                        ${order.deliveryType === 'delivery' ? '🚚 Доставка' : '🏪 Самовывоз'}
                    </div>
                </div>
                
                <div style="margin-bottom: 1rem;">
                    <div style="font-weight: 600; margin-bottom: 0.5rem;">Состав заказа:</div>
                    ${order.items.map((item, index) => `
                        <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: white; border-radius: 6px; margin-bottom: 0.5rem;">
                            <input type="checkbox" 
                                   class="item-checkbox" 
                                   data-order-id="${order.id}" 
                                   data-item-index="${index}"
                                   ${order.completedItems.includes(index) ? 'checked' : ''}
                                   style="width: 20px; height: 20px; cursor: pointer;">
                            <span style="flex: 1; ${order.completedItems.includes(index) ? 'text-decoration: line-through; opacity: 0.5;' : ''}">
                                ${item.product_name} × ${item.quantity}
                            </span>
                        </div>
                    `).join('')}
                </div>
                
                <div style="margin-bottom: 1rem; padding: 0.5rem; background: rgba(255,255,255,0.7); border-radius: 6px; text-align: center;">
                    <div style="font-size: 0.85rem; color: #666; margin-bottom: 0.25rem;">Готовность</div>
                    <div style="width: 100%; height: 8px; background: rgba(0,0,0,0.1); border-radius: 4px; overflow: hidden;">
                        <div style="width: ${completionPercent}%; height: 100%; background: #16a34a; transition: width 0.3s;"></div>
                    </div>
                    <div style="font-weight: 600; margin-top: 0.25rem;">${completionPercent}%</div>
                </div>
                
                <button class="complete-order-btn" 
                        data-order-id="${order.id}"
                        style="width: 100%; padding: 0.75rem; background: #16a34a; color: white; border: none; border-radius: 8px; font-weight: 600; font-size: 1rem; cursor: pointer; transition: all 0.2s;"
                        onmouseover="this.style.background='#15803d'"
                        onmouseout="this.style.background='#16a34a'">
                    ✅ Заказ готов
                </button>
            </div>
        `;
    }

    destroy() {
        this.stopAutoRefresh();
    }
}

// Глобальный экземпляр
window.kdsModule = null;

// Инициализация KDS
window.initKDS = function() {
    if (window.kdsModule) {
        window.kdsModule.destroy();
    }
    window.kdsModule = new KDSModule();
};

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KDSModule;
}
