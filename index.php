<?php
// Отключаем вывод ошибок в HTML
error_reporting(0);
ini_set('display_errors', 0);

// Устанавливаем JSON заголовки ПЕРВЫМИ
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Глобальная обработка ошибок
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Internal error',
        'message' => $errstr,
        'file' => basename($errfile),
        'line' => $errline
    ]);
    exit();
});

// Глобальная обработка исключений
set_exception_handler(function($e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Exception',
        'message' => $e->getMessage(),
        'file' => basename($e->getFile()),
        'line' => $e->getLine()
    ]);
    exit();
});

// Simple routing
$request_uri = $_SERVER['REQUEST_URI'];
$path = parse_url($request_uri, PHP_URL_PATH);
$path = str_replace('/api/', '', $path);
$path = ltrim($path, '/'); // Убираем ведущий слеш, если есть

// Временное логирование для отладки (удалить после проверки)
error_log("API Request: METHOD=" . $_SERVER['REQUEST_METHOD'] . ", URI=" . $request_uri . ", PATH=" . $path);

// Database connection (SQLite)
$db_path = __DIR__ . '/database.sqlite';
$db_exists = file_exists($db_path);

// Проверяем наличие PDO SQLite
if (!extension_loaded('pdo_sqlite')) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'PDO SQLite extension is not installed',
        'message' => 'Please contact your hosting provider to enable PDO SQLite extension'
    ]);
    exit();
}

try {
    // Убеждаемся, что директория существует и доступна для записи
    $db_dir = dirname($db_path);
    if (!is_dir($db_dir)) {
        @mkdir($db_dir, 0755, true);
    }
    
    // Проверяем права на запись в директорию
    if (!is_writable($db_dir)) {
        @chmod($db_dir, 0755);
    }
    
    $pdo = new PDO("sqlite:$db_path");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Database connection failed',
        'message' => $e->getMessage(),
        'db_path' => $db_path
    ]);
    exit();
}

// Initialize database if it was just created
if (!$db_exists) {
    initializeDatabase($pdo);
} else {
    // Check if orders table exists (in case DB is corrupted)
    try {
        $pdo->query("SELECT 1 FROM orders LIMIT 1");
    } catch (Exception $e) {
        // Table doesn't exist, reinitialize
        initializeDatabase($pdo);
    }
}

// Всегда запускаем миграции для добавления новых полей в существующие таблицы
runMigrations($pdo);

// Handle dynamic routes like /orders/123/status
if (preg_match('/^orders\/(\d+)\/status$/', $path, $matches)) {
    handleOrderStatus($pdo, $matches[1]);
} elseif (preg_match('/^orders\/(\d+)\/address$/', $path, $matches)) {
    handleOrderAddress($pdo, $matches[1]);
} elseif (preg_match('/^orders\/(\d+)$/', $path, $matches)) {
    handleSingleOrder($pdo, $matches[1]);
} elseif (preg_match('/^v1\/projects\/(\d+)$/', $path, $matches)) {
    handleSingleProject($pdo, $matches[1]);
} elseif (preg_match('/^v1\/projects/', $path)) {
    handleProjects($pdo);
} elseif (preg_match('/^v1\/recipes/', $path)) {
    handleRecipes($pdo);
} elseif (preg_match('/^v1\/products/', $path)) {
    handleProducts($pdo);
} elseif (preg_match('/^v1\/categories/', $path)) {
    handleCategories($pdo);
} elseif (preg_match('/^promotions\/check$/', $path)) {
    handlePromotionsCheck($pdo);
} elseif (preg_match('/^promotions\/eligible$/', $path)) {
    handleEligiblePromotions($pdo);
} elseif (preg_match('/^promotions\/(\d+)$/', $path, $matches)) {
    // Handle /promotions/{id} for DELETE - перенаправляем на новый API
    handlePromotionById($pdo, $matches[1]);
} elseif (preg_match('/^promotions/', $path)) {
    handlePromotions($pdo);
} elseif (preg_match('/^loyalty\/stats/', $path)) {
    handleLoyaltyStats($pdo);
} elseif (preg_match('/^inventory\/warehouses/', $path)) {
    handleWarehouses($pdo);
} elseif (preg_match('/^inventory\/items/', $path)) {
    handleInventoryItems($pdo);
} elseif (preg_match('/^inventory\/expiring/', $path)) {
    handleExpiringItems($pdo);
} elseif (preg_match('/^cashier-report\/shift\/current/', $path)) {
    handleCurrentShift($pdo);
} elseif (preg_match('/^couriers/', $path)) {
    handleCouriers($pdo);
} elseif (preg_match('/^couriers\/deliveries/', $path)) {
    handleCourierDeliveries($pdo);
} elseif (preg_match('/^mercury\/batches/', $path)) {
    handleMercuryBatches($pdo);
} elseif (preg_match('/^mercury\/documents/', $path)) {
    handleMercuryDocuments($pdo);
} elseif (preg_match('/^edo\/documents/', $path)) {
    handleEDODocuments($pdo);
} elseif (preg_match('/^products\/sync$/', $path)) {
    handleProductsSync($pdo);
} elseif (preg_match('/^products\/(.+)$/', $path, $matches)) {
    // Handle /products/{id} for DELETE and PUT
    error_log("Matched products/{id} route, ID: " . $matches[1]);
    handleSingleProduct($pdo, $matches[1]);
} else {
    switch ($path) {
        case 'products':
            handleProducts($pdo);
            break;
        case 'orders':
            handleOrders($pdo);
            break;
        case 'categories':
            handleCategories($pdo);
            break;
        case 'importProducts':
            handleImportProducts($pdo);
            break;
        case 'importFromJSON':
            handleImportFromJSON($pdo);
            break;
        default:
            http_response_code(404);
            error_log("404 Not Found: METHOD=" . $_SERVER['REQUEST_METHOD'] . ", PATH=" . $path);
            echo json_encode(['error' => 'Not found', 'path' => $path, 'method' => $_SERVER['REQUEST_METHOD']]);
            break;
    }
}

// Функция для запуска миграций (добавление новых колонок в существующие таблицы)
function runMigrations($pdo) {
    try {
        // Миграция для таблицы products: добавляем недостающие колонки
        $columns = $pdo->query("PRAGMA table_info(products)")->fetchAll(PDO::FETCH_ASSOC);
        $columnNames = array_column($columns, 'name');
        
        if (!in_array('sku', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN sku TEXT");
            error_log("Migration: Added 'sku' column to products table");
        }
        if (!in_array('weight', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN weight TEXT");
            error_log("Migration: Added 'weight' column to products table");
        }
        if (!in_array('calories', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN calories TEXT");
            error_log("Migration: Added 'calories' column to products table");
        }
        if (!in_array('visible_on_site', $columnNames)) {
            $pdo->exec("ALTER TABLE products ADD COLUMN visible_on_site BOOLEAN DEFAULT 1");
            error_log("Migration: Added 'visible_on_site' column to products table");
        }
    } catch (Exception $e) {
        error_log("Migration warning: " . $e->getMessage());
    }
}

function initializeDatabase($pdo) {
    // Create projects table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            domain TEXT,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");
    
    // Insert default project
    $pdo->exec("
        INSERT OR IGNORE INTO projects (id, name, description, domain, status) 
        VALUES (1, 'DANDY Pizza', 'Основной проект DANDY Pizza', 'dandypizzasushi.com', 'active')
    ");
    
    // Create products table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            price DECIMAL(10,2) NOT NULL,
            category TEXT,
            image_url TEXT,
            sku TEXT,
            weight TEXT,
            calories TEXT,
            visible_on_site BOOLEAN DEFAULT 1,
            available BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");
    
    // Create categories table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            slug TEXT UNIQUE,
            image_url TEXT,
            sort_order INTEGER DEFAULT 0
        )
    ");
    
    // Create orders table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name TEXT,
            phone TEXT,
            address TEXT,
            total DECIMAL(10,2) NOT NULL,
            status TEXT DEFAULT 'pending',
            items TEXT, -- JSON string
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");
    
    // Create recipes table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS recipes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            category_id INTEGER,
            output_quantity DECIMAL(10,3) NOT NULL,
            output_unit TEXT NOT NULL,
            cooking_time INTEGER,
            loss_percentage DECIMAL(5,2) DEFAULT 0,
            cooking_instructions TEXT,
            ingredients TEXT, -- JSON string
            cost DECIMAL(10,2) DEFAULT 0,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");
    
    // Create promotions table
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS promotions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            type TEXT NOT NULL,
            discount_type TEXT,
            discount_value DECIMAL(10,2),
            start_date DATETIME,
            end_date DATETIME,
            min_order_amount DECIMAL(10,2),
            max_uses INTEGER,
            promo_code TEXT,
            status TEXT DEFAULT 'active',
            current_uses INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");
    
    // Create synced_products table for website menu items
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS synced_products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_data TEXT NOT NULL,
            synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");
    
    // Insert sample data
    insertSampleData($pdo);
}

function insertSampleData($pdo) {
    // Sample categories
    $categories = [
        ['name' => 'Пицца', 'slug' => 'pizza', 'sort_order' => 1],
        ['name' => 'Суши', 'slug' => 'sushi', 'sort_order' => 2],
        ['name' => 'Напитки', 'slug' => 'drinks', 'sort_order' => 3],
        ['name' => 'Десерты', 'slug' => 'desserts', 'sort_order' => 4]
    ];
    
    foreach ($categories as $cat) {
        $stmt = $pdo->prepare("INSERT INTO categories (name, slug, sort_order) VALUES (?, ?, ?)");
        $stmt->execute([$cat['name'], $cat['slug'], $cat['sort_order']]);
    }
    
    // Sample products
    $products = [
        ['name' => 'Маргарита', 'description' => 'Классическая пицца с томатами и моцареллой', 'price' => 450, 'category' => 'pizza'],
        ['name' => 'Пепперони', 'description' => 'Острая пицца с колбасой пепперони', 'price' => 550, 'category' => 'pizza'],
        ['name' => 'Филадельфия', 'description' => 'Ролл с лососем и сливочным сыром', 'price' => 320, 'category' => 'sushi'],
        ['name' => 'Калифорния', 'description' => 'Ролл с крабом и авокадо', 'price' => 280, 'category' => 'sushi'],
        ['name' => 'Кока-Кола', 'description' => 'Газированный напиток 0.5л', 'price' => 120, 'category' => 'drinks'],
        ['name' => 'Тирамису', 'description' => 'Классический итальянский десерт', 'price' => 250, 'category' => 'desserts']
    ];
    
    foreach ($products as $product) {
        $stmt = $pdo->prepare("INSERT INTO products (name, description, price, category) VALUES (?, ?, ?, ?)");
        $stmt->execute([$product['name'], $product['description'], $product['price'], $product['category']]);
    }
}

function handleProducts($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            $category = $_GET['category'] ?? null;
            $stmt = $pdo->prepare("SELECT * FROM products WHERE available = 1" . ($category ? " AND category = ?" : ""));
            if ($category) {
                $stmt->execute([$category]);
            } else {
                $stmt->execute();
            }
            $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'data' => $products]);
            break;
            
        case 'POST':
            try {
                $input = json_decode(file_get_contents('php://input'), true);
                
                // Логируем что пришло
                error_log("Create product request: " . json_encode($input));
                
                // Проверяем обязательные поля
                if (empty($input['name'])) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'error' => 'Name is required']);
                    return;
                }
                
                // Используем значения по умолчанию для необязательных полей
                $name = $input['name'];
                $description = $input['description'] ?? $input['short_description'] ?? $input['full_description'] ?? '';
                $price = isset($input['price']) ? floatval($input['price']) : 0;
                
                // Обрабатываем категории (может быть массив или строка)
                $category = '';
                if (isset($input['categories'])) {
                    if (is_array($input['categories'])) {
                        $category = implode(',', $input['categories']);
                    } else {
                        $category = $input['categories'];
                    }
                } elseif (isset($input['category'])) {
                    $category = $input['category'];
                }
                
                $sku = $input['sku'] ?? '';
                $image_url = $input['image_url'] ?? '';
                $weight = $input['weight'] ?? null;
                $calories = $input['calories'] ?? null;
                $visible = isset($input['visible_on_site']) ? ($input['visible_on_site'] ? 1 : 0) : 1;
                
                $stmt = $pdo->prepare("
                    INSERT INTO products 
                    (name, description, price, category, sku, image_url, weight, calories, visible_on_site) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ");
                
                $result = $stmt->execute([
                    $name, 
                    $description, 
                    $price, 
                    $category, 
                    $sku, 
                    $image_url, 
                    $weight, 
                    $calories, 
                    $visible
                ]);
                
                if (!$result) {
                    throw new Exception('Failed to insert product: ' . implode(', ', $stmt->errorInfo()));
                }
                
                $newId = $pdo->lastInsertId();
                error_log("Product created successfully with ID: $newId");
                
                echo json_encode([
                    'success' => true,
                    'id' => $newId,
                    'message' => 'Product created successfully'
                ]);
            } catch (Exception $e) {
                error_log("Error creating product: " . $e->getMessage());
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'error' => 'Database error',
                    'message' => $e->getMessage()
                ]);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

function handleSingleProduct($pdo, $productId) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    // Декодируем ID товара (на случай если был encodeURIComponent)
    $productId = urldecode($productId);
    error_log("handleSingleProduct called: METHOD=$method, ID=$productId");
    
    switch ($method) {
        case 'GET':
            // Пробуем найти по ID (число) или по name (строка)
            $stmt = $pdo->prepare("SELECT * FROM products WHERE id = ? OR name = ?");
            $stmt->execute([$productId, $productId]);
            $product = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($product) {
                echo json_encode(['success' => true, 'data' => $product]);
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Product not found', 'searched_id' => $productId]);
            }
            break;
            
        case 'PUT':
            $input = json_decode(file_get_contents('php://input'), true);
            
            if (!$input) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Invalid JSON input']);
                return;
            }
            
            // Проверяем существование товара (по ID или name)
            $stmt = $pdo->prepare("SELECT id FROM products WHERE id = ? OR name = ?");
            $stmt->execute([$productId, $productId]);
            $existing = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$existing) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Product not found']);
                return;
            }
            
            $updateFields = [];
            $params = [];
            
            if (isset($input['name'])) {
                $updateFields[] = "name = ?";
                $params[] = $input['name'];
            }
            if (isset($input['description'])) {
                $updateFields[] = "description = ?";
                $params[] = $input['description'];
            }
            if (isset($input['price'])) {
                $updateFields[] = "price = ?";
                $params[] = $input['price'];
            }
            if (isset($input['category'])) {
                $updateFields[] = "category = ?";
                $params[] = $input['category'];
            }
            if (isset($input['image_url']) || isset($input['picture']) || isset($input['image'])) {
                $image_url = $input['image_url'] ?? $input['picture'] ?? $input['image'] ?? '';
                $updateFields[] = "image_url = ?";
                $params[] = $image_url;
            }
            if (isset($input['available'])) {
                $updateFields[] = "available = ?";
                $params[] = $input['available'] ? 1 : 0;
            }
            
            if (empty($updateFields)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'No fields to update']);
                return;
            }
            
            $params[] = $existing['id'];
            
            $sql = "UPDATE products SET " . implode(', ', $updateFields) . " WHERE id = ?";
            $stmt = $pdo->prepare($sql);
            $result = $stmt->execute($params);
            
            if ($result) {
                // Возвращаем обновленный товар
                $stmt = $pdo->prepare("SELECT * FROM products WHERE id = ?");
                $stmt->execute([$existing['id']]);
                $product = $stmt->fetch(PDO::FETCH_ASSOC);
                
                echo json_encode(['success' => true, 'data' => $product]);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Failed to update product']);
            }
            break;
            
        case 'DELETE':
            error_log("DELETE request for product ID: $productId");
            
            // Пробуем найти товар разными способами:
            // 1. По числовому ID
            // 2. По строковому ID в поле name
            // 3. По строковому ID, начинающемуся с "prod-"
            $stmt = $pdo->prepare("SELECT id, name FROM products WHERE id = ? OR name = ? OR name LIKE ?");
            $stmt->execute([$productId, $productId, $productId . '%']);
            $product = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$product) {
                error_log("Product not found: ID=$productId");
                // Проверяем все товары для отладки
                $allProducts = $pdo->query("SELECT id, name FROM products LIMIT 10")->fetchAll(PDO::FETCH_ASSOC);
                error_log("Sample products: " . json_encode($allProducts));
                
                // Если товар не найден, все равно возвращаем успех (возможно товар только в localStorage)
                // Но логируем это для отладки
                http_response_code(200);
                echo json_encode([
                    'success' => true, 
                    'message' => 'Product not found in database (may exist only in localStorage)',
                    'searched_id' => $productId,
                    'note' => 'Product deletion handled by frontend'
                ]);
                return;
            }
            
            // Удаляем товар по числовому ID
            $stmt = $pdo->prepare("DELETE FROM products WHERE id = ?");
            $result = $stmt->execute([$product['id']]);
            
            if ($result) {
                error_log("Product deleted successfully: DB_ID=" . $product['id'] . ", Name=" . $product['name']);
                echo json_encode([
                    'success' => true, 
                    'message' => 'Product deleted',
                    'deleted_id' => $product['id'],
                    'deleted_name' => $product['name']
                ]);
            } else {
                error_log("Failed to delete product: DB_ID=" . $product['id']);
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Failed to delete product']);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

function handleCategories($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            $stmt = $pdo->query("SELECT * FROM categories ORDER BY sort_order");
            $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'data' => $categories]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

function handleOrders($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            $stmt = $pdo->query("SELECT * FROM orders ORDER BY created_at DESC");
            $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
            // Decode JSON items for each order
            foreach ($orders as &$order) {
                $order['items'] = json_decode($order['items'], true);
            }
            echo json_encode(['success' => true, 'data' => $orders]);
            break;
            
        case 'POST':
            try {
                $input = json_decode(file_get_contents('php://input'), true);
                
                if (!$input) {
                    throw new Exception('Invalid JSON input');
                }
                
                // Extract data from the input
                $customerName = $input['customerName'] ?? $input['customer_name'] ?? '';
                $phone = $input['phone'] ?? $input['customerPhone'] ?? '';
                $address = $input['address'] ?? $input['deliveryAddress'] ?? '';
                $total = $input['total'] ?? 0;
                $items = $input['items'] ?? [];
                
                if (empty($customerName) || empty($phone)) {
                    throw new Exception('Missing required fields: customerName or phone');
                }
                
                $stmt = $pdo->prepare("INSERT INTO orders (customer_name, phone, address, total, items, status) VALUES (?, ?, ?, ?, ?, ?)");
                $stmt->execute([
                    $customerName,
                    $phone,
                    $address,
                    $total,
                    json_encode($items),
                    'pending'
                ]);
                
                $orderId = $pdo->lastInsertId();
                
                // Return format expected by checkout.html
                echo json_encode([
                    'success' => true,
                    'data' => [
                        'id' => $orderId,
                        'customer_name' => $customerName,
                        'phone' => $phone,
                        'address' => $address,
                        'total' => $total,
                        'status' => 'pending',
                        'created_at' => date('Y-m-d H:i:s')
                    ]
                ]);
            } catch (Exception $e) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'error' => $e->getMessage()
                ]);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

function handleSingleOrder($pdo, $orderId) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ?");
            $stmt->execute([$orderId]);
            $order = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($order) {
                $order['items'] = json_decode($order['items'], true);
                echo json_encode(['success' => true, 'data' => $order]);
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Order not found']);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

function handleOrderStatus($pdo, $orderId) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'PUT':
            $input = json_decode(file_get_contents('php://input'), true);
            $newStatus = $input['status'] ?? null;
            
            if (!$newStatus) {
                http_response_code(400);
                echo json_encode(['error' => 'Status is required']);
                return;
            }
            
            $stmt = $pdo->prepare("UPDATE orders SET status = ? WHERE id = ?");
            $result = $stmt->execute([$newStatus, $orderId]);
            
            if ($result) {
                echo json_encode(['success' => true, 'message' => 'Status updated']);
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Order not found']);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

function handleOrderAddress($pdo, $orderId) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'PUT':
            $input = json_decode(file_get_contents('php://input'), true);
            $newAddress = $input['address'] ?? null;
            
            if (!$newAddress) {
                http_response_code(400);
                echo json_encode(['error' => 'Address is required']);
                return;
            }
            
            $stmt = $pdo->prepare("UPDATE orders SET address = ? WHERE id = ?");
            $result = $stmt->execute([$newAddress, $orderId]);
            
            if ($result) {
                echo json_encode(['success' => true, 'message' => 'Address updated']);
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Order not found']);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

function handleProjects($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            $stmt = $pdo->query("SELECT * FROM projects ORDER BY created_at DESC");
            $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'data' => $projects]);
            break;
            
        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true);
            $name = $input['name'] ?? '';
            $description = $input['description'] ?? '';
            $domain = $input['domain'] ?? '';
            $status = $input['status'] ?? 'active';
            
            if (!$name) {
                http_response_code(400);
                echo json_encode(['error' => 'Project name is required']);
                return;
            }
            
            $stmt = $pdo->prepare("
                INSERT INTO projects (name, description, domain, status, created_at, updated_at) 
                VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
            ");
            
            $result = $stmt->execute([$name, $description, $domain, $status]);
            
            if ($result) {
                $projectId = $pdo->lastInsertId();
                $stmt = $pdo->prepare("SELECT * FROM projects WHERE id = ?");
                $stmt->execute([$projectId]);
                $project = $stmt->fetch(PDO::FETCH_ASSOC);
                
                echo json_encode(['success' => true, 'data' => $project]);
            } else {
                http_response_code(500);
                echo json_encode(['error' => 'Failed to create project']);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

function handleSingleProject($pdo, $projectId) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            $stmt = $pdo->prepare("SELECT * FROM projects WHERE id = ?");
            $stmt->execute([$projectId]);
            $project = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($project) {
                echo json_encode(['success' => true, 'data' => $project]);
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Project not found']);
            }
            break;
            
        case 'PUT':
            $input = json_decode(file_get_contents('php://input'), true);
            $name = $input['name'] ?? '';
            $description = $input['description'] ?? '';
            $domain = $input['domain'] ?? '';
            $status = $input['status'] ?? '';
            
            $updateFields = [];
            $params = [];
            
            if ($name) {
                $updateFields[] = "name = ?";
                $params[] = $name;
            }
            if ($description !== '') {
                $updateFields[] = "description = ?";
                $params[] = $description;
            }
            if ($domain) {
                $updateFields[] = "domain = ?";
                $params[] = $domain;
            }
            if ($status) {
                $updateFields[] = "status = ?";
                $params[] = $status;
            }
            
            if (empty($updateFields)) {
                http_response_code(400);
                echo json_encode(['error' => 'No fields to update']);
                return;
            }
            
            $updateFields[] = "updated_at = datetime('now')";
            $params[] = $projectId;
            
            $sql = "UPDATE projects SET " . implode(', ', $updateFields) . " WHERE id = ?";
            $stmt = $pdo->prepare($sql);
            $result = $stmt->execute($params);
            
            if ($result) {
                echo json_encode(['success' => true, 'message' => 'Project updated']);
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Project not found']);
            }
            break;
            
        case 'DELETE':
            $stmt = $pdo->prepare("DELETE FROM projects WHERE id = ?");
            $result = $stmt->execute([$projectId]);
            
            if ($result) {
                echo json_encode(['success' => true, 'message' => 'Project deleted']);
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Project not found']);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

// Recipes handler
function handleRecipes($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            $stmt = $pdo->query("SELECT * FROM recipes ORDER BY created_at DESC");
            $recipes = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'data' => $recipes]);
            break;
            
        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true);
            $stmt = $pdo->prepare("INSERT INTO recipes (name, description, category_id, output_quantity, output_unit, cooking_time, loss_percentage, cooking_instructions, ingredients, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $input['name'],
                $input['description'],
                $input['category_id'],
                $input['output_quantity'],
                $input['output_unit'],
                $input['cooking_time'],
                $input['loss_percentage'],
                $input['cooking_instructions'],
                json_encode($input['ingredients']),
                1
            ]);
            echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

// Promotions handler
function handlePromotions($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            try {
                // Проверяем существование таблицы
                $stmt = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='promotions'");
                if (!$stmt->fetch()) {
                    // Таблица не существует, создаем её
                    $pdo->exec("
                        CREATE TABLE IF NOT EXISTS promotions (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            name TEXT NOT NULL,
                            description TEXT,
                            type TEXT NOT NULL,
                            discount_type TEXT,
                            discount_value DECIMAL(10,2),
                            start_date DATETIME,
                            end_date DATETIME,
                            min_order_amount DECIMAL(10,2),
                            max_uses INTEGER,
                            promo_code TEXT,
                            status TEXT DEFAULT 'active',
                            current_uses INTEGER DEFAULT 0,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                        )
                    ");
                    
                    // Добавляем тестовые данные
                    $pdo->exec("
                        INSERT INTO promotions (name, description, type, discount_type, discount_value, start_date, end_date, status) VALUES 
                        ('Скидка 20% на пиццу', 'Скидка на все виды пиццы', 'discount', 'percentage', 20, '2024-01-01 00:00:00', '2024-12-31 23:59:59', 'active'),
                        ('2 по цене 1', 'При покупке двух пицц - вторая бесплатно', 'bogo', 'none', 0, '2024-01-01 00:00:00', '2024-12-31 23:59:59', 'active')
                    ");
                }
                
                $stmt = $pdo->query("SELECT * FROM promotions ORDER BY created_at DESC");
                $promotions = $stmt->fetchAll(PDO::FETCH_ASSOC);
                echo json_encode(['success' => true, 'data' => $promotions]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
            }
            break;
            
        case 'POST':
            try {
                $input = json_decode(file_get_contents('php://input'), true);
                $stmt = $pdo->prepare("INSERT INTO promotions (name, description, type, discount_type, discount_value, start_date, end_date, min_order_amount, max_uses, promo_code, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
                $stmt->execute([
                    $input['name'],
                    $input['description'],
                    $input['type'],
                    $input['discount_type'],
                    $input['discount_value'],
                    $input['start_date'],
                    $input['end_date'],
                    $input['min_order_amount'],
                    $input['max_uses'],
                    $input['promo_code'],
                    $input['status']
                ]);
                echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Database error: ' . $e->getMessage()]);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

// Handle single promotion by ID (for DELETE requests)
function handlePromotionById($pdo, $promotionId) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    if ($method === 'DELETE') {
        // Старый API не поддерживает удаление через DELETE /promotions/{id}
        // Акции теперь хранятся в /api/admin-state/keys/promotions
        // Возвращаем ошибку с информацией о правильном API
        http_response_code(405);
        echo json_encode([
            'error' => 'Method not allowed',
            'message' => 'DELETE operations for promotions should use /api/admin-state/keys/promotions',
            'note' => 'The promotions module now uses admin-state API. Delete operations should be done through the promotions management module.'
        ]);
        return;
    }
    
    // Для других методов - 405
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}

// Loyalty stats handler
function handleLoyaltyStats($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            $stats = [
                'total_earned' => 15000,
                'total_redeemed' => 8500,
                'customers_by_tier' => [
                    ['tier' => 'bronze', 'count' => 120],
                    ['tier' => 'silver', 'count' => 45],
                    ['tier' => 'gold', 'count' => 12],
                    ['tier' => 'platinum', 'count' => 3]
                ]
            ];
            echo json_encode(['success' => true, 'data' => $stats]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

// Warehouses handler
function handleWarehouses($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            $warehouses = [
                ['id' => 1, 'name' => 'Основной склад', 'address' => 'ул. Примерная, 1'],
                ['id' => 2, 'name' => 'Холодильник', 'address' => 'ул. Примерная, 1']
            ];
            echo json_encode(['success' => true, 'data' => $warehouses]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

// Inventory items handler
function handleInventoryItems($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            $items = [
                ['id' => 1, 'name' => 'Моцарелла', 'quantity' => 5.2, 'unit' => 'kg', 'expiry_date' => '2024-02-15'],
                ['id' => 2, 'name' => 'Лосось', 'quantity' => 2.1, 'unit' => 'kg', 'expiry_date' => '2024-02-10'],
                ['id' => 3, 'name' => 'Рис', 'quantity' => 25.0, 'unit' => 'kg', 'expiry_date' => '2024-12-31']
            ];
            echo json_encode(['success' => true, 'data' => $items]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

// Expiring items handler
function handleExpiringItems($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            $days = $_GET['days'] ?? 7;
            $items = [
                ['id' => 1, 'name' => 'Моцарелла', 'quantity' => 0.8, 'unit' => 'kg', 'expiry_date' => '2024-02-08'],
                ['id' => 2, 'name' => 'Лосось', 'quantity' => 1.2, 'unit' => 'kg', 'expiry_date' => '2024-02-09']
            ];
            echo json_encode(['success' => true, 'data' => $items]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

// Current shift handler
function handleCurrentShift($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            $shift = [
                'id' => 1,
                'cashier_name' => 'Иван Петров',
                'start_time' => '2024-01-15 09:00:00',
                'status' => 'open',
                'total_sales' => 12500.00,
                'orders_count' => 45
            ];
            echo json_encode(['success' => true, 'data' => $shift]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

// Couriers handler
function handleCouriers($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            $couriers = [
                ['id' => 1, 'name' => 'Алексей', 'phone' => '+7(999)123-45-67', 'status' => 'active', 'current_order' => null],
                ['id' => 2, 'name' => 'Дмитрий', 'phone' => '+7(999)123-45-68', 'status' => 'busy', 'current_order' => '#1029'],
                ['id' => 3, 'name' => 'Сергей', 'phone' => '+7(999)123-45-69', 'status' => 'offline', 'current_order' => null]
            ];
            echo json_encode(['success' => true, 'data' => $couriers]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

// Courier deliveries handler
function handleCourierDeliveries($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            $deliveries = [
                ['id' => 1, 'courier_id' => 1, 'order_id' => 1029, 'status' => 'delivering', 'start_time' => '2024-01-15 14:30:00'],
                ['id' => 2, 'courier_id' => 2, 'order_id' => 1028, 'status' => 'delivered', 'start_time' => '2024-01-15 13:15:00', 'end_time' => '2024-01-15 14:00:00']
            ];
            echo json_encode(['success' => true, 'data' => $deliveries]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

// Mercury batches handler
function handleMercuryBatches($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            $batches = [
                [
                    'id' => 1,
                    'product_name' => 'Лосось свежий',
                    'batch_number' => 'LS-2024-001',
                    'quantity' => 5.2,
                    'unit' => 'кг',
                    'production_date' => '2024-01-10',
                    'expiry_date' => '2024-01-20',
                    'supplier' => 'ООО "Рыбный мир"',
                    'status' => 'active',
                    'guid' => '123e4567-e89b-12d3-a456-426614174000'
                ],
                [
                    'id' => 2,
                    'product_name' => 'Мясо говядина',
                    'batch_number' => 'MG-2024-002',
                    'quantity' => 12.5,
                    'unit' => 'кг',
                    'production_date' => '2024-01-12',
                    'expiry_date' => '2024-01-22',
                    'supplier' => 'ООО "Мясокомбинат"',
                    'status' => 'redeemed',
                    'guid' => '123e4567-e89b-12d3-a456-426614174001'
                ]
            ];
            echo json_encode(['success' => true, 'data' => $batches]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

// Mercury documents handler
function handleMercuryDocuments($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            $documents = [
                [
                    'id' => 1,
                    'type' => 'VSD',
                    'number' => 'ВСД-001',
                    'date' => '2024-01-15',
                    'supplier' => 'ООО "Рыбный мир"',
                    'status' => 'received',
                    'batches_count' => 3
                ],
                [
                    'id' => 2,
                    'type' => 'VSD',
                    'number' => 'ВСД-002',
                    'date' => '2024-01-14',
                    'supplier' => 'ООО "Мясокомбинат"',
                    'status' => 'processing',
                    'batches_count' => 5
                ]
            ];
            echo json_encode(['success' => true, 'data' => $documents]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

// EDO documents handler
function handleEDODocuments($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            $documents = [
                [
                    'id' => 1,
                    'type' => 'incoming',
                    'number' => 'УПД-001',
                    'date' => '2024-01-15',
                    'counterparty' => 'ООО "Поставщик продуктов"',
                    'amount' => 25000,
                    'status' => 'signed',
                    'description' => 'Поставка продуктов питания'
                ],
                [
                    'id' => 2,
                    'type' => 'outgoing',
                    'number' => 'УПД-002',
                    'date' => '2024-01-14',
                    'counterparty' => 'ИП Иванов И.И.',
                    'amount' => 15000,
                    'status' => 'pending',
                    'description' => 'Поставка оборудования'
                ]
            ];
            echo json_encode(['success' => true, 'data' => $documents]);
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

/**
 * Check if promotions are applicable to a given cart
 * POST /api/promotions/check
 * Body: { "cart": [...items], "customer_id": 123 }
 */
function handlePromotionsCheck($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $cart = $input['cart'] ?? [];
    
    $response = [
        'success' => true,
        'appliedPromotions' => [],
        'eligiblePromotions' => []
    ];
    
    // Calculate cart totals by category
    $categoryTotals = [];
    $totalAmount = 0;
    
    foreach ($cart as $item) {
        if (isset($item['isPromoItem']) && $item['isPromoItem']) {
            continue; // Skip promo items from calculation
        }
        
        $category = $item['category'] ?? 'other';
        $itemTotal = ($item['price'] ?? 0) * ($item['qty'] ?? 1);
        
        if (!isset($categoryTotals[$category])) {
            $categoryTotals[$category] = 0;
        }
        $categoryTotals[$category] += $itemTotal;
        $totalAmount += $itemTotal;
    }
    
    // Check ROLL2500 promo
    $rollsAmount = $categoryTotals['rolls'] ?? 0;
    if ($rollsAmount >= 2500) {
        $hasRollGift = false;
        foreach ($cart as $item) {
            if (isset($item['promoId']) && $item['promoId'] === 'ROLL2500') {
                $hasRollGift = true;
                break;
            }
        }
        
        if ($hasRollGift) {
            $response['appliedPromotions'][] = [
                'id' => 'ROLL2500',
                'title' => 'Ролл «Калифорния с крабом» за 1 ₽',
                'status' => 'added',
                'description' => 'Подарок добавлен за покупку роллов от 2500₽'
            ];
        } else {
            $response['eligiblePromotions'][] = [
                'id' => 'ROLL2500',
                'title' => 'Ролл «Калифорния с крабом» за 1 ₽',
                'status' => 'eligible',
                'description' => 'Доступен подарок за роллы от 2500₽',
                'action' => 'add_to_cart'
            ];
        }
    }
    
    // Add metadata about cart
    $response['meta'] = [
        'totalAmount' => $totalAmount,
        'rollsAmount' => $rollsAmount,
        'categoryTotals' => $categoryTotals
    ];
    
    echo json_encode($response);
}

/**
 * Get list of currently eligible promotions for a cart
 * POST /api/promotions/eligible
 * Body: { "cart": [...items] }
 */
function handleEligiblePromotions($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $cart = $input['cart'] ?? [];
    
    $eligible = [];
    
    // Calculate rolls amount
    $rollsAmount = 0;
    foreach ($cart as $item) {
        if (isset($item['isPromoItem']) && $item['isPromoItem']) continue;
        
        $name = strtolower($item['name'] ?? '');
        if (strpos($name, 'ролл') !== false) {
            $rollsAmount += ($item['price'] ?? 0) * ($item['qty'] ?? 1);
        }
    }
    
    // ROLL2500 promo
    if ($rollsAmount >= 2500) {
        // Check if gift already in cart
        $hasGift = false;
        foreach ($cart as $item) {
            if (isset($item['promoId']) && ($item['promoId'] === 'ROLL2500' || $item['promoId'] === 'ROLL6')) {
                $hasGift = true;
                break;
            }
        }
        
        if (!$hasGift) {
            $eligible[] = [
                'id' => 'ROLL2500',
                'type' => 'gift',
                'title' => 'Ролл «Калифорния с крабом» за 1 ₽',
                'requiredCategory' => 'rolls',
                'thresholdAmount' => 2500,
                'currentAmount' => $rollsAmount,
                'giftProduct' => [
                    'name' => 'Калифорния с крабом',
                    'price' => 1,
                    'excludeFromBonuses' => true,
                    'excludeFromDiscounts' => true
                ]
            ];
        }
    }
    
    echo json_encode([
        'success' => true,
        'eligible' => $eligible,
        'rollsAmount' => $rollsAmount
    ]);
}

/**
 * Handle product import from CSV/YML files
 * POST /api/importProducts
 * FormData: file (CSV or YML), updateExisting (optional checkbox)
 */
function handleImportProducts($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
        return;
    }
    
    try {
        // Check if file was uploaded
        if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => 'File upload failed',
                'message' => 'Файл не был загружен или произошла ошибка загрузки'
            ]);
            return;
        }
        
        $file = $_FILES['file'];
        $updateExisting = isset($_POST['updateExisting']) && $_POST['updateExisting'] === 'true';
        $importHidden = isset($_POST['importHidden']) && $_POST['importHidden'] === 'true';
        
        // Validate file type
        $fileName = $file['name'];
        $fileTmpPath = $file['tmp_name'];
        $fileMimeType = $file['type'];
        $fileExtension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
        
        $allowedExtensions = ['csv', 'yml', 'xml'];
        $allowedMimeTypes = [
            'text/csv',
            'text/plain',
            'application/vnd.ms-excel',
            'application/xml',
            'text/xml'
        ];
        
        if (!in_array($fileExtension, $allowedExtensions)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => 'Invalid file type',
                'message' => 'Разрешенные форматы: CSV, YML, XML'
            ]);
            return;
        }
        
        // Log import start
        $logPath = __DIR__ . '/../logs/import.log';
        $logDir = dirname($logPath);
        if (!file_exists($logDir)) {
            mkdir($logDir, 0777, true);
        }
        
        $logEntry = date('Y-m-d H:i:s') . " | Импорт начат | Файл: $fileName | Размер: " . filesize($fileTmpPath) . " байт\n";
        file_put_contents($logPath, $logEntry, FILE_APPEND);
        
        $importedCount = 0;
        $updatedCount = 0;
        $errorsCount = 0;
        $errors = [];
        
        // Determine file type and process
        if ($fileExtension === 'csv') {
            $result = processCSVFile($pdo, $fileTmpPath, $updateExisting, $importHidden, $logPath);
            $importedCount = $result['created'];
            $updatedCount = $result['updated'];
            $errorsCount = $result['errors'];
            $errors = $result['errorMessages'];
        } else if (in_array($fileExtension, ['yml', 'xml'])) {
            $result = processYMLFile($pdo, $fileTmpPath, $updateExisting, $importHidden, $logPath);
            $importedCount = $result['created'];
            $updatedCount = $result['updated'];
            $errorsCount = $result['errors'];
            $errors = $result['errorMessages'];
        } else {
            throw new Exception('Unsupported file format');
        }
        
        // Log import completion
        $logEntry = date('Y-m-d H:i:s') . " | Импорт завершен | Создано: $importedCount | Обновлено: $updatedCount | Ошибок: $errorsCount\n";
        if (!empty($errors)) {
            $logEntry .= "Ошибки:\n" . implode("\n", array_slice($errors, 0, 10)) . "\n";
        }
        file_put_contents($logPath, $logEntry, FILE_APPEND);
        
        echo json_encode([
            'success' => true,
            'message' => "Импорт завершен. Создано: $importedCount, Обновлено: $updatedCount, Ошибок: $errorsCount",
            'created' => $importedCount,
            'updated' => $updatedCount,
            'errors' => $errorsCount,
            'errorMessages' => array_slice($errors, 0, 10) // Return first 10 errors
        ]);
        
    } catch (Exception $e) {
        $logEntry = date('Y-m-d H:i:s') . " | ОШИБКА ИМПОРТА: " . $e->getMessage() . "\n";
        file_put_contents($logPath ?? __DIR__ . '/../logs/import.log', $logEntry, FILE_APPEND);
        
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Import failed',
            'message' => $e->getMessage()
        ]);
    }
}

/**
 * Process CSV file
 */
function processCSVFile($pdo, $filePath, $updateExisting, $importHidden, $logPath) {
    $created = 0;
    $updated = 0;
    $errors = 0;
    $errorMessages = [];
    
    // Read CSV file
    if (($handle = fopen($filePath, 'r')) === false) {
        throw new Exception('Не удалось открыть CSV файл');
    }
    
    // Read first line as headers
    $headers = fgetcsv($handle, 0, ',');
    if ($headers === false || empty($headers)) {
        fclose($handle);
        throw new Exception('CSV файл пуст или не содержит заголовков');
    }
    
    // Normalize headers (trim spaces)
    $headers = array_map('trim', $headers);
    
    // Map CSV columns to database fields
    // Common mappings: name, price, description, category, image_url
    $fieldMapping = [
        'name' => null,
        'price' => null,
        'description' => null,
        'category' => null,
        'image_url' => null,
        'image' => null,
        'picture' => null,
        'sku' => null,
        'available' => null
    ];
    
    // Try to find matching headers
    foreach ($headers as $index => $header) {
        $headerLower = mb_strtolower(trim($header));
        if (in_array($headerLower, ['название', 'name', 'имя', 'product'])) {
            $fieldMapping['name'] = $index;
        } elseif (in_array($headerLower, ['цена', 'price', 'стоимость', 'cost'])) {
            $fieldMapping['price'] = $index;
        } elseif (in_array($headerLower, ['описание', 'description', 'desc', 'опис'])) {
            $fieldMapping['description'] = $index;
        } elseif (in_array($headerLower, ['категория', 'category', 'cat', 'кат'])) {
            $fieldMapping['category'] = $index;
        } elseif (in_array($headerLower, ['изображение', 'image', 'img', 'picture', 'photo', 'картинка'])) {
            $fieldMapping['image_url'] = $index;
        } elseif (in_array($headerLower, ['артикул', 'sku', 'code', 'код'])) {
            $fieldMapping['sku'] = $index;
        } elseif (in_array($headerLower, ['доступен', 'available', 'avail', 'в наличии'])) {
            $fieldMapping['available'] = $index;
        }
    }
    
    // Name is required
    if ($fieldMapping['name'] === null) {
        fclose($handle);
        throw new Exception('Не найдена колонка с названием товара. Ожидаемые заголовки: название, name, имя, product');
    }
    
    // Price is required
    if ($fieldMapping['price'] === null) {
        fclose($handle);
        throw new Exception('Не найдена колонка с ценой. Ожидаемые заголовки: цена, price, стоимость, cost');
    }
    
    // Prepare INSERT statement
    $insertStmt = $pdo->prepare("
        INSERT INTO products (name, description, price, category, image_url, available, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ");
    
    // Prepare UPDATE statement
    $updateStmt = null;
    if ($updateExisting) {
        // For update, we need to find by name
        $updateStmt = $pdo->prepare("
            UPDATE products 
            SET name = ?, description = ?, price = ?, category = ?, image_url = ?, available = ?
            WHERE name = ?
        ");
    }
    
    // Process each row
    $lineNumber = 1; // Start from 1 because headers are line 1
    while (($row = fgetcsv($handle, 0, ',')) !== false) {
        $lineNumber++;
        
        try {
            if (count($row) < count($headers)) {
                // Pad row with empty strings if needed
                $row = array_pad($row, count($headers), '');
            }
            
            // Extract data
            $name = trim($row[$fieldMapping['name']] ?? '');
            $price = trim($row[$fieldMapping['price']] ?? '0');
            $description = trim($row[$fieldMapping['description']] ?? '');
            $category = trim($row[$fieldMapping['category']] ?? '');
            $imageUrl = trim($row[$fieldMapping['image_url']] ?? '');
            $sku = trim($row[$fieldMapping['sku']] ?? '');
            $available = trim($row[$fieldMapping['available']] ?? '');
            
            // Validate required fields
            if (empty($name)) {
                $errors++;
                $errorMessages[] = "Строка $lineNumber: отсутствует название товара";
                continue;
            }
            
            // Convert price to decimal
            $price = str_replace(',', '.', $price); // Replace comma with dot
            $priceDecimal = floatval($price);
            if ($priceDecimal <= 0) {
                $errors++;
                $errorMessages[] = "Строка $lineNumber: некорректная цена ($price)";
                continue;
            }
            
            // Convert available to boolean
            $availableBool = 1;
            if (!empty($available)) {
                $availableLower = mb_strtolower($available);
                if (in_array($availableLower, ['0', 'false', 'нет', 'no', 'н'])) {
                    $availableBool = 0;
                }
            }
            if ($importHidden) {
                $availableBool = 0;
            }
            
            // Check if product exists (for update mode)
            $shouldUpdate = false;
            if ($updateExisting) {
                $checkStmt = $pdo->prepare("SELECT id FROM products WHERE name = ?");
                $checkStmt->execute([$name]);
                if ($checkStmt->fetch()) {
                    $shouldUpdate = true;
                }
            }
            
            if ($shouldUpdate && $updateStmt) {
                // Update existing product
                $updateStmt->execute([$name, $description, $priceDecimal, $category, $imageUrl, $availableBool, $name]);
                if ($updateStmt->rowCount() > 0) {
                    $updated++;
                } else {
                    $errors++;
                    $errorMessages[] = "Строка $lineNumber: не удалось обновить товар '$name'";
                }
            } else {
                // Insert new product
                $insertStmt->execute([$name, $description, $priceDecimal, $category, $imageUrl, $availableBool]);
                $created++;
            }
            
        } catch (Exception $e) {
            $errors++;
            $errorMessages[] = "Строка $lineNumber: " . $e->getMessage();
            file_put_contents($logPath, date('Y-m-d H:i:s') . " | Ошибка в строке $lineNumber: " . $e->getMessage() . "\n", FILE_APPEND);
        }
    }
    
    fclose($handle);
    
    return [
        'created' => $created,
        'updated' => $updated,
        'errors' => $errors,
        'errorMessages' => $errorMessages
    ];
}

/**
 * Process YML file
 */
function processYMLFile($pdo, $filePath, $updateExisting, $importHidden, $logPath) {
    $created = 0;
    $updated = 0;
    $errors = 0;
    $errorMessages = [];
    
    // Load XML file
    libxml_use_internal_errors(true);
    $xml = simplexml_load_file($filePath);
    
    if ($xml === false) {
        $xmlErrors = libxml_get_errors();
        $errorMessages[] = 'Ошибка парсинга XML: ' . implode(', ', array_map(function($e) { return $e->message; }, $xmlErrors));
        throw new Exception('Не удалось прочитать YML/XML файл: ' . $errorMessages[0]);
    }
    
    // Find offers
    $offers = $xml->xpath('//offer');
    if (empty($offers)) {
        // Try shop->offers->offer structure
        $offers = $xml->xpath('//shop/offers/offer');
    }
    if (empty($offers)) {
        throw new Exception('Не найдены элементы <offer> в YML файле');
    }
    
    // Prepare statements
    $insertStmt = $pdo->prepare("
        INSERT INTO products (name, description, price, category, image_url, available, created_at) 
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ");
    
    $updateStmt = null;
    if ($updateExisting) {
        $updateStmt = $pdo->prepare("
            UPDATE products 
            SET name = ?, description = ?, price = ?, category = ?, image_url = ?, available = ?
            WHERE name = ?
        ");
    }
    
    $offerNumber = 0;
    foreach ($offers as $offer) {
        $offerNumber++;
        
        try {
            // Extract offer data
            $id = (string)($offer['id'] ?? '');
            $name = (string)($offer->name ?? $offer->model ?? '');
            $price = (string)($offer->price ?? '0');
            $description = (string)($offer->description ?? '');
            $categoryId = (string)($offer->categoryId ?? '');
            $url = (string)($offer->url ?? '');
            $picture = (string)($offer->picture ?? '');
            
            // Try to get picture from array if exists
            if (empty($picture) && isset($offer->picture) && is_array($offer->picture)) {
                $picture = (string)($offer->picture[0] ?? '');
            }
            
            // Get category name from categories tree
            $categoryName = '';
            if (!empty($categoryId)) {
                $categoryNode = $xml->xpath("//category[@id='$categoryId']");
                if (!empty($categoryNode)) {
                    $categoryName = (string)$categoryNode[0];
                }
            }
            
            // Validate required fields
            if (empty($name)) {
                $errors++;
                $errorMessages[] = "Offer #$offerNumber (id=$id): отсутствует название";
                continue;
            }
            
            // Convert price
            $price = str_replace(',', '.', $price);
            $priceDecimal = floatval($price);
            if ($priceDecimal <= 0) {
                $errors++;
                $errorMessages[] = "Offer #$offerNumber (id=$id): некорректная цена ($price)";
                continue;
            }
            
            // Determine availability
            $availableBool = 1;
            $availableAttr = (string)($offer['available'] ?? '');
            if ($availableAttr === 'false' || $availableAttr === '0') {
                $availableBool = 0;
            }
            if ($importHidden) {
                $availableBool = 0;
            }
            
            // Use picture or url as image_url
            $imageUrl = !empty($picture) ? $picture : $url;
            
            // Check if product exists
            $shouldUpdate = false;
            if ($updateExisting) {
                $checkStmt = $pdo->prepare("SELECT id FROM products WHERE name = ?");
                $checkStmt->execute([$name]);
                if ($checkStmt->fetch()) {
                    $shouldUpdate = true;
                }
            }
            
            if ($shouldUpdate && $updateStmt) {
                $updateStmt->execute([$name, $description, $priceDecimal, $categoryName, $imageUrl, $availableBool, $name]);
                if ($updateStmt->rowCount() > 0) {
                    $updated++;
                } else {
                    $errors++;
                    $errorMessages[] = "Offer #$offerNumber (id=$id): не удалось обновить товар '$name'";
                }
            } else {
                $insertStmt->execute([$name, $description, $priceDecimal, $categoryName, $imageUrl, $availableBool]);
                $created++;
            }
            
        } catch (Exception $e) {
            $errors++;
            $errorMessages[] = "Offer #$offerNumber: " . $e->getMessage();
            file_put_contents($logPath, date('Y-m-d H:i:s') . " | Ошибка в offer #$offerNumber: " . $e->getMessage() . "\n", FILE_APPEND);
        }
    }
    
    return [
        'created' => $created,
        'updated' => $updated,
        'errors' => $errors,
        'errorMessages' => $errorMessages
    ];
}

/**
 * Import products from local products-data.json file into database
 */
function handleImportFromJSON($pdo) {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
        return;
    }
    
    try {
        // Path to products-data.json
        $jsonPath = __DIR__ . '/../products-data.json';
        
        if (!file_exists($jsonPath)) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'error' => 'File not found',
                'message' => 'Файл products-data.json не найден'
            ]);
            return;
        }
        
        // Read JSON file
        $jsonContent = file_get_contents($jsonPath);
        $products = json_decode($jsonContent, true);
        
        if (!is_array($products)) {
            throw new Exception('Некорректный формат JSON файла');
        }
        
        $created = 0;
        $updated = 0;
        $errors = 0;
        $errorMessages = [];
        
        // Prepare statements
        $checkStmt = $pdo->prepare("SELECT id FROM products WHERE name = ? OR sku = ?");
        $insertStmt = $pdo->prepare("
            INSERT INTO products 
            (name, description, price, category, sku, image_url, weight, calories, visible_on_site, available, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ");
        
        foreach ($products as $index => $product) {
            try {
                // Extract product data
                $name = $product['name'] ?? '';
                $description = $product['description'] ?? $product['short_description'] ?? '';
                $price = isset($product['price']) ? floatval($product['price']) : 0;
                $category = $product['category'] ?? '';
                $sku = $product['sku'] ?? $product['id'] ?? '';
                $imageUrl = $product['image'] ?? $product['image_url'] ?? '';
                $weight = $product['weight'] ?? null;
                $calories = isset($product['calories']) ? intval($product['calories']) : null;
                $visible = isset($product['visible_on_site']) ? ($product['visible_on_site'] ? 1 : 0) : 1;
                $available = isset($product['available']) ? ($product['available'] ? 1 : 0) : 1;
                
                // Validate required fields
                if (empty($name)) {
                    $errors++;
                    $errorMessages[] = "Товар #$index: отсутствует название";
                    continue;
                }
                
                // Check if product already exists
                $checkStmt->execute([$name, $sku]);
                $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);
                
                if ($existing) {
                    // ✅ Обновляем существующий товар с weight и calories
                    $updateStmt = $pdo->prepare("
                        UPDATE products 
                        SET description = ?, price = ?, category = ?, image_url = ?, 
                            weight = ?, calories = ?, visible_on_site = ?, available = ?
                        WHERE id = ?
                    ");
                    $updateStmt->execute([
                        $description,
                        $price,
                        $category,
                        $imageUrl,
                        $weight,
                        $calories,
                        $visible,
                        $available,
                        $existing['id']
                    ]);
                    $updated++;
                } else {
                // Insert new product
                $insertStmt->execute([
                    $name,
                    $description,
                    $price,
                    $category,
                    $sku,
                    $imageUrl,
                    $weight,
                    $calories,
                    $visible,
                    $available
                ]);
                $created++;
                }
                
            } catch (Exception $e) {
                $errors++;
                $errorMessages[] = "Товар #$index: " . $e->getMessage();
            }
        }
        
        error_log("Import from JSON completed: created=$created, updated=$updated, errors=$errors");
        
        echo json_encode([
            'success' => true,
            'message' => "Импорт завершен. Создано: $created, Пропущено (уже существует): $updated, Ошибок: $errors",
            'created' => $created,
            'updated' => $updated,
            'errors' => $errors,
            'errorMessages' => array_slice($errorMessages, 0, 10) // First 10 errors
        ]);
        
    } catch (Exception $e) {
        error_log("Import from JSON error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Import failed',
            'message' => $e->getMessage()
        ]);
    }
}

/**
 * Handle products synchronization for website
 * GET /api/products/sync - Get synced products
 * POST /api/products/sync - Save synced products
 */
function handleProductsSync($pdo) {
    $method = $_SERVER['REQUEST_METHOD'];
    
    // Ensure table exists
    try {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS synced_products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_data TEXT NOT NULL,
                synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ");
    } catch (Exception $e) {
        error_log("Error creating synced_products table: " . $e->getMessage());
    }
    
    switch ($method) {
        case 'GET':
            try {
                // Get the most recent sync
                $stmt = $pdo->query("SELECT product_data, synced_at FROM synced_products ORDER BY synced_at DESC LIMIT 1");
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if ($row) {
                    $products = json_decode($row['product_data'], true);
                    if (json_last_error() === JSON_ERROR_NONE) {
                        echo json_encode([
                            'success' => true,
                            'data' => $products,
                            'synced_at' => $row['synced_at']
                        ]);
                    } else {
                        echo json_encode([
                            'success' => true,
                            'data' => [],
                            'synced_at' => null
                        ]);
                    }
                } else {
                    echo json_encode([
                        'success' => true,
                        'data' => [],
                        'synced_at' => null
                    ]);
                }
            } catch (Exception $e) {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'error' => 'Database error',
                    'message' => $e->getMessage()
                ]);
            }
            break;
            
        case 'POST':
            try {
                $input = json_decode(file_get_contents('php://input'), true);
                
                if (!isset($input['products'])) {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'error' => 'Products array is required'
                    ]);
                    return;
                }
                
                $products = $input['products'];
                if (!is_array($products)) {
                    http_response_code(400);
                    echo json_encode([
                        'success' => false,
                        'error' => 'Products must be an array'
                    ]);
                    return;
                }
                
                // Delete old synced products
                $pdo->exec("DELETE FROM synced_products");
                
                // Insert new synced products
                $productDataJson = json_encode($products);
                $stmt = $pdo->prepare("INSERT INTO synced_products (product_data, synced_at) VALUES (?, datetime('now'))");
                $stmt->execute([$productDataJson]);
                
                echo json_encode([
                    'success' => true,
                    'message' => 'Products synced successfully',
                    'count' => count($products),
                    'synced_at' => date('Y-m-d H:i:s')
                ]);
            } catch (Exception $e) {
                error_log("Error syncing products: " . $e->getMessage());
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'error' => 'Database error',
                    'message' => $e->getMessage()
                ]);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}
?>

