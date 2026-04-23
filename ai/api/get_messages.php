<?php

require "db.php";

$conversation_id = intval($_GET["conversation_id"] ?? 0);

$stmt = $conn->prepare("
SELECT question, answer, images, assistant_images, assistant_video
FROM chats
WHERE conversation_id = ?
ORDER BY id ASC
");

$stmt->bind_param("i", $conversation_id);
$stmt->execute();

$result = $stmt->get_result();

$data = [];

while ($row = $result->fetch_assoc()) {

    if (!empty($row["question"])) {
        $images = [];

        if (!empty($row["images"])) {
            $decoded = json_decode($row["images"], true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                $images = $decoded;
            }
        }

        $data[] = [
            "role" => "user",
            "text" => $row["question"],
            "images" => $images
        ];
    }

    if (!empty($row["answer"]) || !empty($row["assistant_images"]) || !empty($row["assistant_video"])) {
        $assistantImages = [];

        if (!empty($row["assistant_images"])) {
            $decodedAssistant = json_decode($row["assistant_images"], true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decodedAssistant)) {
                $assistantImages = $decodedAssistant;
            }
        }

        $data[] = [
            "role" => "assistant",
            "text" => $row["answer"] ?? "",
            "images" => $assistantImages,
            "video" => $row["assistant_video"] ?? null
        ];
    }
}

echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);