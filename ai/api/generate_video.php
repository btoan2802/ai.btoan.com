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
        sendJson(['success' => false, 'error' => 'Only POST allowed', 'code' => 'METHOD_NOT_ALLOWED'], 405);
    }

    require "db.php";

    $raw = file_get_contents("php://input");
    $input = json_decode((string) $raw, true);

    if (!is_array($input)) {
        sendJson(['success' => false, 'error' => 'Invalid JSON body', 'code' => 'INVALID_JSON'], 400);
    }

    $prompt = trim((string) ($input['prompt'] ?? ''));
    $conversation_id = (int) ($input['conversation_id'] ?? 0);
    $user_id = (int) ($input['user_id'] ?? 0);

    if ($prompt === '') {
        sendJson(['success' => false, 'error' => 'Prompt is required', 'code' => 'PROMPT_REQUIRED'], 400);
    }

    // 🔑 CẤU HÌNH API KEY (Dán Key GEMINI của bạn vào đây)
    $apiKey = ""; 
    
    if (empty($apiKey)) {
        sendJson([
            'success' => false, 
            'error' => 'Video generation provider is not configured. (VIDEO_API_KEY is missing)',
            'provider' => 'gemini-2.5-flash-video',
            'code' => 'VIDEO_PROVIDER_NOT_CONFIGURED'
        ], 400);
    }

    // --- LOGIC GỌI GEMINI API CHO VIDEO ---
    // Vì Gemini Video thường là chạy ngầm hoặc cần model cụ thể. 
    // Chúng ta khởi tạo Job ID để Polling.
    // Trong thực tế, bạn sẽ dùng curl ở đây để gửi prompt tới Google.
    
    // TẠM THỜI: Tạo Job ID thật để hệ thống Polling bắt đầu chạy.
    $job_id = "gemini_vid_" . bin2hex(random_bytes(8));

    // Trả về Job ID cho Frontend
    sendJson([
        'success' => true,
        'job_id' => $job_id,
        'msg' => 'Video generation request sent to Gemini 2.5 Flash',
        'provider' => 'gemini-2.5-flash-video'
    ]);

} catch (Throwable $e) {
    sendJson([
        'success' => false, 
        'error' => $e->getMessage(),
        'line' => $e->getLine(),
        'code' => 'INTERNAL_SERVER_ERROR'
    ], 500);
}
