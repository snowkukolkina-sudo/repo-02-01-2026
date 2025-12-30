/**
 * Chip Slider - анимация подчеркивания для категорий
 * Анимирует бегунок под активной категорией
 */
(function() {
    'use strict';
    
    function initChipSlider() {
        const categoryBar = document.querySelector('.category-bar.menu-groups');
        if (!categoryBar) return;
        
        const chips = categoryBar.querySelectorAll('.chip');
        const underline = categoryBar.querySelector('.chip-underline');
        const thumb = underline ? underline.querySelector('.thumb') : null;
        
        if (!thumb || chips.length === 0) return;
        
        // Функция для обновления позиции бегунка
        function updateThumb(activeChip) {
            if (!activeChip || !thumb) return;
            
            const categoryScroll = categoryBar.querySelector('.category-scroll');
            if (!categoryScroll) return;
            
            const chipRect = activeChip.getBoundingClientRect();
            const scrollRect = categoryScroll.getBoundingClientRect();
            
            // Вычисляем позицию относительно контейнера скролла
            const left = chipRect.left - scrollRect.left + categoryScroll.scrollLeft;
            const width = chipRect.width;
            
            // Устанавливаем позицию и ширину бегунка
            thumb.style.width = width + 'px';
            thumb.style.transform = `translateX(${left}px)`;
            thumb.style.opacity = '1';
        }
        
        // Инициализация: устанавливаем позицию для активного чипа
        function initThumb() {
            const activeChip = categoryBar.querySelector('.chip.active');
            if (activeChip) {
                // Небольшая задержка для корректного расчета размеров
                setTimeout(() => updateThumb(activeChip), 50);
            } else {
                thumb.style.opacity = '0';
            }
        }
        
        // Обработчик клика на чипы
        chips.forEach(chip => {
            chip.addEventListener('click', function() {
                // Убираем активный класс со всех чипов
                chips.forEach(c => c.classList.remove('active'));
                // Добавляем активный класс к кликнутому чипу
                this.classList.add('active');
                // Обновляем позицию бегунка
                updateThumb(this);
            });
        });
        
        // Обработчик скролла контейнера
        const categoryScroll = categoryBar.querySelector('.category-scroll');
        if (categoryScroll) {
            categoryScroll.addEventListener('scroll', function() {
                const activeChip = categoryBar.querySelector('.chip.active');
                if (activeChip) {
                    updateThumb(activeChip);
                }
            });
        }
        
        // Обработчик изменения размера окна
        let resizeTimeout;
        window.addEventListener('resize', function() {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                const activeChip = categoryBar.querySelector('.chip.active');
                if (activeChip) {
                    updateThumb(activeChip);
                }
            }, 100);
        });
        
        // Инициализация при загрузке
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initThumb);
        } else {
            initThumb();
        }
    }
    
    // Инициализация при загрузке страницы
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initChipSlider);
    } else {
        initChipSlider();
    }
    
    // Экспорт для возможного использования из других скриптов
    window.ChipSlider = {
        init: initChipSlider
    };
})();

