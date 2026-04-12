<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
header('Content-Type: application/json');

require "db.php";
require __DIR__ . "/../../vendor/autoload.php";

use Aws\S3\S3Client;

$bucket = "btoan-avatars";
$endpoint = "https://cd15eba0ab1a0ea99b7da632530e8924.r2.cloudflarestorage.com";
$publicUrl = "https://pub-26804f759e1e4ef3b2c251c9c3fe708b.r2.dev";

$accessKey = "6fc950e7d94074f3fc93b5bd7756ce68";
$secretKey = "cf9b9014fef7fac8965d785594ad4cae43edb5658ed7d36f354f19cc6f1611a5";

$s3 = new S3Client([
    'version' => 'latest',
    'region' => 'auto',
    'endpoint' => $endpoint,
    'credentials' => [
        'key' => $accessKey,
        'secret' => $secretKey,
    ],
]);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(["success" => false, "msg" => "invalid method"]);
    exit;
}

$username = trim($_POST["username"] ?? "");
$image = $_POST["image"] ?? "";

if ($username === "" || $image === "") {
    echo json_encode(["success" => false, "msg" => "missing data"]);
    exit;
}

$stmt = $conn->prepare("SELECT id, username FROM users WHERE username = ? LIMIT 1");
$stmt->bind_param("s", $username);
$stmt->execute();
$result = $stmt->get_result();
$user = $result->fetch_assoc();
$stmt->close();

if (!$user) {
    echo json_encode(["success" => false, "msg" => "user not found"]);
    exit;
}

if (!preg_match('/^data:image\/(jpeg|jpg|png);base64,/', $image)) {
    echo json_encode(["success" => false, "msg" => "invalid image format"]);
    exit;
}

$image = preg_replace('/^data:image\/\w+;base64,/', '', $image);
$binary = base64_decode($image);

if ($binary === false) {
    echo json_encode(["success" => false, "msg" => "decode failed"]);
    exit;
}

$tmpFile = tempnam(sys_get_temp_dir(), 'face_');
file_put_contents($tmpFile, $binary);

$mime = mime_content_type($tmpFile);
$ext = "jpg";

if ($mime === "image/png") {
    $ext = "png";
} elseif ($mime === "image/jpeg") {
    $ext = "jpg";
}

$fileName = "faces/" . $username . "/1." . $ext;

try {
    $s3->putObject([
        'Bucket' => $bucket,
        'Key' => $fileName,
        'SourceFile' => $tmpFile,
        'ContentType' => $mime,
    ]);

    $url = $publicUrl . "/" . $fileName;

    $stmt = $conn->prepare("
        UPDATE users
        SET face_image_url = ?, face_enabled = 1, face_updated_at = NOW()
        WHERE id = ?
    ");
    $stmt->bind_param("si", $url, $user['id']);
    $stmt->execute();
    $stmt->close();

    @unlink($tmpFile);

    echo json_encode([
        "success" => true,
        "face_image_url" => $url
    ]);
} catch (Exception $e) {
    @unlink($tmpFile);

    echo json_encode([
        "success" => false,
        "error" => $e->getMessage()
    ]);
}