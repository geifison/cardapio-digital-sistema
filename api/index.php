<?php
/**
 * API Principal do Sistema de Cardápio Digital
 * Gerencia todas as requisições da API
 */
if (session_status() === PHP_SESSION_NONE) {
  $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443);
  session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => $secure,
    'httponly' => true,
    'samesite' => 'Lax',
  ]);
  session_start();
}
// Configurações de CORS (com suporte a credenciais)
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed_origins = [
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'http://localhost:5190',
  'http://127.0.0.1:5190',
];
if ($origin && in_array($origin, $allowed_origins, true)) {
  header('Access-Control-Allow-Origin: ' . $origin);
  header('Access-Control-Allow-Credentials: true');
} else {
  // Em produção/same-origin, CORS não é necessário; evite wildcard com credenciais
  // Não define Access-Control-Allow-Origin quando a origem não estiver na lista
}
header('Vary: Origin');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');

// Responde a requisições OPTIONS (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

// Inclui arquivos necessários
require_once __DIR__ . '/../config/database.php';
require_once 'controllers/CategoryController.php';
require_once 'controllers/ProductController.php';
require_once 'controllers/OrderController.php';
require_once 'controllers/AuthController.php';
require_once 'controllers/PizzaController.php';
require_once 'controllers/SettingsController.php';
require_once 'controllers/GeocodeController.php';
require_once 'controllers/UserController.php';
require_once 'controllers/MapboxStatusController.php';
require_once __DIR__ . '/EventManager.php';
// carrega config realtime
$__realtime_config = @include __DIR__ . '/../config/realtime.php';
if (!is_array($__realtime_config)) { $__realtime_config = ['node_url' => 'http://localhost:3000', 'secret' => 'dev-secret']; }

// helper global para notificar microserviço Node
if (!function_exists('notify_realtime')) {
  function notify_realtime(string $path, array $payload) {
    global $__realtime_config;
    $url = rtrim((string)($__realtime_config['node_url'] ?? 'http://localhost:3000'), '/') . '/' . ltrim($path, '/');
    $ch = curl_init($url);
    $headers = [
      'Content-Type: application/json',
      'X-REALTIME-SECRET: ' . (string)($__realtime_config['secret'] ?? 'dev-secret')
    ];
    curl_setopt_array($ch, [
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_POST => true,
      CURLOPT_HTTPHEADER => $headers,
      CURLOPT_POSTFIELDS => json_encode($payload),
      CURLOPT_TIMEOUT => 2, // curto para não impactar UX
    ]);
    $resp = curl_exec($ch);
    $err  = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    // silencioso; opcionalmente logar em caso de erro grave
    if ($err || ($code && $code >= 400)) {
      // error_log('[realtime] notify error: ' . ($err ?: ('HTTP ' . $code)));
    }
    return $code;
  }
}

// Configuração de erro reporting
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../logs/php_errors.log');

// Função para capturar erros e retornar JSON
function handleError($errno, $errstr, $errfile, $errline) {
    $error = [
        'error' => true,
        'message' => 'Erro interno do servidor',
        'details' => $errstr . ' in ' . $errfile . ' on line ' . $errline
    ];
    echo json_encode($error);
    exit();
}

set_error_handler('handleError');

try {
    // Obtém a URI da requisição
    $request_uri = $_SERVER['REQUEST_URI'];
    
    // Remove o caminho do projeto se presente (dinâmico)
    $script_name = $_SERVER['SCRIPT_NAME'] ?? '';
    $dir = rtrim(str_replace('index.php','', $script_name), '/'); // ex: /cardapio-digital-sistema/api
    $project_base = '';
    if ($dir !== '' && strpos($dir, '/api') !== false) {
        $project_base = substr($dir, 0, strpos($dir, '/api'));
    }
    if ($project_base && strpos($request_uri, $project_base) === 0) {
        $request_uri = substr($request_uri, strlen($project_base));
    }
    
    $base_path = '/api/';
    
    // Remove o caminho base da URI
    if (strpos($request_uri, $base_path) === 0) {
        $request_uri = substr($request_uri, strlen($base_path));
    }
    
    // Remove query string
    $request_uri = strtok($request_uri, '?');
    
    // Divide a URI em segmentos
    $uri_segments = explode('/', trim($request_uri, '/'));
    $endpoint = $uri_segments[0] ?? '';
    $id = $uri_segments[1] ?? null;
    
    // Método HTTP
    $method = $_SERVER['REQUEST_METHOD'];
    
    // CURTO-CIRCUITO PARA /api/health ANTES DE CONEXÃO COM BD
    if ($endpoint === 'health') {
        echo json_encode([
            'status' => 'ok',
            'message' => 'API funcionando corretamente',
            'timestamp' => date('Y-m-d H:i:s')
        ]);
        return; // evita inicializar BD
    }
    
    // Obtém dados do corpo da requisição
    if (isset($GLOBALS['test_input_data'])) {
        // Se estamos em modo de teste, usa os dados globais
        $input = json_decode($GLOBALS['test_input_data'], true);
    } else {
        // Caso contrário, lê do php://input normalmente
        $input = json_decode(file_get_contents('php://input'), true);
    }
    
    // Inicializa conexão com banco de dados (com auto-instalação do schema quando necessário)
    $database = new Database();
    try {
        $db = $database->getConnection();
    } catch (Throwable $e) {
        // Tenta criar o banco/tabelas a partir do schema e reconectar
        try {
            @ob_start();
            $database->createDatabase(__DIR__ . '/../database_schema.sql');
            @ob_end_clean();
            $db = $database->getConnection();
        } catch (Throwable $e2) {
            throw new Exception('Erro de conexão com o banco de dados');
        }
    }
    if (!$db) {
        // como fallback final
        try {
            @ob_start();
            $database->createDatabase(__DIR__ . '/../database_schema.sql');
            @ob_end_clean();
            $db = $database->getConnection();
        } catch (Throwable $e3) {
            throw new Exception('Erro de conexão com o banco de dados');
        }
    }
    
    // Roteamento da API
    switch ($endpoint) {
        case 'categories':
            $controller = new CategoryController($db);
            handleCategoryRequests($controller, $method, $id, $input);
            break;
            
        case 'products':
            $controller = new ProductController($db);
            handleProductRequests($controller, $method, $id, $input);
            break;
            
        case 'orders':
            $controller = new OrderController($db);
            handleOrderRequests($controller, $method, $id, $input);
            break;
            
        case 'auth':
            $controller = new AuthController($db);
            handleAuthRequests($controller, $method, $id, $input);
            break;
            
        case 'pizza':
            $controller = new PizzaController($db);
            handlePizzaRequests($controller, $method, $id, $input);
            break;
            
        case 'health':
            echo json_encode([
                'status' => 'ok',
                'message' => 'API funcionando corretamente',
                'timestamp' => date('Y-m-d H:i:s')
            ]);
            break;
        case 'events':
            handleEventRequests($method, $id);
            break;
        case 'settings':
            $controller = new SettingsController($db);
            handleSettingsRequests($controller, $method, $id, $input);
            break;
        case 'geocode':
            $controller = new GeocodeController($db);
            handleGeocodeRequests($controller, $method, $id, $input);
            break;
        case 'delivery':
            require_once 'controllers/DeliveryController.php';
            $controller = new DeliveryController($db);
            handleDeliveryRequests($controller, $method, $id, $input);
            break;
            
        case 'users':
            $controller = new UserController($db);
            handleUserRequests($controller, $method, $id, $input);
            break;
        case 'mapbox':
            $controller = new MapboxStatusController($db);
            handleMapboxStatusRequests($controller, $method, $id, $input, $uri_segments);
            break;
        default:
            http_response_code(404);
            echo json_encode([
                'error' => true,
                'message' => 'Endpoint não encontrado'
            ]);
            break;
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => true,
        'message' => 'Erro interno do servidor',
        'details' => $e->getMessage()
    ]);
}

/**
 * Gerencia requisições para categorias
 */
function handleCategoryRequests($controller, $method, $id, $input) {
    // Nova rota para reordenar categorias: /api/categories/reorder
    if ($id === 'reorder' && in_array($method, ['POST', 'PUT', 'PATCH'])) {
        $controller->reorder($input ?? []);
        return;
    }

    switch ($method) {
        case 'GET':
            if ($id) {
                $controller->getById($id);
            } else {
                $controller->getAll();
            }
            break;
        case 'POST':
            $controller->create($input ?? []);
            break;
        case 'PUT':
        case 'PATCH':
            $controller->update($id, $input ?? []);
            break;
        case 'DELETE':
            $controller->delete($id);
            break;
        default:
            http_response_code(405);
            echo json_encode(['error' => true, 'message' => 'Método não permitido']);
            break;
    }
}

/**
 * Gerencia requisições para produtos
 */
function handleProductRequests($controller, $method, $id, $input) {
    switch ($method) {
        case 'GET':
            if ($id) {
                $controller->show($id);
            } else {
                // Verifica se há filtro por categoria
                $category_id = $_GET['category_id'] ?? null;
                $active_only = $_GET['active'] ?? null;
                $search = $_GET['search'] ?? null;
                
                if ($category_id) {
                    // Buscar produtos por categoria (mantém compatibilidade)
                    $controller->getByCategory($category_id);
                } elseif ($active_only === 'true') {
                    // Buscar apenas produtos ativos para o cardápio público
                    $controller->getActiveProducts();
                } elseif ($search) {
                    // Buscar produtos por termo
                    $controller->search($search);
                } else {
                    // Listar todos os produtos (admin)
                    $controller->index();
                }
            }
            break;
            
        case 'POST':
            $controller->create($input);
            break;
            
        case 'PUT':
            if ($id) {
                $controller->update($id, $input);
            } else {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'ID é obrigatório para atualização']);
            }
            break;
            
        case 'DELETE':
            if ($id) {
                $controller->delete($id);
            } else {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'ID é obrigatório para exclusão']);
            }
            break;
            
        case 'PATCH':
            if ($id) {
                // Pausar/despausar produto
                $controller->toggleStatus($id);
            } else {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'ID é obrigatório para alterar status']);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Método não permitido']);
            break;
    }
}

/**
 * Gerencia requisições para pedidos
 */
function handleOrderRequests($controller, $method, $id, $input) {
    switch ($method) {
        case 'GET':
            if ($id) {
                // Verifica se é uma requisição de sincronização de status
                $sync = $_GET['sync'] ?? null;
                if ($sync === 'status') {
                    $controller->getStatus($id);
                } else {
                    $controller->getById($id);
                }
            } else {
                // Verifica filtros
                $status = $_GET['status'] ?? null;
                $date = $_GET['date'] ?? null;
                
                if ($status) {
                    $controller->getByStatus($status);
                } elseif ($date) {
                    $controller->getByDate($date);
                } else {
                    $controller->getAll();
                }
            }
            break;
            
        case 'POST':
            $controller->create($input);
            break;
            
        case 'PUT':
            if ($id) {
                // Verifica se é edição de itens ou atualização de dados
                if (isset($input['items']) && is_array($input['items'])) {
                    // Edição de itens - usa updateItems
                    $controller->updateItems($id, $input);
                } else {
                    // Atualização de dados básicos - usa update
                    $controller->update($id, $input);
                }
            } else {
                http_response_code(400);
                echo json_encode(['error' => true, 'message' => 'ID é obrigatório para atualização']);
            }
            break;
            
        case 'DELETE':
            if ($id) {
                $controller->delete($id);
            } else {
                http_response_code(400);
                echo json_encode(['error' => true, 'message' => 'ID é obrigatório para exclusão']);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => true, 'message' => 'Método não permitido']);
            break;
    }
}

/**
 * Gerencia requisições de autenticação
 */
function handleAuthRequests($controller, $method, $id, $input) {
    switch ($method) {
        case 'POST':
            if ($id === 'login') {
                $controller->login($input);
            } elseif ($id === 'logout') {
                $controller->logout();
            } else {
                http_response_code(404);
                echo json_encode(['error' => true, 'message' => 'Endpoint de autenticação não encontrado']);
            }
            break;
            
        case 'GET':
            if ($id === 'verify') {
                $controller->verifyToken();
            } else {
                http_response_code(404);
                echo json_encode(['error' => true, 'message' => 'Endpoint de autenticação não encontrado']);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['error' => true, 'message' => 'Método não permitido']);
            break;
    }
}

/**
 * Gerencia requisições de pizza
 */
function handlePizzaRequests($controller, $method, $id, $input) {
    // Extrai de forma robusta o recurso após /api/pizza/, independente de subpasta do projeto
    $uri = $_SERVER['REQUEST_URI'] ?? '';
    $uriPath = $uri;
    $qpos = strpos($uriPath, '?');
    if ($qpos !== false) {
        $uriPath = substr($uriPath, 0, $qpos);
    }
    $marker = '/api/pizza/';
    $pos = strpos($uriPath, $marker);
    $rest = $pos !== false ? substr($uriPath, $pos + strlen($marker)) : '';
    $rest = trim($rest, '/');
    $parts = $rest === '' ? [] : explode('/', $rest);

    // resource é o primeiro segmento após /api/pizza/ ou o $id já calculado pelo roteador principal
    $resource = $parts[0] ?? ($id ?: null);
    $resourceId = $parts[1] ?? null;

    switch ($method) {
        case 'GET':
            if ($resource === 'sizes') {
                $all = isset($_GET['all']) ? ($_GET['all'] === 'true') : false;
                $controller->getSizes($all);
            } elseif ($resource === 'product-sizes' && $resourceId) {
                $controller->getProductSizes($resourceId);
            } elseif ($resource === 'flavors') {
                $category = $_GET['category'] ?? null;
                $all = isset($_GET['all']) ? ($_GET['all'] === 'true') : false;
                $controller->getFlavors($category, $all);
            // === ENDPOINTS REMOVIDOS: Sabores não têm preços próprios ===
            // 'flavors-with-prices' e 'flavor-prices' - REMOVIDOS
            } elseif ($resource === 'minimum-price') {
                $controller->getMinimumPrice();
            } elseif ($resource === 'borders') {
                $all = isset($_GET['all']) ? ($_GET['all'] === 'true') : false;
                $controller->getBorders($all);
            } elseif ($resource === 'extras') {
                $category = $_GET['category'] ?? null;
                $controller->getExtras($category);
            } elseif ($resource === 'calculate-price') {
                $controller->calculatePrice($input);
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Endpoint não encontrado']);
            }
            break;

        case 'POST':
            if ($resource === 'create') {
                $controller->createPizzaProduct($input);
            } elseif ($resource === 'sizes') {
                $controller->createSize($input);
            } elseif ($resource === 'flavors') {
                $controller->createFlavor($input);
            } elseif ($resource === 'borders') {
                $controller->createBorder($input);
            } elseif ($resource === 'extras') {
                $controller->createExtra($input);
            } elseif ($resource === 'calculate-price') {
                $controller->calculatePrice($input);
            // === ENDPOINT REMOVIDO: setFlavorPrices() ===
            // Sabores não têm preços próprios - removido
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Endpoint não encontrado']);
            }
            break;

        case 'PUT':
            if ($resource === 'sizes' && $resourceId) {
                $controller->updateSize($resourceId, $input);
            } elseif ($resource === 'flavors' && $resourceId) {
                $controller->updateFlavor($resourceId, $input);
            } elseif ($resource === 'borders' && $resourceId) {
                $controller->updateBorder($resourceId, $input);
            } elseif ($resource === 'extras' && $resourceId) {
                $controller->updateExtra($resourceId, $input);
            } else {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'ID é obrigatório para atualização']);
            }
            break;

        case 'DELETE':
            if ($resource === 'sizes' && $resourceId) {
                $controller->deleteSize($resourceId);
            } elseif ($resource === 'flavors' && $resourceId) {
                $controller->deleteFlavor($resourceId);
            } elseif ($resource === 'borders' && $resourceId) {
                $controller->deleteBorder($resourceId);
            } elseif ($resource === 'extras' && $resourceId) {
                $controller->deleteExtra($resourceId);
            } else {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'ID é obrigatório para exclusão']);
            }
            break;

        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Método não permitido']);
            break;
    }
}

/**
 * Gerencia requisições de configurações
 */
function handleSettingsRequests($controller, $method, $id, $input) {
    // Endpoints: business-hours, pause, mapbox-api-key, company, payment-methods, company-info
    switch ($method) {
        case 'GET':
            if ($id === 'mapbox-api-key') {
                $controller->getMapboxApiKeyStatus();
            } elseif ($id === 'mapbox-public-key') {
                if (!method_exists($controller, 'getMapboxPublicKey')) { require_once 'controllers/SettingsController.php'; }
                $controller->getMapboxPublicKey();
            } elseif ($id === 'business-hours') {
                $controller->getBusinessHours();
            } elseif ($id === 'pause') {
                $controller->getPauseState();
            } elseif ($id === 'company') {
                if (!method_exists($controller, 'getCompanySettings')) { require_once 'controllers/SettingsController.php'; }
                $controller->getCompanySettings();
            } elseif ($id === 'company-info') {
                if (!method_exists($controller, 'getCompanyInfo')) { require_once 'controllers/SettingsController.php'; }
                $controller->getCompanyInfo();
            } elseif ($id === 'company-info-public') {
                if (!method_exists($controller, 'getCompanyInfoPublic')) { require_once 'controllers/SettingsController.php'; }
                $controller->getCompanyInfoPublic();
            } elseif ($id === 'payment-methods') {
                if (!method_exists($controller, 'getPaymentMethods')) { require_once 'controllers/SettingsController.php'; }
                $controller->getPaymentMethods();
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Endpoint de configurações não encontrado']);
            }
            break;
        case 'POST':
            if ($id === 'mapbox-api-key') {
                $controller->saveMapboxApiKey($input);
            } elseif ($id === 'business-hours') {
                $controller->saveBusinessHours($input);
            } elseif ($id === 'pause') {
                $controller->savePauseState($input);
            } elseif ($id === 'company') {
                if (!method_exists($controller, 'saveCompanySettings')) { require_once 'controllers/SettingsController.php'; }
                $controller->saveCompanySettings($input);
            } elseif ($id === 'company-info') {
                if (!method_exists($controller, 'saveCompanyInfo')) { require_once 'controllers/SettingsController.php'; }
                $controller->saveCompanyInfo($input);
            } elseif ($id === 'payment-methods') {
                if (!method_exists($controller, 'savePaymentMethods')) { require_once 'controllers/SettingsController.php'; }
                $controller->savePaymentMethods($input);
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Endpoint de configurações não encontrado']);
            }
            break;
        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Método não permitido']);
            break;
    }
}

/**
 * Gerencia requisições de geocodificação
 */
function handleGeocodeRequests($controller, $method, $id, $input) {
    switch ($method) {
        case 'POST':
            if ($id === 'resolve') {
                $controller->resolve($input);
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Endpoint de geocodificação não encontrado']);
            }
            break;
        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Método não permitido']);
            break;
    }
}

 
/**
 * Gerencia requisições de entrega (frete)
 */
function handleDeliveryRequests($controller, $method, $id, $input) {
    switch ($method) {
        case 'GET':
            if ($id === 'config') {
                $controller->getConfig();
            } elseif ($id === 'public-key') {
                // Retorna a chave pública APENAS se expose_public_key = 1
                if (!method_exists($controller, 'getPublicKey')) { require_once 'controllers/DeliveryController.php'; }
                $controller->getPublicKey();
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Endpoint de entrega não encontrado']);
            }
            break;
        case 'POST':
            if ($id === 'config') {
                $controller->saveConfig($input);
            } elseif ($id === 'quote') {
                $controller->quote($input);
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Endpoint de entrega não encontrado']);
            }
            break;
        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Método não permitido']);
            break;
    }
}

/**
 * Gerencia requisições de usuários
 */
function handleUserRequests($controller, $method, $id, $input) {
    // Endpoints: /users (listar), /users/create, /users/update, /users/delete
    switch ($method) {
        case 'GET':
            if (!$id) {
                // Listar todos os usuários
                $controller->listUsers();
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Endpoint de usuários não encontrado']);
            }
            break;
            
        case 'POST':
            if ($id === 'create') {
                $controller->createUser($input);
            } elseif ($id === 'update') {
                $controller->updateUser($input);
            } elseif ($id === 'delete') {
                $controller->deleteUser($input);
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Endpoint de usuários não encontrado']);
            }
            break;
            
        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Método não permitido']);
            break;
    }
}

/**
 * Eventos Server-Sent (SSE)
 */
function handleEventRequests($method, $id) {
    // Esperado: GET /api/events/stream
    if ($method !== 'GET' || $id !== 'stream') {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Endpoint não encontrado']);
        return;
    }

    // Preparar headers SSE
    header('Content-Type: text/event-stream');
    header('Cache-Control: no-cache');
    header('Connection: keep-alive');
    header('X-Accel-Buffering: no');
    // Remover limites de execução para a conexão
    @set_time_limit(0);

    // Client pode enviar lastEventId via query ou header
    $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;

    // Loop de long-poll para ambientes PHP comuns (30s)
    $start = time();
    while (time() - $start < 30) {
        $result = EventManager::readSinceOffset($offset);
        $events = $result['events'];
        $offset = $result['newOffset'];

        foreach ($events as $event) {
            $type = $event['type'] ?? 'message';
            $data = json_encode($event);
            echo "event: {$type}\n";
            echo "data: {$data}\n\n";
        }

        if (!empty($events)) {
            // flush imediato quando houver eventos
            @ob_flush();
            @flush();
            break; // encerra para o client reconectar (long-poll)
        }

        // Sem eventos: aguarda um pouco
        usleep(300000); // 300ms
    }
}
/**
 * Mapbox Status
 */
function handleMapboxStatusRequests($controller, $method, $id, $input, $uri_segments) {
    // Endpoints esperados:
    // GET /api/mapbox/status -> testa todas
    // GET /api/mapbox/status/geocoding
    // GET /api/mapbox/status/directions
    // GET /api/mapbox/status/maploads
    // GET /api/mapbox/public-key -> chave pública
    if ($method !== 'GET') {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Método não permitido']);
        return;
    }
    $sub = $id; // primeiro segmento após 'mapbox'
    $action = $uri_segments[2] ?? null; // segundo segmento

    // Endpoint para chave pública
    if ($sub === 'public-key') {
        require_once 'controllers/SettingsController.php';
        // Obter conexão do banco global (mesma usada para criar o MapboxStatusController)
        global $db;
        $settingsController = new SettingsController($db);
        $settingsController->getMapboxPublicKey();
        return;
    }

    if ($sub === 'status' && !$action) {
        $controller->statusAll();
        return;
    }
    if ($sub === 'status' && $action === 'geocoding') {
        $controller->statusGeocoding();
        return;
    }
    if ($sub === 'status' && $action === 'directions') {
        $controller->statusDirections();
        return;
    }
    if ($sub === 'status' && $action === 'maploads') {
        $controller->statusMapLoads();
        return;
    }

    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Endpoint Mapbox não encontrado']);
}
?>
