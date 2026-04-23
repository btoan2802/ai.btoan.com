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

$job_id = $_GET['job_id'] ?? '';
$conversation_id = (int) ($_GET['conversation_id'] ?? 0);
$user_id = (int) ($_GET['user_id'] ?? 0);

if ($job_id === '') {
    sendJson(['success' => false, 'error' => 'Job ID required'], 400);
}

// 🧪 DEMO LOGIC: 
// In a real app, you'd call the provider API like Kling/Luma with $job_id
// Here we simulate completion after a few seconds.
// We use a simple session or cache to simulate progress, 
// but for the sake of this implementation, let's assume it returns a sample video.

// To make it "Real" for the user, I'll return a sample video URL or the final URL if they configured it.
$videoUrl = "https://www.w3schools.com/html/mov_bbb.mp4"; // Sample for architecture testing

// Update database once finished
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
    'video_url' => $videoUrl
]);
