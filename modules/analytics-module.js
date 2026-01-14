/**
 * МОДУЛЬ АНАЛИТИКИ
 * Google Analytics, Яндекс.Метрика, внутренняя аналитика
 */

class AnalyticsModule {
    constructor() {
        this.config = {
            googleAnalyticsId: 'UA-XXXXXXXXX-X', // Замените на свой ID
            yandexMetrikaId: 'XXXXXXXX', // Замените на свой ID
            enableInternalAnalytics: true
        };
        
        this.events = [];
        this.pageViews = [];
        this.init();
    }

    init() {
        console.log('📊 Инициализация аналитики...');
        this.initGoogleAnalytics();
        this.initYandexMetrika();
        this.initInternalAnalytics();
    }

    // ===== GOOGLE ANALYTICS =====
    
    initGoogleAnalytics() {
        // Загружаем Google Analytics
        (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
        (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
        m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
        })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');

        ga('create', this.config.googleAnalyticsId, 'auto');
        ga('send', 'pageview');
        
        console.log('✅ Google Analytics подключен');
    }

    trackPageView(path) {
        // Google Analytics
        if (typeof ga !== 'undefined') {
            ga('send', 'pageview', path);
        }

        // Яндекс.Метрика
        if (typeof ym !== 'undefined') {
            ym(this.config.yandexMetrikaId, 'hit', path);
        }

        // Внутренняя аналитика
        this.pageViews.push({
            path,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
        });

        this.saveInternalData();
    }

    trackEvent(category, action, label, value) {
        // Google Analytics
        if (typeof ga !== 'undefined') {
            ga('send', 'event', category, action, label, value);
        }

        // Яндекс.Метрика
        if (typeof ym !== 'undefined') {
            ym(this.config.yandexMetrikaId, 'reachGoal', action);
        }

        // Внутренняя аналитика
        this.events.push({
            category,
            action,
            label,
            value,
            timestamp: new Date().toISOString()
        });

        this.saveInternalData();
        console.log(`📈 Event: ${category} - ${action}`);
    }

    // ===== ЯНДЕКС.МЕТРИКА =====
    
    initYandexMetrika() {
        (function(m,e,t,r,i,k,a){
            m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
        })
        (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

        ym(this.config.yandexMetrikaId, "init", {
            clickmap:true,
            trackLinks:true,
            accurateTrackBounce:true,
            webvisor:true,
            ecommerce:"dataLayer"
        });

        console.log('✅ Яндекс.Метрика подключена');
    }

    // ===== ВНУТРЕННЯЯ АНАЛИТИКА =====
    
    initInternalAnalytics() {
        if (!this.config.enableInternalAnalytics) return;

        this.loadInternalData();
        console.log('✅ Внутренняя аналитика включена');
    }

    saveInternalData() {
        try {
            localStorage.setItem('analytics_events', JSON.stringify(this.events.slice(-1000)));
            localStorage.setItem('analytics_pageviews', JSON.stringify(this.pageViews.slice(-1000)));
        } catch (error) {
            console.error('Ошибка сохранения аналитики:', error);
        }
    }

    loadInternalData() {
        try {
            const events = localStorage.getItem('analytics_events');
            const pageViews = localStorage.getItem('analytics_pageviews');
            
            if (events) this.events = JSON.parse(events);
            if (pageViews) this.pageViews = JSON.parse(pageViews);
        } catch (error) {
            console.error('Ошибка загрузки аналитики:', error);
        }
    }

    // ===== СПЕЦИАЛЬНЫЕ СОБЫТИЯ =====
    
    trackOrder(order) {
        this.trackEvent('Ecommerce', 'Purchase', order.id, order.total);
        
        // Google Analytics Enhanced Ecommerce
        if (typeof ga !== 'undefined') {
            ga('ecommerce:addTransaction', {
                id: order.id,
                revenue: order.total,
                shipping: order.deliveryCost || 0
            });

            order.items.forEach(item => {
                ga('ecommerce:addItem', {
                    id: order.id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity || 1
                });
            });

            ga('ecommerce:send');
        }
    }

    trackAddToCart(product) {
        this.trackEvent('Ecommerce', 'AddToCart', product.name, product.price);
    }

    trackRemoveFromCart(product) {
        this.trackEvent('Ecommerce', 'RemoveFromCart', product.name, product.price);
    }

    trackSearch(query) {
        this.trackEvent('Search', 'Query', query);
    }

    // ===== ОТЧЁТЫ =====
    
    getReport(period = 'today') {
        const now = new Date();
        let startDate;

        switch (period) {
            case 'today':
                startDate = new Date(now.setHours(0, 0, 0, 0));
                break;
            case 'week':
                startDate = new Date(now.setDate(now.getDate() - 7));
                break;
            case 'month':
                startDate = new Date(now.setMonth(now.getMonth() - 1));
                break;
            default:
                startDate = new Date(0);
        }

        const filteredEvents = this.events.filter(e => 
            new Date(e.timestamp) >= startDate
        );

        const filteredPageViews = this.pageViews.filter(pv => 
            new Date(pv.timestamp) >= startDate
        );

        return {
            totalEvents: filteredEvents.length,
            totalPageViews: filteredPageViews.length,
            events: this.groupBy(filteredEvents, 'action'),
            pages: this.groupBy(filteredPageViews, 'path')
        };
    }

    groupBy(array, key) {
        return array.reduce((result, item) => {
            const group = item[key];
            result[group] = (result[group] || 0) + 1;
            return result;
        }, {});
    }

    showDashboard() {
        const report = this.getReport('today');

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <h2>📊 Аналитика за сегодня</h2>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                    <div class="stat-card" style="background: #dbeafe; padding: 20px; border-radius: 12px;">
                        <div style="font-size: 32px; font-weight: bold; color: #1e40af;">${report.totalPageViews}</div>
                        <div>Просмотров страниц</div>
                    </div>
                    <div class="stat-card" style="background: #d1fae5; padding: 20px; border-radius: 12px;">
                        <div style="font-size: 32px; font-weight: bold; color: #065f46;">${report.totalEvents}</div>
                        <div>Событий</div>
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <h3>🔥 Популярные страницы:</h3>
                    <ul style="list-style: none; padding: 0;">
                        ${Object.entries(report.pages).slice(0, 5).map(([page, count]) => `
                            <li style="padding: 10px; background: #f9fafb; margin-bottom: 5px; border-radius: 8px;">
                                ${page}: <strong>${count}</strong> просмотров
                            </li>
                        `).join('')}
                    </ul>
                </div>

                <div>
                    <h3>⚡ Популярные действия:</h3>
                    <ul style="list-style: none; padding: 0;">
                        ${Object.entries(report.events).slice(0, 5).map(([action, count]) => `
                            <li style="padding: 10px; background: #f9fafb; margin-bottom: 5px; border-radius: 8px;">
                                ${action}: <strong>${count}</strong> раз
                            </li>
                        `).join('')}
                    </ul>
                </div>

                <button class="btn" onclick="this.closest('.modal-overlay').remove()">Закрыть</button>
            </div>
        `;

        document.body.appendChild(modal);
    }
}

// Экспорт
window.AnalyticsModule = AnalyticsModule;
