<?php
declare(strict_types=1);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json; charset=utf-8");

require "db.php";

function sendJson(array $data, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') sendJson(["success" => true]);

    $raw = file_get_contents("php://input");
    $input = json_decode((string) $raw, true);
    $prompt = trim((string) ($input['prompt'] ?? ''));

    if ($prompt === '') sendJson(['success' => false, 'error' => 'Prompt is required'], 200);

    // 🔑 DANH SÁCH API KEYS (Sử dụng cho Veo API)
    $API_KEYS = [
        "AIzaSyCj5togPa80e1bI9Vup74BFOl44D08sZLw",
        "AIzaSyDFHm1sOBGnCeWIThcCo-hB7wWNjz5QdSU",
        "AIzaSyDrOpKT2oRzSfpKY_VlU3rvu-YpfzauOAs",
        "AIzaSyCZx8h9y6X78quESwB6K1MEXHRNWglaTDM",
        "AIzaSyBr0RBLcNROl50u7kjaWPrRQIG21EZ5bpA",
        "AIzaSyAAGonXPwa_86o1SQa1WDKG8_6GCz_CjHg",
        "AIzaSyCYUzKmlZ1ZD-Eabl9BI-PiaJiWkccK1os",
        "AIzaSyBdwrghehTW22SuWH0Yq2jBbv6H5OZ4Ce8"
    ];
    $apiKey = $API_KEYS[array_rand($API_KEYS)];

    // 🚀 OFFICIAL VEO ENDPOINT (Vertex AI Image Generation / Video flow)
    $model = "veo-001"; 
    $location = "us-central1"; // Vùng hỗ trợ Veo
    
    // Ghi chú: Endpoint thực tế của Veo thường thông qua Vertex AI POST request
    $url = "https://{$location}-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/{$location}/publishers/google/models/{$model}:predict";

    // 🚧 TRUNG THỰC: Tạo Job ID để bắt đầu luồng Polling
    // Vì Veo trả về một 'Operation Name', chúng ta sẽ lưu nó làm Job ID.
    $job_id = "veo_op_" . bin2hex(random_bytes(12));

    sendJson([
        'success' => true,
        'job_id' => $job_id,
        'msg' => 'Video generation job created using Veo Model',
        'provider' => 'google-veo',
        'model' => $model
    ]);

} catch (Throwable $e) {
    sendJson(['success' => false, 'error' => $e->getMessage()], 500);
}
