<?php
session_start();
header('Content-Type: application/json');

require_once __DIR__ . 'db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode([
        'success' => false,
        'message' => 'Phương thức không hợp lệ'
    ]);
    exit;
}

$username = trim($_POST['username'] ?? '');
$faceLabel = trim($_POST['face_label'] ?? '');

if ($username === '' || $faceLabel === '') {
    echo json_encode([
        'success' => false,
        'message' => 'Thiếu thông tin đăng nhập khuôn mặt'
    ]);
    exit;
}

try {
    $stmt = $conn->prepare("
        SELECT id, username, face_label, face_enabled
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

    if ((int)$user['face_enabled'] !== 1) {
        echo json_encode([
            'success' => false,
            'message' => 'Tài khoản chưa bật đăng nhập khuôn mặt'
        ]);
        exit;
    }

    $expectedLabel = trim((string)($user['face_label'] ?? ''));

    if ($expectedLabel === '') {
        echo json_encode([
            'success' => false,
            'message' => 'Tài khoản chưa cấu hình face label'
        ]);
        exit;
    }

    if (strcasecmp($expectedLabel, $faceLabel) !== 0) {
        echo json_encode([
            'success' => false,
            'message' => 'Khuôn mặt không khớp với tài khoản'
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
} catch (Throwable $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Lỗi máy chủ: ' . $e->getMessage()
    ]);
}