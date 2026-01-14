/**
 * EMAIL CAMPAIGNS MODULE
 * Управление email-рассылками с интеграцией быстрых ссылок
 */

class EmailCampaignsModule {
  constructor() {
    this.campaigns = [];
    this.templates = [];
    this.anchors = [];
    this.API_BASE = '/api/v1/email-campaigns';
  }

  async init() {
    console.log('📧 Email Campaigns Module initialized');
    await this.loadCampaigns();
    await this.loadTemplates();
    await this.loadAnchors();
    this.render();
  }

  async loadCampaigns() {
    try {
      const response = await fetch(this.API_BASE, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const result = await response.json();
      if (result.success) {
        this.campaigns = result.data;
      }
    } catch (error) {
      console.error('Error loading campaigns:', error);
    }
  }

  async loadTemplates() {
    try {
      const response = await fetch(`${this.API_BASE}/templates`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const result = await response.json();
      if (result.success) {
        this.templates = result.data;
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  }

  async loadAnchors() {
    try {
      const response = await fetch('/api/v1/marketing/anchors', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const result = await response.json();
      if (result.success) {
        this.anchors = result.data;
      }
    } catch (error) {
      console.error('Error loading anchors:', error);
    }
  }

  render() {
    const container = document.getElementById('emailCampaignsContent') || document.getElementById('marketingContent');
    if (!container) return;

    container.innerHTML = `
      <div class="email-campaigns">
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3>📧 Email-рассылки</h3>
            <div style="display: flex; gap: 0.5rem;">
              <button class="btn btn-primary" onclick="emailCampaigns.showCreateCampaign()">
                ➕ Создать рассылку
              </button>
              <button class="btn btn-secondary" onclick="emailCampaigns.showTemplates()">
                📄 Шаблоны
              </button>
            </div>
          </div>
          
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Статус</th>
                  <th>Получателей</th>
                  <th>Отправлено</th>
                  <th>Открыто</th>
                  <th>Клики</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                ${this.renderCampaignsRows()}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  renderCampaignsRows() {
    if (this.campaigns.length === 0) {
      return '<tr><td colspan="7" style="text-align: center; color: #666;">Нет рассылок. Создайте первую!</td></tr>';
    }

    const statusLabels = {
      draft: '📝 Черновик',
      scheduled: '⏰ Запланирована',
      sending: '📤 Отправка...',
      sent: '✅ Отправлена',
      failed: '❌ Ошибка'
    };

    return this.campaigns.map(campaign => {
      const openRate = campaign.delivered_count > 0 ? 
        ((campaign.opened_count / campaign.delivered_count) * 100).toFixed(1) : 0;
      const clickRate = campaign.delivered_count > 0 ? 
        ((campaign.clicked_count / campaign.delivered_count) * 100).toFixed(1) : 0;

      return `
        <tr>
          <td><strong>${campaign.name}</strong></td>
          <td>${statusLabels[campaign.status]}</td>
          <td>${campaign.total_recipients}</td>
          <td>${campaign.sent_count} / ${campaign.delivered_count}</td>
          <td>${campaign.opened_count} (${openRate}%)</td>
          <td>${campaign.clicked_count} (${clickRate}%)</td>
          <td>
            <button class="btn btn-small" onclick="emailCampaigns.viewCampaign('${campaign.id}')" title="Просмотр">👁️</button>
            ${campaign.status === 'draft' ? 
              `<button class="btn btn-small btn-success" onclick="emailCampaigns.sendCampaign('${campaign.id}')" title="Отправить">📤</button>` : 
              ''}
            <button class="btn btn-small btn-danger" onclick="emailCampaigns.deleteCampaign('${campaign.id}')" title="Удалить">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  showCreateCampaign() {
    const modal = this.createModal('Создать рассылку', `
      <form id="campaignForm">
        <div class="form-group">
          <label class="form-label">Название кампании *</label>
          <input type="text" name="name" class="form-input" required>
        </div>
        
        <div class="form-group">
          <label class="form-label">Описание</label>
          <textarea name="description" class="form-input" rows="2"></textarea>
        </div>
        
        <div class="form-group">
          <label class="form-label">Тема письма *</label>
          <input type="text" name="subject" class="form-input" required>
        </div>
        
        <div class="form-group">
          <label class="form-label">Шаблон (опционально)</label>
          <select name="template_id" class="form-input" onchange="emailCampaigns.loadTemplateContent(this.value)">
            <option value="">Без шаблона</option>
            ${this.templates.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
          </select>
        </div>
        
        <div class="form-group">
          <label class="form-label">Содержание (HTML)</label>
          <div style="margin-bottom: 0.5rem;">
            <button type="button" class="btn btn-secondary btn-small" onclick="emailCampaigns.showAnchorPicker()">
              🔗 Вставить ссылку
            </button>
          </div>
          <textarea name="html_content" id="campaignHtmlContent" class="form-input" rows="15" 
                    placeholder="<h1>Привет!</h1><p>Специальное предложение...</p>"></textarea>
        </div>
        
        <div class="form-group">
          <label class="form-label">Получатели (email, по одному на строку)</label>
          <textarea name="recipients" id="campaignRecipients" class="form-input" rows="5" 
                    placeholder="example1@mail.com\nexample2@mail.com"></textarea>
        </div>
        
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="emailCampaigns.closeModal()">Отмена</button>
          <button type="submit" class="btn btn-primary">💾 Сохранить как черновик</button>
          <button type="button" class="btn btn-success" onclick="emailCampaigns.saveAndSend()">📤 Сохранить и отправить</button>
        </div>
      </form>
    `, '', 'large');

    document.getElementById('campaignForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveCampaign(e.target, false);
    });
  }

  showAnchorPicker() {
    let content = `
      <div style="padding: 1rem;">
        <h3>🔗 Выберите ссылку для вставки</h3>
        <input type="text" id="anchorSearchInput" class="form-input" placeholder="🔍 Поиск..." 
               style="margin-bottom: 1rem;" onkeyup="emailCampaigns.filterAnchorsInPicker(this.value)">
        
        <div id="anchorPickerList" style="max-height: 400px; overflow-y: auto;">
          ${this.anchors.map(anchor => `
            <div class="anchor-picker-item" data-search="${anchor.name.toLowerCase()} ${anchor.slug}" 
                 style="padding: 0.75rem; border-bottom: 1px solid #eee; cursor: pointer;"
                 onclick="emailCampaigns.insertAnchor('${anchor.url}', '${anchor.name.replace(/'/g, "\\'")}')">
              <strong>${anchor.name}</strong>
              <br>
              <code style="font-size: 0.85rem; color: #666;">${anchor.url}</code>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    this.showModal('Вставить ссылку', content);
  }

  filterAnchorsInPicker(query) {
    const items = document.querySelectorAll('.anchor-picker-item');
    const lowerQuery = query.toLowerCase();
    
    items.forEach(item => {
      const searchText = item.getAttribute('data-search');
      item.style.display = searchText.includes(lowerQuery) ? 'block' : 'none';
    });
  }

  insertAnchor(url, name) {
    const content = document.getElementById('campaignHtmlContent');
    const linkHtml = `<a href="${url}" style="color: #0066cc; text-decoration: underline;">${name}</a>`;
    
    // Insert at cursor position
    const pos = content.selectionStart;
    const before = content.value.substring(0, pos);
    const after = content.value.substring(pos);
    content.value = before + linkHtml + after;
    
    // Track usage
    fetch('/api/v1/marketing/anchors/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        anchor_id: url,
        anchor_url: url,
        anchor_name: name,
        anchor_type: 'page',
        action: 'email',
        source: 'email_campaign_builder'
      })
    });
    
    this.closeModal();
    alert('✅ Ссылка вставлена!');
  }

  async loadTemplateContent(templateId) {
    if (!templateId) return;
    
    const template = this.templates.find(t => t.id === templateId);
    if (template) {
      document.getElementById('campaignHtmlContent').value = template.html_content;
    }
  }

  async saveCampaign(form, sendNow = false) {
    try {
      const formData = new FormData(form);
      const data = {
        name: formData.get('name'),
        description: formData.get('description'),
        template_id: formData.get('template_id') || null,
        subject: formData.get('subject'),
        html_content: formData.get('html_content'),
        recipients: formData.get('recipients').split('\n')
          .map(email => email.trim())
          .filter(email => email && email.includes('@'))
          .map(email => ({ email }))
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
        if (sendNow) {
          await this.sendCampaign(result.data.id);
        } else {
          alert('✅ Рассылка сохранена как черновик!');
        }
        
        this.closeModal();
        await this.loadCampaigns();
        this.render();
      } else {
        alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
      }
    } catch (error) {
      console.error('Error saving campaign:', error);
      alert('❌ Ошибка соединения');
    }
  }

  saveAndSend() {
    const form = document.getElementById('campaignForm');
    this.saveCampaign(form, true);
  }

  async sendCampaign(campaignId) {
    if (!confirm('Отправить эту рассылку сейчас?')) return;

    try {
      const response = await fetch(`${this.API_BASE}/${campaignId}/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`✅ Рассылка отправляется! Получателей: ${result.total_recipients}`);
        await this.loadCampaigns();
        this.render();
      } else {
        alert('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'));
      }
    } catch (error) {
      console.error('Error sending campaign:', error);
      alert('❌ Ошибка соединения');
    }
  }

  async viewCampaign(campaignId) {
    try {
      const response = await fetch(`${this.API_BASE}/${campaignId}/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const result = await response.json();
      
      if (result.success) {
        const { campaign, stats, open_rate, click_rate } = result.data;
        
        let content = `
          <div style="padding: 1rem;">
            <h3>📧 ${campaign.name}</h3>
            <p>${campaign.description || ''}</p>
            
            <div class="grid grid-4" style="margin: 1rem 0; gap: 1rem;">
              <div class="card" style="background: #f0f9ff; padding: 1rem;">
                <div style="font-size: 0.9rem; color: #666;">Всего</div>
                <div style="font-size: 1.5rem; font-weight: bold;">${campaign.total_recipients}</div>
              </div>
              <div class="card" style="background: #f0fdf4; padding: 1rem;">
                <div style="font-size: 0.9rem; color: #666;">Доставлено</div>
                <div style="font-size: 1.5rem; font-weight: bold;">${campaign.delivered_count}</div>
              </div>
              <div class="card" style="background: #fef3c7; padding: 1rem;">
                <div style="font-size: 0.9rem; color: #666;">Открыто</div>
                <div style="font-size: 1.5rem; font-weight: bold;">${campaign.opened_count} (${open_rate}%)</div>
              </div>
              <div class="card" style="background: #ede9fe; padding: 1rem;">
                <div style="font-size: 0.9rem; color: #666;">Кликов</div>
                <div style="font-size: 1.5rem; font-weight: bold;">${campaign.clicked_count} (${click_rate}%)</div>
              </div>
            </div>
            
            <h4 style="margin: 1rem 0;">Предпросмотр письма:</h4>
            <div style="border: 1px solid #ddd; padding: 1rem; border-radius: 8px; background: white; max-height: 400px; overflow-y: auto;">
              ${campaign.html_content}
            </div>
          </div>
        `;

        this.showModal('Просмотр рассылки', content);
      }
    } catch (error) {
      console.error('Error viewing campaign:', error);
      alert('❌ Ошибка загрузки');
    }
  }

  async deleteCampaign(campaignId) {
    if (!confirm('Удалить эту рассылку?')) return;

    try {
      const response = await fetch(`${this.API_BASE}/${campaignId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const result = await response.json();
      
      if (result.success) {
        alert('✅ Рассылка удалена!');
        await this.loadCampaigns();
        this.render();
      }
    } catch (error) {
      console.error('Error deleting campaign:', error);
      alert('❌ Ошибка соединения');
    }
  }

  showTemplates() {
    alert('🚧 Управление шаблонами - в разработке. Шаблоны можно создавать через API.');
  }

  createModal(title, content, footer = '', size = 'normal') {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;';
    modal.innerHTML = `
      <div style="background: white; padding: 2rem; border-radius: 8px; max-width: ${size === 'large' ? '900px' : '600px'}; max-height: 90vh; overflow-y: auto; width: 90%;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3>${title}</h3>
          <button onclick="emailCampaigns.closeModal()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer;">×</button>
        </div>
        ${content}
        ${footer}
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  showModal(title, content) {
    this.createModal(title, content);
  }

  closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) modal.remove();
  }
}

// Initialize module
if (typeof window !== 'undefined') {
  window.EmailCampaignsModule = EmailCampaignsModule;
  window.emailCampaigns = new EmailCampaignsModule();
}

