<?php
// Router para o servidor embutido do PHP
// - Serve arquivos estáticos quando existirem
// - Encaminha todas as rotas que começam com /api para api/index.php
// - Para /, entrega index.html

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/';
$docRoot = __DIR__;
$requestedPath = realpath($docRoot . $uri);

// Se for um arquivo estático existente dentro do docroot, deixa o servidor servir
if (php_sapi_name() === 'cli-server') {
    // Prevenir path traversal: o arquivo solicitado deve estar dentro do docroot
    if ($requestedPath && str_starts_with($requestedPath, $docRoot) && is_file($requestedPath)) {
        return false; // deixa o servidor embutido servir o arquivo
    }
}

// Roteia /api/* para api/index.php
if (strpos($uri, '/api') === 0) {
    // Ajusta variáveis do ambiente para o index.php da API
    $_SERVER['SCRIPT_NAME'] = '/api/index.php';
    $_SERVER['SCRIPT_FILENAME'] = $docRoot . '/api/index.php';

    // Muda diretório de trabalho para a pasta da API
    chdir($docRoot . '/api');

    // Inclui o roteador principal da API
    require $docRoot . '/api/index.php';
    return true;
}

// Entrega index.html para a raiz
if ($uri === '/' || $uri === '') {
    $indexPath = $docRoot . '/index.html';
    if (is_file($indexPath)) {
        readfile($indexPath);
        return true;
    }
}

// Se não for estático e não corresponder a regras acima, deixa o servidor decidir (404)
return false;