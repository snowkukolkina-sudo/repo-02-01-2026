/**
 * Category Navigation Module
 * ---------------------------
 * Fetches category tree from API and renders nested navigation.
 * Designed to work for both admin panel and storefront.
 *
 * Usage:
 *   const nav = new CategoryNavigation('#mainNav', { ...options });
 *   await nav.refresh(); // to reload manually
 *
 * Options (with defaults):
 *   endpoint         - API endpoint for categories (default: '/api/v1/categories')
 *   requestInit      - fetch options override (method, headers, etc.)
 *   listClass        - CSS class for root <ul>
 *   subListClass     - CSS class for nested <ul>
 *   itemClass        - CSS class for <li> items
 *   linkClass        - CSS class for clickable element (button/anchor)
 *   linkTag          - tag name for clickable element ('button' | 'a' | 'span', default: 'button')
 *   activeClass      - class applied to current item on select
 *   autoSelectFirst  - automatically trigger first category after render (default: false)
 *   fallbackData     - array of categories used when API unavailable
 *   transformResponse(data) - function to transform API response to plain array
 *   onCategorySelect(category, element) - callback on click
 */

(function attachCategoryNavigation(global) {
    class CategoryNavigation {
        constructor(container, options = {}) {
            this.container = typeof container === 'string'
                ? document.querySelector(container)
                : container;

            if (!this.container) {
                console.warn('[CategoryNavigation] Container not found:', container);
                this.__inactive = true;
                return;
            }

            const dataset = this.container.dataset || {};

            this.options = {
                endpoint: options.endpoint || dataset.navEndpoint || '/api/v1/categories',
                requestInit: options.requestInit || null,
                listClass: options.listClass || dataset.navListClass || 'category-nav__list',
                subListClass: options.subListClass || dataset.navSubListClass || 'category-nav__list--nested',
                itemClass: options.itemClass || dataset.navItemClass || 'category-nav__item',
                linkClass: options.linkClass || dataset.navLinkClass || 'category-nav__link',
                linkTag: options.linkTag || dataset.navLinkTag || 'button',
                activeClass: options.activeClass || dataset.navActiveClass || 'is-active',
                autoSelectFirst: options.autoSelectFirst === undefined
                    ? dataset.navAutoSelect === 'true'
                    : Boolean(options.autoSelectFirst),
                fallbackData: options.fallbackData || parseJSONSafe(dataset.navFallback),
                transformResponse: options.transformResponse || null,
                onCategorySelect: options.onCategorySelect || null,
                emptyMessage: options.emptyMessage || dataset.navEmptyMessage || 'Категории не найдены',
                loadingClass: options.loadingClass || dataset.navLoadingClass || 'is-loading'
            };

            this.state = {
                categories: [],
                isLoading: false,
                activeId: null
            };

            this.init();
        }

        async init() {
            if (this.__inactive) return;
            await this.refresh();
        }

        async refresh() {
            if (this.__inactive) return;

            this.setLoading(true);

            try {
                const categories = await this.fetchCategories();
                this.state.categories = categories;
                this.render(categories);

                if (this.options.autoSelectFirst && categories.length) {
                    const first = categories[0];
                    this.setActive(first.id);
                    this.emitSelect(first);
                }
            } catch (error) {
                console.error('[CategoryNavigation] Failed to refresh:', error);
                this.renderFallback(error);
            } finally {
                this.setLoading(false);
            }
        }

        async fetchCategories() {
            const { endpoint, requestInit, fallbackData, transformResponse } = this.options;

            if (!endpoint) {
                if (Array.isArray(fallbackData)) {
                    return this.buildTree(fallbackData);
                }
                throw new Error('API endpoint is not defined');
            }

            try {
                const init = Object.assign({
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
                    }
                }, requestInit || {});

                const response = await fetch(endpoint, init);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status} ${response.statusText}`);
                }

                const payload = await response.json();
                const rawCategories = transformResponse
                    ? transformResponse(payload)
                    : normalizeCategoriesResponse(payload);

                if (!Array.isArray(rawCategories)) {
                    throw new Error('Received categories payload is not an array');
                }

                return this.buildTree(rawCategories);
            } catch (error) {
                if (Array.isArray(fallbackData)) {
                    console.info('[CategoryNavigation] Using fallback categories due to error:', error.message);
                    return this.buildTree(fallbackData);
                }
                throw error;
            }
        }

        buildTree(categories) {
            const map = new Map();
            const roots = [];

            categories.forEach(cat => {
                const normalised = Object.assign({
                    id: cat.id ?? cat.slug ?? cat.uuid ?? null,
                    parent_id: cat.parent_id ?? cat.parentId ?? cat.parent ?? null,
                    name: cat.name ?? cat.title ?? 'Без названия',
                    position: cat.position ?? cat.order ?? cat.sort_order ?? 0,
                    slug: cat.slug ?? null,
                    children: []
                }, cat);

                if (!normalised.id) {
                    normalised.id = `cat_${Math.random().toString(36).slice(2)}`;
                }

                map.set(normalised.id, normalised);
            });

            map.forEach(cat => {
                if (cat.parent_id && map.has(cat.parent_id)) {
                    map.get(cat.parent_id).children.push(cat);
                } else {
                    roots.push(cat);
                }
            });

            const sortRecursive = (nodes) => {
                nodes.sort((a, b) => (a.position || 0) - (b.position || 0));
                nodes.forEach(node => {
                    if (Array.isArray(node.children) && node.children.length) {
                        sortRecursive(node.children);
                    }
                });
            };

            sortRecursive(roots);
            return roots;
        }

        render(categories) {
            if (!this.container) return;

            this.container.innerHTML = '';

            if (!categories.length) {
                this.renderEmpty();
                this.container.dispatchEvent(new CustomEvent('category-nav:render', {
                    detail: { categories: [] }
                }));
                return;
            }

            const list = this.createList(categories, 0);
            this.container.appendChild(list);

            this.container.dispatchEvent(new CustomEvent('category-nav:render', {
                detail: { categories }
            }));
        }

        renderFallback(error) {
            console.warn('[CategoryNavigation] Rendering fallback. Reason:', error?.message || error);
            this.render(this.state.categories.length ? this.state.categories : []);
            if (!this.state.categories.length) {
                this.renderEmpty();
            }
        }

        renderEmpty() {
            const message = document.createElement('div');
            message.className = 'category-nav__empty';
            message.textContent = this.options.emptyMessage;
            this.container.appendChild(message);
        }

        createList(categories, depth = 0) {
            const isRoot = depth === 0;
            const list = document.createElement('ul');
            list.className = isRoot ? this.options.listClass : this.options.subListClass;
            
            // Добавляем поддержку drag&drop только для корневого уровня
            if (isRoot && this.options.enableDragDrop !== false) {
                this.setupDragDrop(list);
            }

            categories.forEach(category => {
                const item = document.createElement('li');
                item.className = this.options.itemClass;
                item.dataset.categoryId = category.id;
                
                // Делаем элемент перетаскиваемым только на корневом уровне
                if (isRoot && this.options.enableDragDrop !== false) {
                    item.draggable = true;
                    item.style.cursor = 'move';
                    item.addEventListener('dragstart', (e) => {
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', category.id);
                        item.classList.add('dragging');
                    });
                    item.addEventListener('dragend', () => {
                        item.classList.remove('dragging');
                    });
                    item.addEventListener('dragover', (e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        const afterElement = this.getDragAfterElement(list, e.clientY);
                        const dragging = document.querySelector('.dragging');
                        if (afterElement == null) {
                            list.appendChild(dragging);
                        } else {
                            list.insertBefore(dragging, afterElement);
                        }
                    });
                    item.addEventListener('drop', async (e) => {
                        e.preventDefault();
                        const categoryId = e.dataTransfer.getData('text/plain');
                        await this.handleCategoryReorder(list, categoryId);
                    });
                }

                const link = document.createElement(this.options.linkTag || 'button');

                if (link.tagName === 'A' && !link.getAttribute('href')) {
                    link.setAttribute('href', '#');
                }

                link.className = this.options.linkClass;
                link.textContent = category.name;
                link.dataset.categoryId = category.id;

                link.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.setActive(category.id, link);
                    this.emitSelect(category, link);
                });

                item.appendChild(link);

                if (Array.isArray(category.children) && category.children.length) {
                    const childList = this.createList(category.children, depth + 1);
                    item.appendChild(childList);
                }

                list.appendChild(item);
            });

            return list;
        }
        
        setupDragDrop(list) {
            // Дополнительная настройка для drag&drop
            list.addEventListener('dragover', (e) => {
                e.preventDefault();
            });
        }
        
        getDragAfterElement(container, y) {
            const draggableElements = Array.from(container.children)
                .filter((el) => el && el.tagName === 'LI' && !el.classList.contains('dragging'));
            
            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        }
        
        async handleCategoryReorder(list, draggedCategoryId) {
            const items = Array.from(list.querySelectorAll('li'));
            const newOrder = items.map((item, index) => ({
                id: parseInt(item.dataset.categoryId),
                position: index
            }));
            
            try {
                const response = await fetch('/api/categories/reorder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ categories: newOrder })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        // Обновляем порядок в локальном состоянии
                        await this.refresh();
                        console.log('✅ Категории переупорядочены');
                    }
                } else {
                    throw new Error('Failed to reorder categories');
                }
            } catch (error) {
                console.error('❌ Ошибка переупорядочивания категорий:', error);
                // Откатываем визуально - перезагружаем
                await this.refresh();
            }
        }

        setActive(categoryId, element) {
            this.state.activeId = categoryId;
            const { activeClass } = this.options;

            this.container.querySelectorAll(`[data-category-id]`).forEach(node => {
                node.classList.remove(activeClass);
                if (node.tagName === 'A' || node.tagName === 'BUTTON') {
                    node.classList.remove(activeClass);
                }
            });

            if (!categoryId) return;

            const targetItem = this.container.querySelector(`[data-category-id="${CSS.escape(categoryId)}"]`);
            if (targetItem) {
                targetItem.classList.add(activeClass);
            }

            const clickable = element || this.container.querySelector(`${this.options.linkTag}[data-category-id="${CSS.escape(categoryId)}"]`);
            if (clickable) {
                clickable.classList.add(activeClass);
            }
        }

        emitSelect(category, element) {
            if (typeof this.options.onCategorySelect === 'function') {
                try {
                    this.options.onCategorySelect(category, element);
                } catch (error) {
                    console.error('[CategoryNavigation] onCategorySelect error:', error);
                }
            }

            this.container.dispatchEvent(new CustomEvent('category-nav:select', {
                detail: { category, element }
            }));
        }

        setLoading(isLoading) {
            this.state.isLoading = isLoading;
            if (!this.container) return;
            this.container.classList.toggle(this.options.loadingClass, Boolean(isLoading));
        }
    }

    function normalizeCategoriesResponse(payload) {
        if (Array.isArray(payload)) return payload;
        if (!payload || typeof payload !== 'object') return [];

        if (Array.isArray(payload.data)) return payload.data;
        if (Array.isArray(payload.categories)) return payload.categories;
        if (payload.result && Array.isArray(payload.result.categories)) return payload.result.categories;

        return [];
    }

    function parseJSONSafe(value) {
        if (typeof value !== 'string') return undefined;
        try {
            return JSON.parse(value);
        } catch (error) {
            console.warn('[CategoryNavigation] Failed to parse JSON fallback data:', error);
            return undefined;
        }
    }

    async function createCategory(params = {}, options = {}) {
        const endpoint = options.endpoint || '/api/v1/categories';
        const headers = Object.assign({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }, options.headers || {});

        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(params)
        });

        if (!response.ok) {
            const errorPayload = await response.json().catch(() => ({}));
            const message = errorPayload.message || `HTTP ${response.status}`;
            throw new Error(message);
        }

        return response.json().catch(() => ({}));
    }

    global.CategoryNavigation = CategoryNavigation;
    global.initCategoryNavigation = (selector, options) => new CategoryNavigation(selector, options);
    global.createCategory = createCategory;
})(typeof window !== 'undefined' ? window : globalThis);


