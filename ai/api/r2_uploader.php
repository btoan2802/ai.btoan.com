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
            'suppress_php_deprecation_warning' => true,
            'credentials' => [
                'key'    => $this->config['access_key'],
                'secret' => $this->config['secret_key'],
            ],
        ]);
    }

    /**
     * Upload dynamic data to R2 Bucket
     * @param mixed  $data   Base64 string or $_FILES element
     * @param string $folder Destination folder
     * @param string $ext    File extension
     * @return string Public URL of the uploaded file
     */
    public function upload($data, $folder = 'uploads', $ext = 'jpg') {
        $fileName = $folder . "/" . bin2hex(random_bytes(16)) . "." . $ext;
        $tempPath = null;
        $contentType = 'image/jpeg';

        if (is_array($data) && isset($data['tmp_name'])) {
            $tempPath = $data['tmp_name'];
            $contentType = mime_content_type($tempPath);
        } else {
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

            if (!is_array($data)) @unlink($tempPath);
            return $this->config['public_url'] . "/" . $fileName;
        } catch (Exception $e) {
            if (!is_array($data)) @unlink($tempPath);
            throw $e;
        }
    }

    /**
     * Upload a local file directly to R2
     */
    public function uploadLocalFile($filePath, $folder = 'uploads', $ext = 'mp4') {
        if (!file_exists($filePath)) throw new Exception("Local file not found: $filePath");
        
        $fileName = $folder . "/" . bin2hex(random_bytes(16)) . "." . $ext;
        
        // Map common extensions to mime types to avoid dependency on fileinfo extension
        $mimeTypes = [
            'mp4' => 'video/mp4',
            'mp3' => 'audio/mpeg',
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'webp' => 'image/webp'
        ];
        
        $contentType = $mimeTypes[strtolower($ext)] ?? 'application/octet-stream';

        try {
            $this->s3->putObject([
                'Bucket'      => $this->config['bucket'],
                'Key'         => $fileName,
                'SourceFile'  => $filePath,
                'ContentType' => $contentType,
            ]);

            return $this->config['public_url'] . "/" . $fileName;
        } catch (Exception $e) {
            throw $e;
        }
    }
}
