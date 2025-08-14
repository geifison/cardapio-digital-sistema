<?php
/**
 * DeliveryController
 * Calcula frete via Mapbox, com cache por endereço e configuração persistida
 */

class DeliveryController {
    private $db;

    public function __construct($db = null) {
        $this->db = $db;
    }

    /**
     * Verifica se uma coluna existe na tabela informada (MySQL)
     */
    private function hasColumn($tableName, $columnName) {
        try {
            if (!$this->db) return false;
            $sql = "SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = :c";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([':t' => $tableName, ':c' => $columnName]);
            $row = $stmt->fetch();
            return $row && (int)$row['cnt'] > 0;
        } catch (\Throwable $e) {
            return false;
        }
    }

    // GET /api/delivery/public-key
    public function getPublicKey() {
        try {
            if (!$this->db) throw new Exception('DB indisponível');
            $stmt = $this->db->query("SELECT expose_public_key, mapbox_api_key FROM settings_delivery WHERE id = 1");
            $row = $stmt->fetch();
            if (!$row || (int)$row['expose_public_key'] !== 1) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Chave não disponível']);
                return;
            }
            // retorne somente quando explicitamente permitido
            echo json_encode(['success' => true, 'public_key' => (string)$row['mapbox_api_key']]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erro ao obter chave pública', 'details' => $e->getMessage()]);
        }
    }

    // GET /api/delivery/config
    public function getConfig() {
        try {
            if (!$this->db) throw new Exception('DB indisponível');
            $stmt = $this->db->query("SELECT * FROM settings_delivery WHERE id = 1");
            $row = $stmt->fetch(\PDO::FETCH_ASSOC);
            if (!$row) {
                echo json_encode(['success' => true, 'data' => [
                    'origin_address' => '',
                    'origin_lat' => null,
                    'origin_lng' => null,
                    'price_per_km' => 0,
                    'min_delivery_fee' => 0,
                    'expose_public_key' => 0,
                    'has_key' => 0
                ]]);
                return;
            }
            $data = [
                'origin_address' => (string)($row['origin_address'] ?? ''),
                'origin_lat' => isset($row['origin_lat']) ? (float)$row['origin_lat'] : null,
                'origin_lng' => isset($row['origin_lng']) ? (float)$row['origin_lng'] : null,
                'price_per_km' => isset($row['price_per_km']) ? (float)$row['price_per_km'] : 0,
                'min_delivery_fee' => isset($row['min_delivery_fee']) ? (float)$row['min_delivery_fee'] : 0,
                'expose_public_key' => isset($row['expose_public_key']) ? (int)$row['expose_public_key'] : 0,
                'has_key' => (!empty($row['mapbox_api_key']) ? 1 : 0)
            ];
            echo json_encode(['success' => true, 'data' => $data]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erro ao obter config', 'details' => $e->getMessage()]);
        }
    }

    // POST /api/delivery/config
    // Body JSON: { origin_address, price_per_km, min_delivery_fee, expose_public_key, mapbox_api_key }
    public function saveConfig($input) {
        try {
            if (!$this->db) throw new Exception('DB indisponível');
            $originAddress = trim((string)($input['origin_address'] ?? ''));
            $pricePerKm = (float)($input['price_per_km'] ?? 0);
            $minFee = (float)($input['min_delivery_fee'] ?? 0);
            $exposePublic = (int)!!($input['expose_public_key'] ?? 0);
            $apiKey = trim((string)($input['mapbox_api_key'] ?? ''));
            if ($originAddress === '' || $pricePerKm <= 0 || $minFee < 0 || $apiKey === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Dados inválidos']);
                return;
            }

            // geocodificar origem uma vez
            $coords = $this->mapboxGeocode($originAddress, $apiKey, 'Brasil');
            if (!$coords) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Não foi possível geocodificar o endereço de origem']);
                return;
            }

            // Compatibilidade com bancos que ainda não possuem todas as colunas
            $hasMinFee = $this->hasColumn('settings_delivery', 'min_delivery_fee');
            $hasExpose = $this->hasColumn('settings_delivery', 'expose_public_key');

            $fields = ['id','origin_address','origin_lat','origin_lng','price_per_km','mapbox_api_key'];
            $placeholders = [':id',':addr',':lat',':lng',':ppk',':key'];
            $updates = ['origin_address = VALUES(origin_address)','origin_lat = VALUES(origin_lat)','origin_lng = VALUES(origin_lng)','price_per_km = VALUES(price_per_km)','mapbox_api_key = VALUES(mapbox_api_key)'];
            $params = [
                ':id' => 1,
                ':addr' => $originAddress,
                ':lat' => $coords['lat'],
                ':lng' => $coords['lng'],
                ':ppk' => $pricePerKm,
                ':key' => $apiKey
            ];
            if ($hasMinFee) {
                $fields[] = 'min_delivery_fee';
                $placeholders[] = ':minf';
                $updates[] = 'min_delivery_fee = VALUES(min_delivery_fee)';
                $params[':minf'] = $minFee;
            }
            if ($hasExpose) {
                $fields[] = 'expose_public_key';
                $placeholders[] = ':exp';
                $updates[] = 'expose_public_key = VALUES(expose_public_key)';
                $params[':exp'] = $exposePublic;
            }

            $sql = 'INSERT INTO settings_delivery (' . implode(',', $fields) . ') VALUES (' . implode(',', $placeholders) . ') ON DUPLICATE KEY UPDATE ' . implode(',', $updates);
            $stmt = $this->db->prepare($sql);
            $ok = $stmt->execute($params);

            if (!$ok) throw new Exception('Falha ao salvar');
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erro ao salvar config', 'details' => $e->getMessage()]);
        }
    }

    // POST /api/delivery/quote
    // Body JSON: { zip, street, number, neighborhood, city }
    public function quote($input) {
        try {
            if (!$this->db) throw new Exception('DB indisponível');

            $zip = trim((string)($input['zip'] ?? ''));
            $street = trim((string)($input['street'] ?? ''));
            $number = trim((string)($input['number'] ?? ''));
            $neighborhood = trim((string)($input['neighborhood'] ?? ''));
            $city = trim((string)($input['city'] ?? ''));
            if ($zip === '' || $street === '' || $number === '' || $neighborhood === '' || $city === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Endereço incompleto']);
                return;
            }

            // Carregar config
            $cfgStmt = $this->db->query("SELECT * FROM settings_delivery WHERE id = 1");
            $cfg = $cfgStmt->fetch(\PDO::FETCH_ASSOC);
            if (!$cfg || !$cfg['mapbox_api_key'] || !$cfg['origin_lat'] || !$cfg['origin_lng'] || !$cfg['price_per_km']) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Configuração de entrega incompleta']);
                return;
            }
            $apiKey = $cfg['mapbox_api_key'];
            $originLat = (float)$cfg['origin_lat'];
            $originLng = (float)$cfg['origin_lng'];
            $pricePerKm = (float)$cfg['price_per_km'];
            $minFee = isset($cfg['min_delivery_fee']) ? (float)$cfg['min_delivery_fee'] : 0;

            // Normalizar e hash do endereço
            $addressText = $this->buildAddressText($street, $number, $neighborhood, $city, $zip);
            $addressHash = hash('sha256', mb_strtolower($zip.'|'.$street.'|'.$number.'|'.$neighborhood.'|'.$city, 'UTF-8'));

            // 1) Tentar cache
            $cacheStmt = $this->db->prepare("SELECT distance_m, distance_km, fee FROM delivery_quote_cache WHERE address_hash = :h LIMIT 1");
            $cacheStmt->execute([':h' => $addressHash]);
            $cached = $cacheStmt->fetch();
            if ($cached) {
                echo json_encode([
                    'success' => true,
                    'cached' => true,
                    'distance_km' => round((float)$cached['distance_km'], 2),
                    'fee' => round((float)$cached['fee'], 2)
                ]);
                return;
            }

            // 2) Geocodificar cliente
            $coords = $this->mapboxGeocode($addressText, $apiKey, $city);
            if (!$coords) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Não foi possível localizar o endereço informado']);
                return;
            }

            // 3) Distância via Directions API (driving)
            $distanceM = $this->mapboxDistanceDriving($originLng, $originLat, $coords['lng'], $coords['lat'], $apiKey);
            if ($distanceM <= 0) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Não foi possível calcular a rota']);
                return;
            }

            $distanceKm = $distanceM / 1000.0;
            $fee = max($minFee, $distanceKm * $pricePerKm);

            // 4) Salvar no cache
            $ins = $this->db->prepare("INSERT INTO delivery_quote_cache
                (address_hash, zip, street, number, neighborhood, city, address_text, client_lat, client_lng, distance_m, distance_km, fee)
                VALUES (:h, :zip, :street, :number, :neigh, :city, :text, :lat, :lng, :dm, :dk, :fee)");
            $ins->execute([
                ':h' => $addressHash,
                ':zip' => $zip,
                ':street' => $street,
                ':number' => $number,
                ':neigh' => $neighborhood,
                ':city' => $city,
                ':text' => $addressText,
                ':lat' => $coords['lat'],
                ':lng' => $coords['lng'],
                ':dm' => (int)$distanceM,
                ':dk' => $distanceKm,
                ':fee' => $fee
            ]);

            echo json_encode([
                'success' => true,
                'cached' => false,
                'distance_km' => round($distanceKm, 2),
                'fee' => round($fee, 2)
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erro ao calcular frete', 'details' => $e->getMessage()]);
        }
    }

    private function buildAddressText($street, $number, $neighborhood, $city, $zip) {
        $parts = ["{$street}, {$number}", $neighborhood, $city, $zip, 'Brasil'];
        return implode(' - ', array_filter($parts));
    }

    private function mapboxGeocode($address, $apiKey, $cityHint = null) {
        // Normalização leve: remover espaços duplos e sufixos redundantes, e adicionar hint de cidade
        $normalized = preg_replace('/\s+/', ' ', trim($address));
        if ($cityHint && stripos($normalized, $cityHint) === false) {
            $normalized .= ' - ' . $cityHint;
        }
        $url = 'https://api.mapbox.com/geocoding/v5/mapbox.places/' . rawurlencode($normalized) . '.json?country=BR&access_token=' . urlencode($apiKey) . '&limit=1';
        $ctx = stream_context_create(['http' => ['timeout' => 10]]);
        $resp = @file_get_contents($url, false, $ctx);
        if ($resp === false) return null;
        $json = json_decode($resp, true);
        if (!is_array($json) || empty($json['features'])) return null;
        $center = $json['features'][0]['center']; // [lng, lat]
        return [ 'lng' => (float)$center[0], 'lat' => (float)$center[1] ];
    }

    private function mapboxDistanceDriving($fromLng, $fromLat, $toLng, $toLat, $apiKey) {
        $url = 'https://api.mapbox.com/directions/v5/mapbox/driving/' .
            $fromLng . ',' . $fromLat . ';' . $toLng . ',' . $toLat .
            '?alternatives=false&geometries=geojson&overview=simplified&access_token=' . urlencode($apiKey);
        $ctx = stream_context_create(['http' => ['timeout' => 15]]);
        $resp = @file_get_contents($url, false, $ctx);
        if ($resp === false) return 0;
        $json = json_decode($resp, true);
        if (!is_array($json) || empty($json['routes'])) return 0;
        $distance = $json['routes'][0]['distance'] ?? 0;
        return (int)$distance;
    }
}

?>


