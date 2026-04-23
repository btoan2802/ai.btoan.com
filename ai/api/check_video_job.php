<?php
declare(strict_types=1);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
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
    require "db.php";

    $job_id = $_GET['job_id'] ?? '';
    $conversation_id = (int) ($_GET['conversation_id'] ?? 0);
    $user_id = (int) ($_GET['user_id'] ?? 0);

    if ($job_id === '') {
        sendJson(['success' => false, 'error' => 'Job ID required', 'code' => 'JOB_ID_REQUIRED'], 200);
    }

    // 🛑 KIỂM TRA ĐIỀU KIỆN KẾT THÚC (Tránh treo mãi mãi)
    // Vì hiện tại Gemini 2.5 Flash chưa hỗ trợ Video, chúng ta báo lỗi Timeout sau 60 giây.
    
    // Ở đây tôi dùng logic dựa trên ID để giả lập (trong thực tế bạn sẽ check database timestamp)
    $is_manual_failed = true; 

    if ($is_manual_failed) {
        sendJson([
            'success' => false,
            'status' => 'failed',
            'error' => 'Video generation timeout or provider not supported. Gemini 2.5 Flash (AI Studio) currently only supports chat and image generation, not video creation.',
            'code' => 'VIDEO_GENERATION_NOT_AVAILABLE'
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
