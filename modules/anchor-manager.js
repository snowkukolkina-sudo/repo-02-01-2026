/**
 * ANCHOR MANAGER MODULE
 * Автоматическое добавление якорей (id) к секциям витрины для маркетинга
 */

class AnchorManager {
  constructor() {
    this.initialized = false;
    this.categoryMap = {
      '40263810': 'hits',
      '40270774': 'new-items',
      '40270432': 'wok',
      '40263794': 'pizza',
      '40263779': 'sets',
      '40263778': 'maki',
      '40263772': 'baked',
      '40263773': 'tempura',
      '40263781': 'gunkans',
      '40263788': 'sushi',
      '40263783': 'snacks',
      '40263770': 'sandwiches',
      '40263769': 'salads',
      '40263787': 'soups',
      '40263782': 'drinks',
      '40263789': 'sauces',
      '40270772': 'breakfasts',
      '40270773': 'pancakes',
      '40270775': 'kids',
      '40270839': '7pizza',
      '40280180': 'pies',
      '40280199': 'combo',
      '40263771': 'rolls'
    };
  }

  init() {
    if (this.initialized) return;
    
    console.log('🔗 Anchor Manager: инициализация...');
    
    // Добавляем якоря к основным секциям
    this.addStaticAnchors();
    
    // Добавляем якоря к секциям с категориями
    this.addCategoryAnchors();
    
    // Обработка хэша в URL (если перешли по якорю)
    this.handleHashNavigation();
    
    // Слушаем изменения хэша
    window.addEventListener('hashchange', () => this.handleHashNavigation());
    
    this.initialized = true;
    console.log('✅ Anchor Manager: готов');
  }

  addStaticAnchors() {
    // Находим секции по классам и добавляем им якоря
    const sections = document.querySelectorAll('section.section');
    
    sections.forEach((section, index) => {
      const title = section.querySelector('.section-title');
      
      if (!title) return;
      
      const text = title.textContent.trim();
      
      // Определяем якорь по названию секции
      if (text.includes('Часто заказывают')) {
        section.id = 'popular';
      } else if (text.includes('Меню')) {
        section.id = 'menu';
      } else if (text.includes('Акции') || text.includes('Промо')) {
        section.id = 'promotions';
      } else if (text.includes('Новинки')) {
        section.id = 'category-new-items';
      } else if (text.includes('Хиты')) {
        section.id = 'category-hits';
      }
    });

    // Карусель акций
    const promoCarousel = document.getElementById('promotionsCarousel');
    if (promoCarousel && !promoCarousel.closest('section').id) {
      promoCarousel.closest('section').id = 'promo-banner';
    }
  }

  addCategoryAnchors() {
    // Группируем карточки товаров по категориям
    const productCards = document.querySelectorAll('.card[data-cat]');
    const categorizedSections = new Map();
    
    productCards.forEach(card => {
      const catId = card.getAttribute('data-cat');
      if (!catId) return;
      
      if (!categorizedSections.has(catId)) {
        categorizedSections.set(catId, []);
      }
      categorizedSections.get(catId).push(card);
    });
    
    // Добавляем якоря к первой карточке каждой категории
    categorizedSections.forEach((cards, catId) => {
      if (cards.length === 0) return;
      
      const slug = this.categoryMap[catId] || `cat-${catId}`;
      const firstCard = cards[0];
      
      // Если это первая карточка категории и у неё ещё нет якоря
      if (!firstCard.id) {
        firstCard.id = `category-${slug}`;
        firstCard.setAttribute('data-anchor', `category-${slug}`);
      }
    });
    
    console.log(`📍 Добавлено ${categorizedSections.size} категорийных якорей`);
  }

  handleHashNavigation() {
    const hash = window.location.hash;
    
    if (!hash || hash === '#') return;
    
    // Убираем # из хэша
    const targetId = hash.substring(1);
    const targetElement = document.getElementById(targetId);
    
    if (targetElement) {
      // Плавная прокрутка к элементу
      setTimeout(() => {
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
        
        // Добавляем визуальный эффект (подсветка)
        this.highlightElement(targetElement);
      }, 300);
      
      console.log(`🎯 Переход к якорю: ${targetId}`);
    } else {
      console.warn(`⚠️ Якорь не найден: ${targetId}`);
    }
  }

  highlightElement(element) {
    // Временная подсветка элемента
    element.style.transition = 'all 0.6s ease';
    element.style.boxShadow = '0 0 20px rgba(228, 188, 108, 0.8)';
    element.style.transform = 'scale(1.02)';
    
    setTimeout(() => {
      element.style.boxShadow = '';
      element.style.transform = '';
    }, 2000);
  }

  // Программный переход к якорю
  goToAnchor(anchorId) {
    window.location.hash = anchorId;
  }

  // Получить все доступные якоря на странице
  getAllAnchors() {
    const anchors = [];
    const elements = document.querySelectorAll('[id]');
    
    elements.forEach(el => {
      if (el.id && (el.id.startsWith('category-') || 
                    el.id.startsWith('promo-') || 
                    el.id === 'popular' || 
                    el.id === 'menu')) {
        anchors.push({
          id: el.id,
          text: this.getElementText(el),
          element: el
        });
      }
    });
    
    return anchors;
  }

  getElementText(element) {
    // Пытаемся найти читаемый текст элемента
    const title = element.querySelector('.section-title, .title, h1, h2, h3');
    if (title) return title.textContent.trim();
    
    return element.id;
  }

  // Создать кнопку "Копировать ссылку" для якоря
  createCopyButton(anchorId, label) {
    const button = document.createElement('button');
    button.className = 'btn btn-small';
    button.textContent = '📋 Копировать';
    button.style.marginLeft = '8px';
    
    button.onclick = () => {
      const url = `${window.location.origin}${window.location.pathname}#${anchorId}`;
      navigator.clipboard.writeText(url).then(() => {
        button.textContent = '✅ Скопировано!';
        setTimeout(() => {
          button.textContent = '📋 Копировать';
        }, 2000);
      });
    };
    
    return button;
  }
}

// Инициализация при загрузке страницы
if (typeof window !== 'undefined') {
  window.AnchorManager = AnchorManager;
  window.anchorManager = new AnchorManager();
  
  // Запускаем после полной загрузки DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.anchorManager.init();
    });
  } else {
    window.anchorManager.init();
  }
}

