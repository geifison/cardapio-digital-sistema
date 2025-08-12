<?php
// pedidos.php

// --- Configuração do Banco de Dados ---
$servername = "127.0.0.1";
$username = "root";
$password = "";
$dbname = "cardapio_digital";

function format_time_ago($datetime, $full = false) {
    if (!$datetime) return '';
    $now = new DateTime;
    $ago = new DateTime($datetime);
    $diff = $now->diff($ago);

    $diff->w = floor($diff->d / 7);
    $diff->d -= $diff->w * 7;

    $string = array(
        'y' => 'ano', 'm' => 'mês', 'w' => 'semana', 'd' => 'dia',
        'h' => 'hora', 'i' => 'minuto', 's' => 'segundo',
    );
    foreach ($string as $k => &$v) {
        if ($diff->$k) {
            $v = $diff->$k . ' ' . $v . ($diff->$k > 1 ? 's' : '');
        } else {
            unset($string[$k]);
        }
    }

    if (!$full) $string = array_slice($string, 0, 1);
    return $string ? 'há ' . implode(', ', $string) : 'agora';
}

// --- Conexão e Busca dos Dados (Lógica Refatorada) ---
try {
    $conn = new PDO("mysql:host=$servername;dbname=$dbname;charset=utf8", $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $stmt_orders = $conn->prepare("
        SELECT o.*, oi.id as item_id, oi.product_name, oi.quantity, oi.subtotal
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.status IN ('novo', 'aceito', 'producao', 'entrega', 'finalizado')
        ORDER BY o.created_at DESC, o.id, oi.id
    ");
    $stmt_orders->execute();
    $results = $stmt_orders->fetchAll(PDO::FETCH_ASSOC);

    $orders_by_id = [];
    foreach ($results as $row) {
        $order_id = $row['id'];
        if (!isset($orders_by_id[$order_id])) {
            // Copia todos os campos do pedido da linha atual
            $orders_by_id[$order_id] = $row;
            // Inicializa o array de itens
            $orders_by_id[$order_id]['items'] = [];
        }

        // Adiciona o item se ele existir (item_id não é nulo)
        if ($row['item_id'] !== null) {
            $orders_by_id[$order_id]['items'][] = [
                'id' => $row['item_id'],
                'product_name' => $row['product_name'],
                'quantity' => $row['quantity'],
                'subtotal' => $row['subtotal']
            ];
        }
    }
    
    // Agrupa os pedidos já montados por status
    $grouped_orders = ['novo' => [], 'producao' => [], 'entrega' => [], 'finalizado' => []];
    foreach ($orders_by_id as $order) {
        $status = $order['status'];
        if ($status === 'aceito') { $status = 'producao'; }
        if (array_key_exists($status, $grouped_orders)) {
            $grouped_orders[$status][] = $order;
        }
    }

} catch(PDOException $e) {
    die("Erro na conexão com o banco de dados: " . $e->getMessage());
}

$conn = null;
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Painel de Pedidos</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
    <style>
        :root {
            --primary-color: #4f46e5;
            --blue-light: #e0e7ff; --blue-dark: #3730a3;
            --yellow-light: #fef9c3; --yellow-dark: #ca8a04;
            --green-light: #dcfce7; --green-dark: #166534;
            --orange-light: #ffedd5; --orange-dark: #c2410c;
            --gray-100: #f3f4f6; --gray-200: #e5e7eb; --gray-400: #9ca3af;
            --gray-600: #4b5563; --gray-800: #1f2937; --white: #ffffff;
            --danger-color: #ef4444; --danger-dark: #b91c1c; --danger-light: #fee2e2;
            --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
            --border-radius: 0.75rem;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif; background-color: var(--gray-100);
            color: var(--gray-800); overflow-x: hidden;
        }
        .kanban-board {
            display: grid; grid-template-columns: repeat(4, 1fr);
            gap: 1.5rem; padding: 1.5rem; min-height: 100vh;
        }
        .kanban-column {
            background-color: var(--gray-200); border-radius: var(--border-radius);
            padding: 1rem; display: flex; flex-direction: column;
        }
        .kanban-column.drag-over { border: 2px dashed var(--primary-color); }
        .column-header {
            display: flex; align-items: center; padding: 0 0.5rem 1rem;
            border-bottom: 3px solid;
        }
        .column-title { font-size: 1.1rem; font-weight: 700; margin-left: 0.75rem; }
        .column-count {
            font-size: 0.9rem; font-weight: 600; padding: 0.15rem 0.5rem;
            border-radius: 1rem; margin-left: auto;
        }
        .column-cards { flex-grow: 1; padding-top: 1rem; min-height: 100px; }

        /* Column Colors */
        #column-novo .column-header { border-color: var(--blue-dark); color: var(--blue-dark); }
        #column-novo .column-count { background-color: var(--blue-light); color: var(--blue-dark); }
        #column-producao .column-header { border-color: var(--yellow-dark); color: var(--yellow-dark); }
        #column-producao .column-count { background-color: var(--yellow-light); color: var(--yellow-dark); }
        #column-entrega .column-header { border-color: var(--orange-dark); color: var(--orange-dark); }
        #column-entrega .column-count { background-color: var(--orange-light); color: var(--orange-dark); }
        #column-finalizado .column-header { border-color: var(--green-dark); color: var(--green-dark); }
        #column-finalizado .column-count { background-color: var(--green-light); color: var(--green-dark); }

        /* Kanban Card */
        .kanban-card {
            background-color: var(--white); border-radius: var(--border-radius);
            padding: 1rem; margin-bottom: 1rem; box-shadow: var(--shadow);
            cursor: grab; transition: transform 0.2s, box-shadow 0.2s, border-color 0.3s;
            border-left: 5px solid;
            animation: fade-in 0.5s ease-out;
        }
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .kanban-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
        }
        .kanban-card.dragging { opacity: 0.5; cursor: grabbing; }
        .kanban-card.overdue { border-left-color: var(--danger-dark); animation: pulse-red 2s infinite; }
        @keyframes pulse-red {
            0% { box-shadow: 0 0 0 0 rgba(185, 28, 28, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(185, 28, 28, 0); }
            100% { box-shadow: 0 0 0 0 rgba(185, 28, 28, 0); }
        }
        .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
        .order-number { font-weight: 700; font-size: 1.1rem; }
        .order-time { font-size: 0.8rem; color: var(--gray-400); }
        .production-timer { font-size: 0.8rem; font-weight: 600; color: var(--yellow-dark); }
        .production-timer.overdue-text { color: var(--danger-dark); }
        .customer-name { font-weight: 500; margin-bottom: 1rem; }
        .item-list { list-style: none; margin-bottom: 1rem; font-size: 0.9rem; color: var(--gray-600); }
        .item-list li { margin-bottom: 0.25rem; }
        .card-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--gray-200); padding-top: 0.75rem; }
        .payment-method { font-size: 0.8rem; font-weight: 600; padding: 0.25rem 0.6rem; border-radius: 1rem; }
        .total-amount { font-weight: 700; font-size: 1.1rem; }
        
        .card-actions { display: flex; gap: 0.5rem; margin-top: 1rem; border-top: 1px solid var(--gray-200); padding-top: 1rem; }
        .btn-action {
            flex-grow: 1; padding: 0.5rem; font-size: 0.8rem; font-weight: 600;
            border: none; border-radius: 0.5rem; cursor: pointer; transition: background-color 0.2s;
            display: flex; align-items: center; justify-content: center; gap: 0.5rem;
        }
        .btn-accept { background-color: var(--green-light); color: var(--green-dark); }
        .btn-accept:hover { background-color: #bbf7d0; }
        .btn-cancel { background-color: var(--danger-light); color: var(--danger-dark); }
        .btn-cancel:hover { background-color: #fecaca; }
        .btn-send { background-color: var(--blue-light); color: var(--blue-dark); }
        .btn-send:hover { background-color: #c7d2fe; }

        /* Card Colors by Payment */
        .kanban-card[data-payment="dinheiro"] { border-color: var(--green-dark); }
        .kanban-card[data-payment="dinheiro"] .payment-method { background-color: var(--green-light); color: var(--green-dark); }
        .kanban-card[data-payment="cartao"] { border-color: var(--blue-dark); }
        .kanban-card[data-payment="cartao"] .payment-method { background-color: var(--blue-light); color: var(--blue-dark); }
        .kanban-card[data-payment="pix"] { border-color: var(--primary-color); }
        .kanban-card[data-payment="pix"] .payment-method { background-color: #ede9fe; color: var(--primary-color); }

        /* Modal */
        .modal {
            display: none; position: fixed; z-index: 2000;
            left: 0; top: 0; width: 100%; height: 100%;
            overflow: auto; background-color: rgba(0,0,0,0.6);
            align-items: center; justify-content: center;
        }
        .modal.show { display: flex; }
        .modal-content {
            background-color: #fefefe; margin: auto; padding: 2rem;
            border: 1px solid #888; width: 90%; max-width: 600px;
            border-radius: var(--border-radius);
            animation: slide-down 0.4s ease-out;
        }
        @keyframes slide-down { from { transform: translateY(-30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .modal-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--gray-200); padding-bottom: 1rem; margin-bottom: 1rem; }
        .modal-title { font-size: 1.5rem; font-weight: 700; }
        .close-button { color: var(--gray-400); font-size: 2rem; font-weight: bold; cursor: pointer; }
        .close-button:hover { color: var(--danger-color); }
        .modal-body p { margin-bottom: 0.75rem; }
        .modal-body strong { color: var(--gray-800); }
        .modal-footer { margin-top: 1.5rem; text-align: right; }
        .btn-primary { background-color: var(--primary-color); color: var(--white); padding: 0.6rem 1.2rem; border-radius: 0.5rem; border: none; }
        .btn-primary:hover { background-color: #4338ca; }

        @media (max-width: 1200px) { .kanban-board { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 768px) {
            .kanban-board { grid-template-columns: 1fr; padding: 1rem; gap: 1rem; }
            .modal-content { width: 95%; padding: 1.5rem; }
            .modal-title { font-size: 1.25rem; }
        }
    </style>
</head>
<body>
    <audio id="notification-sound" src="https://www.myinstants.com/media/sounds/new-notification-on-your-device-13.mp3" preload="auto"></audio>
    <div class="kanban-board">
        <!-- Coluna Novos Pedidos -->
        <div class="kanban-column" id="column-novo" data-status="novo">
            <div class="column-header">
                <i class="fa-solid fa-bell fa-lg"></i>
                <h2 class="column-title">Novos Pedidos</h2>
                <span class="column-count"><?= count($grouped_orders['novo']) ?></span>
            </div>
            <div class="column-cards">
                <?php foreach($grouped_orders['novo'] as $order): ?>
                <div class="kanban-card" draggable="true" data-order-id="<?= $order['id'] ?>" data-payment="<?= $order['payment_method'] ?>">
                    <div class="card-content">
                        <div class="card-header">
                            <span class="order-number">#<?= htmlspecialchars($order['order_number']) ?></span>
                            <span class="order-time" data-created-at="<?= $order['created_at'] ?>"><?= format_time_ago($order['created_at']) ?></span>
                        </div>
                        <p class="customer-name"><?= htmlspecialchars($order['customer_name']) ?></p>
                        <ul class="item-list">
                            <?php foreach(array_slice($order['items'], 0, 3) as $item): ?>
                                <li><?= $item['quantity'] ?>x <?= htmlspecialchars($item['product_name']) ?></li>
                            <?php endforeach; if(count($order['items']) > 3): ?>
                                <li>... e mais <?= count($order['items']) - 3 ?></li>
                            <?php endif; ?>
                        </ul>
                        <div class="card-footer">
                            <span class="payment-method"><?= ucfirst($order['payment_method']) ?></span>
                            <span class="total-amount">R$ <?= number_format($order['total_amount'], 2, ',', '.') ?></span>
                        </div>
                    </div>
                    <div class="card-actions">
                        <button class="btn-action btn-cancel" data-action="cancel"><i class="fa-solid fa-xmark"></i> Cancelar</button>
                        <button class="btn-action btn-accept" data-action="accept"><i class="fa-solid fa-check"></i> Aceitar</button>
                    </div>
                    <div class="order-details-hidden" style="display:none;"><?= json_encode($order) ?></div>
                </div>
                <?php endforeach; ?>
            </div>
        </div>

        <!-- Coluna Em Produção -->
        <div class="kanban-column" id="column-producao" data-status="producao">
            <div class="column-header">
                <i class="fa-solid fa-kitchen-set fa-lg"></i>
                <h2 class="column-title">Em Produção</h2>
                <span class="column-count"><?= count($grouped_orders['producao']) ?></span>
            </div>
            <div class="column-cards">
                <?php foreach($grouped_orders['producao'] as $order): ?>
                <div class="kanban-card" draggable="true" data-order-id="<?= $order['id'] ?>" data-payment="<?= $order['payment_method'] ?>" data-accepted-at="<?= $order['accepted_at'] ?>" data-estimated-time="<?= $order['estimated_delivery_time'] ?>">
                    <div class="card-content">
                        <div class="card-header">
                            <span class="order-number">#<?= htmlspecialchars($order['order_number']) ?></span>
                            <span class="production-timer"></span>
                        </div>
                        <p class="customer-name"><?= htmlspecialchars($order['customer_name']) ?></p>
                        <ul class="item-list">
                             <?php foreach(array_slice($order['items'], 0, 3) as $item): ?>
                                <li><?= $item['quantity'] ?>x <?= htmlspecialchars($item['product_name']) ?></li>
                            <?php endforeach; if(count($order['items']) > 3): ?>
                                <li>... e mais <?= count($order['items']) - 3 ?></li>
                            <?php endif; ?>
                        </ul>
                        <div class="card-footer">
                            <span class="payment-method"><?= ucfirst($order['payment_method']) ?></span>
                            <span class="total-amount">R$ <?= number_format($order['total_amount'], 2, ',', '.') ?></span>
                        </div>
                    </div>
                    <div class="card-actions">
                        <button class="btn-action btn-cancel" data-action="cancel"><i class="fa-solid fa-xmark"></i> Cancelar</button>
                        <button class="btn-action btn-send" data-action="send"><i class="fa-solid fa-motorcycle"></i> Enviar</button>
                    </div>
                     <div class="order-details-hidden" style="display:none;"><?= json_encode($order) ?></div>
                </div>
                <?php endforeach; ?>
            </div>
        </div>

        <!-- Coluna A Caminho -->
        <div class="kanban-column" id="column-entrega" data-status="entrega">
            <div class="column-header">
                <i class="fa-solid fa-motorcycle fa-lg"></i>
                <h2 class="column-title">A Caminho</h2>
                <span class="column-count"><?= count($grouped_orders['entrega']) ?></span>
            </div>
            <div class="column-cards">
                <?php foreach($grouped_orders['entrega'] as $order): ?>
                <div class="kanban-card" draggable="true" data-order-id="<?= $order['id'] ?>" data-payment="<?= $order['payment_method'] ?>">
                    <div class="card-content">
                        <div class="card-header">
                            <span class="order-number">#<?= htmlspecialchars($order['order_number']) ?></span>
                            <span class="order-time" data-created-at="<?= $order['created_at'] ?>"><?= format_time_ago($order['created_at']) ?></span>
                        </div>
                        <p class="customer-name"><?= htmlspecialchars($order['customer_name']) ?></p>
                        <ul class="item-list">
                             <?php foreach(array_slice($order['items'], 0, 3) as $item): ?>
                                <li><?= $item['quantity'] ?>x <?= htmlspecialchars($item['product_name']) ?></li>
                            <?php endforeach; if(count($order['items']) > 3): ?>
                                <li>... e mais <?= count($order['items']) - 3 ?></li>
                            <?php endif; ?>
                        </ul>
                        <div class="card-footer">
                            <span class="payment-method"><?= ucfirst($order['payment_method']) ?></span>
                            <span class="total-amount">R$ <?= number_format($order['total_amount'], 2, ',', '.') ?></span>
                        </div>
                    </div>
                     <div class="order-details-hidden" style="display:none;"><?= json_encode($order) ?></div>
                </div>
                <?php endforeach; ?>
            </div>
        </div>
        
        <!-- Coluna Finalizados -->
        <div class="kanban-column" id="column-finalizado" data-status="finalizado">
            <div class="column-header">
                <i class="fa-solid fa-flag-checkered fa-lg"></i>
                <h2 class="column-title">Finalizados</h2>
                <span class="column-count"><?= count($grouped_orders['finalizado']) ?></span>
            </div>
            <div class="column-cards">
                 <?php foreach($grouped_orders['finalizado'] as $order): ?>
                <div class="kanban-card" draggable="true" data-order-id="<?= $order['id'] ?>" data-payment="<?= $order['payment_method'] ?>">
                    <div class="card-content">
                        <div class="card-header">
                            <span class="order-number">#<?= htmlspecialchars($order['order_number']) ?></span>
                            <span class="order-time" data-created-at="<?= $order['created_at'] ?>"><?= format_time_ago($order['created_at']) ?></span>
                        </div>
                        <p class="customer-name"><?= htmlspecialchars($order['customer_name']) ?></p>
                        <ul class="item-list">
                             <?php foreach(array_slice($order['items'], 0, 3) as $item): ?>
                                <li><?= $item['quantity'] ?>x <?= htmlspecialchars($item['product_name']) ?></li>
                            <?php endforeach; if(count($order['items']) > 3): ?>
                                <li>... e mais <?= count($order['items']) - 3 ?></li>
                            <?php endif; ?>
                        </ul>
                        <div class="card-footer">
                            <span class="payment-method"><?= ucfirst($order['payment_method']) ?></span>
                            <span class="total-amount">R$ <?= number_format($order['total_amount'], 2, ',', '.') ?></span>
                        </div>
                    </div>
                     <div class="order-details-hidden" style="display:none;"><?= json_encode($order) ?></div>
                </div>
                <?php endforeach; ?>
            </div>
        </div>
    </div>

    <!-- Modal -->
    <div id="order-modal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2 class="modal-title" id="modal-order-number"></h2>
                <span class="close-button">&times;</span>
            </div>
            <div class="modal-body">
                <p><strong>Cliente:</strong> <span id="modal-customer-name"></span></p>
                <p><strong>Telefone:</strong> <span id="modal-customer-phone"></span></p>
                <p><strong>Endereço:</strong> <span id="modal-customer-address"></span></p>
                <p><strong>Bairro:</strong> <span id="modal-customer-neighborhood"></span></p>
                <p><strong>Referência:</strong> <span id="modal-customer-reference"></span></p>
                <hr style="margin: 1rem 0; border: 0; border-top: 1px solid var(--gray-200);">
                <p><strong>Itens do Pedido:</strong></p>
                <ul id="modal-item-list" style="list-style: none; padding-left: 0;"></ul>
                <hr style="margin: 1rem 0; border: 0; border-top: 1px solid var(--gray-200);">
                <p><strong>Observações:</strong> <span id="modal-notes"></span></p>
                <p><strong>Total:</strong> <span id="modal-total-amount"></span></p>
                <p><strong>Pagamento:</strong> <span id="modal-payment-method"></span></p>
            </div>
            <div class="modal-footer">
                 <button class="btn btn-primary" id="modal-print-button"><i class="fa-solid fa-print"></i> Imprimir Pedido</button>
            </div>
        </div>
    </div>

    <script>
    document.addEventListener('DOMContentLoaded', function() {
        const board = document.querySelector('.kanban-board');
        const notificationSound = document.getElementById('notification-sound');
        let draggedCard = null;

        function initCard(card) {
            card.addEventListener('dragstart', () => {
                draggedCard = card;
                setTimeout(() => card.classList.add('dragging'), 0);
            });
            card.addEventListener('dragend', () => {
                draggedCard.classList.remove('dragging');
                draggedCard = null;
            });
            
            const cardContent = card.querySelector('.card-content');
            if (cardContent) {
                cardContent.addEventListener('click', () => openModal(card));
            }

            card.querySelector('[data-action="accept"]')?.addEventListener('click', () => acceptOrder(card));
            card.querySelector('[data-action="send"]')?.addEventListener('click', () => sendOrder(card));
            card.querySelector('[data-action="cancel"]')?.addEventListener('click', () => cancelOrder(card));
        }

        function setupDragAndDrop() {
            const cards = document.querySelectorAll('.kanban-card');
            const columns = document.querySelectorAll('.kanban-column');
            
            cards.forEach(initCard);

            columns.forEach(column => {
                column.addEventListener('dragover', e => {
                    e.preventDefault();
                    column.classList.add('drag-over');
                });
                column.addEventListener('dragleave', () => column.classList.remove('drag-over'));
                column.addEventListener('drop', e => {
                    e.preventDefault();
                    column.classList.remove('drag-over');
                    if (draggedCard) {
                        const targetStatus = column.dataset.status;
                        moveCardToColumn(draggedCard, column, targetStatus);
                    }
                });
            });
        }

        function moveCardToColumn(card, column, newStatus) {
            const cardContainer = column.querySelector('.column-cards');
            cardContainer.appendChild(card);
            updateOrderStatus(card.dataset.orderId, newStatus);
            updateAllColumnCounts();
        }

        async function acceptOrder(card) {
            const orderId = card.dataset.orderId;
            const response = await fetch(`api.php?action=update_status`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ orderId: orderId, status: 'aceito' })
            });
            const result = await response.json();
            if (result.success) {
                card.dataset.acceptedAt = new Date().toISOString();
                moveCardToColumn(card, document.getElementById('column-producao'), 'producao');
            } else {
                alert('Falha ao aceitar o pedido.');
            }
        }

        async function sendOrder(card) {
            const orderId = card.dataset.orderId;
            const response = await fetch(`api.php?action=update_status`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ orderId: orderId, status: 'entrega' })
            });
            const result = await response.json();
            if (result.success) {
                moveCardToColumn(card, document.getElementById('column-entrega'), 'entrega');
            } else {
                alert('Falha ao enviar o pedido.');
            }
        }

        async function cancelOrder(card) {
            const orderId = card.dataset.orderId;
            if (confirm(`Tem certeza que deseja cancelar o pedido #${orderId}?`)) {
                const response = await fetch(`api.php?action=update_status`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ orderId: orderId, status: 'cancelado' })
                });
                const result = await response.json();
                if (result.success) {
                    card.style.transition = "opacity 0.5s ease, transform 0.5s ease";
                    card.style.opacity = "0";
                    card.style.transform = "translateX(-50px)";
                    setTimeout(() => {
                        card.remove();
                        updateAllColumnCounts();
                    }, 500);
                } else {
                    alert('Falha ao cancelar o pedido.');
                }
            }
        }

        async function updateOrderStatus(orderId, newStatus) {
            console.log(`Pedido ${orderId} movido para ${newStatus}.`);
            await fetch(`api.php?action=update_status`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ orderId: orderId, status: newStatus })
            });
        }
        
        function updateAllColumnCounts() {
            document.querySelectorAll('.kanban-column').forEach(column => {
                const count = column.querySelectorAll('.kanban-card').length;
                column.querySelector('.column-count').textContent = count;
            });
        }

        // Modal
        const modal = document.getElementById('order-modal');
        const closeButton = modal.querySelector('.close-button');
        function openModal(card) {
            const details = JSON.parse(card.querySelector('.order-details-hidden').textContent);
            modal.querySelector('#modal-order-number').textContent = `#${details.order_number}`;
            modal.querySelector('#modal-customer-name').textContent = details.customer_name;
            modal.querySelector('#modal-customer-phone').textContent = details.customer_phone;
            modal.querySelector('#modal-customer-address').textContent = details.customer_address || 'Não informado';
            modal.querySelector('#modal-customer-neighborhood').textContent = details.customer_neighborhood || 'Não informado';
            modal.querySelector('#modal-customer-reference').textContent = details.customer_reference || 'Nenhuma';
            modal.querySelector('#modal-notes').textContent = details.notes || 'Nenhuma';
            modal.querySelector('#modal-total-amount').textContent = `R$ ${parseFloat(details.total_amount).toFixed(2).replace('.', ',')}`;
            modal.querySelector('#modal-payment-method').textContent = `${details.payment_method.charAt(0).toUpperCase() + details.payment_method.slice(1)}`;

            const itemList = modal.querySelector('#modal-item-list');
            itemList.innerHTML = '';
            details.items.forEach(item => {
                const li = document.createElement('li');
                li.textContent = `${item.quantity}x ${item.product_name} (R$ ${parseFloat(item.subtotal).toFixed(2).replace('.', ',')})`;
                itemList.appendChild(li);
            });
            modal.classList.add('show');
        }
        closeButton.onclick = () => modal.classList.remove('show');
        window.onclick = (event) => { if (event.target == modal) modal.classList.remove('show'); };
        modal.querySelector('#modal-print-button').onclick = () => alert('Simulando impressão do pedido...');

        // Timers
        function updateTimers() {
            document.querySelectorAll('#column-producao .kanban-card').forEach(card => {
                const acceptedAt = card.dataset.acceptedAt;
                const estimatedTime = parseInt(card.dataset.estimatedTime, 10) * 60;
                const timerEl = card.querySelector('.production-timer');
                if (acceptedAt && timerEl) {
                    const elapsedSeconds = Math.floor((new Date() - new Date(acceptedAt)) / 1000);
                    const minutes = Math.floor(elapsedSeconds / 60);
                    const seconds = elapsedSeconds % 60;
                    timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                    
                    if (estimatedTime > 0 && elapsedSeconds > estimatedTime) {
                        card.classList.add('overdue');
                        timerEl.classList.add('overdue-text');
                    }
                }
            });
        }
        
        // Real-time new orders
        async function fetchNewOrders() {
            const novoColumn = document.getElementById('column-novo');
            const existingOrderIds = [...novoColumn.querySelectorAll('.kanban-card')].map(c => c.dataset.orderId);

            const response = await fetch(`api.php?action=get_new_orders`);
            const newOrders = await response.json();

            if (newOrders.success && newOrders.data.length > 0) {
                let hasNew = false;
                newOrders.data.forEach(order => {
                    if (!existingOrderIds.includes(order.id)) {
                        hasNew = true;
                        const newCard = createCardElement(order);
                        novoColumn.querySelector('.column-cards').prepend(newCard);
                        initCard(newCard);
                    }
                });
                if(hasNew) {
                    notificationSound.play().catch(e => console.error("Erro ao tocar notificação:", e));
                    updateAllColumnCounts();
                }
            }
        }
        
        function createCardElement(order) {
            const card = document.createElement('div');
            card.className = 'kanban-card';
            card.draggable = true;
            card.dataset.orderId = order.id;
            card.dataset.payment = order.payment_method;

            let itemsHtml = '';
            order.items.forEach(item => {
                itemsHtml += `<li>${item.quantity}x ${item.product_name}</li>`;
            });

            card.innerHTML = `
                <div class="card-content">
                    <div class="card-header">
                        <span class="order-number">#${order.order_number}</span>
                        <span class="order-time" data-created-at="${order.created_at}">agora</span>
                    </div>
                    <p class="customer-name">${order.customer_name}</p>
                    <ul class="item-list">${itemsHtml}</ul>
                    <div class="card-footer">
                        <span class="payment-method">${order.payment_method.charAt(0).toUpperCase() + order.payment_method.slice(1)}</span>
                        <span class="total-amount">R$ ${parseFloat(order.total_amount).toFixed(2).replace('.', ',')}</span>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="btn-action btn-cancel" data-action="cancel"><i class="fa-solid fa-xmark"></i> Cancelar</button>
                    <button class="btn-action btn-accept" data-action="accept"><i class="fa-solid fa-check"></i> Aceitar</button>
                </div>
                <div class="order-details-hidden" style="display:none;">${JSON.stringify(order)}</div>
            `;
            return card;
        }

        setupDragAndDrop();
        setInterval(updateTimers, 1000);
        setInterval(fetchNewOrders, 15000); // Verifica novos pedidos a cada 15 segundos
    });
    </script>
</body>
</html>
