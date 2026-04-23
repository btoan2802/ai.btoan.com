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

// 🛡️ BỘ XỬ LÝ LỖI TOÀN CỤC
set_exception_handler(function ($e) {
    sendJson([
        'success' => false,
        'error' => 'Critical Error: ' . $e->getMessage(),
        'type' => 'exception'
    ], 200);
});

set_error_handler(function ($severity, $message, $file, $line) {
    if (!(error_reporting() & $severity)) return;
    throw new ErrorException($message, 0, $severity, $file, $line);
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
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion' => $jwt
    ]));
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $res = curl_exec($ch);
    $data = json_decode((string)$res, true);
    return $data['access_token'] ?? null;
}

function base64url_encode($data) {
    return str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($data));
}

try {
    require "db.php";

    $job_id = $_GET['job_id'] ?? ''; // This is the full operationName
    $conversation_id = (int) ($_GET['conversation_id'] ?? 0);
    $user_id = (int) ($_GET['user_id'] ?? 0);

    if (empty($job_id)) sendJson(['success' => false, 'error' => 'Operation Name required'], 200);

    $accessToken = getAccessToken(__DIR__ . "/google-key.json");
    if (!$accessToken) {
        sendJson(['success' => false, 'error' => 'Authentication failed (key file issue)'], 200);
    }

    // 📋 VEO FETCH PREDICT OPERATION FLOW
    $projectId = "airy-web-431004-v1";
    $location = "us-central1";
    $modelId = "veo-3.1-generate-001";
    
    // Official Endpoint for Veo polling
    $url = "https://{$location}-aiplatform.googleapis.com/v1/projects/{$projectId}/locations/{$location}/publishers/google/models/{$modelId}:fetchPredictOperation";

    $payload = [
        "operationName" => $job_id
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $accessToken
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $responseBody = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    // curl_close($ch); // Removed as requested for PHP 8.0+ compatibility

    $opData = json_decode((string)$responseBody, true);

    $debugInfo = [
        "google_http_code" => $httpCode,
        "polling_endpoint_used" => $url,
        "operationName_used" => $job_id,
        "curl_error" => $curlError,
        "raw_response_text" => $responseBody ?: "(empty)",
        "raw_response_json" => $opData
    ];

    if (isset($opData['error'])) {
        sendJson(array_merge([
            'success' => false,
            'status' => 'failed',
            'error' => $opData['error']['message'] ?? 'Veo job error.',
        ], $debugInfo));
    }

    $isDone = (bool) ($opData['done'] ?? false);

    if ($isDone) {
        $videoUrl = null;
        // Official Veo output path: response.videos[0].gcsUri
        if (isset($opData['response']['videos'][0]['gcsUri'])) {
            $videoUrl = $opData['response']['videos'][0]['gcsUri'];
        } elseif (isset($opData['response']['outputs'][0]['uri'])) {
            $videoUrl = $opData['response']['outputs'][0]['uri'];
        }

        if ($videoUrl) {
            // Convert gs:// to public storage link
            if (strpos($videoUrl, 'gs://') === 0) {
                // Note: User must ensure the bucket is public or use a proxy/signed URL.
                // Converting to standard public HTTPS link for storage.googleapis.com
                $videoUrl = str_replace('gs://', 'https://storage.googleapis.com/', $videoUrl);
            }

            // Sync with DB
            if ($conversation_id > 0 && $user_id > 0) {
                $stmt = $conn->prepare("UPDATE chats SET assistant_video = ? WHERE conversation_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1");
                if ($stmt) {
                    $stmt->bind_param("sii", $videoUrl, $conversation_id, $user_id);
                    $stmt->execute();
                    $stmt->close();
                }
            }

            sendJson(array_merge([
                'success' => true,
                'status' => 'completed',
                'video_url' => $videoUrl,
                'job_id' => $job_id,
                'provider' => 'google-veo'
            ], $debugInfo));
        } else {
            sendJson(array_merge([
                'success' => false,
                'status' => 'failed',
                'error' => 'Operation marked as done but no video URI found in response.',
            ], $debugInfo));
        }
    } else {
        // Still processing
        $progress = $opData['metadata']['progressPercentage'] ?? 
                    $opData['metadata']['percentageCompleted'] ?? 
                    '0';

        sendJson(array_merge([
            'success' => true,
            'status' => 'processing',
            'progress' => (string)$progress,
            'msg' => "Veo đang xử lý... ({$progress}%)"
        ], $debugInfo));
    }

} catch (Throwable $e) {
    sendJson(['success' => false, 'error' => $e->getMessage()], 200);
}
