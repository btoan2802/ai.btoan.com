<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require "db.php";
require __DIR__ . "/../vendor/autoload.php";



use Aws\S3\S3Client;

// ===== CONFIG =====
$bucket = "btoan-avatars";
$endpoint = "https://cd15eba0ab1a0ea99b7da632530e8924.r2.cloudflarestorage.com";
$publicUrl = "https://pub-26804f759e1e4ef3b2c251c9c3fe708b.r2.dev";

// 🔐 THAY KEY CỦA BẠN
$accessKey = "6fc950e7d94074f3fc93b5bd7756ce68";
$secretKey = "cf9b9014fef7fac8965d785594ad4cae43edb5658ed7d36f354f19cc6f1611a5";

// ===== INIT S3 =====
$s3 = new S3Client([
    'version' => 'latest',
    'region' => 'auto',
    'endpoint' => $endpoint,
    'credentials' => [
        'key' => $accessKey,
        'secret' => $secretKey,
    ],
]);

// ===== CHECK INPUT =====
if (!isset($_FILES["avatar"]) || !isset($_POST["user_id"])) {
    echo json_encode(["success" => false, "msg" => "missing data"]);
    exit;
}

$user_id = intval($_POST["user_id"]);
$file = $_FILES["avatar"];

// ===== VALIDATE =====
if ($file["error"] !== 0) {
    echo json_encode(["success" => false, "msg" => "upload error"]);
    exit;
}

$ext = strtolower(pathinfo($file["name"], PATHINFO_EXTENSION));
$allowed = ["jpg", "jpeg", "png", "webp"];

if (!in_array($ext, $allowed)) {
    echo json_encode(["success" => false, "msg" => "invalid file"]);
    exit;
}

// limit 2MB
if ($file["size"] > 2 * 1024 * 1024) {
    echo json_encode(["success" => false, "msg" => "file too large"]);
    exit;
}

// ===== FILE NAME =====
$fileName = "avatars/" . bin2hex(random_bytes(16)) . "." . $ext;

// ===== UPLOAD =====
try {
    $s3->putObject([
        'Bucket' => $bucket,
        'Key' => $fileName,
        'SourceFile' => $file["tmp_name"],
        'ContentType' => mime_content_type($file["tmp_name"]),
    ]);

    // URL public
    $url = $publicUrl . "/" . $fileName;

    // ===== SAVE DB =====
    $stmt = $conn->prepare("UPDATE users SET avatar=? WHERE id=?");
    $stmt->bind_param("si", $url, $user_id);
    $stmt->execute();

    echo json_encode([
        "success" => true,
        "avatar" => $url
    ]);

} catch (Exception $e) {
    echo json_encode([
        "success" => false,
        "error" => $e->getMessage()
    ]);
}