<?php

header("Content-Type: application/json");

$conn = new mysqli("localhost","btoan","toanhotface","btoan_ai");

if ($conn->connect_error) {
    echo json_encode(["error"=>"DB connect fail"]);
    exit;
}

$user_id = intval($_GET["user_id"]);

$stmt = $conn->prepare("
SELECT memory_value
FROM user_memory
WHERE user_id=?
ORDER BY id DESC
LIMIT 10
");

$stmt->bind_param("i",$user_id);
$stmt->execute();

$result=$stmt->get_result();

$data=[];

while($row=$result->fetch_assoc()){
    $data[]=$row;
}

echo json_encode($data);