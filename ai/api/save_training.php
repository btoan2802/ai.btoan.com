<?php

require "db.php";

$data = json_decode(file_get_contents("php://input"), true);

$question = $data["question"] ?? "";
$ai_answer = $data["ai_answer"] ?? "";
$correct_answer = $data["correct_answer"] ?? "";
$user_id = $data["user_id"] ?? 0;

$stmt = $conn->prepare("
INSERT INTO ai_training(question, ai_answer, correct_answer, user_id)
VALUES(?,?,?,?)
");

$stmt->bind_param("sssi",$question,$ai_answer,$correct_answer,$user_id);
$stmt->execute();

echo json_encode([
"status"=>"ok"
]);