/**
 * Модуль доставки для сайта и кассы
 * Управление заказами, зонами доставки, статусами, интеграция с курьерами
 */

class DeliveryModule {
    constructor() {
        this.deliveryZones = [];
        this.orders = [];
        this.couriers = [];
        this.currentOrder = null;
        this.init();
    }

    init() {
        this.loadDeliverySettings();
        this.loadDeliveryZones();
        this.setupEventListeners();
    }

    // Настройки доставки
    loadDeliverySettings() {
        const settings = JSON.parse(localStorage.getItem('deliverySettings') || '{}');
        this.settings = {
            minOrderAmount: settings.minOrderAmount || 500,
            freeDeliveryThreshold: settings.freeDeliveryThreshold || 1500,
            deliveryTime: settings.deliveryTime || 60,
            workingHours: settings.workingHours || { start: '10:00', end: '23:00' },
            ...settings
        };
    }

    // Загрузка зон доставки
    loadDeliveryZones() {
        const zones = JSON.parse(localStorage.getItem('deliveryZones') || '[]');
        this.deliveryZones = zones.length > 0 ? zones : this.getDefaultZones();
    }

    // Зоны доставки по умолчанию
    getDefaultZones() {
        return [
            {
                id: 'zone_1',
                name: 'Немчиновка центр',
                radius: 2,
                deliveryPrice: 0,
                freeDeliveryThreshold: 1000,
                deliveryTime: 30,
                coordinates: { lat: 55.7558, lng: 37.6176 }
            },
            {
                id: 'zone_2',
                name: 'Немчиновка окраина',
                radius: 5,
                deliveryPrice: 200,
                freeDeliveryThreshold: 1500,
                deliveryTime: 45,
                coordinates: { lat: 55.7558, lng: 37.6176 }
            },
            {
                id: 'zone_3',
                name: 'Соседние поселки',
                radius: 10,
                deliveryPrice: 300,
                freeDeliveryThreshold: 2000,
                deliveryTime: 60,
                coordinates: { lat: 55.7558, lng: 37.6176 }
            }
        ];
    }

    // Создание заказа на доставку
    async createDeliveryOrder(orderData) {
        const order = {
            id: this.generateOrderId(),
            type: 'delivery',
            status: 'pending',
            createdAt: new Date().toISOString(),
            customer: {
                name: orderData.customerName,
                phone: orderData.customerPhone,
                email: orderData.customerEmail,
                address: orderData.deliveryAddress,
                coordinates: orderData.coordinates
            },
            items: orderData.items,
            total: orderData.total,
            delivery: {
                zone: this.calculateDeliveryZone(orderData.coordinates),
                price: 0,
                time: 60,
                courier: null
            },
            payment: {
                method: orderData.paymentMethod || 'cash',
                status: 'pending',
                transactionId: null
            },
            timeline: [
                {
                    status: 'pending',
                    timestamp: new Date().toISOString(),
                    description: 'Заказ создан'
                }
            ]
        };

        // Расчет стоимости доставки
        order.delivery.price = this.calculateDeliveryPrice(order);
        order.total += order.delivery.price;

        // Сохранение заказа
        this.orders.push(order);
        this.saveOrders();

        // Уведомление кассы о новом заказе
        this.notifyPOS(order);

        return { success: true, order: order };
    }

    // Создание заказа на самовывоз
    async createPickupOrder(orderData) {
        const order = {
            id: this.generateOrderId(),
            type: 'pickup',
            status: 'pending',
            createdAt: new Date().toISOString(),
            customer: {
                name: orderData.customerName,
                phone: orderData.customerPhone,
                email: orderData.customerEmail
            },
            items: orderData.items,
            total: orderData.total,
            pickup: {
                time: orderData.pickupTime || this.calculatePickupTime(),
                location: 'Ресторан ДЭНДИ'
            },
            payment: {
                method: orderData.paymentMethod || 'cash',
                status: 'pending',
                transactionId: null
            },
            timeline: [
                {
                    status: 'pending',
                    timestamp: new Date().toISOString(),
                    description: 'Заказ создан'
                }
            ]
        };

        this.orders.push(order);
        this.saveOrders();

        this.notifyPOS(order);

        return { success: true, order: order };
    }

    // Расчет зоны доставки
    calculateDeliveryZone(coordinates) {
        if (!coordinates) return null;

        for (const zone of this.deliveryZones) {
            const distance = this.calculateDistance(
                coordinates,
                zone.coordinates
            );
            
            if (distance <= zone.radius) {
                return zone;
            }
        }

        return null; // Вне зоны доставки
    }

    // Расчет стоимости доставки
    calculateDeliveryPrice(order) {
        if (order.type !== 'delivery' || !order.delivery.zone) {
            return 0;
        }

        const zone = order.delivery.zone;
        
        // Бесплатная доставка при превышении порога
        if (order.total >= zone.freeDeliveryThreshold) {
            return 0;
        }

        return zone.deliveryPrice;
    }

    // Расчет времени самовывоза
    calculatePickupTime() {
        const now = new Date();
        const workingStart = new Date();
        workingStart.setHours(10, 0, 0, 0);
        
        if (now < workingStart) {
            return workingStart.toISOString();
        }

        // Добавляем 30 минут к текущему времени
        const pickupTime = new Date(now.getTime() + 30 * 60000);
        return pickupTime.toISOString();
    }

    // Расчет расстояния между координатами
    calculateDistance(coord1, coord2) {
        const R = 6371; // Радиус Земли в км
        const dLat = this.toRad(coord2.lat - coord1.lat);
        const dLon = this.toRad(coord2.lng - coord1.lng);
        const lat1 = this.toRad(coord1.lat);
        const lat2 = this.toRad(coord2.lat);

        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;

        return distance;
    }

    // Преобразование в радианы
    toRad(deg) {
        return deg * (Math.PI/180);
    }

    // Обновление статуса заказа
    async updateOrderStatus(orderId, newStatus, description = '') {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) {
            return { success: false, error: 'Заказ не найден' };
        }

        const oldStatus = order.status;
        order.status = newStatus;
        
        // Добавление в timeline
        order.timeline.push({
            status: newStatus,
            timestamp: new Date().toISOString(),
            description: description || this.getStatusDescription(newStatus)
        });

        // Специальная логика для определенных статусов
        switch (newStatus) {
            case 'preparing':
                order.delivery.time = this.calculateDeliveryTime(order);
                break;
            case 'ready':
                if (order.type === 'pickup') {
                    this.notifyCustomerReady(order);
                }
                break;
            case 'out_for_delivery':
                this.assignCourier(order);
                break;
            case 'delivered':
                this.completeOrder(order);
                break;
            case 'cancelled':
                this.handleCancellation(order);
                break;
        }

        this.saveOrders();
        this.notifyStatusChange(order, oldStatus, newStatus);

        return { success: true, order: order };
    }

    // Получение описания статуса
    getStatusDescription(status) {
        const descriptions = {
            'pending': 'Заказ ожидает обработки',
            'confirmed': 'Заказ подтвержден',
            'preparing': 'Заказ готовится',
            'ready': 'Заказ готов',
            'out_for_delivery': 'Заказ в пути',
            'delivered': 'Заказ доставлен',
            'cancelled': 'Заказ отменен',
            'completed': 'Заказ завершен'
        };
        return descriptions[status] || 'Статус изменен';
    }

    // Расчет времени доставки
    calculateDeliveryTime(order) {
        if (order.type !== 'delivery' || !order.delivery.zone) {
            return 60;
        }

        return order.delivery.zone.deliveryTime;
    }

    // Назначение курьера
    assignCourier(order) {
        const availableCouriers = this.couriers.filter(c => c.status === 'available');
        
        if (availableCouriers.length > 0) {
            const courier = availableCouriers[0];
            order.delivery.courier = courier.id;
            courier.status = 'busy';
            courier.currentOrder = order.id;
        }
    }

    // Уведомление клиента о готовности
    notifyCustomerReady(order) {
        if (order.customer.phone) {
            this.sendSMS(order.customer.phone, `Ваш заказ №${order.id} готов к получению!`);
        }
        
        if (order.customer.email) {
            this.sendEmail(order.customer.email, 'Заказ готов', `Ваш заказ №${order.id} готов к получению!`);
        }
    }

    // Завершение заказа
    completeOrder(order) {
        order.status = 'completed';
        order.timeline.push({
            status: 'completed',
            timestamp: new Date().toISOString(),
            description: 'Заказ завершен'
        });

        // Освобождение курьера
        if (order.delivery.courier) {
            const courier = this.couriers.find(c => c.id === order.delivery.courier);
            if (courier) {
                courier.status = 'available';
                courier.currentOrder = null;
            }
        }
    }

    // Обработка отмены заказа
    handleCancellation(order) {
        // Освобождение курьера
        if (order.delivery.courier) {
            const courier = this.couriers.find(c => c.id === order.delivery.courier);
            if (courier) {
                courier.status = 'available';
                courier.currentOrder = null;
            }
        }

        // Возврат средств если оплата была онлайн
        if (order.payment.method === 'online' && order.payment.status === 'paid') {
            this.processRefund(order);
        }
    }

    // Обработка возврата
    async processRefund(order) {
        // Интеграция с модулем эквайринга для возврата
        if (window.acquiringModule) {
            await window.acquiringModule.processRefund({
                originalTransactionId: order.payment.transactionId,
                amount: order.total,
                reason: 'Отмена заказа'
            });
        }
    }

    // Уведомление кассы о новом заказе
    notifyPOS(order) {
        const event = new CustomEvent('newOrder', {
            detail: { order: order }
        });
        document.dispatchEvent(event);
    }

    // Уведомление об изменении статуса
    notifyStatusChange(order, oldStatus, newStatus) {
        const event = new CustomEvent('orderStatusChanged', {
            detail: { order: order, oldStatus: oldStatus, newStatus: newStatus }
        });
        document.dispatchEvent(event);
    }

    // Поиск заказов
    searchOrders(query) {
        return this.orders.filter(order => 
            order.id.includes(query) ||
            order.customer.name.toLowerCase().includes(query.toLowerCase()) ||
            order.customer.phone.includes(query) ||
            order.items.some(item => item.name.toLowerCase().includes(query.toLowerCase()))
        );
    }

    // Фильтрация заказов
    filterOrders(filters) {
        let filteredOrders = this.orders;

        if (filters.status) {
            filteredOrders = filteredOrders.filter(order => order.status === filters.status);
        }

        if (filters.type) {
            filteredOrders = filteredOrders.filter(order => order.type === filters.type);
        }

        if (filters.dateFrom) {
            filteredOrders = filteredOrders.filter(order => 
                new Date(order.createdAt) >= new Date(filters.dateFrom)
            );
        }

        if (filters.dateTo) {
            filteredOrders = filteredOrders.filter(order => 
                new Date(order.createdAt) <= new Date(filters.dateTo)
            );
        }

        return filteredOrders;
    }

    // Отправка SMS
    async sendSMS(phone, message) {
        console.log(`SMS на ${phone}: ${message}`);
        // Интеграция с SMS-сервисом
        return { success: true };
    }

    // Отправка email
    async sendEmail(email, subject, message) {
        console.log(`Email на ${email}: ${subject} - ${message}`);
        // Интеграция с email-сервисом
        return { success: true };
    }

    // Сохранение заказов
    saveOrders() {
        localStorage.setItem('deliveryOrders', JSON.stringify(this.orders));
    }

    // Загрузка заказов
    loadOrders() {
        const orders = JSON.parse(localStorage.getItem('deliveryOrders') || '[]');
        this.orders = orders;
    }

    // Генерация ID заказа
    generateOrderId() {
        return `ORD_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }

    // Настройка обработчиков событий
    setupEventListeners() {
        // Обработка новых заказов
        document.addEventListener('newOrder', (event) => {
            console.log('Новый заказ:', event.detail.order);
        });

        // Обработка изменения статуса
        document.addEventListener('orderStatusChanged', (event) => {
            console.log('Статус заказа изменен:', event.detail);
        });
    }
}

// Экспорт модуля
window.DeliveryModule = DeliveryModule;
