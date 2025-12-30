/**
 * LANDING PAGE BUILDER MODULE
 * Простой конструктор промо-лендингов
 */

class LandingBuilderModule {
  constructor() {
    this.landings = [];
    this.currentLanding = null;
    this.API_BASE = '/api/v1/landings';
  }

  async init() {
    console.log('🏗️ Landing Builder initialized');
    await this.loadLandings();
    this.render();
  }

  async loadLandings() {
    try {
      const response = await fetch(this.API_BASE, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const result = await response.json();
      if (result.success) {
        this.landings = result.data;
      }
    } catch (error) {
      console.error('Error loading landings:', error);
    }
  }

  render() {
    const container = document.getElementById('landingBuilderContent') || document.getElementById('marketingContent');
    if (!container) return;

    container.innerHTML = `
      <div class="landing-builder">
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3>🏗️ Конструктор лендингов</h3>
            <div style="display: flex; gap: 0.5rem;">
              <button class="btn btn-success" onclick="landingBuilder.openVisualBuilder()">
                🎨 Визуальный конструктор
              </button>
              <button class="btn btn-primary" onclick="landingBuilder.showCreateLanding()">
                ➕ Создать (HTML)
              </button>
            </div>
          </div>
          
          <div class="grid grid-3" style="margin-top: 1rem;">
            ${this.renderLandingCards()}
          </div>
        </div>
      </div>
    `;
  }

  openVisualBuilder() {
    const container = document.getElementById('landingBuilderContent') || document.getElementById('marketingContent');
    if (!container) return;

    container.innerHTML = `
      <div style="margin-bottom: 1rem;">
        <button class="btn btn-secondary btn-small" onclick="landingBuilder.init()">← Назад к списку</button>
      </div>
      <div id="dragDropBuilderContainer"></div>
    `;

    // Load and init drag-drop builder
    if (typeof window.dragDropBuilder !== 'undefined') {
      window.dragDropBuilder.init('dragDropBuilderContainer');
    } else {
      const script = document.createElement('script');
      script.src = 'modules/drag-drop-builder.js';
      script.onload = () => {
        window.dragDropBuilder.init('dragDropBuilderContainer');
      };
      document.head.appendChild(script);
    }
  }

  renderLandingCards() {
    if (this.landings.length === 0) {
      return '<p style="grid-column: 1 / -1; text-align: center; color: #666;">Нет лендингов. Создайте первый!</p>';
    }

    return this.landings.map(landing => {
      const statusBadge = landing.status === 'published' ? 
        '<span class="badge badge-success">Опубликован</span>' :
        landing.status === 'draft' ?
        '<span class="badge badge-warning">Черновик</span>' :
        '<span class="badge badge-secondary">Архив</span>';

      return `
        <div class="card" style="padding: 1rem;">
          <h4 style="margin-bottom: 0.5rem;">${landing.title}</h4>
          ${statusBadge}
          <p style="font-size: 0.9rem; color: #666; margin: 0.5rem 0;">
            <strong>Slug:</strong> <code>/${landing.slug}</code>
          </p>
          <p style="font-size: 0.9rem; color: #666; margin-bottom: 1rem;">
            ${landing.description || 'Без описания'}
          </p>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-small btn-primary" onclick="landingBuilder.editLanding('${landing.id}')">
              ✏️ Редактировать
            </button>
            ${landing.status === 'published' ? 
              `<button class="btn btn-small" onclick="window.open('/landing/${landing.slug}', '_blank')">
                👁️ Просмотр
              </button>` : 
              `<button class="btn btn-small btn-success" onclick="landingBuilder.publishLanding('${landing.id}')">
                🚀 Опубликовать
              </button>`
            }
            <button class="btn btn-small btn-danger" onclick="landingBuilder.deleteLanding('${landing.id}')">
              🗑️
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  showCreateLanding() {
    this.showLandingEditor(null);
  }

  showLandingEditor(landingId) {
    const landing = landingId ? this.landings.find(l => l.id === landingId) : null;
    const isEdit = !!landing;

    const modal = this.createModal(isEdit ? 'Редактировать лендинг' : 'Создать лендинг', `
      <form id="landingForm">
        <div class="form-group">
          <label class="form-label">Заголовок *</label>
          <input type="text" name="title" class="form-input" value="${landing?.title || ''}" required>
        </div>
        
        <div class="form-group">
          <label class="form-label">Slug (URL) *</label>
          <input type="text" name="slug" class="form-input" value="${landing?.slug || ''}" 
                 placeholder="summer-sale-2024" required>
          <small>Будет доступен по адресу: /landing/slug</small>
        </div>
        
        <div class="form-group">
          <label class="form-label">Описание</label>
          <textarea name="description" class="form-input" rows="3">${landing?.description || ''}</textarea>
        </div>
        
        <div class="form-group">
          <label class="form-label">Содержимое (HTML)</label>
          <textarea name="content" class="form-input" rows="10" 
                    placeholder="<h1>Добро пожаловать!</h1><p>Специальное предложение...</p>">${landing?.content || ''}</textarea>
        </div>
        
        <div class="grid grid-2">
          <div class="form-group">
            <label class="form-label">Meta Title</label>
            <input type="text" name="meta_title" class="form-input" value="${landing?.meta_title || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Meta Description</label>
            <input type="text" name="meta_description" class="form-input" value="${landing?.meta_description || ''}">
          </div>
        </div>
        
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="landingBuilder.closeModal()">Отмена</button>
          <button type="submit" class="btn btn-primary">💾 Сохранить</button>
        </div>
      </form>
    `, '', 'large');

    document.getElementById('landingForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = Object.fromEntries(formData.entries());
      
      if (isEdit) {
        await this.updateLanding(landingId, data);
      } else {
        await this.createLanding(data);
      }
    });
  }

  async createLanding(data) {
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
        alert('✅ Лендинг создан!');
        this.closeModal();
        await this.loadLandings();
        this.render();
      } else {
        alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
      }
    } catch (error) {
      console.error('Error creating landing:', error);
      alert('❌ Ошибка соединения');
    }
  }

  async updateLanding(id, data) {
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
        alert('✅ Лендинг обновлён!');
        this.closeModal();
        await this.loadLandings();
        this.render();
      } else {
        alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
      }
    } catch (error) {
      console.error('Error updating landing:', error);
      alert('❌ Ошибка соединения');
    }
  }

  async publishLanding(id) {
    try {
      const response = await fetch(`${this.API_BASE}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: 'published', published_at: new Date() })
      });

      const result = await response.json();
      
      if (result.success) {
        alert('✅ Лендинг опубликован!');
        await this.loadLandings();
        this.render();
      }
    } catch (error) {
      console.error('Error publishing landing:', error);
      alert('❌ Ошибка соединения');
    }
  }

  editLanding(id) {
    this.showLandingEditor(id);
  }

  async deleteLanding(id) {
    if (!confirm('Удалить этот лендинг?')) return;

    try {
      const response = await fetch(`${this.API_BASE}/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const result = await response.json();
      
      if (result.success) {
        alert('✅ Лендинг удалён!');
        await this.loadLandings();
        this.render();
      }
    } catch (error) {
      console.error('Error deleting landing:', error);
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
          <button onclick="landingBuilder.closeModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">×</button>
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
  window.LandingBuilderModule = LandingBuilderModule;
  window.landingBuilder = new LandingBuilderModule();
}

