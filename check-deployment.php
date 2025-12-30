<?php
// Скрипт проверки развертывания DANDY Pizza
header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Проверка развертывания DANDY Pizza</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .check { margin: 10px 0; padding: 10px; border-radius: 5px; }
        .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .warning { background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
        h1 { color: #04746c; }
        h2 { color: #08615b; }
    </style>
</head>
<body>
    <h1>🍕 Проверка развертывания DANDY Pizza</h1>
    
    <?php
    $checks = [];
    
    // Проверка PHP версии
    $php_version = phpversion();
    $checks[] = [
        'name' => 'PHP версия',
        'status' => version_compare($php_version, '8.0.0', '>=') ? 'success' : 'error',
        'message' => "Текущая версия: $php_version " . (version_compare($php_version, '8.0.0', '>=') ? '✅' : '❌ Требуется PHP 8.0+')
    ];
    
    // Проверка модулей PHP
    $required_modules = ['pdo', 'pdo_sqlite', 'json', 'mbstring'];
    foreach ($required_modules as $module) {
        $checks[] = [
            'name' => "Модуль PHP: $module",
            'status' => extension_loaded($module) ? 'success' : 'error',
            'message' => extension_loaded($module) ? 'Установлен ✅' : 'Не установлен ❌'
        ];
    }
    
    // Проверка файлов
    $required_files = [
        'index.html' => 'Главная страница',
        'api/index.php' => 'API сервер',
        'config.php' => 'Конфигурация',
        '.htaccess' => 'Настройки Apache'
    ];
    
    foreach ($required_files as $file => $description) {
        $checks[] = [
            'name' => $description,
            'status' => file_exists($file) ? 'success' : 'error',
            'message' => file_exists($file) ? "Файл найден ✅" : "Файл отсутствует ❌"
        ];
    }
    
    // Проверка папок
    $required_dirs = [
        'assets' => 'Ресурсы (изображения, стили)',
        'js' => 'JavaScript файлы',
        'modules' => 'JS модули',
        'logs' => 'Папка логов'
    ];
    
    foreach ($required_dirs as $dir => $description) {
        $checks[] = [
            'name' => $description,
            'status' => is_dir($dir) ? 'success' : 'warning',
            'message' => is_dir($dir) ? "Папка существует ✅" : "Папка отсутствует ⚠️"
        ];
    }
    
    // Проверка прав доступа
    $writable_dirs = ['logs'];
    foreach ($writable_dirs as $dir) {
        if (is_dir($dir)) {
            $checks[] = [
                'name' => "Права записи: $dir",
                'status' => is_writable($dir) ? 'success' : 'error',
                'message' => is_writable($dir) ? 'Доступна запись ✅' : 'Нет прав записи ❌'
            ];
        }
    }
    
    // Проверка базы данных
    if (file_exists('database.sqlite')) {
        try {
            $pdo = new PDO('sqlite:database.sqlite');
            $stmt = $pdo->query("SELECT COUNT(*) FROM products");
            $product_count = $stmt->fetchColumn();
            $checks[] = [
                'name' => 'База данных SQLite',
                'status' => 'success',
                'message' => "База данных работает ✅ ($product_count продуктов)"
            ];
        } catch (Exception $e) {
            $checks[] = [
                'name' => 'База данных SQLite',
                'status' => 'error',
                'message' => 'Ошибка базы данных ❌: ' . $e->getMessage()
            ];
        }
    } else {
        $checks[] = [
            'name' => 'База данных SQLite',
            'status' => 'warning',
            'message' => 'База данных будет создана при первом обращении к API ⚠️'
        ];
    }
    
    // Проверка API
    $api_url = 'http' . (isset($_SERVER['HTTPS']) ? 's' : '') . '://' . $_SERVER['HTTP_HOST'] . dirname($_SERVER['REQUEST_URI']) . '/api/products';
    $api_response = @file_get_contents($api_url);
    $checks[] = [
        'name' => 'API тест',
        'status' => $api_response !== false ? 'success' : 'warning',
        'message' => $api_response !== false ? 'API отвечает ✅' : 'API недоступен ⚠️'
    ];
    
    // Вывод результатов
    foreach ($checks as $check) {
        echo "<div class='check {$check['status']}'>";
        echo "<strong>{$check['name']}:</strong> {$check['message']}";
        echo "</div>";
    }
    
    // Общая оценка
    $success_count = count(array_filter($checks, function($c) { return $c['status'] === 'success'; }));
    $total_count = count($checks);
    $percentage = round(($success_count / $total_count) * 100);
    
    echo "<h2>Общая оценка: $percentage% ($success_count/$total_count)</h2>";
    
    if ($percentage >= 90) {
        echo "<div class='check success'><strong>🎉 Отлично!</strong> Сайт готов к работе!</div>";
    } elseif ($percentage >= 70) {
        echo "<div class='check warning'><strong>⚠️ Хорошо</strong> Есть небольшие проблемы, но сайт должен работать.</div>";
    } else {
        echo "<div class='check error'><strong>❌ Проблемы</strong> Требуется исправление ошибок перед запуском.</div>";
    }
    ?>
    
    <h2>Полезные ссылки</h2>
    <ul>
        <li><a href="index.html">Главная страница</a></li>
        <li><a href="api/products">API: Продукты</a></li>
        <li><a href="api/categories">API: Категории</a></li>
        <li><a href="РАЗВЕРТЫВАНИЕ.md">Инструкция по развертыванию</a></li>
    </ul>
    
    <p><small>Проверка выполнена: <?php echo date('Y-m-d H:i:s'); ?></small></p>
</body>
</html>

