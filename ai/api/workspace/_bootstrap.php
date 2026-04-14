<?php
header("Content-Type: application/json; charset=utf-8");
session_start();

$userId = 0;

// 1. Session
if (!empty($_SESSION["user_id"])) {
    $userId = (int)$_SESSION["user_id"];
}

// 2. Header X-User-Id
if ($userId <= 0 && !empty($_SERVER["HTTP_X_USER_ID"])) {
    $userId = (int)$_SERVER["HTTP_X_USER_ID"];
}

// 3. Query string ?user_id=
if ($userId <= 0 && !empty($_GET["user_id"])) {
    $userId = (int)$_GET["user_id"];
}

// 4. POST/form-data
if ($userId <= 0 && !empty($_POST["user_id"])) {
    $userId = (int)$_POST["user_id"];
}

// 5. JSON body
if ($userId <= 0) {
    $raw = file_get_contents("php://input");
    if ($raw) {
        $json = json_decode($raw, true);
        if (is_array($json) && !empty($json["user_id"])) {
            $userId = (int)$json["user_id"];
        }
    }
}

if ($userId <= 0) {
    http_response_code(401);
    echo json_encode(["error" => "Chưa đăng nhập"], JSON_UNESCAPED_UNICODE);
    exit;
}

$projectRoot = dirname(dirname(dirname(__DIR__)));
define("WORKSPACE_BASE", $projectRoot . DIRECTORY_SEPARATOR . "uploads" . DIRECTORY_SEPARATOR . "workspaces");

if (!is_dir(WORKSPACE_BASE)) {
    mkdir(WORKSPACE_BASE, 0777, true);
}

define("WORKSPACE_ROOT", WORKSPACE_BASE . "/user_" . $userId);

if (!is_dir(WORKSPACE_ROOT)) {
    mkdir(WORKSPACE_ROOT, 0777, true);
}

function json_out($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function normalize_rel_path($path) {
    $path = str_replace("\\", "/", trim((string)$path));
    $path = preg_replace('#/+#', '/', $path);
    $path = ltrim($path, "/");
    return $path;
}

function abs_path_from_rel($rel) {
    $rel = normalize_rel_path($rel);

    if ($rel === "") {
        return WORKSPACE_ROOT;
    }

    $full = WORKSPACE_ROOT . "/" . $rel;
    $parent = realpath(dirname($full));

    if ($parent === false) {
        $baseParent = dirname($full);
        if (strpos(str_replace("\\", "/", $baseParent), str_replace("\\", "/", WORKSPACE_ROOT)) !== 0) {
            json_out(["error" => "Đường dẫn không hợp lệ"], 400);
        }
        return $full;
    }

    $parent = str_replace("\\", "/", $parent);
    $root = str_replace("\\", "/", WORKSPACE_ROOT);

    if (strpos($parent, $root) !== 0) {
        json_out(["error" => "Đường dẫn không hợp lệ"], 400);
    }

    return $full;
}

function is_hidden_name($name) {
    return $name !== "" && $name[0] === ".";
}

function is_allowed_text_file($path) {
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    $allowed = ["php", "js", "css", "html", "json", "md", "txt", "sql", "xml", "py", "java", "cpp", "c", "cs", "ts", "tsx", "jsx", "yml", "yaml"];
    return in_array($ext, $allowed, true);
}

function skip_name($name) {
    $skip = [".git", "vendor", "node_modules"];
    return in_array($name, $skip, true);
}