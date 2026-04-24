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
    sendJson(['success' => false, 'error' => 'Critical Error: ' . $e->getMessage()], 200);
});

function getAccessToken($keyFile) {
    if (!file_exists($keyFile)) return null;
    $keyData = json_decode(file_get_contents($keyFile), true);
    $header = base64url_encode(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
    $payload = base64url_encode(json_encode([
        'iss' => $keyData['client_email'],
        'scope' => 'https://www.googleapis.com/auth/cloud-platform',
        'aud' => 'https://oauth2.googleapis.com/token',
        'exp' => time() + 3600,
        'iat' => time()
    ]));
    $signature = '';
    openssl_sign("$header.$payload", $signature, $keyData['private_key'], 'SHA256');
    $jwt = "$header.$payload." . base64url_encode($signature);
    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query(['grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer', 'assertion' => $jwt]));
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $res = curl_exec($ch);
    $data = json_decode((string)$res, true);
    // curl_close($ch); // Đã loại bỏ
    return $data['access_token'] ?? null;
}

function base64url_encode($data) {
    return str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($data));
}

try {
    require "db.php";
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') sendJson(["success" => true]);

    $raw = file_get_contents("php://input");
    $input = json_decode((string) $raw, true);
    
    $prompt = trim((string) ($input['prompt'] ?? ''));
    $conversation_id = (string) ($input['conversation_id'] ?? 'default');
    $user_id = (string) ($input['user_id'] ?? 'unknown');

    if ($prompt === '') sendJson(['success' => false, 'error' => 'Prompt is required'], 200);

    $projectId = "airy-web-431004-v1";
    $location = "us-central1";
    $model = "veo-3.1-generate-001";
    
    // 📁 CLOUD STORAGE OUTPUT CONFIG
    $bucketName = "airy-web-431004-v1-veo";
    $timestamp = time();
    $outputUri = "gs://{$bucketName}/veo-output/{$user_id}/{$conversation_id}/{$timestamp}/";

    $accessToken = getAccessToken(__DIR__ . "/google-key.json");
    if (!$accessToken) sendJson(['success' => false, 'error' => 'Auth failed (token generation).'], 200);

    $url = "https://{$location}-aiplatform.googleapis.com/v1/projects/{$projectId}/locations/{$location}/publishers/google/models/{$model}:predictLongRunning";
    
    $payload = [
        "instances" => [["prompt" => $prompt]],
        "parameters" => [
            "sampleCount" => 1,
            "fps" => 24,
            "aspectRatio" => "16:9",
            "storageUri" => $outputUri
        ]
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json', 'Authorization: Bearer ' . $accessToken]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $response = curl_exec($ch);
    $resData = json_decode((string)$response, true);
    // curl_close($ch); // Đã loại bỏ

    if (isset($resData['name'])) {
        sendJson(['success' => true, 'job_id' => $resData['name'], 'msg' => 'Veo job started successfully', 'provider' => 'google-veo']);
    } else {
        $errorMessage = $resData['error']['message'] ?? 'Failed to start Veo.';
        if (strpos($errorMessage, "not found") !== false && strpos($errorMessage, $bucketName) !== false) {
            $errorMessage = "Lỗi: Bucket '{$bucketName}' chưa tồn tại.";
        }
        sendJson(['success' => false, 'error' => $errorMessage, 'raw_debug' => $resData], 200);
    }
} catch (Throwable $e) {
    sendJson(['success' => false, 'error' => $e->getMessage()], 200);
}
