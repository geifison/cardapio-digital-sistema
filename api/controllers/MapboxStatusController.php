<?php
/**
 * MapboxStatusController
 * Testa status das APIs Mapbox: Geocoding, Directions e Map Loads
 */
class MapboxStatusController {
    private $db;
    private $apiKey;

    public function __construct($database) {
        $this->db = $database;
        $this->loadApiKey();
    }

    private function loadApiKey() {
        try {
            // Buscar chave da API no banco
            $stmt = $this->db->query("SELECT mapbox_api_key FROM settings_delivery WHERE id = 1");
            $row = $stmt ? $stmt->fetch(\PDO::FETCH_ASSOC) : null;
            
            if ($row && !empty($row['mapbox_api_key'])) {
                $this->apiKey = trim((string)$row['mapbox_api_key']);
                return;
            }

            // Fallback: variável de ambiente
            $env = getenv('MAPBOX_ACCESS_TOKEN');
            if ($env && strlen(trim($env)) > 0) {
                $this->apiKey = trim($env);
                return;
            }

            // Fallback opcional: arquivo local config/mapbox_api_key.txt (não comitar chave real)
            $keyFile = __DIR__ . '/../../config/mapbox_api_key.txt';
            if (is_file($keyFile)) {
                $fileKey = trim((string)@file_get_contents($keyFile));
                if ($fileKey !== '') {
                    $this->apiKey = $fileKey;
                }
            }
        } catch (Exception $e) {
            error_log("Erro ao carregar chave Mapbox: " . $e->getMessage());
        }
    }

    /**
     * GET /api/mapbox/status - Testa todas as APIs Mapbox
     */
    public function checkAllApis() {
        header('Content-Type: application/json');
        
        if (!$this->apiKey) {
            echo json_encode([
                'success' => false,
                'message' => 'Chave Mapbox não configurada',
                'results' => [
                    'geocoding' => ['status' => 'error', 'message' => 'Chave não disponível'],
                    'directions' => ['status' => 'error', 'message' => 'Chave não disponível'],
                    'map_loads' => ['status' => 'error', 'message' => 'Chave não disponível']
                ]
            ]);
            return;
        }

        $results = [
            'geocoding' => $this->testGeocodingApi(),
            'directions' => $this->testDirectionsApi(),
            'map_loads' => $this->testMapLoadsApi()
        ];

        $allSuccess = array_reduce($results, function($carry, $result) {
            return $carry && ($result['status'] === 'success');
        }, true);

        echo json_encode([
            'success' => $allSuccess,
            'message' => $allSuccess ? 'Todas as APIs funcionando' : 'Algumas APIs com problemas',
            'results' => $results
        ]);
    }

    // --- Métodos públicos para compatibilidade com o roteador ---
    public function statusAll() {
        // Alias para checkAllApis()
        $this->checkAllApis();
    }

    public function statusGeocoding() {
        header('Content-Type: application/json');
        if (!$this->apiKey) {
            echo json_encode([
                'success' => false,
                'message' => 'Chave Mapbox não configurada',
                'result' => ['status' => 'error', 'message' => 'Chave não disponível']
            ]);
            return;
        }
        $res = $this->testGeocodingApi();
        echo json_encode([
            'success' => ($res['status'] ?? '') === 'success',
            'message' => $res['message'] ?? '',
            'result' => $res,
        ]);
    }

    public function statusDirections() {
        header('Content-Type: application/json');
        if (!$this->apiKey) {
            echo json_encode([
                'success' => false,
                'message' => 'Chave Mapbox não configurada',
                'result' => ['status' => 'error', 'message' => 'Chave não disponível']
            ]);
            return;
        }
        $res = $this->testDirectionsApi();
        echo json_encode([
            'success' => ($res['status'] ?? '') === 'success',
            'message' => $res['message'] ?? '',
            'result' => $res,
        ]);
    }

    public function statusMapLoads() {
        header('Content-Type: application/json');
        if (!$this->apiKey) {
            echo json_encode([
                'success' => false,
                'message' => 'Chave Mapbox não configurada',
                'result' => ['status' => 'error', 'message' => 'Chave não disponível']
            ]);
            return;
        }
        $res = $this->testMapLoadsApi();
        echo json_encode([
            'success' => ($res['status'] ?? '') === 'success',
            'message' => $res['message'] ?? '',
            'result' => $res,
        ]);
    }

    /**
     * Testa Geocoding API
     */
    private function testGeocodingApi() {
        try {
            // Teste simples: geocodificar "São Paulo, Brasil"
            $testAddress = urlencode('São Paulo, Brasil');
            $url = "https://api.mapbox.com/geocoding/v5/mapbox.places/{$testAddress}.json?country=BR&limit=1&access_token=" . urlencode($this->apiKey);
            
            $context = stream_context_create([
                'http' => [
                    'timeout' => 10,
                    'user_agent' => 'Cardapio-Digital/1.0'
                ]
            ]);
            
            $response = file_get_contents($url, false, $context);
            
            if ($response === false) {
                return ['status' => 'error', 'message' => 'Falha na requisição HTTP'];
            }
            
            $data = json_decode($response, true);
            
            if (!$data) {
                return ['status' => 'error', 'message' => 'Resposta inválida da API'];
            }
            
            if (isset($data['message']) && stripos($data['message'], 'Not Authorized') !== false) {
                return ['status' => 'error', 'message' => 'Chave não autorizada'];
            }
            
            if (!isset($data['features']) || !is_array($data['features'])) {
                return ['status' => 'error', 'message' => 'Formato de resposta inesperado'];
            }
            
            if (count($data['features']) > 0) {
                return ['status' => 'success', 'message' => 'Geocoding funcionando'];
            }
            
            return ['status' => 'warning', 'message' => 'API respondeu mas sem resultados'];
            
        } catch (Exception $e) {
            return ['status' => 'error', 'message' => 'Erro: ' . $e->getMessage()];
        }
    }

    /**
     * Testa Directions API
     */
    private function testDirectionsApi() {
        try {
            // Teste simples: rota entre dois pontos em São Paulo
            $fromLng = -46.6333;
            $fromLat = -23.5505;
            $toLng = -46.6500;
            $toLat = -23.5600;
            
            $url = "https://api.mapbox.com/directions/v5/mapbox/driving/{$fromLng},{$fromLat};{$toLng},{$toLat}?geometries=geojson&access_token=" . urlencode($this->apiKey);
            
            $context = stream_context_create([
                'http' => [
                    'timeout' => 10,
                    'user_agent' => 'Cardapio-Digital/1.0'
                ]
            ]);
            
            $response = file_get_contents($url, false, $context);
            
            if ($response === false) {
                return ['status' => 'error', 'message' => 'Falha na requisição HTTP'];
            }
            
            $data = json_decode($response, true);
            
            if (!$data) {
                return ['status' => 'error', 'message' => 'Resposta inválida da API'];
            }
            
            if (isset($data['message']) && stripos($data['message'], 'Not Authorized') !== false) {
                return ['status' => 'error', 'message' => 'Chave não autorizada'];
            }
            
            if (!isset($data['routes']) || !is_array($data['routes'])) {
                return ['status' => 'error', 'message' => 'Formato de resposta inesperado'];
            }
            
            if (count($data['routes']) > 0) {
                return ['status' => 'success', 'message' => 'Directions funcionando'];
            }
            
            return ['status' => 'warning', 'message' => 'API respondeu mas sem rotas'];
            
        } catch (Exception $e) {
            return ['status' => 'error', 'message' => 'Erro: ' . $e->getMessage()];
        }
    }

    /**
     * Testa Map Loads API (verificação básica de autenticação)
     */
    private function testMapLoadsApi() {
        try {
            $styles = ['streets-v12', 'streets-v11'];
            $context = stream_context_create([
                'http' => [
                    'timeout' => 10,
                    'user_agent' => 'Cardapio-Digital/1.0'
                ]
            ]);

            foreach ($styles as $style) {
                $url = "https://api.mapbox.com/styles/v1/mapbox/{$style}?access_token=" . urlencode($this->apiKey);
                $response = @file_get_contents($url, false, $context);
                $statusLine = is_array($http_response_header ?? null) ? ($http_response_header[0] ?? '') : '';

                if ($response === false) {
                    // Tenta inferir erro via status code
                    if (stripos($statusLine, '401') !== false || stripos($statusLine, '403') !== false) {
                        return ['status' => 'error', 'message' => 'Chave não autorizada'];
                    }
                    if (stripos($statusLine, '404') !== false) {
                        // Tenta próximo estilo
                        continue;
                    }
                    // Erro genérico
                    continue;
                }

                $data = json_decode($response, true);
                if (!$data) {
                    // Resposta não JSON: tenta próximo
                    continue;
                }

                // Sucesso se possuir algum dos campos típicos de Style API
                $hasStyleMarkers = (
                    (isset($data['uri']) && stripos($data['uri'], 'mapbox://styles/') === 0) ||
                    (isset($data['id']) && (stripos($data['id'], 'streets-v') === 0 || $data['id'] === 'mapbox://styles/mapbox/streets-v12' || $data['id'] === 'mapbox://styles/mapbox/streets-v11')) ||
                    isset($data['version']) || isset($data['name'])
                );

                if ($hasStyleMarkers) {
                    return ['status' => 'success', 'message' => 'Map Loads funcionando'];
                }
            }

            return ['status' => 'warning', 'message' => 'API respondeu mas formato inesperado'];
        } catch (Exception $e) {
            return ['status' => 'error', 'message' => 'Erro: ' . $e->getMessage()];
        }
    }
}