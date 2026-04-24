<?php
header('Content-Type: application/json');
require_once '../../db.php';

$conversation_id = isset($_GET['conversation_id']) ? $_GET['conversation_id'] : null;

if (!$conversation_id) {
    echo json_encode(['success' => false, 'error' => 'Missing conversation_id']);
    exit;
}

try {
    // Tìm tin nhắn gần nhất của USER có chứa hình ảnh trong cuộc hội thoại này
    $stmt = $pdo->prepare("
        SELECT images 
        FROM chats 
        WHERE conversation_id = ? 
          AND role = 'user' 
          AND images IS NOT NULL 
          AND images != '' 
          AND images != '[]'
        ORDER BY id DESC 
        LIMIT 1
    ");
    $stmt->execute([$conversation_id]);
    $row = $stmt->fetch();

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

} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
