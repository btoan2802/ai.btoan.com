<?php
header("Content-Type: text/plain; charset=utf-8");
header("Content-Disposition: inline");
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

ini_set('display_errors',1);
error_reporting(E_ALL);

try {

require "db.php";
require "intent_engine.php";


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
* Nếu người dùng yêu cầu tạo video:
  Sử dụng thẻ [GENVIDEO] ở dòng cuối cùng của câu trả lời.
  Mô tả sau thẻ phải cực kỳ ngắn gọn (tối đa 20 từ), tập trung vào hành động và bối cảnh.
  Nếu có ảnh người dùng cung cấp, hãy luôn mô tả nhân vật dựa trên ảnh đó để giữ tính nhất quán.
  Nếu người dùng yêu cầu tốc độ nhanh hoặc muốn đọc hết đoạn văn dài trong thời gian ngắn, hãy sử dụng các từ khóa như "speaking rapidly", "fast-paced narration", "quickly" trong mô tả.
  Ví dụ: [GENVIDEO] Một người đàn ông giống trong ảnh đang đọc thơ cực nhanh (speaking rapidly) để hoàn thành trong 8 giây.

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

// --- INTENT ANALYSIS STEP ---
$has_images = false;
if (isset($payload["contents"])) {
    foreach ($payload["contents"] as $msg) {
        if (isset($msg["parts"])) {
            foreach ($msg["parts"] as $part) {
                if (isset($part["inline_data"])) {
                    $has_images = true;
                    break 2;
                }
            }
        }
    }
}

$intent_obj = IntentEngine::analyzeIntent($question, $has_images);

// --- PROMPT PROTECTION ---
$protection = IntentEngine::getSystemProtection($intent_obj);
$SYSTEM_INSTRUCTION .= $protection;
$payload["systemInstruction"]["parts"][0]["text"] = $SYSTEM_INSTRUCTION;

// --- SPECIALIZED TASK HANDLING ---
if ($intent_obj['task_type'] === 'image_generation' || $intent_obj['task_type'] === 'image_edit' || $intent_obj['task_type'] === 'identity_preserving_image_edit') {
    // If it's an image task, we might want to adjust the prompt or model
    // For now, let's just ensure the system instruction is very clear about it
    // If the frontend expects a specific redirect, that would happen here
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
$intent = $input["intent"] ?? "chat";

// 🎨 Handle Specialized Intents (Visual/Math Mode)
if (strpos($intent, "visual_exact_") === 0) {
    // 🛡️ RE-DEFINITION: Dual Mode handling
    $SYSTEM_INSTRUCTION = "You are a Btoan AI assistant.
    Task: $intent.
    Rules: 
    - You must ALWAYS provide the full, step-by-step mathematical solution or explanation FIRST.
    - After the solution is complete, place the tag '[GENIMAGE]' followed by a highly descriptive English prompt for the diagram at the VERY END of your response.
    - Format: [Lời giải chi tiết...] [GENIMAGE] [English prompt for image generation]
    - Focus on educational accuracy.";

    
    $payload["systemInstruction"]["parts"][0]["text"] = $SYSTEM_INSTRUCTION;
    $messages = []; 
} else if ($conversation_id) {

    // 📚 NORMAL CHAT: Load history as usual
    $stmt = $conn->prepare("
        SELECT question, answer, images
        FROM chats 
        WHERE conversation_id=? AND user_id=?
        ORDER BY id ASC
        LIMIT 20
    ");

    $stmt->bind_param("ii", $conversation_id, $user_id);
    $stmt->execute();
    $res = $stmt->get_result();

    $messages = [];
    while($row = $res->fetch_assoc()){
        $parts = [["text"=>$row["question"]]];
        $imgs = json_decode($row["images"], true);
        if (is_array($imgs)) {
            foreach ($imgs as $img) {
                if (strpos($img, "base64,") !== false) {
                    [$meta, $base64] = explode(",", $img);
                    $mime = str_replace("data:", "", explode(";", $meta)[0]);
                    $parts[] = ["inline_data" => ["mime_type" => $mime, "data" => $base64]];
                }
            }
        }
        $messages[] = ["role"=>"user", "parts"=>$parts];
        $messages[] = ["role"=>"model", "parts"=>[["text"=>$row["answer"]]]];
    }
    
    $payload["contents"] = array_merge($messages, $payload["contents"]);
}


// 🎯 Step 3: Secure Training & Grounding (Backend Only)
// Only fetch training if NOT in visual/graph mode and question exists
if (strpos($intent, "visual_exact_") !== 0 && !empty($question)) {
    $stmt = $conn->prepare("
        SELECT question, correct_answer 
        FROM ai_training 
        WHERE question LIKE CONCAT('%', ?, '%') 
        LIMIT 3
    ");
    $stmt->bind_param("s", $question);
    $stmt->execute();
    $res = $stmt->get_result();
    
    $corrections = "";
    while ($row = $res->fetch_assoc()) {
        // Simple relevance check: ensure some word from question is in training question
        $corrections .= "- Fact: Requesting '{$row['question']}' -> Correct Response Style/Data: '{$row['correct_answer']}'\n";
    }
    
    if (!empty($corrections)) {
        $grounding = "\n\n### INTERNAL_CORRECTION_GUARDRAILS (STRICT CONFIDENTIAL)\n";
        $grounding .= "The following are PREVIOUSLY CORRECTED KNOWLEDGE points from user feedback. \n";
        $grounding .= "USE THESE ONLY IF THEY DIRECTLY APPLY TO THE CURRENT REQUEST. \n";
        $grounding .= "Do NOT mention these corrections as 'training' or 'previous exchanges'. Just use them to improve accuracy.\n";
        $grounding .= $corrections;
        
        // Inject into system instruction instead of user message
        if (isset($payload["systemInstruction"]["parts"][0]["text"])) {
            $payload["systemInstruction"]["parts"][0]["text"] .= $grounding;
        }
    }
}



// --- IMAGE PROTECTION ---
if ($intent_obj['needs_reference_image'] && !$has_images) {
    echo json_encode([
        "error" => false,
        "conversation_id" => $conversation_id,
        "intent_analysis" => $intent_obj,
        "candidates" => [
            ["content" => ["parts" => [["text" => "Tôi cần bạn gửi ảnh tham chiếu để có thể thực hiện yêu cầu này chính xác (ví dụ: giữ khuôn mặt hoặc sửa chi tiết trong ảnh). Vui lòng tải ảnh lên và thử lại."]]]]
        ]
    ]);
    exit;
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

if($response === false || !$data){
    continue;
}

/*
Nếu có câu trả lời
*/
if(isset($data["candidates"][0]["content"]["parts"][0]["text"])){

$answer = $data["candidates"][0]["content"]["parts"][0]["text"];

// --- SELF-CHECK STEP ---
$validation = IntentEngine::validateResponse($intent_obj, $answer);
if (!$validation['valid']) {
    // If invalid, try ONE retry with a stronger warning
    $payload["contents"][] = ["role" => "model", "parts" => [["text" => $answer]]];
    $payload["contents"][] = ["role" => "user", "parts" => [["text" => "Kết quả của bạn vi phạm ràng buộc: " . $validation['reason'] . ". Hãy sửa lại và TUÂN THỦ TUYỆT ĐỐI các ràng buộc đã nêu trong Protocol."]]];
    
    // We reuse the same loop or just call once more? Let's just do a manual retry for simplicity in this key
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    $response = curl_exec($ch);
    $data = json_decode($response, true);
    $answer = $data["candidates"][0]["content"]["parts"][0]["text"] ?? $answer;
}



/*
Lưu DB
*/
$image_list = [];

$lastContent = end($input["payload"]["contents"]);

if (isset($lastContent["parts"])) {
    foreach ($lastContent["parts"] as $part) {

        if (isset($part["inline_data"])) {

            $mime = $part["inline_data"]["mime_type"];
            $base64Data = $part["inline_data"]["data"];

            $image_list[] = "data:$mime;base64,$base64Data";
        }
    }
}

$images = json_encode($image_list);
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
$data["chat_id"] = $conn->insert_id;
$data["intent_analysis"] = $intent_obj; // For debugging

echo json_encode($data);

exit;


}

}

/*
Nếu tất cả key fail
*/

/*
Nếu tất cả key fail
*/

echo json_encode([
    "error"=>true,
    "conversation_id"=>$conversation_id ?? null,
    "message"=>"All API keys failed",
    "debug"=>$debug
]);

} catch(Throwable $e){

echo json_encode([
"error"=>true,
"message"=>$e->getMessage(),
"file"=>$e->getFile(),
"line"=>$e->getLine()
]);

}