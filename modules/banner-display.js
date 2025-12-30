/**
 * BANNER DISPLAY MODULE
 * Отображение активных баннеров на витрине
 */

class BannerDisplay {
  constructor() {
    this.banners = [];
    this.API_BASE = '/api/v1/banners';
  }

  async init() {
    await this.loadActiveBanners();
    this.renderBanners();
  }

  async loadActiveBanners() {
    try {
      const response = await fetch(`${this.API_BASE}/active`);
      
      // Если API не найден (404), просто пропускаем
      if (!response.ok) {
        console.log('ℹ️ Баннеры не настроены (API endpoint не найден)');
        return;
      }
      
      const result = await response.json();
      
      if (result.success) {
        this.banners = result.data;
        console.log(`📢 Загружено ${this.banners.length} активных баннеров`);
      }
    } catch (error) {
      // Тихо игнорируем ошибку, если API не настроен
      console.log('ℹ️ Баннеры не загружены (упрощенная версия API)');
    }
  }

  renderBanners() {
    // Группируем по позициям
    const bannersByPosition = {
      top: this.banners.filter(b => b.position === 'top'),
      middle: this.banners.filter(b => b.position === 'middle'),
      bottom: this.banners.filter(b => b.position === 'bottom'),
      sidebar: this.banners.filter(b => b.position === 'sidebar'),
      popup: this.banners.filter(b => b.position === 'popup')
    };

    // Отображаем баннеры вверху
    if (bannersByPosition.top.length > 0) {
      this.renderBannerContainer('banner-top', bannersByPosition.top);
    }

    // Отображаем баннеры посередине (после промо-секции)
    if (bannersByPosition.middle.length > 0) {
      this.renderBannerContainer('banner-middle', bannersByPosition.middle);
    }

    // Отображаем баннеры внизу
    if (bannersByPosition.bottom.length > 0) {
      this.renderBannerContainer('banner-bottom', bannersByPosition.bottom);
    }

    // Попап баннеры
    if (bannersByPosition.popup.length > 0) {
      this.showPopupBanner(bannersByPosition.popup[0]);
    }
  }

  renderBannerContainer(containerId, banners) {
    let container = document.getElementById(containerId);
    
    if (!container) {
      // Создаем контейнер если его нет
      container = document.createElement('div');
      container.id = containerId;
      container.style.cssText = 'margin: 1rem auto; max-width: 1200px;';
      
      // Вставляем в зависимости от позиции
      const main = document.querySelector('main');
      if (containerId === 'banner-top') {
        main.prepend(container);
      } else if (containerId === 'banner-middle') {
        const sections = main.querySelectorAll('section');
        if (sections.length > 1) {
          sections[1].after(container);
        }
      } else {
        main.appendChild(container);
      }
    }

    container.innerHTML = banners.map(banner => this.renderBanner(banner)).join('');
  }

  renderBanner(banner) {
    // Отслеживаем показ
    this.trackView(banner.id);

    const hasImage = banner.image_url;
    const hasLink = banner.link_url;

    let bannerHTML = `
      <div class="promo-banner" style="
        background: linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%);
        border-radius: 16px;
        padding: ${hasImage ? '0' : '2rem'};
        margin-bottom: 1rem;
        overflow: hidden;
        cursor: ${hasLink ? 'pointer' : 'default'};
        transition: transform 0.3s ease, box-shadow 0.3s ease;
      " ${hasLink ? `onclick="bannerDisplay.handleClick('${banner.id}', '${banner.link_url}')"` : ''}>
    `;

    if (hasImage) {
      bannerHTML += `
        <img src="${banner.image_url}" alt="${banner.title}" 
             style="width: 100%; height: auto; display: block; border-radius: 16px;">
      `;
    } else {
      bannerHTML += `
        <div style="text-align: center; color: var(--text);">
          <h2 style="margin: 0 0 1rem 0; font-size: 2rem;">${banner.title}</h2>
          ${banner.description ? `<p style="font-size: 1.2rem; opacity: 0.9; margin: 0;">${banner.description}</p>` : ''}
        </div>
      `;
    }

    bannerHTML += `</div>`;

    return bannerHTML;
  }

  showPopupBanner(banner) {
    // Проверяем, показывали ли уже этот баннер
    const shownBanners = JSON.parse(localStorage.getItem('shownPopupBanners') || '[]');
    if (shownBanners.includes(banner.id)) {
      return; // Уже показывали
    }

    // Показываем через 3 секунды после загрузки
    setTimeout(() => {
      const popup = document.createElement('div');
      popup.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease;
      `;

      popup.innerHTML = `
        <div style="
          background: white;
          border-radius: 16px;
          max-width: 600px;
          max-height: 90vh;
          overflow: auto;
          position: relative;
        ">
          <button onclick="this.closest('[style*=fixed]').remove()" style="
            position: absolute;
            top: 1rem;
            right: 1rem;
            background: rgba(0,0,0,0.5);
            color: white;
            border: none;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            font-size: 1.5rem;
            cursor: pointer;
            z-index: 1;
          ">×</button>
          
          ${banner.image_url ? 
            `<img src="${banner.image_url}" alt="${banner.title}" style="width: 100%; border-radius: 16px 16px 0 0;">` :
            `<div style="padding: 2rem; text-align: center;">
              <h2>${banner.title}</h2>
              ${banner.description ? `<p>${banner.description}</p>` : ''}
            </div>`
          }
          
          ${banner.link_url ? 
            `<div style="padding: 1rem; text-align: center;">
              <button onclick="bannerDisplay.handleClick('${banner.id}', '${banner.link_url}')" 
                      class="btn btn-primary">
                Перейти
              </button>
            </div>` : ''
          }
        </div>
      `;

      document.body.appendChild(popup);

      // Отслеживаем показ
      this.trackView(banner.id);

      // Запоминаем что показали
      shownBanners.push(banner.id);
      localStorage.setItem('shownPopupBanners', JSON.stringify(shownBanners));
    }, 3000);
  }

  handleClick(bannerId, url) {
    // Отслеживаем клик
    this.trackClick(bannerId);
    
    // Переходим по ссылке
    if (url) {
      window.location.href = url;
    }
  }

  async trackView(bannerId) {
    try {
      await fetch(`${this.API_BASE}/${bannerId}/view`, {
        method: 'POST'
      });
    } catch (error) {
      console.error('Error tracking banner view:', error);
    }
  }

  async trackClick(bannerId) {
    try {
      await fetch(`${this.API_BASE}/${bannerId}/click`, {
        method: 'POST'
      });
    } catch (error) {
      console.error('Error tracking banner click:', error);
    }
  }
}

// Инициализация при загрузке страницы (ОТКЛЮЧЕНО - упрощенная версия API)
if (typeof window !== 'undefined') {
  window.BannerDisplay = BannerDisplay;
  // Модуль баннеров доступен, но НЕ инициализируется автоматически
  console.log('ℹ️ Модуль баннеров загружен (но не используется в упрощенной версии API)');
  
  // window.bannerDisplay = new BannerDisplay();
  // if (document.readyState === 'loading') {
  //   document.addEventListener('DOMContentLoaded', () => {
  //     window.bannerDisplay.init();
  //   });
  // } else {
  //   window.bannerDisplay.init();
  // }
}

// Добавляем анимацию
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  .promo-banner:hover {
    transform: translateY(-4px);
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
  }
`;
document.head.appendChild(style);

