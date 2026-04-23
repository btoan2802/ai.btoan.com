<?php
declare(strict_types=1);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json; charset=utf-8");

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    echo json_encode(["success" => true]);
    exit;
}

ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
set_time_limit(300); // Video takes time

require "db.php";

function sendJson(array $data, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        sendJson(['success' => false, 'error' => 'Only POST allowed'], 405);
    }

    $raw = file_get_contents("php://input");
    $input = json_decode((string) $raw, true);

    $prompt = trim((string) ($input['prompt'] ?? ''));
    $conversation_id = (int) ($input['conversation_id'] ?? 0);
    $user_id = (int) ($input['user_id'] ?? 0);

    if ($prompt === '') {
        sendJson(['success' => false, 'error' => 'Prompt is required'], 400);
    }

    // 🔑 Provider Config
    // PHẢI CÓ API KEY THẬT. Nếu không, báo lỗi rõ.
    $apiKey = ""; // Người dùng hãy điền API Key (Kling/Luma/Runway) vào đây
    
    if (empty($apiKey)) {
        sendJson(['success' => false, 'error' => 'Video generation provider is not configured. Please set VIDEO_API_KEY in backend.'], 500);
    }

    // Logic gọi API thật sẽ nằm ở đây...
    
    // For Demo/Architecture, we generate a unique Job ID
    $job_id = "vid_" . bin2hex(random_bytes(8));
    
    sendJson([
        'success' => true,
        'job_id' => $job_id,
        'msg' => 'Video generation started'
    ]);

} catch (Throwable $e) {
    sendJson(['success' => false, 'error' => $e->getMessage()], 500);
}
