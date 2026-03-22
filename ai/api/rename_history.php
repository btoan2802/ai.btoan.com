<?php
require "db.php";

$q = $_GET["q"] ?? "";
$user_id = intval($_GET["user_id"] ?? 0);

$stmt = $conn->prepare("
SELECT id, title 
FROM conversations
WHERE user_id=? AND title LIKE ?
ORDER BY id DESC
");

$like = "%$q%";

$stmt->bind_param("is",$user_id,$like);
$stmt->execute();

$res = $stmt->get_result();

$data = [];

while($row = $res->fetch_assoc()){
    $data[] = $row;
}

echo json_encode($data);