<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');

require "db.php";

$user_id = $_GET['user_id'] ?? null;

// ❌ không có user_id
if (!$user_id) {
    echo json_encode([
        "has_profile" => false,
        "full_name" => null
    ]);
    exit;
}

// ✅ query user
$stmt = $conn->prepare("SELECT full_name, dob FROM users WHERE id=?");
$stmt->bind_param("i", $user_id);
$stmt->execute();

$result = $stmt->get_result();
$user = $result->fetch_assoc();

// ❌ không tìm thấy user
if (!$user) {
    echo json_encode([
        "has_profile" => false,
        "full_name" => null
    ]);
    exit;
}

// ✅ có user
$full_name = trim($user['full_name'] ?? "");

// 🎯 trả về đầy đủ data
echo json_encode([
    "has_profile" => !empty($full_name),
    "full_name" => $full_name ?: null,
    "dob" => $user['dob'] ?? null
]);