/**
 * DANDY Inventory — Модуль Честный ЗНАК (CRPT)
 * Учёт маркированной продукции, интеграция с CRPT API
 */

class CRPTModule {
    constructor(inventorySystem) {
        this.system = inventorySystem;
        this.codes = this.loadCodes();
        this.apiStatus = 'connected'; // connected, disconnected, error
    }

    /**
     * Инициализация модуля
     */
    init() {
        console.log('🏷️ CRPT module initialized');
        this.renderCodes();
        this.renderStatistics();
        this.updateAPIStatus();
    }

    /**
     * Загрузка кодов маркировки
     */
    loadCodes() {
        const saved = this.system.loadFromLocalStorage('crptCodes');
        return saved || [
            {
                id: 1,
                codeDM: '0104...ABC123',
                gtin: '04607034160169',
                serial: '21N4Y7RSCUSNR',
                productId: 1,
                productName: 'Кроссовки Nike',
                status: 'sold',
                arrivalDate: '2024-01-10',
                saleDate: '2024-01-15',
                crptOperationId: 'op-456'
            },
            {
                id: 2,
                codeDM: '0104...DEF456',
                gtin: '04607034160169',
                serial: '21M3X6QTBVRMQ',
                productId: 2,
                productName: 'Футболка Adidas',
                status: 'in_stock',
                arrivalDate: '2024-01-12',
                saleDate: null,
                crptOperationId: null
            }
        ];
    }

    /**
     * Обновление статуса API
     */
    updateAPIStatus() {
        const statusElement = document.getElementById('crptAPIStatus');
        if (!statusElement) return;

        const statusBadge = this.apiStatus === 'connected' 
            ? '<span class="badge badge-success">Подключен</span>'
            : '<span class="badge badge-danger">Отключен</span>';

        statusElement.innerHTML = statusBadge;
    }

    /**
     * Отрисовка статистики
     */
    renderStatistics() {
        const container = document.getElementById('crptStatisticsContainer');
        if (!container) return;

        const received = this.codes.filter(c => c.status === 'received' || c.status === 'in_stock').length;
        const sold = this.codes.filter(c => c.status === 'sold').length;
        const inCirculation = received;

        container.innerHTML = `
            <table class="table">
                <tr>
                    <td><strong>Принято кодов</strong></td>
                    <td style="text-align: right;">${this.codes.length}</td>
                </tr>
                <tr>
                    <td><strong>Списано (реализация)</strong></td>
                    <td style="text-align: right;">${sold}</td>
                </tr>
                <tr>
                    <td><strong>В обороте</strong></td>
                    <td style="text-align: right;">${inCirculation}</td>
                </tr>
            </table>
        `;
    }

    /**
     * Отрисовка кодов маркировки
     */
    renderCodes() {
        const tbody = document.querySelector('#crptCodesBody');
        if (!tbody) return;

        if (this.codes.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 2rem; color: #999;">
                        Кодов маркировки пока нет
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.codes.map(code => {
            const statusBadge = this.getStatusBadge(code.status);

            return `
                <tr onclick="crptModule.showCodeDetails(${code.id})" style="cursor: pointer;">
                    <td>${new Date(code.arrivalDate).toLocaleDateString('ru-RU')}</td>
                    <td><code>${code.codeDM}</code></td>
                    <td>${code.productName}</td>
                    <td>${statusBadge}</td>
                    <td>
                        ${code.status === 'in_stock' ? `
                            <button class="btn btn-secondary btn-small" onclick="event.stopPropagation(); crptModule.writeoffCode(${code.id})">
                                📤 Списать
                            </button>
                        ` : '—'}
                    </td>
                </tr>
            `;
        }).join('');
    }

    /**
     * Получение бейджа статуса
     */
    getStatusBadge(status) {
        const badges = {
            'received': '<span class="badge badge-info">Принят</span>',
            'in_stock': '<span class="badge badge-success">В обороте</span>',
            'sold': '<span class="badge" style="background: #9ca3af; color: white;">Продан</span>',
            'written_off': '<span class="badge badge-warning">Списан</span>',
            'returned': '<span class="badge badge-danger">Возвращён</span>'
        };
        return badges[status] || status;
    }

    /**
     * Приёмка кода маркировки
     */
    scanCode() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: #094a45; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 2rem; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <h2 style="margin: 0 0 1.5rem 0; color: #eebc5c;">📥 Сканирование DataMatrix кода</h2>

                <div class="alert alert-info">
                    <span>📷</span>
                    <div>
                        <strong>Инструкция:</strong><br>
                        1. Используйте 2D-сканер для считывания DataMatrix<br>
                        2. Или введите код вручную<br>
                        3. Система автоматически проверит код в CRPT
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">DataMatrix код*</label>
                    <input type="text" class="form-input" id="dmCode" placeholder="0104607034160169..." 
                           style="font-family: monospace;">
                </div>

                <div class="form-group">
                    <label class="form-label">Товар*</label>
                    <select class="form-select" id="dmProduct">
                        <option value="">Выберите...</option>
                        ${this.system.products.map(p => `
                            <option value="${p.id}">${p.name}</option>
                        `).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Документ поступления</label>
                    <input type="text" class="form-input" id="dmDocument" placeholder="УПД-00123">
                </div>

                <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); color: #F3EADB; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; border-left: 4px solid #f59e0b;">
                    <strong>⚠️ Важно:</strong><br>
                    При приёмке код будет проверен в системе CRPT. Убедитесь, что код действителен и не использован ранее.
                </div>

                <div style="display: flex; gap: 1rem;">
                    <button onclick="crptModule.saveCode()" class="btn btn-primary">
                        ✅ Принять код
                    </button>
                    <button onclick="crptModule.startMassScanning()" class="btn btn-secondary">
                        📋 Массовая загрузка
                    </button>
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">
                        Отмена
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Фокус на поле кода
        setTimeout(() => {
            document.getElementById('dmCode').focus();
        }, 100);
    }

    /**
     * Сохранение кода
     */
    saveCode() {
        const dmCode = document.getElementById('dmCode').value.trim();
        const productId = parseInt(document.getElementById('dmProduct').value);
        const document = document.getElementById('dmDocument').value.trim();

        if (!dmCode || !productId) {
            alert('⚠️ Заполните обязательные поля');
            return;
        }

        // Проверка на дубли
        const exists = this.codes.find(c => c.codeDM === dmCode);
        if (exists) {
            alert('⚠️ Этот код уже есть в системе!');
            return;
        }

        const product = this.system.products.find(p => p.id === productId);
        if (!product) return;

        // Парсим DataMatrix (упрощённо)
        const gtin = dmCode.substring(2, 16); // GTIN из кода
        const serial = dmCode.substring(16, 29); // Серийный номер

        // Создаём код
        const newCode = {
            id: Date.now(),
            codeDM: dmCode,
            gtin,
            serial,
            productId,
            productName: product.name,
            status: 'received',
            arrivalDate: new Date().toISOString().split('T')[0],
            saleDate: null,
            crptOperationId: null,
            document
        };

        this.codes.unshift(newCode);
        this.system.saveToLocalStorage('crptCodes', this.codes);

        // Имитация отправки в CRPT
        setTimeout(() => {
            newCode.status = 'in_stock';
            newCode.crptOperationId = `op-${Date.now()}`;
            this.renderCodes();
            this.renderStatistics();
            console.log('✅ Код подтверждён в CRPT');
            this.showNotification(`✅ Код успешно принят!`, 'success');
        }, 1000);

        // Закрываем модалку
        document.querySelector('.modal-overlay').remove();

        // Обновляем список
        this.renderCodes();
        this.renderStatistics();

        this.showNotification('📤 Проверка кода в CRPT...', 'info');
    }

    /**
     * Массовое сканирование
     */
    startMassScanning() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: #094a45; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 2rem; max-width: 700px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <h2 style="margin: 0 0 1.5rem 0; color: #eebc5c;">📋 Массовая загрузка кодов</h2>

                <div class="alert alert-info">
                    <span>ℹ️</span>
                    <div>
                        <strong>Инструкция:</strong><br>
                        1. Загрузите CSV-файл с кодами DataMatrix<br>
                        2. Формат: codeDM, productName, document<br>
                        3. Или вставьте коды построчно в поле ниже
                    </div>
                </div>

                <div class="form-group">
                    <label class="form-label">Загрузить CSV</label>
                    <input type="file" class="form-input" accept=".csv" id="csvCodes">
                </div>

                <div class="form-group">
                    <label class="form-label">Или вставьте коды построчно</label>
                    <textarea class="form-input" id="codesList" rows="10" 
                              placeholder="0104607034160169...&#10;0104607034160170...&#10;0104607034160171..."></textarea>
                </div>

                <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                    <button onclick="crptModule.processMassCodes()" class="btn btn-primary">
                        📤 Загрузить
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
     * Обработка массовой загрузки
     */
    processMassCodes() {
        const codesList = document.getElementById('codesList').value.trim();
        
        if (!codesList) {
            alert('⚠️ Вставьте коды для загрузки');
            return;
        }

        const codes = codesList.split('\n').filter(c => c.trim());
        
        if (codes.length === 0) {
            alert('⚠️ Нет кодов для обработки');
            return;
        }

        // Закрываем модалку
        document.querySelector('.modal-overlay').remove();

        // Показываем прогресс
        this.showProgress(codes.length);

        // Обрабатываем коды постепенно
        let processed = 0;
        codes.forEach((code, index) => {
            setTimeout(() => {
                // Здесь бы была реальная обработка
                processed++;
                this.updateProgress(processed, codes.length);

                if (processed === codes.length) {
                    this.hideProgress();
                    this.showNotification(`✅ Загружено ${codes.length} кодов!`, 'success');
                    this.renderCodes();
                    this.renderStatistics();
                }
            }, index * 200);
        });
    }

    /**
     * Списание кода
     */
    writeoffCode(codeId) {
        const code = this.codes.find(c => c.id === codeId);
        if (!code) return;

        if (!confirm(`📤 Списать код маркировки?\n\nТовар: ${code.productName}\nКод: ${code.codeDM}\n\nОперация будет отправлена в CRPT.`)) {
            return;
        }

        // Обновляем статус
        code.status = 'sold';
        code.saleDate = new Date().toISOString().split('T')[0];
        code.crptOperationId = `sale-${Date.now()}`;

        this.system.saveToLocalStorage('crptCodes', this.codes);

        // Имитация отправки в CRPT
        setTimeout(() => {
            console.log('✅ Списание подтверждено в CRPT');
            this.showNotification(`✅ Код списан успешно!`, 'success');
        }, 1000);

        this.renderCodes();
        this.renderStatistics();

        this.showNotification('📤 Отправка операции в CRPT...', 'info');
    }

    /**
     * Детали кода
     */
    showCodeDetails(codeId) {
        const code = this.codes.find(c => c.id === codeId);
        if (!code) return;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: #094a45; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 2rem; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h2 style="margin: 0; color: #eebc5c;">🏷️ Код маркировки</h2>
                    <button onclick="this.closest('.modal-overlay').remove()" 
                            style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #999;">×</button>
                </div>

                <div style="background: #f9f9f9; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                    <div style="font-family: monospace; word-break: break-all; margin-bottom: 0.5rem;">
                        <strong>DataMatrix:</strong><br>
                        <code style="font-size: 0.9em;">${code.codeDM}</code>
                    </div>
                    <div><strong>GTIN:</strong> ${code.gtin}</div>
                    <div><strong>Серийный №:</strong> ${code.serial}</div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div>
                        <strong>Товар:</strong><br>
                        ${code.productName}
                    </div>
                    <div>
                        <strong>Статус:</strong><br>
                        ${this.getStatusBadge(code.status)}
                    </div>
                    <div>
                        <strong>Дата приёмки:</strong><br>
                        ${new Date(code.arrivalDate).toLocaleDateString('ru-RU')}
                    </div>
                    <div>
                        <strong>Дата продажи:</strong><br>
                        ${code.saleDate ? new Date(code.saleDate).toLocaleDateString('ru-RU') : '—'}
                    </div>
                </div>

                ${code.crptOperationId ? `
                    <div style="background: #f0f9ff; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                        <strong>ID операции CRPT:</strong><br>
                        <code>${code.crptOperationId}</code>
                    </div>
                ` : ''}

                <div style="display: flex; gap: 1rem;">
                    ${code.status === 'in_stock' ? `
                        <button onclick="crptModule.writeoffCode(${code.id}); this.closest('.modal-overlay').remove();" 
                                class="btn btn-primary">
                            📤 Списать
                        </button>
                    ` : ''}
                    <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">
                        Закрыть
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * Показать прогресс загрузки
     */
    showProgress(total) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'progressModal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7); display: flex; align-items: center;
            justify-content: center; z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: #094a45; color: #F3EADB; border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 2rem; max-width: 400px; width: 90%;">
                <h3 style="margin: 0 0 1rem 0; text-align: center;">Загрузка кодов...</h3>
                <div style="background: #e5e7eb; height: 20px; border-radius: 10px; overflow: hidden; margin-bottom: 1rem;">
                    <div id="progressBar" style="background: var(--dandy-green); height: 100%; width: 0%; transition: width 0.3s;"></div>
                </div>
                <div id="progressText" style="text-align: center; color: #666;">0 / ${total}</div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * Обновить прогресс
     */
    updateProgress(current, total) {
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        
        if (progressBar && progressText) {
            const percent = (current / total) * 100;
            progressBar.style.width = `${percent}%`;
            progressText.textContent = `${current} / ${total}`;
        }
    }

    /**
     * Скрыть прогресс
     */
    hideProgress() {
        const modal = document.getElementById('progressModal');
        if (modal) {
            modal.remove();
        }
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
    module.exports = CRPTModule;
}

