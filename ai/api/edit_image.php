<?php
declare(strict_types=1);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json; charset=utf-8");

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    echo json_encode(["success" => true]);
    exit;
}

ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
set_time_limit(180);

require "db.php";

set_error_handler(function ($severity, $message, $file, $line) {
    throw new ErrorException($message, 0, $severity, $file, $line);
});

function sendJson(array $data, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        sendJson(['success' => false, 'error' => 'Only POST allowed'], 405);
    }

    $raw = file_get_contents("php://input");
    $input = json_decode((string) $raw, true);

    if (!is_array($input)) {
        sendJson(['success' => false, 'error' => 'Invalid JSON body'], 400);
    }

    $prompt = trim((string) ($input['prompt'] ?? ''));
    $baseImage = trim((string) ($input['image'] ?? '')); // Base64
    $conversation_id = (int) ($input['conversation_id'] ?? 0);
    $user_id = (int) ($input['user_id'] ?? 0);
    $assistant_text = trim((string) ($input['assistant_text'] ?? 'Đây là ảnh đã chỉnh sửa của bạn:'));

    if ($prompt === '' || $baseImage === '') {
        sendJson(['success' => false, 'error' => 'Prompt and Base Image are required'], 400);
    }

    // Prepare Base64 data (remove prefix if exists)
    $cleanBase64 = preg_replace('#^data:image/[^;]+;base64,#', '', $baseImage);

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

    shuffle($API_KEYS);

    // Using gemini-2.5-flash-image or imagen model for editing
    // For Vertex AI / Google AI, this varies. Here we use the common pool logic.
    $model = "gemini-2.5-flash-image"; 
    $lastError = "Unknown Gemini Edit API error";

    foreach ($API_KEYS as $API_KEY) {
        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key=" . rawurlencode($API_KEY);

        // Payload for Image-to-Image / Generative Edit
        // We provide the image as part of the parts
        $payload = [
            "contents" => [
                [
                    "role" => "user",
                    "parts" => [
                        ["text" => "Please edit the following image based on this description: " . $prompt],
                        [
                            "inline_data" => [
                                "mime_type" => "image/png",
                                "data" => $cleanBase64
                            ]
                        ]
                    ]
                ]
            ],
            "generationConfig" => [
                "imageConfig" => [
                    "aspectRatio" => "1:1"
                ]
            ]
        ];

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ["Content-Type: application/json"],
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_TIMEOUT => 120,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false
        ]);

        $response = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);

        if ($httpCode !== 200) {
            $lastError = "API Error (HTTP {$httpCode}): " . mb_substr((string)$response, 0, 500);
            continue;
        }

        $data = json_decode((string)$response, true);
        
        $imageBase64 = null;
        $mimeType = 'image/png';

        foreach (($data['candidates'] ?? []) as $candidate) {
            foreach (($candidate['content']['parts'] ?? []) as $part) {
                if (isset($part['inlineData']['data'])) {
                    $imageBase64 = $part['inlineData']['data'];
                    $mimeType = $part['inlineData']['mimeType'] ?? 'image/png';
                    break 2;
                }
                if (isset($part['inline_data']['data'])) {
                    $imageBase64 = $part['inline_data']['data'];
                    $mimeType = $part['inline_data']['mime_type'] ?? 'image/png';
                    break 2;
                }
            }
        }

        if ($imageBase64 !== null) {
            $imageSrc = "data:{$mimeType};base64,{$imageBase64}";

            // Sync to database history
            if ($conversation_id > 0 && $user_id > 0) {
                $assistant_images = json_encode([$imageSrc], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                $stmt = $conn->prepare("
                    UPDATE chats
                    SET answer = ?, assistant_images = ?
                    WHERE conversation_id = ? AND user_id = ?
                    ORDER BY id DESC
                    LIMIT 1
                ");
                if ($stmt) {
                    $stmt->bind_param("ssii", $assistant_text, $assistant_images, $conversation_id, $user_id);
                    $stmt->execute();
                }
            }

            sendJson([
                'success' => true,
                'mimeType' => $mimeType,
                'imageBase64' => $imageBase64
            ]);
        }
    }

    sendJson(['success' => false, 'error' => $lastError]);

} catch (Throwable $e) {
    sendJson(['success' => false, 'error' => $e->getMessage()], 500);
}
