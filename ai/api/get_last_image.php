<?php
header('Content-Type: application/json');
require_once 'db.php';

$conversation_id = isset($_GET['conversation_id']) ? (int)$_GET['conversation_id'] : 0;

if (!$conversation_id) {
    echo json_encode(['success' => false, 'error' => 'Missing conversation_id']);
    exit;
}

try {
    // Tìm tin nhắn gần nhất của USER có chứa hình ảnh trong cuộc hội thoại này (Dùng mysqli $conn)
    $stmt = $conn->prepare("
        SELECT images 
        FROM chats 
        WHERE conversation_id = ? 
          AND images IS NOT NULL 
          AND images != '' 
          AND images != '[]'
        ORDER BY id DESC 
        LIMIT 1
    ");

    
    if (!$stmt) {
        throw new Exception("Prepare failed: " . $conn->error);
    }

    $stmt->bind_param("i", $conversation_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();

    if ($row && $row['images']) {
        $images = json_decode($row['images'], true);
        if (is_array($images) && count($images) > 0) {
            // Lấy ảnh đầu tiên trong mảng images
            echo json_encode([
                'success' => true, 
                'image_url' => $images[0]
            ]);
            exit;
        }
    }

    echo json_encode(['success' => false, 'error' => 'No images found in history']);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
