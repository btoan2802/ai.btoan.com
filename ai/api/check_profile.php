<?php
error_reporting(0);
ini_set('display_errors', 0);
header('Content-Type: application/json');

require "db.php";


$user_id = $_GET['user_id'] ?? null;

if(!$user_id){
    echo json_encode(["has_profile"=>false]);
    exit;
}

$stmt = $conn->prepare("SELECT full_name, dob FROM users WHERE id=?");
$stmt->execute([$user_id]);
$user = $stmt->fetch();

if($user && $user['full_name'] && $user['dob']){
    echo json_encode([
        "has_profile" => true,
        "full_name" => $user['full_name']
    ]);
}else{
    echo json_encode(["has_profile" => false]);
}