<?php
/**
 * GeocodeController
 * Resolve endereço -> coordenadas usando Mapbox Geocoding API (v5)
 */

class GeocodeController {
    private $apiKey;
    private $db;

    public function __construct($db = null) {
        $this->db = $db;
        $this->apiKey = '';

        // 1) Tenta obter do banco (settings_delivery.id=1)
        try {
            if ($this->db) {
                $stmt = $this->db->query("SELECT mapbox_api_key FROM settings_delivery WHERE id = 1");
                $row = $stmt ? $stmt->fetch(\PDO::FETCH_ASSOC) : null;
                if ($row && !empty($row['mapbox_api_key'])) {
                    $this->apiKey = trim((string)$row['mapbox_api_key']);
                }
            }
        } catch (\Throwable $e) {
            // ignora e tenta fallback
        }

        // 2) Fallback: variável de ambiente MAPBOX_ACCESS_TOKEN
        if (!$this->apiKey) {
            $env = getenv('MAPBOX_ACCESS_TOKEN');
            if ($env) {
                $this->apiKey = trim($env);
            }
        }

        // 3) Fallback opcional: arquivo local config/mapbox_api_key.txt (não comitar chave real)
        if (!$this->apiKey) {
            $keyFile = __DIR__ . '/../../config/mapbox_api_key.txt';
            if (is_file($keyFile)) {
                $this->apiKey = trim((string)@file_get_contents($keyFile));
            }
        }
    }

    /**
     * POST /api/geocode/resolve
     * Body JSON: { address: '...' }
     */
    public function resolve($input) {
        try {
            if (!$this->apiKey) {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => 'Chave do Mapbox não configurada']);
                return;
            }

            $address = $input['address'] ?? null;
            if (!$address || !is_string($address)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Endereço não fornecido']);
                return;
            }

            $coords = $this->mapboxGeocode($address, $this->apiKey);
            if (!$coords) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Não foi possível geocodificar o endereço']);
                return;
            }

            echo json_encode([
                'success' => true,
                'coordinates' => [
                    'lng' => $coords['lng'],
                    'lat' => $coords['lat']
                ]
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erro ao geocodificar', 'details' => $e->getMessage()]);
        }
    }

    private function mapboxGeocode($address, $apiKey) {
        // Normalização leve
        $normalized = preg_replace('/\s+/', ' ', trim((string)$address));
        // Endpoint oficial v5
        $url = 'https://api.mapbox.com/geocoding/v5/mapbox.places/' . rawurlencode($normalized) . '.json?country=BR&limit=1&access_token=' . urlencode($apiKey);
        $ctx = stream_context_create(['http' => ['timeout' => 10]]);
        $resp = @file_get_contents($url, false, $ctx);
        if ($resp === false) return null;
        $json = json_decode($resp, true);
        if (!is_array($json) || empty($json['features'])) return null;
        $center = $json['features'][0]['center']; // [lng, lat]
        return [ 'lng' => (float)$center[0], 'lat' => (float)$center[1] ];
    }
}

?>


