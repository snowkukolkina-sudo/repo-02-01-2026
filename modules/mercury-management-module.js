/**
 * DANDY Mercury (VSD) Management Module
 * Управление системой Меркурий и ВСД
 */

class MercuryManagementModule {
    constructor() {
        this.batches = [];
        this.documents = [];
        this.API_BASE = '/api/mercury';
        this.rootElementId = 'mercuryModuleRoot';
    }

    async init() {
        console.log('🔬 Mercury Management Module initialized');
        await this.loadBatches();
        await this.loadDocuments();
        this.render();
    }

    async refresh() {
        await Promise.all([this.loadBatches(), this.loadDocuments()]);
        this.render();
    }

    async loadBatches() {
        try {
            const response = await fetch(`${this.API_BASE}/batches`);
            const data = await response.json();
            if (data.success) {
                this.batches = data.data;
            }
        } catch (error) {
            console.error('Error loading Mercury batches:', error);
            // Fallback data
            this.batches = [
                {
                    id: 1,
                    product_name: 'Лосось свежий',
                    batch_number: 'LS-2024-001',
                    quantity: 5.2,
                    unit: 'кг',
                    production_date: '2024-01-10',
                    expiry_date: '2024-01-20',
                    supplier: 'ООО "Рыбный мир"',
                    status: 'active',
                    guid: '123e4567-e89b-12d3-a456-426614174000'
                },
                {
                    id: 2,
                    product_name: 'Мясо говядина',
                    batch_number: 'MG-2024-002',
                    quantity: 12.5,
                    unit: 'кг',
                    production_date: '2024-01-12',
                    expiry_date: '2024-01-22',
                    supplier: 'ООО "Мясокомбинат"',
                    status: 'redeemed',
                    guid: '123e4567-e89b-12d3-a456-426614174001'
                },
                {
                    id: 3,
                    product_name: 'Молоко пастеризованное',
                    batch_number: 'ML-2024-003',
                    quantity: 20.0,
                    unit: 'л',
                    production_date: '2024-01-15',
                    expiry_date: '2024-01-18',
                    supplier: 'ООО "Молочный завод"',
                    status: 'expired',
                    guid: '123e4567-e89b-12d3-a456-426614174002'
                }
            ];
        }
    }

    async loadDocuments() {
        try {
            const response = await fetch(`${this.API_BASE}/documents`);
            const data = await response.json();
            if (data.success) {
                this.documents = data.data;
            }
        } catch (error) {
            console.error('Error loading Mercury documents:', error);
            // Fallback data
            this.documents = [
                {
                    id: 1,
                    type: 'VSD',
                    number: 'ВСД-001',
                    date: '2024-01-15',
                    supplier: 'ООО "Рыбный мир"',
                    status: 'received',
                    batches_count: 3
                },
                {
                    id: 2,
                    type: 'VSD',
                    number: 'ВСД-002',
                    date: '2024-01-14',
                    supplier: 'ООО "Мясокомбинат"',
                    status: 'processing',
                    batches_count: 5
                }
            ];
        }
    }

    render() {
        const container = document.getElementById(this.rootElementId) || document.getElementById('mercury');
        if (!container) return;

        container.innerHTML = `
            <div class="mercury-management">
                <!-- Header -->
                <div class="mercury-header">
                    <h2>🔬 Меркурий (ВСД)</h2>
                    <div class="mercury-actions">
                        <button class="btn btn-primary" onclick="mercuryModule.receiveBatch()">
                            📥 Принять партию
                        </button>
                        <button class="btn btn-secondary" onclick="mercuryModule.redeemBatch()">
                            ✅ Погасить партию
                        </button>
                        <button class="btn btn-warning" onclick="mercuryModule.showExpiringBatches()">
                            ⚠️ Просроченные
                        </button>
                    </div>
                </div>

                <!-- Stats -->
                <div class="mercury-stats grid grid-4" style="margin-top: 1rem;">
                    <div class="card">
                        <h4>Всего партий</h4>
                        <div class="stat-value">${this.batches.length}</div>
                    </div>
                    <div class="card">
                        <h4>Активные</h4>
                        <div class="stat-value text-success">${this.batches.filter(b => b.status === 'active').length}</div>
                    </div>
                    <div class="card">
                        <h4>Погашенные</h4>
                        <div class="stat-value text-secondary">${this.batches.filter(b => b.status === 'redeemed').length}</div>
                    </div>
                    <div class="card">
                        <h4>Просроченные</h4>
                        <div class="stat-value text-danger">${this.batches.filter(b => b.status === 'expired').length}</div>
                    </div>
                </div>

                <!-- Tabs -->
                <div class="tabs-container" style="margin-top: 1.5rem;">
                    <div class="tabs-nav">
                        <button class="tab-button active" onclick="mercuryModule.switchTab('batches', event)">📦 Партии</button>
                        <button class="tab-button" onclick="mercuryModule.switchTab('documents', event)">📄 ВСД</button>
                        <button class="tab-button" onclick="mercuryModule.switchTab('settings', event)">⚙️ Настройки</button>
                    </div>

                    <div id="batches-tab" class="tab-content active">
                        ${this.renderBatchesTab()}
                    </div>

                    <div id="documents-tab" class="tab-content">
                        ${this.renderDocumentsTab()}
                    </div>

                    <div id="settings-tab" class="tab-content">
                        ${this.renderSettingsTab()}
                    </div>
                </div>
            </div>
        `;
    }

    renderBatchesTab() {
        return `
            <div class="card">
                <div class="card-header">
                    <h3>Партии товаров</h3>
                    <div style="display: flex; gap: 1rem; align-items: center;">
                        <select id="batchStatusFilter" class="form-input" style="width: 150px;">
                            <option value="">Все статусы</option>
                            <option value="active">Активные</option>
                            <option value="redeemed">Погашенные</option>
                            <option value="expired">Просроченные</option>
                        </select>
                        <button class="btn btn-secondary btn-small" onclick="mercuryModule.filterBatches()">Фильтр</button>
                    </div>
                </div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Продукт</th>
                                <th>Номер партии</th>
                                <th>Количество</th>
                                <th>Производство</th>
                                <th>Срок годности</th>
                                <th>Поставщик</th>
                                <th>Статус</th>
                                <th>Действия</th>
                            </tr>
                        </thead>
                        <tbody id="batchesTableBody">
                            ${this.renderBatchesRows()}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    renderBatchesRows() {
        if (this.batches.length === 0) {
            return '<tr><td colspan="8" style="text-align: center;">Нет партий</td></tr>';
        }

        return this.batches.map(batch => {
            const productionDate = new Date(batch.production_date);
            const expiryDate = new Date(batch.expiry_date);
            const today = new Date();
            const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
            
            let statusClass = 'secondary';
            let statusText = 'Неизвестно';
            
            switch (batch.status) {
                case 'active':
                    statusClass = 'success';
                    statusText = '✅ Активна';
                    break;
                case 'redeemed':
                    statusClass = 'secondary';
                    statusText = '✅ Погашена';
                    break;
                case 'expired':
                    statusClass = 'danger';
                    statusText = '❌ Просрочена';
                    break;
            }

            return `
                <tr data-status="${batch.status}">
                    <td><strong>${batch.product_name}</strong></td>
                    <td><code>${batch.batch_number}</code></td>
                    <td>${batch.quantity} ${batch.unit}</td>
                    <td>${productionDate.toLocaleDateString('ru-RU')}</td>
                    <td>${expiryDate.toLocaleDateString('ru-RU')} ${daysUntilExpiry <= 3 ? '⚠️' : ''}</td>
                    <td>${batch.supplier}</td>
                    <td><span class="badge badge-${statusClass}">${statusText}</span></td>
                    <td>
                        <button class="btn btn-small" onclick="mercuryModule.viewBatch('${batch.id}')">👁️</button>
                        ${batch.status === 'active' ? 
                            `<button class="btn btn-small btn-success" onclick="mercuryModule.redeemBatchById('${batch.id}')">✅</button>` : 
                            ''}
                        <button class="btn btn-small" onclick="mercuryModule.printBatch('${batch.id}')">🖨️</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    renderDocumentsTab() {
        return `
            <div class="card">
                <div class="card-header">
                    <h3>ВСД (Ветеринарные сопроводительные документы)</h3>
                </div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Тип</th>
                                <th>Номер</th>
                                <th>Дата</th>
                                <th>Поставщик</th>
                                <th>Партий</th>
                                <th>Статус</th>
                                <th>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.documents.map(doc => `
                                <tr>
                                    <td>${doc.type}</td>
                                    <td><strong>${doc.number}</strong></td>
                                    <td>${new Date(doc.date).toLocaleDateString('ru-RU')}</td>
                                    <td>${doc.supplier}</td>
                                    <td>${doc.batches_count}</td>
                                    <td><span class="badge badge-${doc.status === 'received' ? 'success' : 'warning'}">${doc.status === 'received' ? '✅ Получен' : '⏳ Обработка'}</span></td>
                                    <td>
                                        <button class="btn btn-small" onclick="mercuryModule.viewDocument('${doc.id}')">👁️</button>
                                        <button class="btn btn-small" onclick="mercuryModule.downloadDocument('${doc.id}')">📥</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    renderSettingsTab() {
        return `
            <div class="card">
                <div class="card-header">
                    <h3>Настройки Меркурий</h3>
                </div>
                <div class="mercury-settings">
                    <div class="form-group">
                        <label class="form-label">URL API Меркурий</label>
                        <input type="text" id="mercuryApiUrl" class="form-input" value="https://api.mercury.vetrf.ru" placeholder="https://api.mercury.vetrf.ru">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Идентификатор организации</label>
                        <input type="text" id="organizationId" class="form-input" placeholder="GUID организации">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Сертификат ЭП</label>
                        <input type="file" id="certificateFile" class="form-input" accept=".p12,.pfx">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Пароль к сертификату</label>
                        <input type="password" id="certificatePassword" class="form-input" placeholder="Пароль к сертификату">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Автоматическое погашение</label>
                        <input type="checkbox" id="autoRedeem" class="form-input">
                        <small>Автоматически погашать партии при продаже</small>
                    </div>
                    <div class="form-actions">
                        <button class="btn btn-secondary" onclick="mercuryModule.testConnection()">🔗 Тест подключения</button>
                        <button class="btn btn-primary" onclick="mercuryModule.saveSettings()">💾 Сохранить настройки</button>
                    </div>
                </div>
            </div>
        `;
    }

    switchTab(tabName, evt) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });

        // Show selected tab
        document.getElementById(`${tabName}-tab`).classList.add('active');
        if (evt && evt.target) {
            evt.target.classList.add('active');
        }
    }

    receiveBatch() {
        const modal = this.createModal('Принять партию', `
            <form id="receiveBatchForm">
                <div class="form-group">
                    <label class="form-label">Номер ВСД *</label>
                    <input type="text" name="vsd_number" class="form-input" required placeholder="ВСД-001">
                </div>
                <div class="form-group">
                    <label class="form-label">Наименование продукта *</label>
                    <input type="text" name="product_name" class="form-input" required placeholder="Лосось свежий">
                </div>
                <div class="form-group">
                    <label class="form-label">Номер партии *</label>
                    <input type="text" name="batch_number" class="form-input" required placeholder="LS-2024-001">
                </div>
                <div class="grid grid-2">
                    <div class="form-group">
                        <label class="form-label">Количество *</label>
                        <input type="number" name="quantity" class="form-input" step="0.01" min="0" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Единица измерения *</label>
                        <select name="unit" class="form-input" required>
                            <option value="кг">кг</option>
                            <option value="л">л</option>
                            <option value="шт">шт</option>
                            <option value="г">г</option>
                        </select>
                    </div>
                </div>
                <div class="grid grid-2">
                    <div class="form-group">
                        <label class="form-label">Дата производства *</label>
                        <input type="date" name="production_date" class="form-input" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Срок годности *</label>
                        <input type="date" name="expiry_date" class="form-input" required>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Поставщик *</label>
                    <input type="text" name="supplier" class="form-input" required placeholder="ООО 'Название компании'">
                </div>
                <div class="form-group">
                    <label class="form-label">GUID партии</label>
                    <input type="text" name="guid" class="form-input" placeholder="Автоматически сгенерируется">
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="mercuryModule.closeModal()">Отмена</button>
                    <button type="submit" class="btn btn-primary">📥 Принять партию</button>
                </div>
            </form>
        `);

        // Устанавливаем текущую дату
        const today = new Date().toISOString().split('T')[0];
        document.querySelector('input[name="production_date"]').value = today;

        document.getElementById('receiveBatchForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.processReceiveBatch(new FormData(e.target));
        });
    }

    async processReceiveBatch(formData) {
         try {
            const payload = {};
            for (const [key, value] of formData.entries()) {
                payload[key] = value;
            }
            payload.status = 'active';
            payload.quantity = parseFloat(payload.quantity || '0');
            payload.guid = payload.guid || this.generateGUID();

            const response = await fetch(`${this.API_BASE}/batches`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Не удалось сохранить партию');
            }

            alert('✅ Партия принята!');
            this.closeModal();
            await this.refresh();
        } catch (error) {
            console.error('Error receiving batch:', error);
            alert('❌ Ошибка при приёме партии');
        }
    }

    redeemBatch() {
        const activeBatches = this.batches.filter(b => b.status === 'active');
        if (activeBatches.length === 0) {
            alert('Нет активных партий для погашения');
            return;
        }

        const modal = this.createModal('Погасить партию', `
            <form id="redeemBatchForm">
                <div class="form-group">
                    <label class="form-label">Выберите партию *</label>
                    <select name="batch_id" class="form-input" required>
                        <option value="">Выберите партию</option>
                        ${activeBatches.map(batch => `
                            <option value="${batch.id}">${batch.product_name} - ${batch.batch_number} (${batch.quantity} ${batch.unit})</option>
                        `).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Количество для погашения *</label>
                    <input type="number" name="quantity" class="form-input" step="0.01" min="0" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Причина погашения *</label>
                    <select name="reason" class="form-input" required>
                        <option value="">Выберите причину</option>
                        <option value="sale">Продажа</option>
                        <option value="spoilage">Порча</option>
                        <option value="loss">Потеря</option>
                        <option value="return">Возврат поставщику</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Комментарий</label>
                    <textarea name="comment" class="form-input" rows="3" placeholder="Дополнительная информация"></textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="mercuryModule.closeModal()">Отмена</button>
                    <button type="submit" class="btn btn-success">✅ Погасить партию</button>
                </div>
            </form>
        `);

        document.getElementById('redeemBatchForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.processRedeemBatch(new FormData(e.target));
        });
    }

    async processRedeemBatch(formData) {
        try {
            const batchId = formData.get('batch_id');
            const quantity = parseFloat(formData.get('quantity'));
            const reason = formData.get('reason');

            const response = await fetch(`${this.API_BASE}/batches/${batchId}/redeem`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity, reason })
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Не удалось погасить партию');
            }

            alert('✅ Партия погашена!');
            this.closeModal();
            await this.refresh();
        } catch (error) {
            console.error('Error redeeming batch:', error);
            alert('❌ Ошибка при погашении партии');
        }
    }

    async redeemBatchById(batchId) {
        const batch = this.batches.find(b => b.id == batchId);
        if (!batch) return;

        if (confirm(`Погасить всю партию ${batch.product_name} (${batch.batch_number})?`)) {
            try {
                const response = await fetch(`${this.API_BASE}/batches/${batchId}/redeem`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ quantity: batch.quantity, reason: 'manual' })
                });
                const result = await response.json();
                if (!response.ok || !result.success) {
                    throw new Error(result.error || 'Не удалось погасить партию');
                }
                alert('✅ Партия погашена!');
                await this.refresh();
            } catch (error) {
                console.error('Error redeeming batch:', error);
                alert('❌ Ошибка при погашении партии');
            }
        }
    }

    showExpiringBatches() {
        const expiringBatches = this.batches.filter(batch => {
            const expiryDate = new Date(batch.expiry_date);
            const today = new Date();
            const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
            return daysUntilExpiry <= 3 && batch.status === 'active';
        });

        if (expiringBatches.length === 0) {
            alert('Нет партий с истекающим сроком годности');
            return;
        }

        const modal = this.createModal('Партии с истекающим сроком годности', `
            <div class="expiring-batches">
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Продукт</th>
                                <th>Партия</th>
                                <th>Остаток</th>
                                <th>Срок годности</th>
                                <th>Дней до истечения</th>
                                <th>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${expiringBatches.map(batch => {
                                const expiryDate = new Date(batch.expiry_date);
                                const today = new Date();
                                const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
                                
                                return `
                                    <tr>
                                        <td><strong>${batch.product_name}</strong></td>
                                        <td><code>${batch.batch_number}</code></td>
                                        <td>${batch.quantity} ${batch.unit}</td>
                                        <td>${expiryDate.toLocaleDateString('ru-RU')}</td>
                                        <td><span class="badge badge-danger">${daysUntilExpiry} дней</span></td>
                                        <td>
                                            <button class="btn btn-small btn-success" onclick="mercuryModule.redeemBatchById('${batch.id}')">✅ Погасить</button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="form-actions">
                    <button class="btn btn-secondary" onclick="mercuryModule.closeModal()">Закрыть</button>
                </div>
            </div>
        `, '', 'large');
    }

    viewBatch(batchId) {
        const batch = this.batches.find(b => b.id == batchId);
        if (!batch) return;

        const modal = this.createModal(`Партия: ${batch.product_name}`, `
            <div class="batch-details">
                <div class="grid grid-2">
                    <div>
                        <p><strong>Продукт:</strong> ${batch.product_name}</p>
                        <p><strong>Номер партии:</strong> ${batch.batch_number}</p>
                        <p><strong>Количество:</strong> ${batch.quantity} ${batch.unit}</p>
                        <p><strong>Поставщик:</strong> ${batch.supplier}</p>
                    </div>
                    <div>
                        <p><strong>Дата производства:</strong> ${new Date(batch.production_date).toLocaleDateString('ru-RU')}</p>
                        <p><strong>Срок годности:</strong> ${new Date(batch.expiry_date).toLocaleDateString('ru-RU')}</p>
                        <p><strong>Статус:</strong> ${batch.status}</p>
                        <p><strong>GUID:</strong> <code>${batch.guid}</code></p>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button class="btn btn-secondary" onclick="mercuryModule.closeModal()">Закрыть</button>
                    ${batch.status === 'active' ? 
                        `<button class="btn btn-success" onclick="mercuryModule.redeemBatchById('${batch.id}')">✅ Погасить</button>` : 
                        ''}
                    <button class="btn btn-primary" onclick="mercuryModule.printBatch('${batch.id}')">🖨️ Печать</button>
                </div>
            </div>
        `, '', 'large');
    }

    printBatch(batchId) {
        const batch = this.batches.find(b => b.id == batchId);
        if (!batch) return;

        alert(`🖨️ Печать этикетки для партии ${batch.batch_number}...`);
    }

    viewDocument(docId) {
        const doc = this.documents.find(d => d.id == docId);
        if (!doc) return;

        const modal = this.createModal(`ВСД: ${doc.number}`, `
            <div class="document-details">
                <div class="grid grid-2">
                    <div>
                        <p><strong>Тип:</strong> ${doc.type}</p>
                        <p><strong>Номер:</strong> ${doc.number}</p>
                        <p><strong>Дата:</strong> ${new Date(doc.date).toLocaleDateString('ru-RU')}</p>
                        <p><strong>Поставщик:</strong> ${doc.supplier}</p>
                    </div>
                    <div>
                        <p><strong>Количество партий:</strong> ${doc.batches_count}</p>
                        <p><strong>Статус:</strong> ${doc.status}</p>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button class="btn btn-secondary" onclick="mercuryModule.closeModal()">Закрыть</button>
                    <button class="btn btn-primary" onclick="mercuryModule.downloadDocument('${doc.id}')">📥 Скачать</button>
                </div>
            </div>
        `, '', 'large');
    }

    downloadDocument(docId) {
        const doc = this.documents.find(d => d.id == docId);
        if (!doc) return;

        alert(`📥 Скачивание ВСД ${doc.number}...`);
    }

    filterBatches() {
        const statusFilter = document.getElementById('batchStatusFilter').value;
        const rows = document.querySelectorAll('#batchesTableBody tr');
        
        rows.forEach(row => {
            if (!statusFilter) {
                row.style.display = '';
            } else {
                row.style.display = row.getAttribute('data-status') === statusFilter ? '' : 'none';
            }
        });
    }

    async testConnection() {
        try {
            const response = await fetch(`${this.API_BASE}/batches`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            alert('✅ Соединение с Меркурий доступно (демо режим)');
        } catch (error) {
            console.error('Mercury connection test failed', error);
            alert('❌ Не удалось подключиться к Меркурий: ' + error.message);
        }
    }

    async saveSettings() {
        try {
            const payload = {
                apiUrl: document.getElementById('mercuryApiUrl')?.value || '',
                organizationId: document.getElementById('organizationId')?.value || '',
                autoRedeem: Boolean(document.getElementById('autoRedeem')?.checked)
            };

            const response = await fetch(`${this.API_BASE}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.error || 'Не удалось сохранить настройки');
            }

            alert('💾 Настройки Меркурий сохранены!');
        } catch (error) {
            console.error('Failed to save Mercury settings', error);
            alert('❌ Ошибка сохранения настроек: ' + error.message);
        }
    }

    generateGUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    createModal(title, content, footer = '', size = 'normal') {
        // Удаляем существующие модальные окна
        const existingModals = document.querySelectorAll('.modal-overlay');
        existingModals.forEach(modal => modal.remove());

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content ${size === 'large' ? 'large' : ''}">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="mercuryModule.closeModal()">×</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
            </div>
        `;
        
        // Добавляем обработчик клика по фону для закрытия
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });

        document.body.appendChild(modal);
        
        // Фокус на первое поле ввода
        setTimeout(() => {
            const firstInput = modal.querySelector('input, select, textarea');
            if (firstInput) {
                firstInput.focus();
            }
        }, 100);

        return modal;
    }

    closeModal() {
        const modals = document.querySelectorAll('.modal-overlay');
        modals.forEach(modal => modal.remove());
    }
}

// Initialize module
if (typeof window !== 'undefined') {
    window.MercuryManagementModule = MercuryManagementModule;
    window.mercuryModule = new MercuryManagementModule();
}
