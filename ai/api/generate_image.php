<?php
declare(strict_types=1);

/**
 * BToan AI - Gemini Image Generation Endpoint
 * File: /ai/api/generate_image.php
 */

// =========================
// 1. HEADERS
// =========================
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json; charset=utf-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(["success" => true, "message" => "OK"]);
    exit;
}

// =========================
// 2. PHP ERROR SETTINGS
// =========================
ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

// Nếu muốn chỉ định file log riêng thì mở dòng dưới:
// ini_set('error_log', __DIR__ . '/generate_image_error.log');

// =========================
// 3. HELPERS
// =========================
function sendJson(array $data, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function sendJsonError(string $message, $debug = null, int $statusCode = 200): void
{
    sendJson([
        'success' => false,
        'error' => $message,
        'debug_info' => $debug
    ], $statusCode);
}

// Bắt fatal error cuối script
register_shutdown_function(function () {
    $error = error_get_last();
    if ($error !== null) {
        // Chỉ xử lý fatal parse/runtime nghiêm trọng
        $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR];
        if (in_array($error['type'], $fatalTypes, true)) {
            if (!headers_sent()) {
                header("Content-Type: application/json; charset=utf-8");
            }
            echo json_encode([
                'success' => false,
                'error' => 'PHP Fatal Error',
                'debug_info' => $error['message'] . ' in ' . $error['file'] . ' on line ' . $error['line']
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
    }
});

// =========================
// 4. MAIN
// =========================
try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        sendJsonError("Only POST method is allowed");
    }

    if (!function_exists('curl_init')) {
        sendJsonError("PHP cURL extension is not enabled");
    }

    // ==== ĐIỀN API KEY THẬT CỦA BẠN Ở ĐÂY ====
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

    if (empty($API_KEYS)) {
        sendJsonError("No API key configured");
    }

    // Đọc input JSON
    $inputRaw = file_get_contents("php://input");
    if ($inputRaw === false || trim($inputRaw) === '') {
        sendJsonError("Empty request body");
    }

    $input = json_decode($inputRaw, true);
    if (!is_array($input)) {
        sendJsonError("Invalid JSON body", $inputRaw);
    }

    $prompt = trim((string) ($input['prompt'] ?? ''));
    if ($prompt === '') {
        sendJsonError("Prompt is required");
    }

    $model = "gemini-2.5-flash-image";

    shuffle($API_KEYS);

    $lastAttemptError = "Unknown Gemini API error";
    $lastHttpCode = 0;
    $lastRawResponse = null;

    foreach ($API_KEYS as $API_KEY) {
        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key=" . urlencode($API_KEY);

        $payload = [
            "contents" => [
                [
                    "role" => "user",
                    "parts" => [
                        [
                            "text" => $prompt
                        ]
                    ]
                ]
            ],
            "generationConfig" => [
                "responseModalities" => ["TEXT", "IMAGE"]
            ]
        ];

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                "Content-Type: application/json"
            ],
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            CURLOPT_CONNECTTIMEOUT => 30,
            CURLOPT_TIMEOUT => 90,
            CURLOPT_SSL_VERIFYPEER => false, // tạm thời để tránh lỗi SSL trên Windows/IIS
            CURLOPT_SSL_VERIFYHOST => false
        ]);

        $response = curl_exec($ch);
        $curlErrNo = curl_errno($ch);
        $curlError = curl_error($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $lastHttpCode = $httpCode;
        $lastRawResponse = $response;

        error_log("Gemini HTTP Code: " . $httpCode);
        error_log("Gemini Raw Response: " . $response);

        if ($curlErrNo) {
            $lastAttemptError = "cURL error ({$curlErrNo}): {$curlError}";
            continue;
        }

        if ($response === false || $response === null || trim($response) === '') {
            $lastAttemptError = "Empty response from Gemini API";
            continue;
        }

        $data = json_decode($response, true);
        if (!is_array($data)) {
            $lastAttemptError = "Gemini returned invalid JSON";
            continue;
        }

        // Nếu Gemini trả lỗi
        if (isset($data['error'])) {
            $apiMessage = $data['error']['message'] ?? 'Unknown Gemini API error';
            $lastAttemptError = "Gemini API error: " . $apiMessage;
            continue;
        }

        // Tìm ảnh trong response
        $imageBase64 = null;
        $mimeType = null;
        $textParts = [];

        if (!empty($data['candidates']) && is_array($data['candidates'])) {
            foreach ($data['candidates'] as $candidate) {
                if (!isset($candidate['content']['parts']) || !is_array($candidate['content']['parts'])) {
                    continue;
                }

                foreach ($candidate['content']['parts'] as $part) {
                    if (isset($part['inlineData']['data'])) {
                        $imageBase64 = $part['inlineData']['data'];
                        $mimeType = $part['inlineData']['mimeType'] ?? 'image/png';
                        break 2;
                    }

                    if (isset($part['text'])) {
                        $textParts[] = $part['text'];
                    }
                }
            }
        }

        if ($imageBase64) {
            sendJson([
                'success' => true,
                'mimeType' => $mimeType ?: 'image/png',
                'imageBase64' => $imageBase64
            ]);
        }

        $lastAttemptError = "Gemini did not return image data";
        if (!empty($textParts)) {
            $lastAttemptError .= " | Text response: " . implode(" ", $textParts);
        }
    }

    sendJsonError($lastAttemptError, [
        'model' => $model,
        'http_code' => $lastHttpCode,
        'raw_response' => $lastRawResponse
    ]);

} catch (Throwable $e) {
    error_log("Fatal Exception in generate_image.php: " . $e->getMessage());
    sendJsonError($e->getMessage(), [
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
}