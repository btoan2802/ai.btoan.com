<?php
require __DIR__ . "/_bootstrap.php";

$raw = file_get_contents("php://input");
$data = json_decode($raw, true);

$path = trim($data["path"] ?? "");
if ($path === "") {
    json_out(["error" => "Thiếu path"], 400);
}

$full = abs_path_from_rel($path);

if (file_exists($full)) {
    json_out(["error" => "Folder đã tồn tại"], 400);
}

mkdir($full, 0777, true);

json_out([
    "ok" => true,
    "path" => normalize_rel_path($path)
]);