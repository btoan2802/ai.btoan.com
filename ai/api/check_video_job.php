<?php
declare(strict_types=1);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json; charset=utf-8");

// Force error reporting to be caught
ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

function sendJson(array $data, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// Global exception handler
set_exception_handler(function ($e) {
    sendJson([
        'success' => false,
        'error' => $e->getMessage(),
        'type' => 'exception'
    ], 500);
});

// Global error handler
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
        sendJson(['success' => false, 'error' => 'Job ID required'], 400);
    }

    // Đảm bảo luôn có cột assistant_video (Self-healing)
    $check = $conn->query("SHOW COLUMNS FROM `chats` LIKE 'assistant_video'");
    if ($check && $check->num_rows === 0) {
        $conn->query("ALTER TABLE chats ADD COLUMN assistant_video TEXT AFTER assistant_images");
    }

    // 🧪 DEMO LOGIC: 
    // In a real app, you'd call the provider API like Kling/Luma with $job_id
    $videoUrl = "https://www.w3schools.com/html/mov_bbb.mp4"; // Sample for architecture testing

    // Update database once finished
    if ($conversation_id > 0 && $user_id > 0) {
        // Find the LATEST message for this conversation and user to attach the video
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
        'video_url' => $videoUrl
    ]);

} catch (Throwable $e) {
    sendJson([
        'success' => false,
        'error' => $e->getMessage(),
        'line' => $e->getLine()
    ], 500);
}
