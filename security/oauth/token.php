<?php
/**
 * OAuth 2.0 Token Endpoint для Яндекс Еда API
 * Путь: /security/oauth/token
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Обработка OPTIONS запроса (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Только POST запросы
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'method_not_allowed', 'error_description' => 'Only POST method is allowed']);
    exit;
}

// Конфигурация - Client ID и Secret для Яндекс Еда
$VALID_CLIENT_ID = 'dandy_nemchinovka_yandex_eda_2025';
$VALID_CLIENT_SECRET = '7k9mP2nQ4rS6tU8vW0xY3zA5bC7dE9fG1hJ3kL5mN7pR9sT1uV3wX5yZ7aB9cD1e';

// Получаем данные из POST запроса
$client_id = isset($_POST['client_id']) ? $_POST['client_id'] : '';
$client_secret = isset($_POST['client_secret']) ? $_POST['client_secret'] : '';
$grant_type = isset($_POST['grant_type']) ? $_POST['grant_type'] : '';
$scope = isset($_POST['scope']) ? $_POST['scope'] : '';

// Логирование запроса для отладки (закомментируйте в production)
$log_data = [
    'timestamp' => date('Y-m-d H:i:s'),
    'method' => $_SERVER['REQUEST_METHOD'],
    'client_id' => $client_id,
    'grant_type' => $grant_type,
    'scope' => $scope,
    'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
];
file_put_contents(__DIR__ . '/../../logs/oauth_requests.log', json_encode($log_data) . "\n", FILE_APPEND);

// Валидация параметров
if (empty($client_id) || empty($client_secret)) {
    http_response_code(400);
    echo json_encode([
        'error' => 'invalid_request',
        'error_description' => 'Missing required parameters: client_id or client_secret'
    ]);
    exit;
}

if ($grant_type !== 'client_credentials') {
    http_response_code(400);
    echo json_encode([
        'error' => 'unsupported_grant_type',
        'error_description' => 'Only client_credentials grant type is supported'
    ]);
    exit;
}

// Проверка Client ID и Secret
if ($client_id !== $VALID_CLIENT_ID || $client_secret !== $VALID_CLIENT_SECRET) {
    http_response_code(401);
    echo json_encode([
        'error' => 'invalid_client',
        'error_description' => 'Invalid client credentials'
    ]);
    exit;
}

// Генерация access token
$access_token = bin2hex(random_bytes(32));
$token_data = [
    'client_id' => $client_id,
    'scope' => $scope,
    'created_at' => time(),
    'expires_at' => time() + 3600 // Токен действителен 1 час
];

// Сохраняем токен (в production используйте БД или Redis)
$tokens_file = __DIR__ . '/../../logs/oauth_tokens.json';
$tokens = [];
if (file_exists($tokens_file)) {
    $tokens = json_decode(file_get_contents($tokens_file), true) ?? [];
}
$tokens[$access_token] = $token_data;
file_put_contents($tokens_file, json_encode($tokens, JSON_PRETTY_PRINT));

// Возвращаем успешный ответ
http_response_code(200);
echo json_encode([
    'access_token' => $access_token,
    'token_type' => 'Bearer',
    'expires_in' => 3600,
    'scope' => $scope
]);
