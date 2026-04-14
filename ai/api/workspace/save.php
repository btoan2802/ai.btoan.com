<?php
require __DIR__ . "/_bootstrap.php";

$raw = file_get_contents("php://input");
$data = json_decode($raw, true);

$path = $data["path"] ?? "";
$content = $data["content"] ?? "";

$full = abs_path_from_rel($path);

if (!is_allowed_text_file($full)) {
    json_out(["error" => "File không được phép lưu"], 400);
}

$dir = dirname($full);
if (!is_dir($dir)) {
    mkdir($dir, 0777, true);
}

file_put_contents($full, $content);

json_out([
    "ok" => true,
    "path" => normalize_rel_path($path)
]);