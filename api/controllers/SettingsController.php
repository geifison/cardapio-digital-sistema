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
     * GET /api/settings/google-api-key
     * Não retorna a chave; apenas status
     */
    public function getGoogleApiKeyStatus() {
        try {
            $file = $this->configDir . DIRECTORY_SEPARATOR . 'google_api_key.txt';
            $exists = is_file($file);
            $length = 0;
            if ($exists) {
                $content = @file_get_contents($file);
                if ($content !== false) {
                    $length = strlen(trim($content));
                }
            }
            echo json_encode([
                'success' => true,
                'exists' => $exists,
                'length' => $length,
                'masked' => $exists ? str_repeat('*', max(4, min(12, $length))) : ''
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erro ao consultar chave', 'details' => $e->getMessage()]);
        }
    }

    /**
     * POST /api/settings/google-api-key
     * Body JSON: { key: 'AIza...' }
     */
    public function saveGoogleApiKey($input) {
        try {
            $key = $input['key'] ?? '';
            if (!is_string($key) || strlen(trim($key)) < 15) {
                http_response_code(400);
                echo json_encode(['success' => false, 'message' => 'Chave inválida']);
                return;
            }

            if (!is_dir($this->configDir)) {
                @mkdir($this->configDir, 0775, true);
            }
            $file = $this->configDir . DIRECTORY_SEPARATOR . 'google_api_key.txt';
            $ok = @file_put_contents($file, trim($key));
            if ($ok === false) {
                throw new Exception('Não foi possível salvar a chave');
            }
            echo json_encode(['success' => true]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Erro ao salvar chave', 'details' => $e->getMessage()]);
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
}

?>


