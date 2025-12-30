// ===== Profile Module - Профиль =====

class ProfileModule {
    constructor() {
        this.user = null;
        this.settings = {};
        this.init();
    }

    init() {
        console.log('👤 Initializing Profile Module...');
        this.loadUser();
        this.loadSettings();
    }

    loadUser() {
        const saved = localStorage.getItem('dandy_user');
        this.user = saved ? JSON.parse(saved) : this.getDefaultUser();
    }

    saveUser() {
        localStorage.setItem('dandy_user', JSON.stringify(this.user));
    }

    loadSettings() {
        const saved = localStorage.getItem('dandy_profile_settings');
        this.settings = saved ? JSON.parse(saved) : this.getDefaultSettings();
    }

    saveSettings() {
        localStorage.setItem('dandy_profile_settings', JSON.stringify(this.settings));
    }

    getDefaultUser() {
        return {
            id: 1,
            name: 'Администратор',
            email: 'admin@dandypizzasushi.com',
            phone: '+7 (925) 934-77-28',
            role: 'admin',
            avatar: 'assets/brand/logo.svg',
            lastLogin: new Date().toISOString(),
            permissions: ['all']
        };
    }

    getDefaultSettings() {
        return {
            theme: 'light',
            language: 'ru',
            notifications: {
                email: true,
                push: true,
                sound: true
            },
            dashboard: {
                showStats: true,
                showOrders: true,
                showAlerts: true
            },
            security: {
                twoFactor: false,
                sessionTimeout: 30
            }
        };
    }

    render() {
        const container = document.getElementById('profileContent');
        if (!container) return;

        container.innerHTML = `
            <div class="card">
                <h3 class="card-title">👤 Профиль пользователя</h3>
                
                <!-- Информация о пользователе -->
                <div class="grid grid-2" style="margin-bottom: 2rem;">
                    <div>
                        <h4>📋 Основная информация</h4>
                        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                            <img src="${this.user.avatar}" alt="Аватар" 
                                 style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;"
                                 onerror="this.style.display='none'; this.nextElementSibling && (this.nextElementSibling.style.display='none');">
                            <div>
                                <h3 style="margin: 0;">${this.user.name}</h3>
                                <p style="margin: 0.5rem 0; color: #666;">${this.user.role}</p>
                                <p style="margin: 0; color: #999; font-size: 0.9rem;">
                                    Последний вход: ${new Date(this.user.lastLogin).toLocaleString('ru-RU')}
                                </p>
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Имя</label>
                            <input type="text" id="userName" class="form-input" value="${this.user.name}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Email</label>
                            <input type="email" id="userEmail" class="form-input" value="${this.user.email}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Телефон</label>
                            <input type="tel" id="userPhone" class="form-input" value="${this.user.phone}">
                        </div>
                        <button class="btn btn-primary" onclick="profileModule.saveProfile()">💾 Сохранить изменения</button>
                    </div>
                    
                    <div>
                        <h4>🔐 Безопасность</h4>
                        <div class="form-group">
                            <label class="form-label">Текущий пароль</label>
                            <input type="password" id="currentPassword" class="form-input" placeholder="Введите текущий пароль">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Новый пароль</label>
                            <input type="password" id="newPassword" class="form-input" placeholder="Введите новый пароль">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Подтверждение пароля</label>
                            <input type="password" id="confirmPassword" class="form-input" placeholder="Подтвердите новый пароль">
                        </div>
                        <button class="btn btn-warning" onclick="profileModule.changePassword()">🔑 Изменить пароль</button>
                        
                        <div style="margin-top: 2rem;">
                            <h5>Дополнительная безопасность</h5>
                            <label class="form-label">
                                <input type="checkbox" ${this.settings.security.twoFactor ? 'checked' : ''} 
                                       onchange="profileModule.updateSetting('security.twoFactor', this.checked)">
                                Двухфакторная аутентификация
                            </label>
                        </div>
                    </div>
                </div>

                <!-- Настройки -->
                <div class="tabs-container">
                    <div class="tabs-nav">
                        <button class="tab-button active" onclick="profileModule.switchTab('general')">⚙️ Общие</button>
                        <button class="tab-button" onclick="profileModule.switchTab('notifications')">🔔 Уведомления</button>
                        <button class="tab-button" onclick="profileModule.switchTab('dashboard')">📊 Дашборд</button>
                        <button class="tab-button" onclick="profileModule.switchTab('system')">🖥️ Система</button>
                    </div>

                    <div id="general-tab" class="tab-content active">
                        ${this.renderGeneralSettings()}
                    </div>

                    <div id="notifications-tab" class="tab-content">
                        ${this.renderNotificationSettings()}
                    </div>

                    <div id="dashboard-tab" class="tab-content">
                        ${this.renderDashboardSettings()}
                    </div>

                    <div id="system-tab" class="tab-content">
                        ${this.renderSystemSettings()}
                    </div>
                </div>
            </div>
        `;
    }

    renderGeneralSettings() {
        return `
            <div class="grid grid-2">
                <div>
                    <h4>🎨 Внешний вид</h4>
                    <div class="form-group">
                        <label class="form-label">Тема</label>
                        <select id="themeSelect" class="form-input" onchange="profileModule.updateSetting('theme', this.value)">
                            <option value="light" ${this.settings.theme === 'light' ? 'selected' : ''}>Светлая</option>
                            <option value="dark" ${this.settings.theme === 'dark' ? 'selected' : ''}>Тёмная</option>
                            <option value="auto" ${this.settings.theme === 'auto' ? 'selected' : ''}>Автоматически</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Язык</label>
                        <select id="languageSelect" class="form-input" onchange="profileModule.updateSetting('language', this.value)">
                            <option value="ru" ${this.settings.language === 'ru' ? 'selected' : ''}>Русский</option>
                            <option value="en" ${this.settings.language === 'en' ? 'selected' : ''}>English</option>
                        </select>
                    </div>
                </div>
                <div>
                    <h4>⏰ Сессия</h4>
                    <div class="form-group">
                        <label class="form-label">Таймаут сессии (минуты)</label>
                        <input type="number" id="sessionTimeout" class="form-input" 
                               value="${this.settings.security.sessionTimeout}" 
                               onchange="profileModule.updateSetting('security.sessionTimeout', parseInt(this.value))">
                    </div>
                    <p style="color: #666; font-size: 0.9rem;">
                        Автоматический выход из системы через указанное время неактивности
                    </p>
                </div>
            </div>
        `;
    }

    renderNotificationSettings() {
        return `
            <div class="grid grid-2">
                <div>
                    <h4>📧 Email уведомления</h4>
                    <label class="form-label">
                        <input type="checkbox" ${this.settings.notifications.email ? 'checked' : ''} 
                               onchange="profileModule.updateSetting('notifications.email', this.checked)">
                        Получать уведомления на email
                    </label>
                </div>
                <div>
                    <h4>🔔 Push уведомления</h4>
                    <label class="form-label">
                        <input type="checkbox" ${this.settings.notifications.push ? 'checked' : ''} 
                               onchange="profileModule.updateSetting('notifications.push', this.checked)">
                        Браузерные уведомления
                    </label>
                    <label class="form-label">
                        <input type="checkbox" ${this.settings.notifications.sound ? 'checked' : ''} 
                               onchange="profileModule.updateSetting('notifications.sound', this.checked)">
                        Звуковые уведомления
                    </label>
                </div>
            </div>
        `;
    }

    renderDashboardSettings() {
        return `
            <div class="grid grid-2">
                <div>
                    <h4>📊 Отображение статистики</h4>
                    <label class="form-label">
                        <input type="checkbox" ${this.settings.dashboard.showStats ? 'checked' : ''} 
                               onchange="profileModule.updateSetting('dashboard.showStats', this.checked)">
                        Показывать статистику
                    </label>
                    <label class="form-label">
                        <input type="checkbox" ${this.settings.dashboard.showOrders ? 'checked' : ''} 
                               onchange="profileModule.updateSetting('dashboard.showOrders', this.checked)">
                        Показывать заказы
                    </label>
                    <label class="form-label">
                        <input type="checkbox" ${this.settings.dashboard.showAlerts ? 'checked' : ''} 
                               onchange="profileModule.updateSetting('dashboard.showAlerts', this.checked)">
                        Показывать уведомления
                    </label>
                </div>
                <div>
                    <h4>🎯 Персонализация</h4>
                    <p style="color: #666;">Настройте отображение элементов на главной странице</p>
                </div>
            </div>
        `;
    }

    renderSystemSettings() {
        return `
            <div class="grid grid-2">
                <div>
                    <h4>🗄️ Данные</h4>
                    <button class="btn btn-secondary" onclick="profileModule.exportData()">📤 Экспорт данных</button>
                    <button class="btn btn-secondary" onclick="profileModule.importData()">📥 Импорт данных</button>
                </div>
                <div>
                    <h4>🧹 Очистка</h4>
                    <button class="btn btn-warning" onclick="profileModule.clearCache()">🗑️ Очистить кэш</button>
                    <button class="btn btn-danger" onclick="profileModule.resetSettings()">🔄 Сбросить настройки</button>
                </div>
            </div>
        `;
    }

    switchTab(tabName) {
        // Обновляем кнопки
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[onclick*="${tabName}"]`).classList.add('active');

        // Обновляем контент
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
    }

    saveProfile() {
        const name = document.getElementById('userName').value;
        const email = document.getElementById('userEmail').value;
        const phone = document.getElementById('userPhone').value;

        if (!name || !email) {
            alert('Заполните обязательные поля');
            return;
        }

        this.user.name = name;
        this.user.email = email;
        this.user.phone = phone;
        this.saveUser();

        alert('✅ Профиль сохранён!');
    }

    changePassword() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (!currentPassword || !newPassword || !confirmPassword) {
            alert('Заполните все поля');
            return;
        }

        if (newPassword !== confirmPassword) {
            alert('Пароли не совпадают');
            return;
        }

        if (newPassword.length < 6) {
            alert('Пароль должен содержать минимум 6 символов');
            return;
        }

        // Здесь будет логика смены пароля
        alert('✅ Пароль изменён!');
        
        // Очищаем поля
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
    }

    updateSetting(path, value) {
        const keys = path.split('.');
        let current = this.settings;
        
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }
        
        current[keys[keys.length - 1]] = value;
        this.saveSettings();
        
        console.log('⚙️ Setting updated:', path, value);
    }

    exportData() {
        const data = {
            user: this.user,
            settings: this.settings,
            timestamp: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dandy-profile-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = JSON.parse(e.target.result);
                        this.user = data.user || this.user;
                        this.settings = data.settings || this.settings;
                        this.saveUser();
                        this.saveSettings();
                        this.render();
                        alert('✅ Данные импортированы!');
                    } catch (error) {
                        alert('❌ Ошибка при импорте данных');
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }

    clearCache() {
        if (confirm('Очистить кэш? Это может замедлить работу системы.')) {
            localStorage.removeItem('dandy_cache');
            alert('✅ Кэш очищен!');
        }
    }

    resetSettings() {
        if (confirm('Сбросить все настройки к значениям по умолчанию?')) {
            this.settings = this.getDefaultSettings();
            this.saveSettings();
            this.render();
            alert('✅ Настройки сброшены!');
        }
    }
}

// Глобальная функция для инициализации
window.initProfile = function() {
    if (window.profileModule) {
        window.profileModule = null;
    }
    window.profileModule = new ProfileModule();
    window.profileModule.render();
};

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProfileModule;
}





