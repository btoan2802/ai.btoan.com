<?php
require __DIR__ . "/_bootstrap.php";

$raw = file_get_contents("php://input");
$data = json_decode($raw, true);

$path = trim($data["path"] ?? "");
$content = $data["content"] ?? "";

if ($path === "") {
    json_out(["error" => "Thiếu path"], 400);
}

$full = abs_path_from_rel($path);

if (!is_allowed_text_file($full)) {
    json_out(["error" => "Loại file không hỗ trợ"], 400);
}

$dir = dirname($full);
if (!is_dir($dir)) {
    mkdir($dir, 0777, true);
}

if (file_exists($full)) {
    json_out(["error" => "File đã tồn tại"], 400);
}

file_put_contents($full, $content);

json_out([
    "ok" => true,
    "path" => normalize_rel_path($path)
]);