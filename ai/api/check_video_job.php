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
    $res = curl_exec($ch);
    $data = json_decode($res, true);
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

    // 🔑 LẤY OAUTH TOKEN
    $accessToken = getAccessToken(__DIR__ . "/google-key.json");
    if (!$accessToken) {
        sendJson(['success' => false, 'error' => 'Authentication missing (google-key.json)'], 200);
    }

    $location = "us-central1";
    // Check if job_id is full path or just operation ID
    if (strpos($job_id, 'projects/') === false) {
        $projectId = "airy-web-431004-v1";
        $url = "https://{$location}-aiplatform.googleapis.com/v1/projects/{$projectId}/locations/{$location}/operations/{$job_id}";
    } else {
        $url = "https://{$location}-aiplatform.googleapis.com/v1/{$job_id}";
    }

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $accessToken
    ]);
    
    $response = curl_exec($ch);
    $opData = json_decode((string)$response, true);

    // 📝 LOG RAW RESPONSE FOR DEBUGGING
    $logFile = __DIR__ . "/video_job_log.txt";
    file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] ID: $job_id\n" . $response . "\n\n", FILE_APPEND);

    if (isset($opData['error'])) {
        sendJson([
            'success' => false,
            'status' => 'failed',
            'error' => $opData['error']['message'] ?? 'Veo job error.',
            'job_id' => $job_id,
            'debug_raw' => $opData
        ]);
    }

    $isDone = (bool) ($opData['done'] ?? false);

    if ($isDone) {
        // Try different paths for video URL (Veo response format can vary)
        $videoUrl = null;
        if (isset($opData['response']['outputs'][0]['uri'])) {
            $videoUrl = $opData['response']['outputs'][0]['uri'];
        } elseif (isset($opData['response']['videos'][0]['uri'])) {
            $videoUrl = $opData['response']['videos'][0]['uri'];
        }

        if ($videoUrl) {
            // Convert gs:// to https:// storage.googleapis.com
            if (strpos($videoUrl, 'gs://') === 0) {
                // IMPORTANT: This assumes the bucket is public or has appropriate access.
                // Vertex AI usually outputs to gs://bucket-name/folder/file.mp4
                $videoUrl = str_replace('gs://', 'https://storage.googleapis.com/', $videoUrl);
            }

            // Update DB
            if ($conversation_id > 0 && $user_id > 0) {
                $stmt = $conn->prepare("UPDATE chats SET assistant_video = ? WHERE conversation_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1");
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
                'job_id' => $job_id,
                'provider' => 'google-veo',
                'debug_raw' => $opData
            ]);
        } else {
            sendJson([
                'success' => false,
                'status' => 'failed',
                'error' => 'Operation finished but no video output found.',
                'job_id' => $job_id,
                'debug_raw' => $opData
            ]);
        }
    } else {
        // Poll logic: look for progress in metadata
        $progress = $opData['metadata']['percentageCompleted'] ?? 
                    $opData['metadata']['progressPercentage'] ?? 
                    $opData['metadata']['partialResultProgress'] ?? 
                    '0';

        sendJson([
            'success' => true,
            'status' => 'processing',
            'msg' => "Veo is rendering... {$progress}%",
            'job_id' => $job_id,
            'progress' => $progress,
            'debug_raw' => $opData
        ]);
    }

} catch (Throwable $e) {
    sendJson(['success' => false, 'error' => $e->getMessage()], 200);
}
