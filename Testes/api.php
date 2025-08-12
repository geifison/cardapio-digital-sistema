<?php
// api.php

header('Content-Type: application/json');

// --- Configuração do Banco de Dados ---
$servername = "127.0.0.1";
$username = "root";
$password = "";
$dbname = "cardapio_digital";

try {
    $conn = new PDO("mysql:host=$servername;dbname=$dbname;charset=utf8", $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Erro de conexão com o banco de dados.']);
    exit();
}

$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true);

switch ($action) {
    case 'update_status':
        handle_update_status($conn, $input);
        break;
    
    case 'get_new_orders':
        handle_get_new_orders($conn);
        break;

    default:
        echo json_encode(['success' => false, 'message' => 'Ação inválida.']);
        break;
}

function handle_update_status($conn, $input) {
    $orderId = $input['orderId'] ?? null;
    $status = $input['status'] ?? null;

    if (!$orderId || !$status) {
        echo json_encode(['success' => false, 'message' => 'Dados insuficientes.']);
        return;
    }

    // O status 'aceito' vem da UI, mas no banco pode ser 'producao' ou 'aceito'
    $db_status = $status;
    if ($status === 'aceito' || $status === 'producao') {
        $db_status = 'aceito'; // Ou 'producao', dependendo da sua lógica de negócio
    }

    try {
        if ($db_status === 'aceito') {
            $stmt = $conn->prepare("UPDATE orders SET status = :status, accepted_at = NOW() WHERE id = :id");
        } else {
            $stmt = $conn->prepare("UPDATE orders SET status = :status WHERE id = :id");
        }
        
        $stmt->bindParam(':status', $db_status);
        $stmt->bindParam(':id', $orderId, PDO::PARAM_INT);
        $stmt->execute();

        echo json_encode(['success' => true]);

    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Erro ao atualizar pedido: ' . $e->getMessage()]);
    }
}

function handle_get_new_orders($conn) {
    try {
        $stmt_orders = $conn->prepare("SELECT * FROM orders WHERE status = 'novo' ORDER BY created_at ASC");
        $stmt_orders->execute();
        $new_orders = $stmt_orders->fetchAll(PDO::FETCH_ASSOC);

        if (empty($new_orders)) {
            echo json_encode(['success' => true, 'data' => []]);
            return;
        }

        $order_ids = array_column($new_orders, 'id');
        $orders_by_id = [];
        foreach($new_orders as $order) {
            $orders_by_id[$order['id']] = $order;
            $orders_by_id[$order['id']]['items'] = [];
        }

        $placeholders = implode(',', array_fill(0, count($order_ids), '?'));
        $stmt_items = $conn->prepare("SELECT * FROM order_items WHERE order_id IN ($placeholders)");
        $stmt_items->execute($order_ids);
        $items = $stmt_items->fetchAll(PDO::FETCH_ASSOC);

        foreach ($items as $item) {
            if (isset($orders_by_id[$item['order_id']])) {
                $orders_by_id[$item['order_id']]['items'][] = $item;
            }
        }
        
        echo json_encode(['success' => true, 'data' => array_values($orders_by_id)]);

    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Erro ao buscar novos pedidos: ' . $e->getMessage()]);
    }
}

$conn = null;
?>
