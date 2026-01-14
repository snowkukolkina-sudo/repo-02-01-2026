/**
 * DANDY Couriers Management Module
 * Управление курьерами, назначение заказов, GPS трекинг в реальном времени
 */

class CouriersManagementModule {
    constructor() {
        this.couriers = [];
        this.deliveries = [];
        this.map = null;
        this.markers = {};
        this.socket = null;
        this.API_BASE = '/api/couriers';
        this.socketAvailable = null; // Кэш результата проверки доступности socket.io
    }

    async init() {
        console.log('🚴 Couriers Management Module initialized');
        await this.loadCouriers();
        await this.loadDeliveries();
        this.render();
        // Подключаемся к WebSocket только если он явно включён
        // Проверяем флаг ПЕРЕД вызовом, чтобы не делать никаких запросов
        if (window.GPS_SOCKET_ENABLED === true) {
            await this.connectWebSocket();
        } else {
            // Если флаг false или undefined - не подключаемся вообще
            this.socketAvailable = false;
        }
    }

    async loadCouriers() {
        try {
            const response = await fetch(this.API_BASE, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            if (data.success) {
                this.couriers = data.data;
            }
        } catch (error) {
            console.error('Error loading couriers:', error);
        }
    }

    async loadDeliveries() {
        try {
            const response = await fetch(`${this.API_BASE}/deliveries`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            if (data.success) {
                this.deliveries = data.data;
            }
        } catch (error) {
            console.error('Error loading deliveries:', error);
        }
    }

    async connectWebSocket() {
        // ПЕРВАЯ проверка - явное отключение через флаг
        // Если GPS_SOCKET_ENABLED установлен в false - полностью отключаем
        if (window.GPS_SOCKET_ENABLED === false) {
            // WebSocket явно отключён - не делаем никаких запросов
            this.socketAvailable = false;
            return;
        }

        // ВТОРАЯ проверка - Socket.IO должен быть загружен
        if (typeof io === 'undefined') {
            // Socket.IO не загружен - тихо выходим
            return;
        }

        // ТРЕТЬЯ проверка - явное разрешение на подключение
        // Если GPS_SOCKET_ENABLED не установлен в true - не подключаемся
        if (window.GPS_SOCKET_ENABLED !== true) {
            // WebSocket не включён явно (undefined или другое значение) - тихо выходим
            return;
        }

        // ЧЕТВЕРТАЯ проверка - кэш в localStorage (чтобы не делать запросы при каждой загрузке)
        const cachedAvailability = localStorage.getItem('gps_socket_available');
        if (cachedAvailability === 'false') {
            this.socketAvailable = false;
            return;
        }

        // ПЯТАЯ проверка - если уже проверяли и сервер недоступен - не пытаемся снова
        if (this.socketAvailable === false) {
            return;
        }

        // Только если все проверки пройдены - проверяем доступность socket.io
        // Но даже здесь используем более безопасный подход
        try {
            const probeUrl = `/gps/socket.io/?EIO=4&transport=polling&t=${Date.now()}`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1000);
            
            const response = await fetch(probeUrl, { 
                method: 'HEAD', // Используем HEAD вместо GET - меньше данных
                cache: 'no-store',
                signal: controller.signal
            }).finally(() => clearTimeout(timeoutId));
            
            if (!response.ok) {
                // Сервер недоступен - кэшируем и выходим
                this.socketAvailable = false;
                localStorage.setItem('gps_socket_available', 'false');
                return;
            }
        } catch (error) {
            // Сервер недоступен (таймаут, сеть, 404 и т.д.) - кэшируем и выходим тихо
            this.socketAvailable = false;
            localStorage.setItem('gps_socket_available', 'false');
            return;
        }

        let reconnectAttempts = 0;
        const maxReconnectAttempts = 1; // Уменьшаем до 1 попытки
        let reconnectTimeout = null;
        let shouldReconnect = true;

        const connectSocket = () => {
            if (!shouldReconnect) return;
            
            try {
                // Connect to WebSocket namespace for GPS
                // Используем короткий таймаут и отключаем автоматическое переподключение
                this.socket = io('/gps', {
                    timeout: 2000, // Короткий таймаут
                    reconnection: false, // Не переподключаемся автоматически
                    reconnectionAttempts: 0, // Не пытаемся переподключаться
                    transports: ['polling'],
                    upgrade: false,
                    // Подавляем логирование ошибок
                    autoConnect: true
                });

                this.socket.on('connect', () => {
                    console.log('📡 Connected to GPS WebSocket');
                    this.socket.emit('admin-subscribe');
                    reconnectAttempts = 0;
                    shouldReconnect = true;
                    // Сохраняем успешное подключение
                    this.socketAvailable = true;
                    localStorage.setItem('gps_socket_available', 'true');
                });

                this.socket.on('connect_error', (error) => {
                    // Тихий режим - полностью подавляем ошибки подключения
                    // Они ожидаемы, если GPS сервер не настроен
                    reconnectAttempts++;
                    
                    if (reconnectAttempts >= maxReconnectAttempts) {
                        // Кэшируем как недоступный и отключаемся
                        this.socketAvailable = false;
                        // Сохраняем в localStorage, чтобы не пытаться при следующей загрузке
                        localStorage.setItem('gps_socket_available', 'false');
                        if (this.socket) {
                            this.socket.disconnect();
                            this.socket = null;
                        }
                        shouldReconnect = false;
                    }
                });

                this.socket.on('courier-location-update', (data) => {
                    this.updateCourierLocation(data);
                });

                this.socket.on('disconnect', (reason) => {
                    // Тихий режим - не логируем отключения
                    if (reason === 'io server disconnect' || reason === 'transport close') {
                        this.socketAvailable = false;
                        shouldReconnect = false;
                    }
                });

                this.socket.on('error', (error) => {
                    // Подавляем ошибки socket.io - они ожидаемы, если сервер не настроен
                    // console.error('GPS WebSocket error:', error);
                });
            } catch (error) {
                // Подавляем ошибки подключения - они ожидаемы, если сервер не настроен
                // console.error('Error connecting to GPS WebSocket:', error);
                shouldReconnect = false;
            }
        };

        connectSocket();
    }

    updateCourierLocation(data) {
        const { courier_id, latitude, longitude } = data;
        
        // Update marker on map
        if (this.map && this.markers[courier_id]) {
            this.markers[courier_id].setPosition({ lat: latitude, lng: longitude });
        }

        // Update courier data
        const courier = this.couriers.find(c => c.id === courier_id);
        if (courier) {
            courier.latitude = latitude;
            courier.longitude = longitude;
            courier.last_seen = new Date().toISOString();
        }

        console.log(`📍 Updated location for courier ${courier_id}`);
    }

    render() {
        const container = document.getElementById('couriers');
        if (!container) return;

        const onlineCouriers = this.couriers.filter(c => c.status === 'online' || c.status === 'busy');
        const busyCouriers = this.couriers.filter(c => c.status === 'busy');
        const activeDeliveries = this.deliveries.filter(d => ['assigned', 'accepted', 'en_route', 'picked_up', 'delivering'].includes(d.status));

        container.innerHTML = `
            <div class="couriers-management">
                <!-- Header -->
                <div class="couriers-header">
                    <h2>🚴 Управление курьерами</h2>
                    <div class="couriers-actions">
                        <button class="btn btn-primary" onclick="couriersModule.showAddCourierForm()">
                            ➕ Добавить курьера
                        </button>
                        <button class="btn btn-secondary" onclick="couriersModule.refreshData()">
                            🔄 Обновить
                        </button>
                    </div>
                </div>

                <!-- Stats -->
                <div class="couriers-stats grid grid-4" style="margin-top: 1rem;">
                    <div class="card">
                        <h4>Всего курьеров</h4>
                        <div class="stat-value">${this.couriers.length}</div>
                    </div>
                    <div class="card">
                        <h4>🟢 Онлайн</h4>
                        <div class="stat-value text-success">${onlineCouriers.length}</div>
                    </div>
                    <div class="card">
                        <h4>📦 Занято</h4>
                        <div class="stat-value text-warning">${busyCouriers.length}</div>
                    </div>
                    <div class="card">
                        <h4>🚚 Активных доставок</h4>
                        <div class="stat-value">${activeDeliveries.length}</div>
                    </div>
                </div>

                <!-- Map and Couriers -->
                <div class="grid grid-2" style="margin-top: 1rem; gap: 1rem;">
                    <!-- Map -->
                    <div class="card">
                        <div class="card-header">
                            <h3>🗺️ Карта курьеров</h3>
                        </div>
                        <div id="couriersMap" style="height: 500px; width: 100%;"></div>
                    </div>

                    <!-- Couriers List -->
                    <div class="card">
                        <div class="card-header">
                            <h3>👥 Список курьеров</h3>
                        </div>
                        <div id="couriersList" style="max-height: 500px; overflow-y: auto;">
                            ${this.renderCouriersList()}
                        </div>
                    </div>
                </div>

                <!-- Active Deliveries -->
                <div class="card" style="margin-top: 1rem;">
                    <div class="card-header">
                        <h3>📦 Активные доставки</h3>
                    </div>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Заказ</th>
                                    <th>Курьер</th>
                                    <th>Клиент</th>
                                    <th>Адрес</th>
                                    <th>Сумма</th>
                                    <th>Статус</th>
                                    <th>Назначен</th>
                                    <th>Действия</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.renderDeliveriesRows()}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        // Initialize map
        setTimeout(() => this.initMap(), 100);
    }

    renderCouriersList() {
        if (this.couriers.length === 0) {
            return '<div class="empty-state">Нет курьеров</div>';
        }

        return this.couriers.map(courier => {
            const statusIcon = this.getStatusIcon(courier.status);
            const statusClass = this.getStatusClass(courier.status);

            return `
                <div class="courier-card ${statusClass}" style="padding: 1rem; border-bottom: 1px solid #eee;">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <h4 style="margin: 0;">${statusIcon} ${courier.name}</h4>
                            <p style="margin: 0.25rem 0; color: #666;">
                                📱 ${courier.phone}<br>
                                🚗 ${this.getVehicleIcon(courier.vehicle_type)} ${this.getVehicleType(courier.vehicle_type)}<br>
                                ⭐ ${courier.rating}/5.0 (${courier.total_deliveries} доставок)
                            </p>
                            <p style="margin: 0.25rem 0;">
                                <span class="badge badge-${statusClass}">${this.getStatusText(courier.status)}</span>
                                ${courier.active_deliveries > 0 ? `<span class="badge badge-warning">${courier.active_deliveries} активных</span>` : ''}
                            </p>
                        </div>
                        <div>
                            <button class="btn btn-small" onclick="couriersModule.showCourierDetails('${courier.id}')">
                                👁️ Детали
                            </button>
                            ${courier.status === 'online' ? `
                                <button class="btn btn-small btn-primary" onclick="couriersModule.showAssignForm('${courier.id}')">
                                    📦 Назначить
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderDeliveriesRows() {
        const active = this.deliveries.filter(d => 
            ['assigned', 'accepted', 'en_route', 'picked_up', 'delivering'].includes(d.status)
        );

        if (active.length === 0) {
            return '<tr><td colspan="8" style="text-align: center;">Нет активных доставок</td></tr>';
        }

        return active.map(delivery => {
            const statusClass = this.getDeliveryStatusClass(delivery.status);
            return `
                <tr>
                    <td><strong>#${delivery.order_number}</strong></td>
                    <td>${delivery.courier_name}<br><small>${delivery.courier_phone}</small></td>
                    <td>${delivery.customer_name}<br><small>${delivery.customer_phone}</small></td>
                    <td>${delivery.customer_address}</td>
                    <td>₽ ${parseFloat(delivery.total_amount).toFixed(2)}</td>
                    <td><span class="badge badge-${statusClass}">${this.getDeliveryStatusText(delivery.status)}</span></td>
                    <td>${this.formatDateTime(delivery.assigned_at)}</td>
                    <td>
                        <button class="btn btn-small" onclick="couriersModule.showDeliveryDetails('${delivery.id}')">
                            👁️
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    initMap() {
        const mapElement = document.getElementById('couriersMap');
        if (!mapElement) return;

        // Initialize Yandex Map (or Google Maps)
        // For now, show placeholder
        mapElement.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f0f0f0;">
                <div style="text-align: center;">
                    <h3>🗺️ Карта курьеров</h3>
                    <p>Здесь будет отображаться карта с позициями курьеров в реальном времени</p>
                    <p><small>Интеграция: Яндекс.Карты / Google Maps</small></p>
                    <div id="mapMarkers" style="margin-top: 1rem; text-align: left; max-width: 300px; margin: 1rem auto;">
                        ${this.couriers.filter(c => c.latitude && c.longitude).map(c => `
                            <div style="padding: 0.5rem; background: white; margin: 0.5rem 0; border-radius: 5px;">
                                📍 ${c.name}: ${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}
                            </div>
                        `).join('')}
                        ${this.couriers.filter(c => c.latitude && c.longitude).length === 0 ? 
                            '<div style="padding: 1rem; color: #999;">Нет данных о позициях курьеров</div>' : ''}
                    </div>
                </div>
            </div>
        `;

        // TODO: Implement real map integration
        // Example for Yandex Maps:
        // ymaps.ready(() => {
        //     this.map = new ymaps.Map('couriersMap', {
        //         center: [55.76, 37.64],
        //         zoom: 12
        //     });
        //     this.addCourierMarkers();
        // });
    }

    // ==================== FORMS ====================

    showAddCourierForm() {
        const modal = this.createModal('Добавить курьера', `
            <form id="addCourierForm">
                <div class="form-group">
                    <label class="form-label">ФИО *</label>
                    <input type="text" name="name" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Телефон *</label>
                    <input type="tel" name="phone" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Транспорт *</label>
                    <select name="vehicle_type" class="form-input" required>
                        <option value="bicycle">🚲 Велосипед</option>
                        <option value="scooter">🛴 Самокат/Мопед</option>
                        <option value="motorcycle">🏍️ Мотоцикл</option>
                        <option value="car">🚗 Автомобиль</option>
                        <option value="foot">🚶 Пешком</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Номер ТС</label>
                    <input type="text" name="vehicle_number" class="form-input">
                </div>
                <div class="form-group">
                    <label class="form-label">Примечания</label>
                    <textarea name="notes" class="form-input" rows="2"></textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="couriersModule.closeModal()">Отмена</button>
                    <button type="submit" class="btn btn-primary">💾 Сохранить</button>
                </div>
            </form>
        `);

        document.getElementById('addCourierForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitAddCourier(new FormData(e.target));
        });
    }

    async submitAddCourier(formData) {
        try {
            const data = Object.fromEntries(formData);
            
            const response = await fetch(this.API_BASE, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            if (result.success) {
                alert('✅ Курьер успешно добавлен!');
                this.closeModal();
                await this.refreshData();
            } else {
                alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
            }
        } catch (error) {
            console.error('Error adding courier:', error);
            alert('❌ Ошибка соединения с сервером');
        }
    }

    showAssignForm(courierId) {
        const courier = this.couriers.find(c => c.id === courierId);
        if (!courier) return;

        const modal = this.createModal(`Назначить заказ курьеру: ${courier.name}`, `
            <form id="assignForm">
                <input type="hidden" name="courier_id" value="${courierId}">
                <div class="form-group">
                    <label class="form-label">Заказ *</label>
                    <select name="order_id" class="form-input" required>
                        <option value="">Выберите заказ...</option>
                    </select>
                    <small class="form-text">Список неназначенных заказов</small>
                </div>
                <div class="form-group">
                    <label class="form-label">Стоимость доставки</label>
                    <input type="number" name="delivery_fee" class="form-input" step="0.01" min="0" value="0">
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="couriersModule.closeModal()">Отмена</button>
                    <button type="submit" class="btn btn-primary">📦 Назначить</button>
                </div>
            </form>
        `);

        // Load unassigned orders
        this.loadUnassignedOrders();

        document.getElementById('assignForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitAssign(new FormData(e.target));
        });
    }

    async loadUnassignedOrders() {
        try {
            const response = await fetch('/api/orders?status=pending', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            if (data.success) {
                const select = document.querySelector('select[name="order_id"]');
                select.innerHTML = '<option value="">Выберите заказ...</option>' +
                    data.data.filter(o => o.delivery_type === 'delivery').map(o => 
                        `<option value="${o.id}">#${o.order_number} - ${o.customer_name} - ₽${o.total_amount}</option>`
                    ).join('');
            }
        } catch (error) {
            console.error('Error loading orders:', error);
        }
    }

    async submitAssign(formData) {
        try {
            const data = Object.fromEntries(formData);
            const courierId = data.courier_id;
            
            const response = await fetch(`${this.API_BASE}/${courierId}/assign`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    order_id: data.order_id,
                    delivery_fee: parseFloat(data.delivery_fee) || 0
                })
            });

            const result = await response.json();
            if (result.success) {
                alert('✅ Заказ успешно назначен курьеру!');
                this.closeModal();
                await this.refreshData();
            } else {
                alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
            }
        } catch (error) {
            console.error('Error assigning order:', error);
            alert('❌ Ошибка соединения с сервером');
        }
    }

    showCourierDetails(courierId) {
        const courier = this.couriers.find(c => c.id === courierId);
        if (!courier) return;

        this.createModal(`Детали курьера: ${courier.name}`, `
            <div class="courier-details">
                <p><strong>ФИО:</strong> ${courier.name}</p>
                <p><strong>Телефон:</strong> ${courier.phone}</p>
                <p><strong>Транспорт:</strong> ${this.getVehicleType(courier.vehicle_type)}</p>
                <p><strong>Номер ТС:</strong> ${courier.vehicle_number || '-'}</p>
                <p><strong>Статус:</strong> <span class="badge badge-${this.getStatusClass(courier.status)}">${this.getStatusText(courier.status)}</span></p>
                <p><strong>Рейтинг:</strong> ⭐ ${courier.rating}/5.0</p>
                <p><strong>Всего доставок:</strong> ${courier.total_deliveries}</p>
                <p><strong>Сегодня доставок:</strong> ${courier.completed_today || 0}</p>
                <p><strong>Активных заказов:</strong> ${courier.active_deliveries || 0}</p>
            </div>
            <div class="form-actions">
                <button class="btn btn-secondary" onclick="couriersModule.closeModal()">Закрыть</button>
                <button class="btn btn-primary" onclick="couriersModule.showCourierStats('${courierId}')">📊 Статистика</button>
            </div>
        `);
    }

    showDeliveryDetails(deliveryId) {
        const delivery = this.deliveries.find(d => d.id === deliveryId);
        if (!delivery) return;

        this.createModal(`Детали доставки #${delivery.order_number}`, `
            <div class="delivery-details">
                <p><strong>Заказ:</strong> #${delivery.order_number}</p>
                <p><strong>Курьер:</strong> ${delivery.courier_name} (${delivery.courier_phone})</p>
                <p><strong>Клиент:</strong> ${delivery.customer_name}</p>
                <p><strong>Телефон:</strong> ${delivery.customer_phone}</p>
                <p><strong>Адрес:</strong> ${delivery.customer_address}</p>
                <p><strong>Сумма:</strong> ₽ ${parseFloat(delivery.total_amount).toFixed(2)}</p>
                <p><strong>Стоимость доставки:</strong> ₽ ${parseFloat(delivery.delivery_fee || 0).toFixed(2)}</p>
                <p><strong>Статус:</strong> <span class="badge badge-${this.getDeliveryStatusClass(delivery.status)}">${this.getDeliveryStatusText(delivery.status)}</span></p>
                <p><strong>Назначен:</strong> ${this.formatDateTime(delivery.assigned_at)}</p>
                ${delivery.picked_up_at ? `<p><strong>Забран:</strong> ${this.formatDateTime(delivery.picked_up_at)}</p>` : ''}
                ${delivery.delivered_at ? `<p><strong>Доставлен:</strong> ${this.formatDateTime(delivery.delivered_at)}</p>` : ''}
            </div>
        `);
    }

    async showCourierStats(courierId) {
        alert('📊 Статистика курьера в разработке');
        // TODO: Load and display courier statistics
    }

    async refreshData() {
        await this.loadCouriers();
        await this.loadDeliveries();
        this.render();
    }

    // ==================== HELPERS ====================

    getStatusIcon(status) {
        const icons = {
            'online': '🟢',
            'busy': '🟡',
            'offline': '⚪',
            'break': '☕'
        };
        return icons[status] || '⚪';
    }

    getStatusClass(status) {
        const classes = {
            'online': 'success',
            'busy': 'warning',
            'offline': 'secondary',
            'break': 'info'
        };
        return classes[status] || 'secondary';
    }

    getStatusText(status) {
        const texts = {
            'online': 'Онлайн',
            'busy': 'Занят',
            'offline': 'Офлайн',
            'break': 'Перерыв'
        };
        return texts[status] || status;
    }

    getVehicleIcon(type) {
        const icons = {
            'bicycle': '🚲',
            'scooter': '🛴',
            'motorcycle': '🏍️',
            'car': '🚗',
            'foot': '🚶'
        };
        return icons[type] || '🚗';
    }

    getVehicleType(type) {
        const types = {
            'bicycle': 'Велосипед',
            'scooter': 'Самокат/Мопед',
            'motorcycle': 'Мотоцикл',
            'car': 'Автомобиль',
            'foot': 'Пешком'
        };
        return types[type] || type;
    }

    getDeliveryStatusClass(status) {
        const classes = {
            'assigned': 'secondary',
            'accepted': 'info',
            'en_route': 'warning',
            'picked_up': 'warning',
            'delivering': 'warning',
            'delivered': 'success',
            'cancelled': 'danger'
        };
        return classes[status] || 'secondary';
    }

    getDeliveryStatusText(status) {
        const texts = {
            'assigned': 'Назначен',
            'accepted': 'Принят',
            'en_route': 'В пути к ресторану',
            'picked_up': 'Забрал заказ',
            'delivering': 'Везёт клиенту',
            'delivered': 'Доставлен',
            'cancelled': 'Отменён'
        };
        return texts[status] || status;
    }

    formatDateTime(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleString('ru-RU');
    }

    createModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="couriersModule.closeModal()">×</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    }

    closeModal() {
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            modal.remove();
        }
    }

    destroy() {
        if (this.socket) {
            try {
                this.socket.emit('admin-unsubscribe');
            } catch (e) {
                // Ignore errors during cleanup
            }
            this.socket.disconnect();
            this.socket = null;
        }
    }
}

// Initialize module
if (typeof window !== 'undefined') {
    window.CouriersManagementModule = CouriersManagementModule;
    window.couriersModule = new CouriersManagementModule();
}

