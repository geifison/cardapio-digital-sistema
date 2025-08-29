<?php
/**
 * SettingsController
 * Gerencia configurações do sistema
 */

class SettingsController {
    private $configDir;
    private $db;

    public function __construct($db = null) {
        // Diretório de configuração
        $this->configDir = realpath(__DIR__ . '/../../config');
        if ($this->configDir === false) {
            $this->configDir = __DIR__ . '/../../config';
        }
        $this->db = $db;
    }
    /**
     * GET /api/settings/business-hours
     */
    public function getBusinessHours() {
        try {
            $file = $this->configDir . DIRECTORY_SEPARATOR . 'business_hours.json';
            $default = [
                'monday' =>    [ 'closed' => false, 'open' => '09:00', 'close' => '18:00' ],
                'tuesday' =>   [ 'closed' => false, 'open' => '09:00', 'close' => '18:00' ],
                'wednesday' => [ 'closed' => false, 'open' => '09:00', 'close' => '18:00' ],
                'thursday' =>  [ 'closed' => false, 'open' => '09:00', 'close' => '18:00' ],
                'friday' =>    [ 'closed' => false, 'open' => '09:00', 'close' => '18:00' ],
                'saturday' =>  [ 'closed' => false, 'open' => '10:00', 'close' => '14:00' ],
                'sunday' =>    [ 'closed' => true,  'open' => '00:00', 'close' => '00:00' ]
            ];
            // Tentar banco primeiro
            $dbData = $this->getBusinessHoursFromDb();
            if ($dbData) {
                echo json_encode(['success' => true, 'data' => $dbData]);
                return;
            }
            if (!is_file($file)) {
                echo json_encode(['success' => true, 'data' => $default]);
                return;
            }
            $content = @file_get_contents($file);
            if ($content === false) {
                echo json_encode(['success' => true, 'data' => $default]);
                return;
            }
            $json = json_decode($content, true);
            if (!is_array($json)) $json = $default;
            echo json_encode(['success' => true, 'data' => $json]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erro ao ler horários', 'details' => $e->getMessage()]);
        }
    }

    /**
     * POST /api/settings/business-hours
     */
    public function saveBusinessHours($input) {
        try {
            if (!is_array($input)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Payload inválido']);
                return;
            }
            $requiredDays = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
            foreach ($requiredDays as $day) {
                if (!isset($input[$day]) || !is_array($input[$day])) {
                    http_response_code(400);
                    echo json_encode(['success' => false, 'message' => 'Estrutura inválida para ' . $day]);
                    return;
                }
                $d = $input[$day];
                $closed = isset($d['closed']) ? (bool)$d['closed'] : false;
                $open = isset($d['open']) ? $d['open'] : '00:00';
                $close = isset($d['close']) ? $d['close'] : '00:00';
                if (!$closed) {
                    if (!preg_match('/^\d{2}:\d{2}$/', $open) || !preg_match('/^\d{2}:\d{2}$/', $close)) {
                        http_response_code(400);
                        echo json_encode(['success' => false, 'message' => 'Horário inválido em ' . $day]);
                        return;
                    }
                    // 00:00 ~ 00:00 = aberto 24h (permitido)
                    if (!($open === '00:00' && $close === '00:00') && strcmp($open, $close) >= 0) {
                        http_response_code(400);
                        echo json_encode(['success' => false, 'message' => 'Abertura deve ser antes do fechamento em ' . $day]);
                        return;
                    }
                }
                $input[$day] = [ 'closed' => $closed, 'open' => $open, 'close' => $close ];
            }

            // Salvar no banco; fallback para arquivo
            $savedDb = $this->saveBusinessHoursToDb($input);
            if (!$savedDb) {
                if (!is_dir($this->configDir)) {
                    @mkdir($this->configDir, 0775, true);
                }
                $file = $this->configDir . DIRECTORY_SEPARATOR . 'business_hours.json';
                $ok = @file_put_contents($file, json_encode($input, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
                if ($ok === false) {
                    throw new Exception('Não foi possível salvar');
                }
            }
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erro ao salvar horários', 'details' => $e->getMessage()]);
        }
    }

    /**
     * GET /api/settings/pause
     * Retorna estado global de pausa de pedidos
     */
    public function getPauseState() {
        try {
            // 1) Tentar banco de dados (flag simples)
            $dbData = $this->getPauseFromDb();
            if ($dbData !== null) {
                echo json_encode(['success' => true, 'data' => $dbData]);
                return;
            }

            // 2) Fallback para arquivo config/pause_state.json
            $file = $this->configDir . DIRECTORY_SEPARATOR . 'pause_state.json';
            $default = [ 'paused' => false, 'message' => '' ];
            if (!is_file($file)) {
                echo json_encode(['success' => true, 'data' => $default]);
                return;
            }
            $content = @file_get_contents($file);
            if ($content === false) {
                echo json_encode(['success' => true, 'data' => $default]);
                return;
            }
            $json = json_decode($content, true);
            if (!is_array($json) || !array_key_exists('paused', $json)) $json = $default;
            $json['paused'] = (bool)($json['paused'] ?? false);
            $json['message'] = (string)($json['message'] ?? '');
            echo json_encode(['success' => true, 'data' => $json]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erro ao consultar estado de pausa', 'details' => $e->getMessage()]);
        }
    }

    /**
     * POST /api/settings/pause
     * Body JSON: { paused: boolean, message?: string }
     */
    public function savePauseState($input) {
        try {
            $paused = isset($input['paused']) ? (bool)$input['paused'] : null;
            $message = isset($input['message']) ? (string)$input['message'] : '';
            if ($paused === null) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Campo "paused" é obrigatório']);
                return;
            }

            // 1) Tenta salvar no banco
            $savedDb = $this->savePauseToDb($paused, $message);

            // 2) Fallback para arquivo
            if (!$savedDb) {
                if (!is_dir($this->configDir)) {
                    @mkdir($this->configDir, 0775, true);
                }
                $file = $this->configDir . DIRECTORY_SEPARATOR . 'pause_state.json';
                $data = [ 'paused' => $paused, 'message' => $message ];
                $ok = @file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
                if ($ok === false) {
                    throw new Exception('Não foi possível salvar o estado de pausa');
                }
            }

            echo json_encode(['success' => true]);

            // Notifica interessados via SSE (se disponível)
            if (class_exists('EventManager')) {
                \EventManager::emit('orders_pause_updated', [
                    'paused' => $paused,
                    'message' => $message
                ]);
            }
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erro ao salvar estado de pausa', 'details' => $e->getMessage()]);
        }
    }

    



    /**
     * GET /api/settings/mapbox-api-key
     * Não retorna a chave; apenas status (consulta no banco settings_delivery)
     */
    public function getMapboxApiKeyStatus() {
        try {
            if (!$this->db) {
                echo json_encode(['success' => true, 'exists' => false, 'length' => 0, 'masked' => '']);
                return;
            }
            $stmt = $this->db->query("SELECT mapbox_api_key FROM settings_delivery WHERE id = 1 LIMIT 1");
            $row = $stmt ? $stmt->fetch() : null;
            $key = $row ? trim((string)$row['mapbox_api_key']) : '';
            $exists = strlen($key) > 0;
            $length = $exists ? strlen($key) : 0;
            echo json_encode([
                'success' => true,
                'exists' => $exists,
                'length' => $length,
                'masked' => $exists ? str_repeat('*', max(4, min(12, $length))) : ''
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erro ao consultar chave do Mapbox', 'details' => $e->getMessage()]);
        }
    }

    /**
     * POST /api/settings/mapbox-api-key
     * Body JSON: { key: 'pk. ...' }
     */
    public function saveMapboxApiKey($input) {
        try {
            $key = $input['key'] ?? '';
            if (!is_string($key) || strlen(trim($key)) < 15) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Chave inválida']);
                return;
            }

            if (!$this->db) {
                throw new Exception('Banco de dados não disponível');
            }

            $sql = "INSERT INTO settings_delivery (id, origin_address, origin_lat, origin_lng, price_per_km, min_delivery_fee, expose_public_key, mapbox_api_key)
                    VALUES (1, '', 0, 0, 0.00, 0.00, 0, :key)
                    ON DUPLICATE KEY UPDATE mapbox_api_key = VALUES(mapbox_api_key)";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([':key' => trim($key)]);

            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erro ao salvar chave do Mapbox', 'details' => $e->getMessage()]);
        }
    }

    private function getPauseFromDb() {
        try {
            if (!$this->db) return null;
            // Tabela genérica de flags (se existir)
            $stmt = $this->db->prepare("SELECT flag_value, extra FROM settings_flags WHERE flag_key = :key LIMIT 1");
            $key = 'orders_paused';
            $stmt->execute([':key' => $key]);
            $row = $stmt->fetch();
            if (!$row) return null;
            $paused = (string)$row['flag_value'] === '1';
            $message = isset($row['extra']) ? (string)$row['extra'] : '';
            return [ 'paused' => $paused, 'message' => $message ];
        } catch (Exception $e) {
            return null;
        }
    }

    private function savePauseToDb($paused, $message) {
        try {
            if (!$this->db) return false;
            // Tenta criar/upsert em settings_flags (flag_key PK)
            $sql = "INSERT INTO settings_flags (flag_key, flag_value, extra, updated_at) VALUES (:k, :v, :e, CURRENT_TIMESTAMP)
                    ON DUPLICATE KEY UPDATE flag_value = VALUES(flag_value), extra = VALUES(extra), updated_at = CURRENT_TIMESTAMP";
            $stmt = $this->db->prepare($sql);
            return $stmt->execute([
                ':k' => 'orders_paused',
                ':v' => $paused ? '1' : '0',
                ':e' => (string)$message
            ]);
        } catch (Exception $e) {
            return false;
        }
    }
    private function getBusinessHoursFromDb() {
        try {
            if (!$this->db) return null;
            $stmt = $this->db->query("SELECT weekday, closed, open_time, close_time FROM settings_business_hours");
            $rows = $stmt->fetchAll();
            if (!$rows || count($rows) < 7) return null;
            $map = [];
            foreach ($rows as $r) {
                $map[$r['weekday']] = [
                    'closed' => (bool)$r['closed'],
                    'open' => substr($r['open_time'], 0, 5),
                    'close' => substr($r['close_time'], 0, 5)
                ];
            }
            $requiredDays = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
            foreach ($requiredDays as $day) { if (!isset($map[$day])) return null; }
            return $map;
        } catch (Exception $e) {
            return null;
        }
    }

    private function saveBusinessHoursToDb($input) {
        try {
            if (!$this->db) return false;
            $sql = "INSERT INTO settings_business_hours (weekday, closed, open_time, close_time) VALUES (:weekday, :closed, :open_time, :close_time)
                    ON DUPLICATE KEY UPDATE closed = VALUES(closed), open_time = VALUES(open_time), close_time = VALUES(close_time)";
            $stmt = $this->db->prepare($sql);
            $requiredDays = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
            foreach ($requiredDays as $weekday) {
                $cfg = $input[$weekday];
                $closed = !empty($cfg['closed']) ? 1 : 0;
                $open = (string)$cfg['open'] . ':00';
                $close = (string)$cfg['close'] . ':00';
                $stmt->execute([
                    ':weekday' => $weekday,
                    ':closed' => $closed,
                    ':open_time' => $open,
                    ':close_time' => $close
                ]);
            }
            return true;
        } catch (Exception $e) {
            return false;
        }
    }

    /**
     * GET /api/settings/company
     * Retorna dados da empresa a partir de config/company.json (defaults se ausente)
     */
    public function getCompanySettings() {
        try {
            $file = $this->configDir . DIRECTORY_SEPARATOR . 'company.json';
            $default = [
                'name' => '',
                'document' => '',
                'phone' => '',
                'email' => '',
                'logo_url' => '',
                'address' => [
                    'zip' => '',
                    'street' => '',
                    'number' => '',
                    'complement' => '',
                    'neighborhood' => '',
                    'city' => '',
                    'state' => ''
                ]
            ];
            if (!is_file($file)) {
                echo json_encode(['success' => true, 'data' => $default]);
                return;
            }
            $content = @file_get_contents($file);
            if ($content === false) {
                echo json_encode(['success' => true, 'data' => $default]);
                return;
            }
            $json = json_decode($content, true);
            if (!is_array($json)) $json = $default;
            // Sanitize/normalize
            $json['name'] = isset($json['name']) ? (string)$json['name'] : '';
            $json['document'] = isset($json['document']) ? (string)$json['document'] : '';
            $json['phone'] = isset($json['phone']) ? (string)$json['phone'] : '';
            $json['email'] = isset($json['email']) ? (string)$json['email'] : '';
            $json['logo_url'] = isset($json['logo_url']) ? (string)$json['logo_url'] : '';
            if (!isset($json['address']) || !is_array($json['address'])) $json['address'] = [];
            $addr = $json['address'];
            $json['address'] = [
                'zip' => isset($addr['zip']) ? (string)$addr['zip'] : '',
                'street' => isset($addr['street']) ? (string)$addr['street'] : '',
                'number' => isset($addr['number']) ? (string)$addr['number'] : '',
                'complement' => isset($addr['complement']) ? (string)$addr['complement'] : '',
                'neighborhood' => isset($addr['neighborhood']) ? (string)$addr['neighborhood'] : '',
                'city' => isset($addr['city']) ? (string)$addr['city'] : '',
                'state' => isset($addr['state']) ? (string)$addr['state'] : ''
            ];
            echo json_encode(['success' => true, 'data' => $json]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erro ao ler dados da empresa', 'details' => $e->getMessage()]);
        }
    }

    /**
     * POST /api/settings/company
     */
    public function saveCompanySettings($input) {
        try {
            if (!is_array($input)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Payload inválido']);
                return;
            }
            $name = isset($input['name']) ? trim((string)$input['name']) : '';
            $document = isset($input['document']) ? trim((string)$input['document']) : '';
            $phone = isset($input['phone']) ? trim((string)$input['phone']) : '';
            $email = isset($input['email']) ? trim((string)$input['email']) : '';
            $logoUrl = isset($input['logo_url']) ? trim((string)$input['logo_url']) : '';
            $address = isset($input['address']) && is_array($input['address']) ? $input['address'] : [];

            if ($name === '' || $phone === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Campos obrigatórios: nome e telefone']);
                return;
            }
            if ($email !== '' && strpos($email, '@') === false) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'E-mail inválido']);
                return;
            }

            $normalized = [
                'name' => $name,
                'document' => $document,
                'phone' => $phone,
                'email' => $email,
                'logo_url' => $logoUrl,
                'address' => [
                    'zip' => isset($address['zip']) ? (string)$address['zip'] : '',
                    'street' => isset($address['street']) ? (string)$address['street'] : '',
                    'number' => isset($address['number']) ? (string)$address['number'] : '',
                    'complement' => isset($address['complement']) ? (string)$address['complement'] : '',
                    'neighborhood' => isset($address['neighborhood']) ? (string)$address['neighborhood'] : '',
                    'city' => isset($address['city']) ? (string)$address['city'] : '',
                    'state' => isset($address['state']) ? (string)$address['state'] : ''
                ]
            ];

            if (!is_dir($this->configDir)) {
                @mkdir($this->configDir, 0775, true);
            }
            $file = $this->configDir . DIRECTORY_SEPARATOR . 'company.json';
            $ok = @file_put_contents($file, json_encode($normalized, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            if ($ok === false) {
                throw new Exception('Não foi possível salvar');
            }
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erro ao salvar dados da empresa', 'details' => $e->getMessage()]);
        }
    }

    /**
     * GET /api/settings/payment-methods
     */
    public function getPaymentMethods() {
        try {
            $file = $this->configDir . DIRECTORY_SEPARATOR . 'payment_methods.json';
            $default = [
                'pix' => [ 'enabled' => false, 'key' => '' ],
                'cash' => [ 'enabled' => true ],
                'credit' => [ 'enabled' => true ],
                'debit' => [ 'enabled' => true ],
                'notes' => ''
            ];
            if (!is_file($file)) {
                echo json_encode(['success' => true, 'data' => $default]);
                return;
            }
            $content = @file_get_contents($file);
            if ($content === false) {
                echo json_encode(['success' => true, 'data' => $default]);
                return;
            }
            $json = json_decode($content, true);
            if (!is_array($json)) $json = $default;
            // sanitize
            $json['pix'] = isset($json['pix']) && is_array($json['pix']) ? $json['pix'] : [];
            $json['pix'] = [
                'enabled' => !empty($json['pix']['enabled']) ? true : false,
                'key' => isset($json['pix']['key']) ? (string)$json['pix']['key'] : ''
            ];
            foreach (['cash','credit','debit'] as $m) {
                $json[$m] = isset($json[$m]) && is_array($json[$m]) ? $json[$m] : [];
                $json[$m] = [ 'enabled' => !empty($json[$m]['enabled']) ? true : false ];
            }
            $json['notes'] = isset($json['notes']) ? (string)$json['notes'] : '';

            echo json_encode(['success' => true, 'data' => $json]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erro ao ler métodos de pagamento', 'details' => $e->getMessage()]);
        }
    }

    /**
     * POST /api/settings/payment-methods
     */
    public function savePaymentMethods($input) {
        try {
            if (!is_array($input)) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Payload inválido']);
                return;
            }
            $pix = isset($input['pix']) && is_array($input['pix']) ? $input['pix'] : [];
            $pixEnabled = !empty($pix['enabled']);
            $pixKey = isset($pix['key']) ? trim((string)$pix['key']) : '';
            if ($pixEnabled && strlen($pixKey) <= 5) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Chave PIX obrigatória quando PIX estiver habilitado']);
                return;
            }
            $cashEnabled = !empty(($input['cash']['enabled'] ?? false));
            $creditEnabled = !empty(($input['credit']['enabled'] ?? false));
            $debitEnabled = !empty(($input['debit']['enabled'] ?? false));
            $notes = isset($input['notes']) ? (string)$input['notes'] : '';

            $normalized = [
                'pix' => [ 'enabled' => (bool)$pixEnabled, 'key' => $pixEnabled ? $pixKey : '' ],
                'cash' => [ 'enabled' => (bool)$cashEnabled ],
                'credit' => [ 'enabled' => (bool)$creditEnabled ],
                'debit' => [ 'enabled' => (bool)$debitEnabled ],
                'notes' => $notes,
            ];

            if (!is_dir($this->configDir)) {
                @mkdir($this->configDir, 0775, true);
            }
            $file = $this->configDir . DIRECTORY_SEPARATOR . 'payment_methods.json';
            $ok = @file_put_contents($file, json_encode($normalized, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            if ($ok === false) {
                throw new Exception('Não foi possível salvar');
            }
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erro ao salvar métodos de pagamento', 'details' => $e->getMessage()]);
        }
    }


    public function getMapboxPublicKey() {
        try {
            // LOG: Debug inicial
            error_log("DEBUG: getMapboxPublicKey iniciado");
            
            // NOTA: Chave pública do MapBox não requer autenticação - é pública por natureza
            // Removida verificação de autenticação para permitir acesso direto
            
            error_log("DEBUG: Acesso público permitido para chave pública");
            
            if (!$this->db) {
                error_log("DEBUG: Banco de dados não disponível");
                throw new Exception('Banco de dados não disponível');
            }
            
            error_log("DEBUG: Executando query no banco");
            $stmt = $this->db->query("SELECT mapbox_api_key FROM settings_delivery WHERE id = 1 LIMIT 1");
            $row = $stmt ? $stmt->fetch() : null;
            
            error_log("DEBUG: Query executada. Row encontrado: " . ($row ? 'SIM' : 'NAO'));
            
            $key = $row ? trim((string)$row['mapbox_api_key']) : '';
            
            error_log("DEBUG: Chave extraída - exists: " . ($key !== '' ? 'SIM' : 'NAO') . " length: " . strlen($key));
            
            if ($key === '') {
                error_log("DEBUG: Chave vazia - retornando 404");
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Chave não configurada']);
                return;
            }
            
            error_log("DEBUG: Retornando chave com sucesso - preview: " . substr($key, 0, 10) . "...");
            echo json_encode(['success' => true, 'public_key' => $key]);
        } catch (Exception $e) {
            error_log("DEBUG: Exceção capturada: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erro ao obter chave do Mapbox', 'details' => $e->getMessage()]);
        }
    }

    // === NOVOS ENDPOINTS: /api/settings/company-info ===
    public function getCompanyInfo() {
        try {
            if (session_status() === PHP_SESSION_NONE) { session_start(); }
            if (!isset($_SESSION['user_id'])) {
                http_response_code(401);
                echo json_encode(['error' => true, 'message' => 'Acesso não autorizado']);
                return;
            }
            if (!isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'admin') {
                http_response_code(403);
                echo json_encode(['error' => true, 'message' => 'Acesso negado. Apenas administradores.']);
                return;
            }
            if (!$this->db) { throw new Exception('Banco de dados não disponível'); }
            $stmt = $this->db->query("SELECT id, company_name, logo_url, company_color, latitude, longitude, address, zip_code, phone, cnpj, created_at, updated_at FROM company_info ORDER BY id ASC LIMIT 1");
            $row = $stmt ? $stmt->fetch() : null;
            if (!$row) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => 'Nenhum registro encontrado']);
                return;
            }
            // Normaliza tipos
            $row['latitude'] = (float)$row['latitude'];
            $row['longitude'] = (float)$row['longitude'];
            echo json_encode(['success' => true, 'data' => $row]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erro ao obter company_info', 'details' => $e->getMessage()]);
        }
    }

    public function saveCompanyInfo($input) {
        try {
            if (session_status() === PHP_SESSION_NONE) { session_start(); }
            if (!isset($_SESSION['user_id'])) {
                http_response_code(401);
                echo json_encode(['error' => true, 'message' => 'Acesso não autorizado']);
                return;
            }
            if (!isset($_SESSION['user_role']) || $_SESSION['user_role'] !== 'admin') {
                http_response_code(403);
                echo json_encode(['error' => true, 'message' => 'Acesso negado. Apenas administradores.']);
                return;
            }
            if (!$this->db) { throw new Exception('Banco de dados não disponível'); }

            $company_name = trim((string)($input['company_name'] ?? ''));
            $logo_url = isset($input['logo_url']) ? trim((string)$input['logo_url']) : null;
            $company_color = trim((string)($input['company_color'] ?? ''));
            $latitude = isset($input['latitude']) ? (float)$input['latitude'] : 0.0;
            $longitude = isset($input['longitude']) ? (float)$input['longitude'] : 0.0;
            $address = isset($input['address']) ? trim((string)$input['address']) : null;
            $zip_code = isset($input['zip_code']) ? trim((string)$input['zip_code']) : null;
            $phone = trim((string)($input['phone'] ?? ''));
            $cnpj = trim((string)($input['cnpj'] ?? ''));

            if ($company_name === '' || $phone === '' || $cnpj === '') {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Campos obrigatórios: company_name, phone, cnpj']);
                return;
            }
            if (!preg_match('/^#[0-9A-Fa-f]{6}$/', $company_color)) {
                $company_color = '#000000';
            }

            $sql = "INSERT INTO company_info (id, company_name, logo_url, company_color, latitude, longitude, address, zip_code, phone, cnpj, created_at, updated_at)
                    VALUES (1, :company_name, :logo_url, :company_color, :latitude, :longitude, :address, :zip_code, :phone, :cnpj, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ON DUPLICATE KEY UPDATE company_name = VALUES(company_name), logo_url = VALUES(logo_url), company_color = VALUES(company_color), latitude = VALUES(latitude), longitude = VALUES(longitude), address = VALUES(address), zip_code = VALUES(zip_code), phone = VALUES(phone), cnpj = VALUES(cnpj), updated_at = CURRENT_TIMESTAMP";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                ':company_name' => $company_name,
                ':logo_url' => $logo_url,
                ':company_color' => $company_color,
                ':latitude' => $latitude,
                ':longitude' => $longitude,
                ':address' => $address,
                ':zip_code' => $zip_code,
                ':phone' => $phone,
                ':cnpj' => $cnpj,
            ]);

            // Atualizar também settings_delivery com as mesmas coordenadas (origin_lat, origin_lng)
            if ($latitude !== 0.0 && $longitude !== 0.0) {
                $sqlDelivery = "UPDATE settings_delivery SET origin_lat = :latitude, origin_lng = :longitude WHERE id = 1";
                $stmtDelivery = $this->db->prepare($sqlDelivery);
                $stmtDelivery->execute([
                    ':latitude' => $latitude,
                    ':longitude' => $longitude
                ]);
            }

            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erro ao salvar company_info', 'details' => $e->getMessage()]);
        }
    }
}

?>


