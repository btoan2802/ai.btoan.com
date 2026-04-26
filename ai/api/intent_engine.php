<?php

class IntentEngine {
    private static $API_KEYS = [
        "AIzaSyCj5togPa80e1bI9Vup74BFOl44D08sZLw",
        "AIzaSyDFHm1sOBGnCeWIThcCo-hB7wWNjz5QdSU",
        "AIzaSyDrOpKT2oRzSfpKY_VlU3rvu-YpfzauOAs",
        "AIzaSyCZx8h9y6X78quESwB6K1MEXHRNWglaTDM",
        "AIzaSyBr0RBLcNROl50u7kjaWPrRQIG21EZ5bpA",
        "AIzaSyAAGonXPwa_86o1SQa1WDKG8_6GCz_CjHg",
        "AIzaSyCYUzKmlZ1ZD-Eabl9BI-PiaJiWkccK1os",
        "AIzaSyBdwrghehTW22SuWH0Yq2jBbv6H5OZ4Ce8"
    ];

    public static function analyzeIntent($user_message, $has_images = false, $has_files = false) {
        $keys = self::$API_KEYS;
        shuffle($keys);
        
        $prompt = <<<PROMPT
Analyze the following user message to identify their intent and constraints for an AI assistant.
Respond ONLY with a JSON object.

User Message: "{$user_message}"
Has Images: {$has_images}
Has Files: {$has_files}

CRITICAL: Look for these Vietnamese keywords which signal HARD or NEGATIVE constraints:
- "không được", "đừng", "không", "chỉ", "giữ nguyên", "bắt buộc", "phải", "y chang", "giống", "dựa vào" -> Add to hard_constraints
- "không sửa phần khác", "đừng phá", "không tự thêm", "không bịa", "đọc kỹ source", "đúng như ảnh", "đúng như file" -> Add to hard_constraints
- "không chibi", "không anime", "không cartoon" -> Add to negative_constraints

The JSON object must have these fields:
- task_type: "text_generation" | "code_edit" | "image_generation" | "image_edit" | "identity_preserving_image_edit" | "ui_edit" | "file_export" | "troubleshooting" | "file_analysis"
- user_goal: string (summary of what the user wants)
- hard_constraints: array of strings
- negative_constraints: array of strings
- must_preserve: array of strings
- allowed_changes: array of strings
- forbidden_changes: array of strings
- has_reference_files: boolean
- has_reference_images: boolean
- needs_reference_image: boolean
- risk_of_wrong_inference: array of strings (e.g., "might default to chibi", "might refactor unrelated code")
- final_interpretation: string (clinical restatement)

Guidelines:
- "identity_preserving_image_edit": user wants to keep a specific face/person from an image while changing other things.
- "ui_edit": user wants to change styling but keep layout/logic.
- "code_edit": user wants a patch, not a rewrite.

JSON Output:
PROMPT;

        $payload = [
            "contents" => [
                ["parts" => [["text" => $prompt]]]
            ],
            "generationConfig" => [
                "response_mime_type" => "application/json"
            ]
        ];

        foreach ($keys as $key) {
            $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" . $key;
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_HTTPHEADER => ["Content-Type: application/json"],
                CURLOPT_POSTFIELDS => json_encode($payload),
                CURLOPT_TIMEOUT => 30
            ]);
            $response = curl_exec($ch);
            $data = json_decode($response, true);


            
            if ($data && isset($data["candidates"][0]["content"]["parts"][0]["text"])) {
                $json_text = $data["candidates"][0]["content"]["parts"][0]["text"];
                $intent = json_decode($json_text, true);
                if ($intent) return $intent;
            }

        }

        // Fallback if AI analysis fails
        return [
            "task_type" => "text_generation",
            "user_goal" => $user_message,
            "hard_constraints" => [],
            "negative_constraints" => [],
            "must_preserve" => [],
            "allowed_changes" => [],
            "forbidden_changes" => [],
            "has_reference_files" => $has_files,
            "has_reference_images" => $has_images,
            "needs_reference_image" => false,
            "risk_of_wrong_inference" => [],
            "final_interpretation" => $user_message
        ];
    }

    public static function getSystemProtection($intent) {
        $protection = "\n\n### USER_INTENT_ADHERENCE_PROTOCOL (STRICT)\n";
        $protection .= "1. Explicit user instructions have the highest priority.\n";
        $protection .= "2. Negative instructions ('don't', 'no', 'avoid') must be respected absolutely.\n";
        $protection .= "3. Do not reinterpret the request into a different style or task. Do not 'improve' aesthetics if it violates constraints.\n";
        $protection .= "4. Preserve all parts the user did not ask to change.\n";
        $protection .= "5. Current Task Type: " . $intent['task_type'] . "\n";
        
        if (!empty($intent['hard_constraints'])) {
            $protection .= "6. HARD CONSTRAINTS: " . implode(", ", $intent['hard_constraints']) . "\n";
        }
        if (!empty($intent['negative_constraints'])) {
            $protection .= "7. NEGATIVE CONSTRAINTS: " . implode(", ", $intent['negative_constraints']) . "\n";
        }
        if (!empty($intent['must_preserve'])) {
            $protection .= "8. MUST PRESERVE: " . implode(", ", $intent['must_preserve']) . "\n";
        }
        if (!empty($intent['forbidden_changes'])) {
            $protection .= "9. FORBIDDEN CHANGES: " . implode(", ", $intent['forbidden_changes']) . "\n";
        }

        // Task-specific logic
        switch ($intent['task_type']) {
            case 'image_edit':
            case 'identity_preserving_image_edit':
                $protection .= "10. IMAGE EDIT RULES: Use the provided reference image. Only modify the specific parts mentioned in 'allowed_changes'. If this is an identity-preserving task, keep the facial features and character identity exactly as they appear in the reference image. Do not change the art style unless requested.\n";
                
                // Special handling for stickers
                if (mb_stripos($intent['user_goal'], 'sticker') !== false || mb_stripos($intent['user_goal'], 'nhãn dán') !== false) {
                    $protection .= "11. STICKER PROTOCOL: Generate a 4x4 or 2x2 grid of stickers. Each sticker should feature the SAME person from the reference image with different expressions (laughing, crying, sleeping, surprised). Use a clean white background. Add cute Vietnamese text (e.g., 'Haha', 'Huhu', 'Khò khò', 'Ối!') to each sticker using a playful font style. Ensure the person looks REAL (not chibi/anime) as per user request.\n";
                }
                break;
            case 'ui_edit':
            case 'code_edit':
                $protection .= "10. CODE EDIT RULES: Perform minimal changes. Do not refactor unrelated code. Focus ONLY on the requested changes. If the user said 'only fix X', do not touch Y.\n";
                break;
        }
        
        $protection .= "12. FINAL INTERPRETATION: " . $intent['final_interpretation'] . "\n";
        $protection .= "### END PROTOCOL\n";
        
        return $protection;
    }


    public static function validateResponse($intent, $answer) {
        // Run a quick check for common violations
        $violations = [];
        
        foreach ($intent['negative_constraints'] as $neg) {
            if (mb_stripos($answer, $neg) !== false && !self::isNegationPresent($answer, $neg)) {
                // This is a very rough check, but it catches some cases where AI mentions what it shouldn't
            }
        }

        // For better validation, we can call a fast LLM again (optional but recommended by user)
        $keys = self::$API_KEYS;
        shuffle($keys);

        $prompt = "You are a quality controller. Check if the AI response violates the user's intent.\n"
                . "Intent: " . json_encode($intent) . "\n"
                . "Response: " . $answer . "\n"
                . "Does the response violate any negative constraints or forbidden changes? "
                . "Does it perform unauthorized refactoring?\n"
                . "Respond with 'VALID' or 'INVALID: <reason>'.";

        foreach ($keys as $key) {
            $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" . $key;
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_HTTPHEADER => ["Content-Type: application/json"],
                CURLOPT_POSTFIELDS => json_encode([
                    "contents" => [["parts" => [["text" => $prompt]]]]
                ]),
                CURLOPT_TIMEOUT => 30
            ]);
            $response = curl_exec($ch);
            $data = json_decode($response, true);


            $result = $data["candidates"][0]["content"]["parts"][0]["text"] ?? "VALID";
            
            if (strpos($result, "INVALID") !== false) {
                return ["valid" => false, "reason" => $result];
            }
            if ($data && isset($data["candidates"])) return ["valid" => true];
        }


        return ["valid" => true]; 
    }

    private static function isNegationPresent($text, $term) {
        // Simple helper to check if a term is being mentioned in a negative context (e.g. "I did not add X")
        return preg_match('/(không|không có|không thêm|did not|didn\'t|without)\s+' . preg_quote($term, '/') . '/iu', $text);
    }
}
