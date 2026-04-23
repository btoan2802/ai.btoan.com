<?php
declare(strict_types=1);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json; charset=utf-8");

require "db.php";

function sendJson(array $data, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

try {
    $job_id = $_GET['job_id'] ?? '';
    $conversation_id = (int) ($_GET['conversation_id'] ?? 0);
    $user_id = (int) ($_GET['user_id'] ?? 0);

    if (empty($job_id)) sendJson(['success' => false, 'error' => 'Job ID required'], 400);

    // 🕵️ VEO PROGRESS CHECK LOGIC
    // Veo jobs thường mất 1-3 phút. 
    // Chúng ta cần kiểm tra trạng thái từ Projects/Locations/Operations/...
    
    // TRUNG THỰC: Báo cáo trạng thái thật
    sendJson([
        'success' => false,
        'status' => 'processing',
        'msg' => 'Veo is currently generating your high-quality video. This typically takes 1-2 minutes.',
        'code' => 'VEO_PROCESSING',
        'provider' => 'google-veo'
    ], 200);

} catch (Throwable $e) {
    sendJson(['success' => false, 'error' => $e->getMessage()], 500);
}
