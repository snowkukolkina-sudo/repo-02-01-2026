const path = require('path');
const fs = require('fs-extra');

const INVENTORY_DIR = path.join(process.cwd(), 'storage', 'inventory');
const PRODUCTS_FILE = path.join(INVENTORY_DIR, 'products.json');
const MOVEMENTS_FILE = path.join(INVENTORY_DIR, 'movements.json');

const SAMPLE_PRODUCTS = [
    {
        id: 'prd-100',
        type: 'ingredient',
        name: 'Соус томатный базовый',
        barcode: '4601234000024',
        article: 'SAUCE-TOM',
        synonyms: ['соус томатный', 'соус для пиццы'],
        vatRate: '10%',
        stock: 120
    },
    {
        id: 'prd-101',
        type: 'ingredient',
        name: 'Сыр Моцарелла 45%',
        barcode: '4601234000017',
        article: 'MOZ45',
        synonyms: ['моцарелла', 'сыр моцарелла'],
        vatRate: '20%',
        stock: 80
    },
    {
        id: 'prd-102',
        type: 'package',
        name: 'Коробка пиццы 33 см',
        barcode: '',
        article: 'BOX-33',
        synonyms: ['коробка', 'упаковка пиццы'],
        vatRate: '20%',
        stock: 400
    },
    {
        id: 'prd-103',
        type: 'product',
        name: 'Пицца Маргарита',
        barcode: '4607001234567',
        article: 'PIZZA-MARG',
        synonyms: ['пицца маргарита'],
        vatRate: '20%',
        stock: 32
    }
];

async function ensureStorage() {
    await fs.ensureDir(INVENTORY_DIR);
    if (!(await fs.pathExists(PRODUCTS_FILE))) {
        await fs.writeJson(PRODUCTS_FILE, SAMPLE_PRODUCTS, { spaces: 2 });
    }
    if (!(await fs.pathExists(MOVEMENTS_FILE))) {
        await fs.writeJson(MOVEMENTS_FILE, [], { spaces: 2 });
    }
}

async function loadProducts() {
    await ensureStorage();
    return fs.readJson(PRODUCTS_FILE);
}

async function saveProducts(products) {
    await fs.writeJson(PRODUCTS_FILE, products, { spaces: 2 });
}

async function listProducts() {
    return loadProducts();
}

async function getProductById(productId) {
    const products = await loadProducts();
    return products.find((p) => p.id === productId) || null;
}

async function findByBarcode(barcode) {
    if (!barcode) return [];
    const products = await loadProducts();
    return products.filter((p) => p.barcode && p.barcode === barcode);
}

async function findByArticle(article) {
    if (!article) return [];
    const norm = article.toLowerCase();
    const products = await loadProducts();
    return products.filter((p) => p.article && p.article.toLowerCase() === norm);
}

async function adjustStock(productId, quantity, meta = {}) {
    if (!productId || !Number.isFinite(quantity)) {
        return null;
    }
    const products = await loadProducts();
    const product = products.find((p) => p.id === productId);
    if (!product) {
        return null;
    }
    product.stock = Number(product.stock || 0) + quantity;
    product.updatedAt = new Date().toISOString();
    await saveProducts(products);

    await ensureStorage();
    const movements = await fs.readJson(MOVEMENTS_FILE);
    movements.push({
        id: 'mv_' + Date.now(),
        productId,
        quantity,
        balance: product.stock,
        meta,
        createdAt: new Date().toISOString()
    });
    await fs.writeJson(MOVEMENTS_FILE, movements, { spaces: 2 });
    return product;
}

async function createProduct(payload) {
    const products = await loadProducts();
    const product = Object.assign(
        {
            id: 'custom-' + Date.now(),
            type: 'ingredient',
            barcode: '',
            article: '',
            synonyms: [],
            vatRate: '',
            stock: 0,
            createdAt: new Date().toISOString()
        },
        payload
    );
    products.push(product);
    await saveProducts(products);
    return product;
}

module.exports = {
    listProducts,
    getProductById,
    findByBarcode,
    findByArticle,
    adjustStock,
    createProduct
};
