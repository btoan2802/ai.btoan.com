<?php
require __DIR__ . "/_bootstrap.php";

$path = $_GET["path"] ?? "";
$full = abs_path_from_rel($path);

if (!file_exists($full) || !is_file($full)) {
    json_out(["error" => "Không tìm thấy file"], 404);
}

if (!is_allowed_text_file($full)) {
    json_out(["error" => "File không được phép đọc"], 400);
}

$content = file_get_contents($full);

json_out([
    "path" => normalize_rel_path($path),
    "content" => $content
]);