/**
 * DANDY Inventory System - Roles & Permissions Module
 * Управление ролями и правами доступа
 */

class RolesModule {
    constructor(system) {
        this.system = system;
        this.currentUser = this.loadCurrentUser();
        this.roles = this.loadRoles();
    }

    loadCurrentUser() {
        const saved = localStorage.getItem('dandy_current_user');
        return saved ? JSON.parse(saved) : {
            id: 1,
            name: 'Администратор',
            role: 'admin',
            permissions: ['all']
        };
    }

    saveCurrentUser() {
        localStorage.setItem('dandy_current_user', JSON.stringify(this.currentUser));
    }

    loadRoles() {
        return {
            // Администратор - полный доступ
            admin: {
                name: 'Администратор',
                permissions: ['all'],
                description: 'Полный доступ ко всем модулям'
            },

            // Технолог - техкарты и рецепты
            technologist: {
                name: 'Технолог',
                permissions: [
                    'recipes.read',
                    'recipes.create',
                    'recipes.update',
                    'recipes.delete',
                    'nomenclature.read',
                    'reports.read'
                ],
                description: 'Управление технологическими картами и рецептами'
            },

            // Завсклад - склад и приход
            warehouse_manager: {
                name: 'Завсклад',
                permissions: [
                    'warehouse.read',
                    'warehouse.create',
                    'warehouse.update',
                    'warehouse.delete',
                    'nomenclature.read',
                    'inventory.read',
                    'inventory.create',
                    'reports.read'
                ],
                description: 'Управление складом и приходом товаров'
            },

            // Бар-менеджер - бар и разлив
            bar_manager: {
                name: 'Бар-менеджер',
                permissions: [
                    'bar.read',
                    'bar.create',
                    'bar.update',
                    'bar.delete',
                    'egais.read',
                    'egais.create',
                    'nomenclature.read',
                    'reports.read'
                ],
                description: 'Управление баром и алкогольной продукцией'
            },

            // Шеф-повар - производство
            chef: {
                name: 'Шеф-повар',
                permissions: [
                    'production.read',
                    'production.create',
                    'production.update',
                    'recipes.read',
                    'nomenclature.read',
                    'reports.read'
                ],
                description: 'Управление производством и кухней'
            },

            // Бухгалтер - отчёты и аналитика
            accountant: {
                name: 'Бухгалтер/экономист',
                permissions: [
                    'reports.read',
                    'reports.export',
                    'nomenclature.read',
                    'warehouse.read',
                    'inventory.read',
                    'settings.read'
                ],
                description: 'Просмотр отчётов и аналитики'
            },

            // Кассир - только продажи
            cashier: {
                name: 'Кассир',
                permissions: [
                    'sales.create',
                    'nomenclature.read'
                ],
                description: 'Оформление продаж'
            },

            // Аудитор - только чтение
            auditor: {
                name: 'Аудитор',
                permissions: [
                    'nomenclature.read',
                    'warehouse.read',
                    'production.read',
                    'bar.read',
                    'inventory.read',
                    'reports.read',
                    'settings.read',
                    'audit.read'
                ],
                description: 'Просмотр всех данных без права изменения'
            }
        };
    }

    hasPermission(permission) {
        // Админ имеет все права
        if (this.currentUser.permissions.includes('all')) {
            return true;
        }

        // Проверяем конкретное разрешение
        return this.currentUser.permissions.includes(permission);
    }

    checkAccess(module, action = 'read') {
        const permission = `${module}.${action}`;
        
        if (!this.hasPermission(permission)) {
            this.showAccessDenied(permission);
            return false;
        }
        
        return true;
    }

    showAccessDenied(permission) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: #094a45; padding: 2rem; border-radius: 12px; max-width: 400px; text-align: center; border: 1px solid var(--chip-border);">
                <div style="font-size: 4rem; margin-bottom: 1rem;">🚫</div>
                <h2 style="color: #eebc5c; margin: 0 0 1rem 0;">Доступ запрещён</h2>
                <p style="color: var(--text-light); margin-bottom: 1rem;">
                    У вас нет прав для выполнения этого действия.
                </p>
                <p style="color: var(--text-light); opacity: 0.7; font-size: 0.85rem; margin-bottom: 1.5rem;">
                    Требуется разрешение: <strong>${permission}</strong><br>
                    Ваша роль: <strong>${this.currentUser.role}</strong>
                </p>
                <button onclick="this.closest('[style*=fixed]').remove()" class="btn-primary" style="width: 100%;">
                    Понятно
                </button>
            </div>
        `;

        document.body.appendChild(modal);

        // Логируем попытку доступа
        this.system.addAuditLog('access_denied', {
            user: this.currentUser.name,
            role: this.currentUser.role,
            permission: permission
        });
    }

    switchUser(userId) {
        const users = this.getUsers();
        const user = users.find(u => u.id === userId);
        
        if (user) {
            const rolePermissions = this.roles[user.role];
            this.currentUser = {
                ...user,
                permissions: rolePermissions ? rolePermissions.permissions : []
            };
            this.saveCurrentUser();
            
            // Обновляем UI
            this.updateUserDisplay();
            
            // Показываем уведомление
            alert(`Вы вошли как: ${user.name} (${rolePermissions.name})`);
            
            // Логируем вход
            this.system.addAuditLog('user_switched', {
                user: user.name,
                role: user.role
            });
            
            // Перезагружаем страницу для применения прав
            location.reload();
        }
    }

    getUsers() {
        const saved = localStorage.getItem('dandy_users');
        if (saved) {
            return JSON.parse(saved);
        }

        // Демо-пользователи
        const demoUsers = [
            { id: 1, name: 'Администратор', role: 'admin', email: 'admin@dandy.ru' },
            { id: 2, name: 'Иван Петров', role: 'warehouse_manager', email: 'warehouse@dandy.ru' },
            { id: 3, name: 'Мария Сидорова', role: 'technologist', email: 'tech@dandy.ru' },
            { id: 4, name: 'Алексей Смирнов', role: 'bar_manager', email: 'bar@dandy.ru' },
            { id: 5, name: 'Елена Кузнецова', role: 'chef', email: 'chef@dandy.ru' },
            { id: 6, name: 'Ольга Попова', role: 'accountant', email: 'account@dandy.ru' },
            { id: 7, name: 'Дмитрий Новиков', role: 'cashier', email: 'cashier@dandy.ru' },
            { id: 8, name: 'Анна Волкова', role: 'auditor', email: 'auditor@dandy.ru' }
        ];

        localStorage.setItem('dandy_users', JSON.stringify(demoUsers));
        return demoUsers;
    }

    updateUserDisplay() {
        const userDisplay = document.getElementById('currentUser');
        if (userDisplay) {
            userDisplay.textContent = `👤 ${this.currentUser.name}`;
        }
    }

    renderRoleSelector() {
        const users = this.getUsers();
        
        const html = `
            <div style="padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid var(--chip-border);">
                <h4 style="color: var(--text-light); margin-top: 0;">🔐 Переключение пользователя (демо)</h4>
                <p style="color: var(--text-light); opacity: 0.8; font-size: 0.9rem;">Текущий: <strong>${this.currentUser.name}</strong> (${this.roles[this.currentUser.role].name})</p>
                
                <select id="userSelector" class="form-select" style="margin-bottom: 1rem;">
                    ${users.map(u => `
                        <option value="${u.id}" ${u.id === this.currentUser.id ? 'selected' : ''}>
                            ${u.name} — ${this.roles[u.role].name}
                        </option>
                    `).join('')}
                </select>

                <button onclick="rolesModule.switchUser(parseInt(document.getElementById('userSelector').value))" class="btn-primary" style="width: 100%;">
                    ✓ Переключить
                </button>

                <div style="margin-top: 1.5rem;">
                    <strong style="color: var(--text-light);">Доступные права:</strong>
                    <ul style="color: var(--text-light); opacity: 0.9; font-size: 0.85rem; margin: 0.5rem 0; padding-left: 1.5rem;">
                        ${this.currentUser.permissions.includes('all') 
                            ? '<li>Полный доступ ко всем модулям</li>' 
                            : this.currentUser.permissions.map(p => `<li>${p}</li>`).join('')
                        }
                    </ul>
                </div>
            </div>
        `;

        return html;
    }

    applyRestrictions() {
        // Скрываем недоступные табы
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            const page = tab.getAttribute('data-page');
            
            // Проверяем доступ к модулю
            if (!this.hasPermission('all')) {
                const hasAccess = this.hasPermission(`${page}.read`);
                
                if (!hasAccess) {
                    tab.style.opacity = '0.3';
                    tab.style.pointerEvents = 'none';
                    tab.title = 'У вас нет доступа к этому модулю';
                }
            }
        });

        // Скрываем кнопки создания/редактирования для пользователей без прав
        if (!this.hasPermission('all')) {
            const createButtons = document.querySelectorAll('[onclick*="create"]');
            createButtons.forEach(btn => {
                const module = this.detectModule(btn);
                if (module && !this.hasPermission(`${module}.create`)) {
                    btn.style.display = 'none';
                }
            });

            const editButtons = document.querySelectorAll('[onclick*="edit"]');
            editButtons.forEach(btn => {
                const module = this.detectModule(btn);
                if (module && !this.hasPermission(`${module}.update`)) {
                    btn.style.display = 'none';
                }
            });

            const deleteButtons = document.querySelectorAll('[onclick*="delete"]');
            deleteButtons.forEach(btn => {
                const module = this.detectModule(btn);
                if (module && !this.hasPermission(`${module}.delete`)) {
                    btn.style.display = 'none';
                }
            });
        }

        console.log('🔐 Role restrictions applied for:', this.currentUser.role);
    }

    detectModule(element) {
        // Пытаемся определить модуль по контексту
        const pageContent = element.closest('[id*="page-content"], .page-content');
        if (pageContent) {
            return pageContent.id || pageContent.getAttribute('data-page');
        }
        return null;
    }
}

// Глобальная функция для доступа из HTML
if (typeof window !== 'undefined') {
    window.RolesModule = RolesModule;
}

