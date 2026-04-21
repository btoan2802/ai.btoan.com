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

    if (!function_exists('curl_init')) {
        sendJson(['success' => false, 'error' => 'PHP cURL extension is not enabled'], 500);
    }

    $raw = file_get_contents("php://input");
    $input = json_decode((string) $raw, true);

    if (!is_array($input)) {
        sendJson(['success' => false, 'error' => 'Invalid JSON body'], 400);
    }

    $prompt = trim((string) ($input['prompt'] ?? ''));
    $conversation_id = (int) ($input['conversation_id'] ?? 0);
    $user_id = (int) ($input['user_id'] ?? 0);
    $assistant_text = trim((string) ($input['assistant_text'] ?? 'Đây là ảnh của bạn:'));
    $aspectRatio = trim((string) ($input['aspect_ratio'] ?? '1:1'));

    if ($prompt === '') {
        sendJson(['success' => false, 'error' => 'Prompt is required'], 400);
    }

    $allowedAspectRatios = ['1:1', '16:9', '9:16', '4:3', '3:4'];
    if (!in_array($aspectRatio, $allowedAspectRatios, true)) {
        $aspectRatio = '1:1';
    }

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

    $model = "gemini-2.5-flash-image";
    $lastError = "Unknown Gemini API error";
    $lastHttpCode = 0;
    $lastRaw = "";

    foreach ($API_KEYS as $API_KEY) {
        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key=" . rawurlencode($API_KEY);

        $payload = [
            "contents" => [
                [
                    "parts" => [
                        ["text" => $prompt]
                    ]
                ]
            ],
            "generationConfig" => [
                "imageConfig" => [
                    "aspectRatio" => $aspectRatio
                ]
            ]
        ];

        $payloadJson = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                "Content-Type: application/json",
                "Accept: application/json"
            ],
            CURLOPT_POSTFIELDS => $payloadJson,
            CURLOPT_CONNECTTIMEOUT => 20,
            CURLOPT_TIMEOUT => 90,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false
        ]);

        $response = curl_exec($ch);
        $curlErrNo = curl_errno($ch);
        $curlError = curl_error($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);

        $lastHttpCode = $httpCode;
        $lastRaw = is_string($response) ? $response : '';

        if ($curlErrNo) {
            $lastError = "cURL error ({$curlErrNo}): {$curlError}";
            continue;
        }

        if (!is_string($response) || trim($response) === '') {
            $lastError = "Empty response from Gemini API";
            continue;
        }

        $data = json_decode($response, true);
        if (!is_array($data)) {
            $lastError = "Gemini returned invalid JSON";
            continue;
        }

        if (isset($data['error'])) {
            $lastError = "Gemini API error: " . ($data['error']['message'] ?? 'Unknown');
            continue;
        }

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

            // cập nhật row chat assistant gần nhất của conversation hiện tại
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

        $lastError = "Gemini did not return image data";
    }

    sendJson([
        'success' => false,
        'error' => $lastError,
        'httpCode' => $lastHttpCode,
        'raw' => mb_substr($lastRaw, 0, 1000)
    ], 200);

} catch (Throwable $e) {
    sendJson([
        'success' => false,
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ], 200);
}