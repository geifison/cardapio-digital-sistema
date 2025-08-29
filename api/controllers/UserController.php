<?php
/**
 * Controller para gerenciamento de usuários
 */

class UserController {
    private $db;
    
    public function __construct($database) {
        $this->db = $database;
    }
    
    /**
     * Lista todos os usuários (apenas admin)
     */
    public function listUsers() {
        try {
            // Verifica se o usuário é admin
            $session = $this->requireAdminAuth();
            
            $query = "SELECT id, name, email, role, created_at, updated_at FROM users ORDER BY name";
            $stmt = $this->db->prepare($query);
            $stmt->execute();
            
            $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo json_encode([
                'success' => true,
                'data' => $users
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'error' => true,
                'message' => 'Erro ao listar usuários',
                'details' => $e->getMessage()
            ]);
        }
    }
    
    /**
     * Cria um novo usuário (apenas admin)
     */
    public function createUser($data) {
        try {
            // Verifica se o usuário é admin
            $session = $this->requireAdminAuth();
            
            // Validação dos dados
            if (empty($data['name']) || empty($data['email']) || empty($data['password']) || empty($data['role'])) {
                http_response_code(400);
                echo json_encode([
                    'error' => true,
                    'message' => 'Todos os campos são obrigatórios'
                ]);
                return;
            }
            
            // Validação do email
            if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
                http_response_code(400);
                echo json_encode([
                    'error' => true,
                    'message' => 'Email inválido'
                ]);
                return;
            }
            
            // Validação da senha
            if (strlen($data['password']) < 6) {
                http_response_code(400);
                echo json_encode([
                    'error' => true,
                    'message' => 'A senha deve ter pelo menos 6 caracteres'
                ]);
                return;
            }
            
            // Validação do role
            $allowedRoles = ['admin', 'manager', 'operator', 'delivery', 'kitchen'];
            if (!in_array($data['role'], $allowedRoles)) {
                http_response_code(400);
                echo json_encode([
                    'error' => true,
                    'message' => 'Perfil inválido'
                ]);
                return;
            }
            
            // Verifica se o email já existe
            $query = "SELECT id FROM users WHERE email = :email";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':email', $data['email']);
            $stmt->execute();
            
            if ($stmt->fetch()) {
                http_response_code(400);
                echo json_encode([
                    'error' => true,
                    'message' => 'Este email já está em uso'
                ]);
                return;
            }
            
            // Cria o usuário
            $query = "INSERT INTO users (name, email, password, role) VALUES (:name, :email, :password, :role)";
            $stmt = $this->db->prepare($query);

            // --- INÍCIO DA CORREÇÃO ---
            // Primeiro, guardamos o resultado da função password_hash() em uma variável.
            $hashed_password = password_hash($data['password'], PASSWORD_DEFAULT);
            
            $stmt->bindParam(':name', $data['name']);
            $stmt->bindParam(':email', $data['email']);
            // Agora, passamos a variável para o bindParam().
            $stmt->bindParam(':password', $hashed_password);
            $stmt->bindParam(':role', $data['role']);
            // --- FIM DA CORREÇÃO ---

            $stmt->execute();
            
            echo json_encode([
                'success' => true,
                'message' => 'Usuário criado com sucesso',
                'data' => [
                    'id' => $this->db->lastInsertId(),
                    'name' => $data['name'],
                    'email' => $data['email'],
                    'role' => $data['role']
                ]
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'error' => true,
                'message' => 'Erro ao criar usuário',
                'details' => $e->getMessage()
            ]);
        }
    }
    
    /**
     * Atualiza um usuário existente (apenas admin)
     */
    public function updateUser($data) {
        try {
            // Verifica se o usuário é admin
            $session = $this->requireAdminAuth();
            
            // Validação dos dados
            if (empty($data['id']) || empty($data['name']) || empty($data['email']) || empty($data['role'])) {
                http_response_code(400);
                echo json_encode([
                    'error' => true,
                    'message' => 'ID, nome, email e perfil são obrigatórios'
                ]);
                return;
            }
            
            // Validação do email
            if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
                http_response_code(400);
                echo json_encode([
                    'error' => true,
                    'message' => 'Email inválido'
                ]);
                return;
            }
            
            // Validação do role
            $allowedRoles = ['admin', 'manager', 'operator', 'delivery', 'kitchen'];
            if (!in_array($data['role'], $allowedRoles)) {
                http_response_code(400);
                echo json_encode([
                    'error' => true,
                    'message' => 'Perfil inválido'
                ]);
                return;
            }
            
            // Verifica se o usuário existe
            $query = "SELECT id, role FROM users WHERE id = :id";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $data['id']);
            $stmt->execute();
            
            $existingUser = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$existingUser) {
                http_response_code(404);
                echo json_encode([
                    'error' => true,
                    'message' => 'Usuário não encontrado'
                ]);
                return;
            }
            
            // Verifica se o email já existe em outro usuário
            $query = "SELECT id FROM users WHERE email = :email AND id != :id";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':email', $data['email']);
            $stmt->bindParam(':id', $data['id']);
            $stmt->execute();
            
            if ($stmt->fetch()) {
                http_response_code(400);
                echo json_encode([
                    'error' => true,
                    'message' => 'Este email já está em uso por outro usuário'
                ]);
                return;
            }
            
            // Prepara a query de atualização
            $updateFields = ['name = :name', 'email = :email', 'role = :role'];
            $params = [
                ':id' => $data['id'],
                ':name' => $data['name'],
                ':email' => $data['email'],
                ':role' => $data['role']
            ];
            
            // Se uma nova senha foi fornecida, inclui na atualização
            if (!empty($data['password'])) {
                if (strlen($data['password']) < 6) {
                    http_response_code(400);
                    echo json_encode([
                        'error' => true,
                        'message' => 'A senha deve ter pelo menos 6 caracteres'
                    ]);
                    return;
                }
                $updateFields[] = 'password = :password';
                $params[':password'] = password_hash($data['password'], PASSWORD_DEFAULT);
            }
            
            $query = "UPDATE users SET " . implode(', ', $updateFields) . ", updated_at = CURRENT_TIMESTAMP WHERE id = :id";
            $stmt = $this->db->prepare($query);
            $stmt->execute($params);
            
            echo json_encode([
                'success' => true,
                'message' => 'Usuário atualizado com sucesso'
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'error' => true,
                'message' => 'Erro ao atualizar usuário',
                'details' => $e->getMessage()
            ]);
        }
    }
    
    /**
     * Exclui um usuário (apenas admin)
     */
    public function deleteUser($data) {
        try {
            // Verifica se o usuário é admin
            $session = $this->requireAdminAuth();
            
            // Validação dos dados
            if (empty($data['id'])) {
                http_response_code(400);
                echo json_encode([
                    'error' => true,
                    'message' => 'ID do usuário é obrigatório'
                ]);
                return;
            }
            
            // Verifica se o usuário existe e qual é seu role
            $query = "SELECT id, role FROM users WHERE id = :id";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $data['id']);
            $stmt->execute();
            
            $existingUser = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$existingUser) {
                http_response_code(404);
                echo json_encode([
                    'error' => true,
                    'message' => 'Usuário não encontrado'
                ]);
                return;
            }
            
            // Não permite excluir usuários admin
            if ($existingUser['role'] === 'admin') {
                http_response_code(400);
                echo json_encode([
                    'error' => true,
                    'message' => 'Não é possível excluir usuários administradores'
                ]);
                return;
            }
            
            // Não permite excluir o próprio usuário
            if ($existingUser['id'] == $session['user_id']) {
                http_response_code(400);
                echo json_encode([
                    'error' => true,
                    'message' => 'Não é possível excluir seu próprio usuário'
                ]);
                return;
            }
            
            // Exclui o usuário
            $query = "DELETE FROM users WHERE id = :id";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':id', $data['id']);
            $stmt->execute();
            
            echo json_encode([
                'success' => true,
                'message' => 'Usuário excluído com sucesso'
            ]);
            
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode([
                'error' => true,
                'message' => 'Erro ao excluir usuário',
                'details' => $e->getMessage()
            ]);
        }
    }
    
    /**
     * Middleware para verificar se o usuário é admin
     */
    private function requireAdminAuth() {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }

        if (!isset($_SESSION['user_id'])) {
            http_response_code(401);
            echo json_encode([
                'error' => true,
                'message' => 'Acesso não autorizado'
            ]);
            exit();
        }
        
        // Verifica se o usuário é admin
        if ($_SESSION['user_role'] !== 'admin') {
            http_response_code(403);
            echo json_encode([
                'error' => true,
                'message' => 'Acesso negado. Apenas administradores podem realizar esta ação.'
            ]);
            exit();
        }
        
        return $_SESSION;
    }
}
