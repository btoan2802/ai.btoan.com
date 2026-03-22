<?php
header("Content-Type: application/json");

$q = $_GET["q"] ?? "";

if(!$q){
    echo json_encode(["results"=>[]]);
    exit;
}

// 🔥 dán API KEY của bạn vào đây
$apiKey = "b0d12f2275d3391d7c8403de765e2eaaf5e0454e0289114973cff5909b26466f";

// 🔥 URL chuẩn
$url = "https://serpapi.com/search.json?engine=google&q=" 
    . urlencode($q) 
    . "&hl=vi"
    . "&api_key=" . $apiKey;

$res = file_get_contents($url);

if(!$res){
    echo json_encode(["results"=>[]]);
    exit;
}

$data = json_decode($res, true);

$results = [];

if(!empty($data["organic_results"])){

    foreach($data["organic_results"] as $item){

        $results[] = [
            "title"=>$item["title"] ?? "",
            "snippet"=>$item["snippet"] ?? ""
        ];

        if(count($results) >= 5) break;
    }
}

echo json_encode([
    "results"=>$results
]);