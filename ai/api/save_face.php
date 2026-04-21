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
require "r2_uploader.php";

// Get JSON input
$data = json_decode(file_get_contents("php://input"), true);
if (!$data) {
    // Fallback to $_POST just in case
    $data = $_POST;
}

$username = trim($data["username"] ?? "");
$image = $data["image"] ?? "";
$descriptor = $data["descriptor"] ?? ""; 

if ($username === "" || $image === "") {
    echo json_encode(["success" => false, "msg" => "missing data: username or image empty"]);
    exit;
}

try {
    // 🛡️ Auto-migration: Ensure face_descriptor column exists
    $conn->query("ALTER TABLE users ADD COLUMN IF NOT EXISTS face_descriptor TEXT AFTER face_image_url");

    $stmt = $conn->prepare("SELECT id, username FROM users WHERE username = ? LIMIT 1");
    if (!$stmt) throw new Exception("SQL prepare failed: " . $conn->error);
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    $stmt->close();

    if (!$user) {
        echo json_encode(["success" => false, "msg" => "user not found"]);
        exit;
    }

    // ☁️ CLOUD UPLOAD (Using Refactored Architecture)
    $uploader = new R2Uploader();
    $publicUrl = $uploader->upload($image, 'faces', 'jpg');

    // 🔒 SECURE UPDATE: Save Cloud URL + Biometric Descriptor
    $stmtUpdate = $conn->prepare("
        UPDATE users
        SET face_image_url = ?, 
            face_descriptor = ?, 
            face_enabled = 1, 
            face_updated_at = NOW()
        WHERE id = ?
    ");
    if (!$stmtUpdate) throw new Exception("SQL prepare update failed: " . $conn->error);
    
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