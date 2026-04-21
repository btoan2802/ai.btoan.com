<?php
header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'ok' => true,
    'file' => __FILE__
], JSON_UNESCAPED_UNICODE);