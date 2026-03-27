<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json; charset=utf-8');

require "db.php";

// ===== GET PARAM =====
$user_id = isset($_GET['user_id']) ? intval($_GET['user_id']) : 0;

// ❌ không có user_id hợp lệ
if ($user_id <= 0) {
    echo json_encode([
        "has_profile" => false,
        "full_name" => null,
        "dob" => null
    ]);
    exit;
}

// ===== QUERY =====
$stmt = $conn->prepare("SELECT full_name, dob FROM users WHERE id = ?");
$stmt->bind_param("i", $user_id);
$stmt->execute();

$result = $stmt->get_result();
$user = $result->fetch_assoc();

// ❌ không có user
if (!$user) {
    echo json_encode([
        "has_profile" => false,
        "full_name" => null,
        "dob" => null
    ]);
    exit;
}

// ===== DATA =====
$full_name = trim($user['full_name'] ?? "");
$dob = $user['dob'] ?? null;

// ===== RESPONSE =====
echo json_encode([
    "has_profile" => !empty($full_name),
    "full_name" => !empty($full_name) ? $full_name : null,
    "dob" => $dob
]);