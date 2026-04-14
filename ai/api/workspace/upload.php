<?php
require __DIR__ . "/_bootstrap.php";

if (empty($_FILES["file"])) {
    json_out(["error" => "Chưa có file upload"], 400);
}

$name = $_FILES["file"]["name"];
$tmp = $_FILES["file"]["tmp_name"];

$relPath = normalize_rel_path($name);
$full = abs_path_from_rel($relPath);

$dir = dirname($full);
if (!is_dir($dir)) {
    mkdir($dir, 0777, true);
}

move_uploaded_file($tmp, $full);

json_out([
    "ok" => true,
    "path" => $relPath
]);