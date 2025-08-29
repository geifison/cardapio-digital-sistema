<?php
/**
 * Controller para gerenciamento de produtos
 */

class ProductController {
    private $pdo;
    
    public function __construct($pdo) {
        $this->pdo = $pdo;
    }
    
    /**
     * Lista todos os produtos com informações da categoria
     */
    public function index() {
        try {
            // Admin: lista todos os produtos, mas evita categorias inativas se explicitado via query (?exclude_inactive_categories=true)
            $excludeInactiveCategories = isset($_GET['exclude_inactive_categories']) && (($_GET['exclude_inactive_categories'] === 'true') || ($_GET['exclude_inactive_categories'] === '1'));
            $sql = "SELECT p.*, c.name as category_name 
                    FROM products p 
                    LEFT JOIN categories c ON p.category_id = c.id ";
            if ($excludeInactiveCategories) {
                $sql .= " WHERE (c.active = 1 OR c.id IS NULL) ";
            }
            $sql .= " ORDER BY p.display_order ASC, p.name ASC";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute();
            $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo json_encode([
                'success' => true,
                'data' => $products
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Erro ao listar produtos: ' . $e->getMessage()
            ]);
        }
    }

    /**
     * Lista produtos por categoria
     * - Se nenhum filtro extra for informado, retorna todos os produtos da categoria
     * - Mantém a compatibilidade com o admin que chama /products?category_id=ID
     */
    public function getByCategory($categoryId) {
        try {
            $sql = "SELECT p.*, c.name as category_name 
                    FROM products p 
                    LEFT JOIN categories c ON p.category_id = c.id 
                    WHERE p.category_id = :category_id ";

            // Opcional: permitir filtrar apenas ativos via query (?active=true)
            $activeOnly = isset($_GET['active']) && ($_GET['active'] === 'true' || $_GET['active'] === '1');
            if ($activeOnly) {
                $sql .= " AND p.active = 1";
            }

            // Se a categoria estiver inativa e activeOnly for true, não retornar produtos
            if ($activeOnly) {
                $sql .= " AND (c.active = 1 OR c.id IS NULL)";
            }

            $sql .= " ORDER BY p.display_order ASC, p.name ASC";

            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([':category_id' => $categoryId]);
            $products = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode([
                'success' => true,
                'data' => $products
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Erro ao listar produtos por categoria: ' . $e->getMessage()
            ]);
        }
    }
    
    /**
     * Busca um produto específico
     */
    public function show($id) {
        try {
            $sql = "SELECT p.*, c.name as category_name 
                    FROM products p 
                    LEFT JOIN categories c ON p.category_id = c.id 
                    WHERE p.id = :id";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([':id' => $id]);
            $product = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$product) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Produto não encontrado'
                ]);
                return;
            }
            
            // Se for pizza, carregar configurações disponíveis
            if ($product['product_type'] === 'pizza') {
                $product['pizza_sizes'] = $this->getPizzaSizes($id);
                $product['pizza_flavors'] = $this->getPizzaFlavors($id);
                $product['pizza_borders'] = $this->getPizzaBorders($id);
                $product['pizza_extras'] = $this->getPizzaExtras($id);
            }
            
            echo json_encode([
                'success' => true,
                'data' => $product
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Erro ao buscar produto: ' . $e->getMessage()
            ]);
        }
    }
    
    /**
     * Cria um novo produto
     */
    public function create($data) {
        try {
            // Validações
            if (empty($data['name'])) {
                throw new Exception('Nome do produto é obrigatório');
            }
            
            if (empty($data['category_id'])) {
                throw new Exception('Categoria é obrigatória');
            }
            
            // Para produtos tipo pizza, o preço pode ser 0 (calculado dinamicamente)
            $product_type = $data['product_type'] ?? 'comum';
            $price = $data['price'] ?? 0;
            
            if (!isset($data['price'])) {
                throw new Exception('Preço é obrigatório');
            }
            
            if ($price <= 0 && $product_type !== 'pizza') {
                throw new Exception('Preço deve ser maior que zero para produtos comuns');
            }
            
            // Verificar se a categoria existe
            $cat_sql = "SELECT id FROM categories WHERE id = :id";
            $cat_stmt = $this->pdo->prepare($cat_sql);
            $cat_stmt->execute([':id' => $data['category_id']]);
            if (!$cat_stmt->fetch()) {
                throw new Exception('Categoria não encontrada');
            }
            
            $sql = "INSERT INTO products (
                category_id, name, description, price, image_url, display_order,
                active, is_vegetarian, is_vegan, is_gluten_free, is_spicy, preparation_time, product_type
            ) VALUES (
                :category_id, :name, :description, :price, :image_url, :display_order,
                :active, :is_vegetarian, :is_vegan, :is_gluten_free, :is_spicy, :preparation_time, :product_type
            )";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                ':category_id' => $data['category_id'],
                ':name' => $data['name'],
                ':description' => $data['description'] ?? '',
                ':price' => $data['price'],
                ':image_url' => $data['image_url'] ?? '',
                ':display_order' => $data['display_order'] ?? 0,
                ':active' => isset($data['active']) ? (bool)$data['active'] : true,
                ':is_vegetarian' => isset($data['is_vegetarian']) ? (bool)$data['is_vegetarian'] : false,
                ':is_vegan' => isset($data['is_vegan']) ? (bool)$data['is_vegan'] : false,
                ':is_gluten_free' => isset($data['is_gluten_free']) ? (bool)$data['is_gluten_free'] : false,
                ':is_spicy' => isset($data['is_spicy']) ? (bool)$data['is_spicy'] : false,
                ':preparation_time' => $data['preparation_time'] ?? 0,
                ':product_type' => $data['product_type'] ?? 'comum'
            ]);
            
            $product_id = $this->pdo->lastInsertId();
            
            // Se for pizza, salvar configurações selecionadas
            if (($data['product_type'] ?? 'comum') === 'pizza') {
                if (isset($data['pizza_sizes']) && is_array($data['pizza_sizes'])) {
                    $this->savePizzaSizes($product_id, $data['pizza_sizes']);
                }
                if (isset($data['pizza_flavors']) && is_array($data['pizza_flavors'])) {
                    $this->savePizzaFlavors($product_id, $data['pizza_flavors']);
                }
                if (isset($data['pizza_borders']) && is_array($data['pizza_borders'])) {
                    $this->savePizzaBorders($product_id, $data['pizza_borders']);
                }
                if (isset($data['pizza_extras']) && is_array($data['pizza_extras'])) {
                    $this->savePizzaExtras($product_id, $data['pizza_extras']);
                }
            }
            
            // Emite evento para frontend atualizar
            if (class_exists('EventManager')) {
                EventManager::emit('products_updated', ['action' => 'created', 'product_id' => $product_id]);
            }

            echo json_encode([
                'success' => true,
                'message' => 'Produto criado com sucesso',
                'data' => ['id' => $product_id]
            ]);
        } catch (Exception $e) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);
        }
    }
    
    /**
     * Atualiza um produto existente
     */
    public function update($id, $data) {
        try {
            // Verificar se o produto existe
            $check_sql = "SELECT id FROM products WHERE id = :id";
            $check_stmt = $this->pdo->prepare($check_sql);
            $check_stmt->execute([':id' => $id]);
            if (!$check_stmt->fetch()) {
                throw new Exception('Produto não encontrado');
            }
            
            // Validações
            if (empty($data['name'])) {
                throw new Exception('Nome do produto é obrigatório');
            }
            
            if (empty($data['category_id'])) {
                throw new Exception('Categoria é obrigatória');
            }
            
            // Para produtos tipo pizza, o preço pode ser 0 (calculado dinamicamente)
            $product_type = $data['product_type'] ?? 'comum';
            $price = $data['price'] ?? 0;
            
            if (!isset($data['price'])) {
                throw new Exception('Preço é obrigatório');
            }
            
            if ($price <= 0 && $product_type !== 'pizza') {
                throw new Exception('Preço deve ser maior que zero para produtos comuns');
            }
            
            // Verificar se a categoria existe
            $cat_sql = "SELECT id FROM categories WHERE id = :id";
            $cat_stmt = $this->pdo->prepare($cat_sql);
            $cat_stmt->execute([':id' => $data['category_id']]);
            if (!$cat_stmt->fetch()) {
                throw new Exception('Categoria não encontrada');
            }
            
            $sql = "UPDATE products SET 
                category_id = :category_id,
                name = :name,
                description = :description,
                price = :price,
                image_url = :image_url,
                display_order = :display_order,
                active = :active,
                is_vegetarian = :is_vegetarian,
                is_vegan = :is_vegan,
                is_gluten_free = :is_gluten_free,
                is_spicy = :is_spicy,
                preparation_time = :preparation_time,
                product_type = :product_type,
                updated_at = CURRENT_TIMESTAMP
                WHERE id = :id";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                ':id' => $id,
                ':category_id' => $data['category_id'],
                ':name' => $data['name'],
                ':description' => $data['description'] ?? '',
                ':price' => $data['price'],
                ':image_url' => $data['image_url'] ?? '',
                ':display_order' => $data['display_order'] ?? 0,
                ':active' => isset($data['active']) ? (bool)$data['active'] : true,
                ':is_vegetarian' => isset($data['is_vegetarian']) ? (bool)$data['is_vegetarian'] : false,
                ':is_vegan' => isset($data['is_vegan']) ? (bool)$data['is_vegan'] : false,
                ':is_gluten_free' => isset($data['is_gluten_free']) ? (bool)$data['is_gluten_free'] : false,
                ':is_spicy' => isset($data['is_spicy']) ? (bool)$data['is_spicy'] : false,
                ':preparation_time' => $data['preparation_time'] ?? 0,
                ':product_type' => $data['product_type'] ?? 'comum'
            ]);
            
            // Se for pizza, atualizar configurações selecionadas
            if (($data['product_type'] ?? 'comum') === 'pizza') {
                // Remove configurações antigas
                $this->deletePizzaConfigurations($id);
                
                // Salva novas configurações se houver
                if (isset($data['pizza_sizes']) && is_array($data['pizza_sizes'])) {
                    $this->savePizzaSizes($id, $data['pizza_sizes']);
                }
                if (isset($data['pizza_flavors']) && is_array($data['pizza_flavors'])) {
                    $this->savePizzaFlavors($id, $data['pizza_flavors']);
                }
                if (isset($data['pizza_borders']) && is_array($data['pizza_borders'])) {
                    $this->savePizzaBorders($id, $data['pizza_borders']);
                }
                if (isset($data['pizza_extras']) && is_array($data['pizza_extras'])) {
                    $this->savePizzaExtras($id, $data['pizza_extras']);
                }
            }
            
            // Emite evento para frontend atualizar
            if (class_exists('EventManager')) {
                EventManager::emit('products_updated', ['action' => 'updated', 'product_id' => $id]);
            }

            echo json_encode([
                'success' => true,
                'message' => 'Produto atualizado com sucesso'
            ]);
        } catch (Exception $e) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);
        }
    }
    
    /**
     * Remove um produto
     */
    public function delete($id) {
        try {
            // Verificar se o produto existe
            $check_sql = "SELECT id FROM products WHERE id = :id";
            $check_stmt = $this->pdo->prepare($check_sql);
            $check_stmt->execute([':id' => $id]);
            if (!$check_stmt->fetch()) {
                throw new Exception('Produto não encontrado');
            }
            
            // Verificar se o produto está sendo usado em pedidos
            $order_sql = "SELECT COUNT(*) as count FROM order_items WHERE product_id = :id";
            $order_stmt = $this->pdo->prepare($order_sql);
            $order_stmt->execute([':id' => $id]);
            $order_count = $order_stmt->fetch(PDO::FETCH_ASSOC)['count'];
            
            if ($order_count > 0) {
                throw new Exception('Não é possível excluir o produto pois ele está sendo usado em pedidos. Considere pausá-lo em vez de excluí-lo.');
            }
            
            $sql = "DELETE FROM products WHERE id = :id";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([':id' => $id]);
            
            // Emite evento para frontend atualizar
            if (class_exists('EventManager')) {
                EventManager::emit('products_updated', ['action' => 'deleted', 'product_id' => $id]);
            }

            echo json_encode([
                'success' => true,
                'message' => 'Produto removido com sucesso'
            ]);
        } catch (Exception $e) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);
        }
    }
    
    /**
     * Pausa/despausa um produto
     */
    public function toggleStatus($id) {
        try {
            // Verificar se o produto existe
            $check_sql = "SELECT id, active FROM products WHERE id = :id";
            $check_stmt = $this->pdo->prepare($check_sql);
            $check_stmt->execute([':id' => $id]);
            $product = $check_stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$product) {
                throw new Exception('Produto não encontrado');
            }
            
            $new_status = !$product['active'];
            $status_text = $new_status ? 'ativado' : 'pausado';
            
            $sql = "UPDATE products SET active = :active, updated_at = CURRENT_TIMESTAMP WHERE id = :id";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                ':id' => $id,
                ':active' => $new_status
            ]);
            
            // Emite evento para frontend atualizar
            if (class_exists('EventManager')) {
                EventManager::emit('products_updated', ['action' => 'toggled', 'product_id' => $id, 'active' => $new_status ? 1 : 0]);
            }

            echo json_encode([
                'success' => true,
                'message' => "Produto {$status_text} com sucesso",
                'data' => ['active' => $new_status]
            ]);
        } catch (Exception $e) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);
        }
    }
    
    /**
     * Lista produtos ativos para o cardápio público
     */
    public function getActiveProducts() {
        try {
            $sql = "SELECT p.*, c.name as category_name 
                    FROM products p 
                    LEFT JOIN categories c ON p.category_id = c.id 
                    WHERE p.active = 1 AND c.active = 1
                    ORDER BY c.display_order ASC, p.display_order ASC, p.name ASC";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute();
            $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Para cada produto tipo pizza, carregar as configurações disponíveis
            foreach ($products as &$product) {
                if ($product['product_type'] === 'pizza') {
                    $product['pizza_sizes'] = $this->getPizzaSizes($product['id']);
                    $product['pizza_flavors'] = $this->getPizzaFlavors($product['id']);
                    $product['pizza_borders'] = $this->getPizzaBorders($product['id']);
                    $product['pizza_extras'] = $this->getPizzaExtras($product['id']);
                    
                                           // Calcular preço mínimo baseado no tamanho mais barato disponível
                       $product['min_price'] = $this->getMinimumPriceForProduct($product['id']);
                }
            }
            
            echo json_encode([
                'success' => true,
                'data' => $products
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Erro ao listar produtos ativos: ' . $e->getMessage()
            ]);
        }
    }
    
    /**
     * Calcula o preço mínimo para um produto pizza específico
     * Baseado no tamanho mais barato disponível para este produto
     */
    private function getMinimumPriceForProduct($product_id) {
        try {
            // Buscar apenas o tamanho mais barato disponível para este produto
            $sql = "SELECT MIN(ps.price) as min_price
                    FROM pizza_sizes ps
                    JOIN product_pizza_sizes pps ON ps.id = pps.pizza_size_id
                    WHERE pps.product_id = ? 
                    AND ps.active = 1";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$product_id]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            return $result['min_price'] ?? 0;
        } catch (Exception $e) {
            return 0;
        }
    }
    
    /**
     * Salva os tamanhos de pizza para um produto
     */
    private function savePizzaSizes($product_id, $size_ids) {
        if (empty($size_ids)) return;
        
        $sql = "INSERT INTO product_pizza_sizes (product_id, pizza_size_id) VALUES ";
        $values = [];
        $params = [];
        
        foreach ($size_ids as $size_id) {
            $values[] = "(?, ?)";
            $params[] = $product_id;
            $params[] = $size_id;
        }
        
        $sql .= implode(', ', $values);
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
    }
    
    /**
     * Remove todos os tamanhos de pizza de um produto
     */
    private function deletePizzaSizes($product_id) {
        $sql = "DELETE FROM product_pizza_sizes WHERE product_id = ?";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$product_id]);
    }
    
    /**
     * Remove todas as configurações de pizza de um produto
     */
    private function deletePizzaConfigurations($product_id) {
        $this->deletePizzaSizes($product_id);
        $this->deletePizzaFlavors($product_id);
        $this->deletePizzaBorders($product_id);
        $this->deletePizzaExtras($product_id);
    }
    
    /**
     * Carrega os tamanhos de pizza de um produto
     */
    private function getPizzaSizes($product_id) {
        $sql = "SELECT ps.*, pps.id as relation_id 
                FROM pizza_sizes ps 
                JOIN product_pizza_sizes pps ON ps.id = pps.pizza_size_id 
                WHERE pps.product_id = ? AND pps.active = 1
                ORDER BY ps.display_order, ps.name";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$product_id]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    // ========================================
    // MÉTODOS PARA SABORES DE PIZZA
    // ========================================
    
    /**
     * Salva os sabores de pizza para um produto
     */
    private function savePizzaFlavors($product_id, $flavor_ids) {
        if (empty($flavor_ids)) return;
        
        $sql = "INSERT INTO product_pizza_flavors (product_id, pizza_flavor_id) VALUES ";
        $values = [];
        $params = [];
        
        foreach ($flavor_ids as $flavor_id) {
            $values[] = "(?, ?)";
            $params[] = $product_id;
            $params[] = $flavor_id;
        }
        
        $sql .= implode(', ', $values);
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
    }
    
    /**
     * Remove todos os sabores de pizza de um produto
     */
    private function deletePizzaFlavors($product_id) {
        $sql = "DELETE FROM product_pizza_flavors WHERE product_id = ?";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$product_id]);
    }
    
    /**
     * Carrega os sabores de pizza de um produto
     */
    private function getPizzaFlavors($product_id) {
        $sql = "SELECT pf.*, ppf.id as relation_id 
                FROM pizza_flavors pf 
                JOIN product_pizza_flavors ppf ON pf.id = ppf.pizza_flavor_id 
                WHERE ppf.product_id = ? AND ppf.active = 1
                ORDER BY pf.display_order, pf.name";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$product_id]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    // ========================================
    // MÉTODOS PARA BORDAS DE PIZZA
    // ========================================
    
    /**
     * Salva as bordas de pizza para um produto
     */
    private function savePizzaBorders($product_id, $border_ids) {
        if (empty($border_ids)) return;
        
        $sql = "INSERT INTO product_pizza_borders (product_id, pizza_border_id) VALUES ";
        $values = [];
        $params = [];
        
        foreach ($border_ids as $border_id) {
            $values[] = "(?, ?)";
            $params[] = $product_id;
            $params[] = $border_id;
        }
        
        $sql .= implode(', ', $values);
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
    }
    
    /**
     * Remove todas as bordas de pizza de um produto
     */
    private function deletePizzaBorders($product_id) {
        $sql = "DELETE FROM product_pizza_borders WHERE product_id = ?";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$product_id]);
    }
    
    /**
     * Carrega as bordas de pizza de um produto
     */
    private function getPizzaBorders($product_id) {
        $sql = "SELECT pb.*, ppb.id as relation_id 
                FROM pizza_borders pb 
                JOIN product_pizza_borders ppb ON pb.id = ppb.pizza_border_id 
                WHERE ppb.product_id = ? AND ppb.active = 1
                ORDER BY pb.display_order, pb.name";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$product_id]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    // ========================================
    // MÉTODOS PARA ADICIONAIS DE PIZZA
    // ========================================
    
    /**
     * Salva os adicionais de pizza para um produto
     */
    private function savePizzaExtras($product_id, $extra_ids) {
        if (empty($extra_ids)) return;
        
        $sql = "INSERT INTO product_pizza_extras (product_id, pizza_extra_id) VALUES ";
        $values = [];
        $params = [];
        
        foreach ($extra_ids as $extra_id) {
            $values[] = "(?, ?)";
            $params[] = $product_id;
            $params[] = $extra_id;
        }
        
        $sql .= implode(', ', $values);
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
    }
    
    /**
     * Remove todos os adicionais de pizza de um produto
     */
    private function deletePizzaExtras($product_id) {
        $sql = "DELETE FROM product_pizza_extras WHERE product_id = ?";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$product_id]);
    }
    
    /**
     * Carrega os adicionais de pizza de um produto
     */
    private function getPizzaExtras($product_id) {
        $sql = "SELECT pe.*, ppe.id as relation_id 
                FROM pizza_extras pe 
                JOIN product_pizza_extras ppe ON pe.id = ppe.pizza_extra_id 
                WHERE ppe.product_id = ? AND ppe.active = 1
                ORDER BY pe.display_order, pe.name";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$product_id]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Busca produtos por termo (nome, descrição, categoria)
     * Suporta filtros opcionais: category_id, active, exclude_inactive_categories
     */
    public function search($term) {
        try {
            $where = [];
            $params = [];
            
            // Termo de busca em nome, descrição ou nome da categoria
            $where[] = "(p.name LIKE :term OR p.description LIKE :term OR c.name LIKE :term)";
            $params[':term'] = '%' . $term . '%';

            // Filtro opcional por categoria
            if (isset($_GET['category_id']) && $_GET['category_id'] !== '') {
                $where[] = 'p.category_id = :category_id';
                $params[':category_id'] = (int) $_GET['category_id'];
            }

            // Filtro opcional por ativo
            if (isset($_GET['active']) && (($_GET['active'] === 'true') || ($_GET['active'] === '1'))) {
                $where[] = 'p.active = 1';
            }

            // Excluir categorias inativas, se indicado
            $excludeInactiveCategories = isset($_GET['exclude_inactive_categories']) && (($_GET['exclude_inactive_categories'] === 'true') || ($_GET['exclude_inactive_categories'] === '1'));
            if ($excludeInactiveCategories) {
                $where[] = '(c.active = 1 OR c.id IS NULL)';
            }

            $sql = "SELECT p.*, c.name as category_name 
                    FROM products p 
                    LEFT JOIN categories c ON p.category_id = c.id";

            if (!empty($where)) {
                $sql .= ' WHERE ' . implode(' AND ', $where);
            }

            $sql .= ' ORDER BY p.display_order ASC, p.name ASC';

            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($params);
            $products = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode([
                'success' => true,
                'data' => $products
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Erro ao buscar produtos: ' . $e->getMessage()
            ]);
        }
    }
}
?>

