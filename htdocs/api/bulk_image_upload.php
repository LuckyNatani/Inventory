<?php
require_once '../config/session_config.php';
require_once '../config/db_connect.php';

header('Content-Type: application/json');

// Permission Check
$role_string = $_SESSION['role'] ?? '';
$user_roles = explode(',', $role_string);
if (empty(array_intersect($user_roles, ['admin', 'sub-admin', 'production']))) {
    http_response_code(403);
    echo json_encode(['error' => 'Permission denied']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$sku = $_POST['sku'] ?? '';
if (empty($sku)) {
    echo json_encode(['success' => false, 'error' => 'Could not determine SKU from filename']);
    exit;
}

if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['success' => false, 'error' => 'Upload failed or no file']);
    exit;
}

// Function to process image (Duplicated from inventory.php to be self-contained)
function processImageUpload($tmpName, $sku) {
    if (empty($sku)) return false;
    
    $info = getimagesize($tmpName);
    if (!$info) return false;
    
    $mime = $info['mime'];
    $image = false;
    switch ($mime) {
        case 'image/jpeg': $image = imagecreatefromjpeg($tmpName); break;
        case 'image/png': $image = imagecreatefrompng($tmpName); break;
        case 'image/webp': $image = imagecreatefromwebp($tmpName); break;
        case 'image/gif': $image = imagecreatefromgif($tmpName); break;
    }
    
    if (!$image) return false;
    
    $skuFilename = rawurlencode($sku);
    $targetDir = "../assets/images/products/";
    if (!is_dir($targetDir)) mkdir($targetDir, 0755, true);
    $targetFile = $targetDir . $skuFilename . ".webp";
    
    $width = imagesx($image);
    $height = imagesy($image);
    $maxDim = 1500; 

    if ($width > $maxDim || $height > $maxDim) {
        $ratio = $width / $height;
        if ($width > $height) {
            $newWidth = $maxDim;
            $newHeight = $maxDim / $ratio;
        } else {
            $newHeight = $maxDim;
            $newWidth = $maxDim * $ratio;
        }
        $newImage = imagecreatetruecolor($newWidth, $newHeight);
        
        imagealphablending($newImage, false);
        imagesavealpha($newImage, true);
        imagecopyresampled($newImage, $image, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
        imagedestroy($image);
        $image = $newImage;
    }

    imagewebp($image, $targetFile, 80);
    clearstatcache();
    if (filesize($targetFile) > 500 * 1024) {
        imagewebp($image, $targetFile, 60);
    }
    imagedestroy($image);
    
    return $skuFilename;
}

$processedFilename = processImageUpload($_FILES['image']['tmp_name'], $sku);

if ($processedFilename) {
    // Check if SKU exists in DB
    $check = $mysqli->query("SELECT id FROM inventory WHERE sku = '$sku'");
    if ($check && $check->num_rows > 0) {
        // Update DB
        $stmt = $mysqli->prepare("UPDATE inventory SET img1 = ?, updated_at = NOW() WHERE sku = ?");
        $stmt->bind_param("ss", $processedFilename, $sku);
        $stmt->execute();
        
        echo json_encode(['success' => true, 'message' => 'Image updated']);
    } else {
        // Warning: Image saved but SKU not found in DB
        echo json_encode(['success' => true, 'message' => 'Image saved, but SKU not found in inventory list.']);
    }
} else {
    echo json_encode(['success' => false, 'error' => 'Image processing failed']);
}
?>
