/**
 * PROJECT SWITCHER (Multi-site)
 * Переключение между проектами
 */

class ProjectSwitcher {
  constructor() {
    this.projects = [];
    this.currentProject = null;
    this.API_BASE = '/api/v1/projects';
    this.loadCurrentProject();
  }

  async init() {
    await this.loadProjects();
    this.render();
  }

  loadCurrentProject() {
    const saved = localStorage.getItem('currentProject');
    if (saved) {
      this.currentProject = JSON.parse(saved);
    }
  }

  async loadProjects() {
    try {
      const response = await fetch(this.API_BASE, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const result = await response.json();
      if (result.success) {
        this.projects = result.data;
        if (!this.currentProject && this.projects.length > 0) {
          this.switchProject(this.projects[0]);
        }
        // Обновляем select после загрузки проектов
        this.updateProjectSelect();
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      // Если API недоступен, используем демо-данные
      this.projects = [
        { id: 1, name: 'DANDY Pizza', description: 'Основной проект', domain: 'dandypizzasushi.com', status: 'active' }
      ];
      this.updateProjectSelect();
    }
  }

  render() {
    const container = document.querySelector('.header-inner') || document.querySelector('header');
    if (!container) return;

    let switcherHTML = `
      <div id="projectSwitcher" style="display: flex; align-items: center; gap: 0.5rem; background: rgba(255,255,255,0.1); padding: 0.5rem 1rem; border-radius: 8px;">
        <span style="font-size: 0.9rem; opacity: 0.8;">Проект:</span>
        <select onchange="projectSwitcher.selectProject(this.value)" style="background: transparent; border: 1px solid rgba(255,255,255,0.3); color: white; padding: 0.25rem 0.5rem; border-radius: 4px;">
          ${this.projects.map(p => `
            <option value="${p.id}" ${this.currentProject?.id === p.id ? 'selected' : ''}>${p.name}</option>
          `).join('')}
        </select>
        <button onclick="projectSwitcher.manageProjects()" style="background: rgba(255,255,255,0.2); border: none; padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer; color: white;">⚙️</button>
      </div>
    `;

    const existing = document.getElementById('projectSwitcher');
    if (existing) {
      existing.outerHTML = switcherHTML;
    } else {
      container.insertAdjacentHTML('beforeend', switcherHTML);
    }
  }

  selectProject(projectId) {
    const project = this.projects.find(p => p.id == projectId);
    if (project) {
      this.switchProject(project);
    }
  }

  updateProjectSelect() {
    const select = document.querySelector('#projectSwitcher select');
    if (select) {
      select.innerHTML = this.projects.map(p => `
        <option value="${p.id}" ${this.currentProject?.id == p.id ? 'selected' : ''}>${p.name}</option>
      `).join('');
    }
  }

  switchProject(project) {
    this.currentProject = project;
    localStorage.setItem('currentProject', JSON.stringify(project));
    localStorage.setItem('currentProjectId', project.id);
    
    // Reload page to apply filter
    if (location.pathname.includes('admin')) {
      location.reload();
    }
  }

  async manageProjects() {
    this.showProjectManagementModal();
  }

  showProjectManagementModal() {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    modal.innerHTML = `
      <div style="
        background: var(--primary);
        border: 2px solid var(--accent);
        border-radius: 16px;
        padding: 2rem;
        max-width: 800px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1);
        backdrop-filter: blur(10px);
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
          <h2 style="color: var(--text-light); margin: 0; font-size: 1.5rem; font-weight: 700;">🏢 Управление проектами</h2>
          <button onclick="this.closest('.modal').remove()" style="
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            color: var(--text-light);
            font-size: 1.5rem;
            cursor: pointer;
            padding: 0.5rem;
            border-radius: 50%;
            transition: all 0.3s;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
          " onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">×</button>
        </div>

        <div style="display: flex; gap: 1rem; margin-bottom: 2rem;">
          <button onclick="projectSwitcher.showCreateProjectForm()" style="
            background: linear-gradient(135deg, var(--accent) 0%, var(--dandy-yellow) 100%);
            color: var(--primary);
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
            box-shadow: 0 4px 12px rgba(238, 188, 92, 0.3);
          " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
            ➕ Создать проект
          </button>
          <button onclick="projectSwitcher.refreshProjects()" style="
            background: var(--chip);
            color: var(--text-light);
            border: 1px solid var(--chip-border);
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.3s;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          " onmouseover="this.style.background='var(--chip-hover)'" onmouseout="this.style.background='var(--chip)'">
            🔄 Обновить
          </button>
        </div>

        <div id="projectsList" style="margin-bottom: 2rem;">
          ${this.renderProjectsList()}
        </div>

        <div id="createProjectForm" style="display: none;">
          ${this.renderCreateProjectForm()}
        </div>
      </div>
    `;

    modal.className = 'modal';
    document.body.appendChild(modal);

    // Закрытие по клику вне модального окна
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  renderProjectsList() {
    if (this.projects.length === 0) {
      return `
        <div style="text-align: center; padding: 3rem; color: var(--text-light); opacity: 0.7;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">🏢</div>
          <h3>Нет проектов</h3>
          <p>Создайте первый проект для начала работы</p>
        </div>
      `;
    }

    return `
      <div style="display: grid; gap: 1rem;">
        ${this.projects.map(project => `
          <div style="
            background: var(--card);
            border: 1px solid var(--chip-border);
            border-radius: 12px;
            padding: 1.5rem;
            transition: all 0.3s;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          " onmouseover="this.style.background='var(--chip-hover)'; this.style.transform='translateY(-2px)'" onmouseout="this.style.background='var(--card)'; this.style.transform='translateY(0)'">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
              <div>
                <h3 style="color: var(--text-light); margin: 0 0 0.5rem 0; font-size: 1.2rem;">${project.name}</h3>
                <p style="color: var(--text-light); opacity: 0.7; margin: 0; font-size: 0.9rem;">${project.description || 'Без описания'}</p>
              </div>
              <div style="display: flex; gap: 0.5rem;">
                ${project.id === this.currentProject?.id ? '<span style="background: var(--success); color: white; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.8rem;">Активный</span>' : ''}
                <button onclick="projectSwitcher.switchProject(${JSON.stringify(project).replace(/"/g, '&quot;')})" style="
                  background: var(--accent);
                  color: var(--primary);
                  border: none;
                  padding: 0.5rem 1rem;
                  border-radius: 6px;
                  font-size: 0.8rem;
                  cursor: pointer;
                  transition: transform 0.2s;
                " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                  Переключить
                </button>
                <button onclick="projectSwitcher.editProject(${project.id})" style="
                  background: var(--info);
                  color: white;
                  border: none;
                  padding: 0.5rem 1rem;
                  border-radius: 6px;
                  font-size: 0.8rem;
                  cursor: pointer;
                  transition: transform 0.2s;
                " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                  ✏️
                </button>
                <button onclick="projectSwitcher.deleteProject(${project.id})" style="
                  background: var(--danger);
                  color: white;
                  border: none;
                  padding: 0.5rem 1rem;
                  border-radius: 6px;
                  font-size: 0.8rem;
                  cursor: pointer;
                  transition: transform 0.2s;
                " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                  🗑️
                </button>
              </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; font-size: 0.8rem;">
              <div>
                <strong style="color: var(--accent);">Домен:</strong><br>
                <span style="color: var(--text-light);">${project.domain || 'Не указан'}</span>
              </div>
              <div>
                <strong style="color: var(--accent);">Статус:</strong><br>
                <span style="color: ${project.status === 'active' ? 'var(--success)' : 'var(--warning)'};">${project.status === 'active' ? 'Активен' : 'Неактивен'}</span>
              </div>
              <div>
                <strong style="color: var(--accent);">Создан:</strong><br>
                <span style="color: var(--text-light);">${new Date(project.created_at).toLocaleDateString('ru-RU')}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderCreateProjectForm() {
    return `
      <div style="
        background: var(--card);
        border: 1px solid var(--chip-border);
        border-radius: 12px;
        padding: 2rem;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      ">
        <h3 style="color: var(--text-light); margin: 0 0 1.5rem 0;">Создание нового проекта</h3>
        
        <div style="display: grid; gap: 1rem;">
          <div>
            <label style="display: block; color: var(--text-light); margin-bottom: 0.5rem; font-weight: 600;">Название проекта *</label>
            <input type="text" id="projectName" placeholder="Например: DANDY Pizza Москва" style="
              width: 100%;
              padding: 0.75rem;
              background: var(--chip);
              border: 1px solid var(--chip-border);
              border-radius: 8px;
              color: var(--text-light);
              font-size: 1rem;
              box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
            ">
          </div>
          
          <div>
            <label style="display: block; color: var(--text-light); margin-bottom: 0.5rem; font-weight: 600;">Описание</label>
            <textarea id="projectDescription" placeholder="Краткое описание проекта..." rows="3" style="
              width: 100%;
              padding: 0.75rem;
              background: var(--chip);
              border: 1px solid var(--chip-border);
              border-radius: 8px;
              color: var(--text-light);
              font-size: 1rem;
              resize: vertical;
              box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
            "></textarea>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div>
              <label style="display: block; color: var(--text-light); margin-bottom: 0.5rem; font-weight: 600;">Домен</label>
              <input type="text" id="projectDomain" placeholder="example.com" style="
                width: 100%;
                padding: 0.75rem;
                background: var(--chip);
                border: 1px solid var(--chip-border);
                border-radius: 8px;
                color: var(--text-light);
                font-size: 1rem;
                box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
              ">
            </div>
            
            <div>
              <label style="display: block; color: var(--text-light); margin-bottom: 0.5rem; font-weight: 600;">Статус</label>
              <select id="projectStatus" style="
                width: 100%;
                padding: 0.75rem;
                background: var(--chip);
                border: 1px solid var(--chip-border);
                border-radius: 8px;
                color: var(--text-light);
                font-size: 1rem;
                box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
              ">
                <option value="active">Активен</option>
                <option value="inactive">Неактивен</option>
                <option value="maintenance">Техобслуживание</option>
              </select>
            </div>
          </div>
        </div>
        
        <div style="display: flex; gap: 1rem; margin-top: 2rem;">
          <button onclick="projectSwitcher.createProject()" style="
            background: linear-gradient(135deg, var(--success) 0%, #059669 100%);
            color: white;
            border: none;
            padding: 0.75rem 2rem;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
          " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
            ✅ Создать проект
          </button>
          <button onclick="projectSwitcher.hideCreateProjectForm()" style="
            background: var(--chip);
            color: var(--text-light);
            border: 1px solid var(--chip-border);
            padding: 0.75rem 2rem;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.3s;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          " onmouseover="this.style.background='var(--chip-hover)'" onmouseout="this.style.background='var(--chip)'">
            Отмена
          </button>
        </div>
      </div>
    `;
  }

  showCreateProjectForm() {
    document.getElementById('createProjectForm').style.display = 'block';
    document.getElementById('projectsList').style.display = 'none';
  }

  hideCreateProjectForm() {
    document.getElementById('createProjectForm').style.display = 'none';
    document.getElementById('projectsList').style.display = 'block';
  }

  async createProject() {
    const name = document.getElementById('projectName').value.trim();
    const description = document.getElementById('projectDescription').value.trim();
    const domain = document.getElementById('projectDomain').value.trim();
    const status = document.getElementById('projectStatus').value;

    if (!name) {
      alert('Пожалуйста, введите название проекта');
      return;
    }

    try {
      const response = await fetch(this.API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name,
          description,
          domain,
          status,
          created_at: new Date().toISOString()
        })
      });

      const result = await response.json();
      
      if (result.success) {
        await this.loadProjects();
        this.hideCreateProjectForm();
        this.refreshProjectsList();
        this.updateProjectSelect();
        alert('Проект успешно создан!');
      } else {
        alert('Ошибка при создании проекта: ' + result.error);
      }
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Ошибка при создании проекта');
    }
  }

  async editProject(projectId) {
    const project = this.projects.find(p => p.id === projectId);
    if (!project) return;

    const newName = prompt('Название проекта:', project.name);
    if (newName === null) return;

    const newDescription = prompt('Описание проекта:', project.description || '');
    if (newDescription === null) return;

    try {
      const response = await fetch(`${this.API_BASE}/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: newName,
          description: newDescription
        })
      });

      const result = await response.json();
      
      if (result.success) {
        await this.loadProjects();
        this.refreshProjectsList();
        this.updateProjectSelect();
        alert('Проект успешно обновлен!');
      } else {
        alert('Ошибка при обновлении проекта: ' + result.error);
      }
    } catch (error) {
      console.error('Error updating project:', error);
      alert('Ошибка при обновлении проекта');
    }
  }

  async deleteProject(projectId) {
    const project = this.projects.find(p => p.id === projectId);
    if (!project) return;

    if (!confirm(`Вы уверены, что хотите удалить проект "${project.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`${this.API_BASE}/${projectId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const result = await response.json();
      
      if (result.success) {
        await this.loadProjects();
        this.refreshProjectsList();
        this.updateProjectSelect();
        alert('Проект успешно удален!');
      } else {
        alert('Ошибка при удалении проекта: ' + result.error);
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Ошибка при удалении проекта');
    }
  }

  refreshProjectsList() {
    const projectsList = document.getElementById('projectsList');
    if (projectsList) {
      projectsList.innerHTML = this.renderProjectsList();
    }
  }

  async refreshProjects() {
    await this.loadProjects();
    this.refreshProjectsList();
    this.updateProjectSelect();
  }

  static getCurrentProjectId() {
    return localStorage.getItem('currentProjectId');
  }
}

// Global instance
if (typeof window !== 'undefined') {
  window.ProjectSwitcher = ProjectSwitcher;
  window.projectSwitcher = new ProjectSwitcher();
  // Инициализируем при загрузке страницы
  document.addEventListener('DOMContentLoaded', () => {
    if (window.projectSwitcher) {
      window.projectSwitcher.init();
    }
  });
}

