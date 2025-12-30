// Модуль управления карточками товаров с групповыми операциями (как в LPmotor)
(function() {
    'use strict';

    const DEFAULT_FILTERS = {
        search: '',
        category: '',
        type: 'all',
        stock: 'all',
        visible: 'all',
        promo: 'all',
        hasBarcode: 'all'
    };

    const FILTER_STORAGE_KEY = 'dandy_filters_state';
    const TABLE_PREFS_STORAGE_KEY = 'dandy_table_prefs';
    const FEATURE_FLAGS_STORAGE_KEY = 'dandy_feature_flags';

    const TABLE_COLUMNS = [
        { key: 'image', label: 'Изображение', default: true },
        { key: 'sku', label: 'Артикул', default: true },
        { key: 'barcode', label: 'Штрих-код', default: true },
        { key: 'price', label: 'Цена', default: true },
        { key: 'cost', label: 'Себест.', default: true },
        { key: 'quantity', label: 'Остаток', default: true },
        { key: 'weight', label: 'Вес', default: false },
        { key: 'calories', label: 'Ккал', default: true },
        { key: 'categories', label: 'Категории', default: true },
        { key: 'status', label: 'Статус', default: true },
        { key: 'sync', label: 'Синхронизация', default: true }
    ];

    const COLUMN_LOOKUP = TABLE_COLUMNS.reduce((acc, column) => {
        acc[column.key] = column;
        return acc;
    }, {});

    const DEFAULT_COLUMN_VISIBILITY = TABLE_COLUMNS.reduce((acc, column) => {
        acc[column.key] = column.default !== false;
        return acc;
    }, {});

    const FEATURE_FLAG_DEFINITIONS = [
        {
            key: 'advancedMediaUX',
            label: 'Расширенная медиатека',
            description: 'Drag & drop изображения, эффекты, роли primary/hover.'
        },
        {
            key: 'historyCompare',
            label: 'Сравнение версий истории',
            description: 'Выбор ключевых версий и визуальный дифф.'
        }
    ];

    const DEFAULT_FEATURE_FLAGS = FEATURE_FLAG_DEFINITIONS.reduce((acc, flag) => {
        acc[flag.key] = true;
        return acc;
    }, {});

    const ROLE_MATRIX = {
        admin: {
            label: 'Администратор',
            summary: 'Полный доступ',
            permissions: {
                'product.create': true,
                'product.update': true,
                'product.delete': true,
                'product.price': true,
                'product.stock': true,
                'product.visibility': true,
                'product.bulk': true,
                'product.import': true,
                'product.export': true,
                'category.manage': true,
                'modifier.manage': true,
                'history.restore': true,
                'sync.trigger': true
            }
        },
        content: {
            label: 'Контент-менеджер',
            summary: 'Создание и редактирование без удаления',
            permissions: {
                'product.create': true,
                'product.update': true,
                'product.delete': false,
                'product.price': true,
                'product.stock': true,
                'product.visibility': true,
                'product.bulk': true,
                'product.import': true,
                'product.export': true,
                'category.manage': false,
                'modifier.manage': false,
                'history.restore': false,
                'sync.trigger': true
            }
        },
        cashier: {
            label: 'Кассир',
            summary: 'Просмотр + остатки/видимость',
            permissions: {
                'product.create': false,
                'product.update': false,
                'product.delete': false,
                'product.price': false,
                'product.stock': true,
                'product.visibility': true,
                'product.bulk': false,
                'product.import': false,
                'product.export': false,
                'category.manage': false,
                'modifier.manage': false,
                'history.restore': false,
                'sync.trigger': false
            }
        },
        viewer: {
            label: 'Наблюдатель',
            summary: 'Только просмотр',
            permissions: {
                'product.create': false,
                'product.update': false,
                'product.delete': false,
                'product.price': false,
                'product.stock': false,
                'product.visibility': false,
                'product.bulk': false,
                'product.import': false,
                'product.export': false,
                'category.manage': false,
                'modifier.manage': false,
                'history.restore': false,
                'sync.trigger': false
            }
        }
    };

    const ProductCardsManager = {
        products: [],
        categories: [],
        modifiers: [],
        parameterPresets: [],
        historyCache: {},
        historyMajorsCache: {},
        historyCompareState: {},
        syncStatusCache: {},
        wizardState: null,
        wizardModal: null,
        draftAutosaveTimer: null,
        boundBeforeUnload: null,
        variantParameters: [],
        mediaLibrary: [],
        importJob: null,
        importJobPoll: null,
        exportJobPolls: new Map(),
        roles: ROLE_MATRIX,
        activeRole: 'admin',
        selectedProducts: new Set(),
        currentFilters: { ...DEFAULT_FILTERS },
        currentPage: 1,
        rowsPerPage: 10,
        meta: {
            total: 0,
            pages: 1,
            limit: 10
        },
        tableColumnsVisibility: { ...DEFAULT_COLUMN_VISIBILITY },
        featureFlags: { ...DEFAULT_FEATURE_FLAGS },
        syncPollingTimer: null,
        syncPollingInterval: 15000,
        isSyncPolling: false,
        lastSyncPollAt: null,
        authToken: null,
        authUser: null,
        authError: '',
        initialDataLoaded: false,
        listenersBound: false,

        loadActiveRole() {
            const saved = localStorage.getItem('dandy_admin_role');
            if (saved && this.roles[saved]) {
                return saved;
            }
            return 'admin';
        },

        saveActiveRole(role) {
            try {
                localStorage.setItem('dandy_admin_role', role);
            } catch (_) {
                // ignore storage issues (private mode etc.)
            }
        },

        getRoleConfig(role = this.activeRole) {
            return this.roles[role] || this.roles.admin;
        },

        can(permission) {
            const roleConfig = this.getRoleConfig();
            return Boolean(roleConfig.permissions[permission]);
        },

        ensurePermission(permission, message) {
            if (this.can(permission)) {
                return true;
            }
            const roleConfig = this.getRoleConfig();
            alert(message || `Роль "${roleConfig.label}" не имеет доступа к этому действию.`);
            return false;
        },

        setRole(role) {
            if (!this.roles[role]) return;
            if (this.authUser && this.authUser.role !== role) {
                alert('Роль определяется вашей учетной записью');
                return;
            }
            this.activeRole = role;
            this.saveActiveRole(role);
            this.renderProductsTable();
            this.applyRoleRestrictions();
        },

        getRoleHeaders() {
            const headers = {};
            if (this.authToken) {
                headers.Authorization = `Bearer ${this.authToken}`;
            }
            return headers;
        },

        async fetchWithRole(url, options = {}) {
            const headers = Object.assign({}, options.headers || {}, this.getRoleHeaders());
            const safeOptions = Object.assign({}, options, { headers });
            const response = await fetch(url, safeOptions);
            if (response.status === 401) {
                this.handleUnauthorized();
                throw new Error('Требуется авторизация');
            }
            return response;
        },

        describeCurrentRole() {
            const roleConfig = this.getRoleConfig();
            return roleConfig.summary || '';
        },

        loadAuthToken() {
            try {
                return localStorage.getItem('dandy_auth_token');
            } catch (_) {
                return null;
            }
        },

        saveAuthToken(token) {
            try {
                if (token) {
                    localStorage.setItem('dandy_auth_token', token);
                } else {
                    localStorage.removeItem('dandy_auth_token');
                }
            } catch (_) {
                // ignore storage issues
            }
        },

        clearAuthState() {
            this.authToken = null;
            this.authUser = null;
            this.authError = '';
            this.activeRole = 'viewer';
            this.saveActiveRole(this.activeRole);
            this.products = [];
            this.categories = [];
            this.modifiers = [];
            this.parameterPresets = [];
            this.historyCache = {};
            this.syncStatusCache = {};
            this.stopSyncPolling();
            this.initialDataLoaded = false;
        },

        async ensureSession() {
            if (this.authToken && this.authUser) {
                return true;
            }
            const saved = this.loadAuthToken();
            if (!saved) {
                return false;
            }
            this.authToken = saved;
            try {
                await this.fetchProfile();
                this.authError = '';
                return true;
            } catch (error) {
                console.warn('Не удалось восстановить сессию:', error.message);
                this.clearAuthState();
                this.saveAuthToken(null);
                this.authError = 'Сессия истекла, выполните вход снова.';
                return false;
            }
        },

        async fetchProfile() {
            const response = await this.fetchWithRole('/api/auth/profile');
            const result = await response.json().catch(() => ({}));
            if (!response.ok || result.success === false) {
                throw new Error(result.error || 'Не удалось загрузить профиль');
            }
            this.authUser = result.data;
            this.activeRole = this.authUser.role || 'viewer';
            this.saveActiveRole(this.activeRole);
            return this.authUser;
        },

        async login(email, password) {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || result.success === false) {
                throw new Error(result.error || 'Не удалось выполнить вход');
            }
            this.authToken = result.data?.token || null;
            this.authUser = result.data?.user || null;
            if (!this.authToken || !this.authUser) {
                throw new Error('Сервер не вернул токен авторизации');
            }
            this.saveAuthToken(this.authToken);
            this.activeRole = this.authUser.role || 'viewer';
            this.saveActiveRole(this.activeRole);
        },

        async logout() {
            try {
                if (this.authToken) {
                    await this.fetchWithRole('/api/auth/logout', { method: 'POST' });
                }
            } catch (_) {
                // ignore
            }
            this.saveAuthToken(null);
            this.clearAuthState();
            this.renderAuthGateOnly();
        },

        handleUnauthorized() {
            this.saveAuthToken(null);
            this.clearAuthState();
            this.authError = 'Сессия недействительна или истекла. Повторите вход.';
            this.renderAuthGateOnly();
        },

        renderAuthGate() {
            return `
                <div style="max-width:420px; margin: 40px auto; padding: 32px; border-radius: 18px; border: 1px solid rgba(226,232,240,1); background: rgba(255,255,255,0.95); box-shadow: 0 15px 35px rgba(15,23,42,0.08);">
                    <h2 style="margin-top:0; color:rgba(15,23,42,1);">Вход в панель управления</h2>
                    <p style="color:rgba(100,116,139,1); font-size:0.95rem; margin-bottom:1rem;">Используйте корпоративный аккаунт для работы с карточками товаров.</p>
                    ${this.authError ? `<div style="margin-bottom:1rem; padding:0.75rem 1rem; border-radius:10px; background:rgba(248,113,113,0.12); color:rgba(153,27,27,1); font-size:0.9rem;">${this.escapeHtml(this.authError)}</div>` : ''}
                    <form id="authLoginForm" style="display:flex; flex-direction:column; gap:12px;">
                        <div>
                            <label style="display:block; font-size:0.85rem; color:rgba(71,85,105,1); margin-bottom:4px;">Email</label>
                            <input type="email" name="email" required class="form-input" placeholder="user@dandy.local">
                        </div>
                        <div>
                            <label style="display:block; font-size:0.85rem; color:rgba(71,85,105,1); margin-bottom:4px;">Пароль</label>
                            <input type="password" name="password" required class="form-input" placeholder="Введите пароль">
                        </div>
                        <button type="submit" class="btn btn--primary" style="margin-top:8px;">Войти</button>
                    </form>
                </div>
            `;
        },

        attachAuthHandlers() {
            const form = document.getElementById('authLoginForm');
            if (form) {
                form.addEventListener('submit', (event) => this.handleLoginSubmit(event));
            }
        },

        renderAuthGateOnly() {
            const container = document.getElementById('productCardsContent');
            if (!container) return;
            container.innerHTML = this.renderAuthGate();
            this.attachAuthHandlers();
        },

        async handleLoginSubmit(event) {
            event.preventDefault();
            const form = event.target;
            const submitBtn = form.querySelector('button[type="submit"]');
            const email = form.email.value.trim();
            const password = form.password.value;
            if (!email || !password) {
                this.authError = 'Введите email и пароль';
                this.renderAuthGateOnly();
                return;
            }
            try {
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Входим...';
                }
                await this.login(email, password);
                this.authError = '';
                await this.render();
            } catch (error) {
                console.error('Auth login error:', error);
                this.authError = error.message || 'Не удалось выполнить вход';
                this.renderAuthGateOnly();
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Войти';
                }
            }
        },

        bootstrapPreferences() {
            try {
                this.activeRole = this.loadActiveRole();
                this.currentFilters = this.loadFiltersFromStorage();
                const tablePrefs = this.loadTablePreferences();
                this.tableColumnsVisibility = tablePrefs.columns;
                this.rowsPerPage = tablePrefs.rowsPerPage || this.rowsPerPage;
                this.meta.limit = this.rowsPerPage;
                this.featureFlags = this.loadFeatureFlags();
                this.authToken = this.loadAuthToken();
            } catch (error) {
                console.warn('Не удалось загрузить настройки пользователя', error);
            }
        },

        loadFiltersFromStorage() {
            try {
                const raw = localStorage.getItem(FILTER_STORAGE_KEY);
                if (!raw) return { ...DEFAULT_FILTERS };
                const parsed = JSON.parse(raw);
                if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_FILTERS };
                return { ...DEFAULT_FILTERS, ...parsed };
            } catch (_) {
                return { ...DEFAULT_FILTERS };
            }
        },

        persistFilters() {
            try {
                localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(this.currentFilters));
            } catch (_) {
                // ignore private mode errors
            }
        },

        loadTablePreferences() {
            try {
                const raw = localStorage.getItem(TABLE_PREFS_STORAGE_KEY);
                if (!raw) {
                    return {
                        rowsPerPage: this.rowsPerPage,
                        columns: { ...DEFAULT_COLUMN_VISIBILITY }
                    };
                }
                const parsed = JSON.parse(raw);
                return {
                    rowsPerPage: parsed?.rowsPerPage || this.rowsPerPage,
                    columns: {
                        ...DEFAULT_COLUMN_VISIBILITY,
                        ...(parsed?.columns || {})
                    }
                };
            } catch (_) {
                return { rowsPerPage: this.rowsPerPage, columns: { ...DEFAULT_COLUMN_VISIBILITY } };
            }
        },

        persistTableSettings() {
            try {
                localStorage.setItem(
                    TABLE_PREFS_STORAGE_KEY,
                    JSON.stringify({
                        rowsPerPage: this.rowsPerPage,
                        columns: this.tableColumnsVisibility
                    })
                );
            } catch (_) {
                // ignore
            }
        },

        resetTableColumns() {
            this.tableColumnsVisibility = { ...DEFAULT_COLUMN_VISIBILITY };
            this.persistTableSettings();
            this.renderProductsTable();
        },

        loadFeatureFlags() {
            try {
                const raw = localStorage.getItem(FEATURE_FLAGS_STORAGE_KEY);
                if (!raw) return { ...DEFAULT_FEATURE_FLAGS };
                const parsed = JSON.parse(raw);
                return { ...DEFAULT_FEATURE_FLAGS, ...(parsed || {}) };
            } catch (_) {
                return { ...DEFAULT_FEATURE_FLAGS };
            }
        },

        persistFeatureFlags() {
            try {
                localStorage.setItem(FEATURE_FLAGS_STORAGE_KEY, JSON.stringify(this.featureFlags));
            } catch (_) {
                // ignore
            }
        },

        isFeatureEnabled(flag) {
            if (!(flag in DEFAULT_FEATURE_FLAGS)) return true;
            return this.featureFlags?.[flag] !== false;
        },

        applyRoleRestrictions() {
            if (!this.authUser) {
                return;
            }
            const summaryEl = document.getElementById('roleSummaryText');
            if (summaryEl) {
                summaryEl.textContent = this.describeCurrentRole();
            }

            const visibilityMap = [
                { selector: '#addProductBtn', perm: 'product.create' },
                { selector: '#showImportBtn', perm: 'product.import' },
                { selector: '#exportCsvBtn', perm: 'product.export' },
                { selector: '#exportYmlBtn', perm: 'product.export' },
                { selector: '#manageCategoriesBtn', perm: 'category.manage' }
            ];

            visibilityMap.forEach(({ selector, perm }) => {
                const node = document.querySelector(selector);
                if (!node) return;
                node.style.display = this.can(perm) ? '' : 'none';
            });

            document.querySelectorAll('[data-sync-targets]').forEach((button) => {
                button.disabled = !this.can('sync.trigger');
                if (button.disabled) {
                    button.title = 'Недоступно для текущей роли';
                } else {
                    button.removeAttribute('title');
                }
            });

            document.querySelectorAll('[data-history-restore]').forEach((button) => {
                const hasSnapshot = button.getAttribute('data-has-snapshot') === 'true';
                const allowed = this.can('history.restore') && hasSnapshot;
                button.disabled = !allowed;
                button.style.cursor = allowed ? 'pointer' : 'not-allowed';
                button.title = allowed ? 'Восстановить карточку' : 'Недоступно для текущей роли';
            });
        },

        isColumnVisible(key) {
            const definition = COLUMN_LOOKUP[key];
            if (!definition) return true;
            // Колонка "Название" и "Действия" заблокированы вне списка, возвращаем true.
            return this.tableColumnsVisibility[key] !== false;
        },

        getColumnStyle(key) {
            return this.isColumnVisible(key) ? '' : 'display: none;';
        },

        openColumnsModal() {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content small">
                    <div class="modal-header">
                        <h3>⚙️ Настройка колонок</h3>
                        <button class="modal-close">×</button>
                    </div>
                    <div class="modal-body">
                        <p style="color:#6b7280; font-size:0.9rem;">Отметьте колонки, которые хотите видеть в таблице. Изменения сохраняются автоматически.</p>
                        <div style="display:flex; flex-direction:column; gap:0.35rem; margin-top:0.75rem;">
                            ${TABLE_COLUMNS.map(
                                (column) => `
                                    <label style="display:flex; align-items:center; gap:0.5rem; font-size:0.9rem;">
                                        <input type="checkbox" data-column-toggle value="${column.key}" ${
                                    this.isColumnVisible(column.key) ? 'checked' : ''
                                }>
                                        <span>${column.label}</span>
                                    </label>
                                `
                            ).join('')}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" data-columns-reset>Сбросить</button>
                        <button class="btn btn-primary" data-close>Готово</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            const closeModal = () => modal.remove();
            modal.addEventListener('click', (event) => {
                if (event.target === modal || event.target.matches('.modal-close') || event.target.dataset.close !== undefined) {
                    closeModal();
                }
            });
            modal.querySelectorAll('[data-column-toggle]').forEach((checkbox) => {
                checkbox.addEventListener('change', (event) => {
                    const key = event.target.value;
                    this.tableColumnsVisibility[key] = event.target.checked;
                    this.persistTableSettings();
                    this.renderProductsTable();
                });
            });
            const resetBtn = modal.querySelector('[data-columns-reset]');
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    this.resetTableColumns();
                    modal.remove();
                });
            }
        },

        openFeatureFlagsModal() {
            if (this.activeRole !== 'admin') {
                alert('Только администратор может менять флаги функций.');
                return;
            }
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content small">
                    <div class="modal-header">
                        <h3>🧪 Feature flags</h3>
                        <button class="modal-close">×</button>
                    </div>
                    <div class="modal-body">
                        <p style="color:#6b7280; font-size:0.9rem;">Включайте/выключайте экспериментальные возможности. Изменения сохраняются только для вас.</p>
                        <div style="display:flex; flex-direction:column; gap:0.75rem; margin-top:0.75rem;">
                            ${FEATURE_FLAG_DEFINITIONS.map(
                                (flag) => `
                                    <label style="display:flex; gap:0.5rem; align-items:flex-start;">
                                        <input type="checkbox" data-flag-toggle value="${flag.key}" ${
                                    this.isFeatureEnabled(flag.key) ? 'checked' : ''
                                }>
                                        <span>
                                            <strong>${flag.label}</strong>
                                            <div style="color:#6b7280; font-size:0.85rem;">${flag.description}</div>
                                        </span>
                                    </label>
                                `
                            ).join('')}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" data-close>Закрыть</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            const closeModal = () => modal.remove();
            modal.addEventListener('click', (event) => {
                if (event.target === modal || event.target.matches('.modal-close') || event.target.dataset.close !== undefined) {
                    closeModal();
                }
            });
            modal.querySelectorAll('[data-flag-toggle]').forEach((checkbox) => {
                checkbox.addEventListener('change', (event) => {
                    const flag = event.target.value;
                    this.featureFlags[flag] = event.target.checked;
                    this.persistFeatureFlags();
                    alert('⚠️ Перезагрузите список или мастер, чтобы изменения вступили в силу.');
                });
            });
        },

        // Загрузка модификаторов
        async loadModifiers() {
            try {
                // На проде обычно работает PHP роут /api/modifiers; локально может быть Node /api/catalog/modifiers.
                const result = await this.catalogRequest('/modifiers', { method: 'GET' });
                    this.modifiers = Array.isArray(result?.data) ? result.data : [];
                    return;
            } catch (error) {
                console.warn('Ошибка загрузки модификаторов:', error);
            }
            this.modifiers = [];
        },

        async loadParameterPresets() {
            try {
                const result = await this.catalogRequest('/products/presets');
                this.parameterPresets = Array.isArray(result?.data) ? result.data : [];
                this.updatePresetSelectOptions();
            } catch (error) {
                console.warn('Ошибка загрузки пресетов параметров:', error);
                this.parameterPresets = [];
            }
        },

        async loadProductHistory(productId, limit = 10) {
            if (!productId) return [];
            try {
                const params = new URLSearchParams({
                    limit: String(limit),
                    majorLimit: '3'
                });
                const response = await this.fetchWithRole(
                    `/api/catalog/products/${encodeURIComponent(productId)}/history?${params.toString()}`
                );
                if (response.ok) {
                    const result = await response.json();
                    const payload = result?.data || {};
                    if (Array.isArray(payload)) {
                        this.historyCache[productId] = payload;
                        this.historyMajorsCache[productId] = [];
                    } else {
                        this.historyCache[productId] = Array.isArray(payload.entries) ? payload.entries : [];
                        this.historyMajorsCache[productId] = Array.isArray(payload.majors) ? payload.majors : [];
                    }
                }
            } catch (error) {
                console.warn('Ошибка загрузки истории:', error);
            }
            return this.historyCache[productId] || [];
        },

        async loadSyncStatuses(productIds = []) {
            const ids = (productIds || []).filter(Boolean);
            if (!ids.length) return {};
            try {
                const response = await this.fetchWithRole(`/api/catalog/sync/status?ids=${encodeURIComponent(ids.join(','))}`);
                if (response.ok) {
                    const result = await response.json();
                    if (result?.data && typeof result.data === 'object') {
                        Object.assign(this.syncStatusCache, result.data);
                    }
                }
            } catch (error) {
                console.warn('Ошибка загрузки статусов синхронизации:', error);
            }
            return this.syncStatusCache;
        },

        async loadSyncStatus(productId) {
            if (!productId) return {};
            try {
                const response = await this.fetchWithRole(`/api/catalog/products/${encodeURIComponent(productId)}/sync/status`);
                if (response.ok) {
                    const result = await response.json();
                    if (result?.data) {
                        this.syncStatusCache[productId] = result.data;
                    }
                }
            } catch (error) {
                console.warn('Ошибка загрузки статуса синхронизации:', error);
            }
            return this.syncStatusCache[productId] || {};
        },

        resolveDraftMeta(mode, productId) {
            if (mode === 'create') {
                let draftId = localStorage.getItem('dandy_new_product_draft_id');
                if (!draftId) {
                    draftId = `draft_${Date.now()}`;
                    localStorage.setItem('dandy_new_product_draft_id', draftId);
                }
                return { productKey: 'new', draftId };
            }
            return { productKey: productId, draftId: productId };
        },

        async fetchDraftPayload(productKey, draftId) {
            if (!productKey) return null;
            const params = new URLSearchParams();
            if (productKey === 'new' && draftId) {
                params.append('draft_id', draftId);
            }
            const path = `/api/catalog/products/${productKey}/draft${params.toString() ? `?${params.toString()}` : ''}`;
            try {
                const response = await this.fetchWithRole(path);
                if (!response.ok) {
                    if (response.status === 404) {
                        return null;
                    }
                    const error = await response.json().catch(() => ({}));
                    throw new Error(error.error || response.statusText);
                }
                const result = await response.json().catch(() => ({}));
                return result?.data || null;
            } catch (error) {
                console.warn('Ошибка загрузки черновика:', error);
                return null;
            }
        },

        markDraftDirty() {
            if (this.wizardState) {
                this.wizardState.isDraftDirty = true;
            }
        },

        initDraftAutosave() {
            this.stopDraftAutosave();
            if (!this.wizardModal) return;
            const form = this.wizardModal.querySelector('#productWizardForm');
            if (form) {
                const handler = () => this.markDraftDirty();
                form.addEventListener('input', handler);
                form.addEventListener('change', handler);
                this.wizardState.inputHandler = handler;
            }
            this.draftAutosaveTimer = setInterval(() => this.saveDraftSnapshot(), 5000);
            if (!this.boundBeforeUnload) {
                this.boundBeforeUnload = this.handleBeforeUnload.bind(this);
            }
            window.addEventListener('beforeunload', this.boundBeforeUnload);
        },

        stopDraftAutosave() {
            if (this.draftAutosaveTimer) {
                clearInterval(this.draftAutosaveTimer);
                this.draftAutosaveTimer = null;
            }
            if (this.boundBeforeUnload) {
                window.removeEventListener('beforeunload', this.boundBeforeUnload);
            }
            if (this.wizardState?.inputHandler && this.wizardModal) {
                const form = this.wizardModal.querySelector('#productWizardForm');
                if (form) {
                    form.removeEventListener('input', this.wizardState.inputHandler);
                    form.removeEventListener('change', this.wizardState.inputHandler);
                }
                delete this.wizardState.inputHandler;
            }
        },

        handleBeforeUnload(event) {
            if (this.wizardState?.isDraftDirty) {
                event.preventDefault();
                event.returnValue = '';
            }
        },

        async saveDraftSnapshot(force = false) {
            if (!this.wizardState) return;
            if (!this.wizardState.isDraftDirty && !force) return;
            const { productKey, draftId } = this.wizardState;
            if (!productKey || !draftId) return;
            try {
                const payload = this.collectWizardFormData();
                const variantParameters = Array.isArray(this.variantParameters)
                    ? this.variantParameters.map((param) => ({
                          name: param.name || '',
                          values: Array.isArray(param.values) ? param.values.slice(0, 20) : []
                      }))
                    : [];
                const body = { payload: { ...payload, variant_parameters: variantParameters } };
                if (productKey === 'new') {
                    body.draft_id = draftId;
                }
                await this.catalogRequest(`/products/${productKey}/draft`, {
                    method: 'POST',
                    body
                });
                this.wizardState.isDraftDirty = false;
                this.wizardState.lastDraftSavedAt = Date.now();
            } catch (error) {
                console.warn('Не удалось сохранить черновик:', error);
            }
        },

        async deleteDraftSnapshot() {
            if (!this.wizardState) return;
            const { productKey, draftId } = this.wizardState;
            if (!productKey || !draftId) return;
            const params = new URLSearchParams();
            if (productKey === 'new') {
                params.append('draft_id', draftId);
            }
            try {
                const response = await this.fetchWithRole(`/api/catalog/products/${productKey}/draft${params.toString() ? `?${params.toString()}` : ''}`, {
                    method: 'DELETE'
                });
                if (!response.ok && response.status !== 404) {
                    const error = await response.json().catch(() => ({}));
                    throw new Error(error.error || response.statusText);
                }
            } catch (error) {
                console.warn('Не удалось удалить черновик:', error);
            }
        },

        confirmWizardClose() {
            if (this.wizardState?.isDraftDirty) {
                return confirm('Есть несохранённые изменения. Закрыть мастер и оставить черновик?');
            }
            return true;
        },

        closeWizardModal() {
            this.stopDraftAutosave();
            const productId = this.wizardState?.productId;
            if (this.wizardModal) {
                this.wizardModal.remove();
                this.wizardModal = null;
            }
            this.wizardState = null;
            this.variantParameters = [];
            this.mediaLibrary = [];
            if (productId) {
                delete this.historyCompareState[productId];
            }
        },

        renderHistoryTimeline(productId) {
            if (!this.isFeatureEnabled('historyCompare')) {
                return this.renderLegacyHistoryTimeline(productId);
            }
            const history = this.historyCache[productId] || [];
            const majors = this.historyMajorsCache[productId] || [];
            const compareState = this.getHistoryCompareState(productId);
            if (!history.length) {
                return '<p style="color: #9ca3af;">История изменений появится после сохранения.</p>';
            }
            const canRestore = this.can('history.restore');
            const majorRail =
                majors.length > 0
                    ? `<div style="margin-bottom: 1rem;">
                        <div style="font-size:0.85rem;font-weight:600;color:rgba(15,23,42,0.7);margin-bottom:0.35rem;">Ключевые версии</div>
                        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                            ${majors
                                .map((entry) => {
                                    const isSelected = compareState.selections.includes(entry.id);
                                    return `<button type="button"
                                        class="btn btn--ghost"
                                        data-history-compare
                                        data-product-id="${productId}"
                                        data-history-id="${entry.id}"
                                        style="border:1px solid rgba(15,23,42,0.12); padding:0.35rem 0.75rem; border-radius:999px; font-size:0.8rem; display:flex; align-items:center; gap:6px; ${
                                            isSelected ? 'background: rgba(16,185,129,0.12); border-color: rgba(16,185,129,0.4);' : ''
                                        }">
                                        ${entry.action || 'update'}
                                        <span style="color:#6b7280;">${this.formatHistoryTimestamp(entry)}</span>
                                    </button>`;
                                })
                                .join('')}
                        </div>
                    </div>`
                    : '';

            const timeline = `<ul style="list-style: none; padding: 0; margin: 0;">${history
                .map((entry) => {
                    const isSelected = compareState.selections.includes(entry.id);
                    return `
                    <li style="padding: 0.65rem 0; border-bottom: 1px solid rgba(229,231,235,1); ${
                        isSelected ? 'background: rgba(16,185,129,0.05);' : ''
                    }">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
                            <div>
                                <div style="font-weight: 600; text-transform: capitalize;">${entry.action || 'update'}</div>
                                <div style="font-size: 0.85rem; color: rgba(107,114,128,1);">
                                    ${this.formatHistoryTimestamp(entry)} — ${entry.actor || 'system'}
                                </div>
                                ${
                                    entry.diff_fields
                                        ? `<div style="font-size:0.8rem; color: rgba(75,85,99,1);">Изменено полей: ${entry.diff_fields}</div>`
                                        : ''
                                }
                                ${entry.targets ? `<div style="font-size: 0.8rem; color: rgba(75,85,99,1);">Цели: ${entry.targets.join(', ')}</div>` : ''}
                            </div>
                            <div style="display:flex; flex-direction:column; gap:6px; align-items:flex-end;">
                                <button type="button" class="btn btn--ghost btn--sm"
                                    data-history-compare
                                    data-product-id="${productId}"
                                    data-history-id="${entry.id}">
                                    ${isSelected ? '✅ Выбрано' : '🆚 Сравнить'}
                                </button>
                                ${
                                    canRestore
                                        ? `<button type="button" class="btn btn--secondary btn--sm"
                                            data-history-restore
                                            data-product-id="${productId}"
                                            data-history-id="${entry.id}"
                                            data-has-snapshot="${entry.snapshot ? 'true' : 'false'}"
                                            ${entry.snapshot ? '' : 'disabled'}
                                            title="${entry.snapshot ? 'Восстановить карточку на эту дату' : 'Снимок недоступен'}"
                                            style="min-width:120px;">
                                            ↩️ Восстановить
                                        </button>`
                                        : ''
                                }
                            </div>
                        </div>
                        ${this.renderHistoryDiff(entry.diff)}
                    </li>`;
                })
                .join('')}</ul>`;

            const comparePanel = this.renderHistoryComparePanel(productId);
            return `${majorRail}${timeline}${comparePanel}`;
        },

        renderLegacyHistoryTimeline(productId) {
            const history = this.historyCache[productId] || [];
            if (!history.length) {
                return '<p style="color: #9ca3af;">История изменений появится после сохранения.</p>';
            }
            const canRestore = this.can('history.restore');
            return `<ul style="list-style:none; padding:0; margin:0;">
                ${history
                    .map(
                        (entry) => `
                        <li style="padding:0.5rem 0; border-bottom:1px solid rgba(229,231,235,1);">
                            <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
                                <div>
                                    <div style="font-weight:600;">${entry.action || 'update'}</div>
                                    <div style="font-size:0.85rem; color:rgba(107,114,128,1);">
                                        ${this.formatHistoryTimestamp(entry)} — ${entry.actor || 'system'}
                                    </div>
                                </div>
                                ${
                                    canRestore
                                        ? `<button type="button" class="btn btn--secondary btn--sm"
                                            data-history-restore
                                            data-product-id="${productId}"
                                            data-history-id="${entry.id}"
                                            data-has-snapshot="${entry.snapshot ? 'true' : 'false'}"
                                            ${entry.snapshot ? '' : 'disabled'}>
                                            ↩️ Восстановить
                                        </button>`
                                        : ''
                                }
                            </div>
                            ${this.renderHistoryDiff(entry.diff)}
                        </li>`
                    )
                    .join('')}
            </ul>`;
        },

        formatHistoryTimestamp(entry) {
            const ts = entry.timestamp || entry.created_at || Date.now();
            return new Date(ts).toLocaleString('ru-RU');
        },

        getHistoryCompareState(productId) {
            if (!this.isFeatureEnabled('historyCompare')) {
                return { selections: [], diff: null, loading: false };
            }
            if (!productId) {
                return { selections: [], diff: null, loading: false };
            }
            if (!this.historyCompareState[productId]) {
                this.historyCompareState[productId] = {
                    selections: [],
                    diff: null,
                    loading: false
                };
            }
            return this.historyCompareState[productId];
        },

        renderHistoryDiff(diff) {
            if (!diff || typeof diff !== 'object') {
                return '';
            }
            const rows = Object.entries(diff)
                .filter(([key]) => !['snapshot', 'snapshots'].includes(key))
                .map(([key, value]) => {
                    const displayValue =
                        value === null || value === undefined
                            ? '—'
                            : typeof value === 'object'
                            ? JSON.stringify(value)
                            : value;
                    return `<div style="display:flex; justify-content:space-between; gap:8px; font-size:0.85rem; padding:2px 0;">
                        <span style="color: rgba(107,114,128,1);">${this.escapeHtml(key)}</span>
                        <span style="font-weight:600; color: rgba(15,23,42,0.9); text-align:right;">${this.escapeHtml(String(displayValue))}</span>
                    </div>`;
                });
            if (!rows.length) {
                return '';
            }
            return `<div style="margin-top:0.5rem; padding:0.5rem 0.75rem; background: rgba(15,23,42,0.04); border-radius:8px;">${rows.join('')}</div>`;
        },

        renderHistoryComparePanel(productId) {
            if (!this.isFeatureEnabled('historyCompare')) {
                return '';
            }
            const state = this.getHistoryCompareState(productId);
            const history = this.historyCache[productId] || [];
            const selectionBadges =
                state.selections.length > 0
                    ? state.selections
                          .map((entryId) => {
                              const entry = history.find((item) => item.id === entryId);
                              if (!entry) return '';
                              return `<span style="display:inline-flex; align-items:center; gap:4px; padding:0.25rem 0.6rem; border-radius:999px; background:rgba(16,185,129,0.2); color:rgba(6,95,70,1); font-size:0.8rem;">
                                    ${entry.action || 'update'} · ${this.formatHistoryTimestamp(entry)}
                                    <button type="button" data-history-compare data-product-id="${productId}" data-history-id="${entry.id}" style="border:none;background:transparent;color:inherit;cursor:pointer;">×</button>
                                </span>`;
                          })
                          .join('')
                    : '<span style="color:#9ca3af;">Выберите две версии для сравнения</span>';
            let diffBlock = '';
            if (state.loading) {
                diffBlock = '<p style="color:#6b7280; margin-top:0.5rem;">Загружаем сравнение…</p>';
            } else if (state.diff) {
                diffBlock = this.renderHistoryCompareDiff(state.diff);
            } else if (state.selections.length === 2) {
                diffBlock = '<p style="color:#6b7280; margin-top:0.5rem;">Нет различий между выбранными версиями.</p>';
            }
            return `
                <div style="margin-top:1rem; padding:0.75rem 1rem; border:1px solid rgba(15,23,42,0.12); border-radius:12px; background:rgba(255,255,255,0.6);">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:1rem; flex-wrap:wrap;">
                        <div style="font-weight:600; color:rgba(15,23,42,0.8);">Сравнение версий</div>
                        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">${selectionBadges}</div>
                    </div>
                    ${diffBlock}
                </div>
            `;
        },

        renderHistoryCompareDiff(diff) {
            const header = `
                <div style="display:flex; justify-content:space-between; gap:1rem; margin-top:0.75rem; font-size:0.85rem; color:#374151;">
                    <div style="flex:1;">
                        <div style="font-weight:600;">${diff.left.action || 'Версия A'}</div>
                        <div>${this.formatHistoryTimestamp(diff.left)}</div>
                    </div>
                    <div style="flex:1; text-align:right;">
                        <div style="font-weight:600;">${diff.right.action || 'Версия B'}</div>
                        <div>${this.formatHistoryTimestamp(diff.right)}</div>
                    </div>
                </div>`;
            if (!Array.isArray(diff.changes) || diff.changes.length === 0) {
                return `${header}<p style="color:#6b7280; margin-top:0.5rem;">Изменения отсутствуют.</p>`;
            }
            const rows = diff.changes
                .map(
                    (change) => `
                    <div style="margin-top:0.75rem; border:1px solid rgba(15,23,42,0.08); border-radius:8px; padding:0.5rem 0.75rem;">
                        <div style="font-size:0.8rem; color:#6b7280; margin-bottom:0.35rem;">${this.escapeHtml(
                            change.field
                        )}</div>
                        <div style="display:flex; gap:0.5rem; font-size:0.85rem;">
                            <div style="flex:1; color:#b91c1c;">${this.escapeHtml(
                                typeof change.from === 'object' ? JSON.stringify(change.from) : String(change.from ?? '—')
                            )}</div>
                            <div style="flex:1; color:#065f46; text-align:right;">${this.escapeHtml(
                                typeof change.to === 'object' ? JSON.stringify(change.to) : String(change.to ?? '—')
                            )}</div>
                        </div>
                    </div>`
                )
                .join('');
            return `${header}${rows}`;
        },

        async toggleHistoryCompare(productId, entryId) {
            if (!this.isFeatureEnabled('historyCompare')) return;
            if (!productId || !entryId) return;
            const state = this.getHistoryCompareState(productId);
            const idx = state.selections.indexOf(entryId);
            if (idx !== -1) {
                state.selections.splice(idx, 1);
                state.diff = null;
            } else {
                if (state.selections.length >= 2) {
                    state.selections.shift();
                }
                state.selections.push(entryId);
            }
            if (state.selections.length === 2) {
                await this.fetchHistoryCompareDiff(productId);
            } else {
                state.diff = null;
            }
            const container = document.getElementById('historyTimeline');
            if (container) {
                container.innerHTML = this.renderHistoryTimeline(productId);
                this.applyRoleVisibility();
            }
        },

        async fetchHistoryCompareDiff(productId) {
            if (!this.isFeatureEnabled('historyCompare')) return;
            const state = this.getHistoryCompareState(productId);
            if (state.selections.length !== 2) {
                state.diff = null;
                return;
            }
            state.loading = true;
            try {
                const [lhs, rhs] = state.selections;
                const response = await this.fetchWithRole(
                    `/api/catalog/products/${encodeURIComponent(productId)}/history/compare?lhs=${encodeURIComponent(
                        lhs
                    )}&rhs=${encodeURIComponent(rhs)}`
                );
                const result = await response.json().catch(() => ({}));
                if (!response.ok || result.success === false) {
                    throw new Error(result.error || response.statusText || 'Не удалось сравнить версии');
                }
                state.diff = result.data || null;
            } catch (error) {
                console.error('History compare error:', error);
                alert(`❌ Не удалось сравнить версии: ${error.message || 'Ошибка запроса'}`);
                state.diff = null;
            } finally {
                state.loading = false;
                const container = document.getElementById('historyTimeline');
                if (container) {
                    container.innerHTML = this.renderHistoryTimeline(productId);
                    this.applyRoleVisibility();
                }
            }
        },

        renderSyncStatusBadges(productId) {
            const status = this.syncStatusCache[productId] || {};
            const targets = ['pos', 'mobile'];
            if (!targets.some((t) => status[t])) {
                return '<span style="font-size: 0.85rem; color: #9ca3af;">Нет данных</span>';
            }
            return targets
                .map((target) => {
                    const entry = status[target];
                    const state = entry?.state || 'pending';
                    const colors = {
                        synced: '#10b981',
                        pending: '#f97316',
                        error: '#ef4444'
                    };
                    const label = target === 'pos' ? 'POS' : 'Mobile';
                    const stateText =
                        state === 'synced' ? 'готово' : state === 'error' ? 'ошибка' : 'в очереди';
                    const tooltip = entry?.updated_at
                        ? new Date(entry.updated_at).toLocaleString('ru-RU')
                        : 'Нет отметки времени';
                    return `
                        <span title="${tooltip}" style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.8rem; font-weight: 600; color: ${
                            colors[state] || '#9ca3af'
                        }; margin-right: 8px;">
                            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${colors[state] || '#9ca3af'};"></span>
                            ${label}
                            <span style="font-weight: 500; text-transform: lowercase;">${stateText}</span>
                        </span>
                    `;
                })
                .join('');
        },

        async refreshHistoryTimeline(productId) {
            if (!productId) return;
            await this.loadProductHistory(productId);
            const container = document.getElementById('historyTimeline');
            if (container) {
                container.innerHTML = this.renderHistoryTimeline(productId);
                this.applyRoleVisibility();
            }
        },

        async restoreHistoryEntry(productId, entryId) {
            if (!this.ensurePermission('history.restore')) {
                return;
            }
            if (!productId || !entryId) return;
            if (!confirm('Восстановить карточку до выбранной версии?')) {
                return;
            }
            try {
                await this.catalogRequest(`/products/${encodeURIComponent(productId)}/history/${encodeURIComponent(entryId)}/restore`, {
                    method: 'POST'
                });
                alert('✅ Карточка восстановлена');
                await Promise.all([
                    this.refreshHistoryTimeline(productId),
                    this.loadSyncStatus(productId),
                    this.loadProducts()
                ]);
            } catch (error) {
                console.error('Restore history error:', error);
                alert(`❌ Не удалось восстановить карточку: ${error.message || 'Ошибка запроса'}`);
            }
        },

        async triggerSyncTargets(productId, targets = []) {
            if (!this.ensurePermission('sync.trigger')) {
                return;
            }
            if (!productId) {
                alert('Сохраните товар, прежде чем синхронизировать');
                return;
            }
            const payloadTargets = Array.isArray(targets) ? targets : [targets];
            try {
                await this.catalogRequest(`/products/${encodeURIComponent(productId)}/sync`, {
                    method: 'POST',
                    body: { targets: payloadTargets }
                });
                alert('✅ Синхронизация запущена');
                await this.refreshHistoryTimeline(productId);
                await this.loadSyncStatus(productId);
                const widget = document.getElementById('wizardSyncStatus');
                if (widget) {
                    widget.innerHTML = this.renderSyncStatusBadges(productId);
                }
                this.renderProductsTable();
            } catch (error) {
                console.error('Sync error:', error);
                alert(`❌ Ошибка синхронизации: ${error.message || 'Не удалось отправить'}`);
            }
        },
        isLoading: false,
        searchDebounce: null,
        
        // Инициализация модуля
        init() {
            console.log('🛍️ Product Cards Manager: Initializing...');
            this.activeRole = this.loadActiveRole();
            this.loadCategories();
            this.loadModifiers();
            this.loadParameterPresets();
            this.loadProducts();
            this.setupEventListeners();
        },

        // Загрузка категорий
        async loadCategories() {
            try {
                const response = await this.fetchWithRole('/api/catalog/categories');
                if (response.ok) {
                    const result = await response.json();
                    const categories = Array.isArray(result?.data) ? result.data : [];
                    this.categories = categories
                        .map(cat => ({
                            id: cat.id,
                            name: cat.name,
                            parent_id: cat.parent_id || null,
                            position: cat.position || 0
                        }))
                        .sort((a, b) => (a.position || 0) - (b.position || 0));
                    console.log('✅ Загружено категорий:', this.categories.length);
                    return;
                }
            } catch (error) {
                console.error('Ошибка загрузки категорий:', error);
            }

            // Фоллбэк
                this.categories = [
                { id: 'pizza', name: 'Пицца' },
                { id: 'rolls', name: 'Роллы' },
                { id: 'snacks', name: 'Закуски' },
                { id: 'drinks', name: 'Напитки' }
            ];
            console.warn('⚠️ Используются тестовые категории');
        },

        normalizeProduct(record) {
            if (!record) return null;
            const images = Array.isArray(record.images) ? record.images : [];
            const primaryImage = images.find(img => img?.role === 'primary') || images[0] || {};
            const quantity = Number(record.quantity ?? record.stock_quantity ?? 0);
            const customAttributes = Array.isArray(record.custom_attributes) ? record.custom_attributes : [];
            const photoModeAttr = customAttributes.find(attr => attr.name === 'photo_mode');
            const pageTypeAttr = customAttributes.find(attr => attr.name === 'product_page_type');
            const pageUrlAttr = customAttributes.find(attr => attr.name === 'product_page_url');
            const simplifiedVariants = Array.isArray(record.variations)
                ? record.variations.map(variation => {
                    const displayName = Array.isArray(variation.parameters)
                        ? variation.parameters.map(param => param.value).filter(Boolean).join(' / ')
                        : variation.name || '';
                    return {
                        variant_id: variation.variant_id || variation.id || `var-${Date.now()}`,
                        name: displayName,
                        price: variation.price || 0,
                        stock: variation.quantity || 0,
                        sku: variation.sku || ''
                    };
                })
                : [];
            const recommended = Array.isArray(record.related_products)
                ? record.related_products
                    .map((item) => item?.product_id || item?.id || item)
                    .filter(Boolean)
                : [];

            return {
                id: record.internal_id || record.id || record.sku || `prd_${Date.now()}`,
                name: record.name || 'Без названия',
                description: record.description || record.short_description || '',
                full_description: record.description || '',
                short_description: record.short_description || '',
                price: Number(record.price) || 0,
                cost: record.cost !== undefined && record.cost !== null && record.cost !== '' ? Number(record.cost) : (record.purchase_price !== undefined && record.purchase_price !== null && record.purchase_price !== '' ? Number(record.purchase_price) : null),
                image_url: record.image_url || primaryImage.url || '',
                categories: Array.isArray(record.categories) ? record.categories : [],
                weight: record.weight !== undefined && record.weight !== null && record.weight !== '' ? String(record.weight) : null,
                calories: record.calories !== undefined && record.calories !== null && record.calories !== '' ? (typeof record.calories === 'number' ? record.calories : parseInt(record.calories) || null) : null,
                sku: record.sku !== undefined && record.sku !== null && record.sku !== '' ? String(record.sku) : null,
                quantity,
                stock_quantity: quantity,
                visible_on_site: record.is_visible !== false && record.visible_on_site !== false,
                hidden_for_promo: record.forbid_discounts || record.forbid_loyalty || false,
                barcode: record.barcode || '',
                type: record.type || 'product',
                tax_system: record.tax_system || 'osn',
                vat_rate: record.vat_rate || '20%',
                updated_at: record.updated_at,
                variations: simplifiedVariants,
                has_variations: simplifiedVariants.length > 0,
                forbid_discounts: !!record.forbid_discounts,
                forbid_loyalty: !!record.forbid_loyalty,
                recommended_products: recommended,
                photo_mode: photoModeAttr?.value || record.photo_mode || 'with_background',
                product_page_type: pageTypeAttr?.value || record.product_page_type || 'default',
                product_page_url: pageUrlAttr?.value || record.product_page_url || '',
                custom_attributes: customAttributes,
                modifiers: Array.isArray(record.modifiers) ? record.modifiers : []
            };
        },

        getSelectedProductIds() {
            return Array.from(this.selectedProducts);
        },

        async catalogRequest(path, { method = 'GET', body } = {}) {
            const options = { method, headers: {} };
            if (body !== undefined) {
                options.headers['Content-Type'] = 'application/json';
                options.body = JSON.stringify(body);
            }
            
            const host =
                typeof window !== 'undefined' && window.location && window.location.hostname
                    ? window.location.hostname
                    : '';
            const localHost = host === 'localhost' || host === '127.0.0.1';
            const forcedCatalog =
                (typeof window !== 'undefined' && window.USE_CATALOG_API === true) ||
                localStorage.getItem('USE_CATALOG_API') === '1';

            // Эти ручки, как правило, есть только в Node catalog backend.
            const catalogOnly =
                path.includes('/history') ||
                path.includes('/draft') ||
                path.includes('/import') ||
                path.includes('/export') ||
                path.startsWith('/sync');

            const catalogApiPath = `/api/catalog${path}`;
            const legacyApiPath = `/api${path}`;

            // По умолчанию:
            // - локально/forced → сначала /api/catalog
            // - на проде → сначала /api (PHP)
            let primaryPath = localHost || forcedCatalog || catalogOnly ? catalogApiPath : legacyApiPath;
            let fallbackPath = primaryPath === catalogApiPath ? legacyApiPath : catalogApiPath;
            if (catalogOnly) {
                fallbackPath = null;
            }
            
            let response = null;
            let result = null;
            try {
                response = await this.fetchWithRole(primaryPath, options);
                // если попали на PHP без /api/catalog/* — 404, пробуем fallback
                if (response.status === 404 && fallbackPath) {
                    response = await this.fetchWithRole(fallbackPath, options);
                }
                result = await response.json().catch(() => ({}));
            } catch (e) {
                // сеть/сервер: пробуем fallback один раз
                if (fallbackPath) {
                    response = await this.fetchWithRole(fallbackPath, options);
                    result = await response.json().catch(() => ({}));
                } else {
                    throw e;
                }
            }

            if (!response || !response.ok || result?.success === false) {
                const message = result?.error || result?.message || response?.statusText || 'Ошибка запроса каталога';
                throw new Error(message);
            }
            return result;
        },

        async patchProduct(productId, changes) {
            if (!productId) throw new Error('Не указан товар');
            return this.catalogRequest(`/products/${encodeURIComponent(productId)}`, {
                method: 'PATCH',
                body: changes
            });
        },

        async bulkPatchProducts(ids, changes) {
            if (!Array.isArray(ids) || !ids.length) {
                throw new Error('Нет выбранных товаров');
            }
            return this.catalogRequest('/products/bulk', {
                method: 'PATCH',
                body: { ids, changes }
            });
        },

        async patchProductsSequential(updates, successLabel = 'Изменения применены') {
            if (!Array.isArray(updates) || !updates.length) {
                throw new Error('Нет данных для обновления');
            }
            let success = 0;
            let failed = 0;
            for (const update of updates) {
                try {
                    await this.patchProduct(update.id, update.changes);
                    success++;
                } catch (error) {
                    console.warn('Patch failed for', update.id, error);
                    failed++;
                }
            }
            alert(`✅ ${successLabel}\nУспешно: ${success}\nОшибок: ${failed}`);
            return { success, failed };
        },

        async deleteProducts(ids) {
            if (!Array.isArray(ids) || !ids.length) {
                throw new Error('Нет товаров для удаления');
            }
            let success = 0;
            let failed = 0;
            for (const id of ids) {
                try {
                    await this.catalogRequest(`/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
                    success++;
                } catch (error) {
                    console.warn('Delete failed for', id, error);
                    failed++;
                }
            }
            alert(`✅ Удаление завершено\nУспешно: ${success}\nОшибок: ${failed}`);
            return { success, failed };
        },

        transformLegacyPayload(data = {}) {
            const payload = { ...data };
            if ('visible_on_site' in payload) {
                payload.is_visible = payload.visible_on_site;
                delete payload.visible_on_site;
            }
            if ('hidden_for_promo' in payload) {
                payload.forbid_discounts = payload.hidden_for_promo;
                delete payload.hidden_for_promo;
            }
            if ('stock_quantity' in payload && payload.quantity === undefined) {
                payload.quantity = payload.stock_quantity;
                delete payload.stock_quantity;
            }
            if ('full_description' in payload) {
                payload.description = payload.full_description;
                delete payload.full_description;
            }
            if ('cost' in payload && payload.purchase_price === undefined) {
                payload.purchase_price = payload.cost;
                delete payload.cost;
            }
            if (typeof payload.categories === 'string') {
                try {
                    payload.categories = JSON.parse(payload.categories);
                } catch (_) {
                    payload.categories = [payload.categories];
                }
            }
            if (!Array.isArray(payload.categories)) {
                payload.categories = payload.categories ? [payload.categories] : [];
            }
            if (payload.variants && !payload.variations) {
                try {
                    const parsed = typeof payload.variants === 'string' ? JSON.parse(payload.variants) : payload.variants;
                    if (Array.isArray(parsed)) {
                        payload.variations = parsed.map((variant, idx) => ({
                            variant_id: variant.variant_id || `var-${Date.now()}-${idx}`,
                            sku: variant.sku || `${payload.sku || 'SKU'}-var-${idx + 1}`,
                            price: variant.price || 0,
                            quantity: variant.stock || 0,
                            parameters: [{ name: 'Вариант', value: variant.name || `Вариант ${idx + 1}`, display: 'list' }]
                        }));
                    }
                } catch (_) {
                    // ignore
                }
                delete payload.variants;
            }
            if (payload.recommended_products && !payload.related_products) {
                try {
                    const parsed = typeof payload.recommended_products === 'string'
                        ? JSON.parse(payload.recommended_products)
                        : payload.recommended_products;
                    if (Array.isArray(parsed)) {
                        payload.related_products = parsed.map((id, idx) => ({ product_id: id, position: idx }));
                    }
                } catch (_) {
                    // ignore
                }
                delete payload.recommended_products;
            }
            if (payload.image_url && !payload.images) {
                payload.images = [{ url: payload.image_url, role: 'primary', alt_text: payload.name || '' }];
            }
            return payload;
        },

        // Загрузка товаров
        async loadProducts({ silent = false } = {}) {
            if (this.isLoading) return;
            this.isLoading = true;
            try {
                let loaded = [];
                let meta = null;

                try {
                    const params = new URLSearchParams();
                    params.append('page', this.currentPage);
                    params.append('limit', this.rowsPerPage);
                    if (this.currentFilters.search?.trim()) params.append('search', this.currentFilters.search.trim());
                    if (this.currentFilters.category) params.append('category', this.currentFilters.category);
                    if (this.currentFilters.type && this.currentFilters.type !== 'all') params.append('type', this.currentFilters.type);
                    if (this.currentFilters.visible && this.currentFilters.visible !== 'all') params.append('visible', this.currentFilters.visible === 'visible');
                    if (this.currentFilters.stock && this.currentFilters.stock !== 'all') params.append('stock', this.currentFilters.stock);
                    if (this.currentFilters.promo && this.currentFilters.promo !== 'all') params.append('promo_restriction', this.currentFilters.promo);
                    if (this.currentFilters.hasBarcode && this.currentFilters.hasBarcode !== 'all') params.append('has_barcode', this.currentFilters.hasBarcode === 'yes');

                    console.log('📡 Запрос к API:', `/api/products?${params.toString()}`);
                    const result = await this.catalogRequest(`/products?${params.toString()}`);
                    loaded = Array.isArray(result?.data) ? result.data : [];
                    meta = result?.meta || null;
                    
                    console.log(`📦 API вернул ${loaded.length} товаров`);
                    
                    // Отладка: проверяем, что данные приходят из API
                    if (loaded.length > 0) {
                        const sample = loaded[0];
                        console.log('🔍 Пример данных из API (ПЕРВЫЙ ТОВАР):', {
                            id: sample.id,
                            name: sample.name,
                            sku: sample.sku,
                            cost: sample.cost,
                            purchase_price: sample.purchase_price,
                            weight: sample.weight,
                            calories: sample.calories,
                            categories: sample.categories,
                            category_ids: sample.category_ids,
                            allKeys: Object.keys(sample)
                        });
                        
                        // Проверяем еще несколько товаров
                        if (loaded.length > 1) {
                            const sample2 = loaded[1];
                            console.log('🔍 Пример данных из API (ВТОРОЙ ТОВАР):', {
                                id: sample2.id,
                                name: sample2.name,
                                sku: sample2.sku,
                                cost: sample2.cost,
                                weight: sample2.weight,
                                calories: sample2.calories
                            });
                        }
                    } else {
                        console.warn('⚠️ API вернул пустой массив товаров!');
                    }
                } catch (apiError) {
                    console.warn('⚠️ Catalog API недоступен, пробую локальные данные', apiError);
                }

                if (!loaded.length) {
                    loaded = await this.loadLocalProductsFallback();
                    meta = {
                        total: loaded.length,
                        limit: this.rowsPerPage,
                        page: 1,
                        pages: Math.max(1, Math.ceil(loaded.length / this.rowsPerPage))
                    };
                }

                if (meta?.pages && this.currentPage > meta.pages && meta.pages > 0) {
                    this.currentPage = meta.pages;
                    this.isLoading = false;
                    return this.loadProducts({ silent });
                }

                this.meta = {
                    total: meta?.total ?? loaded.length,
                    pages: meta?.pages ?? Math.max(1, Math.ceil((meta?.total ?? loaded.length) / (meta?.limit ?? this.rowsPerPage))),
                    limit: meta?.limit ?? this.rowsPerPage
                };

                console.log(`🔄 Нормализуем ${loaded.length} товаров...`);
                this.products = (loaded || []).map(item => {
                    const normalized = this.normalizeProduct(item);
                    if (!normalized) {
                        console.warn('⚠️ Товар не прошел нормализацию:', item);
                    }
                    return normalized;
                }).filter(Boolean);
                
                console.log(`✅ После нормализации: ${this.products.length} товаров`);
                
                // Отладка: проверяем, что данные нормализованы правильно
                if (this.products.length > 0) {
                    const sample = this.products[0];
                    console.log('🔍 Пример нормализованного товара (ПЕРВЫЙ):', {
                        id: sample.id,
                        name: sample.name,
                        sku: sample.sku,
                        cost: sample.cost,
                        weight: sample.weight,
                        calories: sample.calories,
                        categories: sample.categories,
                        categoriesLength: Array.isArray(sample.categories) ? sample.categories.length : 'не массив'
                    });
                    
                    // Проверяем еще несколько товаров
                    if (this.products.length > 1) {
                        const sample2 = this.products[1];
                        console.log('🔍 Пример нормализованного товара (ВТОРОЙ):', {
                            id: sample2.id,
                            name: sample2.name,
                            sku: sample2.sku,
                            cost: sample2.cost,
                            weight: sample2.weight,
                            calories: sample2.calories
                        });
                    }
                } else {
                    console.warn('⚠️ После нормализации нет товаров!');
                }
                
                await this.loadSyncStatuses(this.products.map((product) => product.id));
                this.lastSyncPollAt = Date.now();

                console.log('✅ Загружено товаров:', this.products.length);

                await this.syncToWebsite();
                if (this.products.length) {
                    this.startSyncPolling();
                } else {
                    this.stopSyncPolling();
                }
                this.renderSyncSummaryWidget();

                if (!silent) {
                    this.renderProductsTable();
                }
            } catch (error) {
                console.error('Ошибка загрузки товаров:', error);
            } finally {
                this.isLoading = false;
            }
        },

        async loadLocalProductsFallback() {
            let loaded = [];
                    try {
                        let respJson = await fetch('/products-data.json');
                        if (!respJson.ok) respJson = await fetch('products-data.json');
                        if (respJson.ok) {
                            const data = await respJson.json();
                            if (Array.isArray(data)) loaded = data;
                        }
            } catch (_) {}

                if (!loaded.length) {
                    try {
                        let respMenu = await fetch('/menu_data.json');
                        if (!respMenu.ok) respMenu = await fetch('menu_data.json');
                        if (respMenu.ok) {
                            const data = await respMenu.json();
                            if (data.offers && Array.isArray(data.offers)) {
                                loaded = data.offers;
                            } else if (Array.isArray(data)) {
                                loaded = data;
                            }
                        }
                } catch (_) {}
                }

                if (loaded.length < 20) {
                    try {
                        let respJson = await fetch('/products-data.json');
                        if (!respJson.ok) respJson = await fetch('products-data.json');
                        if (respJson.ok) {
                            const arr = await respJson.json();
                            if (Array.isArray(arr)) loaded = loaded.concat(arr);
                        }
                } catch (_) {}
                    try {
                        let respMenu = await fetch('/menu_data.json');
                        if (!respMenu.ok) respMenu = await fetch('menu_data.json');
                        if (respMenu.ok) {
                            const data = await respMenu.json();
                            if (data.offers && Array.isArray(data.offers)) {
                                loaded = loaded.concat(data.offers);
                            } else if (Array.isArray(data)) {
                                loaded = loaded.concat(data);
                            }
                        }
                } catch (_) {}
                    const seen = new Set();
                    loaded = loaded.filter(p => {
                        const key = String(p.id || p.sku || p.name);
                        if (seen.has(key)) return false;
                        seen.add(key);
                        return true;
                    });
                }

            return loaded;
        },

        // Синхронизация товаров с сайтом через localStorage и API
        async syncToWebsite(showNotification = false, productsOverride = null) {
            try {
                // Источник: явная передача или локальное состояние (приоритет ВЫШЕ любого API)
                let sourceProducts = Array.isArray(productsOverride)
                    ? productsOverride.slice()
                    : (Array.isArray(this.products) ? this.products.slice() : []);

                // Доп. фоллбэк: пробуем локальные JSON файлы витрины (если есть)
                if (!sourceProducts.length) {
                    try {
                        let respJson = await fetch('/products-data.json');
                        if (!respJson.ok) respJson = await fetch('products-data.json');
                        if (respJson.ok) {
                            const data = await respJson.json();
                            if (Array.isArray(data)) sourceProducts = data;
                        }
                    } catch(_) {}
                }
                if (!sourceProducts.length) {
                    try {
                        let respMenu = await fetch('/menu_data.json');
                        if (!respMenu.ok) respMenu = await fetch('menu_data.json');
                        if (respMenu.ok) {
                            const data = await respMenu.json();
                            // menu_data.json имеет структуру {categories: {...}, offers: [...]}
                            if (data.offers && Array.isArray(data.offers)) {
                                sourceProducts = data.offers;
                            } else if (Array.isArray(data)) {
                                sourceProducts = data;
                            }
                        }
                    } catch(_) {}
                }
                if (!sourceProducts.length && Array.isArray(this.products)) {
                    sourceProducts = this.products.slice();
                }

                if (sourceProducts.length) {
                    // Преобразуем в формат сайта
                    const websiteProducts = sourceProducts.map(product => ({
                        id: product.id,
                        name: product.name,
                        description: product.description || product.desc || '',
                        price: parseFloat(product.price) || 0,
                        picture: product.image_url || product.picture || product.photo || product.image || '',
                        category: product.category || product.category_name || (Array.isArray(product.categories) ? product.categories[0] : ''),
                        weight: product.weight || null,
                        calories: product.calories || null,
                        available: product.available !== false && product.visible_on_site !== false,
                        sku: product.sku || null,
                        // ✅ КРИТИЧНО: Добавлены поля модификаторов, аллергенов и питательности
                        mods: product.mods || product.modifiers || [],         // Модификаторы/допы
                        alrg: product.alrg || product.allergens || '',         // Аллергены
                        nutrition: product.nutrition || product.nutritional_info || ''  // Пищевая ценность
                    }));
                    
                    // Сохраняем в localStorage для сайта
                    localStorage.setItem('menu_items', JSON.stringify(websiteProducts));
                    localStorage.setItem('menu_items_synced_at', new Date().toISOString());
                    console.log('✅ Синхронизировано товаров с сайтом:', websiteProducts.length);
                    
                    // Показываем уведомление если нужно
                    if (showNotification) {
                    const notification = document.createElement('div');
                    notification.style.cssText = `
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        background: linear-gradient(135deg, #10b981, #059669);
                        color: white;
                            padding: 16px 24px;
                            border-radius: 12px;
                            box-shadow: 0 6px 20px rgba(0,0,0,0.3);
                        z-index: 10000;
                            font-weight: 700;
                            font-size: 15px;
                            animation: slideInRight 0.4s ease-out;
                        `;
                        notification.innerHTML = `
                            <div>✅ Синхронизация завершена!</div>
                            <div style="font-size: 13px; margin-top: 4px; opacity: 0.9;">
                                ${websiteProducts.length} товаров обновлено на витрине
                            </div>
                        `;
                    document.body.appendChild(notification);
                    
                    setTimeout(() => {
                            notification.style.animation = 'slideOutRight 0.3s ease-in';
                        setTimeout(() => notification.remove(), 300);
                        }, 4000);
                        
                        // Добавляем стили анимации если их ещё нет
                        if (!document.getElementById('syncNotificationStyles')) {
                            const style = document.createElement('style');
                            style.id = 'syncNotificationStyles';
                            style.textContent = `
                                @keyframes slideInRight {
                                    from { transform: translateX(100%); opacity: 0; }
                                    to { transform: translateX(0); opacity: 1; }
                                }
                                @keyframes slideOutRight {
                                    from { transform: translateX(0); opacity: 1; }
                                    to { transform: translateX(100%); opacity: 0; }
                                }
                            `;
                            document.head.appendChild(style);
                        }
                    }
                    
                    return true;
                } else {
                    console.warn('⚠️ API недоступен для синхронизации');
                    return false;
                }
            } catch (error) {
                console.error('Ошибка синхронизации с сайтом:', error);
                return false;
            }
        },

        // Отрисовка таблицы товаров
        renderProductsTable() {
            const container = document.getElementById('productCardsTable');
            if (!container) return;

            const hasSelected = this.selectedProducts.size > 0;
            const rolePanel = this.renderRoleBanner();
            const filtersPanel = this.renderFiltersPanel();
            const syncSummaryRaw = this.renderSyncSummary();
            const syncSummary = syncSummaryRaw
                ? `<div id="syncSummaryContainer">${syncSummaryRaw}</div>`
                : '';
            const canBulkVisibility = this.can('product.visibility');
            const canBulkCategory = this.can('product.bulk');
            const canBulkDelete = this.can('product.delete');
            const bulkControls = [];
            if (canBulkCategory) {
                bulkControls.push(`
                    <select id="bulkCategorySelect" style="padding: 6px 12px; border: 1px solid rgba(94, 82, 64, 0.2); border-radius: 8px; background: rgba(252, 252, 249, 1); color: rgba(19, 52, 59, 1); font-size: 12px;">
                        <option value="">Изменить категорию...</option>
                        ${this.categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('')}
                    </select>
                    <button class="btn btn--secondary btn--sm" onclick="ProductCardsManager.bulkChangeCategory()" style="display: inline-flex; align-items: center; justify-content: center; padding: 4px 12px; border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid rgba(94, 82, 64, 0.2); background: rgba(94, 82, 64, 0.12); color: rgba(19, 52, 59, 1);">
                        🏷️ Изменить категорию
                    </button>
                `);
            }
            if (canBulkVisibility) {
                bulkControls.push(`
                    <button class="btn btn--secondary btn--sm" onclick="ProductCardsManager.bulkToggleVisibility()" style="display: inline-flex; align-items: center; justify-content: center; padding: 4px 12px; border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid rgba(94, 82, 64, 0.2); background: rgba(94, 82, 64, 0.12); color: rgba(19, 52, 59, 1);">
                        👁️ Переключить видимость
                    </button>
                `);
            }
            if (canBulkDelete) {
                bulkControls.push(`
                    <button class="btn btn--danger btn--sm" onclick="ProductCardsManager.bulkDelete()" style="display: inline-flex; align-items: center; justify-content: center; padding: 4px 12px; border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1); border: none; background: rgba(192, 21, 47, 1); color: rgba(255, 255, 255, 1);">
                        🗑️ Удалить выбранные
                    </button>
                `);
            }
            const bulkPanel = hasSelected && bulkControls.length
                ? `
                <div class="bulk-actions" style="margin-bottom: 16px; padding: 16px; background: rgba(252, 252, 249, 1); border: 1px solid rgba(94, 82, 64, 0.12); border-radius: 12px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);">
                    <span style="font-weight: 600; color: rgba(19, 52, 59, 1);">Выбрано товаров: <strong id="selectedCount" style="color: rgba(33, 128, 141, 1);">${this.selectedProducts.size}</strong></span>
                    ${bulkControls.join('')}
                </div>
                `
                : '';

            const columnStyles = {
                image: this.getColumnStyle('image'),
                sku: this.getColumnStyle('sku'),
                barcode: this.getColumnStyle('barcode'),
                price: this.getColumnStyle('price'),
                cost: this.getColumnStyle('cost'),
                quantity: this.getColumnStyle('quantity'),
                weight: this.getColumnStyle('weight'),
                calories: this.getColumnStyle('calories'),
                categories: this.getColumnStyle('categories'),
                status: this.getColumnStyle('status'),
                sync: this.getColumnStyle('sync')
            };

            let html = `
                    ${rolePanel}
                    ${filtersPanel}
                    ${syncSummary}
                    ${bulkPanel}

                <div style="overflow-x: auto; background: rgba(252, 252, 249, 1); border: 1px solid rgba(94, 82, 64, 0.12); border-radius: 12px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02); margin-top: 12px;">
                    <table style="width: 100%; border-collapse: collapse; margin: 0;">
                        <thead>
                            <tr>
                                <th style="width: 40px; padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); background: rgba(94, 82, 64, 0.12); font-weight: 550; font-size: 12px; color: rgba(19, 52, 59, 1);">
                                    <input type="checkbox" 
                                           id="selectAllProducts" 
                                           ${this.selectedProducts.size === this.products.length && this.products.length > 0 ? 'checked' : ''}
                                           onchange="ProductCardsManager.toggleSelectAll(this.checked)"
                                           style="cursor: pointer; width: 16px; height: 16px;">
                                </th>
                                <th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); background: rgba(94, 82, 64, 0.12); font-weight: 550; font-size: 12px; color: rgba(19, 52, 59, 1); ${columnStyles.image}">Изображение</th>
                                <th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); background: rgba(94, 82, 64, 0.12); font-weight: 550; font-size: 12px; color: rgba(19, 52, 59, 1);">Название</th>
                                <th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); background: rgba(94, 82, 64, 0.12); font-weight: 550; font-size: 12px; color: rgba(19, 52, 59, 1); ${columnStyles.sku}">Артикул</th>
                                <th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); background: rgba(94, 82, 64, 0.12); font-weight: 550; font-size: 12px; color: rgba(19, 52, 59, 1); ${columnStyles.barcode}">Штрих-код</th>
                                <th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); background: rgba(94, 82, 64, 0.12); font-weight: 550; font-size: 12px; color: rgba(19, 52, 59, 1); ${columnStyles.price}">Цена</th>
                                <th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); background: rgba(94, 82, 64, 0.12); font-weight: 550; font-size: 12px; color: rgba(19, 52, 59, 1); ${columnStyles.cost}">Себест.</th>
                                <th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); background: rgba(94, 82, 64, 0.12); font-weight: 550; font-size: 12px; color: rgba(19, 52, 59, 1); ${columnStyles.quantity}">Остаток</th>
                                <th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); background: rgba(94, 82, 64, 0.12); font-weight: 550; font-size: 12px; color: rgba(19, 52, 59, 1); ${columnStyles.weight}">Вес</th>
                                <th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); background: rgba(94, 82, 64, 0.12); font-weight: 550; font-size: 12px; color: rgba(19, 52, 59, 1); ${columnStyles.calories}">Ккал</th>
                                <th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); background: rgba(94, 82, 64, 0.12); font-weight: 550; font-size: 12px; color: rgba(19, 52, 59, 1); ${columnStyles.categories}">Категория</th>
                                <th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); background: rgba(94, 82, 64, 0.12); font-weight: 550; font-size: 12px; color: rgba(19, 52, 59, 1);">Вид</th>
                                    <th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); background: rgba(94, 82, 64, 0.12); font-weight: 550; font-size: 12px; color: rgba(19, 52, 59, 1); ${columnStyles.status}">Статус</th>
                                    <th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); background: rgba(94, 82, 64, 0.12); font-weight: 550; font-size: 12px; color: rgba(19, 52, 59, 1); ${columnStyles.sync}">Синхронизация</th>
                                <th style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); background: rgba(94, 82, 64, 0.12); font-weight: 550; font-size: 12px; color: rgba(19, 52, 59, 1);">Действия</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            const visibleProducts = Array.isArray(this.products) ? this.products : [];

            if (visibleProducts.length === 0) {
                html += `
                    <tr>
                        <td colspan="13" style="text-align: center; padding: 3rem; color: rgba(119, 124, 124, 1); border-bottom: 1px solid rgba(94, 82, 64, 0.12);">
                            <div style="font-size: 3rem; margin-bottom: 1rem;">📦</div>
                            <div style="font-size: 1.2rem; font-weight: 600; margin-bottom: 0.5rem;">Товары не найдены</div>
                            <div>Измените фильтры или добавьте новый товар</div>
                        </td>
                    </tr>
                `;
            } else {
                visibleProducts.forEach(product => {
                    const isSelected = this.selectedProducts.has(product.id);
                    const categories = this.getProductCategories(product);
                    const visibleIcon = product.visible_on_site ? '✅' : '❌';
                    const visibleText = product.visible_on_site ? 'Виден' : 'Скрыт';
                    const hiddenForPromo = product.hidden_for_promo ? '🎁 Только для акций' : '';

                    html += `
                        <tr style="padding: 12px 16px; ${isSelected ? 'background: rgba(94, 82, 64, 0.08);' : ''}" class="product-row" data-product-id="${product.id}" ${isSelected ? 'data-selected="true"' : ''}>
                            <td style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); ${columnStyles.image}">
                                <input type="checkbox" 
                                       class="product-checkbox"
                                       data-product-id="${product.id}"
                                       ${isSelected ? 'checked' : ''}
                                       onchange="ProductCardsManager.toggleProduct('${product.id}', this.checked)"
                                       style="cursor: pointer; width: 18px; height: 18px;">
                            </td>
                            <td style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12);">
                                ${product.image_url ? 
                                    `<div style="width: 60px; height: 60px; border-radius: 6px; overflow: hidden; border: 1px solid rgba(94, 82, 64, 0.12); background: #f5f5f5; display: flex; align-items: center; justify-content: center;">
                                        <img src="${product.image_url}" 
                                          alt="${product.name}" 
                                             style="max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; display: block;"
                                             onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\'width: 60px; height: 60px; background: rgba(245, 245, 245, 1); border-radius: 6px; display: flex; align-items: center; justify-content: center; color: rgba(119, 124, 124, 1); font-size: 11px; border: 1px solid rgba(94, 82, 64, 0.12);\\'>Нет фото</div>'">
                                    </div>` 
                                    : '<div style="width: 60px; height: 60px; background: rgba(245, 245, 245, 1); border-radius: 6px; display: flex; align-items: center; justify-content: center; color: rgba(119, 124, 124, 1); font-size: 11px; border: 1px solid rgba(94, 82, 64, 0.12);">Нет фото</div>'
                                }
                            </td>
                            <td style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12);">${product.name || '—'}</td>
                            <td style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); ${columnStyles.sku}">${product.sku || '—'}</td>
                            <td style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); ${columnStyles.barcode}">${product.barcode || '—'}</td>
                            <td style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); ${columnStyles.price}">
                                ${
                                    this.can('product.price')
                                        ? `<button type="button" data-inline-edit="price" data-product-id="${product.id}"
                                            style="background: none; border: none; padding: 0; cursor: pointer; color: inherit; font: inherit;">
                                            ${product.price ? product.price.toLocaleString('ru-RU') + ' ₽' : '—'}
                                        </button>`
                                        : `<span>${product.price ? product.price.toLocaleString('ru-RU') + ' ₽' : '—'}</span>`
                                }
                            </td>
                            <td style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); ${columnStyles.cost}">
                                ${product.cost !== null && product.cost !== undefined ? product.cost.toLocaleString('ru-RU') + ' ₽' : '—'}
                            </td>
                            <td style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); ${columnStyles.quantity}">
                                ${
                                    this.can('product.stock')
                                        ? `<button type="button" data-inline-edit="quantity" data-product-id="${product.id}"
                                            style="background: none; border: none; padding: 0; cursor: pointer; color: inherit; font: inherit;">
                                            ${typeof product.quantity === 'number' ? product.quantity : '—'}
                                        </button>`
                                        : `<span>${typeof product.quantity === 'number' ? product.quantity : '—'}</span>`
                                }
                            </td>
                            <td style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); ${columnStyles.weight}">${product.weight !== null && product.weight !== undefined && product.weight !== '' ? product.weight : '—'}</td>
                            <td style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); ${columnStyles.calories}">${product.calories !== null && product.calories !== undefined ? product.calories : '—'}</td>
                            <td style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); ${columnStyles.categories}">${categories.length > 0 ? categories.join(', ') : '—'}</td>
                            <td style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12);">
                                ${
                                    (() => {
                                        if (product.display_only === true || product.display_only === 1) {
                                            return '<span style="display: inline-flex; align-items: center; padding: 4px 8px; border-radius: 9999px; font-weight: 500; font-size: 11px; background-color: rgba(59, 130, 246, 0.15); color: rgba(59, 130, 246, 1); border: 1px solid rgba(59, 130, 246, 0.25);">🏪 Витрина</span>';
                                        } else if (product.parent_id) {
                                            return '<span style="display: inline-flex; align-items: center; padding: 4px 8px; border-radius: 9999px; font-weight: 500; font-size: 11px; background-color: rgba(139, 92, 246, 0.15); color: rgba(139, 92, 246, 1); border: 1px solid rgba(139, 92, 246, 0.25);">📐 Вариант</span>';
                                        }
                                        return '<span style="color: rgba(119, 124, 124, 1);">—</span>';
                                    })()
                                }
                            </td>
                            <td style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); ${columnStyles.status}">
                                <span class="status ${product.visible_on_site ? 'status--active' : 'status--inactive'}" style="display: inline-flex; align-items: center; padding: 4px 8px; border-radius: 9999px; font-weight: 500; font-size: 11px; ${product.visible_on_site ? 'background-color: rgba(33, 128, 141, 0.15); color: rgba(33, 128, 141, 1); border: 1px solid rgba(33, 128, 141, 0.25);' : 'background-color: rgba(192, 21, 47, 0.15); color: rgba(192, 21, 47, 1); border: 1px solid rgba(192, 21, 47, 0.25);'}">
                                    ${product.visible_on_site ? '✅ Активен' : '❌ Скрыт'}
                                    </span>
                            </td>
                            <td style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12); ${columnStyles.sync}">
                                ${this.renderSyncStatusBadges(product.id)}
                            </td>
                            <td style="padding: 12px 16px; text-align: left; border-bottom: 1px solid rgba(94, 82, 64, 0.12);">
                                ${
                                    (() => {
                                        const actions = [];
                                        if (this.can('product.update')) {
                                            actions.push(`
                                                <button class="btn btn--secondary btn--sm" 
                                                    onclick="ProductCardsManager.editProduct('${product.id}')"
                                                    style="display: inline-flex; align-items: center; justify-content: center; padding: 4px 12px; border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid rgba(94, 82, 64, 0.2); background: rgba(94, 82, 64, 0.12); color: rgba(19, 52, 59, 1);">
                                                    ✏️ Изменить
                                                </button>
                                            `);
                                        }
                                        if (this.can('product.delete')) {
                                            actions.push(`
                                                <button class="btn btn--danger btn--sm" 
                                                    onclick="ProductCardsManager.deleteProduct('${product.id}')"
                                                    style="display: inline-flex; align-items: center; justify-content: center; padding: 4px 8px; border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1); border: none; background: rgba(192, 21, 47, 1); color: rgba(255, 255, 255, 1);">
                                                    🗑️
                                                </button>
                                            `);
                                        }
                                        if (!actions.length) {
                                            return '<span style="font-size: 12px; color: rgba(119, 124, 124, 1);">Недоступно</span>';
                                        }
                                        return `<div style="display: flex; gap: 0.5rem; justify-content: flex-start; flex-wrap: wrap;">${actions.join('')}</div>`;
                                    })()
                                }
                            </td>
                        </tr>
                    `;
                });
            }

            html += `
                        </tbody>
                    </table>
                </div>

                <!-- Pagination Controls -->
                <div class="pagination-controls" style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px; padding: 12px; border-top: 1px solid rgba(94, 82, 64, 0.12); background: rgba(252, 252, 249, 1); border-radius: 0 0 12px 12px;">
                    <!-- Left side: Items per page and range info -->
                    <div style="display: flex; align-items: center; gap: 12px; font-size: 12px; color: rgba(119, 124, 124, 1);">
                        <span>Строк на странице:</span>
                        <select class="pagination-select" id="rowsPerPageSelect" onchange="ProductCardsManager.changeRowsPerPage(this.value)" style="padding: 4px 12px; border: 1px solid rgba(94, 82, 64, 0.2); border-radius: 8px; background: rgba(252, 252, 249, 1); color: rgba(19, 52, 59, 1); font-size: 12px;">
                            <option value="10" ${this.rowsPerPage === 10 ? 'selected' : ''}>10</option>
                            <option value="25" ${this.rowsPerPage === 25 ? 'selected' : ''}>25</option>
                            <option value="50" ${this.rowsPerPage === 50 ? 'selected' : ''}>50</option>
                            <option value="100" ${this.rowsPerPage === 100 ? 'selected' : ''}>100</option>
                        </select>
                        <span id="pageRangeInfo"></span>
                    </div>

                    <!-- Right side: Page navigation -->
                    <div id="paginationPages" style="display: flex; gap: 4px; align-items: center;"></div>
                </div>
            `;

            container.innerHTML = html;
            this.attachFilterHandlers();
            this.renderPaginationControls();
            this.applyRoleRestrictions();
        },

        renderSyncSummary() {
            const cache = this.syncStatusCache || {};
            const entries = Object.values(cache);
            if (!entries.length) return '';
            const targets = ['pos', 'mobile'];
            const colors = { pending: '#f97316', synced: '#10b981', error: '#ef4444' };
            const counts = targets.reduce((acc, target) => {
                acc[target] = { pending: 0, synced: 0, error: 0 };
                return acc;
            }, {});
            let hasData = false;
            entries.forEach((status) => {
                targets.forEach((target) => {
                    const state = status[target]?.state;
                    if (state && counts[target][state] !== undefined) {
                        counts[target][state] += 1;
                        hasData = true;
                    }
                });
            });
            if (!hasData) return '';
            const pollIndicator = `
                <div style="display:flex; align-items:center; gap:6px; font-size:12px; color:rgba(75,85,99,1);">
                    <span>🔁 Опрос статуса:</span>
                    <strong>
                        ${
                            this.isSyncPolling
                                ? 'обновляем...'
                                : this.lastSyncPollAt
                                ? this.formatRelativeTime(this.lastSyncPollAt)
                                : 'не выполнялся'
                        }
                    </strong>
                </div>
            `;
            return `
                <div class="sync-summary" style="margin: 4px 0 12px 0; padding: 8px 12px; background: rgba(15,23,42,0.04); border: 1px solid rgba(15,23,42,0.08); border-radius: 10px; display: flex; gap: 16px; flex-wrap: wrap;">
                    ${targets
                        .map((target) => {
                            const label = target === 'pos' ? 'POS' : 'Mobile';
                            const segments = Object.entries(counts[target])
                                .filter(([, value]) => value > 0)
                                .map(([state, value]) => {
                                    const text =
                                        state === 'synced'
                                            ? 'синхр.'
                                            : state === 'pending'
                                            ? 'в очереди'
                                            : 'ошибок';
                                    return `<span style="color:${colors[state]}; font-weight:600;">${value} ${text}</span>`;
                                })
                                .join('<span style="color: rgba(15,23,42,0.4);"> / </span>') || '<span style="color: rgba(15,23,42,0.4);">—</span>';
                            return `<div style="font-size: 12px; color: rgba(15,23,42,0.8); display:flex; gap:6px; align-items:center;"><strong>${label}</strong>${segments}</div>`;
                        })
                        .join('')}
                    ${pollIndicator}
                </div>
            `;
        },

        renderSyncSummaryWidget() {
            const container = document.getElementById('syncSummaryContainer');
            if (!container) return;
            const summary = this.renderSyncSummary();
            if (summary) {
                container.innerHTML = summary;
            } else {
                container.remove();
            }
        },

        async pollSyncStatuses() {
            if (!this.products.length) {
                this.stopSyncPolling();
                return;
            }
            if (this.isSyncPolling) return;
            const ids = this.products.map((product) => product.id).filter(Boolean);
            if (!ids.length) return;
            this.isSyncPolling = true;
            try {
                await this.loadSyncStatuses(ids);
                this.lastSyncPollAt = Date.now();
                this.renderSyncSummaryWidget();
            } catch (error) {
                console.warn('Ошибка фонового опроса синхронизации:', error);
            } finally {
                this.isSyncPolling = false;
            }
        },

        startSyncPolling() {
            if (this.syncPollingTimer || !this.products.length) return;
            this.syncPollingTimer = setInterval(() => this.pollSyncStatuses(), this.syncPollingInterval);
        },

        stopSyncPolling() {
            if (this.syncPollingTimer) {
                clearInterval(this.syncPollingTimer);
                this.syncPollingTimer = null;
            }
        },

        formatRelativeTime(timestamp) {
            if (!timestamp) return 'не выполнялся';
            const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
            if (diffSeconds < 5) return 'только что';
            if (diffSeconds < 60) return `${diffSeconds}с назад`;
            const diffMinutes = Math.floor(diffSeconds / 60);
            if (diffMinutes < 60) return `${diffMinutes}м назад`;
            const diffHours = Math.floor(diffMinutes / 60);
            return `${diffHours}ч назад`;
        },

        renderRoleBanner() {
            if (!this.authUser) {
                return '';
            }
            const roleConfig = this.getRoleConfig();
            const summary = this.describeCurrentRole();
            return `
                <div class="role-banner" style="margin-bottom: 12px; padding: 12px 16px; border: 1px solid rgba(94,82,64,0.12); border-radius: 12px; background: rgba(252,252,249,1); display: flex; gap: 16px; flex-wrap: wrap; align-items: center;">
                    <div style="flex:1; min-width: 180px;">
                        <div style="font-size: 12px; color: rgba(75,85,99,1);">Пользователь</div>
                        <div style="font-weight:600; color: rgba(15,23,42,1);">${this.escapeHtml(this.authUser.name || this.authUser.email)}</div>
                        <div style="font-size: 12px; color: rgba(107,114,128,1);">${this.escapeHtml(this.authUser.email || '')}</div>
                    </div>
                    <div style="flex:1; min-width: 180px;">
                        <div style="font-size: 12px; color: rgba(75,85,99,1);">Роль</div>
                        <div style="font-weight:600; color: rgba(15,23,42,1);">${roleConfig.label}</div>
                        <div id="roleSummaryText" style="font-size: 13px; color: rgba(55,65,81,1);">${summary}</div>
                    </div>
                    <button class="btn btn--ghost" id="logoutBtn" type="button">🚪 Выйти</button>
                </div>
            `;
        },

        renderFiltersPanel() {
            const categoryOptions = [
                '<option value="">Все категории</option>',
                ...this.categories.map(cat => `<option value="${cat.id}">${this.escapeHtml(cat.name || '')}</option>`)
            ].join('');

            return `
                <div class="catalog-filters" style="display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; margin-bottom: 12px;">
                    <div style="flex: 2; min-width: 220px;">
                        <label style="display: block; font-size: 12px; color: rgba(75,85,99,1); margin-bottom: 4px;">Поиск</label>
                        <input type="text" id="productSearchInput" placeholder="Название, SKU, штрих-код..." value="${this.escapeHtml(this.currentFilters.search || '')}"
                               style="width: 100%; padding: 10px 12px; border: 1px solid rgba(209,213,219,1); border-radius: 10px; background: white;">
                    </div>
                    <div style="flex: 1; min-width: 180px;">
                        <label style="display: block; font-size: 12px; color: rgba(75,85,99,1); margin-bottom: 4px;">Категория</label>
                        <select id="filterCategorySelect" style="width: 100%; padding: 10px 12px; border: 1px solid rgba(209,213,219,1); border-radius: 10px;">
                            ${categoryOptions}
                        </select>
                    </div>
                    <div style="flex: 1; min-width: 160px;">
                        <label style="display: block; font-size: 12px; color: rgba(75,85,99,1); margin-bottom: 4px;">Тип</label>
                        <select id="filterTypeSelect" style="width: 100%; padding: 10px 12px; border: 1px solid rgba(209,213,219,1); border-radius: 10px;">
                            <option value="all">Все типы</option>
                            <option value="product">Товар</option>
                            <option value="service">Услуга</option>
                            <option value="dish">Блюдо</option>
                            <option value="ingredient">Ингредиент</option>
                        </select>
                    </div>
                    <div style="flex: 1; min-width: 160px;">
                        <label style="display: block; font-size: 12px; color: rgba(75,85,99,1); margin-bottom: 4px;">Статус</label>
                        <select id="filterVisibilitySelect" style="width: 100%; padding: 10px 12px; border: 1px solid rgba(209,213,219,1); border-radius: 10px;">
                            <option value="all">Любой</option>
                            <option value="visible">Только активные</option>
                            <option value="hidden">Только скрытые</option>
                        </select>
                    </div>
                    <div style="flex: 1; min-width: 160px;">
                        <label style="display: block; font-size: 12px; color: rgba(75,85,99,1); margin-bottom: 4px;">Остаток</label>
                        <select id="filterStockSelect" style="width: 100%; padding: 10px 12px; border: 1px solid rgba(209,213,219,1); border-radius: 10px;">
                            <option value="all">Любой</option>
                            <option value="positive">Положительный</option>
                            <option value="zero">Нулевой</option>
                            <option value="negative">Отрицательный</option>
                        </select>
                    </div>
                    <div style="flex: 1; min-width: 160px;">
                        <label style="display: block; font-size: 12px; color: rgba(75,85,99,1); margin-bottom: 4px;">Штрих-код</label>
                        <select id="filterBarcodeSelect" style="width: 100%; padding: 10px 12px; border: 1px solid rgba(209,213,219,1); border-radius: 10px;">
                            <option value="all">Любой</option>
                            <option value="yes">Есть</option>
                            <option value="no">Нет</option>
                        </select>
                    </div>
                    <div style="flex: 1; min-width: 160px;">
                        <label style="display: block; font-size: 12px; color: rgba(75,85,99,1); margin-bottom: 4px;">Акции</label>
                        <select id="filterPromoSelect" style="width: 100%; padding: 10px 12px; border: 1px solid rgba(209,213,219,1); border-radius: 10px;">
                            <option value="all">Любой</option>
                            <option value="discounts">Запрет скидок</option>
                            <option value="loyalty">Запрет бонусов</option>
                        </select>
                    </div>
                    <div style="min-width: 140px;">
                        <button id="resetFiltersBtn" style="width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(209,213,219,1); background: white; font-weight: 600; cursor: pointer;">
                            ♻️ Сбросить
                        </button>
                    </div>
                    <div style="display:flex; gap:8px; min-width: 220px;">
                        <button id="columnsConfigBtn" class="btn btn--ghost" type="button" style="flex:1;">⚙️ Колонки</button>
                        ${
                            this.activeRole === 'admin'
                                ? '<button id="featureFlagsBtn" class="btn btn--ghost" type="button" style="flex:1;">🧪 Флаги</button>'
                                : ''
                        }
                    </div>
                </div>
            `;
        },

        attachFilterHandlers() {
            const searchInput = document.getElementById('productSearchInput');
            if (searchInput) {
                searchInput.value = this.currentFilters.search || '';
                
                // Обработка ввода с debounce
                const handleSearch = () => {
                    clearTimeout(this.searchDebounce);
                    this.searchDebounce = setTimeout(() => {
                        this.currentFilters.search = searchInput.value.trim();
                        this.currentPage = 1;
                        this.persistFilters();
                        this.loadProducts();
                    }, 300);
                };
                
                searchInput.addEventListener('input', handleSearch);
                
                // Обработка Enter для немедленного поиска
                searchInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        clearTimeout(this.searchDebounce);
                        this.currentFilters.search = searchInput.value.trim();
                        this.currentPage = 1;
                        this.persistFilters();
                        this.loadProducts();
                    }
                });
                
                // Обработка очистки поля
                searchInput.addEventListener('clear', () => {
                    this.currentFilters.search = '';
                    this.currentPage = 1;
                    this.persistFilters();
                    this.loadProducts();
                });
            } else {
                console.warn('⚠️ productSearchInput не найден в DOM');
            }

            const bindSelect = (elementId, key) => {
                const element = document.getElementById(elementId);
                if (!element) return;
                element.value = this.currentFilters[key] ?? '';
                element.addEventListener('change', (e) => {
                    this.currentFilters[key] = e.target.value;
                    this.currentPage = 1;
                    this.persistFilters();
                    this.loadProducts();
                });
            };

            bindSelect('filterCategorySelect', 'category');
            bindSelect('filterTypeSelect', 'type');
            bindSelect('filterStockSelect', 'stock');
            bindSelect('filterVisibilitySelect', 'visible');
            bindSelect('filterPromoSelect', 'promo');
            bindSelect('filterBarcodeSelect', 'hasBarcode');

            const resetBtn = document.getElementById('resetFiltersBtn');
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    this.currentFilters = { ...DEFAULT_FILTERS };
                    this.currentPage = 1;
                    this.persistFilters();
                    this.loadProducts();
                });
            }

            const columnsBtn = document.getElementById('columnsConfigBtn');
            if (columnsBtn) {
                columnsBtn.addEventListener('click', () => this.openColumnsModal());
            }
            const featureBtn = document.getElementById('featureFlagsBtn');
            if (featureBtn) {
                featureBtn.addEventListener('click', () => this.openFeatureFlagsModal());
            }
        },

        // Изменить количество строк на странице
        changeRowsPerPage(value) {
            this.rowsPerPage = parseInt(value, 10) || 10;
            this.currentPage = 1;
            this.meta.limit = this.rowsPerPage;
            this.persistTableSettings();
            this.loadProducts();
        },

        // Перейти на страницу
        goToPage(page) {
            const maxPage = this.meta?.pages || 1;
            if (page < 1) page = 1;
            if (page > maxPage) page = maxPage;
            if (page === this.currentPage) return;
            this.currentPage = page;
            this.loadProducts();
        },

        // Отрисовка элементов пагинации
        renderPaginationControls() {
            const totalProducts = this.meta?.total ?? this.products.length;
            const totalPages = this.meta?.pages ?? Math.max(1, Math.ceil(totalProducts / this.rowsPerPage));
            const paginationPages = document.getElementById('paginationPages');
            const pageRangeInfo = document.getElementById('pageRangeInfo');
            
            if (!paginationPages || !pageRangeInfo) return;
            
            paginationPages.innerHTML = '';
            
            if (totalProducts === 0) {
                pageRangeInfo.textContent = 'Нет данных';
                return;
            }

            // Calculate range info (e.g., "1 – 10 из 12")
            const startRange = (this.currentPage - 1) * this.rowsPerPage + 1;
            const endRange = Math.min(this.currentPage * this.rowsPerPage, totalProducts);
            pageRangeInfo.textContent = `${startRange} – ${endRange} из ${totalProducts} товаров`;

            // Prev Button
            const prevBtn = document.createElement('button');
            prevBtn.className = 'pagination-page-btn';
            prevBtn.textContent = '<';
            prevBtn.disabled = this.currentPage === 1;
            prevBtn.onclick = () => this.goToPage(this.currentPage - 1);
            prevBtn.style.cssText = 'background: rgba(252, 252, 249, 1); color: rgba(19, 52, 59, 1); border: 1px solid rgba(94, 82, 64, 0.2); border-radius: 8px; padding: 4px 8px; min-width: 32px; text-align: center; cursor: pointer; font-weight: 500; transition: background 150ms;';
            prevBtn.disabled ? prevBtn.style.opacity = '0.5' : '';
            paginationPages.appendChild(prevBtn);
            
            // Determine which pages to show
            const pagesToShow = [];
            
            if (totalPages <= 5) {
                for (let i = 1; i <= totalPages; i++) pagesToShow.push(i);
            } else {
                pagesToShow.push(1);
                if (this.currentPage > 3) pagesToShow.push('...');
                
                let start = Math.max(2, this.currentPage - 1);
                let end = Math.min(totalPages - 1, this.currentPage + 1);
                
                if (this.currentPage <= 3) end = 3;
                if (this.currentPage >= totalPages - 2) start = totalPages - 3;
                
                for (let i = start; i <= end; i++) {
                    if (!pagesToShow.includes(i)) pagesToShow.push(i);
                }

                if (this.currentPage < totalPages - 2) pagesToShow.push('...');
                if (totalPages !== 1) pagesToShow.push(totalPages);
            }
            
            pagesToShow.forEach(page => {
                if (page === '...') {
                    const span = document.createElement('span');
                    span.textContent = '...';
                    span.style.padding = '0 8px';
                    paginationPages.appendChild(span);
                } else {
                    const pageBtn = document.createElement('button');
                    pageBtn.className = 'pagination-page-btn';
                    if (page === this.currentPage) pageBtn.className += ' active';
                    pageBtn.textContent = page;
                    pageBtn.onclick = () => this.goToPage(page);
                    pageBtn.style.cssText = `background: ${page === this.currentPage ? 'rgba(33, 128, 141, 1)' : 'rgba(252, 252, 249, 1)'}; color: ${page === this.currentPage ? 'rgba(252, 252, 249, 1)' : 'rgba(19, 52, 59, 1)'}; border: 1px solid ${page === this.currentPage ? 'rgba(33, 128, 141, 1)' : 'rgba(94, 82, 64, 0.2)'}; border-radius: 8px; padding: 4px 8px; min-width: 32px; text-align: center; cursor: pointer; font-weight: 500; transition: background 150ms;`;
                    paginationPages.appendChild(pageBtn);
                }
            });

            // Next Button
            const nextBtn = document.createElement('button');
            nextBtn.className = 'pagination-page-btn';
            nextBtn.textContent = '>';
            nextBtn.disabled = this.currentPage === totalPages || totalPages === 0;
            nextBtn.onclick = () => this.goToPage(this.currentPage + 1);
            nextBtn.style.cssText = 'background: rgba(252, 252, 249, 1); color: rgba(19, 52, 59, 1); border: 1px solid rgba(94, 82, 64, 0.2); border-radius: 8px; padding: 4px 8px; min-width: 32px; text-align: center; cursor: pointer; font-weight: 500; transition: background 150ms;';
            nextBtn.disabled ? nextBtn.style.opacity = '0.5' : '';
            paginationPages.appendChild(nextBtn);
        },

        // Получить категории товара
        getProductCategories(product) {
            if (!product) return [];
            
            // Собираем все возможные ID категорий из разных источников
            let categoryIds = [];
            
            // 1. Из category_ids (массив ID)
            if (Array.isArray(product.category_ids) && product.category_ids.length > 0) {
                categoryIds = product.category_ids;
            }
            // 2. Из categories (может быть массив объектов или массив ID)
            else if (Array.isArray(product.categories) && product.categories.length > 0) {
                // Проверяем, это массив объектов или массив ID
                if (typeof product.categories[0] === 'object' && product.categories[0].id) {
                    // Это массив объектов - извлекаем имена напрямую
                    const names = product.categories
                        .map(cat => cat.name || null)
                        .filter(Boolean);
                    if (names.length > 0) {
                        return names;
                    }
                } else {
                    // Это массив ID
                    categoryIds = product.categories;
                }
            }
            // 3. Из строки categories (JSON)
            else if (typeof product.categories === 'string' && product.categories.trim()) {
                try {
                    const parsed = JSON.parse(product.categories);
                    if (Array.isArray(parsed)) {
                        if (typeof parsed[0] === 'object' && parsed[0].id) {
                            // Массив объектов
                            return parsed
                                .map(cat => cat.name || null)
                                .filter(Boolean);
                        } else {
                            // Массив ID
                            categoryIds = parsed;
                        }
                    }
                } catch (e) {
                    // Игнорируем ошибки парсинга
                }
            }
            // 4. Из одиночного category (старый формат)
            else if (product.category) {
                // Если это ID, добавляем его
                if (typeof product.category === 'number' || (typeof product.category === 'string' && /^\d+$/.test(product.category))) {
                    categoryIds = [product.category];
                }
            }
            
            // Если у нас есть ID категорий, ищем их в списке категорий
            if (categoryIds.length > 0) {
                return categoryIds
                    .map(id => {
                        const cat = this.categories.find(c => String(c.id) === String(id));
                        return cat ? cat.name : null;
                    })
                    .filter(Boolean);
            }
            
            return [];
        },

        // Переключить выбор одного товара
        toggleProduct(productId, checked) {
            if (checked) {
                this.selectedProducts.add(productId);
            } else {
                this.selectedProducts.delete(productId);
            }
            this.renderProductsTable();
        },

        // Переключить выбор всех товаров
        toggleSelectAll(checked) {
            if (checked) {
                this.products.forEach(p => this.selectedProducts.add(p.id));
            } else {
                this.selectedProducts.clear();
            }
            this.renderProductsTable();
        },

        // Снять выбор
        clearSelection() {
            this.selectedProducts.clear();
            this.renderProductsTable();
        },

        async handleInlineEdit(button) {
            const field = button.getAttribute('data-inline-edit');
            const productId = button.getAttribute('data-product-id');
            const product = this.products.find((p) => String(p.id) === String(productId));
            if (!product) return;

            if (field === 'price' && !this.ensurePermission('product.price')) return;
            if (field === 'quantity' && !this.ensurePermission('product.stock')) return;

            const currentValue = field === 'price'
                ? product.price
                : product.quantity;
            const label = field === 'price' ? 'новую цену' : 'новый остаток';
            const input = prompt(`Введите ${label} для "${product.name}"`, currentValue);
            if (input === null) return;

            let value = field === 'price' ? parseFloat(input) : parseInt(input, 10);
            if (Number.isNaN(value)) {
                alert('Введите корректное число');
                return;
            }
            if (field === 'price' && value < 0) value = 0;
            if (field === 'quantity' && value < 0) value = 0;

            try {
                await this.patchProduct(productId, field === 'price' ? { price: value } : { quantity: value });
                await this.loadProducts();
            } catch (error) {
                console.error('Inline edit error:', error);
                alert(`Не удалось обновить значение: ${error.message || 'Ошибка'}`);
            }
        },

        // Массовое изменение видимости
        // Массовое переключение видимости
        async bulkToggleVisibility() {
            if (!this.ensurePermission('product.visibility')) {
                return;
            }
            if (this.selectedProducts.size === 0) {
                alert('Выберите товары для изменения видимости');
                return;
            }

            try {
                const productIds = this.getSelectedProductIds();
                const products = this.products.filter(p => productIds.includes(p.id));
                const allVisible = products.every(p => p.visible_on_site);
                const newVisibility = !allVisible;

                await this.bulkPatchProducts(productIds, { is_visible: newVisibility });
                    alert(`✅ Видимость изменена для ${productIds.length} товаров`);
                    this.clearSelection();
                    await this.loadProducts();
            } catch (error) {
                console.error('Bulk toggle visibility error:', error);
                alert(`❌ Ошибка: ${error.message || 'Не удалось изменить видимость'}`);
            }
        },

        async bulkSetVisibility(visible) {
            if (!this.ensurePermission('product.visibility')) {
                return;
            }
            if (this.selectedProducts.size === 0) {
                alert('Выберите товары для изменения видимости');
                return;
            }

            if (!confirm(`${visible ? 'Показать' : 'Скрыть'} ${this.selectedProducts.size} товаров на сайте?`)) {
                return;
            }

            try {
                await this.bulkPatchProducts(this.getSelectedProductIds(), { is_visible: !!visible });
                alert('✅ Видимость обновлена');
                    this.clearSelection();
                    await this.loadProducts();
            } catch (error) {
                console.error('Bulk visibility error:', error);
                alert(`❌ Ошибка: ${error.message || 'Не удалось изменить видимость'}`);
            }
        },

        // Массовое изменение категории (через select в bulk actions)
        async bulkChangeCategory() {
            if (!this.ensurePermission('product.bulk')) {
                return;
            }
            if (this.selectedProducts.size === 0) {
                alert('Выберите товары для изменения категории');
                return;
            }

            const select = document.getElementById('bulkCategorySelect');
            if (!select) {
                this.showBulkCategoryModal();
                return;
            }

            const categoryId = select.value;
            if (!categoryId) {
                alert('Выберите категорию');
                return;
            }

            if (!confirm(`Изменить категорию для ${this.selectedProducts.size} товаров?`)) {
                return;
            }

            try {
                await this.bulkPatchProducts(this.getSelectedProductIds(), { categories: [categoryId] });
                const category = this.categories.find(c => String(c.id) === String(categoryId));
                    alert(`✅ Категория изменена для ${this.selectedProducts.size} товаров на "${category ? category.name : 'неизвестная'}"`);
                    this.clearSelection();
                    await this.loadProducts();
            } catch (error) {
                console.error('Bulk change category error:', error);
                alert(`❌ Ошибка при изменении категории: ${error.message || 'Не удалось применить изменения'}`);
            }
        },

        // Показать модальное окно для массового изменения категорий
        showBulkCategoryModal() {
            if (!this.ensurePermission('product.bulk')) {
                return;
            }
            if (this.selectedProducts.size === 0) {
                alert('Выберите товары для изменения категорий');
                return;
            }

            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.7); display: flex; align-items: center;
                justify-content: center; z-index: 10000;
            `;

            const categoriesOptions = this.categories.map(cat => 
                `<label style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; border-radius: 6px; background: #f9fafb; cursor: pointer;">
                    <input type="checkbox" value="${cat.id}" class="category-checkbox" style="width: 18px; height: 18px;">
                    <span>${cat.name}</span>
                </label>`
            ).join('');

            modal.innerHTML = `
                <div style="background: white; border-radius: 16px; padding: 2rem; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto;">
                    <h2 style="margin: 0 0 1.5rem 0; color: var(--dandy-green);">📂 Изменение категорий</h2>
                    <p style="margin-bottom: 1rem;">Выбрано товаров: <strong>${this.selectedProducts.size}</strong></p>
                    
                    <div style="margin-bottom: 1.5rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Действие:</label>
                        <select id="bulkCategoryAction" style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px;">
                            <option value="replace">Заменить категории</option>
                            <option value="add">Добавить к существующим</option>
                            <option value="remove">Удалить выбранные</option>
                        </select>
                    </div>

                    <div style="margin-bottom: 1.5rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Выберите категории:</label>
                        <div style="max-height: 300px; overflow-y: auto; border: 2px solid #e5e7eb; border-radius: 8px; padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem;">
                            ${categoriesOptions}
                        </div>
                    </div>

                    <div style="display: flex; gap: 1rem;">
                        <button onclick="ProductCardsManager.applyBulkCategories()" 
                                style="flex: 1; padding: 1rem; background: var(--dandy-green); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 16px;">
                            ✅ Применить
                        </button>
                        <button onclick="this.closest('.modal-overlay').remove()" 
                                style="flex: 1; padding: 1rem; background: #6b7280; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                            ❌ Отмена
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.remove();
            });
        },

        // Применить массовое изменение категорий
        async applyBulkCategories() {
            if (!this.ensurePermission('product.bulk')) {
                return;
            }
            const action = document.getElementById('bulkCategoryAction').value;
            const checkboxes = document.querySelectorAll('.category-checkbox:checked');
            const categoryIds = Array.from(checkboxes).map(cb => cb.value);

            if (categoryIds.length === 0) {
                alert('Выберите хотя бы одну категорию');
                return;
            }

            try {
                const updates = this.getSelectedProductIds().map((productId) => {
                    const product = this.products.find(p => p.id === productId);
                    let categories = Array.isArray(product?.categories) ? [...product.categories] : [];
                    if (action === 'replace') {
                        categories = categoryIds.slice();
                    } else if (action === 'add') {
                        const set = new Set(categories.map(String));
                        categoryIds.forEach(id => set.add(String(id)));
                        categories = Array.from(set);
                    } else if (action === 'remove') {
                        categories = categories.filter(id => !categoryIds.includes(String(id)));
                    }
                    return { id: productId, changes: { categories } };
                });

                await this.patchProductsSequential(updates, 'Категории обновлены');
                    document.querySelector('.modal-overlay').remove();
                    this.clearSelection();
                    await this.loadProducts();
            } catch (error) {
                console.error('Bulk categories error:', error);
                alert(`❌ Ошибка при изменении категорий: ${error.message || 'Не удалось применить изменения'}`);
            }
        },

        // Показать модальное окно для массового изменения цен
        showBulkPriceModal() {
            if (this.selectedProducts.size === 0) {
                alert('Выберите товары для изменения цен');
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
                <div style="background: white; border-radius: 16px; padding: 2rem; max-width: 500px; width: 90%;">
                    <h2 style="margin: 0 0 1.5rem 0; color: var(--dandy-green);">💰 Изменение цен</h2>
                    <p style="margin-bottom: 1rem;">Выбрано товаров: <strong>${this.selectedProducts.size}</strong></p>
                    
                    <div style="margin-bottom: 1.5rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Тип изменения:</label>
                        <select id="bulkPriceType" style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px;">
                            <option value="percent">Процентное изменение (%)</option>
                            <option value="fixed">Фиксированное изменение (₽)</option>
                        </select>
                    </div>

                    <div style="margin-bottom: 1.5rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Значение:</label>
                        <input type="number" id="bulkPriceValue" step="0.01" 
                               placeholder="Например: 10 или -10"
                               style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px;">
                        <div style="font-size: 0.85em; color: #666; margin-top: 0.5rem;">
                            💡 Используйте отрицательные значения для уменьшения цен
                        </div>
                    </div>

                    <div style="display: flex; gap: 1rem;">
                        <button onclick="ProductCardsManager.applyBulkPrices()" 
                                style="flex: 1; padding: 1rem; background: var(--dandy-green); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 16px;">
                            ✅ Применить
                        </button>
                        <button onclick="this.closest('.modal-overlay').remove()" 
                                style="flex: 1; padding: 1rem; background: #6b7280; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                            ❌ Отмена
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.remove();
            });
        },

        // Применить массовое изменение цен
        async applyBulkPrices() {
            const type = document.getElementById('bulkPriceType').value;
            const value = parseFloat(document.getElementById('bulkPriceValue').value);

            if (isNaN(value)) {
                alert('Введите корректное числовое значение');
                return;
            }

            const typeText = type === 'percent' ? `${value}%` : `${value} ₽`;
            if (!confirm(`Изменить цены у ${this.selectedProducts.size} товаров на ${typeText}?`)) {
                return;
            }

            try {
                const updates = this.getSelectedProductIds().map((productId) => {
                    const product = this.products.find(p => p.id === productId);
                    const currentPrice = Number(product?.price) || 0;
                    let newPrice = currentPrice;
                    if (type === 'percent') {
                        newPrice = currentPrice + (currentPrice * value / 100);
                    } else {
                        newPrice = currentPrice + value;
                    }
                    if (newPrice < 0) newPrice = 0;
                    newPrice = Math.round(newPrice * 100) / 100;
                    return { id: productId, changes: { price: newPrice } };
                });

                await this.patchProductsSequential(updates, 'Цены обновлены');
                    document.querySelector('.modal-overlay').remove();
                    this.clearSelection();
                    await this.loadProducts();
            } catch (error) {
                console.error('Bulk prices error:', error);
                alert(`❌ Ошибка при изменении цен: ${error.message || 'Не удалось применить изменения'}`);
            }
        },

        // Массовое удаление
        async bulkDelete() {
            if (!this.ensurePermission('product.delete')) {
                return;
            }
            if (this.selectedProducts.size === 0) {
                alert('Выберите товары для удаления');
                return;
            }

            if (!confirm(`⚠️ ВНИМАНИЕ!\n\nВы действительно хотите удалить ${this.selectedProducts.size} товаров?\n\nЭто действие нельзя отменить!`)) {
                return;
            }

            try {
                const productIds = this.getSelectedProductIds();
                const { success, failed } = await this.deleteProducts(productIds);
                // Обновляем локальный список ДО перезагрузки с сервера
                this.products = this.products.filter(p => !productIds.includes(p.id));
                await this.syncToWebsite(false);
                this.clearSelection();
                // Перезагружаем список товаров для синхронизации
                await this.loadProducts();
                // Повторно убираем удаленные товары из списка (на случай если сервер еще не обновился)
                this.products = this.products.filter(p => !productIds.includes(p.id));
                this.renderProductsTable();
                console.log(`✅ Удалено ${success}, ошибок ${failed}`);
            } catch (error) {
                console.error('Bulk delete error:', error);
                alert('❌ Ошибка при удалении товаров: ' + error.message);
            }
        },

        // Переключить видимость одного товара
        async toggleVisibility(productId, visible) {
            // Сначала пробуем API, при 404 или ошибке — тихо меняем локально
            try {
                await this.patchProduct(productId, { is_visible: !!visible });
            } catch (error) {
                console.warn('toggleVisibility fallback', error);
            }

                const idx = this.products.findIndex(p => String(p.id) === String(productId));
                if (idx >= 0) {
                    this.products[idx].visible_on_site = !!visible;
            }

            await this.loadProducts();
            // Обновим витрину
            await this.syncToWebsite(false);
        },

        // Редактировать товар
        // Загрузить варианты товара через API items
        async loadItemVariants(itemId) {
            try {
                const response = await fetch(`/api/v1/items/${itemId}/variants`, {
                    headers: this.getRoleHeaders()
                });
                if (!response.ok) {
                    if (response.status === 404) return [];
                    throw new Error(`Failed to load variants: ${response.statusText}`);
                }
                const data = await response.json();
                return data.success ? data.data : [];
            } catch (error) {
                console.error('Error loading variants:', error);
                return [];
            }
        },

        // Отобразить варианты товара
        async renderItemVariants(itemId) {
            if (!itemId) return '<p style="color: #666;">Сохраните товар как витринную карточку, чтобы добавить варианты</p>';
            const variants = await this.loadItemVariants(itemId);
            if (variants.length === 0) {
                return '<p style="color: #666;">Варианты не добавлены</p>';
            }
            return variants.map(variant => {
                const attrs = typeof variant.attributes === 'string' ? JSON.parse(variant.attributes || '{}') : (variant.attributes || {});
                const variantParam = attrs.variant_param || '';
                return `
                    <div class="variant-item" data-variant-id="${variant.id}" style="display: flex; gap: 1rem; padding: 1rem; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 0.5rem; align-items: center;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; margin-bottom: 0.25rem;">${variant.name}</div>
                            <div style="font-size: 0.85em; color: #666;">SKU: ${variant.sku || '—'}</div>
                            ${variantParam ? `<div style="font-size: 0.85em; color: #666;">Размер: ${variantParam}</div>` : ''}
                        </div>
                        <button onclick="ProductCardsManager.editItemVariant(${variant.id}, ${itemId})" 
                                style="padding: 0.5rem 1rem; background: var(--dandy-green); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
                            ✏️
                        </button>
                        <button onclick="ProductCardsManager.deleteItemVariant(${variant.id}, ${itemId})" 
                                style="padding: 0.5rem 1rem; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
                            🗑️
                        </button>
                    </div>
                `;
            }).join('');
        },

        // Добавить вариант товара
        async addItemVariant(parentId) {
            const variantParam = prompt('Введите размер варианта (например: 25 см):');
            if (!variantParam) return;
            
            const sku = prompt('Введите SKU варианта:');
            if (!sku) return;
            
            const price = parseFloat(prompt('Введите цену варианта:') || '0');
            if (isNaN(price)) {
                alert('Некорректная цена');
                return;
            }
            
            try {
                const response = await fetch(`/api/v1/items/${parentId}/variants`, {
                    method: 'POST',
                    headers: {
                        ...this.getRoleHeaders(),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        sku,
                        variant_param: variantParam,
                        name: variantParam,
                        price,
                        status: 'published'
                    })
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to create variant');
                }
                
                alert('Вариант успешно добавлен');
                // Перезагрузить варианты
                const container = document.getElementById('variantsContainer');
                if (container) {
                    container.innerHTML = await this.renderItemVariants(parentId);
                }
            } catch (error) {
                console.error('Error adding variant:', error);
                alert(`Ошибка: ${error.message}`);
            }
        },

        // Редактировать вариант товара
        async editItemVariant(variantId, parentId) {
            try {
                const response = await fetch(`/api/v1/items/variant/${variantId}`, {
                    headers: this.getRoleHeaders()
                });
                if (!response.ok) throw new Error('Failed to load variant');
                const data = await response.json();
                const variant = data.data;
                
                const attrs = typeof variant.attributes === 'string' ? JSON.parse(variant.attributes || '{}') : (variant.attributes || {});
                const variantParam = prompt('Введите размер варианта:', attrs.variant_param || '');
                if (variantParam === null) return;
                
                const price = parseFloat(prompt('Введите цену варианта:', variant.price || '0') || '0');
                if (isNaN(price)) {
                    alert('Некорректная цена');
                    return;
                }
                
                const updateResponse = await fetch(`/api/v1/items/variant/${variantId}`, {
                    method: 'PATCH',
                    headers: {
                        ...this.getRoleHeaders(),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        attributes: { variant_param: variantParam },
                        price
                    })
                });
                
                if (!updateResponse.ok) {
                    const error = await updateResponse.json();
                    throw new Error(error.error || 'Failed to update variant');
                }
                
                alert('Вариант успешно обновлен');
                // Перезагрузить варианты
                const container = document.getElementById('variantsContainer');
                if (container) {
                    container.innerHTML = await this.renderItemVariants(parentId);
                }
            } catch (error) {
                console.error('Error editing variant:', error);
                alert(`Ошибка: ${error.message}`);
            }
        },

        // Удалить вариант товара
        async deleteItemVariant(variantId, parentId) {
            if (!confirm('Вы уверены, что хотите удалить этот вариант?')) return;
            
            try {
                const response = await fetch(`/api/v1/items/variant/${variantId}`, {
                    method: 'DELETE',
                    headers: this.getRoleHeaders()
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to delete variant');
                }
                
                alert('Вариант успешно удален');
                // Перезагрузить варианты
                const container = document.getElementById('variantsContainer');
                if (container) {
                    container.innerHTML = await this.renderItemVariants(parentId);
                }
            } catch (error) {
                console.error('Error deleting variant:', error);
                alert(`Ошибка: ${error.message}`);
            }
        },

        async editProduct(productId) {
            if (!this.ensurePermission('product.update')) {
                return;
            }
            return this.openProductWizard({ mode: 'edit', productId });
            const product = this.products.find(p => p.id === productId);
            if (!product) {
                alert('Товар не найден');
                return;
            }

            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.7); display: flex; align-items: center;
                justify-content: center; z-index: 10000; padding: 1rem;
            `;

            const categoriesCheckboxes = this.categories.map(cat => {
                let isChecked = false;
                try {
                    const productCategories = typeof product.categories === 'string' 
                        ? JSON.parse(product.categories) 
                        : (product.categories || []);
                    isChecked = productCategories.includes(cat.id);
                } catch (e) {
                    isChecked = false;
                }
                
                return `
                    <label style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; border-radius: 6px; background: #f9fafb; cursor: pointer;">
                        <input type="checkbox" class="edit-category-checkbox" value="${cat.id}" ${isChecked ? 'checked' : ''} style="width: 18px; height: 18px;">
                        <span>${cat.name}</span>
                    </label>
                `;
            }).join('');

            modal.innerHTML = `
                <div style="background: white; border-radius: 16px; padding: 2rem; max-width: 900px; width: 95%; max-height: 90vh; overflow-y: auto;">
                    <h2 style="margin: 0 0 1.5rem 0; color: var(--dandy-green); display: flex; align-items: center; gap: 0.5rem;">
                        ✏️ Редактирование карточки товара
                    </h2>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
                        <!-- Левая колонка -->
                        <div>
                            <h3 style="color: var(--dandy-green); margin-bottom: 1rem; font-size: 1.1rem;">📝 Основная информация</h3>
                            
                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Название товара: <span style="color: red;">*</span></label>
                                <input type="text" id="editProductName" value="${product.name || ''}" 
                                       style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px;">
                            </div>

                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">SKU (артикул): <span style="color: red;">*</span></label>
                                <input type="text" id="editProductSku" value="${product.sku || ''}" 
                                       style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px;">
                            </div>

                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Краткое описание (для каталога):</label>
                                <textarea id="editProductShortDesc" rows="2" 
                                          style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px;">${product.short_description || ''}</textarea>
                            </div>

                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Полное описание (для карточки товара):</label>
                                <textarea id="editProductFullDesc" rows="4" 
                                          style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px;">${product.full_description || product.description || ''}</textarea>
                            </div>

                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                                <div>
                                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Цена (₽): <span style="color: red;">*</span></label>
                                    <input type="number" id="editProductPrice" value="${product.price || 0}" step="0.01"
                                           style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                                </div>
                                <div>
                                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Старая цена (₽):</label>
                                    <input type="text" id="editProductOldPrice" value="${product.old_price || ''}"
                                           style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                                </div>
                            </div>

                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                                <div>
                                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Себестоимость (₽):</label>
                                    <input type="number" id="editProductCost" value="${product.cost || 0}" step="0.01"
                                           style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                                </div>
                                <div>
                                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Остаток на складе:</label>
                                    <input type="number" id="editProductStock" value="${product.quantity ?? 0}"
                                           style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                                </div>
                            </div>

                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Вес/Размер/Граммы:</label>
                                <input type="text" id="editProductWeight" value="${product.weight || ''}" 
                                       placeholder="Например: 500г, 30см, 350мл"
                                       style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                            </div>

                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Калории:</label>
                                <input type="text" id="editProductCalories" value="${product.calories || ''}" 
                                       placeholder="Например: 450 ккал"
                                       style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                            </div>

                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Состав (ингредиенты):</label>
                                <textarea id="editProductIngredients" rows="3" 
                                          placeholder="Например: тесто, томатный соус, моцарелла, грибы, базилик"
                                          style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px;">${product.ingredients || ''}</textarea>
                            </div>

                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Аллергены:</label>
                                <textarea id="editProductAllergens" rows="2" 
                                          placeholder="Например: глютен, лактоза, яйца"
                                          style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 14px;">${product.allergens || ''}</textarea>
                            </div>
                        </div>

                        <!-- Правая колонка -->
                        <div>
                            <h3 style="color: var(--dandy-green); margin-bottom: 1rem; font-size: 1.1rem;">👁️ Видимость и отображение</h3>
                            
                            <div style="margin-bottom: 1.5rem; padding: 1rem; background: #f9fafb; border-radius: 8px;">
                                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin-bottom: 0.75rem;">
                                    <input type="checkbox" id="editProductVisible" ${product.visible_on_site ? 'checked' : ''} 
                                           style="width: 20px; height: 20px; cursor: pointer;">
                                    <span style="font-weight: 600;">✅ Видимый на сайте</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin-bottom: 0.75rem;">
                                    <input type="checkbox" id="editProductDisplayOnly" ${product.display_only ? 'checked' : ''} 
                                           style="width: 20px; height: 20px; cursor: pointer;">
                                    <span style="font-weight: 600;">🏪 Витринная карточка (не списывать)</span>
                                </label>
                                <div style="font-size: 0.85em; color: #666; margin-bottom: 0.75rem;">
                                    💡 Витринная карточка служит только для отображения. Остатки и себестоимость не учитываются. Для неё можно создать варианты (размеры).
                                </div>
                                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                    <input type="checkbox" id="editProductHiddenPromo" ${product.hidden_for_promo ? 'checked' : ''} 
                                           style="width: 20px; height: 20px; cursor: pointer;">
                                    <span style="font-weight: 600;">🎁 Скрытый (только для акций)</span>
                                </label>
                                <div style="font-size: 0.85em; color: #666; margin-top: 0.5rem;">
                                    💡 Скрытые товары не отображаются в каталоге, но доступны для акций
                                </div>
                            </div>

                            <h3 style="color: var(--dandy-green); margin-bottom: 1rem; font-size: 1.1rem;">📂 Категории</h3>
                            
                            <div style="margin-bottom: 1.5rem; max-height: 200px; overflow-y: auto; border: 2px solid #e5e7eb; border-radius: 8px; padding: 1rem;">
                                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                    ${categoriesCheckboxes}
                                </div>
                            </div>

                            <h3 style="color: var(--dandy-green); margin-bottom: 1rem; font-size: 1.1rem;">📷 Изображения</h3>
                            
                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Основное фото (URL):</label>
                                <input type="text" id="editProductImage" value="${product.image_url || ''}" 
                                       placeholder="https://example.com/photo.jpg"
                                       style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                                ${product.image_url ? `
                                    <div style="margin-top: 0.5rem;">
                                        <img src="${product.image_url}" alt="preview" 
                                             style="width: 100px; height: 100px; object-fit: cover; border-radius: 8px; border: 2px solid #e5e7eb;">
                                    </div>
                                ` : ''}
                            </div>

                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Режим фото:</label>
                                <select id="editProductPhotoMode" 
                                        style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px;">
                                    <option value="with_background" ${product.photo_mode === 'with_background' ? 'selected' : ''}>С фоном</option>
                                    <option value="no_background" ${product.photo_mode === 'no_background' ? 'selected' : ''}>Без фона (PNG)</option>
                                </select>
                            </div>

                            <h3 style="color: var(--dandy-green); margin-bottom: 1rem; font-size: 1.1rem;">🔗 Дополнительно</h3>
                            
                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Тип страницы товара:</label>
                                <select id="editProductPageType" 
                                        style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px;">
                                    <option value="default" ${product.product_page_type === 'default' ? 'selected' : ''}>По умолчанию</option>
                                    <option value="custom" ${product.product_page_type === 'custom' ? 'selected' : ''}>Кастомная страница</option>
                                    <option value="external" ${product.product_page_type === 'external' ? 'selected' : ''}>Внешняя ссылка</option>
                                </select>
                            </div>

                            <div style="margin-bottom: 1rem;">
                                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">URL страницы товара:</label>
                                <input type="text" id="editProductPageUrl" value="${product.product_page_url || ''}" 
                                       placeholder="https://example.com/product"
                                       style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px;">
                            </div>
                        </div>
                    </div>

                    <!-- Варианты товара -->
                    <div id="variantsSection" style="margin-top: 2rem; padding-top: 2rem; border-top: 2px solid #e5e7eb; ${product.display_only ? '' : 'display: none;'}">
                        <h3 style="color: var(--dandy-green); margin-bottom: 1rem; font-size: 1.1rem;">📐 Варианты товара (размеры)</h3>
                        <p style="color: #666; font-size: 0.9rem; margin-bottom: 1rem;">
                            Добавьте варианты товара с разными размерами и ценами (например: 25см, 30см, 42см для пиццы). Варианты доступны только для витринных карточек.
                        </p>
                        
                        <div id="variantsContainer" style="margin-bottom: 1rem;">
                            <p style="color: #666;">Загрузка вариантов...</p>
                        </div>

                        <button onclick="ProductCardsManager.addItemVariant('${product.id}')" 
                                style="padding: 0.75rem 1.5rem; background: #f3f4f6; color: var(--dandy-green); border: 2px dashed var(--dandy-green); border-radius: 8px; font-weight: 600; cursor: pointer;">
                            ➕ Добавить вариант
                        </button>
                    </div>

                    <!-- Рекомендуемые товары -->
                    <div style="margin-top: 2rem; padding-top: 2rem; border-top: 2px solid #e5e7eb;">
                        <h3 style="color: var(--dandy-green); margin-bottom: 1rem; font-size: 1.1rem;">🎯 Рекомендуемые товары (для upsell)</h3>
                        <p style="color: #666; font-size: 0.9rem; margin-bottom: 1rem;">
                            Выберите товары, которые будут рекомендованы вместе с этим товаром
                        </p>
                        
                        <div id="recommendedContainer" style="margin-bottom: 1rem;">
                            ${this.renderRecommendedEditor(product)}
                        </div>

                        <button onclick="ProductCardsManager.addRecommended()" 
                                style="padding: 0.75rem 1.5rem; background: #f3f4f6; color: var(--dandy-green); border: 2px dashed var(--dandy-green); border-radius: 8px; font-weight: 600; cursor: pointer;">
                            ➕ Добавить рекомендуемый товар
                        </button>
                    </div>

                    <div style="display: flex; gap: 1rem; margin-top: 2rem; padding-top: 2rem; border-top: 2px solid #e5e7eb;">
                        <button onclick="ProductCardsManager.saveEditedProduct('${product.id}')" 
                                style="flex: 1; padding: 1rem; background: var(--dandy-green); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 16px;">
                            💾 Сохранить изменения
                        </button>
                        <button onclick="this.closest('.modal-overlay').remove()" 
                                style="flex: 1; padding: 1rem; background: #6b7280; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                            ❌ Отмена
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.remove();
            });
        },

        // Сохранить отредактированный товар
        async saveEditedProduct(productId) {
            const name = document.getElementById('editProductName').value.trim();
            const sku = document.getElementById('editProductSku').value.trim();

            if (!name || !sku) {
                alert('Заполните обязательные поля: Название и SKU');
                return;
            }

            // Собираем выбранные категории
            const selectedCategories = Array.from(document.querySelectorAll('.edit-category-checkbox:checked'))
                .map(cb => cb.value);

            // Собираем варианты товара
            const variantItems = document.querySelectorAll('.variant-item');
            const variants = Array.from(variantItems)
                .map(item => ({
                    variant_id: item.getAttribute('data-variant-id') || `var-${Date.now()}-${Math.random()}`,
                name: item.querySelector('.variant-name').value.trim(),
                price: parseFloat(item.querySelector('.variant-price').value) || 0,
                stock: parseInt(item.querySelector('.variant-stock').value) || 0
                }))
                .filter(v => v.name);

            // Собираем рекомендуемые товары
            const recommendedItems = document.querySelectorAll('.recommended-item');
            const recommended = Array.from(recommendedItems)
                .map(item => item.getAttribute('data-product-id'))
                .filter(Boolean);

            const existingProduct = this.products.find(p => p.id === productId);
            const preservedAttrs = Array.isArray(existingProduct?.custom_attributes)
                ? existingProduct.custom_attributes.filter(attr => !['photo_mode', 'product_page_type', 'product_page_url', 'ingredients', 'allergens'].includes(attr.name))
                : [];

            const imageUrl = document.getElementById('editProductImage').value.trim();
            const photoMode = document.getElementById('editProductPhotoMode').value;
            const pageType = document.getElementById('editProductPageType').value;
            const pageUrl = document.getElementById('editProductPageUrl').value.trim();
            const ingredients = document.getElementById('editProductIngredients').value.trim();
            const allergens = document.getElementById('editProductAllergens').value.trim();

            const customAttributes = [...preservedAttrs];
            if (photoMode) customAttributes.push({ name: 'photo_mode', value: photoMode });
            if (pageType) customAttributes.push({ name: 'product_page_type', value: pageType });
            if (pageUrl) customAttributes.push({ name: 'product_page_url', value: pageUrl });
            if (ingredients) customAttributes.push({ name: 'ingredients', value: ingredients });
            if (allergens) customAttributes.push({ name: 'allergens', value: allergens });

            const variationsPayload = variants.map((variant, index) => ({
                variant_id: variant.variant_id || `var-${Date.now()}-${index}`,
                sku: `${sku}-var-${index + 1}`,
                price: variant.price,
                quantity: variant.stock,
                parameters: [{ name: 'Вариант', value: variant.name, display: 'list' }]
            }));

            const relatedProductsPayload = recommended.map((id, idx) => ({
                product_id: id,
                position: idx
            }));

            // Обрабатываем пустые значения
            const weightValue = document.getElementById('editProductWeight').value.trim();
            const caloriesValue = document.getElementById('editProductCalories').value.trim();
            const oldPriceValue = document.getElementById('editProductOldPrice').value.trim();
            const costValue = document.getElementById('editProductCost').value.trim();

            const fullDesc = document.getElementById('editProductFullDesc').value.trim();
            const shortDesc = document.getElementById('editProductShortDesc').value.trim();

            const displayOnly = document.getElementById('editProductDisplayOnly')?.checked || false;
            
            const payload = {
                name,
                sku,
                short_description: shortDesc,
                full_description: fullDesc,
                // для совместимости: часть кода/витрина использует поле description
                description: fullDesc,
                price: parseFloat(document.getElementById('editProductPrice').value) || 0,
                quantity: parseInt(document.getElementById('editProductStock').value) || 0,
                stock_quantity: parseInt(document.getElementById('editProductStock').value) || 0,
                visible_on_site: document.getElementById('editProductVisible').checked,
                hidden_for_promo: document.getElementById('editProductHiddenPromo').checked,
                display_only: displayOnly,
                category_ids: selectedCategories.map(id => String(id)),
                image_url: imageUrl
            };

            // Добавляем опциональные поля только если они заполнены
            if (oldPriceValue) {
                const oldPriceNum = parseFloat(oldPriceValue);
                if (!isNaN(oldPriceNum)) {
                    payload.old_price = oldPriceNum;
                }
            }
            if (costValue) {
                const costNum = parseFloat(costValue);
                if (!isNaN(costNum)) {
                    payload.cost = costNum;
                }
            }
            if (weightValue) {
                const weightNum = parseFloat(weightValue);
                payload.weight = isNaN(weightNum) ? weightValue : weightNum;
            }
            if (caloriesValue) {
                const caloriesNum = parseFloat(caloriesValue);
                payload.calories = isNaN(caloriesNum) ? caloriesValue : caloriesNum;
            }

            try {
                console.log('💾 Сохранение товара:', productId, payload);
                await this.catalogRequest(`/products/${encodeURIComponent(productId)}`, {
                    method: 'PUT',
                    body: payload
                });

                    alert('✅ Товар успешно обновлён!');
                    document.querySelector('.modal-overlay').remove();
                    await this.loadProducts();
                    await this.syncToWebsite(true);
            } catch (error) {
                console.error('Save product error:', error);
                alert(`❌ Ошибка при сохранении товара: ${error.message || 'Не удалось сохранить'}`);
            }
        },

        // Дублировать товар
        async duplicateProduct(productId) {
            if (!this.ensurePermission('product.create')) {
                return;
            }
            const product = this.products.find(p => p.id === productId);
            if (!product) return;

            if (!confirm(`Создать копию товара "${product.name}"?`)) {
                return;
            }

            try {
                const preservedAttrs = Array.isArray(product.custom_attributes)
                    ? product.custom_attributes.filter(attr => !['photo_mode', 'product_page_type', 'product_page_url'].includes(attr.name))
                    : [];
                const customAttributes = [...preservedAttrs];
                if (product.photo_mode) customAttributes.push({ name: 'photo_mode', value: product.photo_mode });
                if (product.product_page_type) customAttributes.push({ name: 'product_page_type', value: product.product_page_type });
                if (product.product_page_url) customAttributes.push({ name: 'product_page_url', value: product.product_page_url });

                const payload = {
                    name: `${product.name} (копия)`,
                    sku: `${product.sku}-copy-${Date.now()}`,
                    price: product.price,
                    old_price: product.old_price || null,
                    quantity: product.quantity || 0,
                    short_description: product.short_description || '',
                    description: product.description || '',
                    categories: Array.isArray(product.categories) ? product.categories : [],
                    is_visible: product.visible_on_site,
                    forbid_discounts: product.hidden_for_promo,
                    images: product.image_url ? [{ url: product.image_url, role: 'primary', alt_text: product.name }] : [],
                    variations: Array.isArray(product.variations)
                        ? product.variations.map((variant, idx) => ({
                            variant_id: variant.variant_id || `var-${Date.now()}-${idx}`,
                            sku: variant.sku || `${product.sku}-var-${idx + 1}`,
                            price: variant.price || 0,
                            quantity: variant.stock || 0,
                            parameters: [{ name: 'Вариант', value: variant.name || `Вариант ${idx + 1}`, display: 'list' }]
                        }))
                        : [],
                    related_products: Array.isArray(product.recommended_products)
                        ? product.recommended_products.map((id, idx) => ({ product_id: id, position: idx }))
                        : [],
                    custom_attributes: customAttributes
                };

                await this.catalogRequest('/products', { method: 'POST', body: payload });
                    alert('✅ Товар успешно скопирован');
                    await this.loadProducts();
                    await this.syncToWebsite(true);
            } catch (error) {
                console.error('Duplicate product error:', error);
                alert(`❌ Ошибка при копировании товара: ${error.message || 'Не удалось создать копию'}`);
            }
        },

        // Удалить товар
        async deleteProduct(productId) {
            if (!this.ensurePermission('product.delete')) {
                return;
            }
            
            // Приводим ID к строке для корректного сравнения
            const productIdStr = String(productId);
            const product = this.products.find(p => String(p.id) === productIdStr);
            
            if (!product) {
                console.warn('Товар не найден в локальном массиве:', productId, 'Доступные ID:', this.products.slice(0, 5).map(p => p.id));
                // Продолжаем удаление даже если товар не найден в локальном массиве
                // (возможно, он уже был удален или не загружен)
                if (!confirm(`⚠️ ВНИМАНИЕ!\n\nВы действительно хотите удалить товар с ID "${productId}"?\n\nЭто действие нельзя отменить!`)) {
                    return;
                }
            } else {
                if (!confirm(`⚠️ ВНИМАНИЕ!\n\nВы действительно хотите удалить товар "${product.name}"?\n\nЭто действие нельзя отменить!`)) {
                    return;
                }
            }

            try {
                console.log('🗑️ Удаление товара:', productId);
                const result = await this.catalogRequest(`/products/${encodeURIComponent(productId)}`, { method: 'DELETE' });
                
                // Проверяем результат - даже если товар не найден, API может вернуть success: true
                if (result && result.message && result.message.includes('not found')) {
                    console.log('ℹ️ Товар не найден на сервере, удаляем из локального списка');
                    // Удаляем из локального массива
                    this.products = this.products.filter(p => String(p.id) !== productIdStr);
                    this.renderProductsTable();
                    alert('✅ Товар удален из локального списка (не найден на сервере)');
                    return;
                }
                
                // Обновляем локальный список ДО перезагрузки с сервера
                this.products = this.products.filter(p => String(p.id) !== productIdStr);
                await this.syncToWebsite(false);
                
                // Перезагружаем список товаров для синхронизации
                await this.loadProducts();
                
                // Повторно убираем удаленный товар из списка (на случай если сервер еще не обновился)
                this.products = this.products.filter(p => String(p.id) !== productIdStr);
                this.renderProductsTable();
                
                console.log(`✅ Товар ${productId} удален через API`);
                alert('✅ Товар успешно удален');
            } catch (error) {
                console.error('Delete product error:', error);
                // Если ошибка связана с тем, что товар не найден, удаляем из локального списка
                if (error.message && (error.message.includes('not found') || error.message.includes('не найден'))) {
                    this.products = this.products.filter(p => String(p.id) !== productIdStr);
                    this.renderProductsTable();
                    alert('✅ Товар удален из локального списка (не найден на сервере)');
                } else {
                    alert(`❌ Ошибка при удалении товара: ${error.message || 'Не удалось удалить'}`);
                }
            }
        },

        // Отрисовка редактора вариантов
        renderVariantsEditor(product) {
            let variants = [];
            try {
                variants = product.variants ? 
                    (typeof product.variants === 'string' ? JSON.parse(product.variants) : product.variants) 
                    : [];
            } catch (e) {
                variants = [];
            }

            if (variants.length === 0) {
                return '<p style="color: #999; text-align: center; padding: 2rem;">Нет вариантов. Нажмите "➕ Добавить вариант"</p>';
            }

            return variants.map((variant, index) => `
                <div class="variant-item" data-index="${index}" data-variant-id="${variant.variant_id || ''}" style="background: #f9fafb; padding: 1rem; border-radius: 8px; margin-bottom: 0.75rem; border: 2px solid #e5e7eb;">
                    <div style="display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 1rem; align-items: center;">
                        <div>
                            <label style="display: block; margin-bottom: 0.25rem; font-size: 0.85rem; font-weight: 600; color: #666;">Название варианта:</label>
                            <input type="text" class="variant-name" value="${variant.name || ''}" 
                                   placeholder="Например: 25 см"
                                   style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 0.25rem; font-size: 0.85rem; font-weight: 600; color: #666;">Цена (₽):</label>
                            <input type="number" class="variant-price" value="${variant.price || 0}" step="0.01"
                                   style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 0.25rem; font-size: 0.85rem; font-weight: 600; color: #666;">Остаток:</label>
                            <input type="number" class="variant-stock" value="${variant.stock || 0}"
                                   style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px;">
                        </div>
                        <div style="padding-top: 1.5rem;">
                            <button onclick="ProductCardsManager.removeVariant(${index})"
                                    style="padding: 0.5rem 0.75rem; background: #dc2626; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">
                                🗑️
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        },

        buildVariantParametersFromProduct(product = {}) {
            if (Array.isArray(product.variant_parameters) && product.variant_parameters.length) {
                return product.variant_parameters.map((param) => ({
                    name: param.name || '',
                    values: Array.isArray(param.values) ? param.values.slice(0, 20) : []
                }));
            }
            const matrix = new Map();
            (product.variations || []).forEach((variant) => {
                (variant.parameters || []).forEach((param) => {
                    const key = param.name || 'Параметр';
                    if (!matrix.has(key)) {
                        matrix.set(key, new Set());
                    }
                    if (param.value) {
                        matrix.get(key).add(param.value);
                    }
                });
            });
            const result = Array.from(matrix.entries()).map(([name, values]) => ({
                name,
                values: Array.from(values).slice(0, 20)
            }));
            if (!result.length) {
                return [{ name: '', values: [] }];
            }
            return result;
        },

        renderVariantParametersSection() {
            return `
                <div style="border: 1px solid rgba(94,82,64,0.12); border-radius: 12px; padding: 12px; background: rgba(249,250,251,1);">
                    <div style="display:flex; gap: 8px; flex-wrap: wrap; align-items: flex-end; margin-bottom: 12px;">
                        <div style="flex: 1; min-width: 200px;">
                            <label style="font-size: 12px; color: rgba(75,85,99,1);">Сохранённые пресеты</label>
                            <select id="parameterPresetSelect" style="width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(209,213,219,1);">
                                ${this.renderPresetOptions()}
                            </select>
                        </div>
                        <button type="button" class="btn btn--secondary btn--sm" onclick="ProductCardsManager.applyParameterPreset()"
                                style="height: 36px;">📥 Загрузить</button>
                        <button type="button" class="btn btn--secondary btn--sm" onclick="ProductCardsManager.deleteParameterPreset()"
                                style="height: 36px;">🗑️ Удалить пресет</button>
                    </div>
                    <div id="variantParametersInner">
                        ${this.renderVariantParametersInner()}
                    </div>
                    <div style="display:flex; gap:8px; flex-wrap: wrap; margin-top: 12px;">
                        <button type="button" class="btn btn--secondary btn--sm" onclick="ProductCardsManager.addVariantParameterRow()">➕ Добавить параметр</button>
                        <button type="button" class="btn btn--secondary btn--sm" onclick="ProductCardsManager.saveCurrentParametersAsPreset()">💾 Сохранить как пресет</button>
                        <button type="button" class="btn btn--primary btn--sm" onclick="ProductCardsManager.generateVariantsFromParameters()">⚙️ Автогенерация вариаций</button>
                    </div>
                    <p style="font-size: 0.82rem; color: rgba(107,114,128,1); margin-top: 8px;">
                        Поддерживается до 5 параметров и до 20 значений на каждый. Максимум 200 комбинаций.
                    </p>
                </div>
            `;
        },

        renderVariantParametersInner() {
            if (!Array.isArray(this.variantParameters) || !this.variantParameters.length) {
                this.variantParameters = [{ name: '', values: [] }];
            }
            return this.variantParameters
                .map((param, index) => this.createVariantParameterRow(index, param))
                .join('');
        },

        renderPresetOptions() {
            const options = ['<option value="">Выберите пресет...</option>'];
            this.parameterPresets.forEach((preset) => {
                options.push(`<option value="${preset.id}">${this.escapeHtml(preset.name)}</option>`);
            });
            return options.join('');
        },

        createVariantParameterRow(index, param) {
            const valuesString = Array.isArray(param.values) ? param.values.join('\n') : '';
            return `
                <div class="variant-parameter-row" data-param-index="${index}" style="display:flex; gap: 12px; align-items:flex-start; margin-bottom: 12px;">
                    <div style="flex:1; min-width: 160px;">
                        <label style="display:block; font-size: 12px; color: rgba(75,85,99,1); margin-bottom: 4px;">Название параметра</label>
                        <input type="text" value="${this.escapeHtml(param.name || '')}"
                               oninput="ProductCardsManager.updateVariantParameterName(${index}, this.value)"
                               placeholder="Например: Размер" style="width:100%; padding:8px 10px; border-radius: 8px; border:1px solid rgba(209,213,219,1);">
                    </div>
                    <div style="flex:2;">
                        <label style="display:block; font-size: 12px; color: rgba(75,85,99,1); margin-bottom: 4px;">Значения (каждое с новой строки)</label>
                        <textarea rows="3" oninput="ProductCardsManager.updateVariantParameterValues(${index}, this.value)"
                                  style="width:100%; padding:8px 10px; border-radius: 8px; border:1px solid rgba(209,213,219,1);">${this.escapeHtml(valuesString)}</textarea>
                    </div>
                    <button type="button" class="btn btn--danger btn--sm" onclick="ProductCardsManager.removeVariantParameterRow(${index})"
                            style="height: 36px; margin-top: 22px;">🗑️</button>
                </div>
            `;
        },

        rerenderVariantParameters() {
            const container = document.getElementById('variantParametersInner');
            if (container) {
                container.innerHTML = this.renderVariantParametersInner();
            }
        },

        updateVariantParameterName(index, value) {
            if (!this.variantParameters[index]) return;
            this.variantParameters[index].name = value;
            this.markDraftDirty();
        },

        updateVariantParameterValues(index, rawValue) {
            if (!this.variantParameters[index]) return;
            const values = rawValue
                .split(/[\n,]+/)
                .map((value) => value.trim())
                .filter(Boolean)
                .slice(0, 20);
            this.variantParameters[index].values = values;
            this.markDraftDirty();
        },

        addVariantParameterRow() {
            if (!Array.isArray(this.variantParameters)) {
                this.variantParameters = [];
            }
            if (this.variantParameters.length >= 5) {
                alert('Максимум 5 параметров для автогенерации');
                return;
            }
            this.variantParameters.push({ name: '', values: [] });
            this.rerenderVariantParameters();
            this.markDraftDirty();
        },

        removeVariantParameterRow(index) {
            if (!Array.isArray(this.variantParameters)) return;
            this.variantParameters.splice(index, 1);
            if (!this.variantParameters.length) {
                this.variantParameters.push({ name: '', values: [] });
            }
            this.rerenderVariantParameters();
            this.markDraftDirty();
        },

        getCleanVariantParameters() {
            if (!Array.isArray(this.variantParameters)) return [];
            return this.variantParameters
                .map((param) => ({
                    name: (param.name || '').trim(),
                    values: (param.values || []).map((value) => (value || '').trim()).filter(Boolean)
                }))
                .filter((param) => param.name && param.values.length);
        },

        applyParameterPreset() {
            const select = document.getElementById('parameterPresetSelect');
            if (!select || !select.value) {
                alert('Выберите пресет для загрузки');
                return;
            }
            const preset = this.parameterPresets.find((item) => item.id === select.value);
            if (!preset) {
                alert('Пресет не найден');
                return;
            }
            this.variantParameters = preset.parameters.map((param) => ({
                name: param.name || '',
                values: Array.isArray(param.values) ? param.values.slice(0, 20) : []
            }));
            this.rerenderVariantParameters();
            this.markDraftDirty();
        },

        async deleteParameterPreset() {
            const select = document.getElementById('parameterPresetSelect');
            if (!select || !select.value) {
                alert('Выберите пресет для удаления');
                return;
            }
            if (!confirm('Удалить выбранный пресет параметров?')) {
                return;
            }
            try {
                await this.catalogRequest(`/products/presets/${encodeURIComponent(select.value)}`, {
                    method: 'DELETE'
                });
                await this.loadParameterPresets();
                this.updatePresetSelectOptions();
                alert('Пресет удалён');
            } catch (error) {
                console.error('Удаление пресета:', error);
                alert(`❌ Ошибка удаления пресета: ${error.message}`);
            }
        },

        async saveCurrentParametersAsPreset() {
            const cleanParams = this.getCleanVariantParameters();
            if (!cleanParams.length) {
                alert('Добавьте хотя бы один параметр с значениями для сохранения пресета');
                return;
            }
            const name = prompt('Название пресета', 'Размеры');
            if (!name) return;
            try {
                await this.catalogRequest('/products/presets', {
                    method: 'POST',
                    body: {
                        name,
                        parameters: cleanParams
                    }
                });
                await this.loadParameterPresets();
                this.updatePresetSelectOptions();
                alert('Пресет сохранён');
            } catch (error) {
                console.error('Сохранение пресета:', error);
                alert(`❌ Не удалось сохранить пресет: ${error.message}`);
            }
        },

        generateVariantsFromParameters() {
            const params = this.getCleanVariantParameters();
            if (!params.length) {
                alert('Добавьте параметры и значения для автогенерации');
                return;
            }
            if (params.length > 5) {
                alert('Допускается не более 5 параметров');
                return;
            }
            const totalCombinations = params.reduce((acc, param) => acc * param.values.length, 1);
            if (totalCombinations === 0) {
                alert('Добавьте значения для каждого параметра');
                return;
            }
            if (totalCombinations > 200) {
                alert(`Слишком много комбинаций (${totalCombinations}). Ограничьте параметры или значения.`);
                return;
            }
            const combinations = [];
            const traverse = (depth, current) => {
                if (depth === params.length) {
                    combinations.push(current.slice());
                    return;
                }
                params[depth].values.forEach((value) => {
                    current.push({ name: params[depth].name, value });
                    traverse(depth + 1, current);
                    current.pop();
                });
            };
            traverse(0, []);
            const generated = combinations.map((combo, idx) => ({
                variant_id: `auto_${Date.now()}_${idx}`,
                name: combo.map((entry) => entry.value).join(' / '),
                price: 0,
                stock: 0,
                parameters: combo.map((entry) => ({
                    name: entry.name,
                    value: entry.value,
                    display: 'list'
                }))
            }));
            const container = document.getElementById('variantsContainer');
            if (container) {
                container.innerHTML = this.renderVariantsEditor({ variants: generated });
            }
            this.markDraftDirty();
            alert(`Сгенерировано ${generated.length} вариаций`);
        },

        updatePresetSelectOptions() {
            const select = document.getElementById('parameterPresetSelect');
            if (!select) return;
            select.innerHTML = this.renderPresetOptions();
        },

        // Отрисовка редактора рекомендуемых товаров
        renderRecommendedEditor(product) {
            const recommended = Array.isArray(product.recommended_products)
                ? product.recommended_products
                : [];

            if (recommended.length === 0) {
                return '<p style="color: #999; text-align: center; padding: 2rem;">Нет рекомендуемых товаров. Нажмите "➕ Добавить"</p>';
            }

            return recommended.map((productId, index) => {
                const recommendedProduct = this.products.find(p => p.id === productId);
                const productName = recommendedProduct ? recommendedProduct.name : 'Товар не найден';
                const productImage = recommendedProduct?.image_url || '';

                return `
                    <div class="recommended-item" data-index="${index}" style="background: #f9fafb; padding: 1rem; border-radius: 8px; margin-bottom: 0.75rem; border: 2px solid #e5e7eb; display: flex; align-items: center; gap: 1rem;">
                        ${productImage ? `<img src="${productImage}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px;">` : '<div style="width: 50px; height: 50px; background: #e5e7eb; border-radius: 6px;"></div>'}
                        <div style="flex: 1;">
                            <div style="font-weight: 600;">${productName}</div>
                            <div style="font-size: 0.85rem; color: #666;">ID: ${productId}</div>
                        </div>
                        <button onclick="ProductCardsManager.removeRecommended(${index})"
                                style="padding: 0.5rem 0.75rem; background: #dc2626; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">
                            🗑️ Удалить
                        </button>
                    </div>
                `;
            }).join('');
        },

        // Добавить вариант товара
        addVariant() {
            const container = document.getElementById('variantsContainer');
            const currentVariants = container.querySelectorAll('.variant-item');
            const newIndex = currentVariants.length;

            const newVariantId = `var-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
            const newVariantHtml = `
                <div class="variant-item" data-index="${newIndex}" data-variant-id="${newVariantId}" style="background: #f9fafb; padding: 1rem; border-radius: 8px; margin-bottom: 0.75rem; border: 2px solid #e5e7eb;">
                    <div style="display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 1rem; align-items: center;">
                        <div>
                            <label style="display: block; margin-bottom: 0.25rem; font-size: 0.85rem; font-weight: 600; color: #666;">Название варианта:</label>
                            <input type="text" class="variant-name" value="" 
                                   placeholder="Например: 25 см"
                                   style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 0.25rem; font-size: 0.85rem; font-weight: 600; color: #666;">Цена (₽):</label>
                            <input type="number" class="variant-price" value="0" step="0.01"
                                   style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px;">
                        </div>
                        <div>
                            <label style="display: block; margin-bottom: 0.25rem; font-size: 0.85rem; font-weight: 600; color: #666;">Остаток:</label>
                            <input type="number" class="variant-stock" value="0"
                                   style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px;">
                        </div>
                        <div style="padding-top: 1.5rem;">
                            <button onclick="ProductCardsManager.removeVariant(${newIndex})"
                                    style="padding: 0.5rem 0.75rem; background: #dc2626; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">
                                🗑️
                            </button>
                        </div>
                    </div>
                </div>
            `;

            if (container.querySelector('p')) {
                container.innerHTML = newVariantHtml;
            } else {
                container.insertAdjacentHTML('beforeend', newVariantHtml);
            }
        },

        // Удалить вариант товара
        removeVariant(index) {
            const container = document.getElementById('variantsContainer');
            const variants = container.querySelectorAll('.variant-item');
            
            if (variants[index]) {
                variants[index].remove();
            }

            // Если вариантов не осталось, показываем заглушку
            if (container.querySelectorAll('.variant-item').length === 0) {
                container.innerHTML = '<p style="color: #999; text-align: center; padding: 2rem;">Нет вариантов. Нажмите "➕ Добавить вариант"</p>';
            }
        },

        // Добавить рекомендуемый товар
        addRecommended() {
            // Создаём модальное окно выбора товара
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.7); display: flex; align-items: center;
                justify-content: center; z-index: 10001;
            `;

            const productsOptions = this.products.map(p => `
                <div onclick="ProductCardsManager.selectRecommendedProduct('${p.id}')" 
                     style="display: flex; align-items: center; gap: 1rem; padding: 0.75rem; background: white; border-radius: 8px; cursor: pointer; border: 2px solid #e5e7eb; margin-bottom: 0.5rem; transition: all 0.2s;"
                     onmouseover="this.style.borderColor='var(--dandy-green)'; this.style.background='#f0f9ff';"
                     onmouseout="this.style.borderColor='#e5e7eb'; this.style.background='white';">
                    ${p.image_url ? `<img src="${p.image_url}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px;">` : '<div style="width: 50px; height: 50px; background: #f3f4f6; border-radius: 6px;"></div>'}
                    <div style="flex: 1;">
                        <div style="font-weight: 600;">${p.name}</div>
                        <div style="font-size: 0.85rem; color: #666;">${p.price} ₽</div>
                    </div>
                </div>
            `).join('');

            modal.innerHTML = `
                <div style="background: white; border-radius: 16px; padding: 2rem; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
                    <h2 style="margin: 0 0 1.5rem 0; color: var(--dandy-green);">🎯 Выбор рекомендуемого товара</h2>
                    
                    <div style="margin-bottom: 1rem;">
                        <input type="text" id="searchRecommended" placeholder="🔍 Поиск товара..." 
                               oninput="ProductCardsManager.filterRecommendedProducts(this.value)"
                               style="width: 100%; padding: 0.75rem; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px;">
                    </div>

                    <div id="recommendedProductsList" style="max-height: 400px; overflow-y: auto;">
                        ${productsOptions}
                    </div>

                    <button onclick="this.closest('.modal-overlay').remove()" 
                            style="width: 100%; margin-top: 1rem; padding: 1rem; background: #6b7280; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                        ❌ Отмена
                    </button>
                </div>
            `;

            document.body.appendChild(modal);
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.remove();
            });
        },

        // Фильтрация рекомендуемых товаров при поиске
        filterRecommendedProducts(searchTerm) {
            const list = document.getElementById('recommendedProductsList');
            const items = list.querySelectorAll('div[onclick]');
            
            items.forEach(item => {
                const text = item.textContent.toLowerCase();
                if (text.includes(searchTerm.toLowerCase())) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        },

        // Выбрать рекомендуемый товар
        selectRecommendedProduct(productId) {
            const container = document.getElementById('recommendedContainer');
            const product = this.products.find(p => p.id === productId);
            
            if (!product) return;

            const newRecommendedHtml = `
                <div class="recommended-item" data-product-id="${productId}" style="background: #f9fafb; padding: 1rem; border-radius: 8px; margin-bottom: 0.75rem; border: 2px solid #e5e7eb; display: flex; align-items: center; gap: 1rem;">
                    ${product.image_url ? `<img src="${product.image_url}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px;">` : '<div style="width: 50px; height: 50px; background: #e5e7eb; border-radius: 6px;"></div>'}
                    <div style="flex: 1;">
                        <div style="font-weight: 600;">${product.name}</div>
                        <div style="font-size: 0.85rem; color: #666;">ID: ${productId}</div>
                    </div>
                    <button onclick="ProductCardsManager.removeRecommendedByElement(this)"
                            style="padding: 0.5rem 0.75rem; background: #dc2626; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem;">
                        🗑️ Удалить
                    </button>
                </div>
            `;

            if (container.querySelector('p')) {
                container.innerHTML = newRecommendedHtml;
            } else {
                container.insertAdjacentHTML('beforeend', newRecommendedHtml);
            }

            // Закрываем модальное окно
            document.querySelector('.modal-overlay').remove();
        },

        // Удалить рекомендуемый товар по индексу
        removeRecommended(index) {
            const container = document.getElementById('recommendedContainer');
            const items = container.querySelectorAll('.recommended-item');
            
            if (items[index]) {
                items[index].remove();
            }

            // Если товаров не осталось, показываем заглушку
            if (container.querySelectorAll('.recommended-item').length === 0) {
                container.innerHTML = '<p style="color: #999; text-align: center; padding: 2rem;">Нет рекомендуемых товаров. Нажмите "➕ Добавить"</p>';
            }
        },

        // Удалить рекомендуемый товар по элементу
        removeRecommendedByElement(button) {
            const item = button.closest('.recommended-item');
            const container = document.getElementById('recommendedContainer');
            
            if (item) {
                item.remove();
            }

            // Если товаров не осталось, показываем заглушку
            if (container.querySelectorAll('.recommended-item').length === 0) {
                container.innerHTML = '<p style="color: #999; text-align: center; padding: 2rem;">Нет рекомендуемых товаров. Нажмите "➕ Добавить"</p>';
            }
        },

        // Показать окно массовой загрузки фото
        showBulkPhotoUpload() {
            if (!this.ensurePermission('product.update')) {
                return;
            }
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.7); display: flex; align-items: center;
                justify-content: center; z-index: 10000; padding: 1rem;
            `;

            modal.innerHTML = `
                <div style="background: white; border-radius: 16px; padding: 2rem; max-width: 800px; width: 95%; max-height: 90vh; overflow-y: auto;">
                    <h2 style="margin: 0 0 1.5rem 0; color: var(--dandy-green); display: flex; align-items: center; gap: 0.5rem;">
                        📸 Массовая загрузка фото
                    </h2>

                    <div style="margin-bottom: 1.5rem;">
                        <h3 style="color: var(--dandy-green); margin-bottom: 1rem; font-size: 1.1rem;">Выберите режим фото:</h3>
                        <div style="display: flex; gap: 1rem;">
                            <label style="flex: 1; display: flex; align-items: center; gap: 0.5rem; padding: 1rem; background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 8px; cursor: pointer;">
                                <input type="radio" name="photoMode" value="with_background" checked style="width: 20px; height: 20px;">
                                <div>
                                    <div style="font-weight: 600;">С фоном</div>
                                    <div style="font-size: 0.85rem; color: #666;">Обычные фото товаров</div>
                                </div>
                            </label>
                            <label style="flex: 1; display: flex; align-items: center; gap: 0.5rem; padding: 1rem; background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 8px; cursor: pointer;">
                                <input type="radio" name="photoMode" value="no_background" style="width: 20px; height: 20px;">
                                <div>
                                    <div style="font-weight: 600;">Без фона (PNG)</div>
                                    <div style="font-size: 0.85rem; color: #666;">Прозрачный фон для каталога</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div style="margin-bottom: 1.5rem;">
                        <h3 style="color: var(--dandy-green); margin-bottom: 1rem; font-size: 1.1rem;">Выберите файлы:</h3>
                        <div id="dropZone" style="border: 3px dashed var(--dandy-green); border-radius: 12px; padding: 3rem; text-align: center; cursor: pointer; background: #f9fafb; transition: all 0.3s;"
                             onclick="document.getElementById('bulkPhotoInput').click()"
                             ondragover="event.preventDefault(); this.style.background='#e0f2f1'; this.style.borderColor='var(--dandy-pink)';"
                             ondragleave="this.style.background='#f9fafb'; this.style.borderColor='var(--dandy-green)';"
                             ondrop="ProductCardsManager.handlePhotoDrop(event)">
                            <div style="font-size: 3rem; margin-bottom: 1rem;">📷</div>
                            <div style="font-size: 1.2rem; font-weight: 600; margin-bottom: 0.5rem;">Перетащите файлы сюда</div>
                            <div style="color: #666; margin-bottom: 1rem;">или нажмите для выбора</div>
                            <div style="font-size: 0.85rem; color: #999;">
                                Поддерживаются форматы: JPG, PNG, WEBP<br>
                                Имена файлов должны совпадать с SKU товаров
                            </div>
                        </div>
                        <input type="file" id="bulkPhotoInput" multiple accept="image/*" 
                               onchange="ProductCardsManager.handlePhotoSelect(event)"
                               style="display: none;">
                    </div>

                    <div id="photoPreviewList" style="margin-bottom: 1.5rem; max-height: 300px; overflow-y: auto;"></div>

                    <div style="display: flex; gap: 1rem;">
                        <button onclick="ProductCardsManager.uploadBulkPhotos()" 
                                id="uploadPhotosBtn"
                                style="flex: 1; padding: 1rem; background: var(--dandy-green); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 16px;"
                                disabled>
                            📤 Загрузить фото
                        </button>
                        <button onclick="this.closest('.modal-overlay').remove()" 
                                style="flex: 1; padding: 1rem; background: #6b7280; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                            ❌ Отмена
                        </button>
                    </div>

                    <div style="margin-top: 1rem; padding: 1rem; background: #fef3c7; border-radius: 8px;">
                        <div style="font-weight: 600; margin-bottom: 0.5rem;">💡 Инструкция:</div>
                        <ol style="margin: 0; padding-left: 1.5rem; font-size: 0.9rem;">
                            <li>Назовите файлы по SKU товаров (например: <code>SKU-001.jpg</code>)</li>
                            <li>Выберите режим фото (с фоном или без)</li>
                            <li>Загрузите файлы (drag & drop или выбор)</li>
                            <li>Проверьте соответствие и нажмите "Загрузить"</li>
                        </ol>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.remove();
            });

            // Инициализируем переменные для хранения файлов
            this.selectedPhotos = [];
        },

        // Обработка drag & drop
        handlePhotoDrop(event) {
            event.preventDefault();
            const dropZone = event.currentTarget;
            dropZone.style.background = '#f9fafb';
            dropZone.style.borderColor = 'var(--dandy-green)';
            
            const files = Array.from(event.dataTransfer.files).filter(file => 
                file.type.startsWith('image/')
            );
            
            this.processPhotoFiles(files);
        },

        // Обработка выбора файлов
        handlePhotoSelect(event) {
            const files = Array.from(event.target.files);
            this.processPhotoFiles(files);
        },

        // Обработка файлов фото
        processPhotoFiles(files) {
            this.selectedPhotos = files;
            
            const previewList = document.getElementById('photoPreviewList');
            const uploadBtn = document.getElementById('uploadPhotosBtn');
            
            if (files.length === 0) {
                previewList.innerHTML = '';
                uploadBtn.disabled = true;
                return;
            }

            uploadBtn.disabled = false;

            let html = '<h3 style="color: var(--dandy-green); margin-bottom: 1rem;">Выбранные файлы:</h3>';
            
            files.forEach((file, index) => {
                // Извлекаем SKU из имени файла
                const fileName = file.name.split('.')[0];
                const matchingProduct = this.products.find(p => 
                    p.sku && p.sku.toLowerCase() === fileName.toLowerCase()
                );

                html += `
                    <div style="display: flex; align-items: center; gap: 1rem; padding: 0.75rem; background: ${matchingProduct ? '#d1fae5' : '#fef2f2'}; border-radius: 8px; margin-bottom: 0.5rem; border: 2px solid ${matchingProduct ? '#10b981' : '#ef4444'};">
                        <div style="font-size: 2rem;">${matchingProduct ? '✅' : '❌'}</div>
                        <div style="flex: 1;">
                            <div style="font-weight: 600;">${file.name}</div>
                            <div style="font-size: 0.85rem; color: #666;">
                                ${matchingProduct ? `Товар: ${matchingProduct.name}` : 'Товар не найден! Проверьте SKU'}
                            </div>
                        </div>
                        <div style="font-size: 0.85rem; color: #666;">
                            ${(file.size / 1024).toFixed(2)} KB
                        </div>
                    </div>
                `;
            });

            previewList.innerHTML = html;
        },

        // Загрузить фото
        async uploadBulkPhotos() {
            if (!this.ensurePermission('product.update')) {
                return;
            }
            if (!this.selectedPhotos || this.selectedPhotos.length === 0) {
                alert('Выберите файлы для загрузки');
                return;
            }

            const photoMode = document.querySelector('input[name="photoMode"]:checked').value;
            const uploadBtn = document.getElementById('uploadPhotosBtn');
            
            uploadBtn.disabled = true;
            uploadBtn.textContent = '⏳ Загрузка...';

            try {
                let uploaded = 0;
                let failed = 0;

                for (const file of this.selectedPhotos) {
                    const fileName = file.name.split('.')[0];
                    const product = this.products.find(p => 
                        p.sku && p.sku.toLowerCase() === fileName.toLowerCase()
                    );

                    if (!product) {
                        failed++;
                        continue;
                    }

                    // В реальной реализации здесь был бы FormData и загрузка на сервер
                    // Для демонстрации просто создаём URL и обновляем товар
                    const imageUrl = URL.createObjectURL(file);

                    try {
                        const existingAttrs = Array.isArray(product.custom_attributes) ? product.custom_attributes.filter(attr => attr.name !== 'photo_mode') : [];
                        const customAttributes = [...existingAttrs, { name: 'photo_mode', value: photoMode }];
                        await this.patchProduct(product.id, {
                            image_url: imageUrl,
                            images: [{ url: imageUrl, role: 'primary', alt_text: product.name }],
                            custom_attributes: customAttributes
                        });
                        uploaded++;
                    } catch (error) {
                        console.warn('Photo patch failed', error);
                        failed++;
                    }
                }

                alert(`✅ Загрузка завершена!\n\n` +
                      `Успешно: ${uploaded}\n` +
                      `Ошибок: ${failed}\n\n` +
                      `💡 В продакшн-версии фото будут загружаться на сервер`);

                document.querySelector('.modal-overlay').remove();
                await this.loadProducts();

            } catch (error) {
                console.error('Bulk photo upload error:', error);
                alert('❌ Ошибка при загрузке фото');
            } finally {
                uploadBtn.disabled = false;
                uploadBtn.textContent = '📤 Загрузить фото';
            }
        },

        // Модальное окно добавления товара
        showAddProductModal() {
            if (!this.ensurePermission('product.create')) {
                return;
            }
            return this.openProductWizard({ mode: 'create' });
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999; overflow-y: auto; padding: 2rem;';
            modal.innerHTML = `
                <div style="background: white; border-radius: 20px; padding: 2.5rem; max-width: 800px; width: 100%; max-height: 90vh; overflow-y: auto; position: relative; box-shadow: 0 20px 60px rgba(0,0,0,0.3); margin: auto;">
                    <button onclick="this.closest('.modal-overlay').remove()" 
                            style="position: absolute; top: 1.5rem; right: 1.5rem; background: #f0f0f0; border: none; font-size: 1.5rem; cursor: pointer; color: #666; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease;" onmouseover="this.style.background='#e0e0e0'" onmouseout="this.style.background='#f0f0f0'">&times;</button>
                    
                    <h2 style="color: var(--dandy-green); margin-bottom: 2rem; font-size: 1.8rem; font-weight: 700;">➕ Добавить новый товар</h2>
                    
                    <form id="addProductForm" style="display: grid; gap: 1.5rem;">
                        <!-- Основная информация -->
                        <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 12px;">
                            <h3 style="margin-bottom: 1rem; font-size: 1.1rem; color: var(--dandy-green);">📝 Основная информация</h3>
                            
                            <div style="display: grid; gap: 1rem;">
                                <div class="form-group">
                                    <label class="form-label" style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333;">Название товара *</label>
                                    <input type="text" id="productName" style="width: 100%; padding: 0.75rem; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 1rem; transition: all 0.3s;" placeholder="Введите название товара" required onfocus="this.style.borderColor='var(--dandy-green)'" onblur="this.style.borderColor='#e0e0e0'">
                                </div>
                                
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                    <div class="form-group">
                                        <label class="form-label" style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333;">SKU *</label>
                                        <input type="text" id="productSku" style="width: 100%; padding: 0.75rem; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 1rem;" placeholder="SKU-000" required onfocus="this.style.borderColor='var(--dandy-green)'" onblur="this.style.borderColor='#e0e0e0'">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label" style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333;">Остаток на складе</label>
                                        <input type="number" id="productStock" style="width: 100%; padding: 0.75rem; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 1rem;" placeholder="0" min="0" onfocus="this.style.borderColor='var(--dandy-green)'" onblur="this.style.borderColor='#e0e0e0'">
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Категории -->
                        <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 12px;">
                            <h3 style="margin-bottom: 1rem; font-size: 1.1rem; color: var(--dandy-green);">🗂️ Категории</h3>
                            <div id="categorySelect" style="display: flex; flex-wrap: wrap; gap: 0.75rem;">
                                ${this.categories.map(cat => `
                                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; background: white; padding: 0.5rem 1rem; border-radius: 8px; border: 2px solid #e0e0e0; transition: all 0.3s;" onmouseover="this.style.borderColor='var(--dandy-green)'" onmouseout="if(!this.querySelector('input').checked) this.style.borderColor='#e0e0e0'">
                                        <input type="checkbox" value="${cat.id}" class="category-checkbox" style="cursor: pointer;" onchange="this.closest('label').style.borderColor=this.checked?'var(--dandy-green)':'#e0e0e0'; this.closest('label').style.background=this.checked?'#e8f5f3':'white'">
                                        <span style="font-size: 0.95rem; font-weight: 500;">${cat.name}</span>
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                        
                        <!-- Цены -->
                        <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 12px;">
                            <h3 style="margin-bottom: 1rem; font-size: 1.1rem; color: var(--dandy-green);">💰 Цены и стоимость</h3>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                <div class="form-group">
                                    <label class="form-label" style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333;">Цена (₽)</label>
                                    <input type="number" id="productPrice" style="width: 100%; padding: 0.75rem; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 1rem;" placeholder="0" min="0" step="0.01" onfocus="this.style.borderColor='var(--dandy-green)'" onblur="this.style.borderColor='#e0e0e0'">
                                </div>
                                <div class="form-group">
                                    <label class="form-label" style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333;">Себестоимость (₽)</label>
                                    <input type="number" id="productCost" style="width: 100%; padding: 0.75rem; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 1rem;" placeholder="0" min="0" step="0.01" onfocus="this.style.borderColor='var(--dandy-green)'" onblur="this.style.borderColor='#e0e0e0'">
                                </div>
                            </div>
                        </div>
                        
                        <!-- Описание -->
                        <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 12px;">
                            <h3 style="margin-bottom: 1rem; font-size: 1.1rem; color: var(--dandy-green);">📄 Описание</h3>
                            <div style="display: grid; gap: 1rem;">
                                <div class="form-group">
                                    <label class="form-label" style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333;">Краткое описание</label>
                                    <textarea id="productShortDesc" style="width: 100%; padding: 0.75rem; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 1rem; font-family: inherit; resize: vertical;" rows="2" placeholder="Краткое описание товара" onfocus="this.style.borderColor='var(--dandy-green)'" onblur="this.style.borderColor='#e0e0e0'"></textarea>
                                </div>
                                <div class="form-group">
                                    <label class="form-label" style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333;">Полное описание</label>
                                    <textarea id="productFullDesc" style="width: 100%; padding: 0.75rem; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 1rem; font-family: inherit; resize: vertical;" rows="3" placeholder="Подробное описание товара" onfocus="this.style.borderColor='var(--dandy-green)'" onblur="this.style.borderColor='#e0e0e0'"></textarea>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Дополнительно -->
                        <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 12px;">
                            <h3 style="margin-bottom: 1rem; font-size: 1.1rem; color: var(--dandy-green);">ℹ️ Дополнительно</h3>
                            <div style="display: grid; gap: 1rem;">
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                    <div class="form-group">
                                        <label class="form-label" style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333;">Вес/Размер</label>
                                        <input type="text" id="productWeight" style="width: 100%; padding: 0.75rem; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 1rem;" placeholder="500г, 30см" onfocus="this.style.borderColor='var(--dandy-green)'" onblur="this.style.borderColor='#e0e0e0'">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label" style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333;">Калории</label>
                                        <input type="number" id="productCalories" style="width: 100%; padding: 0.75rem; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 1rem;" placeholder="0" min="0" onfocus="this.style.borderColor='var(--dandy-green)'" onblur="this.style.borderColor='#e0e0e0'">
                                    </div>
                                </div>
                                <div class="form-group">
                                    <label class="form-label" style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #333;">URL изображения</label>
                                    <input type="url" id="productImageUrl" style="width: 100%; padding: 0.75rem; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 1rem;" placeholder="https://example.com/image.jpg" onfocus="this.style.borderColor='var(--dandy-green)'" onblur="this.style.borderColor='#e0e0e0'">
                                </div>
                            </div>
                        </div>
                        
                        <!-- Настройки видимости -->
                        <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 12px;">
                            <h3 style="margin-bottom: 1rem; font-size: 1.1rem; color: var(--dandy-green);">👁️ Видимость</h3>
                            <div style="display: flex; gap: 1.5rem;">
                                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-weight: 500;">
                                    <input type="checkbox" id="productVisible" checked style="width: 18px; height: 18px; cursor: pointer;">
                                    <span>Видим на сайте</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-weight: 500;">
                                    <input type="checkbox" id="productHiddenForPromo" style="width: 18px; height: 18px; cursor: pointer;">
                                    <span>Скрыт для акций</span>
                                </label>
                            </div>
                        </div>
                        
                        <!-- Кнопки -->
                        <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1rem; padding-top: 1.5rem; border-top: 2px solid #e0e0e0;">
                            <button type="button" onclick="this.closest('.modal-overlay').remove()" 
                                    style="padding: 0.75rem 2rem; border: 2px solid #ccc; border-radius: 10px; font-size: 1rem; font-weight: 600; cursor: pointer; background: white; color: #666; transition: all 0.3s;" onmouseover="this.style.background='#f0f0f0'" onmouseout="this.style.background='white'">❌ Отмена</button>
                            <button type="submit" style="padding: 0.75rem 2rem; border: none; border-radius: 10px; font-size: 1rem; font-weight: 600; cursor: pointer; background: var(--dandy-green); color: white; transition: all 0.3s; box-shadow: 0 4px 12px rgba(4, 116, 108, 0.3);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(4, 116, 108, 0.4)'" onmouseout="this.style.transform=''; this.style.boxShadow='0 4px 12px rgba(4, 116, 108, 0.3)'">
                                💾 Сохранить товар
                            </button>
                        </div>
                    </form>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Обработчик формы
            document.getElementById('addProductForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const nameValue = document.getElementById('productName').value.trim();
                const skuValue = document.getElementById('productSku').value.trim();
                
                if (!nameValue || !skuValue) {
                    alert('❌ Пожалуйста, заполните обязательные поля: Название и SKU');
                    return;
                }
                
                const imageUrl = document.getElementById('productImageUrl').value.trim();
                const payload = {
                    name: nameValue,
                    sku: skuValue,
                    price: parseFloat(document.getElementById('productPrice').value) || 0,
                    purchase_price: parseFloat(document.getElementById('productCost').value) || null,
                    quantity: parseInt(document.getElementById('productStock').value) || 0,
                    short_description: document.getElementById('productShortDesc').value.trim(),
                    description: document.getElementById('productFullDesc').value.trim(),
                    weight: parseFloat(document.getElementById('productWeight').value) || null,
                    calories: parseFloat(document.getElementById('productCalories').value) || null,
                    image_url: imageUrl,
                    images: imageUrl ? [{ url: imageUrl, role: 'primary', alt_text: nameValue }] : [],
                    categories: Array.from(document.querySelectorAll('.category-checkbox:checked')).map(cb => cb.value),
                    is_visible: document.getElementById('productVisible').checked,
                    forbid_discounts: document.getElementById('productHiddenForPromo').checked
                };
                
                try {
                    await this.catalogRequest('/products', { method: 'POST', body: payload });
                        alert('✅ Товар успешно создан!');
                        modal.remove();
                        await this.loadProducts();
                        await this.syncToWebsite(true);
                } catch (error) {
                    console.error('Create product error:', error);
                    alert(`❌ Ошибка при создании товара: ${error.message || 'Неизвестная ошибка'}`);
                }
            });
            
            // Закрытие по клику вне модала
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
        },

        // Модальное окно импорта CSV/YML
        showImportModal() {
            if (!this.ensurePermission('product.import')) {
                return;
            }
            this.resetImportJobState();
            // Удаляем существующие модальные окна
            const existingModals = document.querySelectorAll('.modal-overlay');
            existingModals.forEach(modal => modal.remove());
            
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content large">
                    <div class="modal-header">
                        <h3>📥 Импорт товаров</h3>
                        <button class="modal-close">×</button>
                    </div>
                    <div class="modal-body">
                        <!-- Выбор файла -->
                        <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem;">
                            <h3 style="margin-bottom: 1rem; font-size: 1.1rem; color: var(--dandy-green);">📂 Выбор файла</h3>
                            <input type="file" id="importFile" accept=".csv,.yml,.xml" style="display: none;">
                            <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
                                <button onclick="document.getElementById('importFile').click()" 
                                        class="btn btn-primary" 
                                        style="background: var(--dandy-green); color: #fff; border: none; padding: 0.75rem 1.5rem; border-radius: 10px; cursor: pointer; font-size: 1rem; font-weight: 600; transition: all 0.3s; box-shadow: 0 2px 8px rgba(4, 116, 108, 0.3);" 
                                        onmouseover="this.style.transform='translateY(-2px)'" 
                                        onmouseout="this.style.transform=''">
                                    🗂️ Выберите файл
                                </button>
                                <span id="fileName" style="color: #666; font-size: 0.95rem; font-weight: 500;">Файл не выбран</span>
                            </div>
                            <div style="margin-top: 1rem; padding: 0.75rem; background: #e8f5f3; border-radius: 8px; border-left: 3px solid var(--dandy-green);">
                                <p style="margin: 0; font-size: 0.9rem; color: #333;">
                                    💡 Поддерживаемые форматы: CSV, YML, XML
                                </p>
                            </div>
                        </div>
                        
                        <!-- Опции импорта -->
                        <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem;">
                            <h3 style="margin-bottom: 1rem; font-size: 1.1rem; color: var(--dandy-green);">⚙️ Настройки импорта</h3>
                            <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; cursor: pointer;">
                                <input type="checkbox" id="updateExisting" style="width: 18px; height: 18px; cursor: pointer;">
                                <span>Обновлять существующие товары (по названию)</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="importHidden" style="width: 18px; height: 18px; cursor: pointer;">
                                <span>Импортировать как скрытые (недоступные для заказа)</span>
                            </label>
                        </div>
                        
                        <!-- Превью -->
                        <div id="importPreview" class="hidden" style="display: none;">
                            <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; color: var(--dandy-green);">Предпросмотр данных:</h3>
                            <div id="importPreviewContent"></div>
                        </div>

                        <!-- Сопоставление полей -->
                        <div id="fieldMappingSection" style="margin-top: 1.5rem; display: none;">
                            <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px; color: var(--dandy-green);">🔄 Сопоставление полей</h3>
                            <p style="margin: 0 0 1rem; color: #4b5563; font-size: 0.9rem;">
                                Выберите, какие колонки файла соответствуют полям системы. Это нужно сделать один раз перед импортом.
                            </p>
                            <div class="import-mapping" style="grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px;">
                                <div style="background: #f9fafb; border-radius: 12px; padding: 1rem;">
                                    <h4 style="margin: 0 0 0.75rem; color: #04746c; font-size: 0.95rem;">Колонки из файла</h4>
                                    <div id="mappingLeft"></div>
                                </div>
                                <div style="background: #f9fafb; border-radius: 12px; padding: 1rem;">
                                    <h4 style="margin: 0 0 0.75rem; color: #04746c; font-size: 0.95rem;">Системные поля</h4>
                                    <div id="mappingRight"></div>
                                </div>
                            </div>
                        </div>
                        <div id="importJobStatus" style="margin-top: 1rem;"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" id="importCancelBtn">Отмена</button>
                        <button class="btn btn-primary" id="importBtn" onclick="ProductCardsManager.startImportJob()" disabled>Импортировать</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            const closeBtn = modal.querySelector('.modal-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.resetImportJobState();
                    modal.remove();
                });
            }
            const cancelBtn = document.getElementById('importCancelBtn');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    this.resetImportJobState();
                    modal.remove();
                });
            }
            // Настраиваем обработчик файла
            const importFileInput = document.getElementById('importFile');
            if (importFileInput) {
                importFileInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        this.handleFileSelect(file);
                    }
                });
            }
            
            // Закрытие по клику вне модала
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.resetImportJobState();
                    modal.remove();
                }
            });
            
            // Фокус на первое поле
            setTimeout(() => {
                const firstInput = modal.querySelector('input, select, textarea, button');
                if (firstInput) {
                    firstInput.focus();
                }
            }, 100);
        },

        // Обработка выбранного файла
        async handleFileSelect(file) {
            if (!file) return;
            
            const fileName = document.getElementById('fileName');
            const importPreview = document.getElementById('importPreview');
            const importPreviewContent = document.getElementById('importPreviewContent');
            const importBtn = document.getElementById('importBtn');
            
            if (fileName) fileName.textContent = file.name;
            
            // Сохраняем файл для последующего импорта
            this.selectedImportFile = file;
            
            try {
                const text = await this.readFileAsText(file);
                const fileType = file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'yml';
                
                if (fileType === 'csv') {
                    await this.parseCSVFile(text);
                } else {
                    await this.parseYMLFile(text);
                }
                
                // Показываем превью
                if (importPreview) {
                    importPreview.style.display = 'block';
                    if (importPreviewContent && this.importData) {
                        const previewCount = this.importData.products ? this.importData.products.length : 0;
                        importPreviewContent.innerHTML = `
                            <div style="padding: 12px; background: rgba(252, 252, 249, 1); border: 1px solid rgba(94, 82, 64, 0.12); border-radius: 8px; font-size: 14px; color: rgba(19, 52, 59, 1);">
                                Найдено товаров: <strong>${previewCount}</strong>
                                ${this.importData.products && this.importData.products.length > 0 ? `
                                    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(94, 82, 64, 0.12);">
                                        Примеры:
                                        ${this.importData.products.slice(0, 3).map((p, i) => `
                                            <div style="margin-top: 4px; color: rgba(98, 108, 113, 1); font-size: 12px;">${i + 1}. ${p.name || p.sku || 'Без названия'}</div>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    }
                }
                
                // Активируем кнопку импорта
                if (importBtn) importBtn.disabled = false;
                
            } catch (error) {
                console.error('File parsing error:', error);
                alert('❌ Ошибка при чтении файла');
                if (importBtn) importBtn.disabled = true;
            }
        },

        // Чтение файла как текст
        readFileAsText(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsText(file, 'UTF-8');
            });
        },

        // Парсинг CSV файла
        async parseCSVFile(text) {
            const lines = text.split('\n').filter(line => line.trim());
            if (lines.length < 2) {
                alert('❌ CSV файл должен содержать заголовки и хотя бы одну строку данных');
                return;
            }
            
            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            this.importData = {
                type: 'csv',
                headers: headers,
                rows: lines.slice(1).map(line => line.split(',').map(cell => cell.trim().replace(/"/g, '')))
            };
            
            this.renderFieldMapping();
            this.renderPreview();
        },

        // Парсинг YML файла
        async parseYMLFile(text) {
            try {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(text, 'text/xml');
                
                const offers = xmlDoc.querySelectorAll('offer');
                if (offers.length === 0) {
                    alert('❌ YML файл не содержит товаров (теги <offer>)');
                    return;
                }
                
                // Собираем все возможные поля из первого товара
                const firstOffer = offers[0];
                const availableFields = [];
                
                Array.from(firstOffer.children).forEach(child => {
                    if (!availableFields.includes(child.tagName)) {
                        availableFields.push(child.tagName);
                    }
                });
                
                this.importData = {
                    type: 'yml',
                    fields: availableFields,
                    offers: Array.from(offers).map(offer => {
                        const data = {};
                        Array.from(offer.children).forEach(child => {
                            data[child.tagName] = child.textContent;
                        });
                        return data;
                    })
                };
                
                this.renderFieldMapping();
                this.renderPreview();
                
            } catch (error) {
                console.error('YML parsing error:', error);
                alert('❌ Ошибка при парсинге YML файла');
            }
        },

        // Отрисовка сопоставления полей
        renderFieldMapping() {
            if (!this.importData) {
                return;
            }
            const mappingLeft = document.getElementById('mappingLeft');
            const mappingRight = document.getElementById('mappingRight');
            const mappingSection = document.getElementById('fieldMappingSection');

            if (!mappingLeft || !mappingRight) {
                console.warn('[ProductCardsManager] Mapping containers not found in DOM');
                return;
            }

            const systemFields = [
                { key: 'name', label: 'Название', required: true },
                { key: 'description', label: 'Описание', required: false },
                { key: 'price', label: 'Цена', required: false }
            ];
            
            const options = this.importData.type === 'csv' ? this.importData.headers : this.importData.fields;
            if (!Array.isArray(options) || options.length === 0) {
                if (mappingSection) mappingSection.style.display = 'none';
                mappingLeft.innerHTML = '';
                mappingRight.innerHTML = '';
                return;
            }

            let leftHtml = '';
            let rightHtml = '';
            
            systemFields.forEach(field => {
                leftHtml += `
                    <select id="mapping_${field.key}" data-field="${field.key}" class="form-input mapping-select" 
                            style="width: 100%; margin-bottom: 0.75rem; background: #ffffff; color: #111827; border: 1px solid rgba(4, 116, 108, 0.2); padding: 0.65rem; border-radius: 8px; font-size: 0.95rem;">
                        <option value="">-- Выберите --</option>
                        ${options.map(option => `
                            <option value="${option}" ${this.autoMapField(field.key, option) ? 'selected' : ''}>
                                ${option}
                            </option>
                        `).join('')}
                    </select>
                `;
                
                rightHtml += `
                    <div style="background: #ecfdf5; padding: 0.5rem 0.75rem; border-radius: 8px; margin-bottom: 0.75rem; color: #065f46; font-size: 0.95rem; display: flex; align-items: center; height: 42px; font-weight: 600;">
                        ${field.label}${field.required ? ' *' : ''}
                    </div>
                `;
            });
            
            mappingLeft.innerHTML = leftHtml;
            mappingRight.innerHTML = rightHtml;
            if (mappingSection) {
                mappingSection.style.display = 'block';
            }
        },

        // Автоматическое сопоставление полей
        autoMapField(systemField, fileField) {
            const mappings = {
                'name': ['name', 'title', 'product_name', 'название'],
                'sku': ['sku', 'vendor_code', 'артикул', 'код'],
                'price': ['price', 'cost', 'цена', 'стоимость'],
                'category': ['category', 'category_name', 'cat', 'категория'],
                'description': ['description', 'desc', 'описание'],
                'image_url': ['image_url', 'image', 'photo', 'picture', 'изображение', 'фото'],
                'weight': ['weight', 'size', 'вес', 'размер'],
                'calories': ['calories', 'калории'],
                'quantity': ['stock', 'quantity', 'остаток', 'количество']
            };
            
            const fieldLower = fileField.toLowerCase();
            return mappings[systemField]?.some(map => fieldLower.includes(map)) || false;
        },

        // Отрисовка предпросмотра
        renderPreview() {
            const previewContent = document.getElementById('previewContent');
            
            // Показываем простое сообщение вместо подробного предпросмотра
            const totalCount = this.importData.type === 'csv' ? 
                this.importData.rows.length : 
                this.importData.offers.length;
            
            previewContent.innerHTML = `
                <div style="padding: 0.5rem 0;">
                    <div style="color: #10b981; font-weight: 600; margin-bottom: 0.5rem;">✓ Обновление данных товара</div>
                    <div style="color: #9ca3af;">Найдено товаров для импорта: ${totalCount}</div>
                </div>
            `;
        },

        // Запуск задания импорта
        async startImportJob() {
            if (!this.ensurePermission('product.import')) {
                return;
            }
            const importBtn = document.getElementById('importBtn');
            if (!importBtn) return;
            if (!this.selectedImportFile) {
                alert('❌ Пожалуйста, выберите файл для импорта');
                return;
            }
            if (this.importJob) {
                alert('Импорт уже выполняется, дождитесь завершения текущего задания');
                return;
            }

            importBtn.disabled = true;
            importBtn.textContent = '⏳ Импортируем...';

            try {
                const importHidden = document.getElementById('importHidden')?.checked || false;
                const updateExisting = document.getElementById('updateExisting')?.checked || false;
                const formData = new FormData();
                formData.append('file', this.selectedImportFile);
                formData.append('importHidden', importHidden ? 'true' : 'false');
                formData.append('mode', updateExisting ? 'upsert' : 'append');

                const response = await this.fetchWithRole('/api/catalog/products/import/jobs', {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json().catch(() => ({}));
                if (!response.ok || result.success === false) {
                    throw new Error(result.error || response.statusText || 'Ошибка запуска импорта');
                }
                this.importJob = result.data || result;
                this.renderImportJobStatus();
                this.pollImportJobStatus(this.importJob.id);
                this.importJobPoll = setInterval(() => this.pollImportJobStatus(this.importJob.id), 2000);
            } catch (error) {
                console.error('Import job error:', error);
                alert(`❌ Ошибка запуска импорта: ${error.message || 'Неизвестная ошибка'}`);
            } finally {
                importBtn.disabled = false;
                importBtn.textContent = '📥 Импортировать';
            }
        },

        renderImportJobStatus() {
            const container = document.getElementById('importJobStatus');
            if (!container) return;
            if (!this.importJob) {
                container.innerHTML = '';
                return;
            }
            const job = this.importJob;
            const progress = Math.min(100, Math.max(0, job.progress || 0));
            const meta = job.meta || {};
            const stats = job.result?.stats || {};
            let content = `
                <div style="border:1px солид rgba(94,82,64,0.12); border-radius: 10px; padding: 12px; background: rgba(252,252,249,1);">
                    <div style="display:flex; justify-content:space-between; font-size: 0.9rem;">
                        <span>Статус: <strong>${job.status}</strong></span>
                        <span>Прогресс: ${progress}%</span>
                    </div>
                    <div style="height: 6px; background: rgba(229,231,235,1); border-radius: 999px; margin: 8px 0;">
                        <div style="height: 100%; width: ${progress}%; background: rgba(33,128,141,1); border-radius: 999px;"></div>
                    </div>
                    ${meta.total ? `<div style="font-size: 0.85rem; color: rgba(107,114,128,1);">Обработано ${meta.processed || 0} из ${meta.total}</div>` : ''}
            `;
            if (job.status === 'completed') {
                content += `
                    <div style="margin-top: 10px; font-size: 0.9rem;">
                        <div>Создано: <strong>${stats.created || 0}</strong></div>
                        <div>Обновлено: <strong>${stats.updated || 0}</strong></div>
                        <div>Пропущено: <strong>${stats.skipped || 0}</strong></div>
                        ${
                            Array.isArray(stats.errors) && stats.errors.length
                                ? `<div style="margin-top: 8px; color: #b91c1c;">Ошибок: ${stats.errors.length}</div>`
                                : ''
                        }
                    </div>
                `;
            }
            if (job.status === 'failed' && job.error) {
                content += `<div style="margin-top:8px; color:#b91c1c; font-size:0.9rem;">Ошибка: ${job.error}</div>`;
            }
            content += '</div>';
            container.innerHTML = content;
        },

        async pollImportJobStatus(jobId) {
            if (!jobId) return;
            try {
                const response = await this.fetchWithRole(`/api/catalog/products/import/jobs/${encodeURIComponent(jobId)}`);
                const result = await response.json().catch(() => ({}));
                if (!response.ok || result.success === false) {
                    throw new Error(result.error || response.statusText);
                }
                this.importJob = result.data || result;
                this.renderImportJobStatus();
                if (this.importJob.status === 'completed') {
                    await this.completeImportJob(true);
                } else if (this.importJob.status === 'failed') {
                    await this.completeImportJob(false, this.importJob.error);
                }
            } catch (error) {
                console.warn('Import job polling error:', error);
                await this.completeImportJob(false, error.message || 'Ошибка запроса');
            }
        },

        async completeImportJob(success, message) {
            if (this.importJobPoll) {
                clearInterval(this.importJobPoll);
                this.importJobPoll = null;
            }
            if (success) {
                alert('✅ Импорт завершён');
                await this.loadProducts();
                if (typeof this.syncToWebsite === 'function') {
                    await this.syncToWebsite(true);
                }
                this.resetImportJobState();
            } else if (message) {
                alert(`❌ Импорт не выполнен: ${message}`);
                this.resetImportJobState();
            }
        },

        resetImportJobState() {
            if (this.importJobPoll) {
                clearInterval(this.importJobPoll);
                this.importJobPoll = null;
            }
            this.importJob = null;
            const container = document.getElementById('importJobStatus');
            if (container) {
                container.innerHTML = '';
            }
            const fileName = document.getElementById('fileName');
            if (fileName) {
                fileName.textContent = 'Файл не выбран';
            }
            const importBtn = document.getElementById('importBtn');
            if (importBtn) {
                importBtn.disabled = true;
            }
            this.selectedImportFile = null;
        },

        // Сопоставление строки CSV с товаром
        mapCSVRowToProduct(row, mapping, importHidden) {
            const productData = {
                visible_on_site: !importHidden,
                hidden_for_promo: false,
                categories: []
            };
            
            Object.entries(mapping).forEach(([systemField, csvField]) => {
                const index = this.importData.headers.indexOf(csvField);
                if (index >= 0 && row[index]) {
                    const value = row[index].trim();
                    
                    switch (systemField) {
                        case 'name':
                            productData.name = value;
                            break;
                        case 'sku':
                            productData.sku = value;
                            break;
                        case 'price':
                            productData.price = parseFloat(value) || 0;
                            break;
                        case 'category':
                            const category = this.findCategoryByName(value);
                            if (category) {
                                productData.categories = [category.id];
                            }
                            break;
                        case 'description':
                            productData.short_description = value;
                            break;
                        case 'image_url':
                            productData.image_url = value;
                            break;
                        case 'weight':
                            productData.weight = value;
                            break;
                        case 'calories':
                            productData.calories = parseInt(value) || 0;
                            break;
                        case 'quantity':
                            productData.quantity = parseInt(value) || 0;
                            break;
                    }
                }
            });
            
            if (!productData.name || !productData.sku) {
                return null;
            }
            
            return productData;
        },

        // Сопоставление предложения YML с товаром
        mapYMLOfferToProduct(offer, mapping, importHidden) {
            const productData = {
                visible_on_site: !importHidden,
                hidden_for_promo: false,
                categories: []
            };
            
            Object.entries(mapping).forEach(([systemField, ymlField]) => {
                const value = offer[ymlField]?.trim();
                if (value) {
                    switch (systemField) {
                        case 'name':
                            productData.name = value;
                            break;
                        case 'sku':
                            productData.sku = value;
                            break;
                        case 'price':
                            productData.price = parseFloat(value) || 0;
                            break;
                        case 'category':
                            const category = this.findCategoryByName(value);
                            if (category) {
                                productData.categories = [category.id];
                            }
                            break;
                        case 'description':
                            productData.short_description = value;
                            break;
                        case 'image_url':
                            productData.image_url = value;
                            break;
                        case 'weight':
                            productData.weight = value;
                            break;
                        case 'calories':
                            productData.calories = parseInt(value) || 0;
                            break;
                        case 'quantity':
                            productData.quantity = parseInt(value) || 0;
                            break;
                    }
                }
            });
            
            if (!productData.name || !productData.sku) {
                return null;
            }
            
            return productData;
        },

        // Поиск товара по SKU
        findProductBySku(sku) {
            return this.products.find(p => p.sku === sku);
        },

        // Поиск категории по названию
        findCategoryByName(name) {
            return this.categories.find(c => c.name.toLowerCase() === name.toLowerCase());
        },

        // Создание товара
        async createProduct(productData) {
            const payload = this.transformLegacyPayload(productData);
            const result = await this.catalogRequest('/products', {
                method: 'POST',
                body: payload
            });
            
            await this.syncToWebsite(false);
            return result.data;
        },

        // Обновление товара
        async updateProduct(productData) {
            const existingProduct = this.findProductBySku(productData.sku);
            if (!existingProduct) {
                throw new Error('Товар для обновления не найден');
            }
            
            const payload = this.transformLegacyPayload(productData);
            const result = await this.catalogRequest(`/products/${encodeURIComponent(existingProduct.id)}`, {
                method: 'PUT',
                body: payload
            });
            
            await this.syncToWebsite(false);
            return result.data;
        },

        // Открыть добавление товара из импорта (просто закрывает импорт и открывает добавление)
        showAddProductFromImport() {
            document.querySelector('.modal-overlay').remove();
            this.showAddProductModal();
        },

        // Экспорт товаров через backend
        async exportProducts(format = 'csv') {
            if (!this.ensurePermission('product.export')) {
                return;
            }
            try {
                const payload = await this.catalogRequest('/products/export/jobs', {
                    method: 'POST',
                    body: { format }
                });
                const job = payload?.data || payload;
                alert('Экспорт запущен. Файл будет готов через несколько секунд.');
                this.pollExportJob(job.id);
                if (this.exportJobPolls.has(job.id)) {
                    clearInterval(this.exportJobPolls.get(job.id));
                }
                this.exportJobPolls.set(
                    job.id,
                    setInterval(() => this.pollExportJob(job.id), 2000)
                );
            } catch (error) {
                console.error('Ошибка экспорта товаров:', error);
                alert(`❌ Ошибка экспорта: ${error.message}`);
            }
        },

        async pollExportJob(jobId) {
            if (!jobId) return;
            try {
                const response = await this.fetchWithRole(`/api/catalog/products/export/jobs/${encodeURIComponent(jobId)}`);
                const result = await response.json().catch(() => ({}));
                if (!response.ok || result.success === false) {
                    throw new Error(result.error || response.statusText);
                }
                const job = result.data || result;
                if (job.status === 'completed') {
                    this.stopExportJobPolling(jobId);
                    this.downloadExportJob(jobId);
                } else if (job.status === 'failed') {
                    this.stopExportJobPolling(jobId);
                    alert(`❌ Экспорт не выполнен: ${job.error || 'неизвестная ошибка'}`);
                }
            } catch (error) {
                console.warn('Export job polling error:', error);
                this.stopExportJobPolling(jobId);
                alert(`❌ Ошибка экспорта: ${error.message || 'неизвестная ошибка'}`);
            }
        },

        stopExportJobPolling(jobId) {
            if (this.exportJobPolls.has(jobId)) {
                clearInterval(this.exportJobPolls.get(jobId));
                this.exportJobPolls.delete(jobId);
            }
        },

        downloadExportJob(jobId) {
            const link = document.createElement('a');
            link.href = `/api/catalog/products/export/jobs/${encodeURIComponent(jobId)}/download`;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            alert('✅ Файл экспорта готов и будет загружен');
        },

        // Экранирование XML символов
        escapeXml(text) {
            if (!text) return '';
            return String(text)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        },

        // Настроить event listeners
        setupEventListeners() {
            document.addEventListener('click', (event) => {
                const inlineBtn = event.target.closest('[data-inline-edit]');
                if (inlineBtn) {
                    event.preventDefault();
                    this.handleInlineEdit(inlineBtn);
                    return;
                }
                const compareBtn = event.target.closest('[data-history-compare]');
                if (compareBtn) {
                    event.preventDefault();
                    const productId = compareBtn.getAttribute('data-product-id');
                    const entryId = compareBtn.getAttribute('data-history-id');
                    this.toggleHistoryCompare(productId, entryId);
                    return;
                }
                const restoreBtn = event.target.closest('[data-history-restore]');
                if (restoreBtn) {
                    event.preventDefault();
                    const productId = restoreBtn.getAttribute('data-product-id');
                    const entryId = restoreBtn.getAttribute('data-history-id');
                    this.restoreHistoryEntry(productId, entryId);
                }
            });
        },

        // Отрисовать интерфейс управления карточками
        async render() {
            const container = document.getElementById('productCardsContent');
            if (!container) return;

            const hasSession = await this.ensureSession();
            if (!hasSession) {
                container.innerHTML = this.renderAuthGate();
                this.attachAuthHandlers();
                return;
            }

            if (!this.categories.length) {
                await this.loadCategories();
            }
            if (!this.modifiers.length) {
                await this.loadModifiers();
            }
            if (!this.parameterPresets.length) {
                await this.loadParameterPresets();
            }
            if (!this.products.length) {
                await this.loadProducts({ silent: true });
            }

            container.innerHTML = `
                <div style="max-width: 1400px; margin: 0 auto; padding: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 1px solid rgba(94, 82, 64, 0.2);">
                        <h1 style="font-size: 24px; font-weight: 600; color: rgba(19, 52, 59, 1); margin: 0;">🛍️ Dandy Витрина - Панель управления</h1>
                        <div style="display: flex; gap: 12px;">
                            <button class="btn btn--secondary" id="exportCsvBtn" style="display: inline-flex; align-items: center; justify-content: center; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid rgba(94, 82, 64, 0.2); background: rgba(94, 82, 64, 0.12); color: rgba(19, 52, 59, 1);">
                                📊 Экспорт CSV
                        </button>
                            <button class="btn btn--secondary" id="exportYmlBtn" style="display: inline-flex; align-items: center; justify-content: center; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid rgba(94, 82, 64, 0.2); background: rgba(94, 82, 64, 0.12); color: rgba(19, 52, 59, 1);">
                                📄 Экспорт YML
                        </button>
                            <button class="btn btn--secondary" id="showImportBtn" style="display: inline-flex; align-items: center; justify-content: center; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid rgba(94, 82, 64, 0.2); background: rgba(94, 82, 64, 0.12); color: rgba(19, 52, 59, 1);">
                                📥 Импорт
                        </button>
                            <button class="btn btn--primary" id="addProductBtn" style="display: inline-flex; align-items: center; justify-content: center; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1); border: none; background: rgba(33, 128, 141, 1); color: rgba(252, 252, 249, 1);">
                                ➕ Добавить товар
                        </button>
                            <button class="btn btn--secondary" id="manageCategoriesBtn" style="display: inline-flex; align-items: center; justify-content: center; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid rgba(94, 82, 64, 0.2); background: rgba(94, 82, 64, 0.12); color: rgba(19, 52, 59, 1);">
                                📁 Управление категориями
                        </button>
                        </div>
                    </div>

                    <div id="productCardsTable"></div>
                </div>
            `;

            this.renderProductsTable();
            this.attachButtonHandlers();
            this.applyRoleRestrictions();
            if (!this.listenersBound) {
                this.setupEventListeners();
                this.listenersBound = true;
            }
        },

        // Привязка обработчиков к кнопкам
        attachButtonHandlers() {
            const addProductBtn = document.getElementById('addProductBtn');
            const bulkPhotoBtn = document.getElementById('bulkPhotoBtn');
            const showImportBtn = document.getElementById('showImportBtn');
            const exportCsvBtn = document.getElementById('exportCsvBtn');
            const exportYmlBtn = document.getElementById('exportYmlBtn');
            const manageCategoriesBtn = document.getElementById('manageCategoriesBtn');
            const logoutBtn = document.getElementById('logoutBtn');

            if (addProductBtn) {
                addProductBtn.addEventListener('click', () => this.showAddProductModal());
            }
            if (showImportBtn) {
                showImportBtn.addEventListener('click', () => this.showImportModal());
            }
            if (exportCsvBtn) {
                exportCsvBtn.addEventListener('click', () => this.exportProducts('csv'));
            }
            if (exportYmlBtn) {
                exportYmlBtn.addEventListener('click', () => this.exportProducts('yml'));
            }
            if (manageCategoriesBtn) {
                manageCategoriesBtn.addEventListener('click', () => this.showCategoriesModal());
            }
            if (logoutBtn) {
                logoutBtn.addEventListener('click', () => this.logout());
            }
        },

        // Модальное окно управления категориями
        async showCategoriesModal() {
            if (!this.ensurePermission('category.manage')) {
                return;
            }
            // Удаляем существующие модальные окна
            const existingModals = document.querySelectorAll('.modal-overlay');
            existingModals.forEach(modal => modal.remove());
            
            // Загружаем категории
            await this.loadCategories();
            
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content large">
                    <div class="modal-header">
                        <h3>📁 Управление категориями</h3>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                    </div>
                    <div class="modal-body">
                        <div style="margin-bottom: 1.5rem;">
                            <button id="addCategoryBtn" class="btn btn-primary" style="background: var(--dandy-green); color: #fff; border: none; padding: 0.75rem 1.5rem; border-radius: 10px; cursor: pointer; font-size: 1rem; font-weight: 600;">
                                ➕ Добавить категорию
                            </button>
                        </div>
                        <div id="categoriesList" style="max-height: 500px; overflow-y: auto;">
                            ${this.renderCategoriesList()}
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Обработчики
            const addCategoryBtn = document.getElementById('addCategoryBtn');
            if (addCategoryBtn) {
                addCategoryBtn.addEventListener('click', () => this.showAddCategoryForm(modal));
            }
            
            // Обработчики для кнопок редактирования и удаления
            modal.querySelectorAll('.editCategoryBtn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const categoryId = e.target.closest('tr').dataset.categoryId;
                    this.showEditCategoryForm(modal, categoryId);
                });
            });
            
            modal.querySelectorAll('.deleteCategoryBtn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const categoryId = e.target.closest('tr').dataset.categoryId;
                    await this.deleteCategory(categoryId, modal);
                });
            });
        },

        renderCategoriesList() {
            if (!this.categories || this.categories.length === 0) {
                return '<p style="text-align: center; color: #999; padding: 2rem;">Нет категорий. Добавьте первую категорию.</p>';
            }
            
            return `
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
                            <th style="padding: 12px; text-align: left; font-weight: 600;">Название</th>
                            <th style="padding: 12px; text-align: left; font-weight: 600;">ID</th>
                            <th style="padding: 12px; text-align: left; font-weight: 600;">Порядок</th>
                            <th style="padding: 12px; text-align: center; font-weight: 600;">Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.categories.map(cat => `
                            <tr data-category-id="${cat.id}" style="border-bottom: 1px solid #dee2e6;">
                                <td style="padding: 12px;">${this.escapeHtml(cat.name || '')}</td>
                                <td style="padding: 12px; color: #666; font-size: 0.9rem;">${this.escapeHtml(cat.id || '')}</td>
                                <td style="padding: 12px;">${cat.position || 0}</td>
                                <td style="padding: 12px; text-align: center;">
                                    <button class="editCategoryBtn" style="padding: 6px 12px; margin: 0 4px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">✏️ Редактировать</button>
                                    <button class="deleteCategoryBtn" style="padding: 6px 12px; margin: 0 4px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">🗑️ Удалить</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        },

        showAddCategoryForm(modal) {
            if (!this.ensurePermission('category.manage')) {
                return;
            }
            const formHtml = `
                <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 12px; margin-top: 1.5rem;">
                    <h4 style="margin-bottom: 1rem;">Добавить категорию</h4>
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Название *</label>
                        <input type="text" id="newCategoryName" class="form-input" placeholder="Например: Пицца" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Код (опционально)</label>
                        <input type="text" id="newCategorySlug" class="form-input" placeholder="pizza" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Порядок сортировки</label>
                        <input type="number" id="newCategorySortOrder" class="form-input" value="0" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                    </div>
                    <div style="display: flex; gap: 1rem;">
                        <button id="saveCategoryBtn" class="btn btn-primary" style="background: var(--dandy-green); color: #fff; border: none; padding: 0.75rem 1.5rem; border-radius: 10px; cursor: pointer;">💾 Сохранить</button>
                        <button onclick="this.closest('.modal-body').querySelector('[style*=\"background: #f8f9fa\"]').remove()" class="btn btn-secondary" style="background: #6c757d; color: #fff; border: none; padding: 0.75rem 1.5rem; border-radius: 10px; cursor: pointer;">Отмена</button>
                    </div>
                </div>
            `;
            
            const categoriesList = modal.querySelector('#categoriesList');
            const existingForm = categoriesList.nextElementSibling;
            if (existingForm && existingForm.style.background === 'rgb(248, 249, 250)') {
                existingForm.remove();
            }
            categoriesList.insertAdjacentHTML('afterend', formHtml);
            
            const saveBtn = document.getElementById('saveCategoryBtn');
            const nameInput = document.getElementById('newCategoryName');
            const slugInput = document.getElementById('newCategorySlug');
            
            if (saveBtn) {
                saveBtn.addEventListener('click', async () => {
                    await this.saveCategory(modal, null);
                });
            }
            
            if (nameInput && slugInput) {
                nameInput.addEventListener('input', (e) => {
                    if (!slugInput.value || slugInput.dataset.autoGenerated === 'true') {
                        const slug = e.target.value.toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/^-+|-+$/g, '');
                        slugInput.value = slug;
                        slugInput.dataset.autoGenerated = 'true';
                    }
                });
            }
        },

        showEditCategoryForm(modal, categoryId) {
            if (!this.ensurePermission('category.manage')) {
                return;
            }
            const category = this.categories.find(c => c.id == categoryId);
            if (!category) return;
            
            const formHtml = `
                <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 12px; margin-top: 1.5rem;">
                    <h4 style="margin-bottom: 1rem;">Редактировать категорию</h4>
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Название *</label>
                        <input type="text" id="editCategoryName" class="form-input" value="${this.escapeHtml(category.name || '')}" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Код</label>
                        <input type="text" id="editCategorySlug" class="form-input" value="${this.escapeHtml(category.id || '')}" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;" disabled>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Порядок сортировки</label>
                        <input type="number" id="editCategorySortOrder" class="form-input" value="${category.sort_order || 0}" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px;">
                    </div>
                    <div style="display: flex; gap: 1rem;">
                        <button id="updateCategoryBtn" class="btn btn-primary" data-category-id="${categoryId}" style="background: var(--dandy-green); color: #fff; border: none; padding: 0.75rem 1.5rem; border-radius: 10px; cursor: pointer;">💾 Сохранить</button>
                        <button onclick="this.closest('.modal-body').querySelector('[style*=\"background: #f8f9fa\"]').remove()" class="btn btn-secondary" style="background: #6c757d; color: #fff; border: none; padding: 0.75rem 1.5rem; border-radius: 10px; cursor: pointer;">Отмена</button>
                    </div>
                </div>
            `;
            
            const categoriesList = modal.querySelector('#categoriesList');
            const existingForm = categoriesList.nextElementSibling;
            if (existingForm && existingForm.style.background === 'rgb(248, 249, 250)') {
                existingForm.remove();
            }
            categoriesList.insertAdjacentHTML('afterend', formHtml);
            
            const updateBtn = document.getElementById('updateCategoryBtn');
            if (updateBtn) {
                updateBtn.addEventListener('click', async () => {
                    await this.saveCategory(modal, categoryId);
                });
            }
        },

        async saveCategory(modal, categoryId) {
            if (!this.ensurePermission('category.manage')) {
                return;
            }
            const nameInput = categoryId ? document.getElementById('editCategoryName') : document.getElementById('newCategoryName');
            const slugInput = categoryId ? document.getElementById('editCategorySlug') : document.getElementById('newCategorySlug');
            const sortOrderInput = categoryId ? document.getElementById('editCategorySortOrder') : document.getElementById('newCategorySortOrder');
            
            if (!nameInput || !nameInput.value.trim()) {
                alert('❌ Введите название категории');
                return;
            }
            
            const data = {
                name: nameInput.value.trim(),
                position: sortOrderInput ? parseInt(sortOrderInput.value, 10) || 0 : 0
            };
            if (categoryId) {
                data.id = categoryId;
            } else if (slugInput && slugInput.value.trim()) {
                data.id = slugInput.value.trim();
            }
            
            try {
                const result = await this.catalogRequest('/categories', {
                    method: 'POST',
                    body: data
                });
                
                if (result.success !== false) {
                    await this.loadCategories();
                    const categoriesList = modal.querySelector('#categoriesList');
                    categoriesList.innerHTML = this.renderCategoriesList();
                    
                    // Удаляем форму
                    const form = categoriesList.nextElementSibling;
                    if (form && form.style.background === 'rgb(248, 249, 250)') {
                        form.remove();
                    }
                    
                    // Перепривязываем обработчики
                    modal.querySelectorAll('.editCategoryBtn').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            const catId = e.target.closest('tr').dataset.categoryId;
                            this.showEditCategoryForm(modal, catId);
                        });
                    });
                    
                    modal.querySelectorAll('.deleteCategoryBtn').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            const catId = e.target.closest('tr').dataset.categoryId;
                            await this.deleteCategory(catId, modal);
                        });
                    });
                    
                    alert(`✅ Категория ${categoryId ? 'обновлена' : 'создана'} успешно!`);
                } else {
                    throw new Error(result.error || result.message || 'Ошибка сохранения');
                }
            } catch (error) {
                console.error('Ошибка сохранения категории:', error);
                alert(`❌ Ошибка: ${error.message}`);
            }
        },

        async deleteCategory(categoryId, modal) {
            if (!this.ensurePermission('category.manage')) {
                return;
            }
            if (!confirm('Вы уверены, что хотите удалить эту категорию?')) {
                return;
            }
            
            try {
                await this.catalogRequest(`/categories/${encodeURIComponent(categoryId)}`, {
                    method: 'DELETE'
                });
                
                await this.loadCategories();
                const categoriesList = modal.querySelector('#categoriesList');
                categoriesList.innerHTML = this.renderCategoriesList();
                
                // Перепривязываем обработчики
                modal.querySelectorAll('.editCategoryBtn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const catId = e.target.closest('tr').dataset.categoryId;
                        this.showEditCategoryForm(modal, catId);
                    });
                });
                
                modal.querySelectorAll('.deleteCategoryBtn').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const catId = e.target.closest('tr').dataset.categoryId;
                        await this.deleteCategory(catId, modal);
                    });
                });
                
                alert('✅ Категория удалена успешно!');
            } catch (error) {
                console.error('Ошибка удаления категории:', error);
                alert(`❌ Ошибка: ${error.message}`);
            }
        },

        async openProductWizard({ mode = 'create', productId = null } = {}) {
            if (mode === 'create' && !this.ensurePermission('product.create')) {
                return;
            }
            if (mode === 'edit' && !this.ensurePermission('product.update')) {
                return;
            }
            await this.loadCategories();
            await this.loadModifiers();
            const sourceProduct = mode === 'edit'
                ? this.products.find((p) => String(p.id) === String(productId))
                : null;
            if (mode === 'edit' && !sourceProduct) {
                alert('❌ Товар не найден');
                return;
            }

            let wizardProduct = this.prepareWizardProduct(sourceProduct || {});
            const draftMeta = this.resolveDraftMeta(mode, wizardProduct.id);
            this.wizardState = {
                mode,
                productId: wizardProduct.id || null,
                productKey: draftMeta.productKey,
                draftId: draftMeta.draftId,
                stepIndex: 0,
                isDraftDirty: false
            };

            const draftPayload = await this.fetchDraftPayload(draftMeta.productKey, draftMeta.draftId);
            if (draftPayload?.payload) {
                wizardProduct = {
                    ...wizardProduct,
                    ...draftPayload.payload
                };
                if (draftPayload.payload.variations) {
                    wizardProduct.variations = draftPayload.payload.variations;
                }
                if (draftPayload.payload.recommended_products) {
                    wizardProduct.recommended_products = draftPayload.payload.recommended_products;
                }
                if (draftPayload.payload.modifiers) {
                    wizardProduct.modifiers = draftPayload.payload.modifiers;
                }
                if (Array.isArray(draftPayload.payload.variant_parameters)) {
                    this.variantParameters = this.buildVariantParametersFromProduct({
                        variant_parameters: draftPayload.payload.variant_parameters
                    });
                }
                this.wizardState.restoredFromDraft = true;
                this.wizardState.lastDraftSavedAt = draftPayload.saved_at;
            } else {
                this.variantParameters = this.buildVariantParametersFromProduct(wizardProduct);
            }
            delete wizardProduct.variant_parameters;

            this.initMediaLibrary(wizardProduct);
            const steps = this.generateWizardSteps(wizardProduct, mode);
            this.wizardState.steps = steps;

            const modal = document.createElement('div');
            modal.className = 'modal-overlay wizard-overlay';
            modal.innerHTML = this.renderWizardShell(steps, mode);
            document.body.appendChild(modal);
            this.wizardModal = modal;

            const form = modal.querySelector('#productWizardForm');
            form.addEventListener('submit', (event) => {
                event.preventDefault();
                this.submitProductWizard();
            });

            modal.addEventListener('click', (event) => {
                if (event.target === modal || event.target.classList.contains('wizard-close')) {
                    if (!this.confirmWizardClose()) return;
                    this.closeWizardModal();
                    return;
                }
                const stepBtn = event.target.closest('.wizard-step-link');
                if (stepBtn) {
                    this.goToWizardStep(parseInt(stepBtn.dataset.stepIndex, 10));
                }
                if (event.target.matches('#wizardNextBtn')) {
                    this.goToWizardStep(this.wizardState.stepIndex + 1);
                }
                if (event.target.matches('#wizardPrevBtn')) {
                    this.goToWizardStep(this.wizardState.stepIndex - 1);
                }
                const syncBtn = event.target.closest('[data-sync-targets]');
                if (syncBtn) {
                    const targets = syncBtn.dataset.syncTargets.split(',').map((t) => t.trim());
                    this.triggerSyncTargets(this.wizardState.productId, targets);
                }
            });

            if (mode === 'edit' && wizardProduct.id) {
                this.refreshHistoryTimeline(wizardProduct.id);
            }
            this.updatePresetSelectOptions();
            this.rerenderVariantParameters();
            if (this.wizardState.restoredFromDraft) {
                const notice = document.createElement('div');
                notice.style.cssText = 'margin-bottom: 1rem; padding: 0.75rem 1rem; border-radius: 10px; background: rgba(16,185,129,0.12); color: rgba(4,78,50,1); font-size: 0.9rem;';
                notice.textContent = `Восстановлен черновик от ${
                    this.wizardState.lastDraftSavedAt
                        ? new Date(this.wizardState.lastDraftSavedAt).toLocaleString('ru-RU')
                        : 'последнего сохранения'
                }.`;
                const formRoot = this.wizardModal.querySelector('#productWizardForm');
                if (formRoot) {
                    formRoot.insertAdjacentElement('afterbegin', notice);
                }
            }
            this.initDraftAutosave();
        },

        prepareWizardProduct(product) {
            return {
                id: product?.id || null,
                name: product?.name || '',
                sku: product?.sku || '',
                barcode: product?.barcode || '',
                type: product?.type || 'product',
                price: product?.price || 0,
                purchase_price: product?.purchase_price || product?.cost || 0,
                quantity: product?.quantity ?? 0,
                categories: Array.isArray(product?.categories) ? product.categories : [],
                short_description: product?.short_description || '',
                description: product?.full_description || product?.description || '',
                weight: product?.weight || '',
                calories: product?.calories || '',
                image_url: product?.image_url || '',
                photo_mode: product?.photo_mode || 'with_background',
                product_page_type: product?.product_page_type || 'default',
                product_page_url: product?.product_page_url || '',
                ingredients: product?.ingredients || '',
                allergens: product?.allergens || '',
                is_visible: product?.visible_on_site !== false,
                forbid_discounts: product?.hidden_for_promo || product?.forbid_discounts || false,
                forbid_loyalty: product?.forbid_loyalty || false,
                tax_system: product?.tax_system || 'osn',
                vat_rate: product?.vat_rate || '20%',
                min_stock: product?.min_stock || 0,
                min_order_qty: product?.min_order_qty || 1,
                variations: Array.isArray(product?.variations) ? product.variations : [],
                recommended_products: Array.isArray(product?.recommended_products) ? product.recommended_products : [],
                // ✅ КРИТИЧНО: Загружаем модификаторы из product.modifiers или product.mods (импортированные)
                modifiers: Array.isArray(product?.modifiers) ? product.modifiers : 
                          Array.isArray(product?.mods) ? product.mods : [],
                mods: Array.isArray(product?.mods) ? product.mods : 
                      Array.isArray(product?.modifiers) ? product.modifiers : [],
                custom_attributes: Array.isArray(product?.custom_attributes) ? product.custom_attributes : [],
                images: Array.isArray(product?.images)
                    ? product.images
                    : product?.image_url
                    ? [
                          {
                              id: `img-${Date.now()}`,
                              url: product.image_url,
                              role: 'primary',
                              alt_text: product?.name || ''
                          }
                      ]
                    : []
            };
        },

        generateWizardSteps(product, mode) {
            return [
                { id: 'basics', title: '1. Основное', content: this.renderWizardBasics(product) },
                { id: 'details', title: '2. Описания', content: this.renderWizardDetails(product) },
                { id: 'images', title: '3. Изображения', content: this.renderWizardImages(product) },
                { id: 'variations', title: '4. Варианты', content: this.renderWizardVariations(product) },
                { id: 'modifiers', title: '5. Модификаторы', content: this.renderWizardModifiers(product) },
                { id: 'recommendations', title: '6. Рекомендации', content: this.renderWizardRecommendations(product) },
                { id: 'advanced', title: '7. Настройки', content: this.renderWizardAdvanced(product) },
                { id: 'review', title: '8. Проверка', content: this.renderWizardReview(product, mode) }
            ];
        },

        renderWizardShell(steps, mode) {
            return `
                <div class="wizard-container" style="background: white; border-radius: 20px; padding: 0; max-width: 1100px; width: 100%; max-height: 92vh; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3); display: flex; position: relative;">
                    <button type="button" class="wizard-close" style="position: absolute; top: 12px; right: 12px; border: none; background: rgba(15,23,42,0.05); width: 36px; height: 36px; border-radius: 50%; font-size: 1.4rem; cursor: pointer;">×</button>
                    <aside style="width: 260px; background: #0f172a; color: white; padding: 2rem 1.25rem; display: flex; flex-direction: column; gap: 0.75rem;">
                        <h2 style="margin: 0 0 1rem 0; font-size: 1.1rem; font-weight: 700;">${mode === 'create' ? 'Новый товар' : 'Редактирование'}</h2>
                        ${steps
                            .map(
                                (step, idx) => `
                            <button type="button" class="wizard-step-link ${idx === 0 ? 'active' : ''}" data-step-index="${idx}"
                                style="text-align: left; padding: 0.6rem 0.9rem; border-radius: 8px; border: none; background: ${
                                    idx === 0 ? 'rgba(59,130,246,0.2)' : 'transparent'
                                }; color: white; font-weight: 600; cursor: pointer;">
                                ${step.title}
                            </button>`
                            )
                            .join('')}
                    </aside>
                    <div style="flex: 1; padding: 2rem; overflow-y: auto;">
                        <form id="productWizardForm" style="display: flex; flex-direction: column; gap: 1.5rem;">
                            ${steps
                                .map(
                                    (step, idx) => `
                                <section class="wizard-step-content" data-step-index="${idx}" style="${idx === 0 ? '' : 'display:none;'}">
                                    ${step.content}
                                </section>`
                                )
                                .join('')}
                            <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding-top: 1rem; border-top: 1px solid rgba(226, 232, 240, 1);">
                                <div>
                                    <strong>Шаг <span id="wizardStepIndicator">1</span> из ${steps.length}</strong>
                                </div>
                                <div style="display: flex; gap: 0.75rem;">
                                    <button type="button" id="wizardPrevBtn" class="btn btn--secondary" style="padding: 0.6rem 1.5rem;">Назад</button>
                                    <button type="button" id="wizardNextBtn" class="btn btn--secondary" style="padding: 0.6rem 1.5rem;">Далее</button>
                                    <button type="submit" id="wizardSaveBtn" class="btn btn--primary" style="padding: 0.6rem 1.8rem; display: none;">
                                        ${mode === 'create' ? 'Создать' : 'Сохранить'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            `;
        },

        renderWizardBasics(product) {
            return `
                <div class="wizard-section">
                    <label class="form-label">Название *</label>
                    <input type="text" id="wizardName" value="${this.escapeHtml(product.name)}" class="form-input" placeholder="Введите название" required>

                    <div class="wizard-grid">
                        <div>
                            <label class="form-label">SKU *</label>
                            <input type="text" id="wizardSku" value="${this.escapeHtml(product.sku)}" class="form-input" required>
                        </div>
                        <div>
                            <label class="form-label">Штрих-код</label>
                            <input type="text" id="wizardBarcode" value="${this.escapeHtml(product.barcode || '')}" class="form-input">
                        </div>
                    </div>

                    <div class="wizard-grid">
                        <div>
                            <label class="form-label">Тип карточки</label>
                            <select id="wizardType" class="form-input">
                                ${['product', 'service', 'dish', 'ingredient'].map((type) => `<option value="${type}" ${product.type === type ? 'selected' : ''}>${type}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="form-label">Категории</label>
                            <div class="wizard-category-list">
                                ${this.categories
                                    .map(
                                        (cat) => `
                                        <label>
                                            <input type="checkbox" class="wizard-category-checkbox" value="${cat.id}" ${product.categories.includes(cat.id) ? 'checked' : ''}>
                                            <span>${cat.name}</span>
                                        </label>`
                                    )
                                    .join('')}
                            </div>
                        </div>
                    </div>

                    <div class="wizard-grid">
                        <div>
                            <label class="form-label">Цена (₽)</label>
                            <input type="number" id="wizardPrice" class="form-input" value="${product.price || 0}" min="0" step="0.01">
                        </div>
                        <div>
                            <label class="form-label">Закупочная цена (₽)</label>
                            <input type="number" id="wizardPurchasePrice" class="form-input" value="${product.purchase_price || 0}" min="0" step="0.01">
                        </div>
                        <div>
                            <label class="form-label">Остаток</label>
                            <input type="number" id="wizardQuantity" class="form-input" value="${product.quantity || 0}">
                        </div>
                    </div>
                </div>
            `;
        },

        renderWizardDetails(product) {
            return `
                <div class="wizard-section">
                    <label class="form-label">Краткое описание</label>
                    <textarea id="wizardShortDescription" class="form-input" rows="2">${this.escapeHtml(product.short_description || '')}</textarea>

                    <label class="form-label">Полное описание</label>
                    <textarea id="wizardFullDescription" class="form-input" rows="4">${this.escapeHtml(product.description || '')}</textarea>

                    <div class="wizard-grid">
                        <div>
                            <label class="form-label">Вес / размер</label>
                            <input type="text" id="wizardWeight" class="form-input" value="${this.escapeHtml(product.weight || '')}">
                        </div>
                        <div>
                            <label class="form-label">Калории</label>
                            <input type="number" id="wizardCalories" class="form-input" value="${product.calories || 0}">
                        </div>
                    </div>

                    <div class="wizard-grid">
                        <div>
                            <label class="form-label">Состав</label>
                            <textarea id="wizardIngredients" class="form-input" rows="2">${this.escapeHtml(product.ingredients || '')}</textarea>
                        </div>
                        <div>
                            <label class="form-label">Аллергены</label>
                            <textarea id="wizardAllergens" class="form-input" rows="2">${this.escapeHtml(product.allergens || '')}</textarea>
                        </div>
                    </div>
                </div>
            `;
        },

        initMediaLibrary(product = {}) {
            if (!this.isFeatureEnabled('advancedMediaUX')) {
                this.mediaLibrary = [];
                return;
            }
            this.mediaLibrary = this.normalizeMediaAssets(
                Array.isArray(product.images) ? product.images : [],
                product.image_url,
                product.name
            );
        },

        normalizeMediaAssets(images = [], fallbackUrl = null, alt = '') {
            const base = (images || [])
                .filter((img) => img && (img.url || img.file_id))
                .map((img, idx) => ({
                    id: img.id || `media-${Date.now()}-${idx}`,
                    url: img.url || '',
                    file_id: img.file_id || null,
                    role: img.role || (idx === 0 ? 'primary' : idx === 1 ? 'hover' : 'gallery'),
                    alt_text: img.alt_text || alt || '',
                    effects: {
                        zoom: Boolean(img.effects?.zoom),
                        tint: img.effects?.tint || '',
                        overlayText: img.effects?.overlayText || '',
                        clickAction: img.effects?.clickAction || 'lightbox'
                    },
                    order: typeof img.order === 'number' ? img.order : idx
                }));
            if (!base.length && fallbackUrl) {
                base.push({
                    id: `media-${Date.now()}`,
                    url: fallbackUrl,
                    file_id: null,
                    role: 'primary',
                    alt_text: alt || '',
                    effects: {
                        zoom: false,
                        tint: '',
                        overlayText: '',
                        clickAction: 'lightbox'
                    },
                    order: 0
                });
            }
            return base
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((asset, idx) => ({ ...asset, order: idx }));
        },

        renderWizardImages(product) {
            if (!this.isFeatureEnabled('advancedMediaUX')) {
                return this.renderSimpleImageFields(product);
            }
            return `
                <div class="wizard-section">
                    <p style="color:#6b7280; font-size:0.9rem;">Перетаскивайте файлы, меняйте порядок, отмечайте изображение для ховера и задавайте эффекты.</p>
                    <div class="media-dropzone"
                        ondragover="ProductCardsManager.handleMediaDropZone(event)"
                        ondrop="ProductCardsManager.handleMediaDropZone(event)"
                        style="margin-bottom:1rem; padding:1rem; border:2px dashed rgba(33,128,141,0.4); border-radius:12px; text-align:center; background:rgba(33,128,141,0.05);">
                        <p style="margin:0; font-weight:600; color:rgba(33,128,141,1);">Перетащите изображения или</p>
                        <div style="margin-top:0.5rem; display:flex; gap:0.5rem; justify-content:center; flex-wrap:wrap;">
                            <button type="button" class="btn btn--secondary" onclick="document.getElementById('wizardMediaFileInput').click()">📁 Выбрать файлы</button>
                            <button type="button" class="btn btn--ghost" onclick="ProductCardsManager.promptMediaUrl()">🔗 Вставить ссылку</button>
                        </div>
                        <input type="file" id="wizardMediaFileInput" accept="image/*" multiple style="display:none" onchange="ProductCardsManager.handleMediaFileInput(event)">
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label class="form-label">Добавить изображение по ссылке</label>
                        <div style="display:flex; gap:0.5rem;">
                            <input type="url" id="wizardImageUrl" class="form-input" placeholder="https://example.com/photo.jpg">
                            <button type="button" class="btn btn--secondary" onclick="ProductCardsManager.addMediaFromInputUrl()">Добавить</button>
                        </div>
                    </div>
                    <div id="mediaCardsContainer">
                        ${this.renderMediaCards()}
                    </div>
                    <label class="form-label" style="margin-top: 1rem;">Режим фото</label>
                    <select id="wizardPhotoMode" class="form-input">
                        <option value="with_background" ${product.photo_mode === 'with_background' ? 'selected' : ''}>С фоном</option>
                        <option value="no_background" ${product.photo_mode === 'no_background' ? 'selected' : ''}>Без фона</option>
                    </select>
                </div>
            `;
        },

        renderSimpleImageFields(product) {
            return `
                <div class="wizard-section">
                    <label class="form-label">URL изображения</label>
                    <input type="url" id="wizardImageUrl" class="form-input" value="${this.escapeHtml(product.image_url || '')}" placeholder="https://example.com/photo.jpg">
                    ${product.image_url ? `<img src="${product.image_url}" alt="preview" style="width: 120px; border-radius: 8px; margin-top: 0.75rem;">` : ''}

                    <label class="form-label" style="margin-top: 1rem;">Режим фото</label>
                    <select id="wizardPhotoMode" class="form-input">
                        <option value="with_background" ${product.photo_mode === 'with_background' ? 'selected' : ''}>С фоном</option>
                        <option value="no_background" ${product.photo_mode === 'no_background' ? 'selected' : ''}>Без фона</option>
                    </select>
                </div>
            `;
        },

        renderMediaCards() {
            if (!Array.isArray(this.mediaLibrary) || !this.mediaLibrary.length) {
                return `<p style="color:#9ca3af; text-align:center; padding:1rem; border:1px dashed rgba(148,163,184,0.6); border-radius:12px;">Пока нет изображений. Добавьте хотя бы одно фото.</p>`;
            }
            return `
                <div style="display:flex; flex-direction:column; gap:0.75rem;">
                    ${this.mediaLibrary
                        .map(
                            (asset) => `
                        <div class="media-card" draggable="true"
                            data-media-id="${asset.id}"
                            ondragstart="ProductCardsManager.handleMediaDragStart(event, '${asset.id}')"
                            ondragover="ProductCardsManager.handleMediaDragOver(event)"
                            ondrop="ProductCardsManager.handleMediaDrop(event, '${asset.id}')"
                            style="display:flex; gap:1rem; padding:0.75rem; border:1px solid rgba(148,163,184,0.4); border-radius:14px; background:white; box-shadow:0 1px 2px rgba(15,23,42,0.08);">
                            <div style="width:110px; height:110px; border-radius:10px; overflow:hidden; border:1px solid rgba(148,163,184,0.3); background:rgba(248,250,252,1); display:flex; align-items:center; justify-content:center;">
                                ${
                                    asset.url
                                        ? `<img src="${asset.url}" alt="${this.escapeHtml(asset.alt_text || '')}" style="width:100%; height:100%; object-fit:cover;">`
                                        : '<span style="color:#9ca3af; font-size:0.8rem;">Нет превью</span>'
                                }
                            </div>
                            <div style="flex:1; display:flex; flex-direction:column; gap:0.35rem;">
                                <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
                                    <select class="form-input" style="max-width:160px;"
                                        onchange="ProductCardsManager.handleMediaRoleChange('${asset.id}', this.value)">
                                        <option value="primary" ${asset.role === 'primary' ? 'selected' : ''}>Основное</option>
                                        <option value="hover" ${asset.role === 'hover' ? 'selected' : ''}>Ховер</option>
                                        <option value="gallery" ${asset.role === 'gallery' ? 'selected' : ''}>Галерея</option>
                                    </select>
                                    <span style="font-size:0.8rem; color:#94a3b8;">Перетащите, чтобы упорядочить</span>
                                </div>
                                <label class="form-label" style="font-size:0.8rem;">Alt-текст</label>
                                <input type="text" class="form-input"
                                    value="${this.escapeHtml(asset.alt_text || '')}"
                                    oninput="ProductCardsManager.handleMediaAltChange('${asset.id}', this.value)">
                                <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:0.5rem; margin-top:0.35rem;">
                                    <label style="display:flex; gap:0.35rem; align-items:center;">
                                        <input type="checkbox" ${asset.effects?.zoom ? 'checked' : ''} onchange="ProductCardsManager.handleMediaEffectChange('${asset.id}', 'zoom', this.checked)">
                                        <span style="font-size:0.85rem;">Зум по клику</span>
                                    </label>
                                    <div>
                                        <label style="font-size:0.8rem; display:block;">Тон (HEX)</label>
                                        <input type="text" class="form-input" value="${this.escapeHtml(asset.effects?.tint || '')}" placeholder="#FFCC00"
                                            oninput="ProductCardsManager.handleMediaEffectChange('${asset.id}', 'tint', this.value)">
                                    </div>
                                    <div>
                                        <label style="font-size:0.8rem; display:block;">Текст сверху</label>
                                        <input type="text" class="form-input" value="${this.escapeHtml(asset.effects?.overlayText || '')}"
                                            oninput="ProductCardsManager.handleMediaEffectChange('${asset.id}', 'overlayText', this.value)">
                                    </div>
                                    <div>
                                        <label style="font-size:0.8rem; display:block;">Действие</label>
                                        <select class="form-input" onchange="ProductCardsManager.handleMediaEffectChange('${asset.id}', 'clickAction', this.value)">
                                            <option value="lightbox" ${asset.effects?.clickAction === 'lightbox' ? 'selected' : ''}>Lightbox</option>
                                            <option value="link" ${asset.effects?.clickAction === 'link' ? 'selected' : ''}>Ссылка</option>
                                            <option value="none" ${asset.effects?.clickAction === 'none' ? 'selected' : ''}>Нет</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div style="display:flex; flex-direction:column; gap:0.5rem; align-items:flex-end;">
                                <button type="button" class="btn btn--danger btn--sm" onclick="ProductCardsManager.removeMediaAsset('${asset.id}')">🗑️ Удалить</button>
                            </div>
                        </div>`
                        )
                        .join('')}
                </div>
            `;
        },

        refreshMediaLibrary() {
            const container = document.getElementById('mediaCardsContainer');
            if (container) {
                container.innerHTML = this.renderMediaCards();
            }
        },

        promptMediaUrl() {
            const url = prompt('Вставьте ссылку на изображение');
            if (url && url.trim()) {
                this.addMediaAsset({
                    url: url.trim(),
                    alt_text: this.wizardModal?.querySelector('#wizardName')?.value || '',
                    role: this.mediaLibrary.length ? 'gallery' : 'primary'
                });
            }
        },

        addMediaFromInputUrl() {
            const input = document.getElementById('wizardImageUrl');
            if (!input) return;
            const url = input.value.trim();
            if (!url) {
                alert('Введите ссылку на изображение');
                return;
            }
            this.addMediaAsset({
                url,
                alt_text: this.wizardModal?.querySelector('#wizardName')?.value || '',
                role: this.mediaLibrary.length ? 'gallery' : 'primary'
            });
            input.value = '';
        },

        async addMediaAsset(asset) {
            if (!asset?.url) return;
            const media = {
                id: asset.id || `media-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                url: asset.url,
                role: asset.role || (this.mediaLibrary.length ? 'gallery' : 'primary'),
                alt_text: asset.alt_text || '',
                effects: {
                    zoom: Boolean(asset.effects?.zoom),
                    tint: asset.effects?.tint || '',
                    overlayText: asset.effects?.overlayText || '',
                    clickAction: asset.effects?.clickAction || 'lightbox'
                },
                order: this.mediaLibrary.length
            };
            if (media.role === 'primary') {
                this.mediaLibrary.forEach((item) => {
                    if (item.role === 'primary') item.role = 'gallery';
                });
            }
            if (media.role === 'hover') {
                this.mediaLibrary.forEach((item) => {
                    if (item.role === 'hover') item.role = 'gallery';
                });
            }
            this.mediaLibrary.push(media);
            this.refreshMediaLibrary();
        },

        handleMediaFileInput(event) {
            const files = Array.from(event.target.files || []);
            files.forEach((file) => this.addMediaFile(file));
            event.target.value = '';
        },

        handleMediaDropZone(event) {
            event.preventDefault();
            const files = Array.from(event.dataTransfer?.files || []);
            if (files.length) {
                files.forEach((file) => this.addMediaFile(file));
            }
        },

        addMediaFile(file) {
            if (!file || !file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = () => {
                this.addMediaAsset({
                    url: reader.result,
                    alt_text: file.name,
                    role: this.mediaLibrary.length ? 'gallery' : 'primary'
                });
            };
            reader.readAsDataURL(file);
        },

        handleMediaDragStart(event, mediaId) {
            event.dataTransfer.setData('text/plain', mediaId);
        },

        handleMediaDragOver(event) {
            event.preventDefault();
        },

        handleMediaDrop(event, targetId) {
            event.preventDefault();
            const sourceId = event.dataTransfer.getData('text/plain');
            if (!sourceId || sourceId === targetId) return;
            this.moveMediaAsset(sourceId, targetId);
        },

        moveMediaAsset(sourceId, targetId) {
            const fromIndex = this.mediaLibrary.findIndex((item) => item.id === sourceId);
            const toIndex = this.mediaLibrary.findIndex((item) => item.id === targetId);
            if (fromIndex === -1 || toIndex === -1) return;
            const [moved] = this.mediaLibrary.splice(fromIndex, 1);
            this.mediaLibrary.splice(toIndex, 0, moved);
            this.mediaLibrary = this.mediaLibrary.map((asset, idx) => ({ ...asset, order: idx }));
            this.refreshMediaLibrary();
        },

        handleMediaAltChange(id, value) {
            const asset = this.mediaLibrary.find((item) => item.id === id);
            if (!asset) return;
            asset.alt_text = value;
        },

        handleMediaEffectChange(id, key, value) {
            const asset = this.mediaLibrary.find((item) => item.id === id);
            if (!asset) return;
            asset.effects = asset.effects || {};
            asset.effects[key] = key === 'zoom' ? Boolean(value) : value;
        },

        handleMediaRoleChange(id, role) {
            const asset = this.mediaLibrary.find((item) => item.id === id);
            if (!asset) return;
            if (role === 'primary' || role === 'hover') {
                this.mediaLibrary.forEach((item) => {
                    if (item.id !== id && item.role === role) {
                        item.role = 'gallery';
                    }
                });
            }
            asset.role = role;
            this.refreshMediaLibrary();
        },

        removeMediaAsset(id) {
            this.mediaLibrary = this.mediaLibrary.filter((item) => item.id !== id);
            if (!this.mediaLibrary.some((item) => item.role === 'primary') && this.mediaLibrary.length) {
                this.mediaLibrary[0].role = 'primary';
            }
            this.refreshMediaLibrary();
        },

        renderWizardVariations(product) {
            if (!Array.isArray(this.variantParameters) || !this.variantParameters.length) {
                this.variantParameters = this.buildVariantParametersFromProduct(product);
            }
            const parametersSection = this.renderVariantParametersSection();
            return `
                <div class="wizard-section">
                    ${parametersSection}
                    <p style="margin-top:1rem;">Добавьте варианты товара (размеры, вкусы, упаковки). Они сохранятся как отдельные вариации.</p>
                    <div id="variantsContainer">
                        ${this.renderVariantsEditor(product)}
                    </div>
                    <button type="button" onclick="ProductCardsManager.addVariant()" class="btn btn--secondary" style="margin-top: 0.75rem;">➕ Добавить вариант</button>
                </div>
            `;
        },

        renderWizardModifiers(product) {
            const selectedIds = Array.isArray(product.modifiers)
                ? product.modifiers.map((m) => m.group_id || m.id)
                : [];
            if (!this.modifiers.length) {
                return '<p style="color: #9ca3af;">Нет доступных групп модификаторов</p>';
            }
            return `
                <div class="wizard-section">
                    <p>Выберите группы модификаторов, доступные при оформлении заказа.</p>
                    <div class="wizard-modifiers">
                        ${this.modifiers
                            .map(
                                (group) => `
                            <label class="wizard-modifier">
                                <input type="checkbox" class="wizard-modifier-checkbox" value="${group.group_id}" ${selectedIds.includes(group.group_id) ? 'checked' : ''}>
                                <div>
                                    <div style="font-weight: 600;">${group.group_name}</div>
                                    <div style="font-size: 0.8rem; color: #6b7280;">Опций: ${group.options?.length || 0}</div>
                                </div>
                            </label>`
                            )
                            .join('')}
                    </div>
                </div>
            `;
        },

        renderWizardRecommendations(product) {
            return `
                <div class="wizard-section">
                    <p>Укажите товары, которые будут рекомендованы вместе с этим.</p>
                    <div id="recommendedContainer">
                        ${this.renderRecommendedEditor(product)}
                    </div>
                    <button type="button" onclick="ProductCardsManager.addRecommended()" class="btn btn--secondary" style="margin-top: 0.75rem;">➕ Добавить</button>
                </div>
            `;
        },

        renderWizardAdvanced(product) {
            return `
                <div class="wizard-section">
                    <div class="wizard-grid">
                        <div>
                            <label class="form-label">Налоговая система</label>
                            <input type="text" id="wizardTaxSystem" class="form-input" value="${this.escapeHtml(product.tax_system || 'osn')}">
                        </div>
                        <div>
                            <label class="form-label">Ставка НДС</label>
                            <input type="text" id="wizardVatRate" class="form-input" value="${this.escapeHtml(product.vat_rate || '20%')}">
                        </div>
                    </div>
                    <div class="wizard-grid">
                        <div>
                            <label class="form-label">Минимальный остаток</label>
                            <input type="number" id="wizardMinStock" class="form-инput" value="${product.min_stock || 0}">
                        </div>
                        <div>
                            <label class="form-label">Минимальный заказ</label>
                            <input type="number" id="wizardMinOrder" class="form-input" value="${product.min_order_qty || 1}">
                        </div>
                    </div>
                    <label class="form-label">SEO описание</label>
                    <textarea id="wizardSeoDescription" class="form-input" rows="2">${this.escapeHtml(product.seo_description || '')}</textarea>
                    <label class="form-label">SEO ссылка</label>
                    <input type="text" id="wizardSeoUrl" class="form-input" value="${this.escapeHtml(product.product_page_url || '')}">
                    <div class="wizard-grid" style="margin-top: 1rem;">
                        <label style="display: flex; gap: 0.5rem; align-items: center;">
                            <input type="checkbox" id="wizardVisible" ${product.is_visible !== false ? 'checked' : ''}>
                            <span>Видим на сайте</span>
                        </label>
                        <label style="display: flex; gap: 0.5rem; align-items: center;">
                            <input type="checkbox" id="wizardNoDiscounts" ${product.forbid_discounts ? 'checked' : ''}>
                            <span>Запрет скидок</span>
                        </label>
                        <label style="display: flex; gap: 0.5rem; align-items: center;">
                            <input type="checkbox" id="wizardNoLoyalty" ${product.forbid_loyalty ? 'checked' : ''}>
                            <span>Запрет бонусов</span>
                        </label>
                    </div>
                </div>
            `;
        },

        renderWizardReview(product, mode) {
            const summary = `
                <ul style="padding-left: 1.2rem; line-height: 1.4;">
                    <li><strong>Название:</strong> ${this.escapeHtml(product.name)}</li>
                    <li><strong>SKU:</strong> ${this.escapeHtml(product.sku)}</li>
                    <li><strong>Цена:</strong> ${product.price} ₽</li>
                    <li><strong>Остаток:</strong> ${product.quantity}</li>
                    <li><strong>Категории:</strong> ${this.getProductCategories(product).join(', ')}</li>
                </ul>
            `;
            const canSync = this.can('sync.trigger');
            const syncControls = canSync
                ? `<div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                        <button type="button" data-sync-targets="pos" class="btn btn--secondary" ${!product.id ? 'disabled' : ''}>Синхронизировать POS</button>
                        <button type="button" data-sync-targets="mobile" class="btn btn--secondary" ${!product.id ? 'disabled' : ''}>Синхронизировать мобильный</button>
                    </div>`
                : '<p style="margin-top:1rem; font-size:0.9rem; color:#9ca3af;">Роль не может запускать синхронизацию.</p>';
            return `
                <div class="wizard-section">
                    <h4>Проверьте данные перед сохранением</h4>
                    ${summary}
                    <div style="margin: 1rem 0;">
                        <h4>Синхронизация</h4>
                        <div id="wizardSyncStatus">${product.id ? this.renderSyncStatusBadges(product.id) : '<span style="color:#9ca3af;">Появится после создания.</span>'}</div>
                    </div>
                    <div style="margin-top: 1rem;">
                        <h4>История изменений</h4>
                        <div id="historyTimeline">${product.id ? this.renderHistoryTimeline(product.id) : '<p style="color:#9ca3af;">История появится после создания товара.</p>'}</div>
                    </div>
                    ${syncControls}
                </div>
            `;
        },

        goToWizardStep(index) {
            if (!this.wizardState) return;
            const total = this.wizardState.steps.length;
            if (index < 0 || index >= total) return;
            this.wizardState.stepIndex = index;
            const modal = this.wizardModal;
            if (!modal) return;
            modal.querySelectorAll('.wizard-step-content').forEach((section) => {
                section.style.display = parseInt(section.dataset.stepIndex, 10) === index ? '' : 'none';
            });
            modal.querySelectorAll('.wizard-step-link').forEach((btn) => {
                btn.classList.toggle('active', parseInt(btn.dataset.stepIndex, 10) === index);
            });
            const footer = modal.querySelector('#wizardStepIndicator');
            if (footer) footer.textContent = index + 1;
            const prevBtn = modal.querySelector('#wizardPrevBtn');
            const nextBtn = modal.querySelector('#wizardNextBtn');
            const saveBtn = modal.querySelector('#wizardSaveBtn');
            if (prevBtn) prevBtn.disabled = index === 0;
            if (nextBtn) nextBtn.disabled = index === total - 1;
            if (saveBtn) saveBtn.style.display = index === total - 1 ? '' : 'none';
        },

        generateVariantPayloads() {
            const variantItems = document.querySelectorAll('.variant-item');
            return Array.from(variantItems).map((item, idx) => ({
                variant_id: item.getAttribute('data-variant-id') || `var-${Date.now()}-${idx}`,
                sku: `${document.getElementById('wizardSku').value.trim() || 'SKU'}-var-${idx + 1}`,
                name: item.querySelector('.variant-name')?.value.trim() || '',
                price: parseFloat(item.querySelector('.variant-price')?.value) || 0,
                stock: parseInt(item.querySelector('.variant-stock')?.value) || 0
            })).filter((variant) => variant.name);
        },

        collectWizardFormData() {
            const form = document.getElementById('productWizardForm');
            const selectedCategories = Array.from(form.querySelectorAll('.wizard-category-checkbox:checked')).map((cb) => cb.value);
            const modifiers = Array.from(form.querySelectorAll('.wizard-modifier-checkbox:checked'))
                .map((cb) => this.modifiers.find((group) => group.group_id === cb.value))
                .filter(Boolean)
                .map((group) => JSON.parse(JSON.stringify(group)));
            const recommended = Array.from(document.querySelectorAll('.recommended-item'))
                .map((item) => item.getAttribute('data-product-id'))
                .filter(Boolean);

            const customAttributes = [];
            const photoMode = document.getElementById('wizardPhotoMode')?.value;
            if (photoMode) customAttributes.push({ name: 'photo_mode', value: photoMode });
            const pageUrl = document.getElementById('wizardSeoUrl')?.value.trim();
            if (pageUrl) customAttributes.push({ name: 'product_page_url', value: pageUrl });
            const ingredients = document.getElementById('wizardIngredients')?.value.trim();
            if (ingredients) customAttributes.push({ name: 'ingredients', value: ingredients });
            const allergens = document.getElementById('wizardAllergens')?.value.trim();
            if (allergens) customAttributes.push({ name: 'allergens', value: allergens });

            let mediaAssets = [];
            if (this.isFeatureEnabled('advancedMediaUX')) {
                mediaAssets = (this.mediaLibrary || []).map((asset, idx) => ({
                    id: asset.id || `media-${idx}`,
                    url: asset.url,
                    role: asset.role || (idx === 0 ? 'primary' : idx === 1 ? 'hover' : 'gallery'),
                    alt_text: asset.alt_text || '',
                    effects: {
                        zoom: Boolean(asset.effects?.zoom),
                        tint: asset.effects?.tint || '',
                        overlayText: asset.effects?.overlayText || '',
                        clickAction: asset.effects?.clickAction || 'lightbox'
                    },
                    order: idx
                }));
            } else {
                const simpleUrl = form.querySelector('#wizardImageUrl')?.value.trim();
                if (simpleUrl) {
                    mediaAssets = [
                        {
                            id: `media-${Date.now()}`,
                            url: simpleUrl,
                            role: 'primary',
                            alt_text: form.querySelector('#wizardName')?.value.trim() || '',
                            effects: {
                                zoom: false,
                                tint: '',
                                overlayText: '',
                                clickAction: 'lightbox'
                            },
                            order: 0
                        }
                    ];
                }
            }
            const primaryImage = mediaAssets.find((asset) => asset.role === 'primary') || mediaAssets[0] || null;

            return {
                name: form.querySelector('#wizardName').value.trim(),
                sku: form.querySelector('#wizardSku').value.trim(),
                barcode: form.querySelector('#wizardBarcode').value.trim(),
                type: form.querySelector('#wizardType').value,
                categories: selectedCategories,
                price: parseFloat(form.querySelector('#wizardPrice').value) || 0,
                purchase_price: parseFloat(form.querySelector('#wizardPurchasePrice').value) || 0,
                quantity: parseInt(form.querySelector('#wizardQuantity').value) || 0,
                short_description: form.querySelector('#wizardShortDescription').value.trim(),
                full_description: form.querySelector('#wizardFullDescription').value.trim(),
                weight: form.querySelector('#wizardWeight').value.trim(),
                calories: parseInt(form.querySelector('#wizardCalories').value) || 0,
                image_url: primaryImage?.url || form.querySelector('#wizardImageUrl')?.value.trim() || '',
                visible_on_site: form.querySelector('#wizardVisible').checked,
                hidden_for_promo: form.querySelector('#wizardNoDiscounts').checked,
                forbid_loyalty: form.querySelector('#wizardNoLoyalty').checked,
                recommended_products: recommended,
                variations: this.generateVariantPayloads(),
                modifiers,
                custom_attributes: customAttributes,
                tax_system: form.querySelector('#wizardTaxSystem').value.trim(),
                vat_rate: form.querySelector('#wizardVatRate').value.trim(),
                min_stock: parseInt(form.querySelector('#wizardMinStock').value) || 0,
                min_order_qty: parseInt(form.querySelector('#wizardMinOrder').value) || 1,
                images: mediaAssets
            };
        },

        async submitProductWizard() {
            if (!this.wizardState) return;
            const data = this.collectWizardFormData();
            if (!data.name || !data.sku) {
                alert('❌ Заполните обязательные поля: Название и SKU');
                return;
            }
            const payload = this.transformLegacyPayload(data);
            payload.variations = data.variations.map((variant) => ({
                variant_id: variant.variant_id,
                sku: variant.sku,
                price: variant.price,
                quantity: variant.stock,
                parameters: [{ name: 'Вариант', value: variant.name, display: 'list' }]
            }));
            payload.related_products = data.recommended_products.map((id, idx) => ({ product_id: id, position: idx }));
            payload.modifiers = data.modifiers;
            payload.custom_attributes = data.custom_attributes;
            payload.images = Array.isArray(data.images) ? data.images : [];
            if (!payload.images.length && data.image_url) {
                payload.images = [
                    {
                        id: `media-${Date.now()}`,
                        url: data.image_url,
                        role: 'primary',
                        alt_text: data.name || ''
                    }
                ];
            }
            const primaryAsset =
                payload.images.find((asset) => asset.role === 'primary') || payload.images[0] || null;
            payload.image_url = primaryAsset?.url || data.image_url || '';

            try {
                if (this.wizardState.mode === 'create') {
                    await this.catalogRequest('/products', { method: 'POST', body: payload });
                } else if (this.wizardState.productId) {
                    await this.catalogRequest(`/products/${encodeURIComponent(this.wizardState.productId)}`, {
                        method: 'PUT',
                        body: payload
                    });
                }
                await this.deleteDraftSnapshot();
                const savedProductId = this.wizardState.productId;
                const wasCreate = this.wizardState.mode === 'create';
                if (wasCreate) {
                    localStorage.removeItem('dandy_new_product_draft_id');
                }
                this.closeWizardModal();
                alert('✅ Товар сохранён');
                await this.loadProducts();
                await this.syncToWebsite(true);
                if (!wasCreate && savedProductId) {
                    this.refreshHistoryTimeline(savedProductId);
                }
            } catch (error) {
                console.error('Wizard save error:', error);
                alert(`❌ Ошибка сохранения: ${error.message}`);
            }
        },

        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    };

    ProductCardsManager.bootstrapPreferences();

    // Экспортируем глобально
    window.ProductCardsManager = ProductCardsManager;

    // Автоинициализация при загрузке
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('🛍️ Product Cards Manager: Ready');
        });
    }
})();

