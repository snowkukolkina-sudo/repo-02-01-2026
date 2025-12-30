/**
 * DRAG-AND-DROP PAGE BUILDER
 * Визуальный конструктор страниц
 */

class DragDropBuilder {
  constructor() {
    this.blocks = [];
    this.currentPage = null;
  }

  init(container = 'landingBuilderContent') {
    this.container = document.getElementById(container);
    if (!this.container) return;

    this.render();
    this.setupEventListeners();
  }

  render() {
    this.container.innerHTML = `
      <div class="builder-wrapper" style="display: flex; gap: 1rem; min-height: 600px;">
        <!-- Sidebar with blocks -->
        <div class="builder-sidebar" style="width: 250px; background: #f5f5f5; padding: 1rem; border-radius: 8px;">
          <h4 style="margin-bottom: 1rem;">📦 Блоки</h4>
          <div id="builderBlocks" style="display: flex; flex-direction: column; gap: 0.5rem;">
            <div class="block-item" draggable="true" data-type="heading" 
                 style="padding: 0.75rem; background: white; border-radius: 4px; cursor: grab; border: 2px dashed #ddd;">
              📝 Заголовок
            </div>
            <div class="block-item" draggable="true" data-type="text" 
                 style="padding: 0.75rem; background: white; border-radius: 4px; cursor: grab; border: 2px dashed #ddd;">
              📄 Текст
            </div>
            <div class="block-item" draggable="true" data-type="button" 
                 style="padding: 0.75rem; background: white; border-radius: 4px; cursor: grab; border: 2px dashed #ddd;">
              🔘 Кнопка
            </div>
            <div class="block-item" draggable="true" data-type="image" 
                 style="padding: 0.75rem; background: white; border-radius: 4px; cursor: grab; border: 2px dashed #ddd;">
              🖼️ Изображение
            </div>
            <div class="block-item" draggable="true" data-type="columns" 
                 style="padding: 0.75rem; background: white; border-radius: 4px; cursor: grab; border: 2px dashed #ddd;">
              📐 Колонки (2)
            </div>
            <div class="block-item" draggable="true" data-type="spacer" 
                 style="padding: 0.75rem; background: white; border-radius: 4px; cursor: grab; border: 2px dashed #ddd;">
              ↕️ Отступ
            </div>
          </div>
          
          <hr style="margin: 1.5rem 0; border: none; border-top: 1px solid #ddd;">
          
          <button class="btn btn-success btn-small" onclick="dragDropBuilder.exportHTML()" style="width: 100%; margin-bottom: 0.5rem;">
            💾 Экспорт HTML
          </button>
          <button class="btn btn-secondary btn-small" onclick="dragDropBuilder.clearCanvas()" style="width: 100%;">
            🗑️ Очистить
          </button>
        </div>

        <!-- Canvas -->
        <div class="builder-canvas-wrapper" style="flex: 1; background: white; border-radius: 8px; overflow: hidden;">
          <div class="builder-toolbar" style="padding: 0.75rem; background: #04746c; color: white; display: flex; justify-content: space-between; align-items: center;">
            <h4 style="margin: 0;">🎨 Холст</h4>
            <div>
              <button class="btn btn-small" onclick="dragDropBuilder.toggleViewMode('desktop')" style="background: rgba(255,255,255,0.2); color: white; border: none; margin-right: 0.25rem;">🖥️</button>
              <button class="btn btn-small" onclick="dragDropBuilder.toggleViewMode('mobile')" style="background: rgba(255,255,255,0.2); color: white; border: none;">📱</button>
            </div>
          </div>
          <div id="builderCanvas" class="builder-canvas" 
               style="padding: 2rem; min-height: 500px; background: linear-gradient(90deg, #f0f0f0 1px, transparent 1px), linear-gradient(#f0f0f0 1px, transparent 1px); background-size: 20px 20px;">
            <div class="drop-zone" style="text-align: center; color: #999; padding: 3rem; border: 2px dashed #ddd; border-radius: 8px;">
              Перетащите блоки сюда
            </div>
          </div>
        </div>

        <!-- Properties Panel -->
        <div class="builder-properties" id="builderProperties" style="width: 280px; background: #f5f5f5; padding: 1rem; border-radius: 8px; display: none;">
          <h4 style="margin-bottom: 1rem;">⚙️ Свойства</h4>
          <div id="propertiesContent"></div>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    const canvas = document.getElementById('builderCanvas');
    const blocks = document.querySelectorAll('.block-item');

    // Drag from sidebar
    blocks.forEach(block => {
      block.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('blockType', block.dataset.type);
      });
    });

    // Drop on canvas
    canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      const blockType = e.dataTransfer.getData('blockType');
      this.addBlock(blockType);
    });
  }

  addBlock(type) {
    const canvas = document.getElementById('builderCanvas');
    const dropZone = canvas.querySelector('.drop-zone');
    if (dropZone) dropZone.remove();

    const blockId = `block_${Date.now()}`;
    const blockElement = this.createBlockElement(type, blockId);
    
    canvas.appendChild(blockElement);
    this.blocks.push({ id: blockId, type, element: blockElement });
  }

  createBlockElement(type, id) {
    const div = document.createElement('div');
    div.className = 'builder-block';
    div.dataset.blockId = id;
    div.dataset.blockType = type;
    div.style.cssText = 'margin-bottom: 1rem; padding: 1rem; border: 2px solid #e0e0e0; border-radius: 8px; background: white; position: relative; cursor: pointer;';

    const FALLBACK_IMG = 'data:image/svg+xml;charset=utf-8,' +
      encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300">' +
        '<rect width="100%" height="100%" fill="#f3f4f6"/>' +
        '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6b7280" font-family="Arial" font-size="20">Изображение</text>' +
      '</svg>');

    let content = '';
    switch (type) {
      case 'heading':
        content = '<h2 contenteditable="true" style="margin: 0;">Введите заголовок</h2>';
        break;
      case 'text':
        content = '<p contenteditable="true" style="margin: 0;">Введите текст...</p>';
        break;
      case 'button':
        content = '<button style="padding: 0.75rem 2rem; background: #04746c; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem;">Кнопка</button>';
        break;
      case 'image':
        content = '<img src="' + FALLBACK_IMG + '" style="width: 100%; border-radius: 8px;" alt="Placeholder">';
        break;
      case 'columns':
        content = `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div contenteditable="true" style="padding: 1rem; background: #f9f9f9; border-radius: 4px;">Колонка 1</div>
            <div contenteditable="true" style="padding: 1rem; background: #f9f9f9; border-radius: 4px;">Колонка 2</div>
          </div>
        `;
        break;
      case 'spacer':
        content = '<div style="height: 40px; background: repeating-linear-gradient(90deg, #e0e0e0 0, #e0e0e0 10px, transparent 10px, transparent 20px);"></div>';
        break;
      default:
        content = '<p>Неизвестный блок</p>';
    }

    div.innerHTML = `
      ${content}
      <div class="block-controls" style="position: absolute; top: 5px; right: 5px; display: flex; gap: 0.25rem; opacity: 0; transition: opacity 0.2s;">
        <button onclick="dragDropBuilder.moveBlockUp('${id}')" style="background: rgba(0,0,0,0.7); color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">↑</button>
        <button onclick="dragDropBuilder.moveBlockDown('${id}')" style="background: rgba(0,0,0,0.7); color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">↓</button>
        <button onclick="dragDropBuilder.deleteBlock('${id}')" style="background: rgba(220,38,38,0.8); color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">🗑️</button>
      </div>
    `;

    div.addEventListener('mouseenter', () => {
      div.querySelector('.block-controls').style.opacity = '1';
    });

    div.addEventListener('mouseleave', () => {
      div.querySelector('.block-controls').style.opacity = '0';
    });

    div.addEventListener('click', (e) => {
      if (!e.target.closest('.block-controls')) {
        this.selectBlock(id);
      }
    });

    return div;
  }

  selectBlock(id) {
    document.querySelectorAll('.builder-block').forEach(b => {
      b.style.borderColor = '#e0e0e0';
    });
    
    const block = document.querySelector(`[data-block-id="${id}"]`);
    if (block) {
      block.style.borderColor = '#04746c';
      this.showProperties(id, block.dataset.blockType);
    }
  }

  showProperties(id, type) {
    const panel = document.getElementById('builderProperties');
    const content = document.getElementById('propertiesContent');
    
    panel.style.display = 'block';
    
    content.innerHTML = `
      <div style="margin-bottom: 1rem;">
        <strong>Тип блока:</strong> ${type}
      </div>
      <div style="margin-bottom: 1rem;">
        <strong>ID:</strong> ${id}
      </div>
      <button class="btn btn-danger btn-small" onclick="dragDropBuilder.deleteBlock('${id}')" style="width: 100%;">
        🗑️ Удалить блок
      </button>
    `;
  }

  moveBlockUp(id) {
    const block = this.blocks.find(b => b.id === id);
    if (!block) return;
    
    const index = this.blocks.indexOf(block);
    if (index > 0) {
      const canvas = document.getElementById('builderCanvas');
      const prev = block.element.previousElementSibling;
      if (prev) {
        canvas.insertBefore(block.element, prev);
        [this.blocks[index], this.blocks[index - 1]] = [this.blocks[index - 1], this.blocks[index]];
      }
    }
  }

  moveBlockDown(id) {
    const block = this.blocks.find(b => b.id === id);
    if (!block) return;
    
    const index = this.blocks.indexOf(block);
    if (index < this.blocks.length - 1) {
      const canvas = document.getElementById('builderCanvas');
      const next = block.element.nextElementSibling;
      if (next && next.nextElementSibling) {
        canvas.insertBefore(block.element, next.nextElementSibling);
      } else {
        canvas.appendChild(block.element);
      }
      [this.blocks[index], this.blocks[index + 1]] = [this.blocks[index + 1], this.blocks[index]];
    }
  }

  deleteBlock(id) {
    const block = this.blocks.find(b => b.id === id);
    if (!block) return;
    
    if (confirm('Удалить этот блок?')) {
      block.element.remove();
      this.blocks = this.blocks.filter(b => b.id !== id);
      document.getElementById('builderProperties').style.display = 'none';
    }
  }

  clearCanvas() {
    if (confirm('Очистить весь холст?')) {
      const canvas = document.getElementById('builderCanvas');
      canvas.innerHTML = '<div class="drop-zone" style="text-align: center; color: #999; padding: 3rem; border: 2px dashed #ddd; border-radius: 8px;">Перетащите блоки сюда</div>';
      this.blocks = [];
      document.getElementById('builderProperties').style.display = 'none';
    }
  }

  exportHTML() {
    const canvas = document.getElementById('builderCanvas');
    const clonedCanvas = canvas.cloneNode(true);
    
    // Remove controls
    clonedCanvas.querySelectorAll('.block-controls').forEach(c => c.remove());
    
    // Clean up styles
    const blocks = clonedCanvas.querySelectorAll('.builder-block');
    blocks.forEach(block => {
      block.style.border = 'none';
      block.style.cursor = 'default';
    });

    const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Созданная страница</title>
  <style>
    body {
      font-family: 'Inter', system-ui, sans-serif;
      margin: 0;
      padding: 2rem;
      background: #f9f9f9;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
  </style>
</head>
<body>
  <div class="container">
    ${clonedCanvas.innerHTML}
  </div>
</body>
</html>
    `;

    // Download as file
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `page_${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert('✅ HTML экспортирован!');
  }

  toggleViewMode(mode) {
    const canvas = document.getElementById('builderCanvas');
    if (mode === 'mobile') {
      canvas.style.maxWidth = '375px';
      canvas.style.margin = '0 auto';
    } else {
      canvas.style.maxWidth = '';
      canvas.style.margin = '';
    }
  }
}

// Global instance
if (typeof window !== 'undefined') {
  window.DragDropBuilder = DragDropBuilder;
  window.dragDropBuilder = new DragDropBuilder();
}

