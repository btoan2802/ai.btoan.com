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
        'type' => 'exception'
    ], 500);
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
        sendJson(['success' => false, 'error' => 'Only POST allowed'], 405);
    }

    require "db.php";

    $raw = file_get_contents("php://input");
    $input = json_decode((string) $raw, true);

    if (!is_array($input)) {
        sendJson(['success' => false, 'error' => 'Invalid JSON body'], 400);
    }

    $prompt = trim((string) ($input['prompt'] ?? ''));
    $conversation_id = (int) ($input['conversation_id'] ?? 0);
    $user_id = (int) ($input['user_id'] ?? 0);

    if ($prompt === '') {
        sendJson(['success' => false, 'error' => 'Prompt is required'], 400);
    }

    // 🔑 Provider Config
    // Người dùng cần điền API Key thật và viết code gọi API thật vào đây.
    $apiKey = ""; 
    
    // TRUNG THỰC: Nếu không có API KEY, báo lỗi luôn, KHÔNG trả về job_id giả.
    if (empty($apiKey)) {
        sendJson([
            'success' => false, 
            'error' => 'Video generation provider is not configured. (VIDEO_API_KEY is missing)',
            'provider' => 'none'
        ], 500);
    }

    // --- CODE DÀNH CHO PROVIDER THẬT (Kling/Luma/Runway...) ---
    // Ví dụ: $result = callAiProvider($apiKey, $prompt);
    // $job_id = $result['job_id'];
    // ---------------------------------------------------------

    $job_id = null; // Sẽ là Job ID thật từ API

    if ($job_id) {
        sendJson([
            'success' => true,
            'job_id' => $job_id,
            'msg' => 'Video generation started',
            'provider' => 'gemini-2.5-flash-video'
        ]);
    } else {
        // Nếu không có logic job_id, coi như chưa cấu hình xong
        sendJson([
            'success' => false, 
            'error' => 'Video provider logic is not implemented in backend.',
            'provider' => 'undetermined'
        ], 500);
    }

} catch (Throwable $e) {
    sendJson([
        'success' => false, 
        'error' => $e->getMessage(),
        'line' => $e->getLine()
    ], 500);
}
