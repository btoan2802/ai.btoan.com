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
    $job_id = $_GET['job_id'] ?? ''; // Đây là Operation Name (projects/.../locations/.../operations/...)
    $conversation_id = (int) ($_GET['conversation_id'] ?? 0);
    $user_id = (int) ($_GET['user_id'] ?? 0);

    if (empty($job_id)) sendJson(['success' => false, 'error' => 'Job ID (Operation Name) is required'], 200);

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

    // 📡 GỌI API KIỂM TRA TRẠNG THÁI OPERATION
    // URL format: https://{location}-aiplatform.googleapis.com/v1/{operationName}
    $location = "us-central1";
    $url = "https://{$location}-aiplatform.googleapis.com/v1/{$job_id}?key={$apiKey}";

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    
    $response = curl_exec($ch);
    $info = curl_getinfo($ch);
    curl_close($ch);

    $opData = json_decode((string)$response, true);

    // KIỂM TRA TRẠNG THÁI 'done'
    $isDone = (bool) ($opData['done'] ?? false);
    $error = $opData['error'] ?? null;

    if ($error) {
        sendJson([
            'success' => false,
            'status' => 'failed',
            'error' => $error['message'] ?? 'Veo generation failed.',
            'job_id' => $job_id,
            'provider' => 'google-veo'
        ]);
    }

    if ($isDone) {
        // Trích xuất video URL từ response của operation
        // Cấu trúc response của Veo thường nằm trong $opData['response']['outputs'][0]['uri'] hoặc tương tự
        $videoUrl = $opData['response']['outputs'][0]['uri'] ?? null;

        if ($videoUrl) {
            // Lưu vào Database
            if ($conversation_id > 0 && $user_id > 0) {
                $stmt = $conn->prepare("
                    UPDATE chats 
                    SET assistant_video = ? 
                    WHERE conversation_id = ? AND user_id = ? 
                    ORDER BY id DESC LIMIT 1
                ");
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
            sendJson([
                'success' => false,
                'status' => 'failed',
                'error' => 'Job finished but no video URL was found in response.',
                'raw_response' => $opData
            ]);
        }
    } else {
        // Vẫn đang xử lý
        sendJson([
            'success' => true,
            'status' => 'processing',
            'msg' => 'Veo is still rendering... ' . ($opData['metadata']['percentageCompleted'] ?? '0') . '%',
            'job_id' => $job_id,
            'provider' => 'google-veo'
        ]);
    }

} catch (Throwable $e) {
    sendJson(['success' => false, 'error' => $e->getMessage()], 500);
}
