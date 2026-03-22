<?php

require "db.php";

$conversation_id = $_GET["conversation_id"];

$stmt = $conn->prepare("
SELECT question, answer
FROM chats
WHERE conversation_id = ?
ORDER BY id ASC
");

$stmt->bind_param("i",$conversation_id);
$stmt->execute();

$result = $stmt->get_result();

$data = [];

while($row = $result->fetch_assoc()){

    if($row["question"]){
        $data[] = [
            "role"=>"user",
            "text"=>$row["question"]
        ];
    }

    if($row["answer"]){
        $data[] = [
            "role"=>"assistant",
            "text"=>$row["answer"]
        ];
    }

}

echo json_encode($data);