/**
 * CRM MODULE
 * Управление лидами, сделками и клиентами
 */

class CRMModule {
  constructor() {
    this.leads = [];
    this.deals = [];
    this.stats = null;
    this.API_BASE = '/api/v1/crm';
    this.currentView = 'leads'; // leads, deals, stats
  }

  async init() {
    await this.loadStats();
    await this.loadLeads();
    await this.loadDeals();
    this.render();
  }

  async loadLeads() {
    try {
      const response = await fetch(`${this.API_BASE}/leads`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const result = await response.json();
      if (result.success) {
        this.leads = result.data;
      }
    } catch (error) {
      console.error('Error loading leads:', error);
    }
  }

  async loadDeals() {
    try {
      const response = await fetch(`${this.API_BASE}/deals`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const result = await response.json();
      if (result.success) {
        this.deals = result.data;
      }
    } catch (error) {
      console.error('Error loading deals:', error);
    }
  }

  async loadStats() {
    try {
      const response = await fetch(`${this.API_BASE}/stats`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const result = await response.json();
      if (result.success) {
        this.stats = result.data;
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  render() {
    const container = document.getElementById('crmContent') || document.getElementById('marketingContent');
    if (!container) return;

    container.innerHTML = `
      <div class="crm-module">
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3>💼 CRM - Управление клиентами</h3>
            <div style="display: flex; gap: 0.5rem;">
              <button class="btn btn-${this.currentView === 'leads' ? 'primary' : 'secondary'} btn-small" onclick="crmModule.switchView('leads')">👥 Лиды</button>
              <button class="btn btn-${this.currentView === 'deals' ? 'primary' : 'secondary'} btn-small" onclick="crmModule.switchView('deals')">💰 Сделки</button>
              <button class="btn btn-${this.currentView === 'stats' ? 'primary' : 'secondary'} btn-small" onclick="crmModule.switchView('stats')">📊 Статистика</button>
            </div>
          </div>

          ${this.renderView()}
        </div>
      </div>
    `;
  }

  renderView() {
    switch (this.currentView) {
      case 'leads':
        return this.renderLeadsKanban();
      case 'deals':
        return this.renderDeals();
      case 'stats':
        return this.renderStats();
      default:
        return '<p>Unknown view</p>';
    }
  }

  renderLeadsKanban() {
    const statuses = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
    const statusLabels = {
      new: '🆕 Новый',
      contacted: '☎️ Контакт',
      qualified: '✅ Квалифицирован',
      proposal: '📄 Предложение',
      negotiation: '💬 Переговоры',
      won: '🎉 Выигран',
      lost: '❌ Проигран'
    };

    const leadsByStatus = {};
    statuses.forEach(status => {
      leadsByStatus[status] = this.leads.filter(l => l.status === status);
    });

    return `
      <div style="margin-bottom: 1rem; text-align: right;">
        <button class="btn btn-primary" onclick="crmModule.showCreateLead()">➕ Создать лид</button>
      </div>
      
      <div class="kanban-board" style="display: flex; gap: 1rem; overflow-x: auto; padding-bottom: 1rem;">
        ${statuses.map(status => `
          <div class="kanban-column" style="flex: 0 0 250px; background: #f5f5f5; padding: 1rem; border-radius: 8px;">
            <h4 style="margin-bottom: 1rem; font-size: 0.9rem;">${statusLabels[status]} (${leadsByStatus[status].length})</h4>
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              ${leadsByStatus[status].map(lead => `
                <div class="lead-card" style="background: white; padding: 0.75rem; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); cursor: pointer;"
                     onclick="crmModule.viewLead('${lead.id}')">
                  <strong style="display: block; margin-bottom: 0.25rem;">${lead.name}</strong>
                  ${lead.email ? `<small style="display: block; color: #666;">${lead.email}</small>` : ''}
                  ${lead.phone ? `<small style="display: block; color: #666;">${lead.phone}</small>` : ''}
                  ${lead.value ? `<div style="margin-top: 0.5rem; font-weight: bold; color: #04746c;">${lead.value.toLocaleString('ru-RU', {style: 'currency', currency: 'RUB'})}</div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderDeals() {
    return `
      <div style="margin-bottom: 1rem; text-align: right;">
        <button class="btn btn-primary" onclick="crmModule.showCreateDeal()">➕ Создать сделку</button>
      </div>
      
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Название</th>
              <th>Сумма</th>
              <th>Этап</th>
              <th>Вероятность</th>
              <th>Ответственный</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            ${this.deals.length === 0 ? 
              '<tr><td colspan="6" style="text-align: center; color: #666;">Нет сделок</td></tr>' :
              this.deals.map(deal => `
                <tr>
                  <td><strong>${deal.title}</strong></td>
                  <td>${deal.amount.toLocaleString('ru-RU', {style: 'currency', currency: 'RUB'})}</td>
                  <td><span class="badge">${deal.stage}</span></td>
                  <td>${deal.probability}%</td>
                  <td>${deal.assigned_to_name || '-'}</td>
                  <td>
                    <button class="btn btn-small" onclick="crmModule.viewDeal('${deal.id}')">👁️</button>
                    <button class="btn btn-small btn-danger" onclick="crmModule.deleteDeal('${deal.id}')">🗑️</button>
                  </td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    `;
  }

  renderStats() {
    if (!this.stats) return '<p>Загрузка статистики...</p>';

    return `
      <div class="grid grid-4" style="gap: 1rem; margin-bottom: 2rem;">
        <div class="card" style="background: #f0f9ff; padding: 1.5rem;">
          <h4 style="margin: 0 0 0.5rem 0; color: #0369a1;">Всего лидов</h4>
          <div style="font-size: 2.5rem; font-weight: bold; color: #0284c7;">${this.stats.total_leads}</div>
        </div>
        <div class="card" style="background: #f0fdf4; padding: 1.5rem;">
          <h4 style="margin: 0 0 0.5rem 0; color: #16a34a;">Всего сделок</h4>
          <div style="font-size: 2.5rem; font-weight: bold; color: #22c55e;">${this.stats.total_deals}</div>
        </div>
        <div class="card" style="background: #fef3c7; padding: 1.5rem;">
          <h4 style="margin: 0 0 0.5rem 0; color: #d97706;">Выручка</h4>
          <div style="font-size: 2rem; font-weight: bold; color: #f59e0b;">${this.stats.total_revenue.toLocaleString('ru-RU', {style: 'currency', currency: 'RUB'})}</div>
        </div>
      </div>

      <div class="grid grid-2" style="gap: 1rem;">
        <div class="card" style="padding: 1rem;">
          <h4>Лиды по статусам</h4>
          ${this.stats.leads_by_status.map(item => `
            <div style="display: flex; justify-content: space-between; padding: 0.5rem; border-bottom: 1px solid #eee;">
              <span>${item.status}</span>
              <strong>${item.count}</strong>
            </div>
          `).join('')}
        </div>

        <div class="card" style="padding: 1rem;">
          <h4>Сделки по этапам</h4>
          ${this.stats.deals_by_stage.map(item => `
            <div style="display: flex; justify-content: space-between; padding: 0.5rem; border-bottom: 1px solid #eee;">
              <span>${item.stage}</span>
              <strong>${item.count} / ${parseFloat(item.total_amount || 0).toLocaleString('ru-RU', {style: 'currency', currency: 'RUB'})}</strong>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  switchView(view) {
    this.currentView = view;
    this.render();
  }

  showCreateLead() {
    const modal = this.createModal('Создать лид', `
      <form id="leadForm">
        <div class="form-group">
          <label class="form-label">Имя *</label>
          <input type="text" name="name" class="form-input" required>
        </div>
        <div class="grid grid-2" style="gap: 1rem;">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" name="email" class="form-input">
          </div>
          <div class="form-group">
            <label class="form-label">Телефон</label>
            <input type="tel" name="phone" class="form-input">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Компания</label>
          <input type="text" name="company" class="form-input">
        </div>
        <div class="form-group">
          <label class="form-label">Потенциальная сумма</label>
          <input type="number" name="value" class="form-input" step="0.01">
        </div>
        <div class="form-group">
          <label class="form-label">Заметки</label>
          <textarea name="notes" class="form-input" rows="3"></textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="crmModule.closeModal()">Отмена</button>
          <button type="submit" class="btn btn-primary">💾 Создать</button>
        </div>
      </form>
    `);

    document.getElementById('leadForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveLead(e.target);
    });
  }

  async saveLead(form) {
    try {
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      const response = await fetch(`${this.API_BASE}/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();
      
      if (result.success) {
        alert('✅ Лид создан!');
        this.closeModal();
        await this.loadLeads();
        await this.loadStats();
        this.render();
      } else {
        alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
      }
    } catch (error) {
      console.error('Error saving lead:', error);
      alert('❌ Ошибка соединения');
    }
  }

  showCreateDeal() {
    alert('🚧 Создание сделки - в разработке. Используйте API.');
  }

  viewLead(leadId) {
    const lead = this.leads.find(l => l.id === leadId);
    if (!lead) return;

    const modal = this.createModal(`Лид: ${lead.name}`, `
      <div style="padding: 1rem;">
        <p><strong>Email:</strong> ${lead.email || '-'}</p>
        <p><strong>Телефон:</strong> ${lead.phone || '-'}</p>
        <p><strong>Компания:</strong> ${lead.company || '-'}</p>
        <p><strong>Статус:</strong> ${lead.status}</p>
        <p><strong>Потенциальная сумма:</strong> ${lead.value ? lead.value.toLocaleString('ru-RU', {style: 'currency', currency: 'RUB'}) : '-'}</p>
        <p><strong>Заметки:</strong></p>
        <p>${lead.notes || '-'}</p>
      </div>
    `);
  }

  viewDeal(dealId) {
    alert('🚧 Просмотр сделки - в разработке');
  }

  async deleteDeal(dealId) {
    if (!confirm('Удалить эту сделку?')) return;
    alert('🚧 Удаление - в разработке');
  }

  createModal(title, content, footer = '', size = 'normal') {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;';
    modal.innerHTML = `
      <div style="background: white; padding: 2rem; border-radius: 8px; max-width: ${size === 'large' ? '900px' : '600px'}; max-height: 90vh; overflow-y: auto; width: 90%;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3>${title}</h3>
          <button onclick="crmModule.closeModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">×</button>
        </div>
        ${content}
        ${footer}
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) modal.remove();
  }
}

// Global instance
if (typeof window !== 'undefined') {
  window.CRMModule = CRMModule;
  window.crmModule = new CRMModule();
}

