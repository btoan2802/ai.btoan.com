<?php
ini_set('display_errors', '0');
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
ob_start();

require __DIR__ . "/_bootstrap.php";

try {
    $data = json_decode(file_get_contents("php://input"), true);

    if (!is_array($data)) {
        json_out(["error" => "Request JSON không hợp lệ"], 400);
    }

    $message = trim($data["message"] ?? "");
    $currentFile = trim($data["currentFile"] ?? "");

    if ($message === "") {
        json_out(["error" => "Thiếu message"], 400);
    }

    // Fast path: tạo file
    if (preg_match('/tạo file\s+(.+)/iu', $message, $m)) {
        $path = trim($m[1], " \t\n\r\0\x0B\"'");
        $full = abs_path_from_rel($path);

        if (!is_allowed_text_file($full)) {
            json_out(["reply" => "Loại file này chưa được hỗ trợ để tạo."]);
        }

        if (!is_dir(dirname($full))) {
            mkdir(dirname($full), 0777, true);
        }

        if (!file_exists($full)) {
            file_put_contents($full, "");
        }

        json_out([
            "reply" => "Đã tạo file: " . $path,
            "action" => [
                "type" => "create_file",
                "path" => $path
            ]
        ]);
    }

    // Fast path: tạo folder
    if (preg_match('/tạo thư mục\s+(.+)/iu', $message, $m) || preg_match('/tạo folder\s+(.+)/iu', $message, $m)) {
        $path = trim($m[1], " \t\n\r\0\x0B\"'");
        $full = abs_path_from_rel($path);

        if (!is_dir($full)) {
            mkdir($full, 0777, true);
        }

        json_out([
            "reply" => "Đã tạo thư mục: " . $path,
            "action" => [
                "type" => "create_folder",
                "path" => $path
            ]
        ]);
    }

    // Chat thường hoặc hướng dẫn code
    $context = "";
    if ($currentFile !== "") {
        $full = abs_path_from_rel($currentFile);
        if (file_exists($full) && is_file($full) && is_allowed_text_file($full)) {
            $content = file_get_contents($full);
            if ($content !== false) {
                $context = mb_substr($content, 0, 8000);
            }
        }
    }

    $API_KEYS = [
        "KEY_1_CUA_BAN",
        "KEY_2_CUA_BAN"
    ];

    $API_KEYS = array_values(array_filter($API_KEYS, fn($v) => is_string($v) && trim($v) !== ""));
    if (!$API_KEYS) {
        json_out(["error" => "Chưa cấu hình Gemini API key"], 500);
    }

    shuffle($API_KEYS);

    $prompt = <<<PROMPT
Bạn là AI coding assistant trong một web IDE.

Vai trò:
- Trả lời bình thường nếu người dùng đang hỏi.
- Nếu người dùng muốn sửa code, hãy trả lời ngắn gọn định hướng.
- Nếu người dùng muốn tạo file hoặc folder, hệ thống đã có fast-path riêng.

File hiện tại: {$currentFile}

Nội dung file hiện tại:
{$context}

Tin nhắn người dùng:
{$message}
PROMPT;

    $answer = null;
    $lastError = "Không gọi được Gemini";

    foreach ($API_KEYS as $key) {
        $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" . rawurlencode($key);

        $payload = [
            "contents" => [
                [
                    "parts" => [
                        ["text" => $prompt]
                    ]
                ]
            ]
        ];

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ["Content-Type: application/json"],
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            CURLOPT_TIMEOUT => 40,
            CURLOPT_CONNECTTIMEOUT => 15,
        ]);

        $res = curl_exec($ch);
        $err = curl_error($ch);
        $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);

        if ($err) {
            $lastError = $err;
            continue;
        }

        if ($http < 200 || $http >= 300) {
            $lastError = "Gemini HTTP " . $http . " | " . mb_substr((string)$res, 0, 1000);
            continue;
        }

        $json = json_decode($res, true);
        $text = $json["candidates"][0]["content"]["parts"][0]["text"] ?? null;

        if (is_string($text) && trim($text) !== "") {
            $answer = trim($text);
            break;
        }
    }

    if (!$answer) {
        json_out(["error" => $lastError], 500);
    }

    json_out([
        "reply" => $answer
    ]);

} catch (Throwable $e) {
    json_out([
        "error" => "Agent chat server error: " . $e->getMessage()
    ], 500);
}