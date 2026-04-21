<?php
header("Content-Type: application/json");
require "db.php";

$data = json_decode(file_get_contents("php://input"), true);
$userText = $data["text"] ?? "";

if (!$userText) {
    echo json_encode(["intent" => "chat"]);
    exit;
}

$API_KEYS = [
    "AIzaSyCj5togPa80e1bI9Vup74BFOl44D08sZLw",
    "AIzaSyDFHm1sOBGnCeWIThcCo-hB7wWNjz5QdSU",
    "AIzaSyDrOpKT2oRzSfpKY_VlU3rvu-YpfzauOAs",
    "AIzaSyCZx8h9y6X78quESwB6K1MEXHRNWglaTDM",
    "AIzaSyBr0RBLcNROl50u7kjaWPrRQIG21EZ5bpA",
    "AIzaSyAAGonXPwa_86o1SQa1WDKG8_6GCz_CjHg",
    "AIzaSyCYUzKmlZ1ZD-Eabl9BI-PiaJiWkccK1os",
    "AIzaSyBdwrghehTW22SuWH0Yq2jBbv6H5OZ4Ce8"
];
shuffle($API_KEYS);

$prompt = "Classify the following user request into exactly one of these categories: 
- 'visual_exact_chart' (if asking for charts, bars, pies, data visualization)
- 'visual_exact_geometry' (if asking for math diagrams, geometry drawings, shapes)
- 'visual_exact_function_plot' (if asking for mathematical function graphs, coordinate plots)
- 'chat' (for everything else)

Respond with ONLY the category name.
Request: \"$userText\"";

$payload = [
    "contents" => [
        ["role" => "user", "parts" => [["text" => $prompt]]]
    ],
    "generationConfig" => [
        "temperature" => 0.1,
        "maxOutputTokens" => 20
    ]
];

foreach ($API_KEYS as $key) {
    $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$key";
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ["Content-Type: application/json"],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_TIMEOUT => 5
    ]);
    $response = curl_exec($ch);
    $resData = json_decode($response, true);
    $text = trim($resData["candidates"][0]["content"]["parts"][0]["text"] ?? "");
    
    if ($text) {
        // Simple cleanup
        $text = strtolower($text);
        if (strpos($text, "chart") !== false) $intent = "visual_exact_chart";
        else if (strpos($text, "geometry") !== false) $intent = "visual_exact_geometry";
        else if (strpos($text, "plot") !== false) $intent = "visual_exact_function_plot";
        else $intent = "chat";
        
        echo json_encode(["intent" => $intent]);
        exit;
    }
}

echo json_encode(["intent" => "chat"]);
