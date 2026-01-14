/**
 * DANDY KDS (Kitchen Display System) Advanced
 * Улучшенная система отображения заказов для кухни с мультиповарской поддержкой
 */

class KDSAdvancedModule {
    constructor() {
        this.orders = [];
        this.stations = [
            { id: 'pizza', name: '🍕 Пицца', orders: [] },
            { id: 'sushi', name: '🍣 Суши', orders: [] },
            { id: 'drinks', name: '🥤 Напитки', orders: [] },
            { id: 'desserts', name: '🍰 Десерты', orders: [] }
        ];
        this.chefs = [];
        this.currentChef = null;
        this.autoRefreshInterval = null;
        this.socket = null;
        this.API_BASE = '/api/v1/orders';
    }

    async init() {
        console.log('👨‍🍳 KDS Advanced Module initialized');
        await this.identifyChef();
        await this.loadOrders();
        this.render();
        this.startAutoRefresh();
        this.connectWebSocket();
    }

    async identifyChef() {
        // Try to get chef from localStorage
        this.currentChef = localStorage.getItem('currentChef');
        
        if (!this.currentChef) {
            this.currentChef = prompt('Введите ваше имя (повар):') || 'Повар';
            localStorage.setItem('currentChef', this.currentChef);
        }

        console.log(`👨‍🍳 Chef identified: ${this.currentChef}`);
    }

    async loadOrders() {
        try {
            const response = await fetch(`${this.API_BASE}?status=preparing,new&limit=50`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            if (data.success) {
                this.orders = data.data;
                this.distributeOrdersToStations();
            }
        } catch (error) {
            console.error('Error loading orders:', error);
        }
    }

    distributeOrdersToStations() {
        // Reset stations
        this.stations.forEach(station => station.orders = []);

        // Distribute orders to stations based on items
        this.orders.forEach(order => {
            const items = order.items || [];
            
            items.forEach(item => {
                let stationId = 'pizza'; // Default

                // Determine station based on item category or name
                if (item.name && (item.name.includes('Суши') || item.name.includes('Ролл'))) {
                    stationId = 'sushi';
                } else if (item.category === 'drinks' || item.name?.includes('Напиток')) {
                    stationId = 'drinks';
                } else if (item.category === 'desserts' || item.name?.includes('Десерт')) {
                    stationId = 'desserts';
                }

                const station = this.stations.find(s => s.id === stationId);
                if (station) {
                    const existingOrder = station.orders.find(o => o.id === order.id);
                    if (!existingOrder) {
                        station.orders.push({
                            ...order,
                            station_items: [item]
                        });
                    } else {
                        existingOrder.station_items.push(item);
                    }
                }
            });
        });
    }

    render() {
        const container = document.getElementById('kds') || document.getElementById('kdsContent');
        if (!container) return;

        container.innerHTML = `
            <div class="kds-advanced">
                <!-- Header -->
                <div class="kds-header" style="background: #0b5c3b; color: white; padding: 1rem; display: flex; justify-content: space-between; align-items: center;">
                    <h2>👨‍🍳 КДС - ${this.currentChef}</h2>
                    <div class="kds-controls">
                        <span id="currentTime" style="font-size: 1.2rem; margin-right: 1rem;"></span>
                        <span style="margin-right: 1rem;">Заказов: ${this.orders.length}</span>
                        <button class="btn btn-secondary" onclick="kdsAdvanced.changeChef()">👨‍🍳 Сменить повара</button>
                        <button class="btn btn-warning" onclick="kdsAdvanced.toggleFullscreen()">⛶ Полный экран</button>
                    </div>
                </div>

                <!-- Stations Grid -->
                <div class="kds-stations" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 1rem; padding: 1rem; background: #f5f5f5; min-height: calc(100vh - 80px);">
                    ${this.renderStations()}
                </div>
            </div>
        `;

        this.startClock();
    }

    renderStations() {
        return this.stations.map(station => {
            const orders = station.orders;
            const urgentCount = orders.filter(o => this.isUrgent(o)).length;

            return `
                <div class="kds-station" style="background: white; border-radius: 12px; padding: 1rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <div class="station-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 3px solid #0b5c3b;">
                        <h3 style="margin: 0;">${station.name}</h3>
                        <span class="badge" style="background: ${urgentCount > 0 ? '#dc3545' : '#28a745'}; color: white; padding: 0.3rem 0.8rem; border-radius: 20px;">
                            ${orders.length} ${urgentCount > 0 ? `(${urgentCount} 🔴)` : ''}
                        </span>
                    </div>

                    <div class="station-orders" style="display: flex; flex-direction: column; gap: 0.8rem; max-height: calc(100vh - 200px); overflow-y: auto;">
                        ${orders.length > 0 ? orders.map(order => this.renderOrderCard(order, station.id)).join('') : '<p style="text-align: center; opacity: 0.5; padding: 2rem;">Нет заказов</p>'}
                    </div>
                </div>
            `;
        }).join('');
    }

    renderOrderCard(order, stationId) {
        const isUrgent = this.isUrgent(order);
        const timePassed = this.getTimePassed(order.created_at);
        const urgentClass = isUrgent ? 'order-urgent' : '';
        const items = order.station_items || order.items || [];

        return `
            <div class="order-card ${urgentClass}" style="
                background: ${isUrgent ? '#fff5f5' : 'white'};
                border: 2px solid ${isUrgent ? '#dc3545' : '#dee2e6'};
                border-radius: 8px;
                padding: 1rem;
                ${isUrgent ? 'animation: pulse 1.5s infinite;' : ''}
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <h4 style="margin: 0; font-size: 1.3rem;">#${order.order_number || order.id.slice(0, 8)}</h4>
                    <span style="
                        background: ${timePassed > 20 ? '#dc3545' : timePassed > 10 ? '#ffc107' : '#28a745'};
                        color: white;
                        padding: 0.3rem 0.8rem;
                        border-radius: 20px;
                        font-weight: bold;
                    ">${timePassed} мин</span>
                </div>

                <div style="margin: 0.8rem 0;">
                    ${items.map(item => `
                        <div style="padding: 0.5rem; background: #f8f9fa; border-radius: 4px; margin-bottom: 0.3rem; display: flex; justify-content: space-between;">
                            <span><strong>${item.quantity}x</strong> ${item.name}</span>
                            ${item.notes ? `<span style="opacity: 0.7; font-size: 0.9rem;">💬 ${item.notes}</span>` : ''}
                        </div>
                    `).join('')}
                </div>

                ${order.assigned_chef && order.assigned_chef !== this.currentChef ? `
                    <div style="padding: 0.5rem; background: #e7f3ff; border-radius: 4px; margin-bottom: 0.5rem;">
                        <span>👨‍🍳 Готовит: ${order.assigned_chef}</span>
                    </div>
                ` : ''}

                <div style="display: flex; gap: 0.5rem; margin-top: 0.8rem;">
                    ${!order.assigned_chef ? `
                        <button class="btn btn-primary btn-small" style="flex: 1;" onclick="kdsAdvanced.takeOrder('${order.id}', '${stationId}')">
                            ✋ Взять
                        </button>
                    ` : order.assigned_chef === this.currentChef ? `
                        <button class="btn btn-success btn-small" style="flex: 1;" onclick="kdsAdvanced.completeOrder('${order.id}', '${stationId}')">
                            ✅ Готово
                        </button>
                    ` : ''}
                    <button class="btn btn-secondary btn-small" onclick="kdsAdvanced.showOrderDetails('${order.id}')">
                        👁️
                    </button>
                </div>
            </div>
        `;
    }

    isUrgent(order) {
        const timePassed = this.getTimePassed(order.created_at);
        return timePassed > 15; // Orders older than 15 minutes are urgent
    }

    getTimePassed(createdAt) {
        const created = new Date(createdAt);
        const now = new Date();
        const diff = now - created;
        return Math.floor(diff / 60000); // Minutes
    }

    async takeOrder(orderId, stationId) {
        try {
            const response = await fetch(`${this.API_BASE}/${orderId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    status: 'preparing',
                    assigned_chef: this.currentChef,
                    started_at: new Date()
                })
            });

            const result = await response.json();
            if (result.success) {
                console.log(`✋ Order ${orderId} taken by ${this.currentChef}`);
                await this.loadOrders();
                this.render();

                // Play sound
                if (window.soundNotifications) {
                    window.soundNotifications.playSound('newOrder');
                }
            }
        } catch (error) {
            console.error('Error taking order:', error);
            alert('❌ Ошибка: не удалось взять заказ');
        }
    }

    async completeOrder(orderId, stationId) {
        if (!confirm('Заказ готов?')) return;

        try {
            const response = await fetch(`${this.API_BASE}/${orderId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    status: 'ready',
                    completed_at: new Date(),
                    completed_by: this.currentChef
                })
            });

            const result = await response.json();
            if (result.success) {
                console.log(`✅ Order ${orderId} completed by ${this.currentChef}`);
                await this.loadOrders();
                this.render();

                // Play success sound
                if (window.soundNotifications) {
                    window.soundNotifications.playSound('newOrder');
                }
            }
        } catch (error) {
            console.error('Error completing order:', error);
            alert('❌ Ошибка: не удалось завершить заказ');
        }
    }

    showOrderDetails(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) return;

        alert(`
Заказ #${order.order_number || order.id.slice(0, 8)}

Статус: ${order.status}
Время: ${new Date(order.created_at).toLocaleString('ru-RU')}
${order.assigned_chef ? `Повар: ${order.assigned_chef}` : ''}

Позиции:
${(order.items || []).map(item => `- ${item.quantity}x ${item.name}${item.notes ? ` (${item.notes})` : ''}`).join('\n')}

Всего: ₽ ${order.total_amount}
        `);
    }

    changeChef() {
        const newChef = prompt('Введите ваше имя:', this.currentChef);
        if (newChef) {
            this.currentChef = newChef;
            localStorage.setItem('currentChef', newChef);
            this.render();
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                alert(`Ошибка включения полноэкранного режима: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    }

    startClock() {
        const updateClock = () => {
            const now = new Date();
            const timeString = now.toLocaleTimeString('ru-RU');
            const clockElement = document.getElementById('currentTime');
            if (clockElement) {
                clockElement.textContent = timeString;
            }
        };

        updateClock();
        setInterval(updateClock, 1000);
    }

    startAutoRefresh() {
        // Refresh orders every 30 seconds
        this.autoRefreshInterval = setInterval(async () => {
            console.log('♻️ Auto-refreshing KDS...');
            await this.loadOrders();
            this.render();
        }, 30000);
    }

    connectWebSocket() {
        if (typeof io !== 'undefined') {
            // Проверяем доступность Socket.IO перед подключением
            const checkSocketAvailability = async () => {
                try {
                    const probeUrl = `/socket.io/?EIO=4&transport=polling&t=${Date.now()}`;
                    const response = await fetch(probeUrl, { 
                        method: 'GET', 
                        cache: 'no-store',
                        signal: AbortSignal.timeout(1000) // Таймаут 1 секунда
                    });
                    return response.ok;
                } catch (error) {
                    // Тихий отказ - не логируем ошибку
                    return false;
                }
            };

            let reconnectAttempts = 0;
            const maxReconnectAttempts = 3;
            let reconnectTimeout = null;
            let shouldReconnect = true;

            const connectSocket = async () => {
                if (!shouldReconnect) return;

                try {
                    // Проверяем доступность перед подключением
                    const available = await checkSocketAvailability();
                    if (!available) {
                        console.info('ℹ️ KDS WebSocket endpoint недоступен, используем только автообновление');
                        shouldReconnect = false;
                        return;
                    }

                    const socket = io(window.location.origin, {
                        timeout: 5000,
                        reconnection: false,
                        transports: ['polling'], // Используем только polling, без websocket
                        upgrade: false // Отключаем автоматическое обновление до websocket
                    });

                    socket.on('connect', () => {
                        console.log('✅ KDS connected to WebSocket');
                        reconnectAttempts = 0;
                        shouldReconnect = true;
                    });

                    socket.on('connect_error', (error) => {
                        reconnectAttempts++;
                        // Не показываем ошибку в консоли, если это просто недоступный сервер
                        if (error.message && !error.message.includes('404')) {
                            console.warn(`⚠️ KDS WebSocket connection failed (attempt ${reconnectAttempts}/${maxReconnectAttempts}):`, error.message);
                        }
                        
                        if (reconnectAttempts >= maxReconnectAttempts) {
                            console.info('ℹ️ KDS WebSocket server unavailable after ' + maxReconnectAttempts + ' attempts, using auto-refresh only');
                            socket.disconnect();
                            shouldReconnect = false;
                            return;
                        }

                        if (reconnectTimeout) clearTimeout(reconnectTimeout);
                        reconnectTimeout = setTimeout(() => {
                            if (shouldReconnect) {
                                socket.disconnect();
                                connectSocket();
                            }
                        }, 10000);
                    });

                    socket.on('disconnect', (reason) => {
                        if (reason === 'io server disconnect') {
                            console.warn('⚠️ KDS WebSocket server disconnected, using auto-refresh only');
                            shouldReconnect = false;
                        }
                    });

                    socket.on('new_order', async (order) => {
                        console.log('🔔 New order received in KDS:', order);
                        await this.loadOrders();
                        this.render();
                    });

                    socket.on('order_updated', async (order) => {
                        console.log('🔄 Order updated in KDS:', order);
                        await this.loadOrders();
                        this.render();
                    });

                    this.socket = socket;
                } catch (error) {
                    // Не показываем ошибку в консоли, если это просто недоступный сервер
                    if (error.message && !error.message.includes('404') && !error.message.includes('WebSocket')) {
                        console.error('Error initializing KDS WebSocket:', error);
                    } else {
                        console.info('ℹ️ KDS WebSocket недоступен, используем только автообновление');
                    }
                    shouldReconnect = false;
                }
            };

            connectSocket();
        } else {
            console.warn('⚠️ Socket.IO not available for KDS, using auto-refresh only');
        }
    }

    destroy() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }
}

// CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0%, 100% {
            box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.7);
        }
        50% {
            box-shadow: 0 0 0 10px rgba(220, 53, 69, 0);
        }
    }

    .order-card {
        transition: all 0.3s ease;
    }

    .order-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    .station-orders::-webkit-scrollbar {
        width: 8px;
    }

    .station-orders::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 10px;
    }

    .station-orders::-webkit-scrollbar-thumb {
        background: #888;
        border-radius: 10px;
    }

    .station-orders::-webkit-scrollbar-thumb:hover {
        background: #555;
    }
`;
document.head.appendChild(style);

// Initialize module
if (typeof window !== 'undefined') {
    window.KDSAdvancedModule = KDSAdvancedModule;
    window.kdsAdvanced = new KDSAdvancedModule();
}

