<?php
require "db.php";

header("Content-Type: application/json; charset=utf-8");


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

$stmt = $conn->prepare("SELECT id,password,username FROM users WHERE username=?");

if(!$stmt){
    echo json_encode(["error"=>"SQL prepare failed"], JSON_UNESCAPED_UNICODE);
    exit;
}

$stmt->bind_param("s",$username);
$stmt->execute();

$stmt->bind_result($id,$dbpass,$dbusername);

if($stmt->fetch()){

    if($password == $dbpass){

        echo json_encode([
            "success"=>true,
            "user_id"=>$id,
            "username"=>$dbusername
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