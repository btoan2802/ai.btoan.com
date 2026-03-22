<?php

require "db.php";

$data = json_decode(file_get_contents("php://input"), true);

if(!$data){
echo json_encode(["error"=>"no data"]);
exit;
}

$id = intval($data["id"]);

$stmt = $conn->prepare("DELETE FROM chats WHERE conversation_id=?");
$stmt->bind_param("i",$id);
$stmt->execute();

$stmt = $conn->prepare("DELETE FROM conversations WHERE id=?");
$stmt->bind_param("i",$id);
$stmt->execute();

echo json_encode([
"status"=>"deleted"
]);