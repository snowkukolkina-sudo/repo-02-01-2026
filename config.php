<?php
// PHP Configuration for DANDY Pizza
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/logs/php_errors.log');

// Set timezone
date_default_timezone_set('Europe/Moscow');

// Database configuration
define('DB_PATH', __DIR__ . '/database.sqlite');

// API configuration
define('API_VERSION', '1.0');

// 🔥 Автоматическое определение URL сайта
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https://" : "http://";
$host = $_SERVER['HTTP_HOST'] ?? 'nemchinovka.dandypizzasushi.com';
define('SITE_URL', $protocol . $host);

// Logs directory
if (!is_dir(__DIR__ . '/logs')) {
    mkdir(__DIR__ . '/logs', 0755, true);
}
?>

