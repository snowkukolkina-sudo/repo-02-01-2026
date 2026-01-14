/**
 * DANDY Inventory — Модуль резервного копирования
 * Backup / Restore всей базы данных
 */

class BackupModule {
    constructor(inventorySystem) {
        this.system = inventorySystem;
        this.autoBackupEnabled = this.loadAutoBackupSetting();
        this.lastBackupDate = this.loadLastBackupDate();
        
        // Запускаем автоматический backup если включен
        if (this.autoBackupEnabled) {
            this.scheduleAutoBackup();
        }
    }

    /**
     * Загрузка настройки автобэкапа
     */
    loadAutoBackupSetting() {
        const setting = localStorage.getItem('dandy_auto_backup');
        return setting === 'true';
    }

    /**
     * Загрузка даты последнего бэкапа
     */
    loadLastBackupDate() {
        const date = localStorage.getItem('dandy_last_backup_date');
        return date ? new Date(date) : null;
    }

    /**
     * Сохранение даты последнего бэкапа
     */
    saveLastBackupDate() {
        localStorage.setItem('dandy_last_backup_date', new Date().toISOString());
        this.lastBackupDate = new Date();
    }

    /**
     * Включение/выключение автобэкапа
     */
    toggleAutoBackup(enabled) {
        this.autoBackupEnabled = enabled;
        localStorage.setItem('dandy_auto_backup', enabled.toString());
        
        if (enabled) {
            this.scheduleAutoBackup();
            this.showNotification('✅ Автоматический backup включен', 'success');
        } else {
            this.showNotification('⚠️ Автоматический backup выключен', 'info');
        }
    }

    /**
     * Планирование автоматического backup
     */
    scheduleAutoBackup() {
        // Проверяем нужно ли делать backup (раз в день)
        const checkBackup = () => {
            const now = new Date();
            const lastBackup = this.lastBackupDate;
            
            if (!lastBackup || (now - lastBackup) > 24 * 60 * 60 * 1000) {
                console.log('🔄 Автоматический backup...');
                this.createBackup(true);
            }
        };

        // Проверяем каждый час
        setInterval(checkBackup, 60 * 60 * 1000);
        
        // И сразу при загрузке
        checkBackup();
    }

    /**
     * Создание backup
     */
    createBackup(isAuto = false) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
            const backupData = {
                version: '1.0.0',
                timestamp: new Date().toISOString(),
                type: isAuto ? 'auto' : 'manual',
                data: {
                    products: this.system.products,
                    recipes: this.system.recipes,
                    warehouses: this.system.warehouses,
                    documents: this.system.documents || [],
                    openBottles: this.system.openBottles || [],
                    kegs: this.system.kegs || [],
                    egaisData: localStorage.getItem('dandy_egais_data'),
                    crptCodes: localStorage.getItem('dandy_crpt_codes'),
                    mercuryVSD: localStorage.getItem('dandy_mercury_vsd'),
                    settings: localStorage.getItem('dandy_inventory_settings'),
                    auditLog: localStorage.getItem('dandy_audit_log')
                }
            };

            const json = JSON.stringify(backupData, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            if (!isAuto) {
                // Ручной backup - скачиваем файл
                const link = document.createElement('a');
                link.href = url;
                link.download = `dandy_backup_${timestamp}.json`;
                link.click();
                URL.revokeObjectURL(url);
                
                this.showNotification('✅ Backup создан и скачан!', 'success');
            } else {
                // Автоматический backup - сохраняем в localStorage
                localStorage.setItem('dandy_last_auto_backup', json);
                this.saveLastBackupDate();
                console.log('✅ Автоматический backup сохранён');
            }

            // Логируем
            this.system.addAuditLog('backup_created', {
                type: isAuto ? 'auto' : 'manual',
                itemsCount: {
                    products: this.system.products.length,
                    recipes: this.system.recipes.length,
                    documents: (this.system.documents || []).length
                }
            });

            return true;
        } catch (error) {
            console.error('❌ Ошибка создания backup:', error);
            this.showNotification('❌ Ошибка создания backup!', 'error');
            return false;
        }
    }

    /**
     * Восстановление из backup
     */
    async restoreBackup(file) {
        try {
            const text = await file.text();
            const backupData = JSON.parse(text);

            // Проверяем валидность backup
            if (!backupData.version || !backupData.data) {
                throw new Error('Неверный формат файла backup');
            }

            // Подтверждение
            if (!confirm(`⚠️ ВНИМАНИЕ!\n\nВосстановление из backup удалит все текущие данные и заменит их данными из файла.\n\nДата backup: ${new Date(backupData.timestamp).toLocaleString('ru-RU')}\nТоваров: ${backupData.data.products?.length || 0}\nРецептов: ${backupData.data.recipes?.length || 0}\n\nПродолжить?`)) {
                return false;
            }

            // Восстанавливаем данные
            this.system.products = backupData.data.products || [];
            this.system.recipes = backupData.data.recipes || [];
            this.system.warehouses = backupData.data.warehouses || [];
            this.system.documents = backupData.data.documents || [];
            this.system.openBottles = backupData.data.openBottles || [];
            this.system.kegs = backupData.data.kegs || [];

            // Сохраняем в localStorage
            this.system.saveToLocalStorage('products', this.system.products);
            this.system.saveToLocalStorage('recipes', this.system.recipes);
            
            if (backupData.data.egaisData) {
                localStorage.setItem('dandy_egais_data', backupData.data.egaisData);
            }
            if (backupData.data.crptCodes) {
                localStorage.setItem('dandy_crpt_codes', backupData.data.crptCodes);
            }
            if (backupData.data.mercuryVSD) {
                localStorage.setItem('dandy_mercury_vsd', backupData.data.mercuryVSD);
            }
            if (backupData.data.settings) {
                localStorage.setItem('dandy_inventory_settings', backupData.data.settings);
            }

            // Логируем
            this.system.addAuditLog('backup_restored', {
                backupDate: backupData.timestamp,
                itemsRestored: {
                    products: this.system.products.length,
                    recipes: this.system.recipes.length
                }
            });

            this.showNotification('✅ Данные восстановлены! Страница будет перезагружена...', 'success');
            
            // Перезагружаем страницу через 2 секунды
            setTimeout(() => {
                window.location.reload();
            }, 2000);

            return true;
        } catch (error) {
            console.error('❌ Ошибка восстановления backup:', error);
            this.showNotification('❌ Ошибка восстановления: ' + error.message, 'error');
            return false;
        }
    }

    /**
     * Восстановление из автоматического backup
     */
    restoreAutoBackup() {
        try {
            const lastAutoBackup = localStorage.getItem('dandy_last_auto_backup');
            if (!lastAutoBackup) {
                this.showNotification('⚠️ Автоматический backup не найден', 'error');
                return false;
            }

            const backupData = JSON.parse(lastAutoBackup);
            
            if (!confirm(`Восстановить данные из автоматического backup?\n\nДата: ${new Date(backupData.timestamp).toLocaleString('ru-RU')}`)) {
                return false;
            }

            // Создаём файл из auto backup
            const blob = new Blob([lastAutoBackup], { type: 'application/json' });
            const file = new File([blob], 'auto_backup.json', { type: 'application/json' });
            
            return this.restoreBackup(file);
        } catch (error) {
            console.error('❌ Ошибка восстановления auto backup:', error);
            this.showNotification('❌ Ошибка восстановления!', 'error');
            return false;
        }
    }

    /**
     * Очистка старых данных
     */
    clearOldData(daysOld = 90) {
        if (!confirm(`⚠️ ВНИМАНИЕ!\n\nБудут удалены:\n- Документы старше ${daysOld} дней\n- Закрытые производственные заказы\n- Завершённые инвентаризации\n\nТекущие остатки и товары НЕ будут затронуты.\n\nПродолжить?`)) {
            return;
        }

        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            let deletedCount = 0;

            // Удаляем старые документы
            if (this.system.documents) {
                const before = this.system.documents.length;
                this.system.documents = this.system.documents.filter(doc => {
                    const docDate = new Date(doc.date);
                    return docDate >= cutoffDate || doc.status !== 'posted';
                });
                deletedCount += before - this.system.documents.length;
            }

            // Очищаем audit log
            const auditLog = localStorage.getItem('dandy_audit_log');
            if (auditLog) {
                const logs = JSON.parse(auditLog);
                const filteredLogs = logs.filter(log => {
                    const logDate = new Date(log.timestamp);
                    return logDate >= cutoffDate;
                });
                localStorage.setItem('dandy_audit_log', JSON.stringify(filteredLogs));
                deletedCount += logs.length - filteredLogs.length;
            }

            this.system.addAuditLog('old_data_cleared', {
                daysOld,
                deletedCount
            });

            this.showNotification(`✅ Удалено записей: ${deletedCount}`, 'success');
        } catch (error) {
            console.error('❌ Ошибка очистки данных:', error);
            this.showNotification('❌ Ошибка очистки данных!', 'error');
        }
    }

    /**
     * Экспорт в CSV
     */
    exportToCSV(data, filename) {
        try {
            // Преобразуем в CSV
            const headers = Object.keys(data[0]);
            const csv = [
                headers.join(';'),
                ...data.map(row => headers.map(h => {
                    const value = row[h];
                    // Экранируем кавычки и переносы строк
                    return typeof value === 'string' && value.includes(';') 
                        ? `"${value.replace(/"/g, '""')}"` 
                        : value;
                }).join(';'))
            ].join('\n');

            // Добавляем BOM для корректного отображения кириллицы в Excel
            const bom = '\uFEFF';
            const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            URL.revokeObjectURL(url);

            this.showNotification('✅ CSV экспортирован!', 'success');
        } catch (error) {
            console.error('❌ Ошибка экспорта CSV:', error);
            this.showNotification('❌ Ошибка экспорта!', 'error');
        }
    }

    /**
     * Показ интерфейса backup/restore
     */
    renderBackupUI() {
        const container = document.getElementById('backupManagement');
        if (!container) return;

        const lastBackupText = this.lastBackupDate 
            ? new Date(this.lastBackupDate).toLocaleString('ru-RU')
            : 'Никогда';

        container.innerHTML = `
            <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem;">
                <h3 style="margin: 0 0 1rem 0; color: #60a5fa;">💾 Резервное копирование</h3>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div>
                        <strong style="color: #F3EADB;">Последний автобэкап:</strong><br>
                        <span style="color: #F3EADB; opacity: 0.8;">${lastBackupText}</span>
                    </div>
                    <div>
                        <strong style="color: #F3EADB;">Автоматический backup:</strong><br>
                        <label style="display: inline-flex; align-items: center; cursor: pointer;">
                            <input type="checkbox" 
                                   ${this.autoBackupEnabled ? 'checked' : ''} 
                                   onchange="backupModule.toggleAutoBackup(this.checked)"
                                   style="margin-right: 0.5rem;">
                            <span style="color: #F3EADB;">Включен (каждые 24 часа)</span>
                        </label>
                    </div>
                </div>

                <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                    <button class="btn btn-primary" onclick="backupModule.createBackup(false)">
                        📥 Создать backup
                    </button>
                    <button class="btn btn-secondary" onclick="document.getElementById('restoreFileInput').click()">
                        📤 Восстановить из файла
                    </button>
                    <button class="btn btn-secondary" onclick="backupModule.restoreAutoBackup()">
                        ↩️ Восстановить автобэкап
                    </button>
                    <button class="btn btn-secondary" onclick="backupModule.clearOldData(90)" style="background: #f59e0b; color: white;">
                        🗑️ Очистить старые данные
                    </button>
                </div>

                <input type="file" 
                       id="restoreFileInput" 
                       accept=".json"
                       style="display: none;"
                       onchange="backupModule.restoreBackup(this.files[0])">
            </div>

            <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); padding: 1.5rem; border-radius: 12px;">
                <h3 style="margin: 0 0 1rem 0; color: #fbbf24;">⚠️ Важная информация</h3>
                <ul style="margin: 0; padding-left: 1.5rem; color: #F3EADB;">
                    <li style="margin-bottom: 0.5rem;">Backup включает все товары, рецепты, документы и настройки</li>
                    <li style="margin-bottom: 0.5rem;">Автоматический backup сохраняется в браузере и может быть утерян при очистке кэша</li>
                    <li style="margin-bottom: 0.5rem;">Рекомендуется регулярно создавать ручные backup и сохранять их в надёжном месте</li>
                    <li>Восстановление из backup полностью заменяет текущие данные</li>
                </ul>
            </div>
        `;
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
    module.exports = BackupModule;
}

