<?php
header('Content-Type: application/json');
require "db.php";

$username = trim($_GET["username"] ?? "");

if ($username === "") {
    echo json_encode([
        "success" => false,
        "msg" => "missing username"
    ]);
    exit;
}

$stmt = $conn->prepare("
    SELECT id, username, face_enabled, face_image_url, face_updated_at
    FROM users
    WHERE username = ?
    LIMIT 1
");
$stmt->bind_param("s", $username);
$stmt->execute();
$result = $stmt->get_result();
$user = $result->fetch_assoc();
$stmt->close();

if (!$user) {
    echo json_encode([
        "success" => false,
        "msg" => "user not found"
    ]);
    exit;
}

echo json_encode([
    "success" => true,
    "user" => [
        "id" => (int)$user["id"],
        "username" => $user["username"],
        "face_enabled" => (int)$user["face_enabled"],
        "face_image_url" => $user["face_image_url"],
        "face_updated_at" => $user["face_updated_at"]
    ]
]);