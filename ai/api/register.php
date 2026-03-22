<?php

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");

error_reporting(E_ALL);
ini_set('display_errors',1);

require "db.php";

$data = json_decode(file_get_contents("php://input"), true);

if(!$data){
    echo json_encode([
        "status"=>"error",
        "msg"=>"invalid request"
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$username = trim($data["username"] ?? "");
$password = trim($data["password"] ?? "");

if(!$username || !$password){
    echo json_encode([
        "status"=>"error",
        "msg"=>"Thiếu username hoặc password"
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

# kiểm tra độ dài
if(strlen($password) < 6){
    echo json_encode([
        "status"=>"error",
        "msg"=>"Mật khẩu phải tối thiểu 6 ký tự"
    ], JSON_UNESCAPED_UNICODE);
    exit;
}



$hash = $password; // bạn đang lưu plain password

$stmt = $conn->prepare("INSERT INTO users(username,password) VALUES(?,?)");

$stmt->bind_param("ss",$username,$hash);

if($stmt->execute()){

    echo json_encode([
        "status"=>"ok"
    ]);

}else{

    echo json_encode([
        "status"=>"error",
        "msg"=>"Username đã tồn tại"
    ], JSON_UNESCAPED_UNICODE);

}