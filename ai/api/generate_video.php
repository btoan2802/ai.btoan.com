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

    // 🔑 API CONFIG
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
    
    // THAY THẾ PROJECT_ID TẠI ĐÂY
    $projectId = "airy-web-431004-v1"; // ID dự án của bạn
    $location = "us-central1";
    $model = "veo-001";

    // 📡 GỌI VERTEX AI API (Veo)
    $url = "https://{$location}-aiplatform.googleapis.com/v1/projects/{$projectId}/locations/{$location}/publishers/google/models/{$model}:predict";
    
    $payload = [
        "instances" => [
            ["prompt" => $prompt]
        ],
        "parameters" => [
            "sampleCount" => 1,
            "fps" => 24,
            "aspectRatio" => "16:9"
        ]
    ];

    $ch = curl_init($url . "?key=" . $apiKey);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    
    $response = curl_exec($ch);
    $info = curl_getinfo($ch);
    curl_close($ch);

    $resData = json_decode((string)$response, true);

    // Vertex AI trả về một 'name' (Operation Name) nếu là xử lý bất đồng bộ
    $operationName = $resData['name'] ?? null;

    if ($operationName) {
        sendJson([
            'success' => true,
            'job_id' => $operationName,
            'msg' => 'Veo video job started successfully',
            'provider' => 'google-veo'
        ]);
    } else {
        // Nếu API trả về lỗi trực tiếp (vd: 403, 429)
        sendJson([
            'success' => false,
            'error' => $resData['error']['message'] ?? 'Failed to start Veo job. Please check Project ID and API permissions.',
            'raw_debug' => $resData
        ], 200);
    }

} catch (Throwable $e) {
    sendJson(['success' => false, 'error' => $e->getMessage()], 500);
}
