<?php
/**
 * Скрипт для настройки Диадока
 * Использование: php setup-diadoc.php
 * Или через браузер: http://your-site.com/setup-diadoc.php
 */

header('Content-Type: application/json; charset=utf-8');

$db_path = __DIR__ . '/api/database.sqlite';
$pdo = new PDO('sqlite:' . $db_path);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// Создаем таблицу settings если её нет
$pdo->exec("CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)");

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        $input = $_POST;
    }
    
    // UUID от пользователя: d8271eda-fbca-addd-5af4-87369468ef94
    // Это может быть Box ID или API ключ
    $config = [
        'api_key' => $input['api_key'] ?? 'd8271eda-fbca-addd-5af4-87369468ef94',
        'box_id' => $input['box_id'] ?? 'd8271eda-fbca-addd-5af4-87369468ef94',
        'inn' => $input['inn'] ?? '',
        'updated_at' => date('Y-m-d H:i:s')
    ];
    
    try {
        $stmt = $pdo->prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('diadoc_config', ?, datetime('now'))");
        $stmt->execute([json_encode($config, JSON_UNESCAPED_UNICODE)]);
        
        echo json_encode([
            'ok' => true,
            'message' => 'Конфигурация Диадока сохранена',
            'config' => [
                'api_key' => substr($config['api_key'], 0, 8) . '…',
                'box_id' => substr($config['box_id'], 0, 8) . '…',
                'inn' => $config['inn']
            ]
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
} else {
    // Показываем форму или текущую конфигурацию
    try {
        $stmt = $pdo->prepare("SELECT value FROM settings WHERE key = 'diadoc_config'");
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $config = $row ? json_decode($row['value'], true) : null;
        
        if ($config) {
            echo json_encode([
                'ok' => true,
                'config' => [
                    'api_key' => substr($config['api_key'], 0, 8) . '…',
                    'box_id' => substr($config['box_id'], 0, 8) . '…',
                    'inn' => $config['inn'] ?? ''
                ]
            ]);
        } else {
            echo json_encode([
                'ok' => true,
                'message' => 'Конфигурация не найдена. Отправьте POST запрос с данными.',
                'example' => [
                    'api_key' => 'd8271eda-fbca-addd-5af4-87369468ef94',
                    'box_id' => 'd8271eda-fbca-addd-5af4-87369468ef94',
                    'inn' => '1234567890'
                ]
            ]);
        }
    } catch (Exception $e) {
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
}
?>


