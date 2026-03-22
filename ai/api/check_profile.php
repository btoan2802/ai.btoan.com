<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: application/json');

require "db.php";

$user_id = $_GET['user_id'] ?? null;

if(!$user_id){
    echo json_encode(["has_profile"=>false]);
    exit;
}

// ✅ MYSQLI đúng cách
$stmt = $conn->prepare("SELECT full_name, dob FROM users WHERE id=?");
$stmt->bind_param("i", $user_id);
$stmt->execute();

$result = $stmt->get_result();
$user = $result->fetch_assoc();

if($user && !empty($user['full_name'])){
    echo json_encode(["has_profile"=>true]);
}else{
    echo json_encode(["has_profile"=>false]);
}