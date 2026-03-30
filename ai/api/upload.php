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

        // font mặc định đẹp hơn Word
        $phpWord->setDefaultFontName('Times New Roman');
        $phpWord->setDefaultFontSize(13);

        $section = $phpWord->addSection([
            'marginTop' => 1200,
            'marginBottom' => 1200,
            'marginLeft' => 1400,
            'marginRight' => 1400
        ]);

        // chuẩn hóa xuống dòng
        $content = str_replace(["\r\n", "\r"], "\n", $content);
        $content = trim($content);

        // style đoạn văn thường
        $paragraphStyle = [
            'spaceAfter' => 180,
            'lineHeight' => 1.35
        ];

        // style dòng thơ
        $poemLineStyle = [
            'spaceAfter' => 0,
            'lineHeight' => 1.15
        ];

        // tách theo khối rỗng: mỗi khối là 1 đoạn / 1 khổ thơ
        $blocks = preg_split("/\n\s*\n/u", $content);

        foreach($blocks as $block){
            $block = trim($block);
            if($block === '') continue;

            $lines = preg_split("/\n/u", $block);

            // nếu 1 block có nhiều dòng => coi như thơ / nội dung xuống dòng
            if(count($lines) > 1){

                foreach($lines as $line){
                    $line = trim($line);

                    if($line === ''){
                        continue;
                    }

                    $section->addText($line, [], $poemLineStyle);
                }

                // cách giữa các khổ
                $section->addTextBreak(1);

            }else{
                // đoạn văn bình thường
                $section->addText($block, [], $paragraphStyle);
            }
        }

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