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

    $is_provider_configured = false; 
    
    if (!$is_provider_configured) {
        sendJson([
            'success' => false,
            'error' => 'Video generation provider is not configured or Job not found.',
            'provider' => 'gemini-2.5-flash-video',
            'code' => 'VIDEO_PROVIDER_NOT_CONFIGURED'
        ], 200); // 200 OK
    }

    $videoUrl = null; 

    if ($videoUrl) {
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
        sendJson([
            'success' => false,
            'status' => 'processing',
            'msg' => 'Video is still being generated...',
            'code' => 'STILL_PROCESSING'
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
