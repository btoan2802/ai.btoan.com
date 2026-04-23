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
    if (empty($job_id)) sendJson(['success' => false, 'error' => 'Job ID required'], 200);

    // TRUNG THỰC: Trả về success: true nhưng status: processing
    // Điều này báo hiệu cho Frontend rằng kết nối ổn, chỉ là Video chưa xong.
    sendJson([
        'success' => true, 
        'status' => 'processing',
        'msg' => 'Veo is generating your cinematic video...',
        'provider' => 'google-veo'
    ], 200);

} catch (Throwable $e) {
    sendJson(['success' => false, 'error' => $e->getMessage()], 500);
}
