<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");

ini_set('display_errors', 0); 
error_reporting(E_ALL);

try {
    // API Keys from chat.php
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

    $input_raw = file_get_contents("php://input");
    if (!$input_raw) {
        throw new Exception("Empty request body");
    }

    $input = json_decode($input_raw, true);
    if (!$input || !isset($input['prompt'])) {
        throw new Exception("Prompt is required");
    }

    $prompt = $input['prompt'];
    $model = "gemini-2.5-flash-image";

    // Prepare payload
    $payload = [
        "contents" => [
            [
                "parts" => [
                    ["text" => $prompt]
                ]
            ]
        ],
        "generationConfig" => [
            "response_mime_type" => "application/json"
        ]
    ];
    
    // Note: Standard image generation might not need response_mime_type: application/json 
    // unless it's specifically for structured output. 
    // For image generation, it usually returns inlineData in the parts.
    // I will remove it to avoid confusion if the model expects default.
    unset($payload["generationConfig"]);

    shuffle($API_KEYS);
    $error_msg = "All API keys failed";

    foreach ($API_KEYS as $API_KEY) {
        $url = "https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent?key=$API_KEY";

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ["Content-Type: application/json"],
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_CONNECTTIMEOUT => 30,
            CURLOPT_TIMEOUT => 60
        ]);

        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($response === false) continue;

        $data = json_decode($response, true);
        if (!$data) continue;

        if (isset($data['candidates'][0]['content']['parts'])) {
            foreach ($data['candidates'][0]['content']['parts'] as $part) {
                // Check for inlineData (standard Gemini multimodal output)
                if (isset($part['inlineData'])) {
                    echo json_encode([
                        "success" => true,
                        "mimeType" => $part['inlineData']['mimeType'],
                        "imageBase64" => $part['inlineData']['data']
                    ]);
                    exit;
                }
                // Also check for blob (some versions use this)
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
        
        if (isset($data['error'])) {
            $error_msg = $data['error']['message'];
        }
    }

    echo json_encode([
        "success" => false,
        "error" => $error_msg
    ]);

} catch (Throwable $e) {
    echo json_encode([
        "success" => false,
        "error" => $e->getMessage()
    ]);
}
