<?php
require __DIR__ . "/_bootstrap.php";

$zipName = "workspace_user_" . date("Ymd_His") . ".zip";
$tmpZip = sys_get_temp_dir() . "/" . uniqid("ws_", true) . ".zip";

$zip = new ZipArchive();
if ($zip->open($tmpZip, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
    http_response_code(500);
    exit("Không tạo được file zip");
}

$rootLen = strlen(WORKSPACE_ROOT) + 1;

$iterator = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator(WORKSPACE_ROOT, FilesystemIterator::SKIP_DOTS),
    RecursiveIteratorIterator::SELF_FIRST
);

foreach ($iterator as $file) {
    $fullPath = $file->getPathname();
    $relPath = str_replace("\\", "/", substr($fullPath, $rootLen));

    if ($file->isDir()) {
        $zip->addEmptyDir($relPath);
    } else {
        $zip->addFile($fullPath, $relPath);
    }
}

$zip->close();

header("Content-Type: application/zip");
header('Content-Disposition: attachment; filename="' . $zipName . '"');
header("Content-Length: " . filesize($tmpZip));

readfile($tmpZip);
unlink($tmpZip);
exit;