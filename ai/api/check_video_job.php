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
    $url = "https://{$location}-aiplatform.googleapis.com/v1/{$job_id}";

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $accessToken
    ]);
    
    $response = curl_exec($ch);
    $opData = json_decode((string)$response, true);

    $isDone = (bool) ($opData['done'] ?? false);
    $error = $opData['error'] ?? null;

    if ($error) {
        sendJson(['success' => false, 'status' => 'failed', 'error' => $error['message'] ?? 'Veo failed.']);
    }

    if ($isDone) {
        $videoUrl = $opData['response']['outputs'][0]['uri'] ?? null;

        if ($videoUrl) {
            // Update DB...
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
                'provider' => 'google-veo'
            ]);
        } else {
            sendJson(['success' => false, 'status' => 'failed', 'error' => 'No video URL found.']);
        }
    } else {
        $progress = $opData['metadata']['percentageCompleted'] ?? $opData['metadata']['progressPercentage'] ?? '0';
        sendJson([
            'success' => true,
            'status' => 'processing',
            'msg' => "Veo is rendering... {$progress}%",
            'job_id' => $job_id,
            'debug_metadata' => $opData['metadata'] ?? []
        ]);
    }

} catch (Throwable $e) {
    sendJson(['success' => false, 'error' => $e->getMessage()], 200);
}
