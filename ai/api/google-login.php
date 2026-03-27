<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

require "db.php";

$data = json_decode(file_get_contents("php://input"), true);
$token = $data['token'] ?? '';

if(!$token){
    echo json_encode(["success"=>false]);
    exit;
}

// verify token Google
$url = "https://oauth2.googleapis.com/tokeninfo?id_token=".$token;
$response = file_get_contents($url);
$user = json_decode($response, true);

if(!isset($user['email'])){
    echo json_encode(["success"=>false]);
    exit;
}

$google_id = $user['sub'];
$email = $user['email'];
$name = $user['name'] ?? null;

// ==========================
// LOGIC CHÍNH
// ==========================

// 1. tìm theo google_id
$stmt = $conn->prepare("SELECT * FROM users WHERE google_id=? LIMIT 1");
$stmt->bind_param("s", $google_id);
$stmt->execute();
$result = $stmt->get_result();

if($result->num_rows > 0){

    // ✅ đã login trước đó
    $user_db = $result->fetch_assoc();

}else{

    // 2. check email đã tồn tại chưa (user thường)
    $stmt = $conn->prepare("SELECT * FROM users WHERE email=? LIMIT 1");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if($result->num_rows > 0){

        // 👉 user thường → upgrade thành Google
        $user_db = $result->fetch_assoc();

        $stmt = $conn->prepare("UPDATE users SET google_id=?, full_name=? WHERE id=?");
        $stmt->bind_param("ssi", $google_id, $name, $user_db['id']);
        $stmt->execute();

        $user_db['google_id'] = $google_id;

    }else{

        // 👉 user mới hoàn toàn
        $stmt = $conn->prepare("
            INSERT INTO users(email, full_name, google_id)
            VALUES(?,?,?)
        ");
        $stmt->bind_param("sss", $email, $name, $google_id);
        $stmt->execute();

        $user_id = $stmt->insert_id;

        $stmt = $conn->prepare("SELECT * FROM users WHERE id=?");
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        $user_db = $stmt->get_result()->fetch_assoc();
    }
}

// ==========================
// RESPONSE
// ==========================

echo json_encode([
    "success"=>true,
    "user"=>[
        "id"=>$user_db['id'],
        "username"=>$user_db['username']?? $user_db['email'],
        "name"=>$user_db['full_name'],
        "email"=>$user_db['email']
    ]
]);