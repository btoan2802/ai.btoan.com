<?php
/**
 * BToan AI - Image Generation Endpoint
 * Fixed: Robust JSON response and server-side logging
 */

// 1. CORS & Headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 2. Force JSON Content Type
header('Content-Type: application/json; charset=utf-8');

// 3. Error suppressed in output, but logged to server
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

/**
 * Helper to return JSON error and exit
 */
function sendJsonError($message, $debug = null) {
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode([
        'success' => false,
        'error' => $message,
        'debug_info' => $debug
    ]);
    exit;
}

try {
    // 4. API Configuration
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

    // 5. Input Validation
    $input_raw = file_get_contents("php://input");
    if (!$input_raw) {
        throw new Exception("No input received");
    }

    $input = json_decode($input_raw, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("Invalid JSON input: " . json_last_error_msg());
    }

    if (empty($input['prompt'])) {
        throw new Exception("Prompt is required");
    }

    $prompt = $input['prompt'];
    $model = "gemini-2.5-flash-image"; // Requested model

    // 6. Gemini API Payload
    $payload = [
        "contents" => [
            [
                "parts" => [
                    ["text" => $prompt]
                ]
            ]
        ]
    ];

    shuffle($API_KEYS);
    $last_attempt_error = "Could not connect to Gemini API";

    // 7. Try each API Key
    foreach ($API_KEYS as $API_KEY) {
        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$API_KEY}";

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ["Content-Type: application/json"],
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_CONNECTTIMEOUT => 30,
            CURLOPT_TIMEOUT => 60,
            CURLOPT_SSL_VERIFYPEER => false // Common fix for Windows/Local environments
        ]);

        $response = curl_exec($ch);
        $curl_errno = curl_errno($ch);
        $curl_error = curl_error($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($response === false) {
            $last_attempt_error = "CURL Error ($curl_errno): $curl_error";
            error_log("BToan AI Image Gen - CURL Error: " . $curl_error);
            continue;
        }

        // Log raw response for developer debugging (Server Logs)
        // error_log("BToan AI Image Gen - Response ($http_code): " . $response);

        $data = json_decode($response, true);
        if (!$data) {
            $last_attempt_error = "Gemini returned non-JSON response";
            error_log("BToan AI Image Gen - Parse Error: " . substr($response, 0, 200));
            continue;
        }

        // 8. Handle Success
        if (isset($data['candidates'][0]['content']['parts'])) {
            foreach ($data['candidates'][0]['content']['parts'] as $part) {
                if (isset($part['inlineData'])) {
                    echo json_encode([
                        "success" => true,
                        "mimeType" => $part['inlineData']['mimeType'],
                        "imageBase64" => $part['inlineData']['data']
                    ]);
                    exit;
                }
                if (isset($part['blob'])) {
                    echo json_encode([
                        "success" => true,
                        "mimeType" => $part['blob']['mime_type'],
                        "imageBase64" => $part['blob']['data']
                    ]);
                    exit;
                }
            }
        }
        
        // 9. Handle Known API Errors
        if (isset($data['error'])) {
            $last_attempt_error = "Gemini API: " . ($data['error']['message'] ?? 'Unknown error');
            error_log("BToan AI Image Gen - API Error: " . $last_attempt_error);
        } else {
            $last_attempt_error = "Unexpected response structure from Gemini";
            error_log("BToan AI Image Gen - Structure Error: " . json_encode($data));
        }
    }

    sendJsonError($last_attempt_error);

} catch (Throwable $e) {
    error_log("BToan AI Image Gen - Fatal: " . $e->getMessage());
    sendJsonError("Internal Server Error: " . $e->getMessage());
}
