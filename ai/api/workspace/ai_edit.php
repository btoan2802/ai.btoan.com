<?php
require __DIR__ . "/_bootstrap.php";
require __DIR__ . "/../db.php";

$raw = file_get_contents("php://input");
$data = json_decode($raw, true);

$path = $data["path"] ?? "";
$instruction = trim($data["instruction"] ?? "");

if ($instruction === "") {
    json_out(["error" => "Thiếu instruction"], 400);
}

$full = abs_path_from_rel($path);

if (!file_exists($full) || !is_file($full)) {
    json_out(["error" => "Không tìm thấy file"], 404);
}

if (!is_allowed_text_file($full)) {
    json_out(["error" => "File không được phép sửa bằng AI"], 400);
}

$content = file_get_contents($full);
$ext = strtolower(pathinfo($full, PATHINFO_EXTENSION));

$API_KEYS = [
    "AIzaSyBJ2WYYtpa6KJGCae1VMbg5Z-QU5DAiLHg",
    "AIzaSyATX9o2tDCDIboBXiUBsOq2dBrXc2-UAGc"
];

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
    $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" . $key;

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
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_TIMEOUT => 120
    ]);

    $res = curl_exec($ch);
    $err = curl_error($ch);
    $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($err) {
        $lastError = $err;
        continue;
    }

    if ($http < 200 || $http >= 300) {
        $lastError = "Gemini HTTP " . $http . " | " . $res;
        continue;
    }

    $json = json_decode($res, true);
    $text = $json["candidates"][0]["content"]["parts"][0]["text"] ?? null;

    if ($text) {
        $answer = trim($text);
        break;
    }
}

if (!$answer) {
    json_out(["error" => $lastError], 500);
}

json_out([
    "path" => normalize_rel_path($path),
    "content" => $answer
]);