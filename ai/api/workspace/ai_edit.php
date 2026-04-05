<?php
ini_set('max_execution_time', 120);
set_time_limit(120);
ini_set('display_errors', '0');
error_reporting(E_ALL);
ob_start();

require __DIR__ . "/_bootstrap.php";

try {
    $raw = file_get_contents("php://input");
    $data = json_decode($raw, true);

    if (!is_array($data)) {
        if (ob_get_length()) ob_clean();
        json_out(["error" => "Request JSON không hợp lệ"], 400);
    }

    $path = $data["path"] ?? "";
    $instruction = trim($data["instruction"] ?? "");

    if ($instruction === "") {
        if (ob_get_length()) ob_clean();
        json_out(["error" => "Thiếu instruction"], 400);
    }

    $full = abs_path_from_rel($path);

    if (!file_exists($full) || !is_file($full)) {
        if (ob_get_length()) ob_clean();
        json_out(["error" => "Không tìm thấy file"], 404);
    }

    if (!is_allowed_text_file($full)) {
        if (ob_get_length()) ob_clean();
        json_out(["error" => "File không được phép sửa bằng AI"], 400);
    }

    $content = file_get_contents($full);
    if ($content === false) {
        if (ob_get_length()) ob_clean();
        json_out(["error" => "Không đọc được nội dung file"], 500);
    }

    $ext = strtolower(pathinfo($full, PATHINFO_EXTENSION));

    if ($ext === "html") {
        if (preg_match('/(?:đổi|thay)\s+title\s+(?:thành|bằng)\s+(.+)/iu', $instruction, $m)) {
            $newTitle = trim($m[1], " \t\n\r\0\x0B\"'");
            $safeTitle = htmlspecialchars($newTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

            if (preg_match('/<title\b[^>]*>.*?<\/title>/isu', $content)) {
                $updated = preg_replace(
                    '/<title\b[^>]*>.*?<\/title>/isu',
                    '<title>' . $safeTitle . '</title>',
                    $content,
                    1
                );
            } elseif (preg_match('/<head\b[^>]*>/isu', $content)) {
                $updated = preg_replace(
                    '/<head\b[^>]*>/isu',
                    '$0' . "\n    <title>" . $safeTitle . '</title>',
                    $content,
                    1
                );
            } else {
                $updated = $content;
            }

            if ($updated !== null && $updated !== $content) {
                if (ob_get_length()) ob_clean();
                json_out([
                    "path" => normalize_rel_path($path),
                    "content" => $updated
                ]);
            }
        }
    }

    $maxChars = 12000;
    if (mb_strlen($content) > $maxChars) {
        if (ob_get_length()) ob_clean();
        json_out([
            "error" => "File quá dài để AI sửa trực tiếp. Hãy chia file nhỏ hơn hoặc chọn cách sửa theo patch."
        ], 400);
    }

    $API_KEYS = [
        "AIzaSyBJ2WYYtpa6KJGCae1VMbg5Z-QU5DAiLHg",
        "AIzaSyATX9o2tDCDIboBXiUBsOq2dBrXc2-UAGc"
    ];

    $API_KEYS = array_values(array_filter($API_KEYS, function ($v) {
        return is_string($v) && trim($v) !== "";
    }));

    if (!$API_KEYS) {
        if (ob_get_length()) ob_clean();
        json_out(["error" => "Chưa cấu hình Gemini API key"], 500);
    }

    shuffle($API_KEYS);

    $prompt = <<<PROMPT
Bạn là AI code editor.

Nhiệm vụ:
- Chỉnh sửa file mã nguồn theo yêu cầu người dùng.
- Chỉ được trả về NỘI DUNG CUỐI CÙNG CỦA FILE.
- Không dùng markdown.
- Không bọc code bằng ```
- Không giải thích.
- Không thêm text nào ngoài nội dung file.

Đường dẫn file: {$path}
Loại file: {$ext}

Yêu cầu người dùng:
{$instruction}

Nội dung file hiện tại:
{$content}
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
        if ($ch === false) {
            $lastError = "Không khởi tạo được cURL";
            continue;
        }

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => ["Content-Type: application/json"],
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            CURLOPT_TIMEOUT => 45,
            CURLOPT_CONNECTTIMEOUT => 15,
        ]);

        $res = curl_exec($ch);
        $err = curl_error($ch);
        $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($err) {
            $lastError = $err;
            continue;
        }

        if ($res === false || $res === "") {
            $lastError = "Gemini không trả dữ liệu";
            continue;
        }

        if ($http < 200 || $http >= 300) {
            $lastError = "Gemini HTTP " . $http . " | " . mb_substr($res, 0, 5000);
            continue;
        }

        $json = json_decode($res, true);
        if (!is_array($json)) {
            $lastError = "Gemini trả JSON không hợp lệ: " . mb_substr($res, 0, 1000);
            continue;
        }

        $text = $json["candidates"][0]["content"]["parts"][0]["text"] ?? null;

        if (is_string($text) && trim($text) !== "") {
            $answer = trim($text);
            break;
        }

        $lastError = "Gemini không trả nội dung sửa file";
    }

    if (!$answer) {
        if (ob_get_length()) ob_clean();
        json_out(["error" => $lastError], 500);
    }

    if (ob_get_length()) ob_clean();

    json_out([
        "path" => normalize_rel_path($path),
        "content" => $answer
    ]);
} catch (Throwable $e) {
    if (ob_get_length()) ob_clean();
    json_out([
        "error" => "AI edit server error: " . $e->getMessage()
    ], 500);
}