<?php
require "db.php";

$data=json_decode(file_get_contents("php://input"),true);

$id = intval($data["id"] ?? 0);
$title = trim($data["title"] ?? "");

if(!$title){
    echo json_encode(["error"=>"missing title"]);
    exit;
}

if(!$isAuto){

    // ✍️ USER RENAME
    $title = $data["title"];

}else{

    // 🤖 AUTO RENAME

    $stmt=$conn->prepare("
    SELECT question 
    FROM chats 
    WHERE conversation_id=? 
    ORDER BY id ASC 
    LIMIT 1
    ");

    $stmt->bind_param("i",$id);
    $stmt->execute();
    $res=$stmt->get_result();

    $row=$res->fetch_assoc();
    $question=$row["question"] ?? "Chat mới";

    // 👉 random API key (giống chat.php)
    $API_KEYS = [
        "AIzaSyBJ2WYYtpa6KJGCae1VMbg5Z-QU5DAiLHg"
    ];
    $API_KEY = $API_KEYS[array_rand($API_KEYS)];

    $prompt="Tóm tắt câu này thành tiêu đề ngắn, tự nhiên (không robot): ".$question;

    $payload=[
        "contents"=>[
            [
                "role"=>"user",
                "parts"=>[
                    ["text"=>$prompt]
                ]
            ]
        ]
    ];

    $ch=curl_init("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$API_KEY");

    curl_setopt_array($ch,[
        CURLOPT_RETURNTRANSFER=>true,
        CURLOPT_POST=>true,
        CURLOPT_HTTPHEADER=>[
            "Content-Type: application/json"
        ],
        CURLOPT_POSTFIELDS=>json_encode($payload)
    ]);

    $response=curl_exec($ch);
    $data_ai=json_decode($response,true);

    $title="Chat mới";

    if(isset($data_ai["candidates"][0]["content"]["parts"][0]["text"])){
        $title=trim($data_ai["candidates"][0]["content"]["parts"][0]["text"]);
    }
}

// 🔥 update DB
$stmt=$conn->prepare("
UPDATE conversations
SET title=?
WHERE id=?
");

$stmt->bind_param("si",$title,$id);
$stmt->execute();

echo json_encode([
    "status"=>"ok",
    "title"=>$title
]);