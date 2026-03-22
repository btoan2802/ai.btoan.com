<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

header("Content-Type: application/json; charset=utf-8");

$conn = new mysqli("localhost","btoan","toanhotface","btoan_ai");

if($conn->connect_error){
    echo json_encode(["error"=>"DB connection failed"], JSON_UNESCAPED_UNICODE);
    exit;
}

$data = json_decode(file_get_contents("php://input"), true);

if(!$data){
    echo json_encode(["error"=>"Invalid request"], JSON_UNESCAPED_UNICODE);
    exit;
}

$username = trim($data["username"] ?? "");
$password = trim($data["password"] ?? "");

$stmt = $conn->prepare("SELECT id,password FROM users WHERE username=?");

if(!$stmt){
    echo json_encode(["error"=>"SQL prepare failed"], JSON_UNESCAPED_UNICODE);
    exit;
}

$stmt->bind_param("s",$username);
$stmt->execute();

$stmt->bind_result($id,$dbpass);

if($stmt->fetch()){

    if($password == $dbpass){

        echo json_encode([
            "success"=>true,
            "user_id"=>$id
        ], JSON_UNESCAPED_UNICODE);

    }else{

        echo json_encode([
            "error"=>"Sai tài khoản hoặc mật khẩu"
        ], JSON_UNESCAPED_UNICODE);

    }

}else{

    echo json_encode([
        "error"=>"Sai tài khoản hoặc mật khẩu"
    ], JSON_UNESCAPED_UNICODE);

}