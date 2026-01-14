/**
 * МОДУЛЬ ОПТИМИЗАЦИИ ПРОИЗВОДИТЕЛЬНОСТИ
 * Кэширование, lazy loading, минификация
 */

class PerformanceOptimizer {
    constructor() {
        this.cache = new Map();
        this.cacheExpiry = 300000; // 5 минут
        this.config = {
            enableCache: true,
            enableLazyLoading: true,
            enableImageOptimization: true,
            cdnUrl: 'https://cdn.yoursite.com' // Замените на ваш CDN
        };
        
        this.init();
    }

    init() {
        console.log('⚡ Оптимизатор производительности инициализирован');
        
        if (this.config.enableLazyLoading) {
            this.initLazyLoading();
        }
        
        if (this.config.enableImageOptimization) {
            this.optimizeImages();
        }

        this.preloadCriticalResources();
        this.measurePerformance();
    }

    // ===== КЭШИРОВАНИЕ =====
    
    setCache(key, value, expiry = this.cacheExpiry) {
        if (!this.config.enableCache) return;

        this.cache.set(key, {
            value,
            expiresAt: Date.now() + expiry
        });

        // Сохраняем в localStorage для персистентности
        try {
            localStorage.setItem(`cache_${key}`, JSON.stringify({
                value,
                expiresAt: Date.now() + expiry
            }));
        } catch (e) {
            console.warn('Ошибка сохранения в localStorage:', e);
        }
    }

    getCache(key) {
        if (!this.config.enableCache) return null;

        // Проверяем in-memory cache
        let cached = this.cache.get(key);
        
        // Если нет, проверяем localStorage
        if (!cached) {
            try {
                const stored = localStorage.getItem(`cache_${key}`);
                if (stored) {
                    cached = JSON.parse(stored);
                    this.cache.set(key, cached);
                }
            } catch (e) {
                console.warn('Ошибка чтения из localStorage:', e);
            }
        }

        if (!cached) return null;

        // Проверяем срок действия
        if (Date.now() > cached.expiresAt) {
            this.cache.delete(key);
            localStorage.removeItem(`cache_${key}`);
            return null;
        }

        return cached.value;
    }

    clearCache() {
        this.cache.clear();
        
        // Очищаем localStorage
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('cache_')) {
                localStorage.removeItem(key);
            }
        });

        console.log('🗑️ Кэш очищен');
    }

    // ===== LAZY LOADING =====
    
    initLazyLoading() {
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                        }
                        
                        if (img.dataset.srcset) {
                            img.srcset = img.dataset.srcset;
                            img.removeAttribute('data-srcset');
                        }

                        observer.unobserve(img);
                    }
                });
            });

            // Наблюдаем за всеми изображениями с data-src
            document.querySelectorAll('img[data-src]').forEach(img => {
                observer.observe(img);
            });

            console.log('✅ Lazy loading включен');
        }
    }

    // ===== ОПТИМИЗАЦИЯ ИЗОБРАЖЕНИЙ =====
    
    optimizeImages() {
        const images = document.querySelectorAll('img');
        
        images.forEach(img => {
            // Добавляем loading="lazy" для нативной поддержки
            if (!img.hasAttribute('loading')) {
                img.loading = 'lazy';
            }

            // Используем WebP если поддерживается
            if (this.supportsWebP() && img.src.match(/\.(jpg|jpeg|png)$/i)) {
                const webpUrl = img.src.replace(/\.(jpg|jpeg|png)$/i, '.webp');
                
                // Проверяем существование WebP версии
                this.checkImageExists(webpUrl).then(exists => {
                    if (exists) {
                        img.src = webpUrl;
                    }
                });
            }
        });
    }

    supportsWebP() {
        const elem = document.createElement('canvas');
        if (elem.getContext && elem.getContext('2d')) {
            return elem.toDataURL('image/webp').indexOf('data:image/webp') === 0;
        }
        return false;
    }

    async checkImageExists(url) {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            return response.ok;
        } catch {
            return false;
        }
    }

    // ===== ПРЕДЗАГРУЗКА =====
    
    preloadCriticalResources() {
        const criticalResources = [
            '/api/menu',
            '/api/categories',
            '/assets/brand/logo.svg'
        ];

        criticalResources.forEach(url => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = url.endsWith('.png') ? 'image' : 'fetch';
            link.href = url;
            document.head.appendChild(link);
        });

        console.log('✅ Критические ресурсы предзагружены');
    }

    // ===== CDN =====
    
    getCDNUrl(path) {
        if (!this.config.cdnUrl) return path;
        
        // Если путь начинается с /assets/, используем CDN
        if (path.startsWith('/assets/')) {
            return this.config.cdnUrl + path;
        }
        
        return path;
    }

    // ===== ИЗМЕРЕНИЕ ПРОИЗВОДИТЕЛЬНОСТИ =====
    
    measurePerformance() {
        if ('performance' in window) {
            window.addEventListener('load', () => {
                const perfData = performance.getEntriesByType('navigation')[0];
                
                const metrics = {
                    dns: perfData.domainLookupEnd - perfData.domainLookupStart,
                    tcp: perfData.connectEnd - perfData.connectStart,
                    request: perfData.responseStart - perfData.requestStart,
                    response: perfData.responseEnd - perfData.responseStart,
                    dom: perfData.domComplete - perfData.domLoading,
                    load: perfData.loadEventEnd - perfData.loadEventStart
                };

                console.log('📊 Метрики производительности:', metrics);

                // Отправляем метрики на сервер
                this.sendMetrics(metrics);
            });
        }
    }

    async sendMetrics(metrics) {
        try {
            await fetch('/api/metrics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(metrics)
            });
        } catch (error) {
            console.warn('Ошибка отправки метрик:', error);
        }
    }

    // ===== ДЕБАУНСИНГ И ТРОТТЛИНГ =====
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // ===== ОПТИМИЗАЦИЯ API ЗАПРОСОВ =====
    
    async cachedFetch(url, options = {}) {
        const cacheKey = `fetch_${url}`;
        const cached = this.getCache(cacheKey);

        if (cached) {
            console.log(`📦 Загружено из кэша: ${url}`);
            return cached;
        }

        try {
            const response = await fetch(url, options);
            const data = await response.json();

            this.setCache(cacheKey, data);
            return data;
        } catch (error) {
            console.error('Ошибка запроса:', error);
            throw error;
        }
    }

    // ===== МИНИФИКАЦИЯ HTML =====
    
    minifyHTML(html) {
        return html
            .replace(/\s+/g, ' ')
            .replace(/>\s+</g, '><')
            .trim();
    }

    // ===== DASHBOARD =====
    
    showPerformanceDashboard() {
        const perfData = performance.getEntriesByType('navigation')[0];
        const memory = performance.memory;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <h2>⚡ Производительность</h2>

                <div style="margin-bottom: 20px;">
                    <h3>🚀 Время загрузки</h3>
                    <div class="perf-bar" style="background: #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 10px;">
                        <div style="background: linear-gradient(90deg, #10b981, #059669); height: 40px; width: ${Math.min((perfData.loadEventEnd / 5000) * 100, 100)}%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
                            ${(perfData.loadEventEnd / 1000).toFixed(2)}s
                        </div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <div class="stat-box" style="background: #f0f9ff; padding: 15px; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: bold; color: #0369a1;">
                            ${this.cache.size}
                        </div>
                        <div style="color: #666;">Записей в кэше</div>
                    </div>
                    <div class="stat-box" style="background: #fef3c7; padding: 15px; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: bold; color: #92400e;">
                            ${memory ? (memory.usedJSHeapSize / 1048576).toFixed(1) : 'N/A'} MB
                        </div>
                        <div style="color: #666;">Использовано памяти</div>
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <h3>📊 Детализация</h3>
                    <ul style="list-style: none; padding: 0;">
                        <li style="padding: 8px; background: #f9fafb; margin-bottom: 5px; border-radius: 4px;">
                            DNS: <strong>${(perfData.domainLookupEnd - perfData.domainLookupStart).toFixed(0)}ms</strong>
                        </li>
                        <li style="padding: 8px; background: #f9fafb; margin-bottom: 5px; border-radius: 4px;">
                            Соединение: <strong>${(perfData.connectEnd - perfData.connectStart).toFixed(0)}ms</strong>
                        </li>
                        <li style="padding: 8px; background: #f9fafb; margin-bottom: 5px; border-radius: 4px;">
                            Запрос: <strong>${(perfData.responseStart - perfData.requestStart).toFixed(0)}ms</strong>
                        </li>
                        <li style="padding: 8px; background: #f9fafb; margin-bottom: 5px; border-radius: 4px;">
                            Ответ: <strong>${(perfData.responseEnd - perfData.responseStart).toFixed(0)}ms</strong>
                        </li>
                        <li style="padding: 8px; background: #f9fafb; margin-bottom: 5px; border-radius: 4px;">
                            DOM: <strong>${(perfData.domComplete - perfData.domLoading).toFixed(0)}ms</strong>
                        </li>
                    </ul>
                </div>

                <div style="display: flex; gap: 10px;">
                    <button class="btn btn-primary" onclick="performanceOptimizer.clearCache(); alert('Кэш очищен!');">
                        Очистить кэш
                    </button>
                    <button class="btn" onclick="this.closest('.modal-overlay').remove()">
                        Закрыть
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }
}

// Экспорт
window.PerformanceOptimizer = PerformanceOptimizer;
window.performanceOptimizer = new PerformanceOptimizer();
