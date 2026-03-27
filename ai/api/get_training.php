<?php
// Hiển thị lỗi (debug)
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Trả về JSON
header('Content-Type: application/json');

// Kết nối DB
require_once __DIR__ . "/db.php";

// Lấy query
$q = $_GET["q"] ?? "";

// Nếu rỗng thì trả về luôn (tránh query lỗi)
if (!$q) {
    echo json_encode([]);
    exit;
}

// Prepare SQL
$stmt = $conn->prepare("
    SELECT question, correct_answer
    FROM ai_training
    WHERE question LIKE CONCAT('%', ?, '%')
    LIMIT 3
");

// Check lỗi prepare
if (!$stmt) {
    echo json_encode([
        "error" => "Prepare failed",
        "message" => $conn->error
    ]);
    exit;
}

// Bind + execute
$stmt->bind_param("s", $q);
$stmt->execute();

$res = $stmt->get_result();

$data = [];

// Lấy data
while ($row = $res->fetch_assoc()) {
    $data[] = $row;
}

// Trả JSON
echo json_encode($data);

// Close
$stmt->close();
$conn->close();