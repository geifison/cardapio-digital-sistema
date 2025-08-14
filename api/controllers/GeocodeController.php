<?php
/**
 * GeocodeController
 * Resolve endereço -> coordenadas usando Google Geocoding API
 */

class GeocodeController {
    private $apiKey;

    public function __construct($db = null) {
        // A chave pode vir de variável de ambiente ou arquivo local
        $this->apiKey = getenv('GOOGLE_MAPS_API_KEY');
        if (!$this->apiKey) {
            // Tenta ler de config/google_api_key.txt (não commitar chave real)
            $keyFile = __DIR__ . '/../../config/google_api_key.txt';
            if (is_file($keyFile)) {
                $this->apiKey = trim(file_get_contents($keyFile));
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
                echo json_encode(['success' => false, 'message' => 'Chave da API do Google não configurada']);
                return;
            }

            $address = $input['address'] ?? null;
            if (!$address || !is_string($address)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Endereço não fornecido']);
                return;
            }

            $encoded = urlencode($address);
            $url = "https://maps.googleapis.com/maps/api/geocode/json?address={$encoded}&key={$this->apiKey}";
            $ctx = stream_context_create([
                'http' => [
                    'timeout' => 8
                ]
            ]);
            $resp = @file_get_contents($url, false, $ctx);
            if ($resp === false) {
                throw new Exception('Falha ao conectar à Geocoding API');
            }
            $json = json_decode($resp, true);
            if (!is_array($json) || ($json['status'] ?? '') !== 'OK') {
                $status = $json['status'] ?? 'UNKNOWN_ERROR';
                $msg = $json['error_message'] ?? 'Erro da Geocoding API';
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => $msg, 'status' => $status]);
                return;
            }

            $location = $json['results'][0]['geometry']['location'];
            $lat = $location['lat'];
            $lng = $location['lng'];

            echo json_encode([
                'success' => true,
                'coordinates' => [
                    'lng' => $lng,
                    'lat' => $lat
                ],
                'raw' => $json['results'][0]
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erro ao geocodificar', 'details' => $e->getMessage()]);
        }
    }
}

?>


