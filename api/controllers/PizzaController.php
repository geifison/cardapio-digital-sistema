<?php

class PizzaController {
    private $pdo;
    
    public function __construct($pdo) {
        $this->pdo = $pdo;
    }
    
    /**
     * Lista todos os tamanhos de pizza
     */
    public function getSizes($all = false) {
        try {
            $sql = "SELECT * FROM pizza_sizes" . ($all ? "" : " WHERE active = 1") . " ORDER BY display_order ASC, name ASC";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute();
            $sizes = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo json_encode([
                'success' => true,
                'data' => $sizes
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Erro ao listar tamanhos: ' . $e->getMessage()
            ]);
        }
    }
    
    /**
     * Lista todos os sabores de pizza
     */
    public function getFlavors($category = null, $all = false) {
        try {
            $sql = "SELECT * FROM pizza_flavors" . ($all ? "" : " WHERE active = 1");
            $params = [];
            
            if ($category) {
                $sql .= ($all ? " WHERE" : " AND") . " category = :category";
                $params[':category'] = $category;
            }
            
            $sql .= " ORDER BY display_order ASC, name ASC";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($params);
            $flavors = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo json_encode([
                'success' => true,
                'data' => $flavors
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Erro ao listar sabores: ' . $e->getMessage()
            ]);
        }
    }

    // === Admin CRUD: Sizes ===
    public function createSize($data) {
        try {
            $sql = "INSERT INTO pizza_sizes (name, slices, max_flavors, price, description, display_order, active) 
                    VALUES (:name, :slices, :max_flavors, :price, :description, :display_order, :active)";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                ':name' => $data['name'],
                ':slices' => (int)$data['slices'],
                ':max_flavors' => (int)$data['max_flavors'],
                ':price' => (float)($data['price'] ?? 0),
                ':description' => $data['description'] ?? '',
                ':display_order' => (int)($data['display_order'] ?? 0),
                ':active' => isset($data['active']) ? (int)!!$data['active'] : 1
            ]);
            echo json_encode(['success' => true, 'message' => 'Tamanho criado com sucesso']);
            if (class_exists('EventManager')) {
                EventManager::emit('pizza_sizes_updated', ['action' => 'created']);
            }
        } catch (Exception $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function updateSize($id, $data) {
        try {
            $sql = "UPDATE pizza_sizes SET name=:name, slices=:slices, max_flavors=:max_flavors, price=:price, description=:description, display_order=:display_order, active=:active WHERE id=:id";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                ':id' => $id,
                ':name' => $data['name'],
                ':slices' => (int)$data['slices'],
                ':max_flavors' => (int)$data['max_flavors'],
                ':price' => (float)($data['price'] ?? 0),
                ':description' => $data['description'] ?? '',
                ':display_order' => (int)($data['display_order'] ?? 0),
                ':active' => isset($data['active']) ? (int)!!$data['active'] : 1
            ]);
            echo json_encode(['success' => true, 'message' => 'Tamanho atualizado com sucesso']);
            if (class_exists('EventManager')) {
                EventManager::emit('pizza_sizes_updated', ['action' => 'updated', 'size_id' => $id]);
            }
        } catch (Exception $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function deleteSize($id) {
        try {
            $stmt = $this->pdo->prepare("DELETE FROM pizza_sizes WHERE id = :id");
            $stmt->execute([':id' => $id]);
            echo json_encode(['success' => true, 'message' => 'Tamanho removido com sucesso']);
            if (class_exists('EventManager')) {
                EventManager::emit('pizza_sizes_updated', ['action' => 'deleted', 'size_id' => $id]);
            }
        } catch (Exception $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    // === Admin CRUD: Flavors ===
    public function createFlavor($data) {
        try {
            $sql = "INSERT INTO pizza_flavors (name, category, category_value, description, ingredients, image_url, display_order, active, is_vegan, is_gluten_free, is_spicy) 
                    VALUES (:name, :category, :category_value, :description, :ingredients, :image_url, :display_order, :active, :is_vegan, :is_gluten_free, :is_spicy)";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                ':name' => $data['name'],
                ':category' => $data['category'],
                ':category_value' => (float)($data['category_value'] ?? 0),
                ':description' => $data['description'] ?? '',
                ':ingredients' => $data['ingredients'] ?? '',
                ':image_url' => $data['image_url'] ?? '',
                ':display_order' => (int)($data['display_order'] ?? 0),
                ':active' => isset($data['active']) ? (int)!!$data['active'] : 1,
                ':is_vegan' => isset($data['is_vegan']) ? (int)!!$data['is_vegan'] : 0,
                ':is_gluten_free' => isset($data['is_gluten_free']) ? (int)!!$data['is_gluten_free'] : 0,
                ':is_spicy' => isset($data['is_spicy']) ? (int)!!$data['is_spicy'] : 0
            ]);
            echo json_encode(['success' => true, 'message' => 'Sabor criado com sucesso']);
            if (class_exists('EventManager')) {
                EventManager::emit('pizza_flavors_updated', ['action' => 'created']);
            }
        } catch (Exception $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function updateFlavor($id, $data) {
        try {
            $sql = "UPDATE pizza_flavors SET name=:name, category=:category, category_value=:category_value, description=:description, ingredients=:ingredients, image_url=:image_url, display_order=:display_order, active=:active, is_vegan=:is_vegan, is_gluten_free=:is_gluten_free, is_spicy=:is_spicy WHERE id=:id";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                ':id' => $id,
                ':name' => $data['name'],
                ':category' => $data['category'],
                ':category_value' => (float)($data['category_value'] ?? 0),
                ':description' => $data['description'] ?? '',
                ':ingredients' => $data['ingredients'] ?? '',
                ':image_url' => $data['image_url'] ?? '',
                ':display_order' => (int)($data['display_order'] ?? 0),
                ':active' => isset($data['active']) ? (int)!!$data['active'] : 1,
                ':is_vegan' => isset($data['is_vegan']) ? (int)!!$data['is_vegan'] : 0,
                ':is_gluten_free' => isset($data['is_gluten_free']) ? (int)!!$data['is_gluten_free'] : 0,
                ':is_spicy' => isset($data['is_spicy']) ? (int)!!$data['is_spicy'] : 0
            ]);
            echo json_encode(['success' => true, 'message' => 'Sabor atualizado com sucesso']);
            if (class_exists('EventManager')) {
                EventManager::emit('pizza_flavors_updated', ['action' => 'updated', 'flavor_id' => $id]);
            }
        } catch (Exception $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function deleteFlavor($id) {
        try {
            $stmt = $this->pdo->prepare("DELETE FROM pizza_flavors WHERE id = :id");
            $stmt->execute([':id' => $id]);
            echo json_encode(['success' => true, 'message' => 'Sabor removido com sucesso']);
            if (class_exists('EventManager')) {
                EventManager::emit('pizza_flavors_updated', ['action' => 'deleted', 'flavor_id' => $id]);
            }
        } catch (Exception $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    // === FUNÇÃO REMOVIDA: Sabores não devem ter preços próprios ===
    // setFlavorPrices() - REMOVIDA pois sabores não têm preços individuais
    
    // === FUNÇÃO REMOVIDA: getFlavorPrices() ===
    // Sabores não têm preços próprios - removida
    
    /**
     * Busca o preço mínimo dos tamanhos de pizza
     */
    public function getMinimumPrice() {
        try {
            $sql = "SELECT MIN(ps.price) as min_price
                    FROM pizza_sizes ps
                    WHERE ps.active = 1";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute();
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            $minPrice = $result['min_price'] ?? 0;
            
            echo json_encode([
                'success' => true,
                'data' => [
                    'min_price' => (float)$minPrice
                ]
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Erro ao buscar preço mínimo: ' . $e->getMessage()
            ]);
        }
    }
    
    // === FUNÇÃO REMOVIDA: getFlavorsWithPrices() ===
    // Sabores não têm preços próprios - removida
    
    /**
     * Lista bordas; se $all = true, inclui inativas. Mapeia additional_price -> price.
     */
    public function getBorders($all = false) {
        try {
            $sql = "SELECT id, name, additional_price AS price, description, display_order, active FROM pizza_borders";
            if (!$all) {
                $sql .= " WHERE active = 1";
            }
            $sql .= " ORDER BY display_order ASC, name ASC";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute();
            $borders = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo json_encode([
                'success' => true,
                'data' => $borders
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Erro ao listar bordas: ' . $e->getMessage()
            ]);
        }
    }
    
    /**
     * Lista todos os adicionais
     */
    public function getExtras($category = null) {
        try {
            $sql = "SELECT * FROM pizza_extras WHERE active = 1";
            $params = [];
            
            if ($category) {
                $sql .= " AND category = :category";
                $params[':category'] = $category;
            }
            
            $sql .= " ORDER BY display_order ASC, name ASC";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($params);
            $extras = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo json_encode([
                'success' => true,
                'data' => $extras
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Erro ao listar adicionais: ' . $e->getMessage()
            ]);
        }
    }

    // === Admin CRUD: Extras ===
    public function createExtra($data) {
        try {
            $sql = "INSERT INTO pizza_extras (name, category, price, description, display_order, active) VALUES (:name, :category, :price, :description, :display_order, :active)";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                ':name' => $data['name'],
                ':category' => $data['category'],
                ':price' => $data['price'],
                ':description' => $data['description'] ?? '',
                ':display_order' => (int)($data['display_order'] ?? 0),
                ':active' => isset($data['active']) ? (int)!!$data['active'] : 1
            ]);
            echo json_encode(['success' => true, 'message' => 'Adicional criado com sucesso']);
            if (class_exists('EventManager')) {
                EventManager::emit('pizza_extras_updated', ['action' => 'created']);
            }
        } catch (Exception $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function updateExtra($id, $data) {
        try {
            $sql = "UPDATE pizza_extras SET name=:name, category=:category, price=:price, description=:description, display_order=:display_order, active=:active WHERE id=:id";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                ':id' => $id,
                ':name' => $data['name'],
                ':category' => $data['category'],
                ':price' => $data['price'],
                ':description' => $data['description'] ?? '',
                ':display_order' => (int)($data['display_order'] ?? 0),
                ':active' => isset($data['active']) ? (int)!!$data['active'] : 1
            ]);
            echo json_encode(['success' => true, 'message' => 'Adicional atualizado com sucesso']);
            if (class_exists('EventManager')) {
                EventManager::emit('pizza_extras_updated', ['action' => 'updated', 'extra_id' => $id]);
            }
        } catch (Exception $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function deleteExtra($id) {
        try {
            $stmt = $this->pdo->prepare("DELETE FROM pizza_extras WHERE id = :id");
            $stmt->execute([':id' => $id]);
            echo json_encode(['success' => true, 'message' => 'Adicional removido com sucesso']);
            if (class_exists('EventManager')) {
                EventManager::emit('pizza_extras_updated', ['action' => 'deleted', 'extra_id' => $id]);
            }
        } catch (Exception $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }
    
    /**
     * Calcula o preço de uma pizza
     */
    public function calculatePrice($data) {
        try {
            $size_id = $data['size_id'] ?? null;
            $flavor_ids = $data['flavor_ids'] ?? [];
            $border_id = $data['border_id'] ?? null;
            $extra_ids = $data['extra_ids'] ?? [];
            
            if (!$size_id || empty($flavor_ids)) {
                throw new Exception('Tamanho e pelo menos um sabor são obrigatórios');
            }
            
            // Verificar se o tamanho existe
            $size_sql = "SELECT * FROM pizza_sizes WHERE id = :id AND active = 1";
            $size_stmt = $this->pdo->prepare($size_sql);
            $size_stmt->execute([':id' => $size_id]);
            $size = $size_stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$size) {
                throw new Exception('Tamanho não encontrado');
            }
            
            // Verificar se não excede o número máximo de sabores
            if (count($flavor_ids) > $size['max_flavors']) {
                throw new Exception("Este tamanho permite no máximo {$size['max_flavors']} sabores");
            }
            
            // Buscar informações dos sabores (sem preços - sabores não têm preço próprio)
            $flavor_sql = "SELECT pf.id, pf.name 
                          FROM pizza_flavors pf 
                          WHERE pf.id = :flavor_id AND pf.active = 1";
            $flavor_stmt = $this->pdo->prepare($flavor_sql);
            
            $flavor_info = [];
            $flavor_names = [];
            
            foreach ($flavor_ids as $flavor_id) {
                $flavor_stmt->execute([':flavor_id' => $flavor_id]);
                $flavor = $flavor_stmt->fetch(PDO::FETCH_ASSOC);
                
                if (!$flavor) {
                    throw new Exception('Sabor não encontrado');
                }
                
                $flavor_info[] = [
                    'id' => $flavor_id,
                    'name' => $flavor['name'],
                    'price' => 0.00  // Sabores não têm preço próprio
                ];
                
                $flavor_names[] = $flavor['name'];
            }
            
            // Preço base = apenas o preço do tamanho (sabores não têm custo adicional)
            $base_price = $size['price'];
            
            // Adicionar preço da borda
            $border_price = 0;
            $border_name = null;
            if ($border_id) {
                $border_sql = "SELECT * FROM pizza_borders WHERE id = :id AND active = 1";
                $border_stmt = $this->pdo->prepare($border_sql);
                $border_stmt->execute([':id' => $border_id]);
                $border = $border_stmt->fetch(PDO::FETCH_ASSOC);
                
                if ($border) {
                    $border_price = $border['additional_price'];
                    $border_name = $border['name'];
                }
            }
            
            // Adicionar preços dos adicionais
            $extras_price = 0;
            $extras_names = [];
            if (!empty($extra_ids)) {
                $extra_sql = "SELECT * FROM pizza_extras WHERE id = :id AND active = 1";
                $extra_stmt = $this->pdo->prepare($extra_sql);
                
                foreach ($extra_ids as $extra_id) {
                    $extra_stmt->execute([':id' => $extra_id]);
                    $extra = $extra_stmt->fetch(PDO::FETCH_ASSOC);
                    
                    if ($extra) {
                        $extras_price += $extra['price'];
                        $extras_names[] = $extra['name'];
                    }
                }
            }
            
            // Preço total = tamanho + sabores + borda + extras
            $total_price = $base_price + $border_price + $extras_price;
            
            echo json_encode([
                'success' => true,
                'data' => [
                    'size' => [
                        'id' => $size['id'],
                        'name' => $size['name'],
                        'slices' => $size['slices'],
                        'max_flavors' => $size['max_flavors'],
                        'price' => $size['price']
                    ],
                    'flavors' => $flavor_info,
                    'border' => $border_name ? [
                        'id' => $border_id,
                        'name' => $border_name,
                        'price' => $border_price
                    ] : null,
                    'extras' => !empty($extras_names) ? [
                        'names' => $extras_names,
                        'price' => $extras_price
                    ] : null,
                    'pricing' => [
                        'size_price' => $size['price'],
                        'flavors_price' => 0.00,  // Sabores não têm preço próprio
                        'base_price' => $base_price,
                        'border_price' => $border_price,
                        'extras_price' => $extras_price,
                        'total_price' => $total_price
                    ],
                    'summary' => [
                        'size_name' => $size['name'],
                        'flavor_names' => $flavor_names,
                        'border_name' => $border_name,
                        'extras_names' => $extras_names,
                        'total_price' => $total_price
                    ]
                ]
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
     * Cria um produto de pizza
     */
    public function createPizzaProduct($data) {
        try {
            $this->pdo->beginTransaction();
            
            // Validar dados obrigatórios
            if (empty($data['size_id']) || empty($data['flavor_ids']) || empty($data['border_id'])) {
                throw new Exception('Tamanho, sabores e borda são obrigatórios');
            }
            
            // Calcular preço
            $price_data = $this->calculatePriceInternal($data);
            $total_price = $price_data['total_price'];
            
            // Criar produto base
            $product_sql = "INSERT INTO products (category_id, name, description, price, active, created_at) 
                           VALUES (:category_id, :name, :description, :price, 1, NOW())";
            
            $product_name = $price_data['summary']['size_name'] . ' - ' . implode(', ', $price_data['summary']['flavor_names']);
            $product_description = "Pizza {$price_data['summary']['size_name']} com " . implode(', ', $price_data['summary']['flavor_names']);
            
            $product_stmt = $this->pdo->prepare($product_sql);
            $product_stmt->execute([
                ':category_id' => $data['category_id'] ?? 2, // Categoria Pizzas
                ':name' => $product_name,
                ':description' => $product_description,
                ':price' => $total_price
            ]);
            
            $product_id = $this->pdo->lastInsertId();
            
            // Criar registro de pizza
            $pizza_sql = "INSERT INTO pizza_products (product_id, size_id, flavor_id, border_id, total_price) 
                         VALUES (:product_id, :size_id, :flavor_id, :border_id, :total_price)";
            $pizza_stmt = $this->pdo->prepare($pizza_sql);
            
            // Para múltiplos sabores, criar um registro para cada sabor
            foreach ($data['flavor_ids'] as $flavor_id) {
                $pizza_stmt->execute([
                    ':product_id' => $product_id,
                    ':size_id' => $data['size_id'],
                    ':flavor_id' => $flavor_id,
                    ':border_id' => $data['border_id'],
                    ':total_price' => $total_price
                ]);
            }
            
            // Adicionar extras se houver
            if (!empty($data['extra_ids'])) {
                $extra_sql = "INSERT INTO pizza_product_extras (pizza_product_id, extra_id, quantity) 
                             VALUES (:pizza_product_id, :extra_id, 1)";
                $extra_stmt = $this->pdo->prepare($extra_sql);
                
                foreach ($data['extra_ids'] as $extra_id) {
                    $extra_stmt->execute([
                        ':pizza_product_id' => $product_id,
                        ':extra_id' => $extra_id
                    ]);
                }
            }
            
            $this->pdo->commit();
            
            echo json_encode([
                'success' => true,
                'message' => 'Pizza criada com sucesso',
                'data' => [
                    'product_id' => $product_id,
                    'name' => $product_name,
                    'price' => $total_price
                ]
            ]);
        } catch (Exception $e) {
            $this->pdo->rollback();
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => $e->getMessage()
            ]);
        }
    }
    
    /**
     * Calcula preço internamente (sem retornar JSON)
     */
    private function calculatePriceInternal($data) {
        $size_id = $data['size_id'];
        $flavor_ids = $data['flavor_ids'];
        $border_id = $data['border_id'] ?? null;
        $extra_ids = $data['extra_ids'] ?? [];
        
        // Buscar tamanho
        $size_sql = "SELECT * FROM pizza_sizes WHERE id = :id AND active = 1";
        $size_stmt = $this->pdo->prepare($size_sql);
        $size_stmt->execute([':id' => $size_id]);
        $size = $size_stmt->fetch(PDO::FETCH_ASSOC);
        
        // Buscar preços dos sabores
        $flavor_sql = "SELECT pf.name, pfp.price 
                      FROM pizza_flavor_prices pfp 
                      JOIN pizza_flavors pf ON pfp.flavor_id = pf.id 
                      WHERE pfp.flavor_id = :flavor_id AND pfp.size_id = :size_id";
        $flavor_stmt = $this->pdo->prepare($flavor_sql);
        
        $max_price = 0;
        $flavor_names = [];
        
        foreach ($flavor_ids as $flavor_id) {
            $flavor_stmt->execute([':flavor_id' => $flavor_id, ':size_id' => $size_id]);
            $flavor = $flavor_stmt->fetch(PDO::FETCH_ASSOC);
            
            $flavor_names[] = $flavor['name'];
            
            if ($flavor['price'] > $max_price) {
                $max_price = $flavor['price'];
            }
        }
        
        $base_price = $max_price;
        
        // Preço da borda
        $border_price = 0;
        $border_name = null;
        if ($border_id) {
            $border_sql = "SELECT * FROM pizza_borders WHERE id = :id AND active = 1";
            $border_stmt = $this->pdo->prepare($border_sql);
            $border_stmt->execute([':id' => $border_id]);
            $border = $border_stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($border) {
                $border_price = $border['additional_price'];
                $border_name = $border['name'];
            }
        }
        
        // Preços dos adicionais
        $extras_price = 0;
        $extras_names = [];
        if (!empty($extra_ids)) {
            $extra_sql = "SELECT * FROM pizza_extras WHERE id = :id AND active = 1";
            $extra_stmt = $this->pdo->prepare($extra_sql);
            
            foreach ($extra_ids as $extra_id) {
                $extra_stmt->execute([':id' => $extra_id]);
                $extra = $extra_stmt->fetch(PDO::FETCH_ASSOC);
                
                if ($extra) {
                    $extras_price += $extra['price'];
                    $extras_names[] = $extra['name'];
                }
            }
        }
        
        $total_price = $base_price + $border_price + $extras_price;
        
        return [
            'total_price' => $total_price,
            'summary' => [
                'size_name' => $size['name'],
                'flavor_names' => $flavor_names,
                'border_name' => $border_name,
                'extras_names' => $extras_names,
                'total_price' => $total_price
            ]
        ];
    }

    // === Admin CRUD: Borders ===
    public function createBorder($data) {
        try {
            $sql = "INSERT INTO pizza_borders (name, additional_price, description, display_order, active) VALUES (:name, :additional_price, :description, :display_order, :active)";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                ':name' => $data['name'],
                ':additional_price' => (float)($data['price'] ?? 0),
                ':description' => $data['description'] ?? '',
                ':display_order' => (int)($data['display_order'] ?? 0),
                ':active' => isset($data['active']) ? (int)!!$data['active'] : 1
            ]);
            echo json_encode(['success' => true, 'message' => 'Borda criada com sucesso']);
            if (class_exists('EventManager')) {
                EventManager::emit('pizza_borders_updated', ['action' => 'created']);
            }
        } catch (Exception $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function updateBorder($id, $data) {
        try {
            $sql = "UPDATE pizza_borders SET name=:name, additional_price=:additional_price, description=:description, display_order=:display_order, active=:active WHERE id=:id";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                ':id' => $id,
                ':name' => $data['name'],
                ':additional_price' => (float)($data['price'] ?? 0),
                ':description' => $data['description'] ?? '',
                ':display_order' => (int)($data['display_order'] ?? 0),
                ':active' => isset($data['active']) ? (int)!!$data['active'] : 1
            ]);
            echo json_encode(['success' => true, 'message' => 'Borda atualizada com sucesso']);
            if (class_exists('EventManager')) {
                EventManager::emit('pizza_borders_updated', ['action' => 'updated', 'border_id' => $id]);
            }
        } catch (Exception $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }

    public function deleteBorder($id) {
        try {
            $stmt = $this->pdo->prepare("DELETE FROM pizza_borders WHERE id = :id");
            $stmt->execute([':id' => $id]);
            echo json_encode(['success' => true, 'message' => 'Borda removida com sucesso']);
            if (class_exists('EventManager')) {
                EventManager::emit('pizza_borders_updated', ['action' => 'deleted', 'border_id' => $id]);
            }
        } catch (Exception $e) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $e->getMessage()]);
        }
    }
}
