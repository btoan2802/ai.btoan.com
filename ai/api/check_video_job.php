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

    // 🛑 MINH BẠCH: Xoá bỏ hoàn toàn video mẫu.
    // Hiện tại Gemini 2.5 Flash chưa hỗ trợ tạo video trực tiếp qua API này.
    
    // Nếu bạn muốn tích hợp thật, bạn cần điền logic gọi API của Kling/Luma/Runway tại đây.
    $videoUrl = null; 

    if ($videoUrl !== null) {
        if ($conversation_id > 0 && $user_id > 0) {
            $stmt = $conn->prepare("
                UPDATE chats 
                SET assistant_video = ? 
                WHERE conversation_id = ? AND user_id = ? 
                ORDER BY id DESC LIMIT 1
            ");
            if ($stmt) {
                $stmt->bind_param("sii", $videoUrl, $conversation_id, $user_id);
                $stmt->execute();
                $stmt->close();
            }
        }

        sendJson([
            'success' => true,
            'status' => 'completed',
            'video_url' => $videoUrl,
            'provider' => 'gemini-2.5-flash-video'
        ]);
    } else {
        // Thông báo trung thực rằng tính năng chưa được cấu hình Provider Video thật
        sendJson([
            'success' => false,
            'status' => 'failed',
            'error' => 'Video generation failed: No real video asset returned from provider. Gemini 2.5 Flash currently does not support direct video generation via this API.',
            'code' => 'VIDEO_PROVIDER_NOT_IMPLEMENTED'
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
