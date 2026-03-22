<?php
require __DIR__ . '/../../vendor/autoload.php';

function normalizeMarkdown($text){

    // 🔥 fix bullet *
    $text = preg_replace('/^\*\s+/m', '- ', $text);

    // 🔥 fix bold **text**
    $text = preg_replace('/\*\*(.*?)\*\*/', '<strong>$1</strong>', $text);

    // 🔥 fix tiêu đề dạng **1. abc**
    $text = preg_replace('/\*\*(\d+\..*?)\*\*/', '<h3>$1</h3>', $text);

    // 🔥 remove dấu *** thừa
    $text = str_replace('***', '', $text);

    return $text;
}

// 🔥 chống warning phá JSON
error_reporting(E_ALL & ~E_DEPRECATED & ~E_WARNING);
ini_set('display_errors', 0);
ini_set('log_errors', 0);
header('Content-Type: application/json');

use Dompdf\Dompdf;
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\IOFactory;
use PhpOffice\PhpWord\Shared\Html;

// ===== INPUT =====
$data = json_decode(file_get_contents("php://input"), true);

$content = $data['content'] ?? '';
$ext = strtolower($data['ext'] ?? 'txt');

// 🔥 đảm bảo content luôn là string
if(!is_string($content)){
    $content = "";
}

$content = trim($content);

// 🔥 check rỗng
if($content === ''){
    echo json_encode(["error"=>"no content"]);
    exit;
}

// ===== FILE NAME =====
$filename = "file_" . time();

$dir = "../files/";
if(!is_dir($dir)){
    mkdir($dir, 0777, true);
}

// ==========================
// ===== DOCX EXPORT ========
// ==========================
if($ext === "docx"){

    ob_start();

    try{

        $phpWord = new PhpWord();

        // 🔥 style mặc định
        $phpWord->setDefaultFontName('Arial');
        $phpWord->setDefaultFontSize(12);

        $section = $phpWord->addSection([
            'marginTop' => 800,
            'marginBottom' => 800,
            'marginLeft' => 800,
            'marginRight' => 800
        ]);

        // ===== markdown → HTML =====
        $Parsedown = new Parsedown();
        $content = normalizeMarkdown($content);

        $Parsedown = new Parsedown();
        $Parsedown->setSafeMode(true);

        $html = $Parsedown->text($content);

        // ===== FIX HTML cho Word =====
        $html = preg_replace('/<ul>/', '<ul style="margin-left:20px;">', $html);
        $html = preg_replace('/<li>/', '<li style="margin-bottom:5px;">', $html);

        // 🔥 heading đẹp hơn
        $html = preg_replace('/<h1>/', '<h1 style="font-size:20px; font-weight:bold;">', $html);
        $html = preg_replace('/<h2>/', '<h2 style="font-size:18px; font-weight:bold;">', $html);
        $html = preg_replace('/<h3>/', '<h3 style="font-size:16px; font-weight:bold;">', $html);

        // ===== wrap HTML =====
        $html = "
        <div style='font-family:Arial; font-size:12px; line-height:1.6'>
            {$html}
        </div>
        ";

        libxml_use_internal_errors(true);
        Html::addHtml($section, $html, false, false);

        $filePath = $dir . $filename . ".docx";

        $writer = IOFactory::createWriter($phpWord, 'Word2007');
        $writer->save($filePath);

        ob_clean();

        echo json_encode([
            "url" => "/ai/files/" . $filename . ".docx"
        ]);

    }catch(Throwable $e){

        ob_clean();

        echo json_encode([
            "error" => "docx failed",
            "msg" => $e->getMessage()
        ]);
    }

    exit;
}


// ==========================
// ===== PDF EXPORT =========
// ==========================
if($ext === "pdf"){

    ob_start();

    try{

        require_once __DIR__ . '/../../vendor/autoload.php';

        $dompdf = new Dompdf();

        // ===== markdown → HTML =====
        $Parsedown = new Parsedown();
        $Parsedown->setSafeMode(true);

        // 🔥 normalize giống DOCX
        $content = normalizeMarkdown($content);

        $html = $Parsedown->text($content);

        // ===== style đẹp =====
        $html = "
        <style>
            body{
                font-family: DejaVu Sans;
                font-size: 14px;
                line-height: 1.6;
            }
            h1{font-size:22px}
            h2{font-size:18px}
            h3{font-size:16px}
            ul{margin-left:20px}
            li{margin-bottom:5px}
        </style>
        <body>
            {$html}
        </body>
        ";

        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->setPaper('A4', 'portrait');

        $dompdf->render();

        $filePath = $dir . $filename . ".pdf";
        file_put_contents($filePath, $dompdf->output());

        ob_clean();

        echo json_encode([
            "url" => "/ai/files/" . $filename . ".pdf"
        ]);

    }catch(Throwable $e){

        ob_clean();

        echo json_encode([
            "error" => "pdf failed",
            "msg" => $e->getMessage()
        ]);
    }

    exit;
}
// ==========================
// ===== TXT EXPORT =========
// ==========================
if($ext === "txt"){

    $filePath = $dir . $filename . ".txt";
    file_put_contents($filePath, "\xEF\xBB\xBF" . $content);

    echo json_encode([
        "url" => "/ai/files/" . $filename . ".txt"
    ]);
    exit;
}

// ==========================
// ===== HTML FALLBACK ======
// ==========================
$filePath = $dir . $filename . ".html";

// 🔥 escape nhẹ để tránh lỗi hiển thị
$html = nl2br($content);

file_put_contents($filePath, "
<html>
<meta charset='UTF-8'>
<body style='font-family: Arial; padding:20px; line-height:1.6'>
{$html}
</body>
</html>
");

echo json_encode([
    "url" => "/ai/files/" . $filename . ".html"
]);