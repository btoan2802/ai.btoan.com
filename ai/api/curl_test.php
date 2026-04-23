<?php
header("Content-Type: application/json");
echo json_encode([
    "curl_enabled" => function_exists('curl_init'),
    "php_version" => PHP_VERSION,
    "loaded_extensions" => get_loaded_extensions()
]);
