<?php
/**
 * PHP Download Proxy for Btoan AI
 * Bypasses CORS and forces download of cross-origin files (videos/images)
 */

if (!isset($_GET['url'])) {
    die("Missing URL");
}

$url = $_GET['url'];
$filename = isset($_GET['filename']) ? $_GET['filename'] : 'downloaded_file';

// Basic security check: ensure it's a URL and from trusted source (optional but recommended)
if (!filter_var($url, FILTER_VALIDATE_URL)) {
    die("Invalid URL");
}

// Set headers for download
header('Content-Description: File Transfer');
header('Content-Type: application/octet-stream');
header('Content-Disposition: attachment; filename="' . basename($filename) . '"');
header('Expires: 0');
header('Cache-Control: must-revalidate');
header('Pragma: public');

// Stream the file content directly
$ctx = stream_context_create([
    'http' => [
        'header' => "User-Agent: BtoanAI-Downloader/1.0\r\n"
    ],
    'ssl' => [
        'verify_peer' => false,
        'verify_peer_name' => false,
    ]
]);

$handle = fopen($url, 'rb', false, $ctx);
if ($handle) {
    while (!feof($handle)) {
        echo fread($handle, 8192);
        flush();
    }
    fclose($handle);
} else {
    header("HTTP/1.0 404 Not Found");
    echo "Could not open source file.";
}
exit;
