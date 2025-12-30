<?php
/**
 * Проверка реального подключения к Диадок API
 * Проверяет наличие токена и делает тестовый запрос к API
 */

header('Content-Type: application/json; charset=utf-8');

// Проверяем конфигурацию из БД
$config = null;
$diadocConfigured = false;
$connectionTest = null;

try {
    $dbPath = __DIR__ . '/api/database.sqlite';
    if (file_exists($dbPath)) {
        $pdo = new PDO("sqlite:$dbPath");
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        
        $stmt = $pdo->prepare("SELECT value FROM settings WHERE key = 'diadoc_config'");
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($row) {
            $config = json_decode($row['value'], true);
            $diadocConfigured = $config && !empty($config['api_key']) && !empty($config['box_id']);
        }
    }
} catch (Exception $e) {
    error_log("Error loading Diadoc config: " . $e->getMessage());
}

// Если конфигурация есть, делаем тестовый запрос к API
if ($diadocConfigured) {
    try {
        $apiKey = $config['api_key'];
        $boxId = $config['box_id'];
        
        // Тестовый запрос - получаем информацию о ящике
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => "https://diadoc-api.kontur.ru/GetBox?boxId=" . urlencode($boxId),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: DiadocAuth ddauth_api_client_id=' . urlencode($apiKey),
                'Content-Type: application/json'
            ],
            CURLOPT_TIMEOUT => 10,
            CURLOPT_SSL_VERIFYPEER => true
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);
        
        if ($httpCode === 200) {
            $connectionTest = [
                'success' => true,
                'message' => 'Подключение к Диадок API успешно',
                'boxId' => substr($boxId, 0, 6) . '…',
                'response' => json_decode($response, true)
            ];
        } else {
            $connectionTest = [
                'success' => false,
                'message' => 'Ошибка подключения к Диадок API',
                'httpCode' => $httpCode,
                'error' => $response ? json_decode($response, true) : $curlError
            ];
        }
    } catch (Exception $e) {
        $connectionTest = [
            'success' => false,
            'message' => 'Ошибка при проверке подключения',
            'error' => $e->getMessage()
        ];
    }
} else {
    $connectionTest = [
        'success' => false,
        'message' => 'Диадок не настроен (отсутствует API ключ или Box ID)'
    ];
}

echo json_encode([
    'ok' => true,
    'diadocConfigured' => $diadocConfigured,
    'config' => $config ? [
        'hasApiKey' => !empty($config['api_key']),
        'hasBoxId' => !empty($config['box_id']),
        'boxIdPreview' => !empty($config['box_id']) ? substr($config['box_id'], 0, 6) . '…' : null
    ] : null,
    'connectionTest' => $connectionTest
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

