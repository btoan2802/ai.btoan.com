<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");

ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/music_error.log');

try {
    require_once "db.php";
    require_once "r2_uploader.php";
    require_once "providers/GeminiMusicProvider.php";

    $input_raw = file_get_contents("php://input");
    $input = json_decode($input_raw, true);

    if (!$input) {
        throw new Exception("Invalid request body");
    }

    $user_id = intval($input["user_id"] ?? 0);
    $conversation_id = intval($input["conversation_id"] ?? 0);
    $chat_id = intval($input["chat_id"] ?? 0);
    $prompt = trim($input["prompt"] ?? "");
    $duration = intval($input["duration"] ?? 30);

    if (!$user_id) {
        throw new Exception("User not logged in");
    }

    if (empty($prompt)) {
        throw new Exception("Prompt is required");
    }

    if (strlen($prompt) > 1500) {
        throw new Exception("Prompt too long (max 1500 characters)");
    }

    // Rate limit check (optional but recommended)
    // For now, we proceed.

    // 1. Prepare Provider
    // Reuse API keys from chat.php if possible or hardcode for now (User requested from existing config)
    // I'll extract keys from chat.php or define them here.
    // Ideally, they should be in a separate config file.
    // Looking at chat.php, they are in a local variable $API_KEYS.
    
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

    $provider = new GeminiMusicProvider($API_KEYS);
    
    // Standardize prompt for better results
    $finalPrompt = "Create an original music track based on this description: $prompt. Ensure the musical style and any specific lyrics provided in the description are used exactly. The song MUST be sung in the language of the lyrics (e.g., Vietnamese). High quality, clean mix, suitable for background music. Do not imitate copyrighted artists.";

    // 2. Generate Music
    error_log("[MUSIC DEBUG] Starting generation with prompt: " . $finalPrompt);
    $audioBytes = $provider->generateMusic($finalPrompt, $duration);

    if (!$audioBytes) {
        throw new Exception("Failed to generate audio bytes");
    }

    // 3. Upload to R2
    error_log("[MUSIC DEBUG] Audio generated, size: " . strlen($audioBytes) . " bytes");
    $uploader = new R2Uploader();
    
    // Save bytes to temp file to use uploadLocalFile (more reliable for binary)
    $tempFile = tempnam(sys_get_temp_dir(), 'music_');
    file_put_contents($tempFile, $audioBytes);
    error_log("[MUSIC DEBUG] Temp file created: " . $tempFile);
    
    $timestamp = time();
    $random = bin2hex(random_bytes(4));
    $folder = "music/{$user_id}/{$conversation_id}";
    $fileName = "{$timestamp}_{$random}.mp3";
    
    // We need to pass the folder and filename to uploader, but R2Uploader::uploadLocalFile 
    // generates its own filename. Let's see if we can adapt it.
    // Looking at R2Uploader:
    // public function uploadLocalFile($filePath, $folder = 'uploads', $ext = 'mp4')
    // It generates: $fileName = $folder . "/" . bin2hex(random_bytes(16)) . "." . $ext;
    
    // I'll use it as is, but maybe I should have more control.
    // For now, I'll use it.
    error_log("[MUSIC DEBUG] Uploading to R2 folder: " . $folder);
    $publicUrl = $uploader->uploadLocalFile($tempFile, $folder, 'mp3');
    error_log("[MUSIC DEBUG] Upload success: " . $publicUrl);
    @unlink($tempFile);

    // 4. Save to DB
    if ($chat_id > 0) {
        // Update existing row
        $stmt = $conn->prepare("UPDATE chats SET music_url = ?, music_prompt = ?, music_duration = ? WHERE id = ? AND user_id = ?");
        if (!$stmt) {
            throw new Exception("Prepare failed: " . $conn->error . " (Make sure database columns are updated)");
        }
        $stmt->bind_param("ssiii", $publicUrl, $prompt, $duration, $chat_id, $user_id);
    } else {
        // First, ensure conversation exists
        if (!$conversation_id) {
            $stmt = $conn->prepare("INSERT INTO conversations(user_id, title) VALUES (?, 'Music Chat')");
            $stmt->bind_param("i", $user_id);
            $stmt->execute();
            $conversation_id = $conn->insert_id;
        }

        $answer = "Đã tạo nhạc AI thành công theo yêu cầu của bạn.";
        
        $stmt = $conn->prepare("
            INSERT INTO chats (user_id, conversation_id, question, answer, music_url, music_prompt, music_duration)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        
        if (!$stmt) {
            throw new Exception("Prepare failed: " . $conn->error . " (Make sure database columns are updated)");
        }
        
        $stmt->bind_param("iissssi", $user_id, $conversation_id, $prompt, $answer, $publicUrl, $prompt, $duration);
    }
    
    if (!$stmt->execute()) {
        throw new Exception("Database save failed: " . $stmt->error);
    }

    echo json_encode([
        "success" => true,
        "music_url" => $publicUrl,
        "music_prompt" => $prompt,
        "music_duration" => $duration,
        "conversation_id" => $conversation_id,
        "message" => "Tạo nhạc thành công"
    ]);

} catch (Throwable $e) {
    error_log("Music Gen Error: " . $e->getMessage());
    echo json_encode([
        "success" => false,
        "error" => $e->getMessage()
    ]);
}
