/**
 * DANDY Pizza - Аналитика (Frontend)
 */

window.analyticsModule = {
  currentPeriod: 'today',

  async init() {
    this.loadDashboard();
    this.setupEventListeners();
    this.loadCharts();
  },

  setupEventListeners() {
    // Переключение периода
    document.querySelectorAll('.period-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.currentPeriod = e.target.dataset.period;
        this.loadDashboard();
      });
    });

    // Экспорт
    document.getElementById('exportBtn')?.addEventListener('click', () => {
      this.exportData();
    });
  },

  async loadDashboard() {
    try {
      const response = await fetch(`/api/v1/analytics/dashboard?period=${this.currentPeriod}`);
      const result = await response.json();

      if (result.success) {
        this.renderDashboard(result.data);
      }
    } catch (error) {
      console.error('Load dashboard error:', error);
    }
  },

  renderDashboard(data) {
    // Общая выручка
    document.getElementById('totalRevenue').textContent = 
      `${data.revenue.toLocaleString('ru-RU')} ₽`;

    // Количество заказов
    document.getElementById('ordersCount').textContent = data.ordersCount;

    // Средний чек
    document.getElementById('avgCheck').textContent = 
      `${data.avgCheck.toLocaleString('ru-RU')} ₽`;

    // Новые клиенты
    document.getElementById('newCustomers').textContent = data.newCustomers;

    // Топ товары
    const topProductsHTML = data.topProducts.map(product => `
      <div class="top-product-item">
        <span class="product-name">${product.product_name}</span>
        <span class="product-quantity">${product.quantity} шт</span>
        <span class="product-revenue">${product.revenue.toLocaleString('ru-RU')} ₽</span>
      </div>
    `).join('');
    document.getElementById('topProducts').innerHTML = topProductsHTML;
  },

  async loadCharts() {
    // График продаж
    const salesData = await this.fetchSalesData();
    this.renderSalesChart(salesData);

    // График по категориям
    const categoriesData = await this.fetchCategoriesData();
    this.renderCategoriesChart(categoriesData);
  },

  async fetchSalesData() {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const response = await fetch(`/api/v1/analytics/sales?startDate=${startDate}&endDate=${endDate}&groupBy=day`);
    const result = await response.json();
    return result.data;
  },

  renderSalesChart(data) {
    const canvas = document.getElementById('salesChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Простая визуализация (можно заменить на Chart.js)
    const labels = data.map(d => d.period);
    const revenues = data.map(d => d.revenue);

    // TODO: Использовать Chart.js для красивых графиков
    console.log('Sales chart data:', { labels, revenues });
  },

  async fetchCategoriesData() {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const response = await fetch(`/api/v1/analytics/products?startDate=${startDate}&endDate=${endDate}`);
    const result = await response.json();
    return result.data;
  },

  renderCategoriesChart(data) {
    // Группировка по категориям
    const categories = {};
    data.forEach(product => {
      if (!categories[product.category]) {
        categories[product.category] = 0;
      }
      categories[product.category] += parseFloat(product.revenue);
    });

    console.log('Categories data:', categories);
    // TODO: Pie chart с Chart.js
  },

  async exportData() {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    window.location.href = `/api/v1/analytics/export?type=sales&startDate=${startDate}&endDate=${endDate}`;
  },

  // Google Analytics tracking
  trackEvent(category, action, label, value) {
    if (typeof gtag !== 'undefined') {
      gtag('event', action, {
        event_category: category,
        event_label: label,
        value: value
      });
    }

    // Также логировать внутри
    this.logEvent(action, { category, label, value });
  },

  // Яндекс.Метрика
  reachGoal(goalId, params) {
    if (typeof ym !== 'undefined' && window.YM_COUNTER_ID) {
      ym(window.YM_COUNTER_ID, 'reachGoal', goalId, params);
    }
  },

  // Внутреннее логирование
  async logEvent(eventName, eventData) {
    try {
      await fetch('/api/v1/analytics/log-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: eventName,
          event_data: eventData,
          user_id: window.currentUserId,
          session_id: window.sessionId
        })
      });
    } catch (error) {
      console.error('Log event error:', error);
    }
  }
};

// Автоматическое отслеживание кликов
document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-track]');
  if (target) {
    const action = target.dataset.track;
    const category = target.dataset.trackCategory || 'click';
    const label = target.dataset.trackLabel || target.textContent;
    
    window.analyticsModule.trackEvent(category, action, label);
  }
});

// Отслеживание времени на странице
let pageLoadTime = Date.now();
window.addEventListener('beforeunload', () => {
  const timeOnPage = Math.floor((Date.now() - pageLoadTime) / 1000);
  window.analyticsModule.trackEvent('engagement', 'time_on_page', window.location.pathname, timeOnPage);
});

