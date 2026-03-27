<?php

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$host = "btoan.com";
$user = "btoan";
$pass = "toanhotface";
$db   = "btoan_ai";

$conn = new mysqli($host,$user,$pass,$db);
$conn->set_charset("utf8mb4");

if($conn->connect_error){
    die("DB error");
}