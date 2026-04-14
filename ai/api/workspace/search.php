<?php
require __DIR__ . "/_bootstrap.php";

$q = trim($_GET["q"] ?? "");
if ($q === "") {
    json_out(["items" => []]);
}

$result = [];

$iterator = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator(WORKSPACE_ROOT, FilesystemIterator::SKIP_DOTS)
);

foreach ($iterator as $file) {
    $name = $file->getFilename();

    if (is_hidden_name($name) || skip_name($name)) continue;
    if (!$file->isFile()) continue;
    if (!is_allowed_text_file($file->getPathname())) continue;

    $content = @file_get_contents($file->getPathname());
    if ($content === false) continue;

    $pos = mb_stripos($content, $q);
    if ($pos === false) continue;

    $start = max(0, $pos - 80);
    $snippet = mb_substr($content, $start, 180);

    $rel = str_replace("\\", "/", substr($file->getPathname(), strlen(WORKSPACE_ROOT) + 1));

    $result[] = [
        "path" => $rel,
        "snippet" => $snippet
    ];

    if (count($result) >= 50) break;
}

json_out([
    "items" => $result
]);