<?php
// index.php

// --- Configuração do Banco de Dados ---
$servername = "127.0.0.1";
$username = "root";
$password = "";
$dbname = "cardapio_digital";

// --- Conexão e Busca dos Dados ---
try {
    $conn = new PDO("mysql:host=$servername;dbname=$dbname;charset=utf8", $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Busca todas as categorias para o filtro e para a lista
    $stmt_cat = $conn->prepare("SELECT id, name, active FROM categories ORDER BY display_order, name");
    $stmt_cat->execute();
    $categories = $stmt_cat->fetchAll(PDO::FETCH_ASSOC);

    // Prepara a busca de produtos
    $stmt_prod = $conn->prepare("SELECT id, name, price, active, category_id FROM products ORDER BY display_order, name");
    $stmt_prod->execute();
    $all_products = $stmt_prod->fetchAll(PDO::FETCH_ASSOC);

    // Agrupa os produtos por categoria
    $data = [];
    foreach ($categories as $category) {
        $category['products'] = array_filter($all_products, function($product) use ($category) {
            return $product['category_id'] == $category['id'];
        });
        $data[] = $category;
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
    <title>Página de Produtos</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
    <style>
        :root {
            --primary-color: #4f46e5; --primary-hover: #4338ca;
            --secondary-color: #10b981; --secondary-hover: #059669;
            --danger-color: #ef4444; --danger-hover: #dc2626;
            --gray-100: #f3f4f6; --gray-200: #e5e7eb; --gray-300: #d1d5db;
            --gray-400: #9ca3af; --gray-600: #4b5563; --gray-800: #1f2937;
            --white: #ffffff;
            --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
            --border-radius: 0.5rem;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif; background-color: var(--gray-100);
            color: var(--gray-800); line-height: 1.6;
        }
        .main-header {
            background-color: var(--white); padding: 1rem 2rem;
            display: flex; justify-content: space-between; align-items: center;
            box-shadow: var(--shadow); position: sticky; top: 0; z-index: 1000;
        }
        .header-title { font-size: 1.5rem; font-weight: 700; color: var(--gray-800); }
        .header-actions .btn { margin-left: 0.75rem; }
        .btn {
            padding: 0.6rem 1.2rem; border: none; border-radius: var(--border-radius);
            font-weight: 600; font-size: 0.9rem; cursor: pointer;
            transition: background-color 0.2s ease, transform 0.1s ease;
            text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem;
        }
        .btn:active { transform: scale(0.98); }
        .btn-primary { background-color: var(--primary-color); color: var(--white); }
        .btn-primary:hover { background-color: var(--primary-hover); }
        .btn-secondary { background-color: var(--secondary-color); color: var(--white); }
        .btn-secondary:hover { background-color: var(--secondary-hover); }
        
        /* --- Filtros --- */
        .filter-container {
            background-color: var(--white); padding: 1rem 2rem;
            display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;
            border-bottom: 1px solid var(--gray-200);
        }
        .filter-group { flex: 1; min-width: 180px; }
        .filter-group input, .filter-group select {
            width: 100%; padding: 0.6rem; font-size: 0.9rem;
            border: 1px solid var(--gray-300); border-radius: var(--border-radius);
            background-color: var(--white);
        }

        .main-container { padding: 2rem; max-width: 1200px; margin: 0 auto; }
        .accordion-item {
            background-color: var(--white); margin-bottom: 1rem;
            border-radius: var(--border-radius); box-shadow: var(--shadow);
            overflow: hidden; transition: opacity 0.3s, transform 0.3s;
        }
        .accordion-button {
            width: 100%; background-color: var(--white); border: none;
            padding: 1.25rem; text-align: left; cursor: pointer;
            display: flex; justify-content: space-between; align-items: center;
            transition: background-color 0.2s;
        }
        .accordion-button:hover { background-color: var(--gray-100); }
        .accordion-button.inactive-category .category-name-text {
            color: var(--danger-color); text-decoration: line-through;
        }
        .category-name {
            font-size: 1.1rem; font-weight: 600; color: var(--gray-800);
            display: flex; align-items: center; gap: 1rem;
        }
        .category-name .fa-chevron-down { transition: transform 0.3s ease; }
        .accordion-button.active .fa-chevron-down { transform: rotate(180deg); }
        .category-actions { display: flex; align-items: center; gap: 0.75rem; }
        .accordion-content {
            max-height: 0; overflow: hidden;
            transition: max-height 0.4s ease-out, padding 0.4s ease-out;
            background-color: #fafafa;
        }
        .product-list { list-style: none; padding: 0; border-top: 1px solid var(--gray-200); }
        .product-item {
            display: flex; justify-content: space-between; align-items: center;
            padding: 1rem 1.25rem; border-bottom: 1px solid var(--gray-200);
            transition: opacity 0.3s, transform 0.3s;
        }
        .product-item:last-child { border-bottom: none; }
        .product-item.inactive-product .product-details {
            color: var(--danger-color); text-decoration: line-through;
        }
        .product-details { font-weight: 500; }
        .product-price { color: var(--gray-600); font-weight: 400; margin-left: 1rem; }
        .product-actions { display: flex; align-items: center; gap: 0.75rem; }
        .switch { position: relative; display: inline-block; width: 44px; height: 24px; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider {
            position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
            background-color: var(--gray-200); transition: .4s; border-radius: 24px;
        }
        .slider:before {
            position: absolute; content: ""; height: 18px; width: 18px;
            left: 3px; bottom: 3px; background-color: white;
            transition: .4s; border-radius: 50%;
        }
        input:checked + .slider { background-color: var(--secondary-color); }
        input:checked + .slider:before { transform: translateX(20px); }
        
        /* --- Menu de Ações (3 pontinhos) --- */
        .actions-menu { position: relative; }
        .btn-icon {
            background: none; border: none; color: var(--gray-400); cursor: pointer;
            padding: 0.5rem; border-radius: 50%; font-size: 1rem;
            transition: background-color 0.2s, color 0.2s;
        }
        .btn-icon:hover { background-color: var(--gray-200); color: var(--gray-800); }
        .dropdown-menu {
            display: none; position: absolute; right: 0; top: 100%;
            background-color: var(--white); border-radius: var(--border-radius);
            box-shadow: var(--shadow); z-index: 10; min-width: 140px;
            overflow: hidden;
        }
        .dropdown-menu.show { display: block; }
        .dropdown-item {
            display: block; width: 100%; padding: 0.75rem 1rem;
            background: none; border: none; text-align: left; cursor: pointer;
            font-size: 0.9rem; color: var(--gray-800);
            transition: background-color 0.2s;
        }
        .dropdown-item:hover { background-color: var(--gray-100); }
        .dropdown-item i { margin-right: 0.75rem; color: var(--gray-400); }
        .dropdown-item.danger { color: var(--danger-color); }
        .dropdown-item.danger:hover { background-color: #fee2e2; }
        .dropdown-item.danger i { color: var(--danger-color); }

        /* --- Responsividade Aprimorada --- */
        @media (max-width: 768px) {
            .main-header {
                flex-direction: column;
                gap: 1rem;
                padding: 1rem;
            }
            .header-actions {
                display: flex;
                flex-wrap: wrap;
                justify-content: center;
                gap: 0.75rem;
                width: 100%;
            }
            .header-actions .btn {
                margin-left: 0;
                flex-grow: 1;
            }
            .filter-container {
                flex-direction: column;
                align-items: stretch;
                gap: 0.75rem;
                padding: 1rem;
            }
            .header-title {
                font-size: 1.3rem;
            }
            .main-container {
                padding: 1rem;
            }
            .accordion-button, .product-item {
                padding: 1rem;
            }
             .category-name {
                font-size: 1.05rem;
            }
        }

        @media (max-width: 480px) {
            .product-item {
                flex-direction: column;
                align-items: flex-start;
                gap: 1rem;
            }
            .product-actions {
                width: 100%;
                justify-content: flex-end;
            }
            .product-details {
                width: 100%;
            }
            .product-price {
                margin-left: 0;
                display: block;
                margin-top: 0.25rem;
                font-size: 0.9rem;
            }
            .header-actions .btn {
                font-size: 0.9rem;
            }
        }
    </style>
</head>
<body>

    <header class="main-header">
        <h1 class="header-title">Página de Produtos</h1>
        <div class="header-actions">
            <button class="btn btn-primary"><i class="fa-solid fa-plus"></i> Criar Categoria</button>
            <button class="btn btn-secondary"><i class="fa-solid fa-tag"></i> Criar Novo Produto</button>
        </div>
    </header>

    <div class="filter-container">
        <div class="filter-group">
            <input type="text" id="filter-name" placeholder="Buscar por nome do produto ou categoria...">
        </div>
        <div class="filter-group">
            <select id="filter-category">
                <option value="all">Todas as Categorias</option>
                <?php foreach ($categories as $category): ?>
                    <option value="<?= $category['id'] ?>"><?= htmlspecialchars($category['name']) ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="filter-group">
            <select id="filter-status">
                <option value="all">Todos os Status</option>
                <option value="active">Ativos</option>
                <option value="inactive">Pausados</option>
            </select>
        </div>
    </div>

    <main class="main-container" id="accordion-container">
        <?php if (empty($data)): ?>
            <p>Nenhuma categoria encontrada.</p>
        <?php else: ?>
            <?php foreach ($data as $category): ?>
                <div class="accordion-item" data-category-id="<?= $category['id'] ?>" data-category-name="<?= htmlspecialchars($category['name']) ?>" data-category-active="<?= $category['active'] ?>">
                    <div class="accordion-button <?= $category['active'] ? '' : 'inactive-category' ?>">
                        <span class="category-name">
                            <i class="fa-solid fa-chevron-down"></i>
                            <span class="category-name-text"><?= htmlspecialchars($category['name']) ?></span>
                        </span>
                        <div class="category-actions">
                            <div class="actions-menu">
                                <button class="btn-icon" data-action="toggle-menu" title="Mais opções"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                                <div class="dropdown-menu">
                                    <button class="dropdown-item" data-action="edit-category"><i class="fa-solid fa-pencil"></i> Editar</button>
                                    <button class="dropdown-item danger" data-action="delete-category"><i class="fa-solid fa-trash-can"></i> Apagar</button>
                                </div>
                            </div>
                            <label class="switch" title="<?= $category['active'] ? 'Desativar' : 'Ativar' ?>">
                                <input type="checkbox" <?= $category['active'] ? 'checked' : '' ?> data-action="toggle-category">
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>
                    <div class="accordion-content">
                        <ul class="product-list">
                            <?php if (empty($category['products'])): ?>
                                <li style="padding: 1rem 1.25rem; color: var(--gray-400);">Nenhum produto nesta categoria.</li>
                            <?php else: ?>
                                <?php foreach ($category['products'] as $product): ?>
                                    <li class="product-item <?= $product['active'] ? '' : 'inactive-product' ?>" data-product-id="<?= $product['id'] ?>" data-product-name="<?= htmlspecialchars($product['name']) ?>" data-product-active="<?= $product['active'] ?>">
                                        <div class="product-details">
                                            <span><?= htmlspecialchars($product['name']) ?></span>
                                            <span class="product-price">R$ <?= number_format($product['price'], 2, ',', '.') ?></span>
                                        </div>
                                        <div class="product-actions">
                                            <div class="actions-menu">
                                                <button class="btn-icon" data-action="toggle-menu" title="Mais opções"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                                                <div class="dropdown-menu">
                                                    <button class="dropdown-item" data-action="edit-product"><i class="fa-solid fa-pencil"></i> Editar</button>
                                                    <button class="dropdown-item danger" data-action="delete-product"><i class="fa-solid fa-trash-can"></i> Apagar</button>
                                                </div>
                                            </div>
                                            <label class="switch" title="<?= $product['active'] ? 'Desativar' : 'Ativar' ?>">
                                                <input type="checkbox" <?= $product['active'] ? 'checked' : '' ?> data-action="toggle-product">
                                                <span class="slider"></span>
                                            </label>
                                        </div>
                                    </li>
                                <?php endforeach; ?>
                            <?php endif; ?>
                        </ul>
                    </div>
                </div>
            <?php endforeach; ?>
        <?php endif; ?>
    </main>

    <script>
    document.addEventListener('DOMContentLoaded', function () {
        const accordionContainer = document.getElementById('accordion-container');
        const filterName = document.getElementById('filter-name');
        const filterCategory = document.getElementById('filter-category');
        const filterStatus = document.getElementById('filter-status');

        function applyFilters() {
            const nameQuery = filterName.value.toLowerCase();
            const categoryQuery = filterCategory.value;
            const statusQuery = filterStatus.value;

            document.querySelectorAll('.accordion-item').forEach(categoryItem => {
                const categoryId = categoryItem.dataset.categoryId;
                const categoryName = categoryItem.dataset.categoryName.toLowerCase();
                const categoryActive = categoryItem.dataset.categoryActive === '1';
                
                let categoryVisible = false;

                // Filtrar produtos dentro da categoria
                let visibleProductsCount = 0;
                categoryItem.querySelectorAll('.product-item').forEach(productItem => {
                    const productName = productItem.dataset.productName.toLowerCase();
                    const productActive = productItem.dataset.productActive === '1';

                    const nameMatch = productName.includes(nameQuery) || categoryName.includes(nameQuery);
                    const statusMatch = (statusQuery === 'all') || (statusQuery === 'active' && productActive) || (statusQuery === 'inactive' && !productActive);
                    
                    if (nameMatch && statusMatch) {
                        productItem.style.display = 'flex';
                        visibleProductsCount++;
                    } else {
                        productItem.style.display = 'none';
                    }
                });

                // Verificar se a categoria deve ser visível
                const categoryNameMatch = categoryName.includes(nameQuery);
                const categoryFilterMatch = categoryQuery === 'all' || categoryQuery === categoryId;
                const categoryStatusMatch = (statusQuery === 'all') || (statusQuery === 'active' && categoryActive) || (statusQuery === 'inactive' && !categoryActive);

                // Categoria é visível se:
                // 1. Corresponde ao filtro de categoria
                // 2. O nome da categoria corresponde à busca E o status corresponde
                // 3. OU tem produtos visíveis que correspondem à busca por nome e status
                if (categoryFilterMatch && ( (categoryNameMatch && categoryStatusMatch) || (visibleProductsCount > 0) ) ) {
                     categoryVisible = true;
                }

                categoryItem.style.display = categoryVisible ? 'block' : 'none';
            });
        }

        [filterName, filterCategory, filterStatus].forEach(el => el.addEventListener('input', applyFilters));

        if (accordionContainer) {
            accordionContainer.addEventListener('click', function(event) {
                const target = event.target;
                const accordionButton = target.closest('.accordion-button');
                const actionTarget = target.closest('[data-action]');

                // Lógica para abrir/fechar o acordeão
                if (accordionButton && !actionTarget) {
                    accordionButton.classList.toggle('active');
                    const content = accordionButton.nextElementSibling;
                    if (content.style.maxHeight) {
                        content.style.maxHeight = null;
                    } else {
                        content.style.maxHeight = content.scrollHeight + "px";
                    }
                }
                
                // Lógica para os botões de ação
                if (actionTarget) {
                    const action = actionTarget.dataset.action;

                    // Lógica para o menu de 3 pontinhos
                    if (action === 'toggle-menu') {
                        const dropdown = actionTarget.nextElementSibling;
                        // Fecha outros menus abertos
                        document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
                            if (menu !== dropdown) menu.classList.remove('show');
                        });
                        dropdown.classList.toggle('show');
                    } else {
                         // Ações de Categoria
                        const categoryItem = target.closest('.accordion-item');
                        if (categoryItem && action.includes('category')) {
                            handleCategoryAction(action, categoryItem.dataset.categoryId, actionTarget);
                        }
                        
                        // Ações de Produto
                        const productItem = target.closest('.product-item');
                        if (productItem && action.includes('product')) {
                            handleProductAction(action, productItem.dataset.productId, actionTarget);
                        }
                    }
                }
            });
        }
        
        // Fechar dropdown ao clicar fora
        window.addEventListener('click', function(event) {
            if (!event.target.closest('.actions-menu')) {
                document.querySelectorAll('.dropdown-menu.show').forEach(menu => menu.classList.remove('show'));
            }
        });

        function handleCategoryAction(action, id, element) {
            console.log(`Ação: ${action}, Categoria ID: ${id}`);
            if (action === 'toggle-category') {
                element.closest('.accordion-button').classList.toggle('inactive-category', !element.checked);
            } else if (action === 'delete-category') {
                if(confirm(`Tem certeza que deseja apagar a categoria ID ${id}?`)) alert('Categoria apagada (simulação)');
            } else if (action === 'edit-category') {
                alert(`Editar categoria ID ${id} (simulação)`);
            }
        }

        function handleProductAction(action, id, element) {
            console.log(`Ação: ${action}, Produto ID: ${id}`);
            if (action === 'toggle-product') {
                element.closest('.product-item').classList.toggle('inactive-product', !element.checked);
            } else if (action === 'delete-product') {
                if(confirm(`Tem certeza que deseja apagar o produto ID ${id}?`)) alert('Produto apagado (simulação)');
            } else if (action === 'edit-product') {
                alert(`Editar produto ID ${id} (simulação)`);
            }
        }
        
        document.querySelector('.btn-primary').addEventListener('click', () => alert('Abrir formulário para criar nova categoria (simulação).'));
        document.querySelector('.btn-secondary').addEventListener('click', () => alert('Abrir formulário para criar novo produto (simulação).'));

        applyFilters(); // Aplica os filtros na carga inicial
    });
    </script>
</body>
</html>
