<?php
ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
ini_set('html_errors', '0');
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);
// Log para debug
file_put_contents('../logs/php_errors.log', date('Y-m-d H:i:s') . " - Upload.php executado\n", FILE_APPEND);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Configurações
$uploadDir = '../uploads/';
// Detecta esquema e base do projeto dinamicamente para construir a URL correta
$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$scriptDir = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/\\'); // ex: /cardapio-digital-sistema/cardapio-digital-sistema/api
$projectBase = rtrim(dirname($scriptDir), '/\\'); // ex: /cardapio-digital-sistema/cardapio-digital-sistema
$baseUrl = $scheme . '://' . $_SERVER['HTTP_HOST'] . $projectBase . '/uploads/';
$maxWidth = 800;
$maxHeight = 800;
$mode = isset($_GET['mode']) ? strtolower((string)$_GET['mode']) : '';
if ($mode === 'logo') { $maxWidth = 200; $maxHeight = 200; }

// Criar diretório se não existir
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0777, true);
}

// Função para redimensionar imagem
function resizeImage($sourcePath, $destPath, $maxWidth, $maxHeight, $quality = 85) {
    list($width, $height, $type) = getimagesize($sourcePath);

    $src = null;
    switch ($type) {
        case IMAGETYPE_JPEG:
            $src = imagecreatefromjpeg($sourcePath);
            break;
        case IMAGETYPE_PNG:
            $src = imagecreatefrompng($sourcePath);
            break;
        case IMAGETYPE_GIF:
            $src = imagecreatefromgif($sourcePath);
            break;
        case IMAGETYPE_WEBP:
            $src = imagecreatefromwebp($sourcePath);
            break;
        default:
            return false;
    }

    if ($src === null) return false;

    // Calcula novas dimensões
    $ratio = $width / $height;
    if ($width > $maxWidth || $height > $maxHeight) {
        if (($width / $maxWidth) > ($height / $maxHeight)) {
            $newWidth = $maxWidth;
            $newHeight = $maxWidth / $ratio;
        } else {
            $newWidth = $maxHeight * $ratio;
            $newHeight = $maxHeight;
        }
    } else {
        $newWidth = $width;
        $newHeight = $height;
    }
    
    $dst = imagecreatetruecolor($newWidth, $newHeight);
    
    // Preservar transparência para PNG e WEBP
    if($type == IMAGETYPE_PNG || $type == IMAGETYPE_WEBP){
        imagealphablending($dst, false);
        imagesavealpha($dst, true);
        $transparent = imagecolorallocatealpha($dst, 255, 255, 255, 127);
        imagefilledrectangle($dst, 0, 0, $newWidth, $newHeight, $transparent);
    }
    
    imagecopyresampled($dst, $src, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);

    // Salvar imagem
    $success = false;
    switch ($type) {
        case IMAGETYPE_JPEG:
            $success = imagejpeg($dst, $destPath, $quality);
            break;
        case IMAGETYPE_PNG:
            $success = imagepng($dst, $destPath, 9); // Nível de compressão 0-9
            break;
        case IMAGETYPE_GIF:
            $success = imagegif($dst, $destPath);
            break;
        case IMAGETYPE_WEBP:
            $success = imagewebp($dst, $destPath, $quality);
            break;
    }

    imagedestroy($src);
    imagedestroy($dst);

    return $success;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_FILES['image'])) {
        $file = $_FILES['image'];
        $fileName = $file['name'];
        $fileTmpName = $file['tmp_name'];
        $fileSize = $file['size'];
        $fileError = $file['error'];

        if ($fileError === UPLOAD_ERR_OK) {
            $fileExt = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
            $rasterAllowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
            $svgAllowed = ['svg'];

            if (in_array($fileExt, $rasterAllowed)) {
                if ($fileSize < 5000000) { // 5MB
                    $newFileName = uniqid('', true) . '.' . $fileExt;
                    $fileDestination = $uploadDir . $newFileName;

                    if (resizeImage($fileTmpName, $fileDestination, $maxWidth, $maxHeight)) {
                        echo json_encode(['success' => true, 'url' => $baseUrl . $newFileName]);
                    } else {
                        http_response_code(500);
                        echo json_encode(['success' => false, 'message' => 'Erro ao redimensionar e salvar a imagem.']);
                    }
                } else {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'Arquivo muito grande. Máximo 5MB.']);
                }
            } elseif (in_array($fileExt, $svgAllowed)) {
                if ($fileSize < 5000000) { // 5MB
                    $mime = function_exists('mime_content_type') ? @mime_content_type($fileTmpName) : '';
                    // opcionalmente validar assinatura minima de SVG
                    if ($mime && stripos($mime, 'svg') === false) {
                        http_response_code(400);
                        echo json_encode(['success' => false, 'message' => 'Arquivo SVG inválido.']);
                        exit;
                    }
                    $newFileName = uniqid('', true) . '.svg';
                    $fileDestination = $uploadDir . $newFileName;
                    if (move_uploaded_file($fileTmpName, $fileDestination)) {
                        echo json_encode(['success' => true, 'url' => $baseUrl . $newFileName]);
                    } else {
                        http_response_code(500);
                        echo json_encode(['success' => false, 'message' => 'Erro ao salvar arquivo SVG.']);
                    }
                } else {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'Arquivo muito grande. Máximo 5MB.']);
                }
            } else {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Tipo de arquivo não permitido. Use: jpg, jpeg, png, gif, webp, svg.']);
            }
        } else {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erro no upload: ' . $fileError]);
        }
    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Nenhum arquivo enviado.']);
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método não permitido.']);
}
