// ===== Reports Module - Расширенная отчётность =====

class ReportsModule {
    constructor() {
        this.currentReport = 'financial';
        this.dateRange = {
            start: new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0],
            end: new Date().toISOString().split('T')[0]
        };
        this.orders = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadReportData();
    }

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('report-type-btn')) {
                this.switchReport(e.target.dataset.report);
            }
            if (e.target.id === 'generateReport') {
                this.generateReport();
            }
        });
    }

    async loadReportData() {
        try {
            const response = await fetch('/api/orders');
            if (response.ok) {
                const result = await response.json();
                this.orders = result.data || result || [];
            }
        } catch (error) {
            console.error('Reports: Ошибка загрузки:', error);
            this.orders = [];
        }
    }

    switchReport(type) {
        this.currentReport = type;
        document.querySelectorAll('.report-type-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-report="${type}"]`)?.classList.add('active');
        this.render();
    }

    async generateReport() {
        await this.loadReportData();
        this.render();
    }

    filterOrdersByDate(orders) {
        const start = new Date(this.dateRange.start);
        const end = new Date(this.dateRange.end);
        end.setHours(23, 59, 59, 999);
        return orders.filter(o => {
            const orderDate = new Date(o.created_at);
            return orderDate >= start && orderDate <= end;
        });
    }

    render() {
        const container = document.getElementById('reportsContent');
        if (!container) return;
        
        const orders = this.filterOrdersByDate(this.orders);
        const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
        const totalOrders = orders.length;
        const avgCheck = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        
        container.innerHTML = `
            <div style="background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <h2 style="margin: 0 0 1.5rem 0; color: var(--dandy-green);">📊 Отчётность</h2>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                    <div style="background: #dbeafe; padding: 1.5rem; border-radius: 8px;">
                        <div style="font-size: 0.85rem; color: #1e40af;">Выручка</div>
                        <div style="font-size: 2rem; font-weight: 700; color: #1e40af;">${totalRevenue.toFixed(0)} ₽</div>
                    </div>
                    <div style="background: #fef3c7; padding: 1.5rem; border-radius: 8px;">
                        <div style="font-size: 0.85rem; color: #92400e;">Заказов</div>
                        <div style="font-size: 2rem; font-weight: 700; color: #92400e;">${totalOrders}</div>
                    </div>
                    <div style="background: #d1fae5; padding: 1.5rem; border-radius: 8px;">
                        <div style="font-size: 0.85rem; color: #065f46;">Средний чек</div>
                        <div style="font-size: 2rem; font-weight: 700; color: #065f46;">${avgCheck.toFixed(0)} ₽</div>
                    </div>
                </div>
                
                <button id="generateReport" style="padding: 0.75rem 1.5rem; background: var(--dandy-green); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; margin-right: 0.5rem;">
                    🔄 Обновить
                </button>
            </div>
        `;
    }
}

window.reportsModule = null;

window.initReports = function() {
    if (window.reportsModule) window.reportsModule = null;
    window.reportsModule = new ReportsModule();
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReportsModule;
}
