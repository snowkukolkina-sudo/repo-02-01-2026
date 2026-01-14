(function (global) {
    'use strict';

    const API_BASE = '/api/edo';
    const DIADOC_IMPORT_PREVIEW_URL = '/api/diadoc/import/preview';
    const DIADOC_IMPORT_APPLY_URL = '/api/diadoc/import/apply';

    const SAMPLE_DOCUMENTS = [
        {
            docflowId: 'sample-demo-001',
            documentId: 'msg-001',
            type: 'UniversalTransferDocument',
            status: 'incoming',
            counterparty: 'ООО «Ромашка Снаб»',
            date: '2025-02-14T09:25:00Z',
            total: 12890.45,
            number: 'УПД №154 от 14.02.2025'
        }
    ];

    const SAMPLE_LINES = [
        {
            name: 'Сыр Моцарелла 45%',
            quantity: 10,
            unitName: 'кг',
            price: 820,
            subtotal: 8200,
            vatRate: '20%',
            barcode: '4601234000017',
            article: 'MOZ45',
            itemCode: 'A001'
        }
    ];

    const INVENTORY = [
        { id: 'prd-100', type: 'ingredient', name: 'Соус томатный базовый', barcode: '4601234000024', article: 'SAUCE-TOM', synonyms: ['соус томатный', 'соус для пиццы'], vatRate: '10%' },
        { id: 'prd-101', type: 'ingredient', name: 'Сыр Моцарелла 45%', barcode: '4601234000017', article: 'MOZ45', synonyms: ['моцарелла', 'сыр моцарелла'], vatRate: '20%' },
        { id: 'prd-102', type: 'package', name: 'Коробка пиццы 33 см', barcode: '', article: 'BOX-33', synonyms: ['коробка', 'упаковка пиццы'], vatRate: '20%' },
        { id: 'prd-103', type: 'product', name: 'Пицца Маргарита', barcode: '4607001234567', article: 'PIZZA-MARG', synonyms: ['пицца маргарита'], vatRate: '20%' }
    ];

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function safeToNumber(value) {
        const num = parseFloat(value);
        return Number.isFinite(num) ? num : 0;
    }

    function formatCurrency(value) {
        return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatDate(value) {
        if (!value) return '';
        try {
            const date = new Date(value);
            return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
                ' ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return value;
        }
    }

    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function tokenize(str) {
        return (str || '')
            .toLowerCase()
            .replace(/[^a-zа-я0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(Boolean);
    }

    function wordScore(targetTokens, candidateTokens) {
        let matches = 0;
        targetTokens.forEach((token) => {
            if (candidateTokens.indexOf(token) !== -1) {
                matches += 1;
            }
        });
        return matches;
    }

    function computeMatchScore(line, product) {
        let score = 0;

        if (line.barcode && product.barcode && line.barcode === product.barcode) {
            score += 8;
        }

        if (line.article && product.article && line.article.toLowerCase() === product.article.toLowerCase()) {
            score += 6;
        }

        if (line.itemCode && product.article && line.itemCode.toLowerCase() === product.article.toLowerCase()) {
            score += 4;
        }

        const lineTokens = tokenize(line.name);
        const productTokens = tokenize(product.name).concat(tokenize((product.synonyms || []).join(' ')));
        score += wordScore(lineTokens, productTokens);

        if (line.vatRate && product.vatRate && line.vatRate === product.vatRate) {
            score += 1;
        }

        return score;
    }

    function getBaseUrl() {
        if (typeof window !== 'undefined' && window.location) {
            return window.location.origin;
        }
        return 'https://example.com';
    }

    const edoModule = {
        initialized: false,
        container: null,
        diadocImportModal: null,
        state: {
            loadingDocuments: false,
            loadingLines: false,
            documents: [],
            serverConfig: null,
            selectedDocumentId: null,
            docStore: {},
            diadocImport: {
                open: false,
                loading: false,
                error: null,
                success: null,
                documents: [],
                selectedDocIndex: 0,
                warehouseId: 2,
                postReceipt: false,
                isPaid: false,
                fileName: ''
            },
            ui: {
                detailTab: 'lines'
            },
            inventory: [],
            activityLog: [],
            error: null
        },

        init() {
            if (this.initialized) {
                this.render();
                return;
            }
            this.container = document.getElementById('edoModuleRoot');
            if (!this.container) {
                console.warn('[EDO] Container not found');
                return;
            }
            this.bindEvents();
            this.initialized = true;
            this.render();
            this.fetchServerConfig();
            this.fetchInventory();
            this.syncDocuments();
        },

    async fetchServerConfig() {
        try {
            const response = await fetch(`${API_BASE}/config`);
            if (!response.ok) {
                if (response.status === 404) {
                    // API endpoint не существует - работаем в офлайн режиме
                    this.setState({ serverConfig: { diadocConfigured: false } });
                    return;
                }
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            if (data.ok) {
                this.setState({ serverConfig: data });
            }
        } catch (error) {
            // Тихая обработка - API может быть не настроен
            this.setState({ serverConfig: { diadocConfigured: false } });
        }
    },

    async fetchInventory() {
        try {
            const data = await this.apiFetch(`${API_BASE}/inventory/products`);
            if (data && data.products) {
                this.state.inventory = data.products;
                this.render();
            }
        } catch (error) {
            this.state.inventory = [];
        }
    },

        bindEvents() {
            this.container.addEventListener('click', (event) => this.handleClick(event));
            this.container.addEventListener('change', (event) => this.handleChange(event));
            this.container.addEventListener('input', (event) => this.handleInput(event));
        },

        promptInput(title, placeholder = '', defaultValue = '') {
            return new Promise((resolve) => {
                // Удаляем существующие модальные окна
                const existingModals = document.querySelectorAll('.edo-prompt-modal');
                existingModals.forEach(modal => modal.remove());

                const modal = document.createElement('div');
                modal.className = 'edo-prompt-modal';
                modal.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                `;
                
                const modalContent = document.createElement('div');
                modalContent.style.cssText = `
                    background: white;
                    padding: 24px;
                    border-radius: 12px;
                    min-width: 400px;
                    max-width: 90%;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                `;
                
                modalContent.innerHTML = `
                    <h3 style="margin: 0 0 16px 0; color: #0a615c;">${escapeHtml(title)}</h3>
                    <input type="text" id="edo-prompt-input" 
                           placeholder="${escapeHtml(placeholder)}" 
                           value="${escapeHtml(defaultValue)}"
                           style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box; margin-bottom: 16px;">
                    <div style="display: flex; gap: 8px; justify-content: flex-end;">
                        <button id="edo-prompt-cancel" style="padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 6px; cursor: pointer;">Отмена</button>
                        <button id="edo-prompt-ok" style="padding: 8px 16px; background: #0a615c; color: white; border: none; border-radius: 6px; cursor: pointer;">OK</button>
                    </div>
                `;
                
                modal.appendChild(modalContent);
                document.body.appendChild(modal);
                
                const input = modalContent.querySelector('#edo-prompt-input');
                const okBtn = modalContent.querySelector('#edo-prompt-ok');
                const cancelBtn = modalContent.querySelector('#edo-prompt-cancel');
                
                const cleanup = () => {
                    modal.remove();
                };
                
                const handleOk = () => {
                    const value = input.value.trim();
                    cleanup();
                    resolve(value || null);
                };
                
                const handleCancel = () => {
                    cleanup();
                    resolve(null);
                };
                
                okBtn.addEventListener('click', handleOk);
                cancelBtn.addEventListener('click', handleCancel);
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        handleCancel();
                    }
                });
                
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        handleOk();
                    } else if (e.key === 'Escape') {
                        handleCancel();
                    }
                });
                
                setTimeout(() => input.focus(), 100);
            });
        },

        log(message, docId) {
            this.state.activityLog.unshift({
                id: 'log_' + Date.now(),
                docId: docId || this.state.selectedDocumentId,
                message,
                timestamp: new Date().toISOString()
            });
        },

        setLoading(key, value) {
            this.state[key] = value;
            this.render();
        },

        setState(patch) {
            Object.assign(this.state, patch);
            this.render();
        },

        ensureDocStore(doc) {
            if (!doc) return null;
            if (!this.state.docStore[doc.docflowId]) {
                this.state.docStore[doc.docflowId] = {
                    document: doc,
                    lines: [],
                    parsedXml: '',
                    matches: {},
                    candidates: {},
                    receiptId: null,
                    receiptStatus: null,
                    signatureStatus: doc.status || 'incoming',
                    history: []
                };
            }
            return this.state.docStore[doc.docflowId];
        },

        appendHistory(docflowId, text) {
            const docData = this.state.docStore[docflowId];
            if (!docData) return;
            docData.history.unshift({
                id: 'hist_' + Date.now(),
                text,
                timestamp: new Date().toISOString()
            });
        },

        async apiFetch(path, options = {}) {
            const defaultHeaders = {
                'X-User-Role': global.EDO_USER_ROLE || 'admin'
            };
            if (options.body && !defaultHeaders['Content-Type'] && !(options.headers && options.headers['Content-Type'])) {
                defaultHeaders['Content-Type'] = 'application/json';
            }
            const headers = Object.assign({}, defaultHeaders, options.headers || {});
            try {
                const response = await fetch(path, Object.assign({}, options, { headers }));
                if (!response.ok) {
                    // Для 404 и 405 не логируем как ошибку - это нормально если API не настроен
                    // Примечание: браузер все равно покажет сетевую ошибку в консоли (inject.js),
                    // но наш код не будет логировать её дополнительно
                    if (response.status === 404 || response.status === 405) {
                        const error = new Error(response.status === 404 ? 'Not found' : 'Method not allowed');
                        error.status = response.status;
                        throw error;
                    }
                    const payload = await response.json().catch(() => ({}));
                    throw new Error(payload.error || ('HTTP ' + response.status));
                }
                const payload = await response.json();
                if (payload.ok === false) {
                    throw new Error(payload.error || 'Request failed');
                }
                return payload;
            } catch (error) {
                // Логируем только если это не 404/405 (API может быть не настроен)
                // Сетевые ошибки 404/405 браузер покажет в консоли автоматически,
                // но мы не дублируем их через console.warn
                if (error.status !== 404 && error.status !== 405) {
                    console.warn('[EDO] API call failed:', path, error.message);
                }
                throw error;
            }
        },

        async checkHealth() {
            try {
                const data = await this.apiFetch(`${API_BASE}/health`);
                const orgs = typeof data.organizations === 'number' ? ` (организаций: ${data.organizations})` : '';
                this.state.error = null;
                this.log('✅ Диадок доступен' + orgs);
            } catch (error) {
                this.state.error = 'Диадок недоступен: ' + error.message;
                this.log('❌ Диадок недоступен: ' + error.message);
            }
            this.render();
        },

        async syncDocuments() {
            this.setLoading('loadingDocuments', true);
            this.state.error = null;
            try {
                const data = await this.apiFetch(`${API_BASE}/documents`);
                if (data && data.docs) {
                    this.state.documents = data.docs.map(this.normalizeDocument);
                    if (data.cached && data.warning) {
                        this.state.error = data.warning;
                    }
                } else {
                    this.state.documents = [];
                    this.state.error = 'Некорректный ответ API при загрузке документов ЭДО.';
                }
            } catch (error) {
                this.state.error = 'Не удалось загрузить документы из Диадока: ' + error.message;
                this.state.documents = [];
            } finally {
                this.setLoading('loadingDocuments', false);
            }
            if (!this.state.selectedDocumentId && this.state.documents.length) {
                this.selectDocument(this.state.documents[0].docflowId);
            } else {
                this.render();
            }
        },

        normalizeDocument(doc) {
            const normalized = Object.assign({}, doc);
            normalized.total = safeToNumber(doc.total);
            normalized.date = doc.date || doc.SendDateTime || doc.createdAt || new Date().toISOString();
            normalized.status = doc.status || doc.DocflowStatus || 'incoming';
            normalized.direction = doc.direction || (normalized.status === 'incoming' ? 'in' : 'out');
            normalized.counterparty = doc.counterparty || doc.CounterpartyBoxId || 'Контрагент';
            normalized.type = doc.type || doc.DocumentType || 'UniversalTransferDocument';
            normalized.docflowId = doc.docflowId || doc.DocflowId || doc.id;
            normalized.documentId = doc.documentId || doc.Document?.EntityId || doc.MessageId;
            normalized.number = doc.number || doc.DocumentNumber || '';
            return normalized;
        },

        async selectDocument(docflowId) {
            if (this.state.selectedDocumentId === docflowId) {
                return;
            }
            this.state.selectedDocumentId = docflowId;
            const doc = this.state.documents.find((item) => item.docflowId === docflowId);
            if (!doc) {
                this.render();
                return;
            }
            const docData = this.ensureDocStore(doc);
            if (!docData.lines || !docData.lines.length) {
                await this.refreshLines(docflowId, { withCandidates: true });
            }
            this.render();
        },

        async parseDocument(doc) {
            this.setLoading('loadingLines', true);
            const docData = this.ensureDocStore(doc);
            if (!docData) {
                this.setLoading('loadingLines', false);
                return;
            }
            try {
                const result = await this.apiFetch(`${API_BASE}/documents/${encodeURIComponent(doc.docflowId)}/parse`);
                if (result && result.items) {
                    docData.parsedXml = result.xml || '';
                    this.appendHistory(doc.docflowId, 'Получен титул продавца и распарсен через API');
                    this.log('Титул продавца загружен и распарсен', doc.docflowId);
                    await this.refreshLines(doc.docflowId, { withCandidates: true });
                } else {
                    docData.lines = [];
                    docData.parsedXml = '';
                    this.state.error = 'Некорректный ответ API при парсинге документа.';
                    this.appendHistory(doc.docflowId, 'Ошибка парсинга: некорректный ответ API');
                }
            } catch (error) {
                docData.lines = [];
                docData.parsedXml = '';
                this.state.error = 'Не удалось распарсить документ: ' + error.message;
                this.appendHistory(doc.docflowId, 'Ошибка парсинга: ' + error.message);
                this.log('Ошибка парсинга: ' + error.message, doc.docflowId);
            } finally {
                this.setLoading('loadingLines', false);
            }
            this.render();
        },

        normalizeLine(line, index) {
            return {
                index,
                name: line.name || line.Product || 'Позиция',
                quantity: safeToNumber(line.quantity || line.Quantity || 0),
                unitName: line.unitName || line.UnitName || '',
                price: safeToNumber(line.price || line.Price || 0),
                subtotal: safeToNumber(line.subtotal || line.SubtotalWithVatExcluded || line.Subtotal || 0),
                vatRate: line.vatRate || line.TaxRate || '',
                barcode: line.barcode || line.Gtin || line.ItemVendorCode || '',
                article: line.article || line.ItemVendorCode || '',
                raw: line
            };
        },

        normalizeLinePayload(payload) {
            return {
                index: payload.index,
                name: payload.name,
                quantity: safeToNumber(payload.quantity),
                unitName: payload.unitName || '',
                price: safeToNumber(payload.price),
                subtotal: safeToNumber(payload.subtotal),
                vatRate: payload.vatRate || '',
                barcode: payload.barcode || '',
                article: payload.article || '',
                matchStatus: payload.matchStatus || 'pending',
                raw: payload.raw || {}
            };
        },

        applyLines(docflowId, linePayloads) {
            const doc = this.state.documents.find((item) => item.docflowId === docflowId);
            if (!doc) return;
            const docData = this.ensureDocStore(doc);
            docData.lines = linePayloads.map((payload) => this.normalizeLinePayload(payload));
            docData.matches = {};
            docData.candidates = {};
            linePayloads.forEach((payload) => {
                docData.matches[payload.index] = payload.match || null;
                docData.candidates[payload.index] = payload.candidates || [];
            });
        },

        applyLineUpdate(docflowId, linePayload) {
            const doc = this.state.documents.find((item) => item.docflowId === docflowId);
            if (!doc) return;
            const docData = this.ensureDocStore(doc);
            const normalized = this.normalizeLinePayload(linePayload);
            const idx = docData.lines.findIndex((item) => item.index === normalized.index);
            if (idx >= 0) {
                docData.lines[idx] = normalized;
            } else {
                docData.lines.push(normalized);
            }
            docData.matches[normalized.index] = linePayload.match || null;
            docData.candidates[normalized.index] = linePayload.candidates || [];
        },

        async refreshLines(docflowId, options = {}) {
            const doc = this.state.documents.find((item) => item.docflowId === docflowId);
            if (!doc) return;
            const query = options.withCandidates ? '?withCandidates=1' : '';
            try {
                const data = await this.apiFetch(`${API_BASE}/documents/${encodeURIComponent(docflowId)}/lines${query}`);
                if (data && data.lines) {
                    this.applyLines(docflowId, data.lines);
                    this.render();
                    return;
                }
                this.state.error = 'Некорректный ответ API при загрузке строк документа.';
            } catch (error) {
                this.state.error = 'Не удалось загрузить строки документа: ' + error.message;
            }
        },

        async autoMatch(docflowId, options = {}) {
            try {
                const response = await this.apiFetch(`${API_BASE}/documents/${encodeURIComponent(docflowId)}/matches/auto`, {
                    method: 'POST',
                    body: JSON.stringify({
                        threshold: options.threshold || 0.7,
                        withCandidates: true
                    })
                });
                if (response && response.lines) {
                    this.applyLines(docflowId, response.lines);
                }
                if (response && typeof response.matched === 'number') {
                    this.appendHistory(docflowId, 'Автосопоставление: подобрано ' + response.matched + ' строк');
                }
            } catch (error) {
                console.warn('[EDO] autoMatch fallback', error.message);
                this.runLocalAutoMatch(docflowId);
            }
            this.render();
        },

        runLocalAutoMatch(docflowId) {
            const docData = this.state.docStore[docflowId];
            if (!docData || !docData.lines) return;
            docData.lines.forEach((line) => {
                const candidates = this.buildCandidates(line);
                docData.candidates[line.index] = candidates;
                if (!docData.matches[line.index] && candidates.length && candidates[0].score >= 6) {
                    docData.matches[line.index] = {
                        productId: candidates[0].product.id,
                        name: candidates[0].product.name,
                        type: candidates[0].product.type,
                        source: candidates[0].source,
                        score: candidates[0].score
                    };
                }
            });
            this.appendHistory(docflowId, 'Автосопоставление выполнено локально (режим офлайн).');
        },

        buildCandidates(line) {
            const candidates = [];
            this.state.inventory.forEach((product) => {
                const score = computeMatchScore(line, product);
                if (score > 0) {
                    let source = 'название';
                    if (line.barcode && product.barcode && line.barcode === product.barcode) {
                        source = 'штрих-код';
                    } else if (line.article && product.article && line.article.toLowerCase() === product.article.toLowerCase()) {
                        source = 'артикул';
                    }
                    candidates.push({ product, score, source });
                }
            });
            candidates.sort((a, b) => b.score - a.score);
            return candidates.slice(0, 5);
        },

        getSelectedDocument() {
            if (!this.state.selectedDocumentId) return null;
            return this.state.docStore[this.state.selectedDocumentId] || null;
        },

        getDocumentMeta() {
            if (!this.state.selectedDocumentId) return null;
            return this.state.documents.find((doc) => doc.docflowId === this.state.selectedDocumentId) || null;
        },

        getDetailTab() {
            return this.state.ui.detailTab;
        },

        setDetailTab(tabId) {
            this.state.ui.detailTab = tabId;
            this.render();
        },

        ensureMatch(docflowId, lineIndex) {
            const docData = this.state.docStore[docflowId];
            if (!docData) return null;
            if (!docData.matches[lineIndex]) {
                docData.matches[lineIndex] = null;
            }
            return docData.matches[lineIndex];
        },

        async setMatch(docflowId, lineIndex, candidate) {
            const docData = this.state.docStore[docflowId];
            if (!docData) return;
            try {
                const encoded = `${API_BASE}/documents/${encodeURIComponent(docflowId)}/lines/${lineIndex}/match`;
                let payload;
                if (candidate && candidate.productId) {
                    payload = await this.apiFetch(encoded + '?withCandidates=1', {
                        method: 'POST',
                        body: JSON.stringify({
                            productId: candidate.productId,
                            source: candidate.source || 'manual',
                            score: candidate.score || null,
                            manual: candidate.manual !== false,
                            comment: candidate.comment || null
                        })
                    });
                } else {
                    payload = await this.apiFetch(encoded + '?withCandidates=1', {
                        method: 'DELETE'
                    });
                }
                if (payload && payload.line) {
                    this.applyLineUpdate(docflowId, payload.line);
                }
                this.render();
            } catch (error) {
                console.error('[EDO] setMatch failed', error);
                throw error;
            }
        },

        async createManualProduct(line) {
            const name = await this.promptInput('Введите название новой карточки', 'Название карточки', line.name);
            if (!name) return null;
            const type = (await this.promptInput('Тип карточки', 'ingredient/product/package', 'ingredient')) || 'ingredient';
            const productPayload = {
                name,
                type,
                barcode: line.barcode || '',
                article: line.article || '',
                synonyms: [line.name],
                vatRate: line.vatRate || ''
            };
            try {
                const response = await this.apiFetch(`${API_BASE}/inventory/products`, {
                    method: 'POST',
                    body: JSON.stringify(productPayload)
                });
                if (response && response.product) {
                    this.state.inventory.push(response.product);
                    this.log('Создана новая карточка ' + response.product.name);
                    return response.product;
                }
            } catch (error) {
                console.error('[EDO] create product error', error);
                window.alert(error.message || 'Не удалось создать карточку');
            }
            return null;
        },

        getReceiptDraft(docflowId) {
            const docData = this.state.docStore[docflowId];
            if (!docData) return null;
            const lines = docData.lines || [];
            const items = lines.map((line) => {
                const match = docData.matches[line.index];
                return {
                    line,
                    match,
                    ready: !!match,
                    total: safeToNumber(line.quantity) * safeToNumber(line.price)
                };
            });
            const ready = items.every((item) => item.ready);
            return { items, ready };
        },

        async createReceipt(docflowId) {
            const docData = this.state.docStore[docflowId];
            const doc = this.state.documents.find((item) => item.docflowId === docflowId);
            if (!docData || !doc) return;
            const draft = this.getReceiptDraft(docflowId);
            if (!draft.ready) {
                window.alert('Не все строки сопоставлены. Завершите сопоставление перед созданием прихода.');
                return;
            }
            try {
                const payload = {
                    edoDocumentId: docflowId,
                    warehouseId: 'default-warehouse',
                    lines: draft.items.map((item) => ({
                        edoLineId: item.line.index,
                        productId: item.match.productId,
                        qty: item.line.quantity,
                        price: item.line.price,
                        vatRate: item.line.vatRate || null,
                        batch: item.line.raw && (item.line.raw.batch || item.line.raw.BatchNumber) || null,
                        expiry: item.line.raw && (item.line.raw.expiry || item.line.raw.ExpiryDate) || null
                    }))
                };
                const response = await this.apiFetch(`${API_BASE}/receipts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (response && response.ok) {
                    docData.receiptId = response.receiptId;
                    docData.receiptStatus = 'draft';
                    this.appendHistory(docflowId, 'Создан приход #' + response.receiptId);
                    this.log('Создан приход #' + response.receiptId, docflowId);
                } else {
                    throw new Error('Сервер вернул ошибку');
                }
            } catch (error) {
                this.appendHistory(docflowId, 'Не удалось создать приход: ' + error.message);
                this.log('Ошибка создания прихода: ' + error.message, docflowId);
                window.alert('Не удалось создать приход. Проверьте журнал.');
            }
            this.render();
        },

        async signDocument(docflowId) {
            const docData = this.state.docStore[docflowId];
            if (!docData) return;
            try {
                await this.apiFetch(`${API_BASE}/documents/${encodeURIComponent(docflowId)}/sign`, { method: 'POST' });
                docData.signatureStatus = 'signed';
                this.appendHistory(docflowId, 'Документ подписан КЭП.');
                this.log('Документ подписан', docflowId);
            } catch (error) {
                this.state.error = 'Не удалось подписать документ: ' + error.message;
                this.appendHistory(docflowId, 'Ошибка подписи: ' + error.message);
                this.log('Ошибка подписи: ' + error.message, docflowId);
                window.alert('Не удалось подписать документ. Проверьте журнал.');
            }
            this.render();
        },

        async sendDocument(docflowId) {
            const docData = this.state.docStore[docflowId];
            if (!docData) return;
            try {
                await this.apiFetch(`${API_BASE}/documents/${encodeURIComponent(docflowId)}/send`, { method: 'POST' });
                docData.signatureStatus = 'sent';
                this.appendHistory(docflowId, 'Титул покупателя отправлен контрагенту.');
                this.log('Титул покупателя отправлен', docflowId);
            } catch (error) {
                this.state.error = 'Не удалось отправить документ: ' + error.message;
                this.appendHistory(docflowId, 'Ошибка отправки: ' + error.message);
                this.log('Ошибка отправки: ' + error.message, docflowId);
                window.alert('Не удалось отправить документ.');
            }
            this.render();
        },

        async rejectDocument(docflowId) {
            const reason = await this.promptInput('Укажите причину отказа', 'Причина отказа');
            if (!reason) return;
            const docData = this.state.docStore[docflowId];
            if (!docData) return;
            try {
                await this.apiFetch(`${API_BASE}/documents/${encodeURIComponent(docflowId)}/reject`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reason })
                });
                docData.signatureStatus = 'rejected';
                this.appendHistory(docflowId, 'Отказано: ' + reason);
                this.log('Отправлен отказ: ' + reason, docflowId);
            } catch (error) {
                this.state.error = 'Не удалось отправить отказ: ' + error.message;
                this.appendHistory(docflowId, 'Ошибка отказа: ' + error.message);
                this.log('Ошибка отправки отказа: ' + error.message, docflowId);
                window.alert('Не удалось отправить отказ.');
            }
            this.render();
        },

        viewXml(docflowId) {
            const docData = this.state.docStore[docflowId];
            if (!docData || !docData.parsedXml) {
                window.alert('XML ещё не загружен.');
                return;
            }
            const blob = new Blob([docData.parsedXml], { type: 'application/xml' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        },

        async handleClick(event) {
            const actionEl = event.target.closest('[data-action]');
            if (!actionEl) {
                const navEl = event.target.closest('[data-tab]');
                if (navEl) {
                    this.setDetailTab(navEl.getAttribute('data-tab'));
                }
                return;
            }
            const action = actionEl.getAttribute('data-action');
            const docflowId = actionEl.getAttribute('data-doc');
            try {
                switch (action) {
                    case 'sync-docs':
                        await this.syncDocuments();
                        break;
                    case 'edo-health':
                        await this.checkHealth();
                        break;
                    case 'open-diadoc-import':
                        this.openDiadocImportWizard();
                        break;
                    case 'edo-retry-documents':
                        await this.syncDocuments();
                        break;
                    case 'select-document':
                        await this.selectDocument(actionEl.getAttribute('data-doc'));
                        break;
                    case 'parse-document':
                        await this.parseDocument(this.state.documents.find((doc) => doc.docflowId === docflowId));
                        break;
                    case 'auto-match':
                        await this.autoMatch(docflowId);
                        break;
                    case 'edo-match': {
                        const lineIndex = parseInt(actionEl.getAttribute('data-line'), 10);
                        await this.showMatchDialog(docflowId, lineIndex);
                        break;
                    }
                    case 'create-product': {
                        const lineIndex = parseInt(actionEl.getAttribute('data-line'), 10);
                        const docData = this.state.docStore[docflowId];
                        if (!docData) break;
                        const line = docData.lines.find((item) => item.index === lineIndex);
                        if (!line) break;
                        const product = await this.createManualProduct(line);
                        if (product) {
                            await this.setMatch(docflowId, lineIndex, {
                                productId: product.id,
                                source: 'manual',
                                score: 1,
                                manual: true
                            });
                        }
                        break;
                    }
                    case 'create-receipt':
                        await this.createReceipt(docflowId);
                        break;
                    case 'sign-doc':
                        await this.signDocument(docflowId);
                        break;
                    case 'send-doc':
                        await this.sendDocument(docflowId);
                        break;
                    case 'reject-doc':
                        await this.rejectDocument(docflowId);
                        break;
                    case 'view-xml':
                        this.viewXml(docflowId);
                        break;
                    case 'switch-tab':
                        this.setDetailTab(actionEl.getAttribute('data-tab'));
                        break;
                    case 'refresh-doc':
                        await this.parseDocument(this.state.documents.find((doc) => doc.docflowId === docflowId));
                        break;
                    case 'edo-sync-status':
                        if (!this.state.selectedDocumentId) {
                            window.alert('Сначала выберите документ.');
                        } else {
                            await this.syncDocumentStatus(this.state.selectedDocumentId);
                        }
                        break;
                    default:
                        break;
                }
            } catch (error) {
                console.error('[EDO] handleClick error', action, error);
                window.alert(error.message || 'Операция не выполнена');
            }
        },

        openDiadocImportWizard() {
            if (this.state.diadocImport.open && this.diadocImportModal) {
                this.renderDiadocImportModal();
                return;
            }

            this.state.diadocImport = Object.assign({}, this.state.diadocImport, {
                open: true,
                loading: false,
                error: null,
                success: null,
                documents: [],
                selectedDocIndex: 0,
                warehouseId: this.state.diadocImport.warehouseId || 2,
                postReceipt: Boolean(this.state.diadocImport.postReceipt),
                isPaid: Boolean(this.state.diadocImport.isPaid),
                fileName: ''
            });

            const modal = document.createElement('div');
            modal.className = 'edo-diadoc-import-modal';
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
            modal.innerHTML = '<div class="edo-panel" style="width:min(1200px,96vw);max-height:92vh;overflow:auto;"></div>';

            const panel = modal.querySelector('.edo-panel');

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeDiadocImportWizard();
                }
            });

            panel.addEventListener('click', async (e) => {
                const el = e.target.closest('[data-di-action]');
                if (!el) return;
                const act = el.getAttribute('data-di-action');
                if (act === 'close') {
                    this.closeDiadocImportWizard();
                } else if (act === 'preview') {
                    const fileInput = panel.querySelector('input[type="file"][data-di-file]');
                    const file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
                    if (!file) {
                        window.alert('Выберите ZIP/XML файл');
                        return;
                    }
                    await this.handleDiadocImportPreview(file);
                } else if (act === 'apply') {
                    await this.handleDiadocImportApply();
                }
            });

            panel.addEventListener('change', (e) => {
                const target = e.target;
                if (!target) return;
                if (target.matches('[data-di-doc-select]')) {
                    this.state.diadocImport.selectedDocIndex = parseInt(target.value || '0', 10) || 0;
                    this.renderDiadocImportModal();
                    return;
                }
                if (target.matches('[data-di-setting]')) {
                    const key = target.getAttribute('data-di-setting');
                    if (key === 'warehouseId') {
                        this.state.diadocImport.warehouseId = parseInt(target.value || '2', 10) || 2;
                    } else if (key === 'postReceipt') {
                        this.state.diadocImport.postReceipt = Boolean(target.checked);
                    } else if (key === 'isPaid') {
                        this.state.diadocImport.isPaid = Boolean(target.checked);
                    }
                    return;
                }
                if (target.matches('[data-di-field]')) {
                    const docIndex = parseInt(target.getAttribute('data-di-doc') || '0', 10) || 0;
                    const lineIndex = parseInt(target.getAttribute('data-di-line') || '0', 10) || 0;
                    const field = target.getAttribute('data-di-field');
                    const docs = this.state.diadocImport.documents || [];
                    const doc = docs[docIndex];
                    if (!doc || !Array.isArray(doc.lines)) return;
                    const line = doc.lines[lineIndex];
                    if (!line) return;

                    let val = target.value;
                    if (field === 'matched_product_id') {
                        const parsed = parseInt(val || '0', 10);
                        line.matched_product_id = parsed > 0 ? parsed : null;
                    } else if (field === 'unit_coeff') {
                        const num = parseFloat(String(val).replace(',', '.'));
                        line.unit_coeff = Number.isFinite(num) && num > 0 ? num : 1;
                    } else if (field === 'purchase_price') {
                        const num = parseFloat(String(val).replace(',', '.'));
                        line.purchase_price = Number.isFinite(num) ? num : null;
                    } else {
                        line[field] = val;
                    }
                }
            });

            panel.addEventListener('input', (e) => {
                const target = e.target;
                if (!target) return;
                if (!target.matches('[data-di-field]')) return;
                const docIndex = parseInt(target.getAttribute('data-di-doc') || '0', 10) || 0;
                const lineIndex = parseInt(target.getAttribute('data-di-line') || '0', 10) || 0;
                const field = target.getAttribute('data-di-field');
                if (field === 'account_code' || field === 'category_name' || field === 'sku_internal') {
                    const docs = this.state.diadocImport.documents || [];
                    const doc = docs[docIndex];
                    if (!doc || !Array.isArray(doc.lines)) return;
                    const line = doc.lines[lineIndex];
                    if (!line) return;
                    line[field] = target.value;
                }
            });

            document.body.appendChild(modal);
            this.diadocImportModal = modal;
            this.renderDiadocImportModal();
        },

        closeDiadocImportWizard() {
            this.state.diadocImport.open = false;
            if (this.diadocImportModal) {
                try { this.diadocImportModal.remove(); } catch (e) {}
            }
            this.diadocImportModal = null;
        },

        renderDiadocImportModal() {
            if (!this.diadocImportModal) return;
            const panel = this.diadocImportModal.querySelector('.edo-panel');
            if (!panel) return;

            const st = this.state.diadocImport;
            const docs = Array.isArray(st.documents) ? st.documents : [];
            const selectedDocIndex = Math.max(0, Math.min(parseInt(st.selectedDocIndex || '0', 10) || 0, Math.max(0, docs.length - 1)));
            const selectedDoc = docs[selectedDocIndex] || null;

            const docOptions = docs.map((d, idx) => {
                const label = (d && d.meta && (d.meta.number || d.meta.date))
                    ? `${d.meta.number || ''} ${d.meta.date || ''}`.trim()
                    : (d && d.filename ? d.filename : `Документ #${idx + 1}`);
                const safeLabel = escapeHtml(label);
                return `<option value="${idx}" ${idx === selectedDocIndex ? 'selected' : ''}>${safeLabel}</option>`;
            }).join('');

            const products = Array.isArray(this.state.inventory) ? this.state.inventory : [];
            const productOptions = ['<option value="">— Не сопоставлено —</option>'].concat(products.map((p) => {
                const id = p && (p.id !== undefined && p.id !== null) ? String(p.id) : '';
                const name = escapeHtml(p && p.name ? p.name : id);
                return `<option value="${escapeHtml(id)}">${name}</option>`;
            }));

            let linesHtml = '';
            if (selectedDoc && Array.isArray(selectedDoc.lines) && selectedDoc.lines.length) {
                const rows = selectedDoc.lines.map((ln, i) => {
                    const matched = ln.matched_product_id === null || ln.matched_product_id === undefined ? '' : String(ln.matched_product_id);
                    const qty = (ln.quantity_purchase !== undefined && ln.quantity_purchase !== null) ? ln.quantity_purchase : '';
                    const unit = ln.unit || '';
                    const price = (ln.purchase_price !== undefined && ln.purchase_price !== null) ? ln.purchase_price : '';
                    const coeff = (ln.unit_coeff !== undefined && ln.unit_coeff !== null) ? ln.unit_coeff : 1;
                    const total = (ln.total_with_vat !== undefined && ln.total_with_vat !== null) ? ln.total_with_vat : '';
                    const acc = ln.account_code || '';
                    const cat = ln.category_name || '';
                    const skuInt = ln.sku_internal || '';
                    const name = escapeHtml(ln.name || '');

                    const optionsHtml = productOptions.map((opt) => {
                        if (opt.includes('value="' + escapeHtml(matched) + '"') && matched !== '') {
                            return opt.replace('>', ' selected>');
                        }
                        return opt;
                    }).join('');

                    return (
                        '<tr>' +
                            `<td style="min-width:260px;">${name}</td>` +
                            `<td>${escapeHtml(String(qty))} ${escapeHtml(String(unit))}</td>` +
                            `<td><input class="edo-input" style="width:110px;" value="${escapeHtml(String(price))}" data-di-field="purchase_price" data-di-doc="${selectedDocIndex}" data-di-line="${i}"></td>` +
                            `<td><input class="edo-input" style="width:90px;" value="${escapeHtml(String(coeff))}" data-di-field="unit_coeff" data-di-doc="${selectedDocIndex}" data-di-line="${i}"></td>` +
                            `<td>${escapeHtml(String(total))}</td>` +
                            `<td><input class="edo-input" style="width:90px;" value="${escapeHtml(String(acc))}" data-di-field="account_code" data-di-doc="${selectedDocIndex}" data-di-line="${i}"></td>` +
                            `<td><input class="edo-input" style="width:140px;" value="${escapeHtml(String(cat))}" data-di-field="category_name" data-di-doc="${selectedDocIndex}" data-di-line="${i}"></td>` +
                            `<td><input class="edo-input" style="width:140px;" value="${escapeHtml(String(skuInt))}" data-di-field="sku_internal" data-di-doc="${selectedDocIndex}" data-di-line="${i}"></td>` +
                            `<td><select class="edo-select" data-di-field="matched_product_id" data-di-doc="${selectedDocIndex}" data-di-line="${i}">${optionsHtml}</select></td>` +
                        '</tr>'
                    );
                }).join('');

                linesHtml = (
                    '<div class="edo-scroll" style="max-height:46vh;">' +
                        '<table class="edo-table">' +
                            '<thead><tr>' +
                                '<th>Наименование</th>' +
                                '<th>Кол-во</th>' +
                                '<th>Цена</th>' +
                                '<th>Коэф</th>' +
                                '<th>Сумма</th>' +
                                '<th>Счёт</th>' +
                                '<th>Категория</th>' +
                                '<th>SKU</th>' +
                                '<th>Сопоставление</th>' +
                            '</tr></thead>' +
                            '<tbody>' + rows + '</tbody>' +
                        '</table>' +
                    '</div>'
                );
            } else if (docs.length) {
                linesHtml = '<p class="edo-muted">Нет строк для предпросмотра (возможно не распознан формат или XML пустой).</p>';
            } else {
                linesHtml = '<p class="edo-muted">Загрузите ZIP/XML файл для предпросмотра.</p>';
            }

            const bannerError = st.error ? `<div class="edo-info-banner" style="background:rgba(220,38,38,0.12);">${escapeHtml(st.error)}</div>` : '';
            const bannerSuccess = st.success ? `<div class="edo-info-banner" style="background:rgba(16,185,129,0.12);">${escapeHtml(st.success)}</div>` : '';

            panel.innerHTML = (
                '<div class="edo-panel-header" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">' +
                    '<h3 style="margin:0;">Импорт Diadoc (ZIP/XML)</h3>' +
                    '<div style="display:flex;gap:8px;align-items:center;">' +
                        '<button class="edo-button ghost" data-di-action="close">✕ Закрыть</button>' +
                    '</div>' +
                '</div>' +
                bannerError +
                bannerSuccess +
                '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;margin-bottom:12px;">' +
                    '<div style="min-width:260px;">' +
                        '<div class="edo-muted" style="margin-bottom:6px;">Файл</div>' +
                        '<input type="file" data-di-file accept=".zip,.xml" />' +
                    '</div>' +
                    '<div>' +
                        '<div class="edo-muted" style="margin-bottom:6px;">Склад (warehouseId)</div>' +
                        `<input class="edo-input" style="width:120px;" data-di-setting="warehouseId" value="${escapeHtml(String(st.warehouseId || 2))}">` +
                    '</div>' +
                    '<label style="display:flex;gap:8px;align-items:center;">' +
                        `<input type="checkbox" data-di-setting="postReceipt" ${st.postReceipt ? 'checked' : ''}>` +
                        '<span>Провести приход</span>' +
                    '</label>' +
                    '<label style="display:flex;gap:8px;align-items:center;">' +
                        `<input type="checkbox" data-di-setting="isPaid" ${st.isPaid ? 'checked' : ''}>` +
                        '<span>Оплачено</span>' +
                    '</label>' +
                    '<button class="edo-button primary" data-di-action="preview" ' + (st.loading ? 'disabled' : '') + '>👁 Предпросмотр</button>' +
                    '<button class="edo-button secondary" data-di-action="apply" ' + (!docs.length || st.loading ? 'disabled' : '') + '>✅ Применить</button>' +
                '</div>' +
                (docs.length > 1
                    ? '<div style="margin-bottom:12px;">' +
                        '<span class="edo-muted" style="margin-right:8px;">Документ:</span>' +
                        `<select class="edo-select" data-di-doc-select style="min-width:320px;">${docOptions}</select>` +
                      '</div>'
                    : '') +
                linesHtml
            );
        },

        async handleDiadocImportPreview(file) {
            this.state.diadocImport.loading = true;
            this.state.diadocImport.error = null;
            this.state.diadocImport.success = null;
            this.renderDiadocImportModal();
            try {
                const form = new FormData();
                form.append('file', file, file.name || 'upload');
                const resp = await fetch(DIADOC_IMPORT_PREVIEW_URL, { method: 'POST', body: form });
                const data = await resp.json().catch(() => null);
                if (!resp.ok || !data || !data.ok) {
                    throw new Error((data && (data.error || data.message)) ? (data.error || data.message) : `HTTP ${resp.status}`);
                }
                const documents = Array.isArray(data.documents) ? data.documents : [];
                this.state.diadocImport.documents = documents.map((d) => {
                    const doc = Object.assign({}, d);
                    doc.lines = Array.isArray(d.lines) ? d.lines.map((ln) => Object.assign({
                        account_code: ln.account_code || '',
                        category_name: ln.category_name || '',
                        sku_internal: ln.sku_internal || '',
                        unit_coeff: (ln.unit_coeff !== undefined && ln.unit_coeff !== null) ? ln.unit_coeff : 1
                    }, ln)) : [];
                    return doc;
                });
                this.state.diadocImport.selectedDocIndex = 0;
                this.state.diadocImport.fileName = file.name || '';
                this.state.diadocImport.success = `Загружено документов: ${documents.length}`;
            } catch (e) {
                this.state.diadocImport.error = e.message || String(e);
            } finally {
                this.state.diadocImport.loading = false;
                this.renderDiadocImportModal();
            }
        },

        async handleDiadocImportApply() {
            const st = this.state.diadocImport;
            const docs = Array.isArray(st.documents) ? st.documents : [];
            const selectedDocIndex = Math.max(0, Math.min(parseInt(st.selectedDocIndex || '0', 10) || 0, Math.max(0, docs.length - 1)));
            const selectedDoc = docs[selectedDocIndex];
            if (!selectedDoc) {
                window.alert('Нет документа для применения');
                return;
            }

            st.loading = true;
            st.error = null;
            st.success = null;
            this.renderDiadocImportModal();
            try {
                const payload = {
                    document: Object.assign({}, selectedDoc, {
                        warehouseId: st.warehouseId,
                        post_receipt: Boolean(st.postReceipt),
                        is_paid: Boolean(st.isPaid)
                    }),
                    lines: Array.isArray(selectedDoc.lines) ? selectedDoc.lines.map((ln) => {
                        return {
                            line_index: ln.line_index,
                            name: ln.name,
                            sku_external: ln.sku_external,
                            gtin: ln.gtin,
                            unit: ln.unit,
                            quantity_purchase: ln.quantity_purchase,
                            purchase_price: ln.purchase_price,
                            vat_rate: ln.vat_rate,
                            total_with_vat: ln.total_with_vat,
                            account_code: ln.account_code || null,
                            category_name: ln.category_name || null,
                            sku_internal: ln.sku_internal || null,
                            unit_coeff: ln.unit_coeff || 1,
                            matched_product_id: ln.matched_product_id || null,
                            match_score: ln.match_score || null
                        };
                    }) : []
                };

                const resp = await fetch(DIADOC_IMPORT_APPLY_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await resp.json().catch(() => null);
                if (!resp.ok || !data || !data.ok) {
                    throw new Error((data && (data.error || data.message || data.details)) ? (data.error || data.message || data.details) : `HTTP ${resp.status}`);
                }
                st.success = `Сохранено. invoice_document_id=${data.invoice_document_id}, receipt_document_id=${data.receipt_document_id || '-'}, status=${data.receipt_status || '-'}`;
            } catch (e) {
                st.error = e.message || String(e);
            } finally {
                st.loading = false;
                this.renderDiadocImportModal();
            }
        },

        async handleChange(event) {
            const select = event.target;
            if (!select) return;
            if (select.matches('[data-match-select]')) {
                const docflowId = select.getAttribute('data-doc');
                const lineIndex = parseInt(select.getAttribute('data-line'), 10);
                const value = select.value;
                const docData = this.state.docStore[docflowId];
                if (!docData) return;
                try {
                    if (!value) {
                        await this.setMatch(docflowId, lineIndex, null);
                        return;
                    }
                    const candidates = docData.candidates[lineIndex] || [];
                    const candidate = candidates.find((item) => item.id === value || (item.product && item.product.id === value));
                    if (candidate) {
                        await this.setMatch(docflowId, lineIndex, {
                            productId: candidate.id || (candidate.product && candidate.product.id),
                            source: candidate.source,
                            score: candidate.score,
                            manual: true
                        });
                    } else {
                        await this.setMatch(docflowId, lineIndex, {
                            productId: value,
                            source: 'manual',
                            manual: true
                        });
                    }
                } catch (error) {
                    console.error('[EDO] match update error', error);
                    window.alert(error.message || 'Не удалось сохранить сопоставление');
                    await this.refreshLines(docflowId, { withCandidates: true });
                }
            } else if (select.matches('[data-tab]')) {
                this.setDetailTab(select.getAttribute('data-tab'));
            }
        },

        handleInput(event) {
            if (event.target.matches('[data-setting]')) {
                // placeholder for future inline settings editing
            }
        },

        render() {
            if (!this.container) return;
            const detailDoc = this.getDocumentMeta();
            const docData = detailDoc ? this.state.docStore[detailDoc.docflowId] : null;
            const detailTab = this.getDetailTab();
        const serverConfig = this.state.serverConfig || {};
        const configBadge = serverConfig.diadocConfigured
            ? '<span class="edo-tag">Диадок: подключён</span>'
            : '<span class="edo-status pending">Диадок: требуется токен</span>';

            const docList = this.renderDocumentList(detailDoc);
            const detail = this.renderDetail(detailDoc, docData, detailTab);
            const errorBanner = this.state.error ? `<div class="edo-info-banner">${escapeHtml(this.state.error)}</div>` : '';

            this.container.innerHTML = (
                '<div class="edo-suite">' +
                    '<aside class="edo-sidebar">' +
                        '<h2>Диадок</h2>' +
                        '<div style="margin-bottom:12px;">' + configBadge + '</div>' +
                        '<div class="edo-actions" style="margin-bottom:12px;">' +
                            '<button class="edo-button primary" data-action="sync-docs">🔄 Синхронизировать</button>' +
                            '<button class="edo-button ghost" data-action="edo-health">✅ Проверить Диадок</button>' +
                            '<button class="edo-button ghost" data-action="refresh-doc" data-doc="' + (detailDoc ? detailDoc.docflowId : '') + '"' + (detailDoc ? '' : ' disabled') + '>⟳ Обновить документ</button>' +
                            '<button class="edo-button secondary" data-action="open-diadoc-import">📦 Импорт ZIP/XML</button>' +
                        '</div>' +
                        '<div class="edo-tags">' +
                            '<span class="edo-tag">Документов: ' + this.state.documents.length + '</span>' +
                            '<span class="edo-tag">Журнал: ' + this.state.activityLog.length + '</span>' +
                        '</div>' +
                        '<hr style="border-color:rgba(255,255,255,0.08);margin:12px 0;">' +
                        tabsMarkup(this.state.ui.detailTab) +
                    '</aside>' +
                    '<section class="edo-main">' +
                        errorBanner +
                        docList +
                        detail +
                        this.renderHistoryPanel(detailDoc) +
                    '</section>' +
                '</div>'
            );

            function tabsMarkup(active) {
                const buttonTabs = [
                    { id: 'lines', label: 'Строки' },
                    { id: 'receipt', label: 'Приход' },
                    { id: 'signature', label: 'Подпись' },
                    { id: 'history', label: 'История' }
                ];
                return (
                    '<div class="loyalty-inline-actions" style="flex-wrap:wrap;">' +
                        buttonTabs.map(function (tab) {
                            return '<button class="loyalty-button ' + (active === tab.id ? 'primary' : 'secondary') + '" data-action="switch-tab" data-tab="' + tab.id + '">' + escapeHtml(tab.label) + '</button>';
                        }).join('') +
                    '</div>'
                );
            }
        },

        renderDocumentList(selectedDoc) {
            const rows = this.state.documents.map((doc) => {
                const selected = selectedDoc && selectedDoc.docflowId === doc.docflowId ? ' edo-doc-row selected' : ' edo-doc-row';
                const tags = [];
                if (doc.cached) {
                    tags.push('<span class="badge badge-warning">кэш</span>');
                }
                if (doc.status) {
                    tags.push('<span class="badge badge-secondary">' + escapeHtml(doc.status) + '</span>');
                }
                return (
                    '<tr class="' + selected + '" data-action="select-document" data-doc="' + doc.docflowId + '">' +
                        '<td>' + formatDate(doc.date) + '</td>' +
                        '<td>' + escapeHtml(doc.counterparty || 'Контрагент') + '<div class="edo-list-meta">#' + doc.docflowId + ' ' + tags.join(' ') + '</div></td>' +
                        '<td>' + escapeHtml(doc.number || '') + '</td>' +
                        '<td>' + escapeHtml(doc.type || '') + '</td>' +
                        '<td>' + escapeHtml(formatCurrency(doc.total || 0)) + '</td>' +
                        '<td>' + this.renderStatus(doc.status) + '</td>' +
                    '</tr>'
                );
            }).join('');

            return (
                '<div class="edo-panel">' +
                    '<div class="edo-panel-header">' +
                        '<h3>Список документов</h3>' +
                        '<div class="edo-panel-actions">' +
                            '<button class="edo-button ghost" data-action="edo-sync-status">🔄 Обновить статус</button>' +
                            '<button class="edo-button ghost" data-action="edo-retry-documents">🔁 Обновить список</button>' +
                        '</div>' +
                    '</div>' +
                    (this.state.loadingDocuments ? '<p>Загрузка документов...</p>' :
                        this.state.documents.length
                            ? '<div class="edo-scroll" style="max-height:280px;"><table class="edo-table"><thead><tr><th>Дата</th><th>Контрагент</th><th>Номер</th><th>Тип</th><th>Сумма</th><th>Статус</th></tr></thead><tbody>' +
                                rows +
                              '</tbody></table></div>'
                            : '<p>Документы не найдены.</p>') +
                '</div>'
            );
        },

        renderStatus(status) {
            switch ((status || '').toLowerCase()) {
                case 'incoming':
                case 'new':
                    return '<span class="edo-status incoming">входящий</span>';
                case 'awaiting-signature':
                case 'pending':
                    return '<span class="edo-status pending">ожидает подписи</span>';
                case 'signed':
                case 'completed':
                    return '<span class="edo-status completed">подписан</span>';
                case 'rejected':
                    return '<span class="edo-status rejected">отклонён</span>';
                case 'sent':
                    return '<span class="edo-status completed">отправлен</span>';
                default:
                    return '<span class="edo-status pending">' + escapeHtml(status || 'неизвестно') + '</span>';
            }
        },

        renderDetail(doc, docData, tab) {
            if (!doc) {
                return (
                    '<div class="edo-panel">' +
                        '<h3>Информация по документу</h3>' +
                        '<p class="edo-muted">Выберите документ из списка, чтобы увидеть детали, сопоставить строки и подписать.</p>' +
                    '</div>'
                );
            }

            const header = (
                '<div class="edo-detail-header">' +
                    '<div class="edo-detail-col">' +
                        '<strong>' + escapeHtml(doc.number || '-') + '</strong>' +
                        '<span class="edo-muted">' + formatDate(doc.date) + '</span>' +
                        this.renderStatus(docData ? docData.signatureStatus : doc.status) +
                    '</div>' +
                    '<div class="edo-detail-col">' +
                        '<span class="edo-muted">Контрагент</span>' +
                        '<strong>' + escapeHtml(doc.counterparty || '-') + '</strong>' +
                        '<span class="edo-muted">ИНН: ' + escapeHtml(doc.inn || '-') + '</span>' +
                    '</div>' +
                    '<div class="edo-detail-col">' +
                        '<span class="edo-muted">Сумма</span>' +
                        '<strong>' + formatCurrency(doc.total || 0) + ' ₽</strong>' +
                        '<span class="edo-muted">Тип: ' + escapeHtml(doc.type || '-') + '</span>' +
                    '</div>' +
                    '<div class="edo-detail-col edo-actions">' +
                        '<button class="edo-button secondary" data-action="parse-document" data-doc="' + doc.docflowId + '">📥 Получить титул</button>' +
                        '<button class="edo-button ghost" data-action="view-xml" data-doc="' + doc.docflowId + '">📄 XML</button>' +
                    '</div>' +
                '</div>'
            );

            let content = '';
            if (!docData || !docData.lines.length) {
                content = '<p class="edo-muted">Титул ещё не загружен. Нажмите «Получить титул».</p>';
            } else {
                switch (tab) {
                    case 'lines':
                        content = this.renderLinesTab(doc.docflowId, docData);
                        break;
                    case 'receipt':
                        content = this.renderReceiptTab(doc.docflowId, docData);
                        break;
                    case 'signature':
                        content = this.renderSignatureTab(doc.docflowId, docData);
                        break;
                    case 'history':
                        content = this.renderDocHistoryTab(doc.docflowId, docData);
                        break;
                    default:
                        content = this.renderLinesTab(doc.docflowId, docData);
                        break;
                }
            }

            return (
                '<div class="edo-panel">' +
                    header +
                    '<div class="edo-tab-bar">' +
                        this.renderDetailTabButton('lines', 'Строки', tab) +
                        this.renderDetailTabButton('receipt', 'Приход', tab) +
                        this.renderDetailTabButton('signature', 'Подпись', tab) +
                        this.renderDetailTabButton('history', 'История', tab) +
                    '</div>' +
                    content +
                '</div>'
            );
        },

        renderDetailTabButton(id, label, activeTab) {
            return '<div class="edo-tab' + (activeTab === id ? ' active' : '') + '" data-action="switch-tab" data-tab="' + id + '">' + escapeHtml(label) + '</div>';
        },

        renderLinesTab(docflowId, docData) {
            if (this.state.loadingLines) {
                return '<p>Загрузка строк документа...</p>';
            }
            const rows = docData.lines.map((line) => {
                const match = docData.matches[line.index] || null;
                const candidates = docData.candidates[line.index] || this.buildCandidates(line);
                const selectOptions = ['<option value="">— Не сопоставлено —</option>'].concat(candidates.map((candidate) => {
                    const percent = Math.round(candidate.score * 10);
                    return '<option value="' + candidate.product.id + '"' + (match && match.productId === candidate.product.id ? ' selected' : '') + '>' +
                        escapeHtml(candidate.product.name) + ' · ' + candidate.source + ' · ' + percent + '%'+
                    '</option>';
                }));
                const matchInfo = match ? '<div class="edo-match-info">' + escapeHtml(match.name) + ' (' + (match.source || '') + ' · ' + Math.round((match.score || 0) * 10) + '%)</div>' : '';
                return (
                    '<tr>' +
                        '<td>' + escapeHtml(line.name) + matchInfo + '</td>' +
                        '<td>' + formatCurrency(line.quantity) + ' ' + escapeHtml(line.unitName || '') + '</td>' +
                        '<td>' + formatCurrency(line.price) + '</td>' +
                        '<td>' + formatCurrency(line.subtotal) + '</td>' +
                        '<td>' + escapeHtml(line.barcode || '-') + '</td>' +
                        '<td>' + escapeHtml(line.article || '-') + '</td>' +
                        '<td>' +
                            '<div class="edo-line-match">' +
                                '<select class="edo-select" data-match-select data-doc="' + docflowId + '" data-line="' + line.index + '">' +
                                    selectOptions.join('') +
                                '</select>' +
                                '<button class="edo-button ghost" data-action="edo-match" data-doc="' + docflowId + '" data-line="' + line.index + '">🔍 Кандидаты</button>' +
                                '<button class="edo-button secondary" data-action="create-product" data-doc="' + docflowId + '" data-line="' + line.index + '">➕ Новая карточка</button>' +
                            '</div>' +
                        '</td>' +
                    '</tr>'
                );
            }).join('');

            return (
                '<div>' +
                    '<div class="edo-info-banner">Сопоставьте все строки накладной с карточками номенклатуры, после чего можно создать приход.</div>' +
                    '<div class="edo-scroll" style="max-height:360px;">' +
                        '<table class="edo-table">' +
                            '<thead><tr><th>Позиция</th><th>Кол-во</th><th>Цена</th><th>Сумма</th><th>Штрих-код</th><th>Артикул</th><th>Сопоставление</th></tr></thead>' +
                            '<tbody>' + rows + '</tbody>' +
                        '</table>' +
                    '</div>' +
                '</div>'
            );
        },

        renderReceiptTab(docflowId, docData) {
            const draft = this.getReceiptDraft(docflowId);
            if (!draft) return '<p>Нет данных по строкам.</p>';
            const rows = draft.items.map((item) => {
                return (
                    '<tr>' +
                        '<td>' + escapeHtml(item.line.name) + '</td>' +
                        '<td>' + formatCurrency(item.line.quantity) + ' ' + escapeHtml(item.line.unitName || '') + '</td>' +
                        '<td>' + formatCurrency(item.line.price) + '</td>' +
                        '<td>' + formatCurrency(item.total) + '</td>' +
                        '<td>' + (item.match ? '<span class="edo-tag"> ' + escapeHtml(item.match.name) + ' </span>' : '<span class="edo-status pending">нет</span>') + '</td>' +
                    '</tr>'
                );
            }).join('');
            return (
                '<div>' +
                    '<p class="edo-muted">После сопоставления всех позиций создайте приход. Он будет сохранён в статусе «draft» и доступен в учётном модуле.</p>' +
                    '<table class="edo-table">' +
                        '<thead><tr><th>Позиция</th><th>Кол-во</th><th>Цена</th><th>Сумма</th><th>Карточка</th></tr></thead>' +
                        '<tbody>' + rows + '</tbody>' +
                    '</table>' +
                    '<div class="edo-actions" style="margin-top:12px;">' +
                        '<button class="edo-button primary" data-action="create-receipt" data-doc="' + docflowId + '"' + (draft.ready ? '' : ' disabled') + '>📦 Создать приход</button>' +
                        (docData.receiptId ? '<span class="edo-tag">Приход #' + escapeHtml(String(docData.receiptId)) + ' (' + escapeHtml(docData.receiptStatus || 'draft') + ')</span>' : '') +
                    '</div>' +
                '</div>'
            );
        },

        renderSignatureTab(docflowId, docData) {
            return (
                '<div>' +
                    '<p class="edo-muted">Подпишите документ КЭП и отправьте титул покупателя или извещение.</p>' +
                    '<div class="edo-actions" style="margin-bottom:12px;">' +
                        '<button class="edo-button primary" data-action="sign-doc" data-doc="' + docflowId + '">✍️ Подписать</button>' +
                        '<button class="edo-button secondary" data-action="send-doc" data-doc="' + docflowId + '">📤 Отправить титул</button>' +
                        '<button class="edo-button danger" data-action="reject-doc" data-doc="' + docflowId + '">🚫 Отказ</button>' +
                    '</div>' +
                    '<p class="edo-muted">Статус подписи: ' + this.renderStatus(docData.signatureStatus) + '</p>' +
                '</div>'
            );
        },

        renderDocHistoryTab(docflowId, docData) {
            if (!docData.history.length) {
                return '<p class="edo-muted">История действий по документу появится после выполнения операций.</p>';
            }
            return (
                '<div class="edo-scroll" style="max-height:260px;">' +
                    docData.history.map((entry) => {
                        return '<div style="margin-bottom:8px;"><strong>' + formatDate(entry.timestamp) + ':</strong> ' + escapeHtml(entry.text) + '</div>';
                    }).join('') +
                '</div>'
            );
        },

        renderHistoryPanel(selectedDoc) {
            if (!this.state.activityLog.length) {
                return '';
            }
            return (
                '<div class="edo-panel">' +
                    '<h3>Журнал действий</h3>' +
                    '<div class="edo-scroll" style="max-height:200px;">' +
                        this.state.activityLog.map((log) => {
                            const matchesDoc = selectedDoc && log.docId === selectedDoc.docflowId;
                            return '<div style="margin-bottom:8px;">' +
                                '<strong>' + formatDate(log.timestamp) + '</strong> ' +
                                (matchesDoc ? '<span class="edo-tag">текущий документ</span> ' : '') +
                                escapeHtml(log.message) +
                            '</div>';
                        }).join('') +
                    '</div>' +
                '</div>'
            );
        },

        renderError(message) {
            return `
                <div class="edo-suite-error card">
                    <div class="card-header">
                        <h3 class="card-title">⚠️ Ошибка загрузки документов</h3>
                    </div>
                    <p>${message}</p>
                    <div class="card-actions">
                        <button class="btn btn-secondary" data-action="edo-retry-documents">Повторить</button>
                    </div>
                </div>
            `;
        },

        renderDocumentList(selectedDoc) {
            const rows = this.state.documents.map((doc) => {
                const selected = selectedDoc && selectedDoc.docflowId === doc.docflowId ? ' edo-doc-row selected' : ' edo-doc-row';
                const tags = [];
                if (doc.cached) {
                    tags.push('<span class="badge badge-warning">кэш</span>');
                }
                if (doc.status) {
                    tags.push('<span class="badge badge-secondary">' + escapeHtml(doc.status) + '</span>');
                }
                return (
                    '<tr class="' + selected + '" data-action="select-document" data-doc="' + doc.docflowId + '">' +
                        '<td>' + formatDate(doc.date) + '</td>' +
                        '<td>' + escapeHtml(doc.counterparty || 'Контрагент') + '<div class="edo-list-meta">#' + doc.docflowId + ' ' + tags.join(' ') + '</div></td>' +
                        '<td>' + escapeHtml(doc.number || '') + '</td>' +
                        '<td>' + escapeHtml(doc.type || '') + '</td>' +
                        '<td>' + escapeHtml(formatCurrency(doc.total || 0)) + '</td>' +
                        '<td>' + this.renderStatus(doc.status) + '</td>' +
                    '</tr>'
                );
            }).join('');

            return (
                '<div class="edo-panel">' +
                    '<div class="edo-panel-header">' +
                        '<h3>Список документов</h3>' +
                        '<div class="edo-panel-actions">' +
                            '<button class="edo-button ghost" data-action="edo-sync-status">🔄 Обновить статус</button>' +
                            '<button class="edo-button ghost" data-action="edo-retry-documents">🔁 Обновить список</button>' +
                        '</div>' +
                    '</div>' +
                    (this.state.loadingDocuments ? '<p>Загрузка документов...</p>' :
                        this.state.documents.length
                            ? '<div class="edo-scroll" style="max-height:280px;"><table class="edo-table"><thead><tr><th>Дата</th><th>Контрагент</th><th>Номер</th><th>Тип</th><th>Сумма</th><th>Статус</th></tr></thead><tbody>' +
                                rows +
                              '</tbody></table></div>'
                            : '<p>Документы не найдены.</p>') +
                '</div>'
            );
        },

        renderStatus(status) {
            switch ((status || '').toLowerCase()) {
                case 'incoming':
                case 'new':
                    return '<span class="edo-status incoming">входящий</span>';
                case 'awaiting-signature':
                case 'pending':
                    return '<span class="edo-status pending">ожидает подписи</span>';
                case 'signed':
                case 'completed':
                    return '<span class="edo-status completed">подписан</span>';
                case 'rejected':
                    return '<span class="edo-status rejected">отклонён</span>';
                case 'sent':
                    return '<span class="edo-status completed">отправлен</span>';
                default:
                    return '<span class="edo-status pending">' + escapeHtml(status || 'неизвестно') + '</span>';
            }
        },

        renderDetail(doc, docData, tab) {
            if (!doc) {
                return (
                    '<div class="edo-panel">' +
                        '<h3>Информация по документу</h3>' +
                        '<p class="edo-muted">Выберите документ из списка, чтобы увидеть детали, сопоставить строки и подписать.</p>' +
                    '</div>'
                );
            }

            const header = (
                '<div class="edo-detail-header">' +
                    '<div class="edo-detail-col">' +
                        '<strong>' + escapeHtml(doc.number || '-') + '</strong>' +
                        '<span class="edo-muted">' + formatDate(doc.date) + '</span>' +
                        this.renderStatus(docData ? docData.signatureStatus : doc.status) +
                    '</div>' +
                    '<div class="edo-detail-col">' +
                        '<span class="edo-muted">Контрагент</span>' +
                        '<strong>' + escapeHtml(doc.counterparty || '-') + '</strong>' +
                        '<span class="edo-muted">ИНН: ' + escapeHtml(doc.inn || '-') + '</span>' +
                    '</div>' +
                    '<div class="edo-detail-col">' +
                        '<span class="edo-muted">Сумма</span>' +
                        '<strong>' + formatCurrency(doc.total || 0) + ' ₽</strong>' +
                        '<span class="edo-muted">Тип: ' + escapeHtml(doc.type || '-') + '</span>' +
                    '</div>' +
                    '<div class="edo-detail-col edo-actions">' +
                        '<button class="edo-button secondary" data-action="parse-document" data-doc="' + doc.docflowId + '">📥 Получить титул</button>' +
                        '<button class="edo-button ghost" data-action="view-xml" data-doc="' + doc.docflowId + '">📄 XML</button>' +
                    '</div>' +
                '</div>'
            );

            let content = '';
            if (!docData || !docData.lines.length) {
                content = '<p class="edo-muted">Титул ещё не загружен. Нажмите «Получить титул».</p>';
            } else {
                switch (tab) {
                    case 'lines':
                        content = this.renderLinesTab(doc.docflowId, docData);
                        break;
                    case 'receipt':
                        content = this.renderReceiptTab(doc.docflowId, docData);
                        break;
                    case 'signature':
                        content = this.renderSignatureTab(doc.docflowId, docData);
                        break;
                    case 'history':
                        content = this.renderDocHistoryTab(doc.docflowId, docData);
                        break;
                    default:
                        content = this.renderLinesTab(doc.docflowId, docData);
                        break;
                }
            }

            return (
                '<div class="edo-panel">' +
                    header +
                    '<div class="edo-tab-bar">' +
                        this.renderDetailTabButton('lines', 'Строки', tab) +
                        this.renderDetailTabButton('receipt', 'Приход', tab) +
                        this.renderDetailTabButton('signature', 'Подпись', tab) +
                        this.renderDetailTabButton('history', 'История', tab) +
                    '</div>' +
                    content +
                '</div>'
            );
        },

        renderDetailTabButton(id, label, activeTab) {
            return '<div class="edo-tab' + (activeTab === id ? ' active' : '') + '" data-action="switch-tab" data-tab="' + id + '">' + escapeHtml(label) + '</div>';
        },

        renderLinesTab(docflowId, docData) {
            if (this.state.loadingLines) {
                return '<p>Загрузка строк документа...</p>';
            }
            const rows = docData.lines.map((line) => {
                const match = docData.matches[line.index] || null;
                const candidates = docData.candidates[line.index] || this.buildCandidates(line);
                const selectOptions = ['<option value="">— Не сопоставлено —</option>'].concat(candidates.map((candidate) => {
                    return '<option value="' + candidate.product.id + '"' + (match && match.productId === candidate.product.id ? ' selected' : '') + '>' +
                        escapeHtml(candidate.product.name) + ' · ' + candidate.source + ' · ' + candidate.score +
                    '</option>';
                }));
                return (
                    '<tr>' +
                        '<td>' + escapeHtml(line.name) + '</td>' +
                        '<td>' + formatCurrency(line.quantity) + ' ' + escapeHtml(line.unitName || '') + '</td>' +
                        '<td>' + formatCurrency(line.price) + '</td>' +
                        '<td>' + formatCurrency(line.subtotal) + '</td>' +
                        '<td>' + escapeHtml(line.barcode || '-') + '</td>' +
                        '<td>' + escapeHtml(line.article || '-') + '</td>' +
                        '<td>' +
                            '<div class="edo-line-match">' +
                                '<select class="edo-select" data-match-select data-doc="' + docflowId + '" data-line="' + line.index + '">' +
                                    selectOptions.join('') +
                                '</select>' +
                                '<button class="edo-button secondary" data-action="create-product" data-doc="' + docflowId + '" data-line="' + line.index + '">➕ Новая карточка</button>' +
                            '</div>' +
                        '</td>' +
                    '</tr>'
                );
            }).join('');

            return (
                '<div>' +
                    '<div class="edo-info-banner">Сопоставьте все строки накладной с карточками номенклатуры, после чего можно создать приход.</div>' +
                    '<div class="edo-scroll" style="max-height:360px;">' +
                        '<table class="edo-table">' +
                            '<thead><tr><th>Позиция</th><th>Кол-во</th><th>Цена</th><th>Сумма</th><th>Штрих-код</th><th>Артикул</th><th>Сопоставление</th></tr></thead>' +
                            '<tbody>' + rows + '</tbody>' +
                        '</table>' +
                    '</div>' +
                '</div>'
            );
        },

        renderReceiptTab(docflowId, docData) {
            const draft = this.getReceiptDraft(docflowId);
            if (!draft) return '<p>Нет данных по строкам.</p>';
            const rows = draft.items.map((item) => {
                return (
                    '<tr>' +
                        '<td>' + escapeHtml(item.line.name) + '</td>' +
                        '<td>' + formatCurrency(item.line.quantity) + ' ' + escapeHtml(item.line.unitName || '') + '</td>' +
                        '<td>' + formatCurrency(item.line.price) + '</td>' +
                        '<td>' + formatCurrency(item.total) + '</td>' +
                        '<td>' + (item.match ? '<span class="edo-tag"> ' + escapeHtml(item.match.name) + ' </span>' : '<span class="edo-status pending">нет</span>') + '</td>' +
                    '</tr>'
                );
            }).join('');
            return (
                '<div>' +
                    '<p class="edo-muted">После сопоставления всех позиций создайте приход. Он будет сохранён в статусе «draft» и доступен в учётном модуле.</p>' +
                    '<table class="edo-table">' +
                        '<thead><tr><th>Позиция</th><th>Кол-во</th><th>Цена</th><th>Сумма</th><th>Карточка</th></tr></thead>' +
                        '<tbody>' + rows + '</tbody>' +
                    '</table>' +
                    '<div class="edo-actions" style="margin-top:12px;">' +
                        '<button class="edo-button primary" data-action="create-receipt" data-doc="' + docflowId + '"' + (draft.ready ? '' : ' disabled') + '>📦 Создать приход</button>' +
                        (docData.receiptId ? '<span class="edo-tag">Приход #' + escapeHtml(String(docData.receiptId)) + ' (' + escapeHtml(docData.receiptStatus || 'draft') + ')</span>' : '') +
                    '</div>' +
                '</div>'
            );
        },

        renderSignatureTab(docflowId, docData) {
            return (
                '<div>' +
                    '<p class="edo-muted">Подпишите документ КЭП и отправьте титул покупателя или извещение.</p>' +
                    '<div class="edo-actions" style="margin-bottom:12px;">' +
                        '<button class="edo-button primary" data-action="sign-doc" data-doc="' + docflowId + '">✍️ Подписать</button>' +
                        '<button class="edo-button secondary" data-action="send-doc" data-doc="' + docflowId + '">📤 Отправить титул</button>' +
                        '<button class="edo-button danger" data-action="reject-doc" data-doc="' + docflowId + '">🚫 Отказ</button>' +
                    '</div>' +
                    '<p class="edo-muted">Статус подписи: ' + this.renderStatus(docData.signatureStatus) + '</p>' +
                '</div>'
            );
        },

        renderDocHistoryTab(docflowId, docData) {
            if (!docData.history.length) {
                return '<p class="edo-muted">История действий по документу появится после выполнения операций.</p>';
            }
            return (
                '<div class="edo-scroll" style="max-height:260px;">' +
                    docData.history.map((entry) => {
                        return '<div style="margin-bottom:8px;"><strong>' + formatDate(entry.timestamp) + ':</strong> ' + escapeHtml(entry.text) + '</div>';
                    }).join('') +
                '</div>'
            );
        },

        renderHistoryPanel(selectedDoc) {
            if (!this.state.activityLog.length) {
                return '';
            }
            return (
                '<div class="edo-panel">' +
                    '<h3>Журнал действий</h3>' +
                    '<div class="edo-scroll" style="max-height:200px;">' +
                        this.state.activityLog.map((log) => {
                            const matchesDoc = selectedDoc && log.docId === selectedDoc.docflowId;
                            return '<div style="margin-bottom:8px;">' +
                                '<strong>' + formatDate(log.timestamp) + '</strong> ' +
                                (matchesDoc ? '<span class="edo-tag">текущий документ</span> ' : '') +
                                escapeHtml(log.message) +
                            '</div>';
                        }).join('') +
                    '</div>' +
                '</div>'
            );
        },

        async syncDocumentStatus(docflowId) {
            try {
                const response = await this.apiFetch(`${API_BASE}/documents/${encodeURIComponent(docflowId)}/sync`, {
                    method: 'POST'
                });
                if (response.warning) {
                    window.alert(response.warning);
                }
                await this.loadDocuments();
                await this.refreshLines(docflowId, { withCandidates: true });
                window.alert('✅ Статус документа обновлён');
            } catch (error) {
                console.error('[EDO] sync status error', error);
                alert(error.message || 'Не удалось обновить статус документа');
            }
        },

        async loadDocuments() {
            this.setLoading('loadingDocuments', true);
            this.state.error = null;
            try {
                const data = await this.apiFetch(`${API_BASE}/documents`);
                if (data && data.docs) {
                    this.state.documents = data.docs.map(this.normalizeDocument);
                } else {
                    this.state.documents = clone(SAMPLE_DOCUMENTS);
                }
            } catch (error) {
                this.state.error = 'Не удалось загрузить документы. Показаны данные примера.';
                this.state.documents = clone(SAMPLE_DOCUMENTS);
            } finally {
                this.setLoading('loadingDocuments', false);
            }
            if (!this.state.selectedDocumentId && this.state.documents.length) {
                await this.selectDocument(this.state.documents[0].docflowId);
            } else {
                this.render();
            }
        },

        async loadDocument(docflowId) {
            const doc = this.state.documents.find((item) => item.docflowId === docflowId);
            if (!doc) {
                this.render();
                return;
            }
            const docData = this.ensureDocStore(doc);
            await this.refreshLines(docflowId, { withCandidates: true });
            if (!docData.lines || !docData.lines.length) {
                await this.parseDocument(doc);
            } else {
                this.render();
            }
        },

        async showMatchDialog(docflowId, lineIndex) {
            const doc = this.state.documents.find((item) => item.docflowId === docflowId);
            if (!doc) return;
            await this.refreshLines(docflowId, { withCandidates: true });
            const docData = this.state.docStore[docflowId];
            if (!docData) return;
            const line = docData.lines.find((item) => item.index === lineIndex);
            const candidates = (docData.candidates && docData.candidates[lineIndex]) || [];
            if (!candidates.length) {
                window.alert('Кандидаты не найдены. Добавьте карточку вручную или настройте правило сопоставления.');
                return;
            }
            const promptText = candidates
                .map((candidate, idx) => `${idx + 1}. ${candidate.name} (${Math.round((candidate.score || 0) * 100)}%, ${candidate.source})`)
                .join('\n');
            const answer = await this.promptInput(
                `Выберите номер кандидата для строки "${line.name}"`,
                `Введите номер (1-${candidates.length})\n\n${promptText}`,
                ''
            );
            if (!answer) return;
            const index = parseInt(answer, 10);
            if (!Number.isFinite(index) || index < 1 || index > candidates.length) {
                window.alert('Неверный номер кандидата');
                return;
            }
            const selected = candidates[index - 1];
            await this.setMatch(docflowId, lineIndex, {
                productId: selected.id,
                source: selected.source,
                score: selected.score,
                manual: true
            });
        }
    };

    if (typeof document !== 'undefined') {
        global.edoModule = edoModule;
    }
})(typeof window !== 'undefined' ? window : globalThis);

