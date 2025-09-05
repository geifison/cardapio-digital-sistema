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
                // payment_status como inteiro (0/1)
                $order['payment_status'] = isset($order['payment_status']) ? (int)$order['payment_status'] : 0;
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
                $order['payment_status'] = isset($order['payment_status']) ? (int)$order['payment_status'] : 0;
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
                $order['payment_status'] = isset($order['payment_status']) ? (int)$order['payment_status'] : 0;
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
                $order['payment_status'] = isset($order['payment_status']) ? (int)$order['payment_status'] : 0;
                
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
                
                // Recalcula subtotal no servidor (inclui extras por item quando enviados)
                $server_subtotal = 0.0;
                foreach ($data['items'] as $it) {
                    $unit_price = isset($it['product_price']) ? (float)$it['product_price'] : 0.0;
                    $qty = isset($it['quantity']) ? (int)$it['quantity'] : 1;
                    $extras_total_unit = 0.0;
                    if (isset($it['extras']) && is_array($it['extras'])) {
                        foreach ($it['extras'] as $ex) {
                            $extras_total_unit += (float)($ex['price'] ?? 0);
                        }
                    }
                    $server_subtotal += ($unit_price + $extras_total_unit) * $qty;
                }
                
                // Calcule valores
                $delivery_fee = $data['delivery_fee'] ?? 5.00;
                if ($order_type !== 'delivery') {
                    $delivery_fee = 0.00;
                }
                $total_amount = (float)$server_subtotal + (float)$delivery_fee;
                $change_amount = 0.0;
                
                if ($data['payment_method'] === 'dinheiro' && isset($data['payment_value']) && $data['payment_value'] > $total_amount) {
                    $change_amount = (float)$data['payment_value'] - (float)$total_amount;
                }
                
                // Insere o pedido
                $order_query = "INSERT INTO orders (
                                  order_number, status, order_type, customer_name, customer_phone, customer_address,
                                  customer_neighborhood, customer_reference, payment_method, payment_value, payment_status,
                                  total_amount, change_amount, delivery_fee, notes, estimated_delivery_time
                                ) VALUES (
                                  :order_number, 'novo', :order_type, :customer_name, :customer_phone, :customer_address,
                                  :customer_neighborhood, :customer_reference, :payment_method, :payment_value, :payment_status,
                                  :total_amount, :change_amount, :delivery_fee, :notes, :estimated_delivery_time
                                )";
                
                $order_stmt = $this->db->prepare($order_query);
                
                $order_stmt->bindParam(':order_number', $order_number);
                $order_stmt->bindParam(':order_type', $order_type);
                // Preparar valores para evitar problemas de referência
                $customer_neighborhood = $data['customer_neighborhood'] ?? '';
                $customer_reference = $data['customer_reference'] ?? '';
                $payment_value = $data['payment_value'] ?? null;
                $notes = $data['notes'] ?? '';
                $estimated_delivery_time = $data['estimated_delivery_time'] ?? 30;
                $payment_status = 0; // sempre inicia como não pago
                
                $order_stmt->bindParam(':customer_name', $data['customer_name']);
                $order_stmt->bindParam(':customer_phone', $data['customer_phone']);
                $order_stmt->bindParam(':customer_address', $data['customer_address']);
                $order_stmt->bindParam(':customer_neighborhood', $customer_neighborhood);
                $order_stmt->bindParam(':customer_reference', $customer_reference);
                $order_stmt->bindParam(':payment_method', $data['payment_method']);
                $order_stmt->bindParam(':payment_value', $payment_value);
                $order_stmt->bindParam(':payment_status', $payment_status, PDO::PARAM_INT);
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
                    $unit_price = isset($item['product_price']) ? (float)$item['product_price'] : 0.0;
                    $quantity = isset($item['quantity']) ? (int)$item['quantity'] : 1;

                    // Calcula extras por item (quando enviados)
                    $extras_total_unit = 0.0;
                    $extras_desc_parts = [];
                    if (isset($item['extras']) && is_array($item['extras'])) {
                        foreach ($item['extras'] as $ex) {
                            $ex_name = isset($ex['name']) ? (string)$ex['name'] : '';
                            $ex_price = isset($ex['price']) ? (float)$ex['price'] : 0.0;
                            $extras_total_unit += $ex_price;
                            if ($ex_name !== '') {
                                $extras_desc_parts[] = $ex_name . ' (+' . number_format($ex_price, 2, ',', '.') . ')';
                            }
                        }
                    }
                    $item_subtotal = ($unit_price + $extras_total_unit) * $quantity;
                    $base_notes = isset($item['notes']) ? (string)$item['notes'] : '';
                    $extras_text = !empty($extras_desc_parts) ? ("Extras: " . implode(', ', $extras_desc_parts)) : '';
                    $item_notes = trim($base_notes . ($base_notes && $extras_text ? "\n" : '') . $extras_text);
                    
                    $item_stmt->bindParam(':order_id', $order_id, PDO::PARAM_INT);
                    $item_stmt->bindParam(':product_id', $item['product_id'], PDO::PARAM_INT);
                    $item_stmt->bindParam(':product_name', $item['product_name']);
                    $item_stmt->bindValue(':product_price', number_format($unit_price, 2, '.', ''), PDO::PARAM_STR);
                    $item_stmt->bindParam(':quantity', $quantity, PDO::PARAM_INT);
                    $item_stmt->bindValue(':subtotal', number_format($item_subtotal, 2, '.', ''), PDO::PARAM_STR);
                    $item_stmt->bindParam(':notes', $item_notes);
                    
                    $item_stmt->execute();
                }
                
                // Confirma a transação
                $this->db->commit();
                
                // Emite evento SSE
                EventManager::emit('orders_updated', [
                    'action' => 'created',
                    'order_id' => (int)$order_id,
                    'status' => 'novo'
                ]);
                // Notifica microserviço de tempo real (não bloqueante)
                if (function_exists('notify_realtime')) {
                    try { notify_realtime('/novo-pedido', ['order_id' => (int)$order_id, 'status' => 'novo']); } catch (\Throwable $__) {}
                }
                
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

            // Atualização do status de pagamento
            if (isset($data['payment_status'])) {
                $newPaymentStatus = (int)$data['payment_status'];
                $currentPaymentStatus = isset($current_order['payment_status']) ? (int)$current_order['payment_status'] : 0;

                // Bloqueia regressão: não permitir voltar de pago (1) para não pago (0)
                if ($newPaymentStatus === 0 && $currentPaymentStatus === 1) {
                    http_response_code(400);
                    echo json_encode([
                        'error' => true,
                        'message' => 'Não é permitido reverter o status de pagamento para não pago'
                    ]);
                    return;
                }

                // Permite marcar como pago quando ainda não estiver pago
                if ($newPaymentStatus === 1 && $currentPaymentStatus !== 1) {
                    $update_fields[] = 'payment_status = :payment_status';
                    $params[':payment_status'] = 1;
                }
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
                // Emite evento SSE antes de responder
                $newStatus = isset($data['status']) ? (string)$data['status'] : null;
                EventManager::emit('orders_updated', [
                    'action' => 'updated',
                    'order_id' => (int)$id,
                    'status' => $newStatus
                ]);
                // Notifica microserviço de tempo real (não bloqueante)
                if (function_exists('notify_realtime')) {
                    try { notify_realtime('/atualizar-status', ['order_id' => (int)$id, 'status' => $newStatus]); } catch (\Throwable $__) {}
                }
                
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
                    $product_price = isset($item['product_price']) ? (float)$item['product_price'] : 0.0;
                    $quantity = isset($item['quantity']) ? (int)$item['quantity'] : 1;

                    // Calcula extras por item (quando enviados)
                    $extras_total_unit = 0.0;
                    $extras_desc_parts = [];
                    if (isset($item['extras']) && is_array($item['extras'])) {
                        foreach ($item['extras'] as $ex) {
                            $ex_name = isset($ex['name']) ? (string)$ex['name'] : '';
                            $ex_price = isset($ex['price']) ? (float)$ex['price'] : 0.0;
                            $extras_total_unit += $ex_price;
                            if ($ex_name !== '') {
                                $extras_desc_parts[] = $ex_name . ' (+' . number_format($ex_price, 2, ',', '.') . ')';
                            }
                        }
                    }

                    $item_subtotal = ($product_price + $extras_total_unit) * $quantity;
                    $subtotal += $item_subtotal;

                    // Normaliza valores e tipos
                    $product_id = isset($item['product_id']) ? (int)$item['product_id'] : 0;
                    $product_name = isset($item['product_name']) ? (string)$item['product_name'] : '';
                    $notes = isset($item['notes']) ? (string)$item['notes'] : '';
                    $extras_text = !empty($extras_desc_parts) ? ("Extras: " . implode(', ', $extras_desc_parts)) : '';
                    $item_notes = trim($notes . ($notes && $extras_text ? "\n" : '') . $extras_text);

                    $insert_stmt->bindParam(':order_id', $id, PDO::PARAM_INT);
                    $insert_stmt->bindValue(':product_id', $product_id, PDO::PARAM_INT);
                    $insert_stmt->bindValue(':product_name', $product_name, PDO::PARAM_STR);
                    $insert_stmt->bindValue(':product_price', number_format($product_price, 2, '.', ''), PDO::PARAM_STR);
                    $insert_stmt->bindValue(':quantity', $quantity, PDO::PARAM_INT);
                    $insert_stmt->bindValue(':subtotal', number_format((float)$item_subtotal, 2, '.', ''), PDO::PARAM_STR);
                    $insert_stmt->bindValue(':notes', $item_notes, PDO::PARAM_STR);

                    $result = $insert_stmt->execute();
                    if (!$result) {
                        throw new Exception("Erro ao inserir item: " . $product_name);
                    }
                }
                
                // Atualiza total_amount e delivery_fee se enviados
                $update_order_fields = [];
                $params = [':id' => $id];
                if (isset($data['delivery_fee'])) {
                    $update_order_fields[] = 'delivery_fee = :delivery_fee';
                    $params[':delivery_fee'] = $data['delivery_fee'];
                }
                if (isset($data['total_amount'])) {
                    $update_order_fields[] = 'total_amount = :total_amount';
                    $params[':total_amount'] = $data['total_amount'];
                } else {
                    // recalcula total usando delivery_fee atual do pedido e os itens
                    $get_fee_query = "SELECT delivery_fee FROM orders WHERE id = :id";
                    $get_fee_stmt = $this->db->prepare($get_fee_query);
                    $get_fee_stmt->bindParam(':id', $id, PDO::PARAM_INT);
                    $get_fee_stmt->execute();
                    $row = $get_fee_stmt->fetch(PDO::FETCH_ASSOC);
                    $delivery_fee = $row ? (float)$row['delivery_fee'] : 0.0;
                    $new_total = (float)$subtotal + (float)$delivery_fee;
                    $update_order_fields[] = 'total_amount = :total_amount';
                    $params[':total_amount'] = number_format($new_total, 2, '.', '');
                }

                if (!empty($update_order_fields)) {
                    $update_order_fields[] = 'updated_at = CURRENT_TIMESTAMP';
                    $update_order_query = "UPDATE orders SET " . implode(', ', $update_order_fields) . " WHERE id = :id";
                    $update_order_stmt = $this->db->prepare($update_order_query);
                    $update_order_stmt->execute($params);
                }

                $this->db->commit();

                EventManager::emit('orders_updated', [
                    'action' => 'items_updated',
                    'order_id' => (int)$id,
                    'status' => null
                ]);
                // Notifica microserviço de tempo real (não bloqueante)
                if (function_exists('notify_realtime')) {
                    try { notify_realtime('/atualizar-status', ['order_id' => (int)$id, 'status' => null]); } catch (\Throwable $__) {}
                }

                $this->getById($id);

            } catch (Exception $e) {
                $this->db->rollback();
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

    private function getOrderItems($order_id) {
        try {
            $query = "SELECT id, order_id, product_id, product_name, product_price, quantity, subtotal, notes, created_at FROM order_items WHERE order_id = :order_id ORDER BY id ASC";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':order_id', $order_id, PDO::PARAM_INT);
            $stmt->execute();

            $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($items as &$item) {
                $item['product_price'] = (float)$item['product_price'];
                $item['quantity'] = (int)$item['quantity'];
                $item['subtotal'] = (float)$item['subtotal'];
                // notes pode ser null
                if (!isset($item['notes'])) {
                    $item['notes'] = '';
                }
            }
            return $items;
        } catch (Exception $e) {
            // Em caso de erro ao carregar itens, retorne array vazio para não quebrar a listagem
            return [];
        }
    }

    private function generateOrderNumber() {
        // Formato: YYYYMMDD-XXXX (aleatório) para fácil leitura e unicidade
        $prefix = date('Ymd');
        $rand = strtoupper(substr(bin2hex(random_bytes(4)), 0, 4));
        return $prefix . '-' . $rand;
    }

    private function getGlobalPauseState() {
        // Tenta ler do banco (settings_flags: key 'orders_paused'), cai para arquivo JSON se falhar
        $default = ['paused' => false, 'message' => ''];
        try {
            $sql = "SELECT flag_value, extra FROM settings_flags WHERE flag_key = :key LIMIT 1";
            $stmt = $this->db->prepare($sql);
            $key = 'orders_paused';
            $stmt->bindParam(':key', $key, PDO::PARAM_STR);
            $stmt->execute();
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                $paused = (string)($row['flag_value'] ?? '0') === '1';
                $message = '';
                if (!empty($row['extra'])) {
                    $decoded = json_decode($row['extra'], true);
                    if (is_array($decoded) && isset($decoded['message'])) {
                        $message = (string)$decoded['message'];
                    }
                }
                return ['paused' => $paused, 'message' => $message];
            }
        } catch (Exception $e) {
            // ignora e tenta arquivo
        }

        // Fallback para arquivo de configuração
        try {
            $file = __DIR__ . '/../../config/pause_state.json';
            if (file_exists($file)) {
                $json = json_decode(file_get_contents($file), true);
                if (is_array($json) && array_key_exists('paused', $json)) {
                    return [
                        'paused' => (bool)$json['paused'],
                        'message' => isset($json['message']) ? (string)$json['message'] : ''
                    ];
                }
            }
        } catch (Exception $e) {
            // retorna default
        }
        return $default;
    }
    
    /**
     * Retorna apenas o status e informações básicas de um pedido para sincronização
     */
    public function getStatus($id) {
        try {
            $query = "SELECT id, order_number, status, created_at, updated_at, 
                            accepted_at, production_started_at, delivery_started_at, completed_at,
                            estimated_delivery_time, total_amount, payment_status 
                     FROM orders WHERE id = :id";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
            
            $order = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($order) {
                // Converte valores numéricos
                $order['total_amount'] = (float) $order['total_amount'];
                $order['payment_status'] = (int) $order['payment_status'];
                
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
                'message' => 'Erro ao buscar status do pedido',
                'details' => $e->getMessage()
            ]);
        }
    }
}

?>

