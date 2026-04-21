<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);

set_error_handler(function($errno, $errstr, $errfile, $errline) {
    if (!(error_reporting() & $errno)) return;
    echo json_encode(["success" => false, "msg" => "PHP Error: $errstr in $errfile on line $errline"]);
    exit;
});

set_exception_handler(function($e) {
    echo json_encode(["success" => false, "msg" => "PHP Exception: " . $e->getMessage()]);
    exit;
});

header('Content-Type: application/json');

require "db.php";

// Get JSON input
$data = json_decode(file_get_contents("php://input"), true);
if (!$data) {
    // Fallback to $_POST just in case
    $data = $_POST;
}

$username = trim($data["username"] ?? "");
$image = $data["image"] ?? "";
$descriptor = $data["descriptor"] ?? ""; // New: 128-float array as JSON string

if ($username === "" || $image === "") {
    echo json_encode(["success" => false, "msg" => "missing data: username or image empty"]);
    exit;
}

try {
    // 🛡️ Auto-migration: Ensure face_descriptor column exists
    $conn->query("ALTER TABLE users ADD COLUMN IF NOT EXISTS face_descriptor TEXT AFTER face_image_url");

    $stmt = $conn->prepare("SELECT id, username FROM users WHERE username = ? LIMIT 1");
    if (!$stmt) {
        throw new Exception("SQL prepare failed: " . $conn->error);
    }
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    $stmt->close();

    if (!$user) {
        echo json_encode(["success" => false, "msg" => "user not found"]);
        exit;
    }

    if (!preg_match('/^data:image\/(jpeg|jpg|png|webp);base64,/', $image)) {
        echo json_encode(["success" => false, "msg" => "invalid image format: " . substr($image, 0, 50)]);
        exit;
    }

    $imageType = 'jpg';
    if (strpos($image, 'data:image/png') === 0) {
        $imageType = 'png';
    } elseif (strpos($image, 'data:image/webp') === 0) {
        $imageType = 'webp';
    }

    $base64Data = preg_replace('/^data:image\/\w+;base64,/', '', $image);
    $binary = base64_decode($base64Data);

    if ($binary === false) {
        echo json_encode(["success" => false, "msg" => "decode failed"]);
        exit;
    }

    // Save locally
    $dir = "../../uploads/faces/" . $username . "/";
    if (!is_dir($dir)) {
        if (!mkdir($dir, 0777, true)) {
             throw new Exception("Could not create directory $dir");
        }
    }

    $fileName = "1." . $imageType;
    $filePath = $dir . $fileName;
    
    if (file_put_contents($filePath, $binary) === false) {
        throw new Exception("Could not save image to disk at $filePath");
    }

    // Public URL
    $publicUrl = "uploads/faces/" . $username . "/" . $fileName;

    // 🔒 SECURE UPDATE: Save both image URL and the raw biometric descriptor
    $stmtUpdate = $conn->prepare("
        UPDATE users
        SET face_image_url = ?, 
            face_descriptor = ?, 
            face_enabled = 1, 
            face_updated_at = NOW()
        WHERE id = ?
    ");
    if (!$stmtUpdate) {
         throw new Exception("SQL prepare update failed: " . $conn->error);
    }
    $stmtUpdate->bind_param("ssi", $publicUrl, $descriptor, $user['id']);
    $stmtUpdate->execute();
    $stmtUpdate->close();

    echo json_encode([
        "success" => true,
        "face_image_url" => $publicUrl
    ]);
} catch (Throwable $e) {
    echo json_encode([
        "success" => false,
        "msg" => "Server error: " . $e->getMessage()
    ]);
}