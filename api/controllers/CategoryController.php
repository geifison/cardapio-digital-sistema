<?php
/**
 * Controller para gerenciamento de categorias
 */

class CategoryController {
    private $db;
    
    public function __construct($database) {
        $this->db = $database;
    }
    
    /**
     * Retorna todas as categorias ativas
     */
    public function getAll() {
        try {
            error_log("CategoryController::getAll - Buscando todas as categorias");
            // Se ?all=true for informado, retorna todas. Caso contrário, apenas ativas
            $all = isset($_GET['all']) && (($_GET['all'] === 'true') || ($_GET['all'] === '1'));
            $query = $all
                ? "SELECT * FROM categories ORDER BY display_order ASC, name ASC"
                : "SELECT * FROM categories WHERE active = 1 ORDER BY display_order ASC, name ASC";
            $stmt = $this->db->prepare($query);
            $stmt->execute();
            
            $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            error_log("CategoryController::getAll - Categorias encontradas: " . count($categories));
            
            echo json_encode([
                'success' => true,
                'data' => $categories
            ]);
            
        } catch (Exception $e) {
            error_log("CategoryController::getAll - Exceção: " . $e->getMessage());
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Erro ao buscar categorias',
                'details' => $e->getMessage()
            ]);
        }
    }
    
    /**
     * Retorna uma categoria específica por ID
     */
    public function getById($id) {
        try {
            error_log("CategoryController::getById - Buscando categoria ID: $id");
            
            $query = "SELECT * FROM categories WHERE id = :id";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
            
            $category = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($category) {
                error_log("CategoryController::getById - Categoria encontrada: " . json_encode($category));
                echo json_encode([
                    'success' => true,
                    'data' => $category
                ]);
            } else {
                error_log("CategoryController::getById - Categoria não encontrada: $id");
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Categoria não encontrada'
                ]);
            }
            
        } catch (Exception $e) {
            error_log("CategoryController::getById - Exceção: " . $e->getMessage());
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Erro ao buscar categoria',
                'details' => $e->getMessage()
            ]);
        }
    }
    
    /**
     * Cria uma nova categoria
     */
    public function create($data) {
        try {
            // Log para debug
            error_log("CategoryController::create - Dados recebidos: " . json_encode($data));
            
            // Validação dos dados
            if (empty($data['name'])) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Nome da categoria é obrigatório'
                ]);
                return;
            }
            
            // Garantir que os valores padrão estejam corretos
            $name = trim($data['name']);
            $description = isset($data['description']) ? trim($data['description']) : '';
            $image_url = isset($data['image_url']) && !empty($data['image_url']) ? $data['image_url'] : null;
            $display_order = isset($data['display_order']) ? (int)$data['display_order'] : 0;
            $active = isset($data['active']) ? (int)$data['active'] : 1;
            
            error_log("CategoryController::create - Valores processados: name='$name', description='$description', display_order=$display_order, active=$active");
            
            $query = "INSERT INTO categories (name, description, image_url, display_order, active) 
                      VALUES (:name, :description, :image_url, :display_order, :active)";
            
            $stmt = $this->db->prepare($query);
            
            $stmt->bindParam(':name', $name);
            $stmt->bindParam(':description', $description);
            $stmt->bindParam(':image_url', $image_url);
            $stmt->bindParam(':display_order', $display_order, PDO::PARAM_INT);
            $stmt->bindParam(':active', $active, PDO::PARAM_INT);
            
            error_log("CategoryController::create - Executando query...");
            
            if ($stmt->execute()) {
                $category_id = $this->db->lastInsertId();
                error_log("CategoryController::create - Categoria criada com ID: $category_id");
                
                 // Retorna a categoria criada
                $this->getById($category_id);
                 if (class_exists('EventManager')) {
                     EventManager::emit('categories_updated', ['action' => 'created', 'category_id' => $category_id]);
                 }
            } else {
                $error = $stmt->errorInfo();
                error_log("CategoryController::create - Erro na execução: " . json_encode($error));
                
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Erro ao criar categoria',
                    'details' => $error[2] ?? 'Erro desconhecido na execução'
                ]);
            }
            
        } catch (Exception $e) {
            error_log("CategoryController::create - Exceção: " . $e->getMessage() . " em " . $e->getFile() . " linha " . $e->getLine());
            
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Erro ao criar categoria',
                'details' => $e->getMessage()
            ]);
        }
    }
    
    /**
     * Atualiza uma categoria existente
     */
    public function update($id, $data) {
        try {
            // Log para debug
            error_log("CategoryController::update - ID: $id, Dados recebidos: " . json_encode($data));
            
            // Verifica se a categoria existe
            $check_query = "SELECT id FROM categories WHERE id = :id";
            $check_stmt = $this->db->prepare($check_query);
            $check_stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $check_stmt->execute();
            
            if (!$check_stmt->fetch()) {
                error_log("CategoryController::update - Categoria não encontrada: $id");
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Categoria não encontrada'
                ]);
                return;
            }
            
            // Validação dos dados
            if (empty($data['name'])) {
                error_log("CategoryController::update - Nome vazio");
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Nome da categoria é obrigatório'
                ]);
                return;
            }
            
            // Garantir que os valores padrão estejam corretos
            $name = trim($data['name']);
            $description = isset($data['description']) ? trim($data['description']) : '';
            $image_url = isset($data['image_url']) && !empty($data['image_url']) ? $data['image_url'] : null;
            $display_order = isset($data['display_order']) ? (int)$data['display_order'] : 0;
            $active = isset($data['active']) ? (int)$data['active'] : 1;
            
            error_log("CategoryController::update - Valores processados: name='$name', description='$description', display_order=$display_order, active=$active");
            
            $query = "UPDATE categories SET 
                      name = :name, 
                      description = :description, 
                      image_url = :image_url, 
                      display_order = :display_order, 
                      active = :active,
                      updated_at = CURRENT_TIMESTAMP
                      WHERE id = :id";
            
            $stmt = $this->db->prepare($query);
            
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->bindParam(':name', $name);
            $stmt->bindParam(':description', $description);
            $stmt->bindParam(':image_url', $image_url);
            $stmt->bindParam(':display_order', $display_order, PDO::PARAM_INT);
            $stmt->bindParam(':active', $active, PDO::PARAM_INT);
            
            error_log("CategoryController::update - Executando query...");
            
            if ($stmt->execute()) {
                error_log("CategoryController::update - Categoria atualizada com sucesso");
                // Retorna a categoria atualizada
                $this->getById($id);
                if (class_exists('EventManager')) {
                    EventManager::emit('categories_updated', ['action' => 'updated', 'category_id' => $id]);
                }
            } else {
                $error = $stmt->errorInfo();
                error_log("CategoryController::update - Erro na execução: " . json_encode($error));
                
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Erro ao atualizar categoria',
                    'details' => $error[2] ?? 'Erro desconhecido na execução'
                ]);
            }
            
        } catch (Exception $e) {
            error_log("CategoryController::update - Exceção: " . $e->getMessage() . " em " . $e->getFile() . " linha " . $e->getLine());
            
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Erro ao atualizar categoria',
                'details' => $e->getMessage()
            ]);
        }
    }
    
    /**
     * Exclui uma categoria definitivamente (hard delete)
     * Regras:
     * - Só permite exclusão se NÃO houver nenhum produto (ativo ou inativo) associado
     */
    public function delete($id) {
        try {
            // Verifica se a categoria existe
            $check_query = "SELECT id FROM categories WHERE id = :id";
            $check_stmt = $this->db->prepare($check_query);
            $check_stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $check_stmt->execute();
            
            if (!$check_stmt->fetch()) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Categoria não encontrada'
                ]);
                return;
            }
            
            // Verifica se há QUALQUER produto associado (independente do status)
            $products_query = "SELECT COUNT(*) as count FROM products WHERE category_id = :id";
            $products_stmt = $this->db->prepare($products_query);
            $products_stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $products_stmt->execute();
            $products_count = (int) ($products_stmt->fetch(PDO::FETCH_ASSOC)['count'] ?? 0);
            
            if ($products_count > 0) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Não é possível excluir a categoria: remova ou reclassifique todos os produtos primeiro'
                ]);
                return;
            }
            
            // Hard delete da categoria
            $query = "DELETE FROM categories WHERE id = :id";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            
            if ($stmt->execute()) {
                echo json_encode([
                    'success' => true,
                    'message' => 'Categoria excluída com sucesso'
                ]);
                if (class_exists('EventManager')) {
                    EventManager::emit('categories_updated', ['action' => 'deleted', 'category_id' => $id]);
                }
            } else {
                http_response_code(500);
                echo json_encode([
                    'success' => false,
                    'message' => 'Erro ao excluir categoria'
                ]);
            }
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Erro ao excluir categoria',
                'details' => $e->getMessage()
            ]);
        }
    }
}
?>

