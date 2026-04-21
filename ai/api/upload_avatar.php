<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

require "db.php";
require __DIR__ . "/../../vendor/autoload.php";

use Aws\S3\S3Client;

require "db.php";
require "r2_uploader.php";

if (!isset($_FILES["avatar"]) || !isset($_POST["user_id"])) {
    echo json_encode(["success" => false, "msg" => "missing data"]);
    exit;
}

$user_id = intval($_POST["user_id"]);
$file = $_FILES["avatar"];

try {
    // ☁️ CLOUD UPLOAD (Using Refactored Architecture)
    $uploader = new R2Uploader();
    $url = $uploader->upload($file, 'avatars');

    // 💾 SAVE DB
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