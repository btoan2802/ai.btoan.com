<?php

require "db.php";

if (!isset($_FILES["avatar"]) || !isset($_POST["user_id"])) {
    echo json_encode(["success" => false]);
    exit;
}

$user_id = intval($_POST["user_id"]);
$file = $_FILES["avatar"];

// ===== validate =====
if ($file["error"] !== 0) {
    echo json_encode(["success" => false]);
    exit;
}

// chỉ cho ảnh
$ext = strtolower(pathinfo($file["name"], PATHINFO_EXTENSION));
$allowed = ["jpg", "jpeg", "png", "webp"];

if (!in_array($ext, $allowed)) {
    echo json_encode(["success" => false]);
    exit;
}

// ===== tạo tên file =====
$filename = "avatar_" . $user_id . "_" . time() . "." . $ext;

// 🔥 PATH REAL (filesystem)
$uploadDir = __DIR__ . "/../uploads/avatars/";

if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0777, true);
}

$path = $uploadDir . $filename;

// ===== move file =====
if (!move_uploaded_file($file["tmp_name"], $path)) {
    echo json_encode(["success" => false, "msg" => "move failed"]);
    exit;
}

// 🔥 URL PUBLIC (browser dùng)
$url = "/ai/uploads/avatars/" . $filename;

// ===== SAVE DB =====
$stmt = $conn->prepare("UPDATE users SET avatar=? WHERE id=?");
$stmt->bind_param("si", $url, $user_id);
$stmt->execute();

echo json_encode([
    "success" => true,
    "avatar" => $url   // 🔥 đổi từ url → avatar (đồng bộ frontend)
]);