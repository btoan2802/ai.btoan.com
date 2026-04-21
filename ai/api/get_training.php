<?php
error_reporting(0);
ini_set('display_errors', 0);
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . "/db.php";

$q = $_GET["q"] ?? "";
if (!$q) {
    echo json_encode([]);
    exit;
}

$data = [];
$stmt = $conn->prepare("SELECT question, correct_answer FROM ai_training WHERE question LIKE CONCAT('%', ?, '%') LIMIT 5");

if ($stmt) {
    $stmt->bind_param("s", $q);
    $stmt->execute();
    $res = $stmt->get_result();
    while ($row = $res->fetch_assoc()) {
        $data[] = $row;
    }
    $stmt->close();
}

echo json_encode($data);
$conn->close();