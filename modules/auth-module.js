/**
 * Модуль аутентификации и безопасности
 * Роли пользователей, вход в систему, журналирование операций
 */

class AuthModule {
    constructor() {
        this.currentUser = null;
        this.userRoles = ['cashier', 'senior_cashier', 'admin'];
        this.permissions = this.getPermissions();
        this.operationLog = [];
        this.init();
    }

    init() {
        this.loadUsers();
        this.loadOperationLog();
        this.setupEventListeners();
    }

    // Определение разрешений для ролей
    getPermissions() {
        return {
            cashier: [
                'pos.sale',
                'pos.refund',
                'pos.print_receipt',
                'pos.view_orders',
                'pos.update_order_status'
            ],
            senior_cashier: [
                'pos.sale',
                'pos.refund',
                'pos.print_receipt',
                'pos.view_orders',
                'pos.update_order_status',
                'pos.cancel_order',
                'pos.view_reports',
                'pos.manage_discounts'
            ],
            admin: [
                'pos.sale',
                'pos.refund',
                'pos.print_receipt',
                'pos.view_orders',
                'pos.update_order_status',
                'pos.cancel_order',
                'pos.view_reports',
                'pos.manage_discounts',
                'pos.manage_users',
                'pos.manage_settings',
                'pos.view_operation_log',
                'pos.manage_terminals',
                'pos.manage_delivery_zones',
                'pos.manage_menu',
                'pos.view_analytics'
            ]
        };
    }

    // Загрузка пользователей
    loadUsers() {
        console.log('Загружаем пользователей...');
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        console.log('Пользователи из localStorage:', users.length);
        
        this.users = users.length > 0 ? users : this.getDefaultUsers();
        console.log('Итоговые пользователи:', this.users.length);
        console.log('Список пользователей:', this.users.map(u => ({ username: u.username, role: u.role })));
    }

    // Пользователи по умолчанию
    getDefaultUsers() {
        return [
            {
                id: 'admin_1',
                username: 'admin',
                password: this.hashPassword('admin123'),
                role: 'admin',
                name: 'Администратор',
                email: 'admin@dandy.ru',
                phone: '+7 (999) 123-45-67',
                isActive: true,
                createdAt: new Date().toISOString(),
                lastLogin: null
            },
            {
                id: 'cashier_1',
                username: 'cashier1',
                password: this.hashPassword('cashier123'),
                role: 'cashier',
                name: 'Кассир 1',
                email: 'cashier1@dandy.ru',
                phone: '+7 (999) 123-45-68',
                isActive: true,
                createdAt: new Date().toISOString(),
                lastLogin: null
            },
            {
                id: 'senior_1',
                username: 'senior1',
                password: this.hashPassword('senior123'),
                role: 'senior_cashier',
                name: 'Старший кассир',
                email: 'senior@dandy.ru',
                phone: '+7 (999) 123-45-69',
                isActive: true,
                createdAt: new Date().toISOString(),
                lastLogin: null
            }
        ];
    }

    // Загрузка журнала операций
    loadOperationLog() {
        this.operationLog = JSON.parse(localStorage.getItem('operationLog') || '[]');
    }

    // Хеширование пароля
    hashPassword(password) {
        // Простое хеширование для демонстрации
        // В реальной системе используйте bcrypt или аналогичные
        return btoa(password + 'salt_dandy_2024');
    }

    // Проверка пароля
    verifyPassword(password, hash) {
        return this.hashPassword(password) === hash;
    }

    // Аутентификация пользователя
    async authenticate(username, password) {
        console.log('Попытка аутентификации:', username);
        console.log('Доступные пользователи:', this.users.map(u => ({ username: u.username, isActive: u.isActive })));
        
        const user = this.users.find(u => u.username === username && u.isActive);
        
        if (!user) {
            console.log('Пользователь не найден:', username);
            this.logOperation('auth.failed_login', { username: username, reason: 'user_not_found' });
            return { success: false, error: 'Пользователь не найден' };
        }

        console.log('Пользователь найден, проверяем пароль...');
        const passwordValid = this.verifyPassword(password, user.password);
        console.log('Пароль валиден:', passwordValid);
        
        if (!passwordValid) {
            console.log('Неверный пароль для пользователя:', username);
            this.logOperation('auth.failed_login', { username: username, reason: 'invalid_password' });
            return { success: false, error: 'Неверный пароль' };
        }

        // Обновление времени последнего входа
        user.lastLogin = new Date().toISOString();
        this.saveUsers();

        // Установка текущего пользователя
        this.currentUser = user;
        
        // Сохранение сессии
        sessionStorage.setItem('currentUser', JSON.stringify(user));

        this.logOperation('auth.successful_login', { userId: user.id, username: user.username });

        return { success: true, user: user };
    }

    // Выход из системы
    async logout() {
        if (this.currentUser) {
            this.logOperation('auth.logout', { userId: this.currentUser.id, username: this.currentUser.username });
        }

        this.currentUser = null;
        sessionStorage.removeItem('currentUser');
        
        return { success: true };
    }

    // Проверка разрешений
    hasPermission(permission) {
        if (!this.currentUser) {
            return false;
        }

        const userPermissions = this.permissions[this.currentUser.role] || [];
        return userPermissions.includes(permission);
    }

    // Проверка роли
    hasRole(role) {
        if (!this.currentUser) {
            return false;
        }

        return this.currentUser.role === role;
    }

    // Проверка является ли администратором
    isAdmin() {
        return this.hasRole('admin');
    }

    // Проверка является ли старшим кассиром
    isSeniorCashier() {
        return this.hasRole('senior_cashier') || this.isAdmin();
    }

    // Создание нового пользователя
    async createUser(userData) {
        if (!this.isAdmin()) {
            return { success: false, error: 'Недостаточно прав' };
        }

        // Проверка уникальности username
        if (this.users.find(u => u.username === userData.username)) {
            return { success: false, error: 'Пользователь с таким именем уже существует' };
        }

        const newUser = {
            id: `user_${Date.now()}`,
            username: userData.username,
            password: this.hashPassword(userData.password),
            role: userData.role,
            name: userData.name,
            email: userData.email,
            phone: userData.phone,
            isActive: true,
            createdAt: new Date().toISOString(),
            lastLogin: null
        };

        this.users.push(newUser);
        this.saveUsers();

        this.logOperation('user.created', { 
            userId: newUser.id, 
            username: newUser.username,
            role: newUser.role,
            createdBy: this.currentUser.id
        });

        return { success: true, user: newUser };
    }

    // Обновление пользователя
    async updateUser(userId, userData) {
        if (!this.isAdmin()) {
            return { success: false, error: 'Недостаточно прав' };
        }

        const userIndex = this.users.findIndex(u => u.id === userId);
        if (userIndex === -1) {
            return { success: false, error: 'Пользователь не найден' };
        }

        const oldUser = { ...this.users[userIndex] };
        
        // Обновление данных
        this.users[userIndex] = {
            ...this.users[userIndex],
            ...userData,
            id: userId, // ID не изменяется
            createdAt: oldUser.createdAt // Дата создания не изменяется
        };

        // Если обновляется пароль
        if (userData.password) {
            this.users[userIndex].password = this.hashPassword(userData.password);
        }

        this.saveUsers();

        this.logOperation('user.updated', { 
            userId: userId,
            changes: userData,
            updatedBy: this.currentUser.id
        });

        return { success: true, user: this.users[userIndex] };
    }

    // Удаление пользователя
    async deleteUser(userId) {
        if (!this.isAdmin()) {
            return { success: false, error: 'Недостаточно прав' };
        }

        if (userId === this.currentUser.id) {
            return { success: false, error: 'Нельзя удалить самого себя' };
        }

        const userIndex = this.users.findIndex(u => u.id === userId);
        if (userIndex === -1) {
            return { success: false, error: 'Пользователь не найден' };
        }

        const user = this.users[userIndex];
        this.users.splice(userIndex, 1);
        this.saveUsers();

        this.logOperation('user.deleted', { 
            userId: userId,
            username: user.username,
            deletedBy: this.currentUser.id
        });

        return { success: true };
    }

    // Блокировка/разблокировка пользователя
    async toggleUserStatus(userId) {
        if (!this.isAdmin()) {
            return { success: false, error: 'Недостаточно прав' };
        }

        const user = this.users.find(u => u.id === userId);
        if (!user) {
            return { success: false, error: 'Пользователь не найден' };
        }

        user.isActive = !user.isActive;
        this.saveUsers();

        this.logOperation('user.status_changed', { 
            userId: userId,
            newStatus: user.isActive ? 'active' : 'blocked',
            changedBy: this.currentUser.id
        });

        return { success: true, user: user };
    }

    // Получение списка пользователей
    getUsers() {
        if (!this.isAdmin()) {
            return { success: false, error: 'Недостаточно прав' };
        }

        return { success: true, users: this.users };
    }

    // Получение текущего пользователя
    getCurrentUser() {
        return this.currentUser;
    }

    // Проверка сессии
    checkSession() {
        console.log('Проверяем сессию в AuthModule...');
        const sessionUser = sessionStorage.getItem('currentUser');
        console.log('Данные сессии:', sessionUser);
        
        if (sessionUser) {
            try {
                this.currentUser = JSON.parse(sessionUser);
                console.log('Пользователь из сессии:', this.currentUser);
                return true;
            } catch (error) {
                console.error('Ошибка парсинга сессии:', error);
                return false;
            }
        }
        
        console.log('Сессия не найдена');
        return false;
    }

    // Журналирование операций
    logOperation(operation, details = {}) {
        const logEntry = {
            id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            operation: operation,
            userId: this.currentUser ? this.currentUser.id : null,
            username: this.currentUser ? this.currentUser.username : 'system',
            timestamp: new Date().toISOString(),
            details: details,
            ip: this.getClientIP(),
            userAgent: navigator.userAgent
        };

        this.operationLog.push(logEntry);
        
        // Ограничение размера журнала (последние 10000 записей)
        if (this.operationLog.length > 10000) {
            this.operationLog = this.operationLog.slice(-10000);
        }

        this.saveOperationLog();
    }

    // Получение журнала операций
    getOperationLog(filters = {}) {
        if (!this.isAdmin()) {
            return { success: false, error: 'Недостаточно прав' };
        }

        let filteredLog = this.operationLog;

        if (filters.userId) {
            filteredLog = filteredLog.filter(entry => entry.userId === filters.userId);
        }

        if (filters.operation) {
            filteredLog = filteredLog.filter(entry => entry.operation.includes(filters.operation));
        }

        if (filters.dateFrom) {
            filteredLog = filteredLog.filter(entry => 
                new Date(entry.timestamp) >= new Date(filters.dateFrom)
            );
        }

        if (filters.dateTo) {
            filteredLog = filteredLog.filter(entry => 
                new Date(entry.timestamp) <= new Date(filters.dateTo)
            );
        }

        // Сортировка по времени (новые сверху)
        filteredLog.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return { success: true, log: filteredLog };
    }

    // Экспорт журнала операций
    exportOperationLog(filters = {}) {
        if (!this.isAdmin()) {
            return { success: false, error: 'Недостаточно прав' };
        }

        const logResult = this.getOperationLog(filters);
        if (!logResult.success) {
            return logResult;
        }

        const csvData = this.convertLogToCSV(logResult.log);
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `operation_log_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();

        this.logOperation('log.exported', { filters: filters });

        return { success: true };
    }

    // Конвертация журнала в CSV
    convertLogToCSV(log) {
        const headers = ['ID', 'Операция', 'Пользователь', 'Время', 'Детали', 'IP'];
        const rows = log.map(entry => [
            entry.id,
            entry.operation,
            entry.username,
            entry.timestamp,
            JSON.stringify(entry.details),
            entry.ip
        ]);

        return [headers, ...rows].map(row => 
            row.map(field => `"${field}"`).join(',')
        ).join('\n');
    }

    // Получение IP клиента (упрощенное)
    getClientIP() {
        // В реальной системе IP будет передаваться с сервера
        return '127.0.0.1';
    }

    // Сохранение пользователей
    saveUsers() {
        localStorage.setItem('users', JSON.stringify(this.users));
    }

    // Сохранение журнала операций
    saveOperationLog() {
        localStorage.setItem('operationLog', JSON.stringify(this.operationLog));
    }

    // Настройка обработчиков событий
    setupEventListeners() {
        // Обработка изменения статуса сети
        window.addEventListener('online', () => {
            this.logOperation('system.network_online');
        });
        
        window.addEventListener('offline', () => {
            this.logOperation('system.network_offline');
        });

        // Обработка закрытия страницы
        window.addEventListener('beforeunload', () => {
            if (this.currentUser) {
                this.logOperation('auth.session_end', { 
                    userId: this.currentUser.id,
                    username: this.currentUser.username
                });
            }
        });
    }
}

// Экспорт модуля
window.AuthModule = AuthModule;
