const http = require('http');
const url = require('url');

const server = http.createServer((req, res) => {
    // Включаем CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;

    console.log(`${req.method} ${path}`);

    if (path === '/api/orders' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const orderData = JSON.parse(body);
                console.log('Order received:', orderData);
                
                // Генерируем ID заказа
                const orderId = Math.floor(Math.random() * 1000000);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    orderId: orderId,
                    message: 'Заказ успешно создан',
                    data: {
                        ...orderData,
                        id: orderId,
                        status: 'pending',
                        createdAt: new Date().toISOString()
                    }
                }));
            } catch (error) {
                console.error('Error parsing order:', error);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
    } else if (path === '/api/products') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            data: [
                { id: 1, name: 'Пицца Маргарита', price: 450 },
                { id: 2, name: 'Пицца Пепперони', price: 520 }
            ]
        }));
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`🚀 Mock API server running on http://localhost:${PORT}`);
    console.log('📋 Available endpoints:');
    console.log('   POST /api/orders - Create order');
    console.log('   GET  /api/products - Get products');
});
