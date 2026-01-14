/*
 * Interaction logic for the condensed & small navigation bar.  
 * Applies the correct slider width according to the horizontal scale factor
 * specified in CSS and keeps the active tab in view.
 * Updated: console.log messages removed
 */

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('mainNav');
  const slider = document.querySelector('.slider');
  const wrap = document.querySelector('.tabs-wrap');

  if (!container || !slider || !wrap) {
    return;
  }

  const tabCategories = {
    'ВСЕ': 'all',
    'ХИТЫ': '40263810',
    'НОВИНКИ': '40270774',
    'ВОК': '40270432',
    'ПИЦЦА': '40263794',
    'СЕТЫ': '40263779',
    'МАКИ': '40263778',
    'ЗАПЕЧЕННЫЕ': '40263772',
    'ТЕМПУРА': '40263773',
    'ГУНКАНЫ': '40263781',
    'СУШИ': '40263788',
    'ЗАКУСКИ': '40263783',
    'СЭНДВИЧИ': '40263770',
    'САЛАТЫ': '40263769',
    'СУПЫ': '40263787',
    'НАПИТКИ': '40263782',
    'СОУСЫ': '40263789',
    'ЗАВТРАКИ': '40270772',
    'БЛИНЫ': '40270773',
    'ДЕТЯМ': '40280199',
    '7 ПИЦЦА': '40263794',
    'ПИРОГИ': '40270774',
    'КОМБО': '1',
    'РОЛЛЫ': '40263778'
  };

  const getCategoryId = (tab) => {
    const id = tab.dataset.categoryId;
    if (id) return id;
    const text = tab.textContent.trim();
    return tabCategories[text];
  };

  const activateTab = (tab, tabs) => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    const rect = tab.getBoundingClientRect();
    const offset = tab.offsetLeft;
    const scaleX = parseFloat(getComputedStyle(tab).getPropertyValue('--scale-x')) || 1;
    const sliderWidth = rect.width * scaleX;

    slider.style.width = `${sliderWidth}px`;
    slider.style.transform = `translateX(${offset}px)`;
    slider.style.opacity = '1';
    slider.style.display = 'block';
  };

  const scrollIntoViewIfNeeded = (tab) => {
    const wrapRect = wrap.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    const wrapScrollLeft = wrap.scrollLeft;

    const tabLeft = tabRect.left - wrapRect.left + wrapScrollLeft;
    const tabCenter = tabLeft + (tabRect.width / 2);
    const wrapCenter = wrapRect.width / 2;
    const targetScroll = tabCenter - wrapCenter;

    wrap.scrollTo({
      left: Math.max(0, targetScroll),
      behavior: 'smooth'
    });
  };

  const handleActivate = (tab, tabs) => {
    activateTab(tab, tabs);
    setTimeout(() => scrollIntoViewIfNeeded(tab), 80);
  };

  const bindTabEvents = (tab, tabs) => {
    if (tab.dataset.navBound === 'true') return;

    tab.addEventListener('keydown', (evt) => {
      if (evt.key !== 'Enter' && evt.key !== ' ') return;
      evt.preventDefault();
      tab.click();
    });

    tab.dataset.navBound = 'true';
  };

  const setupTabs = () => {
    const tabs = Array.from(container.querySelectorAll('.tab'));
    if (!tabs.length) {
      slider.style.opacity = '0';
      slider.style.width = '0';
      return;
    }

    tabs.forEach(tab => bindTabEvents(tab, tabs));

    const active = tabs.find(tab => tab.classList.contains('active')) || tabs[0];
    if (active) {
      handleActivate(active, tabs);
    }
  };

  container.addEventListener('category-nav:render', () => {
    slider.style.opacity = '0';
    slider.style.width = '0';
    window.requestAnimationFrame(setupTabs);
  });

  container.addEventListener('category-nav:set-active', (event) => {
    const targetId = event.detail?.id;
    if (!targetId) return;

    const tabs = Array.from(container.querySelectorAll('.tab'));
    const target = tabs.find(tab => getCategoryId(tab) === targetId);
    if (target) {
      handleActivate(target, tabs);
    }
  });

  setupTabs();

  window.addEventListener('resize', () => {
    const tabs = Array.from(container.querySelectorAll('.tab'));
    const activeTab = tabs.find(tab => tab.classList.contains('active'));
    if (activeTab) {
      handleActivate(activeTab, tabs);
    }
  });
});