<?php
require_once __DIR__ . "/../../vendor/autoload.php";
use Aws\S3\S3Client;

class R2Uploader {
    private $s3;
    private $config;

    public function __construct() {
        $this->config = require __DIR__ . "/r2_config.php";
        
        $this->s3 = new S3Client([
            'version' => 'latest',
            'region' => 'auto',
            'endpoint' => $this->config['endpoint'],
            'credentials' => [
                'key'    => $this->config['access_key'],
                'secret' => $this->config['secret_key'],
            ],
        ]);
    }

    /**
     * Upload dynamic data to R2 Bucket
     * @param mixed  $data   Base64 string or $_FILES element
     * @param string $folder Destination folder (e.g., 'avatars', 'faces')
     * @param string $ext    File extension
     * @return string Public URL of the uploaded file
     */
    public function upload($data, $folder = 'uploads', $ext = 'jpg') {
        $fileName = $folder . "/" . bin2hex(random_bytes(16)) . "." . $ext;
        $tempPath = null;
        $contentType = 'image/jpeg';

        if (is_array($data) && isset($data['tmp_name'])) {
            // Handle $_FILES
            $tempPath = $data['tmp_name'];
            $contentType = mime_content_type($tempPath);
        } else {
            // Handle Base64 String
            $base64Data = preg_replace('/^data:image\/\w+;base64,/', '', $data);
            $binary = base64_decode($base64Data);
            if (!$binary) throw new Exception("Invalid Base64 data");
            
            $tempPath = tempnam(sys_get_temp_dir(), 'r2_');
            file_put_contents($tempPath, $binary);
            $contentType = 'image/' . $ext;
        }

        try {
            $this->s3->putObject([
                'Bucket'      => $this->config['bucket'],
                'Key'         => $fileName,
                'SourceFile'  => $tempPath,
                'ContentType' => $contentType,
            ]);

            // Cleanup temp file if created from base64
            if (!is_array($data)) @unlink($tempPath);

            return $this->config['public_url'] . "/" . $fileName;
        } catch (Exception $e) {
            if (!is_array($data)) @unlink($tempPath);
            throw $e;
        }
    }
}
