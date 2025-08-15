<?php
/**
 * Controller para gerenciamento de pedidos
 */

class OrderController {
    private $db;
    
    public function __construct($database) {
        $this->db = $database;
    }
    
    /**
     * Retorna todos os pedidos
     */
    public function getAll() {
        try {
            // Listar do mais antigo para o mais novo
            $query = "SELECT * FROM orders ORDER BY created_at ASC";
            $stmt = $this->db->prepare($query);
            $stmt->execute();
            
            $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Busca os itens de cada pedido
            foreach ($orders as &$order) {
                $order['items'] = $this->getOrderItems($order['id']);
                $order['total_amount'] = (float) $order['total_amount'];
                $order['delivery_fee'] = (float) $order['delivery_fee'];
                $order['change_amount'] = (float) $order['change_amount'];
                $order['payment_value'] = $order['payment_value'] ? (float) $order['payment_value'] : null;
            }
            
            echo json_encode([
                'success' => true,
                'data' => $orders
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'error' => true,
                'message' => 'Erro ao buscar pedidos',
                'details' => $e->getMessage()
            ]);
        }
    }
    
    /**
     * Retorna pedidos por status
     */
    public function getByStatus($status) {
        try {
            $query = "SELECT * FROM orders WHERE status = :status ORDER BY created_at ASC";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':status', $status);
            $stmt->execute();
            
            $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Busca os itens de cada pedido
            foreach ($orders as &$order) {
                $order['items'] = $this->getOrderItems($order['id']);
                $order['total_amount'] = (float) $order['total_amount'];
                $order['delivery_fee'] = (float) $order['delivery_fee'];
                $order['change_amount'] = (float) $order['change_amount'];
                $order['payment_value'] = $order['payment_value'] ? (float) $order['payment_value'] : null;
            }
            
            echo json_encode([
                'success' => true,
                'data' => $orders
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'error' => true,
                'message' => 'Erro ao buscar pedidos por status',
                'details' => $e->getMessage()
            ]);
        }
    }
    
    /**
     * Retorna pedidos por data
     */
    public function getByDate($date) {
        try {
            // Listar do mais antigo para o mais novo
            $query = "SELECT * FROM orders WHERE DATE(created_at) = :date ORDER BY created_at ASC";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':date', $date);
            $stmt->execute();
            
            $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Busca os itens de cada pedido
            foreach ($orders as &$order) {
                $order['items'] = $this->getOrderItems($order['id']);
                $order['total_amount'] = (float) $order['total_amount'];
                $order['delivery_fee'] = (float) $order['delivery_fee'];
                $order['change_amount'] = (float) $order['change_amount'];
                $order['payment_value'] = $order['payment_value'] ? (float) $order['payment_value'] : null;
            }
            
            echo json_encode([
                'success' => true,
                'data' => $orders
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'error' => true,
                'message' => 'Erro ao buscar pedidos por data',
                'details' => $e->getMessage()
            ]);
        }
    }
    
    /**
     * Retorna um pedido específico por ID
     */
    public function getById($id) {
        try {
            $query = "SELECT * FROM orders WHERE id = :id";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
            
            $order = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($order) {
                $order['items'] = $this->getOrderItems($order['id']);
                $order['total_amount'] = (float) $order['total_amount'];
                $order['delivery_fee'] = (float) $order['delivery_fee'];
                $order['change_amount'] = (float) $order['change_amount'];
                $order['payment_value'] = $order['payment_value'] ? (float) $order['payment_value'] : null;
                
                echo json_encode([
                    'success' => true,
                    'data' => $order
                ]);
            } else {
                http_response_code(404);
                echo json_encode([
                    'error' => true,
                    'message' => 'Pedido não encontrado'
                ]);
            }
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'error' => true,
                'message' => 'Erro ao buscar pedido',
                'details' => $e->getMessage()
            ]);
        }
    }
    
    /**
     * Cria um novo pedido
     */
    public function create($data) {
        try {
            // Antes de qualquer coisa, verifica se pedidos estão pausados
            $pause = $this->getGlobalPauseState();
            if ($pause['paused'] === true) {
                http_response_code(503);
                echo json_encode([
                    'error' => true,
                    'message' => $pause['message'] !== '' ? $pause['message'] : 'Os pedidos estão temporariamente pausados.'
                ]);
                return;
            }

            // Validação dos dados obrigatórios
            $order_type = isset($data['order_type']) ? $data['order_type'] : 'delivery';
            $required_fields = ['customer_name', 'customer_phone', 'payment_method', 'items'];
            if ($order_type === 'delivery') {
                $required_fields[] = 'customer_address';
                // Validação de CEP (quando vier no endereço montado, opcionalmente podemos checar padrão)
            }
            foreach ($required_fields as $field) {
                if (empty($data[$field])) {
                    http_response_code(400);
                    echo json_encode([
                        'error' => true,
                        'message' => "Campo obrigatório: {$field}"
                    ]);
                    return;
                }
            }
            
            // Validação dos itens
            if (!is_array($data['items']) || count($data['items']) === 0) {
                http_response_code(400);
                echo json_encode([
                    'error' => true,
                    'message' => 'Pedido deve conter pelo menos um item'
                ]);
                return;
            }
            
            // Inicia transação
            $this->db->beginTransaction();
            
            try {
                // Gera número do pedido
                $order_number = $this->generateOrderNumber();
                
                // Calcula valores
                $subtotal = $data['subtotal'] ?? 0;
                $delivery_fee = $data['delivery_fee'] ?? 5.00;
                if ($order_type !== 'delivery') {
                    $delivery_fee = 0.00;
                }
                $total_amount = $subtotal + $delivery_fee;
                $change_amount = 0;
                
                if ($data['payment_method'] === 'dinheiro' && isset($data['payment_value']) && $data['payment_value'] > $total_amount) {
                    $change_amount = $data['payment_value'] - $total_amount;
                }
                
                // Insere o pedido
                $order_query = "INSERT INTO orders (
                                  order_number, status, customer_name, customer_phone, customer_address,
                                  customer_neighborhood, customer_reference, payment_method, payment_value,
                                  total_amount, change_amount, delivery_fee, notes, estimated_delivery_time
                                ) VALUES (
                                  :order_number, 'novo', :customer_name, :customer_phone, :customer_address,
                                  :customer_neighborhood, :customer_reference, :payment_method, :payment_value,
                                  :total_amount, :change_amount, :delivery_fee, :notes, :estimated_delivery_time
                                )";
                
                $order_stmt = $this->db->prepare($order_query);
                
                $order_stmt->bindParam(':order_number', $order_number);
                // Preparar valores para evitar problemas de referência
                $customer_neighborhood = $data['customer_neighborhood'] ?? '';
                $customer_reference = $data['customer_reference'] ?? '';
                $payment_value = $data['payment_value'] ?? null;
                $notes = $data['notes'] ?? '';
                $estimated_delivery_time = $data['estimated_delivery_time'] ?? 30;
                
                $order_stmt->bindParam(':customer_name', $data['customer_name']);
                $order_stmt->bindParam(':customer_phone', $data['customer_phone']);
                $order_stmt->bindParam(':customer_address', $data['customer_address']);
                $order_stmt->bindParam(':customer_neighborhood', $customer_neighborhood);
                $order_stmt->bindParam(':customer_reference', $customer_reference);
                $order_stmt->bindParam(':payment_method', $data['payment_method']);
                $order_stmt->bindParam(':payment_value', $payment_value);
                $order_stmt->bindParam(':total_amount', $total_amount);
                $order_stmt->bindParam(':change_amount', $change_amount);
                $order_stmt->bindParam(':delivery_fee', $delivery_fee);
                $order_stmt->bindParam(':notes', $notes);
                $order_stmt->bindParam(':estimated_delivery_time', $estimated_delivery_time, PDO::PARAM_INT);
                
                $order_stmt->execute();
                $order_id = $this->db->lastInsertId();
                
                // Insere os itens do pedido
                $item_query = "INSERT INTO order_items (
                                 order_id, product_id, product_name, product_price, quantity, subtotal, notes
                               ) VALUES (
                                 :order_id, :product_id, :product_name, :product_price, :quantity, :subtotal, :notes
                               )";
                
                $item_stmt = $this->db->prepare($item_query);
                
                foreach ($data['items'] as $item) {
                    $item_subtotal = $item['product_price'] * $item['quantity'];
                    $item_notes = $item['notes'] ?? '';
                    
                    $item_stmt->bindParam(':order_id', $order_id, PDO::PARAM_INT);
                    $item_stmt->bindParam(':product_id', $item['product_id'], PDO::PARAM_INT);
                    $item_stmt->bindParam(':product_name', $item['product_name']);
                    $item_stmt->bindParam(':product_price', $item['product_price']);
                    $item_stmt->bindParam(':quantity', $item['quantity'], PDO::PARAM_INT);
                    $item_stmt->bindParam(':subtotal', $item_subtotal);
                    $item_stmt->bindParam(':notes', $item_notes);
                    
                    $item_stmt->execute();
                }
                
                // Confirma a transação
                $this->db->commit();
                
                // Retorna resposta de sucesso
                echo json_encode([
                    'success' => true,
                    'message' => 'Pedido criado com sucesso',
                    'data' => [
                        'order_id' => $order_id,
                        'order_number' => $order_number,
                        'total_amount' => $total_amount
                    ]
                ]);
                
            } catch (Exception $e) {
                $this->db->rollback();
                throw $e;
            }
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'error' => true,
                'message' => 'Erro ao criar pedido',
                'details' => $e->getMessage()
            ]);
        }
    }
    
    /**
     * Atualiza um pedido (principalmente o status)
     */
    public function update($id, $data) {
        try {
            // Verifica se o pedido existe
            $check_query = "SELECT * FROM orders WHERE id = :id";
            $check_stmt = $this->db->prepare($check_query);
            $check_stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $check_stmt->execute();
            
            $current_order = $check_stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$current_order) {
                http_response_code(404);
                echo json_encode([
                    'error' => true,
                    'message' => 'Pedido não encontrado'
                ]);
                return;
            }
            
            // Prepara campos para atualização
            $update_fields = [];
            $params = [':id' => $id];
            
            // Status
            if (isset($data['status'])) {
                $valid_statuses = ['novo', 'aceito', 'producao', 'entrega', 'finalizado', 'cancelado'];
                if (!in_array($data['status'], $valid_statuses)) {
                    http_response_code(400);
                    echo json_encode([
                        'error' => true,
                        'message' => 'Status inválido'
                    ]);
                    return;
                }
                
                $update_fields[] = 'status = :status';
                $params[':status'] = $data['status'];
                
                // Atualiza timestamps baseado no status
                switch ($data['status']) {
                    case 'aceito':
                        if (!$current_order['accepted_at']) {
                            $update_fields[] = 'accepted_at = CURRENT_TIMESTAMP';
                        }
                        break;
                    case 'producao':
                        if (!$current_order['production_started_at']) {
                            $update_fields[] = 'production_started_at = CURRENT_TIMESTAMP';
                        }
                        break;
                    case 'entrega':
                        if (!$current_order['delivery_started_at']) {
                            $update_fields[] = 'delivery_started_at = CURRENT_TIMESTAMP';
                        }
                        break;
                    case 'finalizado':
                        if (!$current_order['completed_at']) {
                            $update_fields[] = 'completed_at = CURRENT_TIMESTAMP';
                        }
                        break;
                }
            }
            
            // Se vier motivo de cancelamento, anexa nos notes
            if (isset($data['cancellation_reason']) && trim($data['cancellation_reason']) !== '') {
                $reason = trim($data['cancellation_reason']);
                $update_fields[] = "notes = CONCAT(COALESCE(notes, ''), CASE WHEN COALESCE(notes, '') = '' THEN '' ELSE '\n' END, '[CANCELADO] Motivo: ', :cancel_reason)";
                $params[':cancel_reason'] = $reason;
            }
            
            // Calcula troco se necessário
            if (isset($data['payment_method']) && $data['payment_method'] === 'dinheiro' && isset($data['payment_value'])) {
                $payment_value = floatval($data['payment_value']);
                $total = floatval($current_order['total_amount']);
                $change_amount = $payment_value - $total;
                
                $update_fields[] = 'change_amount = :change_amount';
                $params[':change_amount'] = $change_amount;
            }

            // Outros campos atualizáveis
            $updatable_fields = ['customer_name', 'customer_phone', 'customer_address', 'customer_neighborhood', 'customer_reference', 'notes', 'estimated_delivery_time', 'order_type', 'payment_method', 'payment_value'];
            
            foreach ($updatable_fields as $field) {
                if (isset($data[$field])) {
                    $update_fields[] = "{$field} = :{$field}";
                    $params[":{$field}"] = $data[$field];
                }
            }
            
            if (empty($update_fields)) {
                http_response_code(400);
                echo json_encode([
                    'error' => true,
                    'message' => 'Nenhum campo para atualizar'
                ]);
                return;
            }
            
            // Adiciona timestamp de atualização
            $update_fields[] = 'updated_at = CURRENT_TIMESTAMP';
            
            $query = "UPDATE orders SET " . implode(', ', $update_fields) . " WHERE id = :id";
            $stmt = $this->db->prepare($query);
            
            if ($stmt->execute($params)) {
                // Retorna o pedido atualizado
                $this->getById($id);
            } else {
                http_response_code(500);
                echo json_encode([
                    'error' => true,
                    'message' => 'Erro ao atualizar pedido'
                ]);
            }
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'error' => true,
                'message' => 'Erro ao atualizar pedido',
                'details' => $e->getMessage()
            ]);
        }
    }
    
    /**
     * Atualiza apenas os itens de um pedido existente
     */
    public function updateItems($id, $data) {
        try {
            // Verifica se o pedido existe
            $check_query = "SELECT * FROM orders WHERE id = :id";
            $check_stmt = $this->db->prepare($check_query);
            $check_stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $check_stmt->execute();
            
            $current_order = $check_stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$current_order) {
                http_response_code(404);
                echo json_encode([
                    'error' => true,
                    'message' => 'Pedido não encontrado'
                ]);
                return;
            }
            
            // Inicia transação
            $this->db->beginTransaction();
            
            try {
                // Remove itens antigos
                $delete_items_query = "DELETE FROM order_items WHERE order_id = :order_id";
                $delete_stmt = $this->db->prepare($delete_items_query);
                $delete_stmt->bindParam(':order_id', $id);
                $delete_stmt->execute();
                
                // Insere novos itens
                $insert_items_query = "INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity, subtotal, notes) VALUES (:order_id, :product_id, :product_name, :product_price, :quantity, :subtotal, :notes)";
                $insert_stmt = $this->db->prepare($insert_items_query);
                
                $subtotal = 0;
                foreach ($data['items'] as $item) {
                    $item_subtotal = floatval($item['product_price'] ?? 0) * intval($item['quantity'] ?? 1);
                    $subtotal += $item_subtotal;

                    // Normaliza valores e tipos
                    $product_id = isset($item['product_id']) ? (int)$item['product_id'] : 0;
                    $product_name = isset($item['product_name']) ? (string)$item['product_name'] : '';
                    $product_price = isset($item['product_price']) ? (float)$item['product_price'] : 0.0;
                    $quantity = isset($item['quantity']) ? (int)$item['quantity'] : 1;
                    $notes = isset($item['notes']) ? (string)$item['notes'] : '';

                    $insert_stmt->bindParam(':order_id', $id, PDO::PARAM_INT);
                    $insert_stmt->bindValue(':product_id', $product_id, PDO::PARAM_INT);
                    $insert_stmt->bindValue(':product_name', $product_name, PDO::PARAM_STR);
                    $insert_stmt->bindValue(':product_price', number_format($product_price, 2, '.', ''), PDO::PARAM_STR);
                    $insert_stmt->bindValue(':quantity', $quantity, PDO::PARAM_INT);
                    $insert_stmt->bindValue(':subtotal', number_format((float)$item_subtotal, 2, '.', ''), PDO::PARAM_STR);
                    $insert_stmt->bindValue(':notes', $notes, PDO::PARAM_STR);

                    $result = $insert_stmt->execute();
                    if (!$result) {
                        throw new Exception("Erro ao inserir item: " . $product_name);
                    }
                }
                
                // Atualiza o total do pedido
                $delivery_fee = floatval($current_order['delivery_fee'] ?? 0);
                $total_amount = $subtotal + $delivery_fee;
                
                $update_query = "UPDATE orders SET total_amount = :total_amount, updated_at = CURRENT_TIMESTAMP WHERE id = :id";
                $update_stmt = $this->db->prepare($update_query);
                $update_stmt->bindParam(':total_amount', $total_amount);
                $update_stmt->bindParam(':id', $id);
                $update_stmt->execute();
                
                $this->db->commit();
                
                // Retorna o pedido atualizado
                $this->getById($id);
                
            } catch (Exception $e) {
                $this->db->rollBack();
                throw $e;
            }
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'error' => true,
                'message' => 'Erro ao atualizar itens do pedido',
                'details' => $e->getMessage()
            ]);
        }
    }
    
    /**
     * Exclui um pedido (soft delete)
     */
    public function delete($id) {
        try {
            // Verifica se o pedido existe
            $check_query = "SELECT id, status FROM orders WHERE id = :id";
            $check_stmt = $this->db->prepare($check_query);
            $check_stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $check_stmt->execute();
            
            $order = $check_stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$order) {
                http_response_code(404);
                echo json_encode([
                    'error' => true,
                    'message' => 'Pedido não encontrado'
                ]);
                return;
            }
            
            // Só permite cancelar pedidos que ainda não foram finalizados
            if ($order['status'] === 'finalizado') {
                http_response_code(400);
                echo json_encode([
                    'error' => true,
                    'message' => 'Não é possível cancelar pedido já finalizado'
                ]);
                return;
            }
            
            // Marca como cancelado
            $query = "UPDATE orders SET status = 'cancelado', updated_at = CURRENT_TIMESTAMP WHERE id = :id";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            
            if ($stmt->execute()) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Pedido cancelado com sucesso'
                ]);
            } else {
                http_response_code(500);
                echo json_encode([
                    'error' => true,
                    'message' => 'Erro ao cancelar pedido'
                ]);
            }
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'error' => true,
                'message' => 'Erro ao cancelar pedido',
                'details' => $e->getMessage()
            ]);
        }
    }
    
    /**
     * Busca os itens de um pedido
     */
    private function getOrderItems($order_id) {
        try {
            $query = "SELECT * FROM order_items WHERE order_id = :order_id ORDER BY id ASC";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':order_id', $order_id, PDO::PARAM_INT);
            $stmt->execute();
            
            $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Converte valores numéricos
            foreach ($items as &$item) {
                $item['product_price'] = (float) $item['product_price'];
                $item['subtotal'] = (float) $item['subtotal'];
                $item['quantity'] = (int) $item['quantity'];
            }
            
            return $items;
            
        } catch (Exception $e) {
            return [];
        }
    }
    
    /**
     * Gera um número único para o pedido
     */
    private function generateOrderNumber() {
        $timestamp = date('ymd');
        $random = str_pad(mt_rand(1, 9999), 4, '0', STR_PAD_LEFT);
        return $timestamp . $random;
    }

    /**
     * Retorna estado global de pausa (DB ou arquivo)
     */
    private function getGlobalPauseState() {
        // 1) Tenta banco de dados (tabela opcional settings_flags)
        try {
            if ($this->db) {
                $stmt = $this->db->prepare("SELECT flag_value, extra FROM settings_flags WHERE flag_key = :key LIMIT 1");
                $stmt->execute([':key' => 'orders_paused']);
                $row = $stmt->fetch();
                if ($row) {
                    $paused = (string)$row['flag_value'] === '1';
                    $message = isset($row['extra']) ? (string)$row['extra'] : '';
                    return [ 'paused' => $paused, 'message' => $message ];
                }
            }
        } catch (Exception $e) {
            // ignora e tenta arquivo
        }

        // 2) Fallback: arquivo de configuração
        try {
            $configDir = realpath(__DIR__ . '/../../config');
            if ($configDir === false) { $configDir = __DIR__ . '/../../config'; }
            $file = $configDir . DIRECTORY_SEPARATOR . 'pause_state.json';
            if (!is_file($file)) return [ 'paused' => false, 'message' => '' ];
            $content = @file_get_contents($file);
            if ($content === false) return [ 'paused' => false, 'message' => '' ];
            $json = json_decode($content, true);
            if (!is_array($json)) return [ 'paused' => false, 'message' => '' ];
            return [ 'paused' => (bool)($json['paused'] ?? false), 'message' => (string)($json['message'] ?? '') ];
        } catch (Exception $e) {
            return [ 'paused' => false, 'message' => '' ];
        }
    }
}
?>

