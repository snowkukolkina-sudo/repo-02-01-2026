// ===== Couriers Management Module - Управление курьерами =====
// Полная система управления курьерами с назначением, трекингом и статистикой

class CouriersManagementModule {
    constructor() {
        this.couriers = [];
        this.activeOrders = [];
        this.courierStats = {};
        this.map = null;
        this.markers = {};
        this.autoRefreshInterval = null;
        
        this.init();
    }

    init() {
        this.loadCouriers();
        this.loadOrders();
        this.setupEventListeners();
        this.startAutoRefresh();
    }

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            // Добавить курьера
            if (e.target.id === 'addCourier') {
                this.showAddCourierModal();
            }
            
            // Назначить курьера на заказ
            if (e.target.classList.contains('assign-courier-btn')) {
                this.showAssignCourierModal(e.target.dataset.orderId);
            }
            
            // Просмотр курьера
            if (e.target.classList.contains('view-courier-btn')) {
                this.showCourierDetails(e.target.dataset.courierId);
            }
            
            // Изменить статус курьера
            if (e.target.classList.contains('toggle-courier-status')) {
                this.toggleCourierStatus(e.target.dataset.courierId);
            }
            
            // Статистика курьера
            if (e.target.classList.contains('courier-stats-btn')) {
                this.showCourierStats(e.target.dataset.courierId);
            }
        });
    }

    loadCouriers() {
        // Загружаем из localStorage
        const saved = localStorage.getItem('dandy_couriers');
        if (saved) {
            this.couriers = JSON.parse(saved);
        } else {
            // Демо данные
            this.couriers = [
                {
                    id: '1',
                    name: 'Алексей Иванов',
                    phone: '+7 900 123-45-67',
                    status: 'available', // available, busy, offline
                    currentOrder: null,
                    location: { lat: 55.751244, lng: 37.618423 },
                    vehicle: 'Скутер',
                    rating: 4.8,
                    completedOrders: 156,
                    todayOrders: 12,
                    todayEarnings: 3400
                },
                {
                    id: '2',
                    name: 'Марина Петрова',
                    phone: '+7 900 234-56-78',
                    status: 'busy',
                    currentOrder: 'D1727634567890ABCD',
                    location: { lat: 55.755244, lng: 37.622423 },
                    vehicle: 'Автомобиль',
                    rating: 4.9,
                    completedOrders: 243,
                    todayOrders: 15,
                    todayEarnings: 4200
                },
                {
                    id: '3',
                    name: 'Павел Сидоров',
                    phone: '+7 900 345-67-89',
                    status: 'offline',
                    currentOrder: null,
                    location: { lat: 55.749244, lng: 37.620423 },
                    vehicle: 'Велосипед',
                    rating: 4.7,
                    completedOrders: 89,
                    todayOrders: 0,
                    todayEarnings: 0
                }
            ];
            this.saveCouriers();
        }
    }

    async loadOrders() {
        try {
            const response = await fetch('/api/orders');
            if (response.ok) {
                const result = await response.json();
                const orders = result.data || result || [];
                
                // Фильтруем заказы для доставки
                this.activeOrders = orders.filter(order => 
                    order.delivery_type === 'delivery' && 
                    ['accepted', 'preparing', 'ready', 'with_courier', 'in_transit'].includes(order.status)
                );
            }
        } catch (error) {
            console.error('Couriers: Ошибка загрузки заказов:', error);
        }
    }

    saveCouriers() {
        localStorage.setItem('dandy_couriers', JSON.stringify(this.couriers));
    }

    showAddCourierModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div style="background: white; border-radius: 16px; padding: 2rem; max-width: 500px; width: 90%;">
                <h2 style="margin: 0 0 1.5rem 0; color: var(--dandy-green);">➕ Добавить курьера</h2>
                
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">ФИО:</label>
                    <input type="text" id="courierName" placeholder="Иван Иванов" style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                </div>
                
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Телефон:</label>
                    <input type="tel" id="courierPhone" placeholder="+7 900 123-45-67" style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                </div>
                
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Транспорт:</label>
                    <select id="courierVehicle" style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                        <option value="Скутер">Скутер</option>
                        <option value="Автомобиль">Автомобиль</option>
                        <option value="Велосипед">Велосипед</option>
                        <option value="Пешком">Пешком</option>
                    </select>
                </div>
                
                <div style="display: flex; gap: 1rem;">
                    <button onclick="couriersModule.saveNewCourier()" style="flex: 1; padding: 1rem; background: var(--dandy-green); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                        💾 Сохранить
                    </button>
                    <button onclick="this.closest('.modal-overlay').remove()" style="flex: 1; padding: 1rem; background: #6b7280; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                        ❌ Отмена
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    saveNewCourier() {
        const name = document.getElementById('courierName').value;
        const phone = document.getElementById('courierPhone').value;
        const vehicle = document.getElementById('courierVehicle').value;
        
        if (!name || !phone) {
            alert('Заполните все поля');
            return;
        }
        
        const newCourier = {
            id: Date.now().toString(),
            name,
            phone,
            status: 'offline',
            currentOrder: null,
            location: { lat: 55.751244, lng: 37.618423 },
            vehicle,
            rating: 5.0,
            completedOrders: 0,
            todayOrders: 0,
            todayEarnings: 0
        };
        
        this.couriers.push(newCourier);
        this.saveCouriers();
        
        document.querySelector('.modal-overlay').remove();
        this.render();
        
        alert('✅ Курьер добавлен!');
    }

    async showAssignCourierModal(orderId) {
        const order = this.activeOrders.find(o => o.id === orderId);
        if (!order) return;
        
        const availableCouriers = this.couriers.filter(c => c.status === 'available');
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div style="background: white; border-radius: 16px; padding: 2rem; max-width: 500px; width: 90%;">
                <h2 style="margin: 0 0 1.5rem 0; color: var(--dandy-green);">🚚 Назначить курьера</h2>
                
                <div style="margin-bottom: 1.5rem; padding: 1rem; background: #f3f4f6; border-radius: 8px;">
                    <div style="font-weight: 600; margin-bottom: 0.5rem;">Заказ #${orderId.slice(-8)}</div>
                    <div style="font-size: 0.9rem; color: #666;">Клиент: ${order.customer_name}</div>
                    <div style="font-size: 0.9rem; color: #666;">Адрес: ${order.address || 'Не указан'}</div>
                    <div style="font-weight: 600; margin-top: 0.5rem;">Сумма: ${order.total} ₽</div>
                </div>
                
                ${availableCouriers.length === 0 ? `
                    <div style="padding: 2rem; text-align: center; color: #999;">
                        <div style="font-size: 2rem; margin-bottom: 0.5rem;">😔</div>
                        <div>Нет свободных курьеров</div>
                    </div>
                ` : `
                    <div style="margin-bottom: 1.5rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Выберите курьера:</label>
                        <select id="selectedCourier" style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                            ${availableCouriers.map(c => `
                                <option value="${c.id}">${c.name} (${c.vehicle}) - ⭐ ${c.rating}</option>
                            `).join('')}
                        </select>
                    </div>
                    
                    <div style="display: flex; gap: 1rem;">
                        <button onclick="couriersModule.assignCourier('${orderId}')" style="flex: 1; padding: 1rem; background: var(--dandy-green); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                            ✅ Назначить
                        </button>
                        <button onclick="this.closest('.modal-overlay').remove()" style="flex: 1; padding: 1rem; background: #6b7280; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                            ❌ Отмена
                        </button>
                    </div>
                `}
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    async assignCourier(orderId) {
        const courierId = document.getElementById('selectedCourier').value;
        const courier = this.couriers.find(c => c.id === courierId);
        
        if (!courier) return;
        
        // Обновляем статус курьера
        courier.status = 'busy';
        courier.currentOrder = orderId;
        this.saveCouriers();
        
        // Обновляем статус заказа через API
        try {
            await fetch(`/api/orders/${orderId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'with_courier' })
            });
        } catch (error) {
            console.error('Ошибка обновления статуса заказа:', error);
        }
        
        document.querySelector('.modal-overlay').remove();
        this.render();
        
        alert(`✅ Курьер ${courier.name} назначен на заказ!`);
    }

    toggleCourierStatus(courierId) {
        const courier = this.couriers.find(c => c.id === courierId);
        if (!courier) return;
        
        if (courier.status === 'offline') {
            courier.status = 'available';
        } else if (courier.status === 'available') {
            courier.status = 'offline';
        }
        
        this.saveCouriers();
        this.render();
    }

    showCourierDetails(courierId) {
        const courier = this.couriers.find(c => c.id === courierId);
        if (!courier) return;
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div style="background: white; border-radius: 16px; padding: 2rem; max-width: 600px; width: 90%;">
                <h2 style="margin: 0 0 1.5rem 0; color: var(--dandy-green);">👤 ${courier.name}</h2>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                    <div style="background: #f3f4f6; padding: 1rem; border-radius: 8px;">
                        <div style="font-size: 0.85rem; color: #666;">Телефон</div>
                        <div style="font-weight: 600;">${courier.phone}</div>
                    </div>
                    <div style="background: #f3f4f6; padding: 1rem; border-radius: 8px;">
                        <div style="font-size: 0.85rem; color: #666;">Транспорт</div>
                        <div style="font-weight: 600;">${courier.vehicle}</div>
                    </div>
                    <div style="background: #f3f4f6; padding: 1rem; border-radius: 8px;">
                        <div style="font-size: 0.85rem; color: #666;">Рейтинг</div>
                        <div style="font-weight: 600;">⭐ ${courier.rating}</div>
                    </div>
                    <div style="background: #f3f4f6; padding: 1rem; border-radius: 8px;">
                        <div style="font-size: 0.85rem; color: #666;">Статус</div>
                        <div style="font-weight: 600;">${this.getStatusText(courier.status)}</div>
                    </div>
                </div>
                
                <div style="background: #dbeafe; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                    <h3 style="margin: 0 0 0.5rem 0; color: #1e40af;">📊 Статистика</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
                        <div>
                            <div style="font-size: 0.85rem; color: #1e40af;">Всего заказов</div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: #1e40af;">${courier.completedOrders}</div>
                        </div>
                        <div>
                            <div style="font-size: 0.85rem; color: #1e40af;">Сегодня</div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: #1e40af;">${courier.todayOrders}</div>
                        </div>
                        <div>
                            <div style="font-size: 0.85rem; color: #1e40af;">Заработок</div>
                            <div style="font-size: 1.5rem; font-weight: 700; color: #1e40af;">${courier.todayEarnings} ₽</div>
                        </div>
                    </div>
                </div>
                
                ${courier.currentOrder ? `
                    <div style="background: #fef3c7; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                        <div style="font-weight: 600; color: #92400e;">Текущий заказ: #${courier.currentOrder.slice(-8)}</div>
                    </div>
                ` : ''}
                
                <button onclick="this.closest('.modal-overlay').remove()" style="width: 100%; padding: 1rem; background: #6b7280; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                    Закрыть
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    showCourierStats(courierId) {
        alert('📊 Детальная статистика курьера\n\n(Будет реализована в следующей версии)');
    }

    getStatusText(status) {
        const statuses = {
            'available': '🟢 Свободен',
            'busy': '🟡 Занят',
            'offline': '⚫ Не на смене'
        };
        return statuses[status] || status;
    }

    getStatusColor(status) {
        const colors = {
            'available': '#16a34a',
            'busy': '#f59e0b',
            'offline': '#6b7280'
        };
        return colors[status] || '#6b7280';
    }

    startAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }
        
        this.autoRefreshInterval = setInterval(() => {
            this.loadOrders();
            this.render();
        }, 10000); // каждые 10 секунд
    }

    render() {
        const container = document.getElementById('couriersContent');
        if (!container) return;
        
        const totalCouriers = this.couriers.length;
        const available = this.couriers.filter(c => c.status === 'available').length;
        const busy = this.couriers.filter(c => c.status === 'busy').length;
        const offline = this.couriers.filter(c => c.status === 'offline').length;
        
        const ordersNeedingCourier = this.activeOrders.filter(o => 
            o.status === 'ready' && o.delivery_type === 'delivery'
        );
        
        container.innerHTML = `
            <div style="background: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
                    <div>
                        <h2 style="margin: 0 0 0.5rem 0; color: var(--dandy-green);">🚚 Управление курьерами</h2>
                        <p style="margin: 0; color: #666;">Назначение заказов и отслеживание курьеров</p>
                    </div>
                    <button id="addCourier" style="padding: 0.75rem 1.5rem; background: var(--dandy-green); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                        ➕ Добавить курьера
                    </button>
                </div>
                
                <!-- Статистика -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                    <div style="background: #dbeafe; padding: 1rem; border-radius: 8px;">
                        <div style="font-size: 2rem; font-weight: 700; color: #1e40af;">${totalCouriers}</div>
                        <div style="color: #1e40af; font-weight: 600;">Всего курьеров</div>
                    </div>
                    <div style="background: #d1fae5; padding: 1rem; border-radius: 8px;">
                        <div style="font-size: 2rem; font-weight: 700; color: #065f46;">${available}</div>
                        <div style="color: #065f46; font-weight: 600;">🟢 Свободны</div>
                    </div>
                    <div style="background: #fef3c7; padding: 1rem; border-radius: 8px;">
                        <div style="font-size: 2rem; font-weight: 700; color: #92400e;">${busy}</div>
                        <div style="color: #92400e; font-weight: 600;">🟡 Заняты</div>
                    </div>
                    <div style="background: #f3f4f6; padding: 1rem; border-radius: 8px;">
                        <div style="font-size: 2rem; font-weight: 700; color: #6b7280;">${offline}</div>
                        <div style="color: #6b7280; font-weight: 600;">⚫ Не на смене</div>
                    </div>
                </div>
                
                ${ordersNeedingCourier.length > 0 ? `
                    <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                        <div style="font-weight: 600; color: #991b1b; margin-bottom: 0.5rem;">
                            ⚠️ Заказов ожидают назначения курьера: ${ordersNeedingCourier.length}
                        </div>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            ${ordersNeedingCourier.map(o => `
                                <button class="assign-courier-btn" data-order-id="${o.id}"
                                        style="padding: 0.5rem 1rem; background: #dc2626; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem;">
                                    #${o.id.slice(-8)}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
            
            <!-- Список курьеров -->
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem;">
                ${this.couriers.map(courier => this.renderCourierCard(courier)).join('')}
            </div>
        `;
    }

    renderCourierCard(courier) {
        const statusColor = this.getStatusColor(courier.status);
        const statusText = this.getStatusText(courier.status);
        
        return `
            <div style="background: white; border-radius: 12px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-left: 4px solid ${statusColor};">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                    <div>
                        <h3 style="margin: 0 0 0.25rem 0;">${courier.name}</h3>
                        <div style="font-size: 0.9rem; color: #666;">${courier.phone}</div>
                    </div>
                    <button class="toggle-courier-status" data-courier-id="${courier.id}"
                            style="padding: 0.5rem 1rem; background: ${statusColor}; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">
                        ${statusText}
                    </button>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 1rem;">
                    <div style="background: #f3f4f6; padding: 0.75rem; border-radius: 6px;">
                        <div style="font-size: 0.75rem; color: #666;">Транспорт</div>
                        <div style="font-weight: 600; font-size: 0.9rem;">${courier.vehicle}</div>
                    </div>
                    <div style="background: #f3f4f6; padding: 0.75rem; border-radius: 6px;">
                        <div style="font-size: 0.75rem; color: #666;">Рейтинг</div>
                        <div style="font-weight: 600; font-size: 0.9rem;">⭐ ${courier.rating}</div>
                    </div>
                </div>
                
                <div style="background: #f9fafb; padding: 0.75rem; border-radius: 6px; margin-bottom: 1rem;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
                        <span>Сегодня заказов:</span>
                        <strong>${courier.todayOrders}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-top: 0.25rem;">
                        <span>Заработок:</span>
                        <strong>${courier.todayEarnings} ₽</strong>
                    </div>
                </div>
                
                ${courier.currentOrder ? `
                    <div style="background: #fef3c7; padding: 0.75rem; border-radius: 6px; margin-bottom: 1rem; font-size: 0.85rem; color: #92400e; text-align: center;">
                        🚚 Везёт заказ #${courier.currentOrder.slice(-8)}
                    </div>
                ` : ''}
                
                <div style="display: flex; gap: 0.5rem;">
                    <button class="view-courier-btn" data-courier-id="${courier.id}"
                            style="flex: 1; padding: 0.5rem; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">
                        👤 Детали
                    </button>
                    <button class="courier-stats-btn" data-courier-id="${courier.id}"
                            style="flex: 1; padding: 0.5rem; background: #7c3aed; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">
                        📊 Статистика
                    </button>
                </div>
            </div>
        `;
    }

    destroy() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }
    }
}

// Глобальный экземпляр
window.couriersModule = null;

// Инициализация
window.initCouriers = function() {
    if (window.couriersModule) {
        window.couriersModule.destroy();
    }
    window.couriersModule = new CouriersManagementModule();
};

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CouriersManagementModule;
}
