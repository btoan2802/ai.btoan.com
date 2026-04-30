<?php
declare(strict_types=1);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
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
    require "db.php";

    $conversation_id = (int) ($_GET["conversation_id"] ?? 0);

    if ($conversation_id === 0) {
        sendJson([]);
    }

    // 🔥 AUTO MIGRATE (Self-healing)
    $check = $conn->query("SHOW COLUMNS FROM `chats` LIKE 'assistant_video'");
    if ($check && $check->num_rows === 0) {
        $conn->query("ALTER TABLE chats ADD COLUMN assistant_video TEXT AFTER assistant_images");
    }

    $checkMusic = $conn->query("SHOW COLUMNS FROM `chats` LIKE 'music_url'");
    if ($checkMusic && $checkMusic->num_rows === 0) {
        $conn->query("ALTER TABLE chats ADD COLUMN music_url TEXT NULL, ADD COLUMN music_prompt TEXT NULL, ADD COLUMN music_duration INT NULL");
    }

    $stmt = $conn->prepare("
        SELECT question, answer, images, assistant_images, assistant_video, music_url, music_prompt, music_duration
        FROM chats
        WHERE conversation_id = ?
        ORDER BY id ASC
    ");

    if (!$stmt) {
        throw new Exception("Prepare failed: " . $conn->error);
    }

    $stmt->bind_param("i", $conversation_id);
    $stmt->execute();
    $result = $stmt->get_result();

    $data = [];

    while ($row = $result->fetch_assoc()) {
        if (!empty($row["question"])) {
            $images = [];
            if (!empty($row["images"])) {
                $decoded = json_decode($row["images"], true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                    $images = $decoded;
                }
            }
            $data[] = [
                "role" => "user",
                "text" => $row["question"],
                "images" => $images
            ];
        }

        if (!empty($row["answer"]) || !empty($row["assistant_images"]) || !empty($row["assistant_video"])) {
            $assistantImages = [];
            if (!empty($row["assistant_images"])) {
                $decodedAssistant = json_decode($row["assistant_images"], true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($decodedAssistant)) {
                    $assistantImages = $decodedAssistant;
                }
            }

            $videos = null;
            if (!empty($row["assistant_video"])) {
                $decodedVideo = json_decode($row["assistant_video"], true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($decodedVideo)) {
                    $videos = $decodedVideo;
                } else {
                    $videos = [$row["assistant_video"]];
                }
            }

            $data[] = [
                "role" => "assistant",
                "text" => $row["answer"] ?? "",
                "images" => $assistantImages,
                "videos" => $videos,
                "music_url" => $row["music_url"] ?? null,
                "music_prompt" => $row["music_prompt"] ?? null,
                "music_duration" => $row["music_duration"] ?? null
            ];
        }
    }

    sendJson($data);

} catch (Throwable $e) {
    sendJson([
        'success' => false,
        'error' => $e->getMessage(),
        'line' => $e->getLine()
    ], 500);
}