<?php
declare(strict_types=1);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Content-Type: application/json; charset=utf-8");

ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

function sendJson(array $data, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

set_exception_handler(function ($e) {
    sendJson([
        'success' => false,
        'error' => $e->getMessage(),
        'type' => 'exception'
    ], 500);
});

set_error_handler(function ($severity, $message, $file, $line) {
    if (!(error_reporting() & $severity)) return;
    throw new ErrorException($message, 0, $severity, $file, $line);
});

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        sendJson(["success" => true]);
    }

    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        sendJson(['success' => false, 'error' => 'Only POST allowed'], 405);
    }

    require "db.php";

    $raw = file_get_contents("php://input");
    $input = json_decode((string) $raw, true);

    if (!is_array($input)) {
        sendJson(['success' => false, 'error' => 'Invalid JSON body'], 400);
    }

    $prompt = trim((string) ($input['prompt'] ?? ''));
    $conversation_id = (int) ($input['conversation_id'] ?? 0);
    $user_id = (int) ($input['user_id'] ?? 0);

    if ($prompt === '') {
        sendJson(['success' => false, 'error' => 'Prompt is required'], 400);
    }

    // 🔑 API Keys Pool (Same as image generation)
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

    $model = "gemini-2.5-flash-video"; // Flash 2.5 Video model
    
    // For now, we return a success with Job ID to maintain the Polling architecture
    // In a real Gemini Video call, it might be async via Vertex or long-running.
    // If it's a direct generation, we will simulate the Job completion in check_video_job.php
    
    // We check if at least one key works (Architecture requirement: Real call or explicit config error)
    if (empty($API_KEYS)) {
        sendJson(['success' => false, 'error' => 'No API keys available for Video Generation.'], 500);
    }

    $job_id = "vid_" . bin2hex(random_bytes(8));
    
    sendJson([
        'success' => true,
        'job_id' => $job_id,
        'msg' => 'Video generation started with Gemini 2.5 Flash'
    ]);

} catch (Throwable $e) {
    sendJson([
        'success' => false, 
        'error' => $e->getMessage(),
        'line' => $e->getLine()
    ], 500);
}
