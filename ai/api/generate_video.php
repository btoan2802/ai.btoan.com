<?php
declare(strict_types=1);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json; charset=utf-8");

ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

function sendJson(array $data, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

set_exception_handler(function ($e) {
    sendJson([
        'success' => false,
        'error' => $e->getMessage(),
        'type' => 'exception',
        'code' => 'INTERNAL_SERVER_ERROR'
    ], 500); // 500 cho crash thực sự
});

set_error_handler(function ($severity, $message, $file, $line) {
    if (!(error_reporting() & $severity)) return;
    throw new ErrorException($message, 0, $severity, $file, $line);
});

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        sendJson(["success" => true]);
    }

    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        sendJson(['success' => false, 'error' => 'Only POST allowed', 'code' => 'METHOD_NOT_ALLOWED'], 200);
    }

    require "db.php";

    $raw = file_get_contents("php://input");
    $input = json_decode((string) $raw, true);

    if (!is_array($input)) {
        sendJson(['success' => false, 'error' => 'Invalid JSON body', 'code' => 'INVALID_JSON'], 200);
    }

    $prompt = trim((string) ($input['prompt'] ?? ''));
    $conversation_id = (int) ($input['conversation_id'] ?? 0);
    $user_id = (int) ($input['user_id'] ?? 0);

    if ($prompt === '') {
        sendJson(['success' => false, 'error' => 'Prompt is required', 'code' => 'PROMPT_REQUIRED'], 200);
    }

    // 🔑 API KEY
    $apiKey = ""; 
    
    // TRUNG THỰC: Báo lỗi cấu hình sạch (HTTP 200 để DevTools không bị đỏ)
    if (empty($apiKey)) {
        sendJson([
            'success' => false, 
            'error' => 'Video generation provider is not configured. (VIDEO_API_KEY is missing)',
            'provider' => 'gemini-2.5-flash-video',
            'code' => 'VIDEO_PROVIDER_NOT_CONFIGURED'
        ], 200); 
    }

    // --- LOGIC PROVIDER THẬT ---
    $job_id = null; 
    // ---------------------------

    if ($job_id) {
        sendJson([
            'success' => true,
            'job_id' => $job_id,
            'msg' => 'Video generation started',
            'provider' => 'gemini-2.5-flash-video'
        ]);
    } else {
        sendJson([
            'success' => false, 
            'error' => 'Video provider logic is not implemented in backend.',
            'provider' => 'gemini-2.5-flash-video',
            'code' => 'PROVIDER_LOGIC_MISSING'
        ], 200);
    }

} catch (Throwable $e) {
    sendJson([
        'success' => false, 
        'error' => $e->getMessage(),
        'line' => $e->getLine(),
        'code' => 'INTERNAL_SERVER_ERROR'
    ], 500);
}
