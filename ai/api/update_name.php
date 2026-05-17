<?php
error_reporting(0);
ini_set('display_errors', 0);
header('Content-Type: application/json');

// ✅ đúng file DB của bạn
require_once "db.php";

$data = json_decode(file_get_contents("php://input"), true);

$user_id = $data['user_id'] ?? null;
$full_name = trim($data['full_name'] ?? '');
$dob = $data['dob'] ?? null;

if(!$user_id || !$full_name || !$dob){
    echo json_encode([
        "success" => false,
        "message" => "Thiếu dữ liệu"
    ]);
    exit;
}

try{

    $stmt = $conn->prepare("
        UPDATE users 
        SET full_name = ?, dob = ?
        WHERE id = ?
    ");
    $stmt->bind_param("ssi", $full_name, $dob, $user_id);
    $stmt->execute();

    echo json_encode([
        "success" => true
    ]);

}catch(Exception $e){

    echo json_encode([
        "success" => false,
        "message" => "DB error"
    ]);
}