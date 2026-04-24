<?php
declare(strict_types=1);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json; charset=utf-8");

ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

require "db.php";
require_once "r2_uploader.php";

function sendJson(array $data, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// 🛡️ BỘ XỬ LỚI LỖI TOÀN CỤC
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
    // curl_close($ch); // Đã loại bỏ để tương thích PHP 8.0+
    return $data['access_token'] ?? null;
}

function base64url_encode($data) {
    return str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($data));
}

try {
    $job_id = $_GET['job_id'] ?? '';
    $conversation_id = (int) ($_GET['conversation_id'] ?? 0);
    $user_id = (int) ($_GET['user_id'] ?? 0);

    $chat_id = (int) ($_GET['chat_id'] ?? 0);

    if (empty($job_id)) sendJson(['success' => false, 'error' => 'Job ID required'], 200);

    $accessToken = getAccessToken(__DIR__ . "/google-key.json");
    if (!$accessToken) sendJson(['success' => false, 'error' => 'Auth failed'], 200);

    $projectId = "airy-web-431004-v1";
    $location = "us-central1";
    $modelId = "veo-3.1-generate-001";
    $url = "https://{$location}-aiplatform.googleapis.com/v1/projects/{$projectId}/locations/{$location}/publishers/google/models/{$modelId}:fetchPredictOperation";

    $payload = ["operationName" => $job_id];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json', 'Authorization: Bearer ' . $accessToken]);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $responseBody = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $opData = json_decode((string)$responseBody, true);
    // curl_close($ch); // Đã loại bỏ để tương thích PHP 8.0+

    if (isset($opData['error'])) {
        sendJson(['success' => false, 'status' => 'failed', 'error' => $opData['error']['message'] ?? 'Error']);
    }

    $isDone = (bool) ($opData['done'] ?? false);

    if ($isDone) {
        $gcsUri = $opData['response']['videos'][0]['gcsUri'] ?? null;
        
        if ($gcsUri) {
            // 📥 DOWNLOAD TỪ GCS
            $downloadUrl = str_replace('gs://', 'https://storage.googleapis.com/', $gcsUri);
            $tempFile = tempnam(sys_get_temp_dir(), 'veo_');
            
            $fp = fopen($tempFile, 'w+');
            $ch_dl = curl_init($downloadUrl);
            curl_setopt($ch_dl, CURLOPT_FILE, $fp);
            curl_setopt($ch_dl, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($ch_dl, CURLOPT_SSL_VERIFYPEER, false);
            curl_exec($ch_dl);
            // curl_close($ch_dl); // Đã loại bỏ
            fclose($fp);

            // 📤 UPLOAD LÊN CLOUDFLARE R2
            $r2 = new R2Uploader();
            $folder = "videos/{$user_id}/{$conversation_id}";
            $r2PublicUrl = $r2->uploadLocalFile($tempFile, $folder, 'mp4');

            // 🧹 DỌN TỆP TẠM
            if (file_exists($tempFile)) @unlink($tempFile);

            // 💾 CẬP NHẬT DATABASE (Atomic Append - Tránh Race Condition)
            if ($chat_id > 0) {
                // Thử dùng JSON_ARRAY_APPEND (Yêu cầu MySQL 5.7+)
                $success = false;
                $stmt = $conn->prepare("UPDATE chats SET assistant_video = JSON_ARRAY_APPEND(IFNULL(assistant_video, '[]'), '$', ?) WHERE id = ?");
                if ($stmt) {
                    $stmt->bind_param("si", $r2PublicUrl, $chat_id);
                    if ($stmt->execute() && $conn->affected_rows > 0) {
                        $success = true;
                    }
                    $stmt->close();
                }

                // Fallback nếu MySQL cũ không hỗ trợ JSON functions
                if (!$success) {
                    // Lock table hoặc dùng cơ chế retry đơn giản
                    $res = $conn->query("SELECT assistant_video FROM chats WHERE id = $chat_id FOR UPDATE");
                    if ($res && $row = $res->fetch_assoc()) {
                        $oldData = json_decode($row['assistant_video'] ?? '[]', true);
                        $currentVideos = is_array($oldData) ? $oldData : (empty($row['assistant_video']) ? [] : [$row['assistant_video']]);
                        $currentVideos[] = $r2PublicUrl;
                        $newJson = json_encode($currentVideos);
                        $conn->query("UPDATE chats SET assistant_video = '" . $conn->real_escape_string($newJson) . "' WHERE id = $chat_id");
                    }
                }
            }

            sendJson([
                'success' => true,
                'status' => 'completed',
                'video_url' => $r2PublicUrl,
                'msg' => 'Video generated and saved successfully.',
                'provider' => 'google-veo'
            ]);
        } else {
            // 🔥 KIỂM TRA LỖI CHI TIẾT TỪ GOOGLE
            $errorDetail = "Google không trả về link video.";
            if (isset($opData['error'])) {
                $errorDetail = "Lỗi: " . ($opData['error']['message'] ?? "Unknown Google error");
            } else if (isset($opData['response']['error'])) {
                $errorDetail = "Lỗi phản hồi: " . ($opData['response']['error']['message'] ?? "Unknown response error");
            } else if (isset($opData['metadata']['status'])) {
                 // Một số trường hợp lỗi nằm trong metadata
                 $errorDetail = "Trạng thái: " . ($opData['metadata']['status'] ?? "Unknown");
            }
            
            sendJson([
                'success' => false, 
                'status' => 'failed', 
                'error' => "Job hoàn tất nhưng không có video. $errorDetail",
                'debug_op' => $opData // Gửi kèm để debug nếu cần
            ]);
        }
    } else {
        $progress = $opData['metadata']['progressPercentage'] ?? '0';
        sendJson([
            'success' => true,
            'status' => 'processing',
            'progress' => (string)$progress,
            'msg' => "Veo is rendering... ({$progress}%)"
        ]);
    }
} catch (Throwable $e) {
    sendJson(['success' => false, 'error' => $e->getMessage()], 200);
}
