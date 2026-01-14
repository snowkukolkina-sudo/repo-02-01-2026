<?php
// Тестовый файл для проверки API маршрутизации
// Открыть: https://nemchinovka.dandypizzasushi.com/api/test.php

header('Content-Type: application/json; charset=utf-8');

$data = [
    'success' => true,
    'message' => 'API работает!',
    'request_method' => $_SERVER['REQUEST_METHOD'],
    'request_uri' => $_SERVER['REQUEST_URI'],
    'parsed_path' => parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH),
    'script_name' => $_SERVER['SCRIPT_NAME'],
    'php_version' => phpversion(),
    'timestamp' => date('Y-m-d H:i:s')
];

echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
?>

