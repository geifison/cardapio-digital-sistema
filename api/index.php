<?php
/**
 * API Principal do Sistema de Cardápio Digital
 * Gerencia todas as requisições da API
 */
session_start();
// Configurações de CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

// Responde a requisições OPTIONS (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
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
require_once __DIR__ . '/EventManager.php';

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
    
    // Obtém dados do corpo da requisição
    $input = json_decode(file_get_contents('php://input'), true);
    
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
    switch ($method) {
        case 'GET':
            if ($id) {
                $controller->getById($id);
            } else {
                $controller->getAll();
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
                
                if ($category_id) {
                    // Buscar produtos por categoria (mantém compatibilidade)
                    $controller->getByCategory($category_id);
                } elseif ($active_only === 'true') {
                    // Buscar apenas produtos ativos para o cardápio público
                    $controller->getActiveProducts();
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
                $controller->getById($id);
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
    // id é o primeiro segmento após pizza/, ex: sizes, flavors, prices
    $uri = $_SERVER['REQUEST_URI'];
    $project_path = '/cardapio-digital-sistema';
    if (strpos($uri, $project_path) === 0) {
        $uri = substr($uri, strlen($project_path));
    }
    $path = strtok($uri, '?');
    $segments = explode('/', trim($path, '/')); // [api, pizza, resource, resourceId]
    $resource = $segments[2] ?? null;
    $resourceId = $segments[3] ?? null;

    switch ($method) {
        case 'GET':
            if ($resource === 'sizes') {
                $all = isset($_GET['all']) ? ($_GET['all'] === 'true') : false;
                $controller->getSizes($all);
            } elseif ($resource === 'flavors') {
                $category = $_GET['category'] ?? null;
                $all = isset($_GET['all']) ? ($_GET['all'] === 'true') : false;
                $controller->getFlavors($category, $all);
            // === ENDPOINTS REMOVIDOS: Sabores não têm preços próprios ===
            // 'flavors-with-prices' e 'flavor-prices' - REMOVIDOS
            } elseif ($resource === 'minimum-price') {
                $controller->getMinimumPrice();
            } elseif ($resource === 'borders') {
                $controller->getBorders();
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
    // Endpoints: google-api-key, business-hours, pause
    switch ($method) {
        case 'GET':
            if ($id === 'google-api-key') {
                $controller->getGoogleApiKeyStatus();
            } elseif ($id === 'business-hours') {
                $controller->getBusinessHours();
            } elseif ($id === 'pause') {
                $controller->getPauseState();
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Endpoint de configurações não encontrado']);
            }
            break;
        case 'POST':
            if ($id === 'google-api-key') {
                $controller->saveGoogleApiKey($input);
            } elseif ($id === 'business-hours') {
                $controller->saveBusinessHours($input);
            } elseif ($id === 'pause') {
                $controller->savePauseState($input);
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
?>
