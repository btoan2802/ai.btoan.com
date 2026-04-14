<?php
require __DIR__ . "/_bootstrap.php";

if (empty($_FILES["files"])) {
    json_out(["error" => "Chưa có folder upload"], 400);
}

$names = $_FILES["files"]["name"];
$tmpNames = $_FILES["files"]["tmp_name"];
$errors = $_FILES["files"]["error"];

$count = is_array($names) ? count($names) : 0;
if ($count === 0) {
    json_out(["error" => "Không có file nào trong folder"], 400);
}

for ($i = 0; $i < $count; $i++) {
    if (($errors[$i] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
        continue;
    }

    $relPath = normalize_rel_path($names[$i]);
    if ($relPath === "") continue;

    $full = abs_path_from_rel($relPath);
    $dir = dirname($full);

    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }

    move_uploaded_file($tmpNames[$i], $full);
}

json_out(["ok" => true]);