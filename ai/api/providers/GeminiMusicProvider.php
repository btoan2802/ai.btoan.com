<?php

class GeminiMusicProvider {
    private $apiKeys;
    private $model;

    public function __construct(array $apiKeys, $model = "lyria-3-clip-preview") {
        $this->apiKeys = $apiKeys;
        $this->model = $model;
    }

    /**
     * Generate music from prompt
     * @param string $prompt
     * @param int $duration Seconds
     * @return string Audio bytes (binary)
     * @throws Exception
     */
    public function generateMusic($prompt, $duration = 30) {
        shuffle($this->apiKeys);
        $lastError = "";

        foreach ($this->apiKeys as $apiKey) {
            try {
                $url = "https://generativelanguage.googleapis.com/v1beta/models/{$this->model}:generateContent?key={$apiKey}";

                $payload = [
                    "contents" => [
                        [
                            "parts" => [
                                ["text" => $prompt]
                            ]
                        ]
                    ],
                    "generationConfig" => [
                        "candidateCount" => 1,
                        "durationSeconds" => (int)$duration
                    ]
                ];

                $ch = curl_init($url);
                curl_setopt_array($ch, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_POST => true,
                    CURLOPT_HTTPHEADER => ["Content-Type: application/json"],
                    CURLOPT_POSTFIELDS => json_encode($payload),
                    CURLOPT_TIMEOUT => 120,
                ]);

                $response = curl_exec($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $curlError = curl_error($ch);
                curl_close($ch);

                if ($response === false) {
                    $lastError = "Curl error: $curlError";
                    continue;
                }

                $data = json_decode($response, true);
                if (!$data) {
                    $lastError = "Invalid JSON response";
                    continue;
                }

                if ($httpCode !== 200) {
                    $lastError = "API Error ($httpCode): " . ($data['error']['message'] ?? $response);
                    continue;
                }

                // Check for audio in candidates
                if (isset($data['candidates'][0]['content']['parts'])) {
                    foreach ($data['candidates'][0]['content']['parts'] as $part) {
                        if (isset($part['inlineData']['data'])) {
                            return base64_decode($part['inlineData']['data']);
                        }
                    }
                }

                $lastError = "No audio data found in response";

            } catch (Exception $e) {
                $lastError = $e->getMessage();
                continue;
            }
        }

        throw new Exception("Music generation failed: " . $lastError);
    }
}
