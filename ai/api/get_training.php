<?php

require "db.php";

$q = $_GET["q"] ?? "";

$stmt = $conn->prepare("
SELECT question,correct_answer
FROM ai_training
WHERE question LIKE CONCAT('%',?,'%')
LIMIT 3
");

$stmt->bind_param("s",$q);
$stmt->execute();

$res = $stmt->get_result();

$data=[];

while($row=$res->fetch_assoc()){
$data[]=$row;
}

echo json_encode($data);