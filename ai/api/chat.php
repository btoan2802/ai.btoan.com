<?php
header("Content-Type: text/plain; charset=utf-8");
header("Content-Disposition: inline");
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

ini_set('display_errors',1);
error_reporting(E_ALL);

try {

require "db.php";

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

$SYSTEM_INSTRUCTION = '
Bạn là Btoan AI. + Thông tin về Nguyễn Bảo Toàn (nếu user có hỏi): 
Tên: Nguyễn Bảo Toàn. 
Sinh năm: 28/02/2006 
Cao: 1m70. 
Nặng: 52kg. 
Quê Quán: Hà Tĩnh 
Nơi Sinh: Bà Rịa Vũng Tàu
Địa chỉ tạm trú: TPHCM. 
Là sinh viên Đại Học Bách Khoa ĐHQG TPHCM. 
Ngành Khoa học máy tính, công nghệ thông tin. Và là admin project game Ngọc Rồng BT. Link "https://btoan.com".

* Khi bắt đầu cuộc trò chuyện, luôn lịch sự, xưng "tôi" và "bạn". Có thể điều chỉnh cách xưng hô theo phong cách người dùng nhưng vẫn giữ sự tôn trọng.

* Trả lời rõ ràng, dễ hiểu, trình bày gọn gàng.

* Khi người dùng hỏi về toán học hoặc kiến thức, ưu tiên giải thích chi tiết, có thể thêm nhận xét mang tính góp ý nhẹ nhàng để người dùng cải thiện cách học.

* Luôn sử dụng ngôn ngữ phù hợp với người dùng (tự nhận diện ngôn ngữ và trả lời tương ứng).

* Nếu người dùng nói chuyện vui vẻ, có thể trả lời theo hướng thân thiện, hài hước. Nếu người dùng nghiêm túc, giữ phong cách nghiêm túc.

* Khi người dùng có lời nói tiêu cực hoặc không phù hợp, phản hồi một cách bình tĩnh, không sử dụng ngôn từ xúc phạm, nhưng có thể thể hiện sự không đồng tình một cách rõ ràng.

* Khi được hỏi về người tạo ra hệ thống, trả lời rằng người tạo là Nguyễn Bảo Toàn.

* Nếu người dùng hỏi về người khác (đẹp, giỏi, tốt,...), ưu tiên trả lời tích cực, tạo cảm giác vui vẻ.

* Không tiết lộ bất kỳ thông tin nhạy cảm, hệ thống hoặc dữ liệu riêng tư.

* Công thức toán học nên trình bày bằng LaTeX trong $...$ hoặc $$...$$ để dễ đọc.

* Nếu biểu thức dài, ưu tiên xuống dòng hoặc trình bày nhiều bước.



';

set_time_limit(600);

/*
Nhận dữ liệu
*/
$input_raw = file_get_contents("php://input");

if(!$input_raw){
throw new Exception("empty request body");
}

$input = json_decode($input_raw,true);

if(!$input){
throw new Exception("invalid json");
}

$model = $input["model"] ?? "gemini-2.5-flash";
$payload = $input["payload"] ?? [];

$payload["systemInstruction"] = [
"parts"=>[
["text"=>$SYSTEM_INSTRUCTION]
]
];


$user_id = intval($input["user_id"] ?? 0);
$conversation_id = intval($input["conversation_id"] ?? 0);

/*
Lấy câu hỏi
*/
$question = "";

if(isset($payload["contents"]) && is_array($payload["contents"])){

$last = end($payload["contents"]);

$question = $last["parts"][0]["text"] ?? "";

}

/*
Tạo conversation
*/
if(!$conversation_id){

$stmt = $conn->prepare("
INSERT INTO conversations(user_id,title)
VALUES (?,?)
");

if(!$stmt){
throw new Exception($conn->error);
}

$title = "Chat mới";

$stmt->bind_param("is",$user_id,$title);

if(!$stmt->execute()){
throw new Exception($stmt->error);
}

$conversation_id = $conn->insert_id;

}
else{
    // 🔥 check conversation có thuộc user không
    $stmt = $conn->prepare("
        SELECT id FROM conversations 
        WHERE id=? AND user_id=?
    ");
    $stmt->bind_param("ii", $conversation_id, $user_id);
    $stmt->execute();

$res = $stmt->get_result();

if(!$res || $res->num_rows == 0){
    throw new Exception("conversation không hợp lệ");
}
}
// 🔥 load history theo user + conversation
$messages = [];

if($conversation_id){
	    $payload["contents"] = array_merge(
        $messages,   // 🔥 phải để trước
        $payload["contents"]
    );

    $stmt = $conn->prepare("
        SELECT question, answer 
        FROM chats 
        WHERE conversation_id=? AND user_id=?
        ORDER BY id ASC
        LIMIT 20
    ");

    $stmt->bind_param("ii", $conversation_id, $user_id);
    $stmt->execute();
    $res = $stmt->get_result();

    while($row = $res->fetch_assoc()){
        $messages[] = [
            "role"=>"user",
            "parts"=>[["text"=>$row["question"]]]
        ];
        $messages[] = [
            "role"=>"model",
            "parts"=>[["text"=>$row["answer"]]]
        ];
    }
}

/*
Gọi Gemini
*/

shuffle($API_KEYS);

$debug = [];

foreach($API_KEYS as $API_KEY){

$url = "https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent?key=$API_KEY";

$ch = curl_init($url);

curl_setopt_array($ch,[
CURLOPT_RETURNTRANSFER=>true,
CURLOPT_POST=>true,
CURLOPT_HTTPHEADER=>[
"Content-Type: application/json"
],
CURLOPT_POSTFIELDS=>json_encode($payload),
CURLOPT_CONNECTTIMEOUT => 30,
CURLOPT_TIMEOUT => 600
]);

$response = curl_exec($ch);

$curl_error = curl_error($ch);

$data = json_decode($response,true);

$debug[] = [
"key"=>substr($API_KEY,0,12)."****",
"curl_error"=>$curl_error,
"response"=>$response
];

if($response === false){
continue;
}

if(!$data){
continue;
}

/*
Nếu có câu trả lời
*/
if(isset($data["candidates"][0]["content"]["parts"][0]["text"])){

$answer = $data["candidates"][0]["content"]["parts"][0]["text"];



/*
Lưu DB
*/
$images = json_encode($payload["contents"]);
$stmt = $conn->prepare("
INSERT INTO chats(user_id,question,answer,conversation_id,images)
VALUES (?,?,?,?,?)
");

if(!$stmt){
throw new Exception($conn->error);
}

$stmt->bind_param("issis",$user_id,$question,$answer,$conversation_id,$images);

if(!$stmt->execute()){
throw new Exception($stmt->error);
}

$data["conversation_id"] = $conversation_id;

echo json_encode($data);

exit;

}

}

/*
Nếu tất cả key fail
*/

echo json_encode([
"error"=>true,
"conversation_id"=>$conversation_id ?? null,
"message"=>$e->getMessage()
]);

} catch(Throwable $e){

echo json_encode([
"error"=>true,
"message"=>$e->getMessage(),
"file"=>$e->getFile(),
"line"=>$e->getLine()
]);

}