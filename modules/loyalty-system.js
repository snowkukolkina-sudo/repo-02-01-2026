/**
 * СИСТЕМА ЛОЯЛЬНОСТИ
 * Бонусы, скидки, реферальная программа
 */

class LoyaltySystem {
    constructor() {
        this.config = {
            bonusRate: 0.05, // 5% от суммы заказа
            bonusToRublesRate: 1, // 1 бонус = 1 рубль
            maxBonusUsage: 0.3, // Можно использовать максимум 30% от суммы
            referralBonus: 500, // Бонус за приглашение друга
            birthdayBonus: 1000, // Бонус в день рождения
            
            levels: [
                { name: 'Новичок', minOrders: 0, discount: 0 },
                { name: 'Друг', minOrders: 5, discount: 0.03 },
                { name: 'VIP', minOrders: 20, discount: 0.05 },
                { name: 'Легенда', minOrders: 50, discount: 0.10 }
            ]
        };
        
        this.customers = new Map();
        this.init();
    }

    init() {
        console.log('🎁 Система лояльности инициализирована');
        this.loadCustomers();
    }

    // ===== УПРАВЛЕНИЕ КЛИЕНТАМИ =====
    
    async registerCustomer(phone, data = {}) {
        const customer = {
            phone,
            name: data.name || '',
            email: data.email || '',
            birthday: data.birthday || null,
            bonuses: 0,
            totalOrders: 0,
            totalSpent: 0,
            level: 'Новичок',
            registeredAt: new Date().toISOString(),
            referralCode: this.generateReferralCode(phone),
            referredBy: data.referredBy || null
        };

        this.customers.set(phone, customer);
        await this.saveCustomer(customer);

        // Бонус за регистрацию
        if (data.referredBy) {
            await this.applyReferralBonus(data.referredBy, phone);
        }

        console.log('✅ Клиент зарегистрирован:', phone);
        return customer;
    }

    async getCustomer(phone) {
        if (!this.customers.has(phone)) {
            const saved = await this.loadCustomer(phone);
            if (saved) {
                this.customers.set(phone, saved);
            } else {
                return null;
            }
        }
        return this.customers.get(phone);
    }

    // ===== БОНУСЫ =====
    
    async addBonusesForOrder(phone, orderAmount) {
        const customer = await this.getCustomer(phone);
        if (!customer) return 0;

        const bonuses = Math.floor(orderAmount * this.config.bonusRate);
        customer.bonuses += bonuses;
        customer.totalOrders++;
        customer.totalSpent += orderAmount;

        // Обновляем уровень
        this.updateCustomerLevel(customer);

        await this.saveCustomer(customer);
        
        console.log(`💰 Начислено ${bonuses} бонусов клиенту ${phone}`);
        return bonuses;
    }

    async useBonuses(phone, orderAmount, bonusesToUse) {
        const customer = await this.getCustomer(phone);
        if (!customer) return 0;

        const maxUsage = Math.floor(orderAmount * this.config.maxBonusUsage);
        const actualUsage = Math.min(bonusesToUse, customer.bonuses, maxUsage);

        customer.bonuses -= actualUsage;
        await this.saveCustomer(customer);

        console.log(`✅ Использовано ${actualUsage} бонусов`);
        return actualUsage;
    }

    async applyBirthdayBonus(phone) {
        const customer = await this.getCustomer(phone);
        if (!customer || !customer.birthday) return false;

        const today = new Date();
        const birthday = new Date(customer.birthday);

        if (today.getMonth() === birthday.getMonth() && 
            today.getDate() === birthday.getDate()) {
            
            customer.bonuses += this.config.birthdayBonus;
            await this.saveCustomer(customer);
            
            console.log(`🎂 Начислен бонус ко дню рождения: ${this.config.birthdayBonus}`);
            return true;
        }

        return false;
    }

    // ===== РЕФЕРАЛЬНАЯ ПРОГРАММА =====
    
    generateReferralCode(phone) {
        return 'DANDY' + phone.slice(-6);
    }

    async applyReferralBonus(referrerCode, newCustomerPhone) {
        // Найти реферера по коду
        const referrer = Array.from(this.customers.values())
            .find(c => c.referralCode === referrerCode);

        if (referrer) {
            referrer.bonuses += this.config.referralBonus;
            await this.saveCustomer(referrer);
            
            console.log(`🎁 Реферальный бонус ${this.config.referralBonus} для ${referrer.phone}`);
            return true;
        }

        return false;
    }

    // ===== УРОВНИ =====
    
    updateCustomerLevel(customer) {
        for (let i = this.config.levels.length - 1; i >= 0; i--) {
            if (customer.totalOrders >= this.config.levels[i].minOrders) {
                customer.level = this.config.levels[i].name;
                customer.discount = this.config.levels[i].discount;
                break;
            }
        }
    }

    getCustomerDiscount(customer) {
        const level = this.config.levels.find(l => l.name === customer.level);
        return level ? level.discount : 0;
    }

    // ===== СОХРАНЕНИЕ =====
    
    loadCustomers() {
        try {
            const data = localStorage.getItem('loyalty_customers');
            if (data) {
                const customers = JSON.parse(data);
                customers.forEach(c => this.customers.set(c.phone, c));
                console.log(`📊 Загружено клиентов: ${customers.length}`);
            }
        } catch (error) {
            console.error('Ошибка загрузки клиентов:', error);
        }
    }

    async loadCustomer(phone) {
        try {
            const response = await fetch(`/api/loyalty/customers/${phone}`);
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('Ошибка загрузки клиента:', error);
        }
        return null;
    }

    async saveCustomer(customer) {
        try {
            // Сохраняем в localStorage
            const all = Array.from(this.customers.values());
            localStorage.setItem('loyalty_customers', JSON.stringify(all));

            // Отправляем на сервер
            await fetch('/api/loyalty/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(customer)
            });
        } catch (error) {
            console.error('Ошибка сохранения клиента:', error);
        }
    }

    // ===== ИНТЕРФЕЙС =====
    
    showCustomerInfo(phone) {
        const customer = this.customers.get(phone);
        if (!customer) {
            alert('Клиент не найден');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <h2>🎁 ${customer.name || customer.phone}</h2>
                
                <div class="loyalty-info">
                    <div class="info-card" style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                        <h3 style="margin: 0 0 10px 0;">Уровень: ${customer.level}</h3>
                        <div style="font-size: 32px; font-weight: bold;">${customer.bonuses} бонусов</div>
                        <div style="opacity: 0.9; margin-top: 10px;">
                            = ${customer.bonuses * this.config.bonusToRublesRate}₽
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                        <div class="stat-box" style="background: #f0f9ff; padding: 15px; border-radius: 8px;">
                            <div style="font-size: 24px; font-weight: bold; color: #0369a1;">${customer.totalOrders}</div>
                            <div style="color: #666;">Заказов</div>
                        </div>
                        <div class="stat-box" style="background: #f0fdf4; padding: 15px; border-radius: 8px;">
                            <div style="font-size: 24px; font-weight: bold; color: #15803d;">${customer.totalSpent}₽</div>
                            <div style="color: #666;">Потрачено</div>
                        </div>
                    </div>

                    <div style="background: #fffbeb; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <strong>📱 Реферальный код:</strong>
                        <div style="font-size: 20px; font-weight: bold; color: #92400e; margin-top: 5px;">
                            ${customer.referralCode}
                        </div>
                        <div style="font-size: 12px; color: #666; margin-top: 5px;">
                            Поделитесь с друзьями и получите ${this.config.referralBonus} бонусов!
                        </div>
                    </div>

                    ${customer.discount > 0 ? `
                        <div style="background: #dcfce7; padding: 15px; border-radius: 8px;">
                            <strong>🎉 Ваша скидка:</strong>
                            <div style="font-size: 20px; font-weight: bold; color: #15803d;">
                                ${(customer.discount * 100).toFixed(0)}%
                            </div>
                        </div>
                    ` : ''}
                </div>

                <button class="btn" onclick="this.closest('.modal-overlay').remove()">Закрыть</button>
            </div>
        `;

        document.body.appendChild(modal);
    }
}

// Экспорт
window.LoyaltySystem = LoyaltySystem;
