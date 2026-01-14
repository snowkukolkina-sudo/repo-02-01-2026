<?php
// Скрипт для инициализации базы данных
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h1>Инициализация базы данных DANDY Pizza</h1>";
echo "<pre>";

$db_path = __DIR__ . '/database.sqlite';

echo "Путь к БД: $db_path\n";
echo "Существует ли файл: " . (file_exists($db_path) ? "ДА" : "НЕТ") . "\n";
echo "Права на запись в папку: " . (is_writable(__DIR__) ? "ДА" : "НЕТ") . "\n\n";

// Удаляем старую БД если есть
if (file_exists($db_path)) {
    echo "Удаляю старую БД...\n";
    unlink($db_path);
}

echo "Создаю новую БД...\n";

try {
    $pdo = new PDO("sqlite:$db_path");
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "✅ Подключение к БД успешно!\n\n";
    
    // Create projects table
    echo "Создаю таблицу projects...\n";
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
    echo "✅ Таблица projects создана\n";
    
    // Insert default project
    echo "Добавляю проект по умолчанию...\n";
    $pdo->exec("
        INSERT OR IGNORE INTO projects (id, name, description, domain, status) 
        VALUES (1, 'DANDY Pizza', 'Основной проект DANDY Pizza', 'dandypizzasushi.com', 'active')
    ");
    echo "✅ Проект добавлен\n\n";
    
    // Create products table
    echo "Создаю таблицу products...\n";
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            price DECIMAL(10,2) NOT NULL,
            category TEXT,
            image_url TEXT,
            available BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");
    echo "✅ Таблица products создана\n";
    
    // Create categories table
    echo "Создаю таблицу categories...\n";
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            slug TEXT UNIQUE,
            image_url TEXT,
            sort_order INTEGER DEFAULT 0
        )
    ");
    echo "✅ Таблица categories создана\n";
    
    // Create orders table
    echo "Создаю таблицу orders...\n";
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name TEXT,
            phone TEXT,
            address TEXT,
            total DECIMAL(10,2) NOT NULL,
            status TEXT DEFAULT 'pending',
            items TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");
    echo "✅ Таблица orders создана\n\n";
    
    // Проверяем таблицы
    echo "Проверяю созданные таблицы:\n";
    $tables = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")->fetchAll(PDO::FETCH_COLUMN);
    foreach ($tables as $table) {
        echo "  - $table\n";
    }
    
    echo "\n✅ БАЗА ДАННЫХ УСПЕШНО ИНИЦИАЛИЗИРОВАНА!\n";
    echo "\nРазмер файла БД: " . filesize($db_path) . " байт\n";
    echo "Права на файл: " . substr(sprintf('%o', fileperms($db_path)), -4) . "\n";
    
} catch (Exception $e) {
    echo "❌ ОШИБКА: " . $e->getMessage() . "\n";
    echo "Трейс: " . $e->getTraceAsString() . "\n";
}

echo "</pre>";
echo "<hr>";
echo "<p><a href='index.php'>← Вернуться к API</a> | <a href='../test-api.html'>Протестировать API</a></p>";
?>

