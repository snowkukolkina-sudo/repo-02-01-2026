/**
 * BANNER MANAGER MODULE
 * Управление баннерами и виджетами
 */

class BannerManagerModule {
  constructor() {
    this.banners = [];
    this.API_BASE = '/api/v1/banners';
  }

  async init() {
    console.log('📢 Banner Manager initialized');
    await this.loadBanners();
    this.render();
  }

  async loadBanners() {
    try {
      const response = await fetch(this.API_BASE, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const result = await response.json();
      if (result.success) {
        this.banners = result.data;
      }
    } catch (error) {
      console.error('Error loading banners:', error);
    }
  }

  render() {
    const container = document.getElementById('bannerManagerContent') || document.getElementById('marketingContent');
    if (!container) return;

    container.innerHTML = `
      <div class="banner-manager">
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3>📢 Управление баннерами</h3>
            <button class="btn btn-primary" onclick="bannerManager.showCreateBanner()">
              ➕ Создать баннер
            </button>
          </div>
          
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Заголовок</th>
                  <th>Позиция</th>
                  <th>Период</th>
                  <th>Статус</th>
                  <th>Показы/Клики</th>
                  <th>CTR</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                ${this.renderBannersRows()}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  renderBannersRows() {
    if (this.banners.length === 0) {
      return '<tr><td colspan="7" style="text-align: center; color: #666;">Нет баннеров. Создайте первый!</td></tr>';
    }

    const positionLabels = {
      top: '⬆️ Вверху',
      middle: '➡️ Посередине',
      bottom: '⬇️ Внизу',
      sidebar: '📌 Сайдбар',
      popup: '🔔 Попап'
    };

    const statusBadges = {
      active: '<span class="badge badge-success">Активен</span>',
      paused: '<span class="badge badge-warning">Приостановлен</span>',
      archived: '<span class="badge badge-secondary">Архив</span>'
    };

    return this.banners.map(banner => {
      const startDate = new Date(banner.start_date).toLocaleDateString('ru-RU');
      const endDate = banner.end_date ? new Date(banner.end_date).toLocaleDateString('ru-RU') : '∞';
      const ctr = banner.views > 0 ? ((banner.clicks / banner.views) * 100).toFixed(2) : '0.00';

      return `
        <tr>
          <td><strong>${banner.title}</strong></td>
          <td>${positionLabels[banner.position]}</td>
          <td>${startDate} - ${endDate}</td>
          <td>${statusBadges[banner.status]}</td>
          <td>${banner.views} / ${banner.clicks}</td>
          <td>${ctr}%</td>
          <td>
            <button class="btn btn-small" onclick="bannerManager.editBanner('${banner.id}')" title="Редактировать">✏️</button>
            <button class="btn btn-small btn-danger" onclick="bannerManager.deleteBanner('${banner.id}')" title="Удалить">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  showCreateBanner() {
    this.showBannerEditor(null);
  }

  showBannerEditor(bannerId) {
    const banner = bannerId ? this.banners.find(b => b.id === bannerId) : null;
    const isEdit = !!banner;

    const modal = this.createModal(isEdit ? 'Редактировать баннер' : 'Создать баннер', `
      <form id="bannerForm">
        <div class="form-group">
          <label class="form-label">Заголовок *</label>
          <input type="text" name="title" class="form-input" value="${banner?.title || ''}" required>
        </div>
        
        <div class="form-group">
          <label class="form-label">Описание</label>
          <textarea name="description" class="form-input" rows="2">${banner?.description || ''}</textarea>
        </div>
        
        <div class="grid grid-2">
          <div class="form-group">
            <label class="form-label">URL изображения</label>
            <input type="url" name="image_url" class="form-input" value="${banner?.image_url || ''}" 
                   placeholder="https://example.com/banner.jpg">
          </div>
          <div class="form-group">
            <label class="form-label">Ссылка при клике</label>
            <input type="url" name="link_url" class="form-input" value="${banner?.link_url || ''}" 
                   placeholder="https://example.com/promo">
          </div>
        </div>
        
        <div class="grid grid-3">
          <div class="form-group">
            <label class="form-label">Позиция *</label>
            <select name="position" class="form-input" required>
              <option value="top" ${banner?.position === 'top' ? 'selected' : ''}>⬆️ Вверху</option>
              <option value="middle" ${banner?.position === 'middle' ? 'selected' : ''}>➡️ Посередине</option>
              <option value="bottom" ${banner?.position === 'bottom' ? 'selected' : ''}>⬇️ Внизу</option>
              <option value="sidebar" ${banner?.position === 'sidebar' ? 'selected' : ''}>📌 Сайдбар</option>
              <option value="popup" ${banner?.position === 'popup' ? 'selected' : ''}>🔔 Попап</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Приоритет</label>
            <input type="number" name="priority" class="form-input" value="${banner?.priority || 0}" min="0">
            <small>Чем выше, тем важнее</small>
          </div>
          <div class="form-group">
            <label class="form-label">Статус</label>
            <select name="status" class="form-input">
              <option value="active" ${banner?.status === 'active' ? 'selected' : ''}>Активен</option>
              <option value="paused" ${banner?.status === 'paused' ? 'selected' : ''}>Приостановлен</option>
              <option value="archived" ${banner?.status === 'archived' ? 'selected' : ''}>Архив</option>
            </select>
          </div>
        </div>
        
        <div class="grid grid-2">
          <div class="form-group">
            <label class="form-label">Начало показов *</label>
            <input type="datetime-local" name="start_date" class="form-input" 
                   value="${banner ? new Date(banner.start_date).toISOString().slice(0,16) : ''}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Конец показов</label>
            <input type="datetime-local" name="end_date" class="form-input" 
                   value="${banner?.end_date ? new Date(banner.end_date).toISOString().slice(0,16) : ''}">
          </div>
        </div>
        
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="bannerManager.closeModal()">Отмена</button>
          <button type="submit" class="btn btn-primary">💾 Сохранить</button>
        </div>
      </form>
    `, '', 'large');

    document.getElementById('bannerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData.entries());
      
      // Convert empty strings to null
      if (!data.end_date) data.end_date = null;
      if (!data.image_url) data.image_url = null;
      if (!data.link_url) data.link_url = null;
      if (!data.description) data.description = null;
      
      if (isEdit) {
        await this.updateBanner(bannerId, data);
      } else {
        await this.createBanner(data);
      }
    });
  }

  async createBanner(data) {
    try {
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
        alert('✅ Баннер создан!');
        this.closeModal();
        await this.loadBanners();
        this.render();
      } else {
        alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
      }
    } catch (error) {
      console.error('Error creating banner:', error);
      alert('❌ Ошибка соединения');
    }
  }

  async updateBanner(id, data) {
    try {
      const response = await fetch(`${this.API_BASE}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();
      
      if (result.success) {
        alert('✅ Баннер обновлён!');
        this.closeModal();
        await this.loadBanners();
        this.render();
      } else {
        alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
      }
    } catch (error) {
      console.error('Error updating banner:', error);
      alert('❌ Ошибка соединения');
    }
  }

  editBanner(id) {
    this.showBannerEditor(id);
  }

  async deleteBanner(id) {
    if (!confirm('Удалить этот баннер?')) return;

    try {
      const response = await fetch(`${this.API_BASE}/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const result = await response.json();
      
      if (result.success) {
        alert('✅ Баннер удалён!');
        await this.loadBanners();
        this.render();
      }
    } catch (error) {
      console.error('Error deleting banner:', error);
      alert('❌ Ошибка соединения');
    }
  }

  createModal(title, content, footer = '', size = 'normal') {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;';
    modal.innerHTML = `
      <div style="background: white; padding: 2rem; border-radius: 8px; max-width: ${size === 'large' ? '900px' : '600px'}; max-height: 90vh; overflow-y: auto; width: 90%;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3>${title}</h3>
          <button onclick="bannerManager.closeModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">×</button>
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

// Initialize module
if (typeof window !== 'undefined') {
  window.BannerManagerModule = BannerManagerModule;
  window.bannerManager = new BannerManagerModule();
}

