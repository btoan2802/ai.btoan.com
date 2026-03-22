<?php
require "db.php";

$data=json_decode(file_get_contents("php://input"),true);

$user_id=$data["user_id"];
$memory=$data["memory"];

$stmt=$conn->prepare("
INSERT INTO user_memory(user_id,memory_value)
VALUES(?,?)
");

$stmt->bind_param("is",$user_id,$memory);
$stmt->execute();

echo json_encode(["status"=>"ok"]);