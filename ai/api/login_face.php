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
$rawDescriptor = $_POST['descriptor'] ?? ''; // New: JSON string from client

if ($username === '' || $rawDescriptor === '') {
    echo json_encode([
        'success' => false,
        'message' => 'Thiếu dữ liệu xác thực (username hoặc descriptor)'
    ]);
    exit;
}

$stmt = $conn->prepare("
    SELECT id, username, face_enabled, face_descriptor
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
    echo json_encode(['success' => false, 'message' => 'Tài khoản không tồn tại']);
    exit;
}

if ((int)$user['face_enabled'] !== 1 || empty($user['face_descriptor'])) {
    echo json_encode(['success' => false, 'message' => 'Tài khoản chưa thiết lập FaceID']);
    exit;
}

// 🛡️ SERVER-SIDE BIOMETRIC MATCHING
$liveDescriptor = json_decode($rawDescriptor, true);
$storedDescriptor = json_decode($user['face_descriptor'], true);

if (!is_array($liveDescriptor) || !is_array($storedDescriptor)) {
    echo json_encode(['success' => false, 'message' => 'Dữ liệu sinh trắc học không hợp lệ']);
    exit;
}

function euclideanDistance($arr1, $arr2) {
    if (count($arr1) !== count($arr2)) return 1.0;
    $sum = 0;
    for ($i = 0; $i < count($arr1); $i++) {
        $sum += pow($arr1[$i] - $arr2[$i], 2);
    }
    return sqrt($sum);
}

$distance = euclideanDistance($liveDescriptor, $storedDescriptor);

// 🔒 STRICT THRESHOLD (0.45 is standard for face-api.js)
if ($distance > 0.45) {
    echo json_encode([
        'success' => false,
        'message' => 'Xác minh khuôn mặt thất bại! Bạn không phải chủ sở hữu tài khoản này.',
        'distance' => $distance
    ]);
    exit;
}

// ✅ SUCCESS: Identity verified on Server
$_SESSION['user_id'] = (int)$user['id'];
$_SESSION['username'] = $user['username'];

echo json_encode([
    'success' => true,
    'message' => 'Đăng nhập khuôn mặt thành công',
    'username' => $user['username'],
    'user_id' => (int)$user['id'],
    'distance' => $distance
]);