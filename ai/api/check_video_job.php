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

function getAccessToken($keyFile) {
    if (!file_exists($keyFile)) return null;
    $keyData = json_decode(file_get_contents($keyFile), true);
    if (!isset($keyData['private_key'])) return null;

    $header = base64url_encode(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
    $now = time();
    $payload = base64url_encode(json_encode([
        'iss' => $keyData['client_email'],
        'scope' => 'https://www.googleapis.com/auth/cloud-platform',
        'aud' => 'https://oauth2.googleapis.com/token',
        'exp' => $now + 3600,
        'iat' => $now
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
    $job_id = $_GET['job_id'] ?? '';
    $conversation_id = (int) ($_GET['conversation_id'] ?? 0);
    $user_id = (int) ($_GET['user_id'] ?? 0);

    if (empty($job_id)) sendJson(['success' => false, 'error' => 'Job ID required'], 200);

    $accessToken = getAccessToken(__DIR__ . "/google-key.json");
    if (!$accessToken) {
        sendJson(['success' => false, 'error' => 'Authentication missing (key file invalid or missing)'], 200);
    }

    $location = "us-central1";
    $url = (strpos($job_id, 'projects/') === false)
        ? "https://{$location}-aiplatform.googleapis.com/v1/projects/airy-web-431004-v1/locations/{$location}/operations/{$job_id}"
        : "https://{$location}-aiplatform.googleapis.com/v1/{$job_id}";

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $accessToken
    ]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $responseBody = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    $opData = json_decode((string)$responseBody, true);

    // Initial response structure for debug
    $debugInfo = [
        "google_http_code" => $httpCode,
        "google_poll_url" => $url,
        "curl_error" => $curlError,
        "raw_response_text" => $responseBody ?: "(empty body)",
        "raw_response_json" => $opData
    ];

    if ($opData === null && $responseBody) {
        $debugInfo['error'] = 'Failed to decode Google response as JSON.';
    }

    if (isset($opData['error'])) {
        sendJson(array_merge([
            'success' => false,
            'status' => 'failed',
            'error' => $opData['error']['message'] ?? 'Veo job experienced an error.',
            'job_id' => $job_id
        ], $debugInfo));
    }

    $isDone = (bool) ($opData['done'] ?? false);

    if ($isDone) {
        $videoUrl = null;
        // Check multiple paths for different Google API versions/models
        if (isset($opData['response']['outputs'][0]['uri'])) {
            $videoUrl = $opData['response']['outputs'][0]['uri'];
        } elseif (isset($opData['response']['videos'][0]['uri'])) {
            $videoUrl = $opData['response']['videos'][0]['uri'];
        }

        if ($videoUrl) {
            if (strpos($videoUrl, 'gs://') === 0) {
                // Convert gs:// bucket format to HTTPS link
                $videoUrl = str_replace('gs://', 'https://storage.googleapis.com/', $videoUrl);
            }

            // Sync with DB if needed
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
                'error' => 'Job marked as done but no video output URI was found.',
                'job_id' => $job_id
            ], $debugInfo));
        }
    } else {
        // Polling state
        $progressValue = $opData['metadata']['percentageCompleted'] ?? 
                         $opData['metadata']['progressPercentage'] ?? 
                         $opData['metadata']['partialResultProgress'] ?? 
                         '0';

        sendJson(array_merge([
            'success' => true,
            'status' => 'processing',
            'progress' => (string)$progressValue,
            'msg' => "Veo is rendering... {$progressValue}%",
            'job_id' => $job_id
        ], $debugInfo));
    }

} catch (Throwable $e) {
    sendJson([
        'success' => false, 
        'error' => $e->getMessage(),
        'file' => basename($e->getFile()),
        'line' => $e->getLine()
    ], 200);
}
