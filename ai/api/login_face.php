<?php
session_start();
header('Content-Type: application/json');

require "db.php";

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode([
        'success' => false,
        'message' => 'Phương thức không hợp lệ'
    ]);
    exit;
}

$username = trim($_POST['username'] ?? '');

if ($username === '') {
    echo json_encode([
        'success' => false,
        'message' => 'Thiếu username'
    ]);
    exit;
}

$stmt = $conn->prepare("
    SELECT id, username, face_enabled, face_image_url
    FROM users
    WHERE username = ?
    LIMIT 1
");
$stmt->bind_param("s", $username);
$stmt->execute();
$result = $stmt->get_result();
$user = $result->fetch_assoc();
$stmt->close();

if (!$user) {
    echo json_encode([
        'success' => false,
        'message' => 'Tài khoản không tồn tại'
    ]);
    exit;
}

if ((int)$user['face_enabled'] !== 1 || empty($user['face_image_url'])) {
    echo json_encode([
        'success' => false,
        'message' => 'Tài khoản chưa thiết lập khuôn mặt'
    ]);
    exit;
}

$_SESSION['user_id'] = (int)$user['id'];
$_SESSION['username'] = $user['username'];

echo json_encode([
    'success' => true,
    'message' => 'Đăng nhập khuôn mặt thành công',
    'username' => $user['username']
]);