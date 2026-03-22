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

$stmt = $pdo->prepare("SELECT full_name, dob FROM users WHERE id=?");
$stmt->execute([$user_id]);
$user = $stmt->fetch();

if($user && !empty($user['full_name'])){
    echo json_encode(["has_profile"=>true]);
}else{
    echo json_encode(["has_profile"=>false]);
}