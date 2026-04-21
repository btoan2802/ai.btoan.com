<?php
require "db.php";

$data = json_decode(file_get_contents("php://input"), true);

$id = intval($data["id"] ?? 0);
$isAuto = isset($data["isAuto"]) && $data["isAuto"] === true;
$title = trim($data["title"] ?? "");

if (!$id) {
    echo json_encode(["status" => "error", "message" => "missing id"]);
    exit;
}

if ($isAuto) {
    // 🤖 AI AUTO RENAME
    $stmt = $conn->prepare("
        SELECT question 
        FROM chats 
        WHERE conversation_id=? 
        ORDER BY id ASC 
        LIMIT 1
    ");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res->fetch_assoc();
    $question = $row["question"] ?? "Chat mới";

    $API_KEYS = [
        "AIzaSyCj5togPa80e1bI9Vup74BFOl44D08sZLw",
        "AIzaSyDFHm1sOBGnCeWIThcCo-hB7wWNjz5QdSU",
        "AIzaSyDrOpKT2oRzSfpKY_VlU3rvu-YpfzauOAs",
        "AIzaSyCZx8h9y6X78quESwB6K1MEXHRNWglaTDM",
        "AIzaSyBr0RBLcNROl50u7kjaWPrRQIG21EZ5bpA",
        "AIzaSyAAGonXPwa_86o1SQa1WDKG8_6GCz_CjHg",
        "AIzaSyCYUzKmlZ1ZD-Eabl9BI-PiaJiWkccK1os",
        "AIzaSyBdwrghehTW22SuWH0Yq2jBbv6H5OZ4Ce8"
    ];

    shuffle($API_KEYS);
    $title = "Chat mới"; // Default fallback

    $prompt = "Hãy đặt một tiêu đề ngắn gọn (3-6 từ), súc tích và tự nhiên cho cuộc hội thoại bắt đầu bằng câu hỏi này: \"$question\". Tiêu đề phải phản ánh chủ đề chính, không dùng dấu ngoặc kép, không dùng các cụm như 'Tiêu đề:', 'Câu hỏi:', 'Người dùng:'. Trả về duy nhất phần tiêu đề.";

    $payload = [
        "contents" => [
            [
                "role" => "user",
                "parts" => [["text" => $prompt]]
            ]
        ]
    ];

    foreach ($API_KEYS as $key) {
        $ch = curl_init("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$key");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ["Content-Type: application/json"],
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 30
        ]);

        $response = curl_exec($ch);
        $data_ai = json_decode($response, true);

        if (isset($data_ai["candidates"][0]["content"]["parts"][0]["text"])) {
            $title = trim($data_ai["candidates"][0]["content"]["parts"][0]["text"]);
            $title = str_replace(['"', "'", '`'], '', $title);
            break;
        }
    }
}

// 🔥 Final Update
$stmt = $conn->prepare("UPDATE conversations SET title=? WHERE id=?");
$stmt->bind_param("si", $title, $id);
$stmt->execute();

echo json_encode([
    "status" => "ok",
    "title" => $title
]);