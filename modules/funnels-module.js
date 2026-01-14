/**
 * FUNNELS MODULE
 * Управление автоворонками
 */

class FunnelsModule {
  constructor() {
    this.funnels = [];
    this.API_BASE = '/api/v1/funnels';
  }

  async init() {
    await this.loadFunnels();
    this.render();
  }

  async loadFunnels() {
    try {
      const response = await fetch(this.API_BASE, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const result = await response.json();
      if (result.success) {
        this.funnels = result.data;
      }
    } catch (error) {
      console.error('Error loading funnels:', error);
    }
  }

  render() {
    const container = document.getElementById('funnelsContent') || document.getElementById('marketingContent');
    if (!container) return;

    container.innerHTML = `
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3>🔄 Автоворонки</h3>
          <button class="btn btn-primary" onclick="funnelsModule.showCreateFunnel()">➕ Создать воронку</button>
        </div>
        
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Триггер</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              ${this.renderFunnelsRows()}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  renderFunnelsRows() {
    if (this.funnels.length === 0) {
      return '<tr><td colspan="4" style="text-align: center; color: #666;">Нет воронок. Создайте первую!</td></tr>';
    }

    const triggerLabels = {
      order_placed: '🛒 Заказ оформлен',
      order_completed: '✅ Заказ завершен',
      cart_abandoned: '🛒 Брошенная корзина',
      customer_registered: '👤 Регистрация',
      first_order: '🎉 Первый заказ',
      repeat_order: '🔁 Повторный заказ',
      birthday: '🎂 День рождения'
    };

    return this.funnels.map(funnel => `
      <tr>
        <td><strong>${funnel.name}</strong></td>
        <td>${triggerLabels[funnel.trigger] || funnel.trigger}</td>
        <td>
          <span class="badge badge-${funnel.is_active ? 'success' : 'secondary'}">
            ${funnel.is_active ? '✅ Активна' : '⏸️ Пауза'}
          </span>
        </td>
        <td>
          <button class="btn btn-small" onclick="funnelsModule.editFunnel('${funnel.id}')" title="Редактировать">✏️</button>
          <button class="btn btn-small btn-success" onclick="funnelsModule.testFunnel('${funnel.id}')" title="Тестировать">▶️</button>
          <button class="btn btn-small btn-danger" onclick="funnelsModule.deleteFunnel('${funnel.id}')" title="Удалить">🗑️</button>
        </td>
      </tr>
    `).join('');
  }

  showCreateFunnel() {
    const modal = this.createModal('Создать воронку', `
      <form id="funnelForm">
        <div class="form-group">
          <label class="form-label">Название *</label>
          <input type="text" name="name" class="form-input" required>
        </div>
        
        <div class="form-group">
          <label class="form-label">Описание</label>
          <textarea name="description" class="form-input" rows="2"></textarea>
        </div>
        
        <div class="form-group">
          <label class="form-label">Триггер *</label>
          <select name="trigger" class="form-input" required>
            <option value="order_placed">🛒 Заказ оформлен</option>
            <option value="order_completed">✅ Заказ завершен</option>
            <option value="cart_abandoned">🛒 Брошенная корзина</option>
            <option value="customer_registered">👤 Регистрация</option>
            <option value="first_order">🎉 Первый заказ</option>
            <option value="repeat_order">🔁 Повторный заказ</option>
            <option value="birthday">🎂 День рождения</option>
          </select>
        </div>
        
        <div class="form-group">
          <label class="form-label">Задержка (минут)</label>
          <input type="number" name="delay_minutes" class="form-input" value="0" min="0">
        </div>
        
        <div class="form-group">
          <label class="form-label">Действия *</label>
          <div id="actionsContainer">
            <div class="action-item" style="margin-bottom: 0.5rem; padding: 0.75rem; background: #f5f5f5; border-radius: 4px;">
              <select class="action-type form-input" style="margin-bottom: 0.5rem;">
                <option value="send_email">📧 Отправить Email</option>
                <option value="send_sms">📱 Отправить SMS</option>
                <option value="send_push">🔔 Отправить Push</option>
                <option value="create_discount">🎁 Создать скидку</option>
              </select>
              <input type="text" class="action-value form-input" placeholder="Значение (email, текст, и т.д.)">
            </div>
          </div>
          <button type="button" class="btn btn-small btn-secondary" onclick="funnelsModule.addAction()">➕ Добавить действие</button>
        </div>
        
        <div class="form-group">
          <label>
            <input type="checkbox" name="is_active" checked>
            Активна
          </label>
        </div>
        
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="funnelsModule.closeModal()">Отмена</button>
          <button type="submit" class="btn btn-primary">💾 Сохранить</button>
        </div>
      </form>
    `, '', 'large');

    document.getElementById('funnelForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveFunnel(e.target);
    });
  }

  addAction() {
    const container = document.getElementById('actionsContainer');
    const actionItem = document.createElement('div');
    actionItem.className = 'action-item';
    actionItem.style.cssText = 'margin-bottom: 0.5rem; padding: 0.75rem; background: #f5f5f5; border-radius: 4px;';
    actionItem.innerHTML = `
      <select class="action-type form-input" style="margin-bottom: 0.5rem;">
        <option value="send_email">📧 Отправить Email</option>
        <option value="send_sms">📱 Отправить SMS</option>
        <option value="send_push">🔔 Отправить Push</option>
        <option value="create_discount">🎁 Создать скидку</option>
      </select>
      <input type="text" class="action-value form-input" placeholder="Значение">
    `;
    container.appendChild(actionItem);
  }

  async saveFunnel(form) {
    try {
      const formData = new FormData(form);
      
      // Collect actions
      const actions = [];
      document.querySelectorAll('.action-item').forEach(item => {
        const type = item.querySelector('.action-type').value;
        const value = item.querySelector('.action-value').value;
        actions.push({ type, value });
      });

      const data = {
        name: formData.get('name'),
        description: formData.get('description'),
        trigger: formData.get('trigger'),
        delay_minutes: parseInt(formData.get('delay_minutes')) || 0,
        is_active: !!formData.get('is_active'),
        actions
      };

      const response = await fetch(this.API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();
      
      if (result.success) {
        alert('✅ Воронка создана!');
        this.closeModal();
        await this.loadFunnels();
        this.render();
      } else {
        alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
      }
    } catch (error) {
      console.error('Error saving funnel:', error);
      alert('❌ Ошибка соединения');
    }
  }

  async testFunnel(funnelId) {
    if (!confirm('Запустить тестовое выполнение этой воронки?')) return;

    try {
      const response = await fetch(`${this.API_BASE}/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ funnel_id: funnelId })
      });

      const result = await response.json();
      
      if (result.success) {
        alert('✅ Воронка запущена! ID выполнения: ' + result.execution_id);
      } else {
        alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
      }
    } catch (error) {
      console.error('Error testing funnel:', error);
      alert('❌ Ошибка соединения');
    }
  }

  async deleteFunnel(funnelId) {
    if (!confirm('Удалить эту воронку?')) return;

    try {
      const response = await fetch(`${this.API_BASE}/${funnelId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      const result = await response.json();
      
      if (result.success) {
        alert('✅ Воронка удалена!');
        await this.loadFunnels();
        this.render();
      }
    } catch (error) {
      console.error('Error deleting funnel:', error);
      alert('❌ Ошибка соединения');
    }
  }

  editFunnel(funnelId) {
    alert('🚧 Редактирование - в разработке');
  }

  createModal(title, content, footer = '', size = 'normal') {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;';
    modal.innerHTML = `
      <div style="background: white; padding: 2rem; border-radius: 8px; max-width: ${size === 'large' ? '900px' : '600px'}; max-height: 90vh; overflow-y: auto; width: 90%;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3>${title}</h3>
          <button onclick="funnelsModule.closeModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">×</button>
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
  window.FunnelsModule = FunnelsModule;
  window.funnelsModule = new FunnelsModule();
}

