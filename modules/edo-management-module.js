/**
 * DANDY EDO Management Module
 * Управление электронным документооборотом
 */

class EDOManagementModule {
    constructor() {
        this.documents = [];
        this.API_BASE = '/api/edo';
    }

    async init() {
        console.log('📄 EDO Management Module initialized');
        await this.loadDocuments();
        this.render();
    }

    async loadDocuments() {
        try {
            const response = await fetch(`${this.API_BASE}/documents`);
            const data = await response.json();
            if (data.success) {
                this.documents = data.data;
            }
        } catch (error) {
            console.error('Error loading EDO documents:', error);
            // Fallback data
            this.documents = [
                {
                    id: 1,
                    type: 'incoming',
                    number: 'УПД-001',
                    date: '2024-01-15',
                    counterparty: 'ООО "Поставщик продуктов"',
                    amount: 25000,
                    status: 'signed',
                    description: 'Поставка продуктов питания'
                },
                {
                    id: 2,
                    type: 'outgoing',
                    number: 'УПД-002',
                    date: '2024-01-14',
                    counterparty: 'ИП Иванов И.И.',
                    amount: 15000,
                    status: 'pending',
                    description: 'Поставка оборудования'
                },
                {
                    id: 3,
                    type: 'incoming',
                    number: 'УПД-003',
                    date: '2024-01-13',
                    counterparty: 'ООО "Мясокомбинат"',
                    amount: 45000,
                    status: 'rejected',
                    description: 'Поставка мясной продукции'
                }
            ];
        }
    }

    render() {
        const container = document.getElementById('edoContent') || document.getElementById('edo');
        if (!container) return;

        container.innerHTML = `
            <div class="edo-management">
                <!-- Header -->
                <div class="edo-header">
                    <h2>📄 Электронный документооборот (ЭДО)</h2>
                    <div class="edo-actions">
                        <button class="btn btn-primary" onclick="edoModule.createDocument()">
                            ➕ Создать документ
                        </button>
                        <button class="btn btn-secondary" onclick="edoModule.importDocuments()">
                            📥 Импорт документов
                        </button>
                    </div>
                </div>

                <!-- Stats -->
                <div class="edo-stats grid grid-4" style="margin-top: 1rem;">
                    <div class="card">
                        <h4>Всего документов</h4>
                        <div class="stat-value">${this.documents.length}</div>
                    </div>
                    <div class="card">
                        <h4>Подписанные</h4>
                        <div class="stat-value text-success">${this.documents.filter(d => d.status === 'signed').length}</div>
                    </div>
                    <div class="card">
                        <h4>На подписании</h4>
                        <div class="stat-value text-warning">${this.documents.filter(d => d.status === 'pending').length}</div>
                    </div>
                    <div class="card">
                        <h4>Отклонённые</h4>
                        <div class="stat-value text-danger">${this.documents.filter(d => d.status === 'rejected').length}</div>
                    </div>
                </div>

                <!-- Filters -->
                <div class="card" style="margin-top: 1rem;">
                    <div class="card-header">
                        <h3>Фильтры</h3>
                    </div>
                    <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                        <select id="typeFilter" class="form-input" style="width: 150px;">
                            <option value="">Все типы</option>
                            <option value="incoming">Входящие</option>
                            <option value="outgoing">Исходящие</option>
                        </select>
                        <select id="statusFilter" class="form-input" style="width: 150px;">
                            <option value="">Все статусы</option>
                            <option value="signed">Подписанные</option>
                            <option value="pending">На подписании</option>
                            <option value="rejected">Отклонённые</option>
                        </select>
                        <input type="date" id="dateFrom" class="form-input" style="width: 150px;">
                        <input type="date" id="dateTo" class="form-input" style="width: 150px;">
                        <button class="btn btn-secondary btn-small" onclick="edoModule.applyFilters()">Применить</button>
                        <button class="btn btn-secondary btn-small" onclick="edoModule.clearFilters()">Сбросить</button>
                    </div>
                </div>

                <!-- Documents Table -->
                <div class="card" style="margin-top: 1rem;">
                    <div class="card-header">
                        <h3>Документы</h3>
                    </div>
                    <div class="table-responsive">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Тип</th>
                                    <th>Номер</th>
                                    <th>Дата</th>
                                    <th>Контрагент</th>
                                    <th>Сумма</th>
                                    <th>Статус</th>
                                    <th>Описание</th>
                                    <th>Действия</th>
                                </tr>
                            </thead>
                            <tbody id="documentsTableBody">
                                ${this.renderDocumentsRows()}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        // Event listeners
        document.getElementById('typeFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('statusFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('dateFrom').addEventListener('change', () => this.applyFilters());
        document.getElementById('dateTo').addEventListener('change', () => this.applyFilters());
    }

    renderDocumentsRows() {
        if (this.documents.length === 0) {
            return '<tr><td colspan="8" style="text-align: center;">Нет документов</td></tr>';
        }

        return this.documents.map(doc => {
            const typeIcon = doc.type === 'incoming' ? '📥' : '📤';
            const typeText = doc.type === 'incoming' ? 'Входящий' : 'Исходящий';
            
            let statusClass = 'secondary';
            let statusText = 'Неизвестно';
            
            switch (doc.status) {
                case 'signed':
                    statusClass = 'success';
                    statusText = '✅ Подписан';
                    break;
                case 'pending':
                    statusClass = 'warning';
                    statusText = '⏳ На подписании';
                    break;
                case 'rejected':
                    statusClass = 'danger';
                    statusText = '❌ Отклонён';
                    break;
            }

            return `
                <tr data-type="${doc.type}" data-status="${doc.status}">
                    <td>${typeIcon} ${typeText}</td>
                    <td><strong>${doc.number}</strong></td>
                    <td>${new Date(doc.date).toLocaleDateString('ru-RU')}</td>
                    <td>${doc.counterparty}</td>
                    <td>₽ ${doc.amount.toLocaleString()}</td>
                    <td><span class="badge badge-${statusClass}">${statusText}</span></td>
                    <td>${doc.description}</td>
                    <td>
                        <button class="btn btn-small" onclick="edoModule.viewDocument('${doc.id}')">👁️</button>
                        ${doc.status === 'pending' ? 
                            `<button class="btn btn-small btn-success" onclick="edoModule.signDocument('${doc.id}')">✍️</button>` : 
                            ''}
                        <button class="btn btn-small" onclick="edoModule.downloadDocument('${doc.id}')">📥</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    createDocument() {
        const modal = this.createModal('Создать документ', `
            <form id="documentForm">
                <div class="form-group">
                    <label class="form-label">Тип документа *</label>
                    <select name="type" class="form-input" required>
                        <option value="">Выберите тип</option>
                        <option value="outgoing">📤 Исходящий</option>
                        <option value="incoming">📥 Входящий</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Номер документа *</label>
                    <input type="text" name="number" class="form-input" required placeholder="УПД-001">
                </div>
                <div class="form-group">
                    <label class="form-label">Дата *</label>
                    <input type="date" name="date" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Контрагент *</label>
                    <input type="text" name="counterparty" class="form-input" required placeholder="ООО 'Название компании'">
                </div>
                <div class="form-group">
                    <label class="form-label">Сумма *</label>
                    <input type="number" name="amount" class="form-input" step="0.01" min="0" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Описание</label>
                    <textarea name="description" class="form-input" rows="3" placeholder="Описание документа"></textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="edoModule.closeModal()">Отмена</button>
                    <button type="submit" class="btn btn-primary">💾 Создать документ</button>
                </div>
            </form>
        `);

        // Устанавливаем текущую дату
        document.querySelector('input[name="date"]').value = new Date().toISOString().split('T')[0];

        document.getElementById('documentForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitDocument(new FormData(e.target));
        });
    }

    async submitDocument(formData) {
        try {
            const data = {};
            for (const [key, value] of formData.entries()) {
                data[key] = value;
            }
            data.status = 'pending';

            // Добавляем документ в список
            const newDoc = {
                id: this.documents.length + 1,
                ...data,
                amount: parseFloat(data.amount)
            };
            this.documents.unshift(newDoc);

            alert('✅ Документ создан!');
            this.closeModal();
            this.render();
        } catch (error) {
            console.error('Error creating document:', error);
            alert('❌ Ошибка при создании документа');
        }
    }

    viewDocument(docId) {
        const doc = this.documents.find(d => d.id == docId);
        if (!doc) return;

        const modal = this.createModal(`Документ: ${doc.number}`, `
            <div class="document-details">
                <div class="grid grid-2">
                    <div>
                        <p><strong>Тип:</strong> ${doc.type === 'incoming' ? '📥 Входящий' : '📤 Исходящий'}</p>
                        <p><strong>Номер:</strong> ${doc.number}</p>
                        <p><strong>Дата:</strong> ${new Date(doc.date).toLocaleDateString('ru-RU')}</p>
                        <p><strong>Контрагент:</strong> ${doc.counterparty}</p>
                    </div>
                    <div>
                        <p><strong>Сумма:</strong> ₽ ${doc.amount.toLocaleString()}</p>
                        <p><strong>Статус:</strong> ${doc.status}</p>
                        <p><strong>Описание:</strong> ${doc.description}</p>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button class="btn btn-secondary" onclick="edoModule.closeModal()">Закрыть</button>
                    ${doc.status === 'pending' ? 
                        `<button class="btn btn-success" onclick="edoModule.signDocument('${doc.id}')">✍️ Подписать</button>` : 
                        ''}
                    <button class="btn btn-primary" onclick="edoModule.downloadDocument('${doc.id}')">📥 Скачать</button>
                </div>
            </div>
        `, '', 'large');
    }

    signDocument(docId) {
        const doc = this.documents.find(d => d.id == docId);
        if (!doc) return;

        if (confirm(`Подписать документ ${doc.number}?`)) {
            doc.status = 'signed';
            alert('✅ Документ подписан!');
            this.render();
        }
    }

    downloadDocument(docId) {
        const doc = this.documents.find(d => d.id == docId);
        if (!doc) return;

        alert(`📥 Скачивание документа ${doc.number}...`);
        // Здесь была бы логика скачивания
    }

    importDocuments() {
        const modal = this.createModal('Импорт документов', `
            <div class="import-documents">
                <div class="form-group">
                    <label class="form-label">Выберите файл</label>
                    <input type="file" id="documentFile" class="form-input" accept=".xml,.pdf,.zip">
                    <small>Поддерживаются форматы: XML, PDF, ZIP</small>
                </div>
                <div class="form-group">
                    <label class="form-label">Тип импорта</label>
                    <select id="importType" class="form-input">
                        <option value="auto">Автоматическое определение</option>
                        <option value="upd">УПД (Универсальный передаточный документ)</option>
                        <option value="invoice">Счёт-фактура</option>
                        <option value="act">Акт выполненных работ</option>
                    </select>
                </div>
                <div class="form-actions">
                    <button class="btn btn-secondary" onclick="edoModule.closeModal()">Отмена</button>
                    <button class="btn btn-primary" onclick="edoModule.processImport()">📥 Импортировать</button>
                </div>
            </div>
        `);
    }

    processImport() {
        const file = document.getElementById('documentFile').files[0];
        const importType = document.getElementById('importType').value;

        if (!file) {
            alert('Выберите файл для импорта');
            return;
        }

        alert(`📥 Импорт файла ${file.name} (${importType})...`);
        this.closeModal();
    }

    applyFilters() {
        const typeFilter = document.getElementById('typeFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;
        const dateFrom = document.getElementById('dateFrom').value;
        const dateTo = document.getElementById('dateTo').value;

        const rows = document.querySelectorAll('#documentsTableBody tr');
        
        rows.forEach(row => {
            let show = true;
            
            if (typeFilter && row.getAttribute('data-type') !== typeFilter) {
                show = false;
            }
            
            if (statusFilter && row.getAttribute('data-status') !== statusFilter) {
                show = false;
            }
            
            // Здесь можно добавить фильтрацию по датам
            
            row.style.display = show ? '' : 'none';
        });
    }

    clearFilters() {
        document.getElementById('typeFilter').value = '';
        document.getElementById('statusFilter').value = '';
        document.getElementById('dateFrom').value = '';
        document.getElementById('dateTo').value = '';
        this.applyFilters();
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
                    <button class="modal-close" onclick="edoModule.closeModal()">×</button>
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
    window.EDOManagementModule = EDOManagementModule;
    window.edoModule = new EDOManagementModule();
}
