<?php

require "db.php";

$conversation_id = intval($_GET["conversation_id"] ?? 0);

$stmt = $conn->prepare("
SELECT question, answer, images
FROM chats
WHERE conversation_id = ?
ORDER BY id ASC
");

$stmt->bind_param("i", $conversation_id);
$stmt->execute();

$result = $stmt->get_result();

$data = [];

while($row = $result->fetch_assoc()){

    // ===== USER MESSAGE =====
    if(!empty($row["question"])){

        $images = [];

        if(!empty($row["images"])){

            $decoded = json_decode($row["images"], true);

            if(json_last_error() === JSON_ERROR_NONE && is_array($decoded)){
                $images = $decoded;
            }
        }

        $data[] = [
            "role" => "user",
            "text" => $row["question"],
            "images" => $images
        ];
    }

    // ===== AI MESSAGE =====
    if(!empty($row["answer"])){
        $data[] = [
            "role" => "assistant",
            "text" => $row["answer"]
        ];
    }

}

echo json_encode($data);