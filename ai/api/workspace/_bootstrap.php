<?php
header("Content-Type: application/json; charset=utf-8");

define("WORKSPACE_ROOT", realpath(__DIR__ . "/../../.."));

function json_out($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function normalize_rel_path($path) {
    $path = str_replace("\\", "/", trim((string)$path));
    $path = ltrim($path, "/");
    return $path;
}

function abs_path_from_rel($rel) {
    $rel = normalize_rel_path($rel);

    if ($rel === "") {
        return WORKSPACE_ROOT;
    }

    $full = WORKSPACE_ROOT . "/" . $rel;
    $dir = realpath(dirname($full));

    if ($dir === false || strpos($dir, WORKSPACE_ROOT) !== 0) {
        json_out(["error" => "Đường dẫn không hợp lệ"], 400);
    }

    return $full;
}

function is_hidden_name($name) {
    return $name !== "" && $name[0] === ".";
}

function is_allowed_text_file($path) {
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    $allowed = ["php", "js", "css", "html", "json", "md", "txt", "sql", "xml"];
    return in_array($ext, $allowed, true);
}

function skip_name($name) {
    $skip = [".git", "vendor", "node_modules", "uploads"];
    return in_array($name, $skip, true);
}