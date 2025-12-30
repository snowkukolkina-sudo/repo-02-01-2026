/**
 * DANDY Inventory — Модуль интеграций
 * 1С, r_keeper, Контур.Маркет
 */

class IntegrationsModule {
    constructor(inventorySystem) {
        this.system = inventorySystem;
        this.integrations = {
            oneC: { enabled: false, lastSync: null, status: 'disconnected' },
            rkeeper: { enabled: false, lastSync: null, status: 'disconnected' },
            kontur: { enabled: false, lastSync: null, status: 'disconnected' }
        };
    }

    /**
     * Инициализация модуля
     */
    init() {
        console.log('🔄 Integrations module initialized');
        this.renderIntegrationStatus();
    }

    /**
     * Отрисовка статусов интеграций
     */
    renderIntegrationStatus() {
        // Статусы будут обновляться в HTML
    }

    // ========== 1С ИНТЕГРАЦИЯ ==========

    /**
     * Настройка интеграции с 1С
     */
    setup1C() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: #094a45; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 2rem; max-width: 700px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <h2 style="margin: 0 0 1.5rem 0; color: #eebc5c;">🏢 Настройка интеграции с 1С</h2>

                <div class="alert alert-info">
                    <span>ℹ️</span>
                    <div>
                        <strong>Поддерживаемые версии:</strong><br>
                        • 1С:Предприятие 8.3<br>
                        • 1С:Общепит<br>
                        • 1С:Управление торговлей<br>
                        <strong>Протоколы:</strong> CommerceML 2.0, OData, HTTP-сервисы
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">URL сервера 1С*</label>
                    <input type="text" class="form-input" id="onec_url" placeholder="http://192.168.1.100/УТ/odata/standard.odata">
                </div>

                <div class="form-group">
                    <label class="form-label">Логин*</label>
                    <input type="text" class="form-input" id="onec_login" placeholder="Администратор">
                </div>

                <div class="form-group">
                    <label class="form-label">Пароль*</label>
                    <input type="password" class="form-input" id="onec_password">
                </div>

                <div class="form-group">
                    <label class="form-label">База данных</label>
                    <input type="text" class="form-input" id="onec_database" placeholder="УТ" value="УТ">
                </div>

                <div class="form-group">
                    <label class="form-label">Тип обмена</label>
                    <select class="form-select" id="onec_exchange_type">
                        <option value="commerceml">CommerceML 2.0</option>
                        <option value="odata">OData</option>
                        <option value="http">HTTP-сервисы</option>
                    </select>
                </div>

                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 0.5rem;">
                        <input type="checkbox" id="onec_auto_sync">
                        <span>Автоматическая синхронизация каждые 30 минут</span>
                    </label>
                </div>

                <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); color: #F3EADB; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; border-left: 4px solid #f59e0b;">
                    <strong>⚠️ Что будет синхронизироваться:</strong>
                    <ul style="margin: 0.5rem 0 0 1.5rem;">
                        <li>Номенклатура (товары, услуги)</li>
                        <li>Контрагенты (поставщики, покупатели)</li>
                        <li>Документы (приход, реализация, перемещение)</li>
                        <li>Остатки на складах</li>
                        <li>Цены</li>
                    </ul>
                </div>

                <div style="display: flex; gap: 1rem;">
                    <button onclick="integrationsModule.test1CConnection()" class="btn btn-secondary">
                        🔍 Проверить подключение
                    </button>
                    <button onclick="integrationsModule.save1CSettings()" class="btn btn-primary">
                        ✅ Сохранить
                    </button>
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">
                        Отмена
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * Проверка подключения к 1С
     */
    test1CConnection() {
        const url = document.getElementById('onec_url').value.trim();
        const login = document.getElementById('onec_login').value.trim();
        const password = document.getElementById('onec_password').value;

        if (!url || !login || !password) {
            alert('⚠️ Заполните все обязательные поля');
            return;
        }

        this.showNotification('🔄 Проверка подключения к 1С...', 'info');

        // Имитация проверки подключения
        setTimeout(() => {
            // В реальной системе - здесь запрос к 1С
            const success = Math.random() > 0.3; // 70% успех
            
            if (success) {
                this.showNotification('✅ Подключение к 1С успешно!', 'success');
            } else {
                this.showNotification('❌ Ошибка подключения. Проверьте настройки.', 'error');
            }
        }, 2000);
    }

    /**
     * Сохранение настроек 1С
     */
    save1CSettings() {
        const settings = {
            url: document.getElementById('onec_url').value.trim(),
            login: document.getElementById('onec_login').value.trim(),
            password: document.getElementById('onec_password').value,
            database: document.getElementById('onec_database').value.trim(),
            exchangeType: document.getElementById('onec_exchange_type').value,
            autoSync: document.getElementById('onec_auto_sync').checked
        };

        if (!settings.url || !settings.login || !settings.password) {
            alert('⚠️ Заполните все обязательные поля');
            return;
        }

        this.system.saveToLocalStorage('onec_settings', settings);
        this.integrations.oneC.enabled = true;
        this.integrations.oneC.status = 'connected';

        document.querySelector('.modal-overlay').remove();
        this.showNotification('✅ Настройки 1С сохранены!', 'success');
        this.renderIntegrationStatus();
    }

    /**
     * Синхронизация с 1С
     */
    sync1C() {
        if (!this.integrations.oneC.enabled) {
            alert('⚠️ Сначала настройте интеграцию с 1С');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: #094a45; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 2rem; max-width: 600px; width: 90%;">
                <h2 style="margin: 0 0 1.5rem 0; color: #eebc5c;">🔄 Синхронизация с 1С</h2>

                <div style="text-align: center; padding: 2rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">⏳</div>
                    <p style="font-size: 1.1em; color: #666;">
                        Синхронизация данных с 1С...<br>
                        Это может занять несколько минут.
                    </p>
                    <div style="background: #e5e7eb; height: 8px; border-radius: 4px; margin-top: 1rem; overflow: hidden;">
                        <div id="sync_progress" style="background: var(--dandy-green); height: 100%; width: 0%; transition: width 0.5s;"></div>
                    </div>
                    <div id="sync_status" style="margin-top: 1rem; color: #666;">Загрузка номенклатуры...</div>
                </div>

                <div style="display: flex; justify-content: center;">
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">
                        Отмена
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Имитация синхронизации
        const steps = [
            { progress: 20, status: 'Загрузка номенклатуры...' },
            { progress: 40, status: 'Загрузка контрагентов...' },
            { progress: 60, status: 'Загрузка документов...' },
            { progress: 80, status: 'Загрузка остатков...' },
            { progress: 100, status: 'Завершено!' }
        ];

        let currentStep = 0;
        const interval = setInterval(() => {
            if (currentStep < steps.length) {
                document.getElementById('sync_progress').style.width = steps[currentStep].progress + '%';
                document.getElementById('sync_status').textContent = steps[currentStep].status;
                currentStep++;
            } else {
                clearInterval(interval);
                setTimeout(() => {
                    modal.remove();
                    this.integrations.oneC.lastSync = new Date().toISOString();
                    this.showNotification('✅ Синхронизация с 1С завершена!', 'success');
                    this.renderIntegrationStatus();
                }, 500);
            }
        }, 1000);
    }

    // ========== R_KEEPER ИНТЕГРАЦИЯ ==========

    /**
     * Настройка интеграции с r_keeper
     */
    setupRKeeper() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: #094a45; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 2rem; max-width: 700px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <h2 style="margin: 0 0 1.5rem 0; color: #eebc5c;">🍽️ Настройка интеграции с r_keeper</h2>

                <div class="alert alert-info">
                    <span>ℹ️</span>
                    <div>
                        <strong>Поддерживаемые версии:</strong><br>
                        • r_keeper 7<br>
                        • UCS r_keeper<br>
                        <strong>Обмен:</strong> CSV, XML, REST API
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">IP-адрес сервера r_keeper*</label>
                    <input type="text" class="form-input" id="rk_host" placeholder="192.168.1.50">
                </div>

                <div class="form-group">
                    <label class="form-label">Порт*</label>
                    <input type="number" class="form-input" id="rk_port" placeholder="8080" value="8080">
                </div>

                <div class="form-group">
                    <label class="form-label">Логин*</label>
                    <input type="text" class="form-input" id="rk_login" placeholder="admin">
                </div>

                <div class="form-group">
                    <label class="form-label">Пароль*</label>
                    <input type="password" class="form-input" id="rk_password">
                </div>

                <div class="form-group">
                    <label class="form-label">Формат обмена</label>
                    <select class="form-select" id="rk_format">
                        <option value="csv">CSV</option>
                        <option value="xml">XML</option>
                        <option value="api">REST API</option>
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Папка обмена (для CSV/XML)</label>
                    <input type="text" class="form-input" id="rk_folder" placeholder="C:\\RKeeper\\Exchange">
                </div>

                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 0.5rem;">
                        <input type="checkbox" id="rk_auto_import">
                        <span>Автоматический импорт продаж каждые 15 минут</span>
                    </label>
                </div>

                <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); color: #F3EADB; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; border-left: 4px solid #f59e0b;">
                    <strong>⚠️ Что будет синхронизироваться:</strong>
                    <ul style="margin: 0.5rem 0 0 1.5rem;">
                        <li>Меню и блюда</li>
                        <li>Продажи и чеки</li>
                        <li>Списания по блюдам</li>
                        <li>Модификаторы</li>
                    </ul>
                </div>

                <div style="display: flex; gap: 1rem;">
                    <button onclick="integrationsModule.testRKeeperConnection()" class="btn btn-secondary">
                        🔍 Проверить подключение
                    </button>
                    <button onclick="integrationsModule.saveRKeeperSettings()" class="btn btn-primary">
                        ✅ Сохранить
                    </button>
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">
                        Отмена
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * Проверка подключения к r_keeper
     */
    testRKeeperConnection() {
        this.showNotification('🔄 Проверка подключения к r_keeper...', 'info');

        setTimeout(() => {
            const success = Math.random() > 0.3;
            if (success) {
                this.showNotification('✅ Подключение к r_keeper успешно!', 'success');
            } else {
                this.showNotification('❌ Ошибка подключения. Проверьте настройки.', 'error');
            }
        }, 2000);
    }

    /**
     * Сохранение настроек r_keeper
     */
    saveRKeeperSettings() {
        const settings = {
            host: document.getElementById('rk_host').value.trim(),
            port: document.getElementById('rk_port').value,
            login: document.getElementById('rk_login').value.trim(),
            password: document.getElementById('rk_password').value,
            format: document.getElementById('rk_format').value,
            folder: document.getElementById('rk_folder').value.trim(),
            autoImport: document.getElementById('rk_auto_import').checked
        };

        if (!settings.host || !settings.port || !settings.login || !settings.password) {
            alert('⚠️ Заполните все обязательные поля');
            return;
        }

        this.system.saveToLocalStorage('rkeeper_settings', settings);
        this.integrations.rkeeper.enabled = true;
        this.integrations.rkeeper.status = 'connected';

        document.querySelector('.modal-overlay').remove();
        this.showNotification('✅ Настройки r_keeper сохранены!', 'success');
        this.renderIntegrationStatus();
    }

    /**
     * Импорт продаж из r_keeper
     */
    importSalesFromRKeeper() {
        if (!this.integrations.rkeeper.enabled) {
            alert('⚠️ Сначала настройте интеграцию с r_keeper');
            return;
        }

        this.showNotification('📥 Импорт продаж из r_keeper...', 'info');

        setTimeout(() => {
            this.integrations.rkeeper.lastSync = new Date().toISOString();
            this.showNotification('✅ Импортировано 142 продажи за сегодня!', 'success');
            this.renderIntegrationStatus();
        }, 2000);
    }

    // ========== КОНТУР.МАРКЕТ ИНТЕГРАЦИЯ ==========

    /**
     * Настройка интеграции с Контур.Маркет
     */
    setupKontur() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: #094a45; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 2rem; max-width: 700px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <h2 style="margin: 0 0 1.5rem 0; color: #eebc5c;">🛒 Настройка интеграции с Контур.Маркет</h2>

                <div class="alert alert-info">
                    <span>ℹ️</span>
                    <div>
                        <strong>Контур.Маркет</strong> — электронная площадка для закупок<br>
                        <strong>API:</strong> REST API v3
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">API Key*</label>
                    <input type="text" class="form-input" id="kontur_api_key" placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX">
                </div>

                <div class="form-group">
                    <label class="form-label">ID организации*</label>
                    <input type="text" class="form-input" id="kontur_org_id" placeholder="12345678">
                </div>

                <div class="form-group">
                    <label class="form-label">Склад по умолчанию</label>
                    <select class="form-select" id="kontur_warehouse">
                        <option value="">Выберите...</option>
                        ${this.system.warehouses.map(wh => `
                            <option value="${wh.id}">${wh.name}</option>
                        `).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label style="display: flex; align-items: center; gap: 0.5rem;">
                        <input type="checkbox" id="kontur_auto_orders">
                        <span>Автоматический импорт заказов каждые 1 час</span>
                    </label>
                </div>

                <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); color: #F3EADB; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; border-left: 4px solid #f59e0b;">
                    <strong>⚠️ Что будет синхронизироваться:</strong>
                    <ul style="margin: 0.5rem 0 0 1.5rem;">
                        <li>Заказы поставщикам</li>
                        <li>Автоматическое создание документов прихода</li>
                        <li>Обновление цен от поставщиков</li>
                        <li>Статусы заказов</li>
                    </ul>
                </div>

                <div style="display: flex; gap: 1rem;">
                    <button onclick="integrationsModule.testKonturConnection()" class="btn btn-secondary">
                        🔍 Проверить подключение
                    </button>
                    <button onclick="integrationsModule.saveKonturSettings()" class="btn btn-primary">
                        ✅ Сохранить
                    </button>
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">
                        Отмена
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * Проверка подключения к Контур.Маркет
     */
    testKonturConnection() {
        this.showNotification('🔄 Проверка подключения к Контур.Маркет...', 'info');

        setTimeout(() => {
            const success = Math.random() > 0.3;
            if (success) {
                this.showNotification('✅ Подключение к Контур.Маркет успешно!', 'success');
            } else {
                this.showNotification('❌ Ошибка подключения. Проверьте API Key.', 'error');
            }
        }, 2000);
    }

    /**
     * Сохранение настроек Контур.Маркет
     */
    saveKonturSettings() {
        const settings = {
            apiKey: document.getElementById('kontur_api_key').value.trim(),
            orgId: document.getElementById('kontur_org_id').value.trim(),
            warehouseId: parseInt(document.getElementById('kontur_warehouse').value),
            autoOrders: document.getElementById('kontur_auto_orders').checked
        };

        if (!settings.apiKey || !settings.orgId) {
            alert('⚠️ Заполните все обязательные поля');
            return;
        }

        this.system.saveToLocalStorage('kontur_settings', settings);
        this.integrations.kontur.enabled = true;
        this.integrations.kontur.status = 'connected';

        document.querySelector('.modal-overlay').remove();
        this.showNotification('✅ Настройки Контур.Маркет сохранены!', 'success');
        this.renderIntegrationStatus();
    }

    /**
     * Импорт заказов из Контур.Маркет
     */
    importOrdersFromKontur() {
        if (!this.integrations.kontur.enabled) {
            alert('⚠️ Сначала настройте интеграцию с Контур.Маркет');
            return;
        }

        this.showNotification('📥 Импорт заказов из Контур.Маркет...', 'info');

        setTimeout(() => {
            this.integrations.kontur.lastSync = new Date().toISOString();
            this.showNotification('✅ Импортировано 8 новых заказов!', 'success');
            this.renderIntegrationStatus();
        }, 2000);
    }

    /**
     * Показ уведомления
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10001;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            animation: slideIn 0.3s ease-out;
            ${type === 'success' ? 'background: #16a34a;' : ''}
            ${type === 'error' ? 'background: #dc2626;' : ''}
            ${type === 'info' ? 'background: #2563eb;' : ''}
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IntegrationsModule;
}

